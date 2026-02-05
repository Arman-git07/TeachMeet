'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { collection, query, onSnapshot, orderBy, addDoc, serverTimestamp, deleteDoc, doc, updateDoc, setDoc, Timestamp } from 'firebase/firestore';
import { db, storage } from '@/lib/firebase';
import { ref as storageRef, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { useClassroom } from '@/contexts/ClassroomContext';
import { canManage } from '@/lib/roles';
import { useToast } from '@/hooks/use-toast';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { PlusCircle, Trash2, Loader2, BrainCircuit, FileDown, Eye } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Assignment, Submission, DeletableItem } from '@/app/dashboard/classrooms/[classroomId]/page';
import { gradeAssignment, GradeAssignmentInput } from '@/ai/flows/grade-assignment-flow';

const assignmentSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters long."),
  dueDate: z.date({ required_error: "A due date is required." }),
  answerKey: z.any().optional(),
});

const fileToDataUri = (file: File): Promise<string> => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
});

export function Assignments() {
    const { classroomId, user, userRole } = useClassroom();
    const { toast } = useToast();
    const [assignments, setAssignments] = useState<Assignment[]>([]);
    const [submissions, setSubmissions] = useState<Submission[]>([]);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [isProcessing, setIsProcessing] = useState<string | null>(null);

    const canUserManage = canManage(userRole);
    const assignmentForm = useForm<z.infer<typeof assignmentSchema>>({ resolver: zodResolver(assignmentSchema) });

    useEffect(() => {
        if (!classroomId) return;
        const q = query(collection(db, 'classrooms', classroomId, 'assignments'), orderBy('dueDate', 'desc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setAssignments(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Assignment)));
        });
        return unsubscribe;
    }, [classroomId]);

    useEffect(() => {
        if (!classroomId || assignments.length === 0) return;
        const unsubscribers = assignments.map(a => 
            onSnapshot(query(collection(db, 'classrooms', classroomId, 'assignments', a.id, 'submissions')), (snapshot) => {
                const newSubmissions = snapshot.docs.map(doc => ({ assignmentId: a.id, ...doc.data(), id: doc.id } as Submission));
                setSubmissions(prev => [...prev.filter(s => s.assignmentId !== a.id), ...newSubmissions]);
            })
        );
        return () => unsubscribers.forEach(unsub => unsub());
    }, [classroomId, assignments]);

    const onAssignmentSubmit = useCallback(async (data: z.infer<typeof assignmentSchema>) => {
        if (!canUserManage || !user) return;
        setIsProcessing("creating");
        try {
            let answerKeyUrl = "";
            let storagePath = "";
            if (data.answerKey?.[0]) {
                const file = data.answerKey[0];
                const path = `classrooms/${classroomId}/assignments/keys/${Date.now()}-${file.name}`;
                const fileRef = storageRef(storage, path);
                const snapshot = await uploadBytes(fileRef, file);
                answerKeyUrl = await getDownloadURL(snapshot.ref);
                storagePath = path;
            }
            await addDoc(collection(db, 'classrooms', classroomId, 'assignments'), {
                title: data.title, 
                dueDate: Timestamp.fromDate(data.dueDate), 
                answerKeyUrl, 
                creatorId: user.uid, 
                createdAt: serverTimestamp(), 
                storagePath: storagePath || null,
            });
            toast({ title: "Assignment Created!" });
            setIsDialogOpen(false);
            assignmentForm.reset();
        } catch (error) {
            toast({ variant: 'destructive', title: "Creation Failed" });
        } finally {
            setIsProcessing(null);
        }
    }, [canUserManage, user, classroomId, toast, assignmentForm]);

    const handleStudentSubmission = useCallback(async (e: React.FormEvent<HTMLFormElement>, assignmentId: string) => {
        e.preventDefault();
        if (!user) return;
        const fileInput = e.currentTarget.querySelector('input[type="file"]') as HTMLInputElement;
        const file = fileInput?.files?.[0];
        if (!file) return;
        
        setIsProcessing(`submitting-${assignmentId}`);
        try {
            const fileRef = storageRef(storage, `classrooms/${classroomId}/assignments/${assignmentId}/submissions/${user.uid}-${file.name}`);
            const url = await getDownloadURL(await uploadBytes(fileRef, file).then(s => s.ref));
            await setDoc(doc(db, "classrooms", classroomId, "assignments", assignmentId, "submissions", user.uid), {
                studentId: user.uid, 
                studentName: user.displayName || 'Student', 
                submittedAt: serverTimestamp(), 
                submissionUrl: url, 
                grade: null, 
                feedback: null,
                assignmentId: assignmentId
            });
            toast({ title: "Submitted Successfully!" });
        } catch (error) {
            toast({ variant: 'destructive', title: "Submission Failed" });
        } finally {
            setIsProcessing(null);
        }
    }, [classroomId, user, toast]);

    const handleAiGrade = async (assignment: Assignment, submission: Submission) => {
        if (!canUserManage || !assignment.answerKeyUrl) return;
        setIsProcessing(submission.id);
        
        try {
            const [answerKeyRes, submissionRes] = await Promise.all([
                fetch(assignment.answerKeyUrl),
                fetch(submission.submissionUrl)
            ]);
            
            const [answerKeyBlob, submissionBlob] = await Promise.all([
                answerKeyRes.blob(),
                submissionRes.blob()
            ]);

            const input: GradeAssignmentInput = {
                teacherAssignmentDataUri: await fileToDataUri(new File([answerKeyBlob], "answerkey")),
                studentSubmissionDataUri: await fileToDataUri(new File([submissionBlob], "submission"))
            };

            const result = await gradeAssignment(input);
            
            await updateDoc(doc(db, "classrooms", classroomId, "assignments", assignment.id, "submissions", submission.studentId), {
                grade: result.score,
                feedback: result.feedback
            });
            
            toast({ title: "Grading Complete", description: `Scored ${result.score}/100` });
        } catch (error) {
            console.error("AI Grading failed:", error);
            toast({ variant: "destructive", title: "AI Grading Failed" });
        } finally {
            setIsProcessing(null);
        }
    };

    const handleManualGrade = async (assignmentId: string, submission: Submission, score: number, feedback: string) => {
        setIsProcessing(submission.id);
        try {
            await updateDoc(doc(db, "classrooms", classroomId, "assignments", assignmentId, "submissions", submission.studentId), {
                grade: score,
                feedback: feedback
            });
            toast({ title: "Grade Saved" });
        } catch (error) {
            toast({ variant: "destructive", title: "Failed to save grade" });
        } finally {
            setIsProcessing(null);
        }
    };

    const handleDelete = useCallback(async (item: Assignment) => {
        if (!classroomId) return;
        try {
            if (item.storagePath) await deleteObject(storageRef(storage, item.storagePath)).catch(() => {});
            await deleteDoc(doc(db, "classrooms", classroomId, 'assignments', item.id));
            toast({ title: "Assignment Deleted" });
        } catch (error) {
            toast({ variant: 'destructive', title: "Deletion Failed" });
        }
    }, [classroomId, toast]);

    const visibleAssignments = assignments.filter(a => canUserManage || new Date(a.dueDate.toDate()) > new Date());

    return (
        <Card className="border-0 shadow-none bg-transparent">
            <CardHeader className="flex flex-row items-center justify-between px-0">
                <div>
                    <CardTitle>Assignments</CardTitle>
                    <CardDescription>{canUserManage ? "Manage and grade assignments." : "Submit before the deadline."}</CardDescription>
                </div>
                {canUserManage && (
                    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                        <DialogTrigger asChild><Button className="btn-gel"><PlusCircle className="mr-2 h-4 w-4"/>Create</Button></DialogTrigger>
                        <DialogContent>
                            <DialogHeader><DialogTitle>New Assignment</DialogTitle></DialogHeader>
                            <form onSubmit={assignmentForm.handleSubmit(onAssignmentSubmit)} className="space-y-4">
                                <div className="space-y-2"><Label>Title</Label><Input {...assignmentForm.register('title')} placeholder="e.g., Algebra Quiz" /></div>
                                <div className="space-y-2">
                                    <Label>Due Date</Label>
                                    <Controller control={assignmentForm.control} name="dueDate" render={({ field }) => (
                                        <Input type="datetime-local" onChange={(e) => field.onChange(new Date(e.target.value))} value={field.value ? format(field.value, "yyyy-MM-dd'T'HH:mm") : ""} />
                                    )} />
                                </div>
                                <div className="space-y-2"><Label>Answer Key (Optional)</Label><Input type="file" {...assignmentForm.register('answerKey')} /></div>
                                <DialogFooter><Button type="submit" disabled={isProcessing === "creating"}>
                                    {isProcessing === "creating" ? <Loader2 className="animate-spin mr-2 h-4 w-4"/> : null}
                                    Post Assignment
                                </Button></DialogFooter>
                            </form>
                        </DialogContent>
                    </Dialog>
                )}
            </CardHeader>
            <CardContent className="px-0 space-y-4">
                {visibleAssignments.length > 0 ? visibleAssignments.map(assignment => {
                    const userSub = submissions.find(s => s.assignmentId === assignment.id && s.studentId === user?.uid);
                    return (
                        <Card key={assignment.id} className="p-4 shadow-md rounded-xl">
                            <div className="flex justify-between items-start">
                                <div>
                                    <h3 className="font-semibold">{assignment.title}</h3>
                                    <p className="text-xs text-muted-foreground">Due: {new Date(assignment.dueDate.toDate()).toLocaleString()}</p>
                                    {assignment.answerKeyUrl && <Badge variant="secondary" className="mt-2 text-[10px]">AI-Grading Available</Badge>}
                                </div>
                                <div className="flex items-center gap-2">
                                    {canUserManage ? (
                                        <>
                                            <Dialog>
                                                <DialogTrigger asChild><Button variant="outline" size="sm">Grading</Button></DialogTrigger>
                                                <DialogContent className="max-w-2xl">
                                                    <DialogHeader><DialogTitle>Submissions</DialogTitle></DialogHeader>
                                                    <ScrollArea className="max-h-[60vh] py-4">
                                                        <div className="space-y-4 px-1">
                                                            {submissions.filter(s => s.assignmentId === assignment.id).length === 0 ? (
                                                                <div className="space-y-4">
                                                                    <p className="text-center py-4 text-xs text-muted-foreground italic">No actual submissions yet. Below is a preview of how a submission looks:</p>
                                                                    <Card className="p-4 bg-primary/5 border-dashed border-primary/20">
                                                                        <div className="flex justify-between items-center mb-3">
                                                                            <div>
                                                                                <p className="font-semibold">Demo Student (Example)</p>
                                                                                <p className="text-[10px] text-muted-foreground">Submitted: Just now</p>
                                                                            </div>
                                                                            <Badge variant="outline" className="text-primary border-primary/30">Demo</Badge>
                                                                        </div>
                                                                        <div className="flex gap-2 mb-4">
                                                                            <Button variant="outline" size="sm" className="h-8 opacity-50 cursor-not-allowed">
                                                                                <Eye className="mr-2 h-3 w-3"/>View
                                                                            </Button>
                                                                            {assignment.answerKeyUrl && (
                                                                                <Button size="sm" className="h-8 bg-primary/40 cursor-not-allowed">
                                                                                    <BrainCircuit className="h-3 w-3 mr-2"/>
                                                                                    AI Check
                                                                                </Button>
                                                                            )}
                                                                        </div>
                                                                        <div className="space-y-2 border-t pt-3 opacity-50">
                                                                            <div className="flex gap-2">
                                                                                <Input placeholder="Score" className="h-8 text-xs" disabled />
                                                                                <Button size="sm" className="h-8 px-4" disabled>Save</Button>
                                                                            </div>
                                                                            <Textarea placeholder="Feedback..." className="text-xs h-16 resize-none" disabled />
                                                                        </div>
                                                                    </Card>
                                                                </div>
                                                            ) : (
                                                                submissions.filter(s => s.assignmentId === assignment.id).map(sub => (
                                                                    <Card key={sub.id} className="p-4 bg-muted/30">
                                                                        <div className="flex justify-between items-center mb-3">
                                                                            <p className="font-semibold">{sub.studentName}</p>
                                                                            <Badge>{sub.grade != null ? `${sub.grade}/100` : "Pending"}</Badge>
                                                                        </div>
                                                                        <div className="flex gap-2 mb-4">
                                                                            <Button asChild variant="outline" size="sm" className="h-8">
                                                                                <a href={sub.submissionUrl} target="_blank" rel="noreferrer"><Eye className="mr-2 h-3 w-3"/>View</a>
                                                                            </Button>
                                                                            {assignment.answerKeyUrl && (
                                                                                <Button size="sm" className="h-8" onClick={() => handleAiGrade(assignment, sub)} disabled={isProcessing === sub.id}>
                                                                                    {isProcessing === sub.id ? <Loader2 className="animate-spin h-3 w-3 mr-2"/> : <BrainCircuit className="h-3 w-3 mr-2"/>}
                                                                                    AI Check
                                                                                </Button>
                                                                            )}
                                                                        </div>
                                                                        <ManualGradeForm 
                                                                            initialScore={sub.grade} 
                                                                            initialFeedback={sub.feedback} 
                                                                            onSave={(score, feedback) => handleManualGrade(assignment.id, sub, score, feedback)}
                                                                            isSaving={isProcessing === sub.id}
                                                                        />
                                                                    </Card>
                                                                ))
                                                            )}
                                                        </div>
                                                    </ScrollArea>
                                                </DialogContent>
                                            </Dialog>
                                            <AlertDialog>
                                                <AlertDialogTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive/70"><Trash2 className="h-4 w-4" /></Button>
                                                </AlertDialogTrigger>
                                                <AlertDialogContent>
                                                    <AlertDialogHeader>
                                                        <AlertDialogTitle>Delete Assignment?</AlertDialogTitle>
                                                        <AlertDialogDescription>Are you sure? This will remove all student submissions as well.</AlertDialogDescription>
                                                    </AlertDialogHeader>
                                                    <AlertDialogFooter>
                                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                        <AlertDialogAction onClick={() => handleDelete(assignment)} className="bg-destructive text-destructive-foreground">Delete</AlertDialogAction>
                                                    </AlertDialogFooter>
                                                </AlertDialogContent>
                                            </AlertDialog>
                                        </>
                                    ) : user && (
                                        userSub ? (
                                            <div className="flex flex-col items-end gap-2">
                                                <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-none">Submitted</Badge>
                                                {userSub.grade != null && (
                                                    <Dialog>
                                                        <DialogTrigger asChild><Button size="sm" variant="outline">View Grade</Button></DialogTrigger>
                                                        <DialogContent>
                                                            <DialogHeader><DialogTitle>Result: {assignment.title}</DialogTitle></DialogHeader>
                                                            <div className="py-4 text-center space-y-4">
                                                                <div className="text-4xl font-bold text-primary">{userSub.grade}/100</div>
                                                                {userSub.feedback && <p className="text-sm bg-muted p-4 rounded-lg italic">"{userSub.feedback}"</p>}
                                                                <Button asChild variant="link" className="text-xs">
                                                                    <a href={userSub.submissionUrl} target="_blank" rel="noreferrer"><FileDown className="mr-2 h-4 w-4"/>Download My Submission</a>
                                                                </Button>
                                                            </div>
                                                        </DialogContent>
                                                    </Dialog>
                                                )}
                                            </div>
                                        ) : (
                                            <form onSubmit={(e) => handleStudentSubmission(e, assignment.id)} className="flex gap-2">
                                                <Input type="file" required className="h-9 text-xs" disabled={isProcessing === `submitting-${assignment.id}`}/>
                                                <Button size="sm" type="submit" disabled={isProcessing === `submitting-${assignment.id}`}>
                                                    {isProcessing === `submitting-${assignment.id}` ? <Loader2 className="animate-spin h-4 w-4"/> : "Submit"}
                                                </Button>
                                            </form>
                                        )
                                    )}
                                </div>
                            </div>
                        </Card>
                    );
                }) : <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-xl"><p className="text-sm">No active assignments found.</p></div>}
            </CardContent>
        </Card>
    );
}

function ManualGradeForm({ initialScore, initialFeedback, onSave, isSaving }: { initialScore?: number | null, initialFeedback?: string | null, onSave: (score: number, feedback: string) => void, isSaving: boolean }) {
    const [score, setScore] = useState(initialScore?.toString() || "");
    const [feedback, setFeedback] = useState(initialFeedback || "");

    return (
        <div className="space-y-2 border-t pt-3">
            <div className="flex gap-2">
                <Input 
                    type="number" 
                    placeholder="Score (0-100)" 
                    value={score} 
                    onChange={(e) => setScore(e.target.value)} 
                    className="h-8 text-xs"
                />
                <Button 
                    size="sm" 
                    className="h-8 px-4" 
                    onClick={() => onSave(parseInt(score), feedback)} 
                    disabled={isSaving || !score}
                >
                    {isSaving ? <Loader2 className="animate-spin h-3 w-3"/> : "Save"}
                </Button>
            </div>
            <Textarea 
                placeholder="Feedback..." 
                value={feedback} 
                onChange={(e) => setFeedback(e.target.value)} 
                className="text-xs h-16 resize-none"
            />
        </div>
    );
}
