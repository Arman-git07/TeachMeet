
'use client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, PlusCircle, ArrowLeft, CheckCircle, Clock, Sparkles, Loader2 } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Dialog, DialogContent, DialogTrigger, DialogHeader, DialogTitle as ShadDialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { autoCheckAssignment, type AutoCheckAssignmentOutput } from "@/ai/flows/auto-check-assignment-flow";

const mockTeacherId = "teacher-evelyn-reed-uid";

interface Assignment {
  id: string;
  title: string;
  dueDate: string;
  status: 'Upcoming' | 'Submitted' | 'Graded';
  score?: string;
  question: string;
  rubric?: string;
  submission?: string;
  feedback?: AutoCheckAssignmentOutput;
}

const initialAssignments: Assignment[] = [
    { id: 'hw1', title: 'Homework 1: Solving Linear Equations', dueDate: '2024-09-15', status: 'Graded', score: '95/100', question: "Solve for x in the equation: 3x - 7 = 14.", rubric: "Correctly isolate x and find its value. Show your work." },
    { id: 'hw2', title: 'Homework 2: Graphing Functions', dueDate: '2024-09-22', status: 'Submitted', question: "Graph the function y = 2x + 1 for x values from -2 to 2.", rubric: "The graph should be a straight line with the correct slope and y-intercept. All points must be accurate." },
    { id: 'project1', title: 'Project 1: Real-world Applications', dueDate: '2024-10-01', status: 'Upcoming', question: "Describe a real-world scenario that can be modeled by a linear equation. Provide the equation and explain how it works.", rubric: "Scenario must be plausible. Equation must accurately model the scenario. Explanation must be clear." },
];

function CreateAssignmentDialog({ onAssignmentCreated, open, onOpenChange }: { onAssignmentCreated: (newAssignment: Omit<Assignment, 'id' | 'status'>) => void; open: boolean; onOpenChange: (open: boolean) => void; }) {
    const [title, setTitle] = useState("");
    const [question, setQuestion] = useState("");
    const [rubric, setRubric] = useState("");
    const { toast } = useToast();

    const handleCreate = () => {
        if (!title.trim() || !question.trim()) {
            toast({ variant: "destructive", title: "Missing Information", description: "Title and Question are required." });
            return;
        }
        onAssignmentCreated({ title, question, rubric, dueDate: '2024-10-15' }); // Mock due date
        setTitle("");
        setQuestion("");
        setRubric("");
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-lg rounded-xl">
                <DialogHeader>
                    <ShadDialogTitle>Create New Assignment</ShadDialogTitle>
                    <DialogDescription>Define the assignment question and grading criteria for automated review.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div><Label htmlFor="new-title">Title</Label><Input id="new-title" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g., Chapter 3 Problems" /></div>
                    <div><Label htmlFor="new-question">Question</Label><Textarea id="new-question" value={question} onChange={e => setQuestion(e.target.value)} placeholder="What is the assignment prompt?" /></div>
                    <div><Label htmlFor="new-rubric">Grading Rubric (Optional)</Label><Textarea id="new-rubric" value={rubric} onChange={e => setRubric(e.target.value)} placeholder="Provide criteria for grading. e.g., 'Correct answer is worth 50 points...'" /></div>
                </div>
                <DialogFooter>
                    <DialogClose asChild><Button variant="outline" className="rounded-lg">Cancel</Button></DialogClose>
                    <Button onClick={handleCreate} className="btn-gel rounded-lg">Create Assignment</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function SubmitAssignmentDialog({ assignment, open, onOpenChange, onUpdateAssignment }: { assignment: Assignment | null; open: boolean; onOpenChange: (open: boolean) => void; onUpdateAssignment: (updatedAssignment: Assignment) => void; }) {
    const [submission, setSubmission] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [result, setResult] = useState<AutoCheckAssignmentOutput | null>(null);
    const { toast } = useToast();

    // Reset state when the dialog is closed or the assignment changes
    useState(() => {
      setSubmission(assignment?.submission || "");
      setResult(assignment?.feedback || null);
    });

    const handleSubmit = async () => {
        if (!submission.trim()) {
            toast({ variant: "destructive", title: "Submission is empty" });
            return;
        }
        setIsLoading(true);
        setResult(null);
        try {
            const aiResult = await autoCheckAssignment({
                assignmentQuestion: assignment!.question,
                studentSubmission: submission,
                gradingRubric: assignment!.rubric
            });
            setResult(aiResult);
            onUpdateAssignment({
              ...assignment!,
              status: 'Graded',
              submission,
              feedback: aiResult,
              score: `${aiResult.suggestedScore}/100`
            });
        } catch (error) {
            console.error("Auto-check failed:", error);
            toast({ variant: "destructive", title: "Grading Failed", description: "Could not automatically grade the assignment." });
        } finally {
            setIsLoading(false);
        }
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
                                <Label htmlFor="submission-text">Your Submission</Label>
                                <Textarea id="submission-text" value={submission} onChange={e => setSubmission(e.target.value)} rows={10} placeholder="Type your answer here..." />
                            </div>
                        )}

                        <DialogFooter>
                            <DialogClose asChild><Button variant="outline" className="rounded-lg">Close</Button></DialogClose>
                            {!result && !isLoading && <Button onClick={handleSubmit} className="btn-gel rounded-lg"><Sparkles className="mr-2 h-4 w-4" /> Submit for Auto-Grading</Button>}
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
    const isHost = currentUser?.uid === mockTeacherId;
    const { toast } = useToast();

    const [assignments, setAssignments] = useState<Assignment[]>(initialAssignments);
    const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null);
    const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

    const handleOpenSubmitDialog = (assignment: Assignment) => {
        setSelectedAssignment(assignment);
    };
    
    const handleCloseSubmitDialog = () => {
        setSelectedAssignment(null);
    };

    const handleCreateAssignment = (newAssignmentData: Omit<Assignment, 'id' | 'status'>) => {
        const newAssignment: Assignment = {
            id: `hw-${Date.now()}`,
            status: 'Upcoming',
            ...newAssignmentData,
        };
        setAssignments(prev => [newAssignment, ...prev]);
        toast({ title: "Assignment Created", description: `"${newAssignment.title}" is now available for students.` });
    };

    const handleUpdateAssignment = (updatedAssignment: Assignment) => {
        setAssignments(prev => prev.map(a => a.id === updatedAssignment.id ? updatedAssignment : a));
    };

    return (
        <>
            <CreateAssignmentDialog 
                open={isCreateDialogOpen} 
                onOpenChange={setIsCreateDialogOpen} 
                onAssignmentCreated={handleCreateAssignment} 
            />
             <SubmitAssignmentDialog 
                assignment={selectedAssignment}
                open={!!selectedAssignment}
                onOpenChange={(open) => !open && handleCloseSubmitDialog()}
                onUpdateAssignment={handleUpdateAssignment}
            />

            <div className="space-y-8">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-foreground">Assignments</h1>
                        <p className="text-muted-foreground">View and submit your homework and projects for this class.</p>
                    </div>
                    <Button asChild variant="outline" className="rounded-lg">
                        <Link href={`/dashboard/class/${classId}`}>
                            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Class
                        </Link>
                    </Button>
                </div>

                <Card className="rounded-xl shadow-lg border-border/50">
                    <CardHeader className="flex flex-row items-center justify-between">
                        <div>
                            <CardTitle>Assignment List</CardTitle>
                            <CardDescription>All homework and projects for this class are listed below.</CardDescription>
                        </div>
                        {isHost && (
                            <Button className="btn-gel rounded-lg" onClick={() => setIsCreateDialogOpen(true)}>
                                <PlusCircle className="mr-2 h-4 w-4" /> Create New Assignment
                            </Button>
                        )}
                    </CardHeader>
                    <CardContent>
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
                                        
                                        {!isHost && (
                                            <Button variant="outline" className="rounded-lg" size="sm" onClick={() => handleOpenSubmitDialog(assignment)}>
                                                {assignment.submission ? 'View Submission' : 'View & Submit'}
                                            </Button>
                                        )}
                                        {isHost && (
                                            <Button variant="outline" className="rounded-lg" size="sm">
                                                View Submissions
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </>
    );
}

