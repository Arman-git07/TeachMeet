
'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ArrowLeft, ClipboardList, FileText, Loader2, UploadCloud } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { autoCheckAssignment, type AutoCheckAssignmentInput, type AutoCheckAssignmentOutput } from '@/ai/flows/auto-check-assignment-flow';
import { format, parseISO } from 'date-fns';

interface Assignment {
  id: string;
  title: string;
  dueDate: string;
  status: 'Pending' | 'Submitted' | 'Graded' | 'Overdue';
  description?: string;
}

const getMockAssignmentsForClass = (classId: string): Assignment[] => {
  return [
    { id: `assign1-${classId}`, title: "Introduction Essay", dueDate: "2024-08-10", status: "Graded", description: "A 500-word essay about your motivations for taking this course." },
    { id: `assign2-${classId}`, title: "Chapter 1 Problem Set", dueDate: "2024-08-17", status: "Pending", description: "Complete all odd-numbered problems from Chapter 1." },
    { id: `assign3-${classId}`, title: "Research Proposal", dueDate: "2024-08-24", status: "Pending", description: "Submit a one-page proposal for your mid-term project." },
    { id: `assign4-${classId}`, title: "Mid-Term Presentation Outline", dueDate: "2024-09-05", status: "Pending", description: "Submit a detailed outline for your mid-term presentation." },
    { id: `assign5-${classId}`, title: "Final Project - Phase 1", dueDate: "2024-09-20", status: "Pending", description: "Complete the first phase of your final project including literature review." },
    { id: `assign0-${classId}`, title: "Pre-course Survey", dueDate: "2024-07-30", status: "Overdue", description: "Complete this survey before the first class." },
  ];
};

const getStatusColor = (status: Assignment['status']) => {
  switch (status) {
    case 'Graded': return 'bg-green-500/20 text-green-700 border-green-500/50';
    case 'Submitted': return 'bg-blue-500/20 text-blue-700 border-blue-500/50';
    case 'Pending': return 'bg-yellow-500/20 text-yellow-700 border-yellow-500/50';
    case 'Overdue': return 'bg-red-500/20 text-red-700 border-red-500/50';
    default: return 'bg-muted text-muted-foreground border-border';
  }
};

export default function ClassAssignmentsPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const classId = params.classId as string;
  const className = searchParams.get('name') || "Class";

  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);

  const rubricFileRef = useRef<HTMLInputElement>(null);
  const studentSubmissionFileRef = useRef<HTMLInputElement>(null);

  const [currentAssignmentForRubricUpload, setCurrentAssignmentForRubricUpload] = useState<Assignment | null>(null);
  const [currentAssignmentForSubmission, setCurrentAssignmentForSubmission] = useState<Assignment | null>(null);
  const [uploadedRubricText, setUploadedRubricText] = useState<string | null>(null);

  useEffect(() => {
    if (classId) {
      setLoading(true);
      setTimeout(() => {
        const fetchedAssignments = getMockAssignmentsForClass(classId);
        setAssignments(fetchedAssignments);
        setLoading(false);
      }, 500);
    }
  }, [classId]);

  const handleInitiateSubmission = (assignment: Assignment) => {
    if (assignment.status === 'Graded' || assignment.status === 'Submitted') {
      toast({title: "Already Processed", description: `This assignment (${assignment.title}) is already ${assignment.status.toLowerCase()}.`});
      return;
    }
    setCurrentAssignmentForRubricUpload(assignment);
    toast({
      title: "Step 1: Select Rubric",
      description: `Please select the teacher's rubric/model answer file (.txt) for "${assignment.title}".`,
      duration: 10000,
    });
    rubricFileRef.current?.click();
  };

  const handleRubricFileSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (event.target) event.target.value = ""; // Reset file input

    if (!file) {
      toast({ variant: "info", title: "Rubric Selection Cancelled" });
      setCurrentAssignmentForRubricUpload(null);
      return;
    }
    if (file.type !== "text/plain") {
      toast({ variant: "destructive", title: "Invalid Rubric File Type", description: "Please upload a .txt file for the rubric." });
      setCurrentAssignmentForRubricUpload(null);
      return;
    }
    if (!currentAssignmentForRubricUpload) {
      toast({ variant: "destructive", title: "Internal Error", description: "Assignment context lost. Please try again." });
      return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
      const rubricText = e.target?.result as string;
      if (!rubricText?.trim()) {
        toast({ variant: "destructive", title: "Empty Rubric File", description: "The selected rubric file is empty." });
        setCurrentAssignmentForRubricUpload(null);
        return;
      }
      setUploadedRubricText(rubricText);
      setCurrentAssignmentForSubmission(currentAssignmentForRubricUpload);
      setCurrentAssignmentForRubricUpload(null);
      toast({
        title: "Step 2: Select Your Submission",
        description: `Rubric for "${currentAssignmentForRubricUpload.title}" loaded. Now, please select your assignment file (.txt).`,
        duration: 10000,
      });
      studentSubmissionFileRef.current?.click();
    };
    reader.onerror = () => {
      toast({ variant: "destructive", title: "Rubric File Read Error" });
      setCurrentAssignmentForRubricUpload(null);
    };
    reader.readAsText(file);
  };

  const handleStudentSubmissionFileSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (event.target) event.target.value = ""; // Reset file input

    if (!file) {
      toast({ variant: "info", title: "Submission File Selection Cancelled" });
      setCurrentAssignmentForSubmission(null);
      setUploadedRubricText(null);
      return;
    }
    if (file.type !== "text/plain") {
      toast({ variant: "destructive", title: "Invalid Submission File Type", description: "Please upload a .txt file for your assignment." });
      setCurrentAssignmentForSubmission(null);
      setUploadedRubricText(null);
      return;
    }
    if (!currentAssignmentForSubmission || !uploadedRubricText) {
      toast({ variant: "destructive", title: "Internal Error", description: "Missing rubric or assignment context. Please restart submission." });
      return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
      const studentAssignmentText = e.target?.result as string;
      if (!studentAssignmentText?.trim()) {
        toast({ variant: "destructive", title: "Empty Submission File", description: "Your assignment file is empty." });
        setCurrentAssignmentForSubmission(null);
        setUploadedRubricText(null);
        return;
      }

      const input: AutoCheckAssignmentInput = {
        studentAssignmentText: studentAssignmentText.substring(0, 15000), // Limiting student text
        teacherRubricText: uploadedRubricText.substring(0, 10000), // Limiting rubric text
        assignmentTitle: currentAssignmentForSubmission.title,
      };

      toast({ title: "Processing Submission...", description: "Checking with AI. This may take a moment." });

      try {
        const result = await autoCheckAssignment(input);
        let feedbackMessage = `AI Feedback for "${input.assignmentTitle}":\n${result.overallFeedback}\n`;
        if (result.similarityScore) feedbackMessage += `Similarity: ${result.similarityScore}%\n`;
        if (result.isPlagiarized !== undefined) feedbackMessage += `Plagiarism Check: ${result.isPlagiarized ? "Potential issues detected." : "Looks original."}\n`;
        result.specificPoints.forEach(p => {
          feedbackMessage += `\n- ${p.point}: ${p.assessment}`;
          if(p.studentExtract) feedbackMessage += ` (e.g., "${p.studentExtract}")`;
        });
        
        toast({
          title: "AI Feedback Received",
          description: <pre className="whitespace-pre-wrap text-xs max-h-60 overflow-y-auto">{feedbackMessage}</pre>,
          duration: 30000, // Increased duration for reading feedback
        });
        // Optionally update assignment status in UI
        setAssignments(prev => prev.map(a => a.id === currentAssignmentForSubmission!.id ? {...a, status: 'Submitted'} : a));

      } catch (error) {
        console.error("Error during AI check:", error);
        toast({ variant: "destructive", title: "AI Check Error", description: "Could not get AI feedback. " + (error instanceof Error ? error.message : "Please try again.") });
      } finally {
        setCurrentAssignmentForSubmission(null);
        setUploadedRubricText(null);
      }
    };
    reader.onerror = () => {
      toast({ variant: "destructive", title: "Submission File Read Error" });
      setCurrentAssignmentForSubmission(null);
      setUploadedRubricText(null);
    };
    reader.readAsText(file);
  };

  if (loading || authLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground">Loading assignments for {className}...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-8 h-full flex flex-col">
      <input type="file" ref={rubricFileRef} onChange={handleRubricFileSelected} accept=".txt" style={{ display: 'none' }} />
      <input type="file" ref={studentSubmissionFileRef} onChange={handleStudentSubmissionFileSelected} accept=".txt" style={{ display: 'none' }} />
      
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
           <ClipboardList className="h-8 w-8 text-primary" />
           <div>
            <h1 className="text-2xl font-bold text-foreground">Assignments for {className}</h1>
            <p className="text-sm text-muted-foreground">Class ID: {classId}</p>
           </div>
        </div>
        <Link href={`/dashboard/class/${classId}?name=${encodeURIComponent(className)}`} passHref legacyBehavior>
          <Button variant="outline" className="rounded-lg">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Class Details
          </Button>
        </Link>
      </div>

      {assignments.length === 0 ? (
        <Card className="flex-grow flex flex-col items-center justify-center text-center py-12 rounded-xl shadow-lg border-border/50">
          <FileText className="mx-auto h-16 w-16 text-muted-foreground mb-4" />
          <CardTitle className="text-xl">No Assignments Found</CardTitle>
          <CardDescription>There are no assignments posted for this class yet.</CardDescription>
        </Card>
      ) : (
        <ScrollArea className="flex-grow">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-4">
            {assignments.map((assignment) => (
              <Card key={assignment.id} className="flex flex-col rounded-xl shadow-lg border-border/50">
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <CardTitle className="text-lg" title={assignment.title}>{assignment.title}</CardTitle>
                    <Badge variant="outline" className={`text-xs ${getStatusColor(assignment.status)} rounded-md`}>
                      {assignment.status}
                    </Badge>
                  </div>
                  <CardDescription className="text-xs">Due: {format(parseISO(assignment.dueDate), "PP")}</CardDescription>
                </CardHeader>
                <CardContent className="flex-grow">
                  <p className="text-sm text-muted-foreground line-clamp-3">
                    {assignment.description || "No description provided."}
                  </p>
                </CardContent>
                <CardFooter>
                  <Button 
                    variant="default" 
                    className="w-full btn-gel rounded-lg text-sm" 
                    onClick={() => handleInitiateSubmission(assignment)}
                    disabled={assignment.status === 'Graded' || assignment.status === 'Submitted'}
                  >
                    <UploadCloud className="mr-2 h-4 w-4" />
                    {assignment.status === 'Graded' ? 'Graded' : assignment.status === 'Submitted' ? 'Submitted' : 'Submit Assignment'}
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        </ScrollArea>
      )}

      <footer className="flex-none py-2 text-center text-xs text-muted-foreground border-t bg-background">
        Submit assignments and get AI-powered feedback (requires teacher rubric upload).
      </footer>
    </div>
  );
}
