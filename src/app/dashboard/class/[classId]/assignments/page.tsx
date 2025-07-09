
'use client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, PlusCircle, ArrowLeft, CheckCircle, Clock, Sparkles, Loader2, UploadCloud, Download, AlertTriangle } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState, useMemo, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Dialog, DialogContent, DialogTrigger, DialogHeader, DialogTitle as ShadDialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { autoCheckAssignment, type AutoCheckAssignmentOutput } from "@/ai/flows/auto-check-assignment-flow";
import { db } from "@/lib/firebase";
import { collection, doc, onSnapshot, addDoc, serverTimestamp, updateDoc, setDoc, query, orderBy, getDoc } from "firebase/firestore";
import { Skeleton } from "@/components/ui/skeleton";

interface Assignment {
  id: string;
  title: string;
  dueDate: string;
  question: string;
  rubric?: string;
  assignmentFile?: string;
  assignmentDataUri?: string;
  // Student-specific properties
  status: 'Upcoming' | 'Submitted' | 'Graded';
  score?: string;
  submission?: string;
  feedback?: AutoCheckAssignmentOutput;
}

function CreateAssignmentDialog({ classId, open, onOpenChange }: { classId: string; open: boolean; onOpenChange: (open: boolean) => void; }) {
    const [title, setTitle] = useState("");
    const [question, setQuestion] = useState("");
    const [rubric, setRubric] = useState("");
    const [dueDate, setDueDate] = useState("");
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const { toast } = useToast();
    const [isCreating, setIsCreating] = useState(false);

    useEffect(() => {
        if (!open) {
            setTitle("");
            setQuestion("");
            setRubric("");
            setDueDate("");
            setSelectedFile(null);
            setIsCreating(false);
        }
    }, [open]);

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.files && event.target.files.length > 0) {
            setSelectedFile(event.target.files[0]);
        } else {
            setSelectedFile(null);
        }
    };

    const handleCreate = async () => {
        if (!title.trim() || !question.trim() || !dueDate) {
            toast({ variant: "destructive", title: "Missing Information", description: "Title, Question, and Due Date are required." });
            return;
        }
        setIsCreating(true);
        let assignmentDataUri: string | undefined = undefined;
        try {
            if (selectedFile) {
                assignmentDataUri = await new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.readAsDataURL(selectedFile);
                    reader.onload = (event) => resolve(event.target?.result as string);
                    reader.onerror = (error) => reject(error);
                });
            }

            const assignmentsColRef = collection(db, "classes", classId, "assignments");
            await addDoc(assignmentsColRef, {
                title,
                question,
                rubric,
                dueDate,
                assignmentFile: selectedFile?.name,
                assignmentDataUri,
                createdAt: serverTimestamp(),
            });

            toast({ title: "Assignment Created", description: `"${title}" is now available for students.` });
            onOpenChange(false);
        } catch (error) {
            console.error("Assignment creation error:", error);
            const errorMessage = error instanceof Error ? error.message : "Could not create the assignment.";
            toast({ variant: "destructive", title: "Creation Error", description: errorMessage });
        } finally {
            setIsCreating(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-lg rounded-xl">
                <DialogHeader>
                    <ShadDialogTitle>Create New Assignment</ShadDialogTitle>
                    <DialogDescription>Define the assignment question and grading criteria for automated review.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div><Label htmlFor="new-title">Title</Label><Input id="new-title" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g., Chapter 3 Problems" disabled={isCreating} /></div>
                    <div><Label htmlFor="new-due-date">Due Date</Label><Input id="new-due-date" type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} disabled={isCreating} /></div>
                    <div><Label htmlFor="new-question">Question/Prompt</Label><Textarea id="new-question" value={question} onChange={e => setQuestion(e.target.value)} placeholder="What is the main assignment prompt? This will be used for AI grading." disabled={isCreating} /></div>
                    <div>
                        <Label htmlFor="assignment-file-upload">Assignment Paper (Optional)</Label>
                        <div className="mt-1 flex justify-center rounded-lg border border-dashed border-input px-6 py-10">
                            <div className="text-center">
                                <UploadCloud className="mx-auto h-12 w-12 text-muted-foreground" />
                                <div className="mt-4 flex text-sm leading-6 text-muted-foreground">
                                    <Label htmlFor="assignment-file-upload" className="relative cursor-pointer rounded-md bg-background font-semibold text-primary focus-within:outline-none focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 hover:text-primary/80">
                                        <span>{selectedFile ? 'Change file' : 'Upload a file'}</span>
                                        <Input id="assignment-file-upload" name="assignment-file-upload" type="file" className="sr-only" onChange={handleFileChange} disabled={isCreating} />
                                    </Label>
                                    {!selectedFile && <p className="pl-1">or drag and drop</p>}
                                </div>
                                {selectedFile ? <p className="text-sm mt-2 font-medium text-foreground">{selectedFile.name}</p> : <p className="text-xs leading-5">PDF, DOCX, etc. up to 10MB</p>}
                            </div>
                        </div>
                    </div>
                    <div><Label htmlFor="new-rubric">Grading Rubric (Optional)</Label><Textarea id="new-rubric" value={rubric} onChange={e => setRubric(e.target.value)} placeholder="Provide criteria for grading. e.g., 'Correct answer is worth 50 points...'" disabled={isCreating} /></div>
                </div>
                <DialogFooter>
                    <DialogClose asChild><Button variant="outline" className="rounded-lg" disabled={isCreating}>Cancel</Button></DialogClose>
                    <Button onClick={handleCreate} className="btn-gel rounded-lg" disabled={isCreating}>
                        {isCreating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        {isCreating ? 'Creating...' : 'Create Assignment'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function SubmitAssignmentDialog({ classId, assignment, open, onOpenChange, studentId }: { classId: string; assignment: Assignment | null; open: boolean; onOpenChange: (open: boolean) => void; studentId: string | undefined; }) {
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [result, setResult] = useState<AutoCheckAssignmentOutput | null>(null);
    const { toast } = useToast();

    useEffect(() => {
        setResult(assignment?.feedback || null);
        setSelectedFile(null);
    }, [assignment]);

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.files && event.target.files.length > 0) setSelectedFile(event.target.files[0]);
        else setSelectedFile(null);
    };

    const handleDownloadAssignment = () => {
        if (!assignment?.assignmentDataUri) {
            toast({ variant: 'destructive', title: 'Download Failed', description: 'No file is available for download for this assignment.' });
            return;
        }
        const link = document.createElement('a');
        link.href = assignment.assignmentDataUri;
        link.download = assignment.assignmentFile || 'assignment';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleSubmit = async () => {
        if (!selectedFile || !assignment || !studentId) {
            toast({ variant: "destructive", title: "Submission Error", description: "Missing file, assignment details, or user ID." });
            return;
        }
        setIsLoading(true);
        setResult(null);

        const reader = new FileReader();
        reader.readAsDataURL(selectedFile);

        reader.onload = async (event) => {
            const submissionDataUri = event.target?.result as string;
            if (!submissionDataUri) {
                toast({ variant: "destructive", title: "File Read Error", description: "Could not read the selected file." });
                setIsLoading(false);
                return;
            }

            try {
                const aiResult = await autoCheckAssignment({
                    assignmentQuestion: assignment.question,
                    submissionDataUri,
                    gradingRubric: assignment.rubric,
                    teacherAssignmentDataUri: assignment.assignmentDataUri,
                });
                setResult(aiResult);

                const submissionRef = doc(db, "classes", classId, "assignments", assignment.id, "submissions", studentId);
                await setDoc(submissionRef, {
                    studentId,
                    submittedAt: serverTimestamp(),
                    fileName: selectedFile.name,
                    feedback: aiResult,
                    score: aiResult.suggestedScore,
                }, { merge: true });

            } catch (error) {
                console.error("Auto-check failed:", error);
                const errorMessage = error instanceof Error ? error.message : "Could not automatically grade the assignment.";
                toast({ variant: "destructive", title: "Grading Failed", description: errorMessage });
            } finally {
                setIsLoading(false);
            }
        };

        reader.onerror = (error) => {
            console.error("FileReader error:", error);
            toast({ variant: "destructive", title: "File Read Error", description: "There was a problem reading your file." });
            setIsLoading(false);
        };
    };

    const scoreColorClass = useMemo(() => {
        if (!result) return 'text-foreground';
        if (result.suggestedScore >= 90) return 'text-green-600';
        if (result.suggestedScore >= 70) return 'text-yellow-600';
        return 'text-red-600';
    }, [result]);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-2xl rounded-xl">
                {assignment && (
                    <>
                        <DialogHeader>
                            <ShadDialogTitle>{assignment.title}</ShadDialogTitle>
                            <DialogDescription>{assignment.question}</DialogDescription>
                            {assignment.assignmentFile && (
                                <div className="pt-2">
                                    <Button variant="outline" size="sm" className="rounded-lg" onClick={handleDownloadAssignment}>
                                        <Download className="mr-2 h-4 w-4" /> Download Assignment: {assignment.assignmentFile}
                                    </Button>
                                </div>
                            )}
                            {assignment.rubric && <p className="text-xs text-muted-foreground pt-2 italic">Rubric: {assignment.rubric}</p>}
                        </DialogHeader>
                        
                        {result ? (
                             <div className="space-y-4 py-4">
                                <h3 className="text-lg font-semibold">Your Grade & Feedback</h3>
                                <Card className="bg-muted/50">
                                  <CardHeader><CardTitle className="text-center">Your Score</CardTitle></CardHeader>
                                  <CardContent><p className={`text-5xl font-bold text-center ${scoreColorClass}`}>{result.suggestedScore}<span className="text-2xl text-muted-foreground">/100</span></p></CardContent>
                                </Card>
                                <Card>
                                  <CardHeader><CardTitle className="text-base">AI Feedback</CardTitle></CardHeader>
                                  <CardContent><p className="text-sm">{result.feedback}</p></CardContent>
                                </Card>
                            </div>
                        ) : isLoading ? (
                            <div className="flex flex-col items-center justify-center gap-4 py-10">
                                <Loader2 className="h-12 w-12 animate-spin text-primary" />
                                <p className="text-muted-foreground">Grading your assignment...</p>
                            </div>
                        ) : (
                            <div className="space-y-4 py-4">
                                <Label>Your Submission</Label>
                                <div className="mt-1 flex justify-center rounded-lg border border-dashed border-primary/50 bg-primary/5 px-6 py-10">
                                    <div className="text-center">
                                        <UploadCloud className="mx-auto h-12 w-12 text-muted-foreground" />
                                        <div className="mt-4 flex text-sm leading-6 text-muted-foreground">
                                            <Label htmlFor="file-upload" className="relative cursor-pointer rounded-md bg-background font-semibold text-primary focus-within:outline-none focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 hover:text-primary/80">
                                                <span>{selectedFile ? 'Change file' : 'Upload a file'}</span>
                                                <Input id="file-upload" name="file-upload" type="file" className="sr-only" onChange={handleFileChange} accept=".pdf,.doc,.docx,.txt" />
                                            </Label>
                                            {!selectedFile && <p className="pl-1">or drag and drop</p>}
                                        </div>
                                        {selectedFile ? <p className="text-sm mt-2 font-medium text-foreground">{selectedFile.name}</p> : <p className="text-xs leading-5">PDF, DOC, DOCX, TXT up to 10MB</p>}
                                    </div>
                                </div>
                            </div>
                        )}

                        <DialogFooter>
                            <DialogClose asChild><Button variant="outline" className="rounded-lg">Close</Button></DialogClose>
                            {!result && !isLoading && <Button onClick={handleSubmit} className="btn-gel rounded-lg" disabled={!selectedFile}><Sparkles className="mr-2 h-4 w-4" /> Submit for Auto-Grading</Button>}
                        </DialogFooter>
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
}

export default function ClassAssignmentsPage() {
    const params = useParams();
    const classId = params.classId as string;
    const { user: currentUser } = useAuth();
    
    const [assignments, setAssignments] = useState<Assignment[]>([]);
    const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null);
    const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [isHost, setIsHost] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!classId) return;
        const classDocRef = doc(db, "classes", classId);
        const unsubscribeClass = onSnapshot(classDocRef, (docSnap) => {
            if (docSnap.exists()) {
                const classData = docSnap.data();
                setIsHost(classData.creatorId === currentUser?.uid);
            }
        });
        return () => unsubscribeClass();
    }, [classId, currentUser]);

    useEffect(() => {
        if (!classId || !currentUser?.uid) {
            setIsLoading(false);
            return;
        }
        setIsLoading(true);
        const assignmentsQuery = query(collection(db, "classes", classId, "assignments"), orderBy("createdAt", "desc"));

        const unsubscribeAssignments = onSnapshot(assignmentsQuery, async (querySnapshot) => {
            const assignmentsData: Omit<Assignment, 'status' | 'score' | 'submission' | 'feedback'>[] = [];
            querySnapshot.forEach((doc) => {
                assignmentsData.push({ id: doc.id, ...doc.data() } as any);
            });

            // For each assignment, fetch the current user's submission status
            const enrichedAssignments = await Promise.all(
                assignmentsData.map(async (assignment) => {
                    const submissionDocRef = doc(db, "classes", classId, "assignments", assignment.id, "submissions", currentUser.uid);
                    const submissionSnap = await getDoc(submissionDocRef);
                    
                    let studentProps: Pick<Assignment, 'status' | 'score' | 'submission' | 'feedback'> = { status: 'Upcoming' };
                    if (submissionSnap.exists()) {
                        const submissionData = submissionSnap.data();
                        studentProps = {
                            status: submissionData.score ? 'Graded' : 'Submitted',
                            score: submissionData.score ? `${submissionData.score}/100` : undefined,
                            submission: submissionData.fileName,
                            feedback: submissionData.feedback,
                        };
                    }
                    return { ...assignment, ...studentProps };
                })
            );
            
            setAssignments(enrichedAssignments as Assignment[]);
            setIsLoading(false);
            setError(null);
        }, (err) => {
            console.error("Error fetching assignments:", err);
            setError("Could not load assignments. Please try again later.");
            setIsLoading(false);
        });

        return () => unsubscribeAssignments();
    }, [classId, currentUser]);

    const handleOpenSubmitDialog = (assignment: Assignment) => setSelectedAssignment(assignment);
    const handleCloseSubmitDialog = () => setSelectedAssignment(null);

    return (
        <>
            {classId && <CreateAssignmentDialog classId={classId} open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen} />}
            {classId && (
                <SubmitAssignmentDialog 
                    classId={classId}
                    assignment={selectedAssignment}
                    open={!!selectedAssignment}
                    onOpenChange={(open) => !open && handleCloseSubmitDialog()}
                    studentId={currentUser?.uid}
                />
            )}

            <div className="space-y-8">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-foreground">Assignments</h1>
                        <p className="text-muted-foreground">View and submit your homework and projects for this class.</p>
                    </div>
                    <Button asChild variant="outline" className="rounded-lg">
                        <Link href={`/dashboard/class/${classId}`}><ArrowLeft className="mr-2 h-4 w-4" /> Back to Class</Link>
                    </Button>
                </div>

                <Card className="rounded-xl shadow-lg border-border/50">
                    <CardHeader className="flex flex-row items-center justify-between">
                        <div>
                            <CardTitle>Assignment List</CardTitle>
                            <CardDescription>All homework and projects for this class are listed below.</CardDescription>
                        </div>
                        {isHost && <Button className="btn-gel rounded-lg" onClick={() => setIsCreateDialogOpen(true)}><PlusCircle className="mr-2 h-4 w-4" /> Create New Assignment</Button>}
                    </CardHeader>
                    <CardContent>
                        {isLoading ? (
                            <div className="space-y-4">
                                <Skeleton className="h-16 w-full rounded-lg" />
                                <Skeleton className="h-16 w-full rounded-lg" />
                                <Skeleton className="h-16 w-full rounded-lg" />
                            </div>
                        ) : error ? (
                             <div className="text-center py-10 text-destructive bg-destructive/10 rounded-lg">
                                <AlertTriangle className="mx-auto h-12 w-12 mb-2" />
                                <p className="font-semibold">Error Loading Assignments</p>
                                <p className="text-sm">{error}</p>
                            </div>
                        ) : assignments.length === 0 ? (
                            <div className="text-center py-10 text-muted-foreground">
                                <FileText className="mx-auto h-12 w-12 mb-2" />
                                <p>No assignments have been created yet.</p>
                                {isHost && <p className="text-sm mt-1">Click "Create New Assignment" to get started.</p>}
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {assignments.map(assignment => (
                                    <div key={assignment.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50">
                                        <div className="flex items-center gap-4">
                                            <FileText className="h-6 w-6 text-primary" />
                                            <div>
                                                <p className="font-semibold">{assignment.title}</p>
                                                <p className="text-sm text-muted-foreground">Due: {assignment.dueDate}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            {assignment.status === 'Graded' && <Badge variant="default">{assignment.score}</Badge>}
                                            {assignment.status === 'Submitted' && <Badge variant="secondary"><CheckCircle className="h-3 w-3 mr-1" />{assignment.status}</Badge>}
                                            {assignment.status === 'Upcoming' && <Badge variant="outline"><Clock className="h-3 w-3 mr-1" />{assignment.status}</Badge>}
                                            
                                            {!isHost && <Button variant="outline" className="rounded-lg" size="sm" onClick={() => handleOpenSubmitDialog(assignment)}>{assignment.submission ? 'View Submission' : 'View & Submit'}</Button>}
                                            {isHost && <Button variant="outline" className="rounded-lg" size="sm">View Submissions</Button>}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </>
    );
}
