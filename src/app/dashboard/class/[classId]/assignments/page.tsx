
'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle as ShadDialogTitle, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ArrowLeft, ClipboardList, ChevronsUpDown, FileText, Loader2, AlertTriangle } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { autoCheckAssignment, type AutoCheckAssignmentInput, type AutoCheckAssignmentOutput } from '@/ai/flows/auto-check-assignment-flow';
import { format, parseISO } from 'date-fns'; // For date display if needed

interface Assignment {
  id: string;
  title: string;
  dueDate: string;
  status: 'Pending' | 'Submitted' | 'Graded' | 'Overdue';
  description?: string;
}

// Mock data specifically for this page
const getMockAssignmentsForClass = (classId: string): Assignment[] => {
  // In a real app, fetch assignments for classId
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

  const assignmentFileRef = useRef<HTMLInputElement>(null);
  const [selectedAssignmentTitleForUpload, setSelectedAssignmentTitleForUpload] = useState<string | null>(null);
  const [selectedStudentKeywords, setSelectedStudentKeywords] = useState<string | undefined>(undefined);
  const [isAssignmentUploadDialogOpen, setIsAssignmentUploadDialogOpen] = useState(false);
  const [dialogAssignmentName, setDialogAssignmentName] = useState(''); // For the dialog input
  const [dialogAssignmentKeywords, setDialogAssignmentKeywords] = useState(''); // For the dialog input

  useEffect(() => {
    if (classId) {
      setLoading(true);
      // Simulate fetching assignments
      setTimeout(() => {
        const fetchedAssignments = getMockAssignmentsForClass(classId);
        setAssignments(fetchedAssignments);
        setLoading(false);
      }, 500);
    }
  }, [classId]);

  const handleTriggerAssignmentUploadDialog = (assignmentTitle: string) => {
    // Pre-fill dialog with the assignment name clicked, but allow user to change if they misclicked.
    setDialogAssignmentName(assignmentTitle);
    setDialogAssignmentKeywords(''); // Reset keywords
    setSelectedAssignmentTitleForUpload(assignmentTitle); // This is the actual assignment being submitted
    setIsAssignmentUploadDialogOpen(true);
  };

  const handleDialogSubmitAndChooseFile = () => {
    // The assignment name to check against should be `selectedAssignmentTitleForUpload`
    // which was set when the "Submit Assignment" button for a specific assignment was clicked.
    // `dialogAssignmentName` is just what's in the input field, could be different if user typed.
    // For this mock, we assume the user confirmed the assignment by clicking its button.
    if (!selectedAssignmentTitleForUpload) {
        toast({ variant: "destructive", title: "Internal Error", description: "No assignment selected for submission. Please try again." });
        return;
    }
    // `dialogAssignmentKeywords` is fine to use as it's explicitly entered for this submission.
    setSelectedStudentKeywords(dialogAssignmentKeywords.trim() || undefined);
    assignmentFileRef.current?.click();
  };

  const handleFileSelectedForAssignment = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (event.target) {
        event.target.value = ""; // Reset file input
    }

    if (!file) {
        toast({ variant: "info", title: "File Selection Cancelled" });
        setSelectedAssignmentTitleForUpload(null); // Clear the specific assignment title
        setSelectedStudentKeywords(undefined);
        setIsAssignmentUploadDialogOpen(false);
        return;
    }

    if (file.type !== "text/plain") {
        toast({ variant: "destructive", title: "Invalid File Type", description: "Please upload a .txt file." });
        // Keep dialog open if file type is wrong? Or close? For now, we just don't proceed.
        // Clearing selectedAssignmentTitleForUpload might be too aggressive here if they want to try again.
        return;
    }
    
    if (!selectedAssignmentTitleForUpload) {
        toast({ variant: "destructive", title: "Internal Error", description: "Assignment title missing. Please try again." });
        setIsAssignmentUploadDialogOpen(false);
        return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
        const studentAssignmentText = e.target?.result as string;
        if (!studentAssignmentText?.trim()) {
            toast({ variant: "destructive", title: "Empty File", description: "The selected file is empty." });
            setIsAssignmentUploadDialogOpen(false);
            return;
        }
        
        const mockTeacherRubric = `Rubric for "${selectedAssignmentTitleForUpload}": Check for clarity, examples, and understanding. Student keywords: ${selectedStudentKeywords || 'none'}.`;

        const input: AutoCheckAssignmentInput = {
            studentAssignmentText: studentAssignmentText.substring(0, 5000),
            teacherRubricText: mockTeacherRubric,
            assignmentTitle: selectedAssignmentTitleForUpload,
            assignmentKeywords: selectedStudentKeywords,
        };

        toast({ title: "Processing Submission...", description: "Checking with AI (mock)." });
        setIsAssignmentUploadDialogOpen(false);

        try {
            const result = await autoCheckAssignment(input);
            let feedbackMessage = `Feedback for "${input.assignmentTitle}":\n${result.overallFeedback}\n`;
            if (result.similarityScore) feedbackMessage += `Similarity: ${result.similarityScore}%\n`;
            if (result.isPlagiarized) feedbackMessage += `Plagiarism Check: Potential issues.\n`;
            result.specificPoints.forEach(p => {
                feedbackMessage += `\n- ${p.point}: ${p.assessment}`;
                if(p.studentExtract) feedbackMessage += ` (e.g., "${p.studentExtract}")`;
            });
            
            toast({
                title: "AI Feedback (Mock)",
                description: <pre className="whitespace-pre-wrap text-xs max-h-60 overflow-y-auto">{feedbackMessage}</pre>,
                duration: 20000,
            });
        } catch (error) {
            console.error("Error during AI check:", error);
            toast({ variant: "destructive", title: "AI Check Error", description: "Could not get AI feedback." });
        } finally {
            setSelectedAssignmentTitleForUpload(null);
            setSelectedStudentKeywords(undefined);
        }
    };
    reader.onerror = () => {
        toast({ variant: "destructive", title: "File Read Error" });
        setIsAssignmentUploadDialogOpen(false);
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
      <input type="file" ref={assignmentFileRef} onChange={handleFileSelectedForAssignment} accept=".txt" style={{ display: 'none' }} />
      
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
                    onClick={() => handleTriggerAssignmentUploadDialog(assignment.title)}
                    disabled={assignment.status === 'Graded' || assignment.status === 'Submitted'}
                  >
                    <ChevronsUpDown className="mr-2 h-4 w-4" />
                    {assignment.status === 'Graded' ? 'Graded' : assignment.status === 'Submitted' ? 'Submitted' : 'Submit Assignment'}
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        </ScrollArea>
      )}

      <Dialog open={isAssignmentUploadDialogOpen} onOpenChange={setIsAssignmentUploadDialogOpen}>
        <DialogContent className="sm:max-w-md rounded-xl">
          <DialogHeader>
            <ShadDialogTitle>Submit: {selectedAssignmentTitleForUpload || "Assignment"}</ShadDialogTitle>
            <DialogDescription>
              Upload your .txt file. You can add optional keywords related to your submission.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {/* The input for assignment name is pre-filled but can be illustrative,
                the actual assignment title is `selectedAssignmentTitleForUpload` */}
            <div className="grid gap-2">
                <Label htmlFor="dialogCurrentAssignmentName">Submitting for Assignment</Label>
                <Input
                    id="dialogCurrentAssignmentName"
                    value={selectedAssignmentTitleForUpload || dialogAssignmentName} // Show the confirmed title
                    readOnly // Make it read-only to avoid confusion, submission target is fixed
                    className="rounded-lg bg-muted/50"
                />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="dialogAssignmentKeywords">Your Submission Keywords (optional)</Label>
              <Input
                id="dialogAssignmentKeywords"
                value={dialogAssignmentKeywords}
                onChange={(e) => setDialogAssignmentKeywords(e.target.value)}
                placeholder="e.g., essay, chapter 1, research"
                className="rounded-lg"
              />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" className="rounded-lg" onClick={() => setSelectedAssignmentTitleForUpload(null)}>
                Cancel
              </Button>
            </DialogClose>
            <Button type="button" onClick={handleDialogSubmitAndChooseFile} className="btn-gel rounded-lg">
              <UploadCloud className="mr-2 h-4 w-4" /> Choose File &amp; Submit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <footer className="flex-none py-2 text-center text-xs text-muted-foreground border-t bg-background">
        View and submit your assignments for {className}.
      </footer>
    </div>
  );
}
