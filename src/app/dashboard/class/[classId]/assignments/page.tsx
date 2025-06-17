
'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle as ShadDialogTitle, DialogClose, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle as ShadAlertDialogTitle } from "@/components/ui/alert-dialog";

import { ArrowLeft, ClipboardList, FileText, Loader2, UploadCloud, Eye, Trash2, RotateCcw, Info } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { autoCheckAssignment, type AutoCheckAssignmentInput, type AutoCheckAssignmentOutput } from '@/ai/flows/auto-check-assignment-flow';
import { format, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import { db, storage } from '@/lib/firebase'; 
import { collection, query, orderBy, onSnapshot, doc, setDoc, updateDoc, getDoc, deleteDoc, serverTimestamp, Timestamp } from 'firebase/firestore'; 
import { ref as storageRef, uploadBytesResumable, getDownloadURL, deleteObject as deleteStorageObject } from 'firebase/storage'; 

interface AssignmentDefinition { 
  id: string;
  title: string;
  dueDate: any; 
  description?: string;
  teacherRubricText?: string; 
}

interface StudentSubmission { 
  id: string; 
  title: string; 
  status: 'Pending' | 'Submitted' | 'Graded' | 'Overdue' | 'Awaiting Feedback';
  submittedFileName?: string;
  submittedFileContent?: string; 
  submittedFileStoragePath?: string; 
  feedback?: AutoCheckAssignmentOutput | null;
  lastSubmittedAt?: any; 
}

const getStatusColor = (status: StudentSubmission['status']) => {
  switch (status) {
    case 'Graded': return 'bg-green-500/20 text-green-700 border-green-500/50';
    case 'Submitted': return 'bg-blue-500/20 text-blue-700 border-blue-500/50';
    case 'Pending': return 'bg-yellow-500/20 text-yellow-700 border-yellow-500/50';
    case 'Awaiting Feedback': return 'bg-purple-500/20 text-purple-700 border-purple-500/50';
    case 'Overdue': return 'bg-red-500/20 text-red-700 border-red-500/50';
    default: return 'bg-muted text-muted-foreground border-border';
  }
};

const FeedbackDialogContent = ({ assignment }: { assignment: StudentSubmission }) => { 
  if (!assignment.feedback && !assignment.submittedFileContent) {
    return ( <div className="flex flex-col items-center justify-center text-center p-6 space-y-3"><Info className="w-12 h-12 text-muted-foreground" /><p className="text-lg font-medium">No Feedback or Submission Details</p><p className="text-sm text-muted-foreground">It seems feedback hasn't been generated yet, or no submission details are available for this assignment.</p></div>);
  }
  return (
    <ScrollArea className="max-h-[70vh]"><div className="space-y-6 p-1">{assignment.submittedFileName && (<div><h4 className="font-semibold text-md mb-1 text-foreground">Your Submission:</h4><p className="text-sm text-muted-foreground mb-1">File: <span className="font-medium text-accent">{assignment.submittedFileName}</span></p>{assignment.submittedFileContent && (<Textarea value={assignment.submittedFileContent} readOnly className="mt-1 rounded-lg h-40 text-xs bg-muted/30 border-border/50" placeholder="Your submitted content..."/>)}</div>)}{assignment.feedback ? (<div><h4 className="font-semibold text-md mb-2 text-foreground">AI Feedback:</h4><div className="space-y-3 text-sm p-3 bg-muted/30 rounded-lg border border-border/50"><p><span className="font-medium">Overall:</span> {assignment.feedback.overallFeedback}</p>{assignment.feedback.similarityScore !== undefined && (<p><span className="font-medium">Similarity Score:</span> {assignment.feedback.similarityScore}%</p>)}{assignment.feedback.isPlagiarized !== undefined && (<p><span className="font-medium">Plagiarism Check:</span> {assignment.feedback.isPlagiarized ? "Potential issues detected." : "Looks original."}</p>)}{assignment.feedback.specificPoints && assignment.feedback.specificPoints.length > 0 && (<div><p className="font-medium mb-1">Specific Points:</p><ul className="list-disc space-y-1 pl-5">{assignment.feedback.specificPoints.map((point, index) => (<li key={index}><strong>{point.point}:</strong> {point.assessment}{point.studentExtract && <span className="text-xs italic text-muted-foreground ml-1">(e.g., "{point.studentExtract}")</span>}</li>))}</ul></div>)}</div></div>) : ( <p className="text-sm text-muted-foreground italic">AI feedback is not available for this submission yet.</p>)}</div></ScrollArea>
  );
};


export default function ClassAssignmentsPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const classId = params.classId as string;
  const className = searchParams.get('name') || "Class";

  const [assignmentDefinitions, setAssignmentDefinitions] = useState<AssignmentDefinition[]>([]);
  const [studentSubmissions, setStudentSubmissions] = useState<StudentSubmission[]>([]);
  const [combinedAssignments, setCombinedAssignments] = useState<StudentSubmission[]>([]); 
  const [loading, setLoading] = useState(true);

  const rubricFileRef = useRef<HTMLInputElement>(null);
  const studentSubmissionFileRef = useRef<HTMLInputElement>(null);

  const [currentAssignmentForRubricUpload, setCurrentAssignmentForRubricUpload] = useState<AssignmentDefinition | null>(null);
  const [currentAssignmentForSubmission, setCurrentAssignmentForSubmission] = useState<AssignmentDefinition | null>(null);
  const [uploadedRubricText, setUploadedRubricText] = useState<string | null>(null);

  const [isFeedbackDialogOpen, setIsFeedbackDialogOpen] = useState(false);
  const [selectedAssignmentForFeedback, setSelectedAssignmentForFeedback] = useState<StudentSubmission | null>(null);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [assignmentToDelete, setAssignmentToDelete] = useState<StudentSubmission | null>(null);

  useEffect(() => {
    if (!classId || !db) return;
    setLoading(true);
    const assignmentsColRef = collection(db, "classrooms", classId, "assignments");
    const q = query(assignmentsColRef, orderBy("dueDate", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedDefinitions: AssignmentDefinition[] = [];
      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        fetchedDefinitions.push({
          id: docSnap.id,
          title: data.title,
          dueDate: data.dueDate?.toDate ? data.dueDate.toDate() : new Date(data.dueDate),
          description: data.description,
          teacherRubricText: data.teacherRubricText, 
        });
      });
      setAssignmentDefinitions(fetchedDefinitions);
      if (!user) setLoading(false); 
    }, (error: any) => {
      console.error("Error fetching assignment definitions:", error);
      let desc = "Could not load assignment definitions.";
      if (error.code === 'permission-denied') {
        desc = "Permission denied fetching assignment definitions. Please check Firestore security rules.";
      }
      toast({ variant: "destructive", title: "Error", description: desc });
      setLoading(false);
    });
    return () => unsubscribe();
  }, [classId, toast, user]);

  useEffect(() => {
    if (!classId || !user || !db || assignmentDefinitions.length === 0) {
        if (assignmentDefinitions.length > 0 && !user) setLoading(false); 
        return;
    }
    
    const fetchSubmissions = async () => {
        const submissionsPromises = assignmentDefinitions.map(async (def) => {
            const subDocRef = doc(db, "classrooms", classId, "assignments", def.id, "submissions", user.uid);
            const subDocSnap = await getDoc(subDocRef);
            if (subDocSnap.exists()) {
                const data = subDocSnap.data();
                return {
                    ...def, 
                    status: data.status || 'Submitted',
                    submittedFileName: data.submittedFileName,
                    submittedFileContent: data.submittedFileContent,
                    submittedFileStoragePath: data.submittedFileStoragePath,
                    feedback: data.feedback,
                    lastSubmittedAt: data.lastSubmittedAt?.toDate ? data.lastSubmittedAt.toDate() : new Date(data.lastSubmittedAt),
                } as StudentSubmission;
            }
            return {
                ...def,
                status: 'Pending',
            } as StudentSubmission;
        });

        try {
            const fetchedSubmissions = await Promise.all(submissionsPromises);
            setStudentSubmissions(fetchedSubmissions);
        } catch (error: any) {
            console.error("Error fetching student submissions:", error);
            let desc = "Could not load your submissions.";
            if (error.code === 'permission-denied') {
                desc = "Permission denied fetching your submissions. Please check Firestore security rules.";
            }
            toast({ variant: "destructive", title: "Error", description: desc });
        } finally {
             setLoading(false);
        }
    };
    
    fetchSubmissions();

  }, [classId, user, assignmentDefinitions, toast]);

  useEffect(() => {
    if (assignmentDefinitions.length === 0) {
        setCombinedAssignments([]);
        return;
    }
    if (!user) { 
        setCombinedAssignments(assignmentDefinitions.map(def => ({
            ...def,
            status: 'Pending', 
        })));
        return;
    }

    const merged = assignmentDefinitions.map(def => {
      const submission = studentSubmissions.find(sub => sub.id === def.id);
      if (submission) {
        return { 
          id: def.id,
          title: def.title,
          dueDate: def.dueDate, 
          description: def.description, 
          status: submission.status,
          submittedFileName: submission.submittedFileName,
          submittedFileContent: submission.submittedFileContent,
          feedback: submission.feedback,
          lastSubmittedAt: submission.lastSubmittedAt
        };
      }
      return { ...def, status: 'Pending' as StudentSubmission['status'] };
    });

    const now = new Date();
    const finalAssignments = merged.map(a => {
        if (a.status === 'Pending' && a.dueDate && new Date(a.dueDate) < now) {
            return { ...a, status: 'Overdue' as StudentSubmission['status'] };
        }
        return a;
    });

    setCombinedAssignments(finalAssignments);
  }, [assignmentDefinitions, studentSubmissions, user]);


  const handleInitiateSubmission = (assignmentDef: AssignmentDefinition) => { 
    const submission = combinedAssignments.find(ca => ca.id === assignmentDef.id);
    if (submission?.status === 'Graded' || submission?.status === 'Awaiting Feedback') {
      toast({title: "Already Processed", description: `This assignment (${assignmentDef.title}) is already ${submission.status.toLowerCase()}. You can view feedback or resubmit if allowed.`});
      return;
    }
    if (!user) {
         toast({ variant: "destructive", title: "Login Required", description: "Please sign in to submit assignments." });
         router.push('/auth/signin');
         return;
    }
    setCurrentAssignmentForRubricUpload(assignmentDef); 
    
    if (assignmentDef.teacherRubricText) { 
        setUploadedRubricText(assignmentDef.teacherRubricText);
        setCurrentAssignmentForSubmission(assignmentDef); 
        setCurrentAssignmentForRubricUpload(null);
        toast({title: "Step: Select Your Submission", description: `Rubric provided by teacher for "${assignmentDef.title}". Now, please select your assignment file (.txt).`, duration: 7000 });
        studentSubmissionFileRef.current?.click();
    } else { 
        toast({ title: "Step 1: Select Rubric", description: `Please select the teacher's rubric/model answer file (.txt) for "${assignmentDef.title}".`, duration: 7000 });
        rubricFileRef.current?.click();
    }
  };

  const handleRubricFileSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (event.target) event.target.value = ""; 
    if (!file) { toast({ variant: "info", title: "Rubric Selection Cancelled" }); setCurrentAssignmentForRubricUpload(null); return; }
    if (file.type !== "text/plain") { toast({ variant: "destructive", title: "Invalid Rubric File Type", description: "Please upload a .txt file for the rubric." }); setCurrentAssignmentForRubricUpload(null); return; }
    if (!currentAssignmentForRubricUpload) { toast({ variant: "destructive", title: "Internal Error", description: "Assignment context lost." }); return; }

    const reader = new FileReader();
    reader.onload = async (e) => {
      const rubricText = e.target?.result as string;
      if (!rubricText?.trim()) { toast({ variant: "destructive", title: "Empty Rubric File" }); setCurrentAssignmentForRubricUpload(null); return; }
      setUploadedRubricText(rubricText);
      setCurrentAssignmentForSubmission(currentAssignmentForRubricUpload);
      setCurrentAssignmentForRubricUpload(null);
      toast({ title: "Step 2: Select Your Submission", description: `Rubric for "${currentAssignmentForRubricUpload.title}" loaded. Now, select your assignment file (.txt).`, duration: 7000 });
      studentSubmissionFileRef.current?.click();
    };
    reader.onerror = () => { toast({ variant: "destructive", title: "Rubric File Read Error" }); setCurrentAssignmentForRubricUpload(null); };
    reader.readAsText(file);
  };

  const handleStudentSubmissionFileSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (event.target) event.target.value = ""; 
    if (!file) { toast({ variant: "info", title: "Submission File Cancelled" }); setCurrentAssignmentForSubmission(null); setUploadedRubricText(null); return; }
    if (file.type !== "text/plain") { toast({ variant: "destructive", title: "Invalid File Type", description: "Please upload a .txt file for your assignment." }); setCurrentAssignmentForSubmission(null); setUploadedRubricText(null); return; }
    if (!currentAssignmentForSubmission || !uploadedRubricText || !user || !classId) { toast({ variant: "destructive", title: "Internal Error", description: "Missing context. Restart submission." }); return; }

    const reader = new FileReader();
    reader.onload = async (e) => {
      const studentAssignmentText = e.target?.result as string;
      if (!studentAssignmentText?.trim()) { toast({ variant: "destructive", title: "Empty Submission File" }); setCurrentAssignmentForSubmission(null); setUploadedRubricText(null); return; }

      const assignmentId = currentAssignmentForSubmission.id;
      setCombinedAssignments(prev => prev.map(a => a.id === assignmentId ? {...a, status: 'Awaiting Feedback'} : a));
      toast({ title: "Processing Submission...", description: "Checking with AI. This may take a moment." });
      
      let feedbackResult: AutoCheckAssignmentOutput | null = null;
      try {
        const aiInput: AutoCheckAssignmentInput = {
          studentAssignmentText: studentAssignmentText.substring(0, 15000), 
          teacherRubricText: uploadedRubricText.substring(0, 10000), 
          assignmentTitle: currentAssignmentForSubmission.title,
        };
        feedbackResult = await autoCheckAssignment(aiInput);
      } catch (aiError) {
        console.error("Error during AI check:", aiError);
        toast({ variant: "destructive", title: "AI Check Error", description: "Could not get AI feedback. " + (aiError instanceof Error ? aiError.message : "Please try again.") });
      }
      
      const submissionFilePath = `class_submissions/${classId}/${assignmentId}/${user.uid}/${file.name}`;
      const submissionFileRef = storageRef(storage, submissionFilePath);
      try {
        await uploadBytesResumable(submissionFileRef, file);
        
        const submissionDocRef = doc(db, "classrooms", classId, "assignments", assignmentId, "submissions", user.uid);
        await setDoc(submissionDocRef, {
            userId: user.uid,
            assignmentId: assignmentId,
            title: currentAssignmentForSubmission.title,
            status: feedbackResult ? 'Submitted' : 'Awaiting Feedback', 
            submittedFileName: file.name,
            submittedFileContent: studentAssignmentText, 
            submittedFileStoragePath: submissionFilePath,
            feedback: feedbackResult || null,
            lastSubmittedAt: serverTimestamp(),
        }, { merge: true });

        setCombinedAssignments(prev => prev.map(a =>
            a.id === assignmentId ? { ...a, status: feedbackResult ? 'Submitted' : 'Awaiting Feedback', feedback: feedbackResult, submittedFileName: file.name, submittedFileContent: studentAssignmentText } : a
        ));
        toast({ title: feedbackResult ? "AI Feedback Received" : "Submission Saved (AI Skipped)", description: `Your work for "${currentAssignmentForSubmission.title}" is saved. ${feedbackResult ? 'Click "View Feedback".' : ''}`, duration: 7000 });

      } catch (error: any) {
        console.error("Error saving submission or uploading file:", error);
        let desc = "Could not save your submission. " + (error instanceof Error ? error.message : "Please try again.");
        if (error.code === 'permission-denied') {
            desc = "Permission denied to save submission. Check Firestore rules for 'classrooms/{classId}/assignments/{assignmentId}/submissions'.";
        } else if (error.code && error.code.includes('storage/unauthorized')) {
            desc = "Permission denied for submission file upload. Check Firebase Storage rules for 'class_submissions'.";
        }
        toast({ variant: "destructive", title: "Submission Save Error", description: desc });
        setCombinedAssignments(prev => prev.map(a => a.id === assignmentId ? {...a, status: 'Pending', feedback: null, submittedFileName: undefined, submittedFileContent: undefined } : a));
      } finally {
        setCurrentAssignmentForSubmission(null);
        setUploadedRubricText(null);
      }
    };
    reader.onerror = () => { toast({ variant: "destructive", title: "Submission File Read Error" }); setCurrentAssignmentForSubmission(null); setUploadedRubricText(null); };
    reader.readAsText(file);
  };


  const handleViewFeedback = (assignment: StudentSubmission) => {
    setSelectedAssignmentForFeedback(assignment);
    setIsFeedbackDialogOpen(true);
  };

  const handleDeleteSubmission = (assignment: StudentSubmission) => {
    setAssignmentToDelete(assignment);
    setIsDeleteConfirmOpen(true);
  };

  const confirmDeleteSubmission = async () => {
    if (!assignmentToDelete || !user || !classId) return;
    const assignmentId = assignmentToDelete.id;
    
    try {
      const submissionDocRef = doc(db, "classrooms", classId, "assignments", assignmentId, "submissions", user.uid);
      await deleteDoc(submissionDocRef);

      if (assignmentToDelete.submittedFileStoragePath) {
        const fileToDeleteRef = storageRef(storage, assignmentToDelete.submittedFileStoragePath);
        await deleteStorageObject(fileToDeleteRef).catch(e => console.warn("Error deleting file from storage:", e));
      }

      setCombinedAssignments(prev => prev.map(a =>
        a.id === assignmentId ? { ...a, status: 'Pending', feedback: null, submittedFileName: undefined, submittedFileContent: undefined, submittedFileStoragePath: undefined } : a
      ));
      toast({ title: "Submission Deleted", description: `Your submission for "${assignmentToDelete.title}" has been removed.` });
    } catch (error: any) {
      console.error("Error deleting submission:", error);
      let desc = "Could not delete submission.";
      if (error.code === 'permission-denied') {
          desc = "Permission denied to delete submission. Check Firestore rules.";
      } else if (error.code && error.code.includes('storage/unauthorized')) {
          desc = "Permission denied deleting submission file from storage. Check Storage rules.";
      }
      toast({ variant: "destructive", title: "Deletion Failed", description: desc });
    }
    setIsDeleteConfirmOpen(false);
    setAssignmentToDelete(null);
  };

  if (loading || authLoading) {
    return ( <div className="flex flex-col items-center justify-center h-full p-8"><Loader2 className="h-12 w-12 animate-spin text-primary mb-4" /><p className="text-muted-foreground">Loading assignments for {className}...</p></div> );
  }

  return (
    <div className="space-y-6 p-4 md:p-8 h-full flex flex-col">
      <input type="file" ref={rubricFileRef} onChange={handleRubricFileSelected} accept=".txt" style={{ display: 'none' }} />
      <input type="file" ref={studentSubmissionFileRef} onChange={handleStudentSubmissionFileSelected} accept=".txt" style={{ display: 'none' }} />
      
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3"><ClipboardList className="h-8 w-8 text-primary" /><div><h1 className="text-2xl font-bold text-foreground">Assignments for {className}</h1><p className="text-sm text-muted-foreground">Class ID: {classId}</p></div></div>
        <Link href={`/dashboard/class/${classId}?name=${encodeURIComponent(className)}`} passHref legacyBehavior><Button variant="outline" className="rounded-lg"><ArrowLeft className="mr-2 h-4 w-4" /> Back to Class Details</Button></Link>
      </div>

      {combinedAssignments.length === 0 ? (
        <Card className="flex-grow flex flex-col items-center justify-center text-center py-12 rounded-xl shadow-lg border-border/50"><FileText className="mx-auto h-16 w-16 text-muted-foreground mb-4" /><CardTitle className="text-xl">No Assignments Found</CardTitle><CardDescription>There are no assignments posted for this class yet.</CardDescription></Card>
      ) : (
        <ScrollArea className="flex-grow">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-4">
            {combinedAssignments.map((assignment) => {
              const definition = assignmentDefinitions.find(def => def.id === assignment.id);
              return (
              <Card key={assignment.id} className="flex flex-col rounded-xl shadow-lg border-border/50">
                <CardHeader><div className="flex justify-between items-start"><CardTitle className="text-lg" title={assignment.title}>{assignment.title}</CardTitle><Badge variant="outline" className={`text-xs ${getStatusColor(assignment.status)} rounded-md`}>{assignment.status}</Badge></div><CardDescription className="text-xs">Due: {assignment.dueDate ? format(new Date(assignment.dueDate), "PP") : 'N/A'}</CardDescription></CardHeader>
                <CardContent className="flex-grow"><p className="text-sm text-muted-foreground line-clamp-3">{definition?.description || "No description provided."}</p></CardContent>
                <CardFooter className="grid grid-cols-1 gap-2">
                  {(assignment.status === 'Pending' || assignment.status === 'Overdue') && definition ? ( <Button variant="default" className="w-full btn-gel rounded-lg text-sm" onClick={() => handleInitiateSubmission(definition)} disabled={!user}><UploadCloud className="mr-2 h-4 w-4" /> Submit Assignment</Button>) : 
                  assignment.status === 'Awaiting Feedback' ? ( <Button variant="outline" className="w-full rounded-lg text-sm" disabled><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Awaiting Feedback</Button>) : 
                  ( <>
                      <Button variant="outline" className="w-full rounded-lg text-sm" onClick={() => handleViewFeedback(assignment)}><Eye className="mr-2 h-4 w-4" /> View Feedback</Button>
                      {(assignment.status === 'Submitted' || assignment.status === 'Graded') && definition && (<div className="grid grid-cols-2 gap-2">
                           <Button variant="secondary" className="w-full rounded-lg text-sm" onClick={() => handleInitiateSubmission(definition)} disabled={!user}><RotateCcw className="mr-2 h-4 w-4" /> Resubmit</Button>
                           <Button variant="destructive" className="w-full rounded-lg text-sm" onClick={() => handleDeleteSubmission(assignment)} disabled={!user}><Trash2 className="mr-2 h-4 w-4" /> Delete</Button>
                        </div>)}
                    </>
                  )}
                </CardFooter>
              </Card>
            );})}
          </div>
        </ScrollArea>
      )}
      <footer className="flex-none py-2 text-center text-xs text-muted-foreground border-t bg-background">Submit assignments by providing a teacher rubric (if not provided) and your work. Get AI-powered feedback.</footer>
      <Dialog open={isFeedbackDialogOpen} onOpenChange={setIsFeedbackDialogOpen}><DialogContent className="sm:max-w-lg rounded-xl"><DialogHeader><ShadDialogTitle>Feedback for: {selectedAssignmentForFeedback?.title}</ShadDialogTitle><DialogDescription>Review your submission and the AI-generated feedback.</DialogDescription></DialogHeader>{selectedAssignmentForFeedback && <FeedbackDialogContent assignment={selectedAssignmentForFeedback} />  }</DialogContent></Dialog>
      <AlertDialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}><AlertDialogContent className="rounded-xl"><AlertDialogHeader><ShadAlertDialogTitle>Confirm Delete Submission</ShadAlertDialogTitle><AlertDialogDescription>Are you sure you want to delete your submission for "{assignmentToDelete?.title}"? This action cannot be undone, but you can submit again if the due date has not passed.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel onClick={() => {setIsDeleteConfirmOpen(false); setAssignmentToDelete(null);}} className="rounded-lg">Cancel</AlertDialogCancel><AlertDialogAction onClick={confirmDeleteSubmission} className={cn(buttonVariants({ variant: "destructive", className:"rounded-lg"}))}>Delete</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    </div>
  );
}
