
'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlusCircle, FileText, ArrowLeft, Loader2, AlertTriangle, CheckCircle, Send, Sparkles, BookOpen } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState, use } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { AutoCheckAssignmentInput, autoCheckAssignment, AutoCheckAssignmentOutput } from '@/ai/flows/auto-check-assignment-flow';
import { Badge } from "@/components/ui/badge";

interface Assignment {
  id: string;
  title: string;
  dueDate: string;
  submissions: number;
}

interface StudentSubmission {
  id: string;
  studentName: string;
  submissionDate: string;
  content: string; // The text of the student's assignment
}

// Mock data
const mockAssignments: Assignment[] = [
  { id: "as1", title: "Essay on Photosynthesis", dueDate: "2024-09-15", submissions: 1 },
  { id: "as2", title: "Algebra Worksheet 1", dueDate: "2024-09-10", submissions: 0 },
];

const mockSubmissions: { [assignmentId: string]: StudentSubmission[] } = {
  "as1": [
    {
      id: "sub1",
      studentName: "Jane Doe",
      submissionDate: "2024-09-14",
      content: "Photosynthesis is the process by which green plants and some other organisms use sunlight to synthesize foods with the help of chlorophyll pigment. During photosynthesis in green plants, light energy is captured and used to convert water, carbon dioxide, and minerals into oxygen and energy-rich organic compounds. It is a vital process for life on Earth as it is the primary source of oxygen in the atmosphere. The main product is glucose, which provides energy for the plant. Water is absorbed through the roots and transported to the leaves. Carbon dioxide enters through the stomata on the leaves.",
    },
  ],
};


export default function ClassAssignmentsPage({ params: paramsPromise }: { params: Promise<{ classId: string }> }) {
    const { classId } = use(paramsPromise);
    const router = useRouter();
    const { toast } = useToast();
    
    const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null);
    const [selectedSubmission, setSelectedSubmission] = useState<StudentSubmission | null>(null);
    const [teacherRubric, setTeacherRubric] = useState<string>("The model answer should mention: 1. Definition of photosynthesis. 2. Inputs (sunlight, water, CO2). 3. Outputs (oxygen, glucose). 4. Role of chlorophyll. 5. Importance for life on Earth.");
    const [aiFeedback, setAiFeedback] = useState<AutoCheckAssignmentOutput | null>(null);
    const [isChecking, setIsChecking] = useState(false);
    
    const handleCheckAssignment = async () => {
        if (!selectedSubmission || !teacherRubric.trim() || !selectedAssignment) {
            toast({
                variant: 'destructive',
                title: 'Missing Information',
                description: 'Please ensure a submission is selected and a rubric is provided.',
            });
            return;
        }

        setIsChecking(true);
        setAiFeedback(null);
        
        try {
            const input: AutoCheckAssignmentInput = {
                studentAssignmentText: selectedSubmission.content,
                teacherRubricText: teacherRubric,
                assignmentTitle: selectedAssignment.title,
            };
            
            const result = await autoCheckAssignment(input);
            setAiFeedback(result);
            toast({
                title: 'Check Complete',
                description: 'AI feedback has been generated successfully.',
            });
            
        } catch (error: any) {
            console.error("AI Assignment Check Error:", error);
            toast({
                variant: 'destructive',
                title: 'AI Check Failed',
                description: error.message || "An error occurred while checking the assignment.",
                duration: 7000,
            });
        } finally {
            setIsChecking(false);
        }
    };
    
    if (selectedAssignment) {
        return (
            <div className="flex flex-col h-full">
                <header className="flex-none p-3 border-b bg-background shadow-sm">
                    <div className="container mx-auto flex items-center justify-between">
                         <div className="flex items-center gap-3">
                            <BookOpen className="h-7 w-7 text-primary" />
                            <h1 className="text-xl font-semibold text-foreground truncate" title={selectedAssignment.title}>
                                {selectedAssignment.title}
                            </h1>
                         </div>
                        <Button variant="outline" className="rounded-lg" onClick={() => { setSelectedAssignment(null); setSelectedSubmission(null); setAiFeedback(null); }}>
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back to All Assignments
                        </Button>
                    </div>
                </header>
                
                <main className="flex-grow grid md:grid-cols-3 gap-4 p-4 overflow-hidden">
                    {/* Submissions List */}
                    <Card className="md:col-span-1 flex flex-col rounded-xl">
                        <CardHeader>
                            <CardTitle>Submissions ({mockSubmissions[selectedAssignment.id]?.length || 0})</CardTitle>
                        </CardHeader>
                        <CardContent className="flex-grow space-y-2 overflow-y-auto">
                           {(mockSubmissions[selectedAssignment.id] || []).map(sub => (
                             <Button 
                               key={sub.id} 
                               variant={selectedSubmission?.id === sub.id ? 'default' : 'outline'}
                                className="w-full justify-start rounded-lg"
                                onClick={() => { setSelectedSubmission(sub); setAiFeedback(null); }}
                             >
                               {sub.studentName}
                             </Button>
                           ))}
                           {!(mockSubmissions[selectedAssignment.id]?.length) && <p className="text-muted-foreground text-sm">No submissions yet.</p>}
                        </CardContent>
                    </Card>

                    {/* Grading Area */}
                    <Card className="md:col-span-2 flex flex-col rounded-xl">
                       <CardHeader>
                            <CardTitle>AI-Assisted Grading</CardTitle>
                            <CardDescription>
                                {selectedSubmission ? `Evaluating: ${selectedSubmission.studentName}` : "Select a submission to begin."}
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="flex-grow space-y-4 overflow-y-auto">
                            {selectedSubmission ? (
                                <>
                                    <div>
                                        <label htmlFor="rubric" className="block text-sm font-medium text-muted-foreground mb-1">Teacher's Rubric / Model Answer</label>
                                        <Textarea id="rubric" value={teacherRubric} onChange={(e) => setTeacherRubric(e.target.value)} className="min-h-[100px] rounded-lg" />
                                    </div>
                                    <div className="p-4 border rounded-lg bg-muted/50">
                                        <h3 className="font-semibold mb-2">Student's Submission:</h3>
                                        <p className="text-sm text-foreground whitespace-pre-wrap">{selectedSubmission.content}</p>
                                    </div>
                                    
                                    {isChecking && (
                                        <div className="flex items-center justify-center p-6 text-primary">
                                            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                            <span>Checking assignment...</span>
                                        </div>
                                    )}

                                    {aiFeedback && (
                                        <div className="p-4 border-l-4 border-primary bg-primary/10 rounded-lg space-y-4">
                                            <h3 className="text-lg font-bold flex items-center"><Sparkles className="mr-2 h-5 w-5 text-primary"/> AI Feedback</h3>
                                            
                                            {aiFeedback.similarityScore && (
                                               <Badge>Similarity Score: {aiFeedback.similarityScore}%</Badge>
                                            )}
                                            
                                            <div className="prose prose-sm dark:prose-invert max-w-none">
                                                <p><strong>Overall:</strong> {aiFeedback.overallFeedback}</p>
                                                
                                                <strong>Specific Points:</strong>
                                                <ul>
                                                    {aiFeedback.specificPoints.map((point, index) => (
                                                        <li key={index}>
                                                            <strong>{point.point}:</strong> {point.assessment}
                                                            {point.studentExtract && <blockquote className="text-xs italic border-l-2 pl-2 my-1">"{point.studentExtract}"</blockquote>}
                                                        </li>
                                                    ))}
                                                </ul>

                                                {aiFeedback.isPlagiarized !== undefined && (
                                                   <p className={`mt-2 font-semibold ${aiFeedback.isPlagiarized ? 'text-destructive' : 'text-green-600'}`}>
                                                      {aiFeedback.isPlagiarized ? <AlertTriangle className="inline h-4 w-4 mr-1"/> : <CheckCircle className="inline h-4 w-4 mr-1"/>}
                                                      {ai_feedback_is_plagiarized ? "Potential plagiarism detected." : "No obvious plagiarism detected."}
                                                   </p>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                </>
                            ) : (
                                <div className="text-center text-muted-foreground py-10">
                                    <p>Select a student submission from the left panel to review and grade.</p>
                                </div>
                            )}
                        </CardContent>
                        <CardFooter>
                           <Button onClick={handleCheckAssignment} disabled={!selectedSubmission || !teacherRubric.trim() || isChecking} className="w-full btn-gel rounded-lg">
                             <Send className="mr-2 h-4 w-4" />
                             {isChecking ? "Checking..." : "Check with AI"}
                           </Button>
                        </CardFooter>
                    </Card>
                </main>
            </div>
        );
    }
    
    // Main assignments list view
    return (
        <div className="space-y-8">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <div className="flex items-center gap-2">
                         <Link href="/dashboard/classes" className="text-primary hover:underline text-sm">Classes</Link>
                         <span className="text-sm text-muted-foreground">/</span>
                         <span className="text-sm text-muted-foreground">Class {classId}</span>
                    </div>
                    <h1 className="text-3xl font-bold tracking-tight text-foreground">Assignments</h1>
                    <p className="text-muted-foreground">Manage assignments for this class.</p>
                </div>
                <Button className="btn-gel rounded-lg">
                    <PlusCircle className="mr-2 h-5 w-5" /> Create New Assignment
                </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {mockAssignments.map(assignment => (
                    <Card key={assignment.id} className="flex flex-col rounded-xl shadow-lg hover:shadow-xl transition-shadow duration-300 border-border/50">
                        <CardHeader>
                            <CardTitle className="text-xl truncate" title={assignment.title}>{assignment.title}</CardTitle>
                            <CardDescription>Due: {assignment.dueDate}</CardDescription>
                        </CardHeader>
                        <CardContent className="flex-grow">
                             <div className="flex items-center text-muted-foreground text-sm">
                                <FileText className="mr-2 h-4 w-4" />
                                {assignment.submissions} Submission(s)
                            </div>
                        </CardContent>
                        <CardFooter>
                           <Button onClick={() => setSelectedAssignment(assignment)} className="w-full btn-gel rounded-lg">
                                Grade Submissions
                            </Button>
                        </CardFooter>
                    </Card>
                ))}
            </div>
        </div>
    );
}
