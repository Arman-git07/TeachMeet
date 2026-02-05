'use client';

import { useState, useEffect, useCallback, memo, useMemo } from 'react';
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
import { Button, buttonVariants } from '@/components/ui/button';
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
import { PlusCircle, Trash2, Loader2, BrainCircuit, CheckCircle2, UserCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Assignment, Submission, DeletableItem } from '@/app/dashboard/classrooms/[classroomId]/page';
import { gradeAssignment, GradeAssignmentInput } from '@/ai/flows/grade-assignment-flow';

const assignmentSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters long."),
  dueDate: z.date({ required_error: "A due date is required." }),
  answerKey: z.any().optional(), // Now optional
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
    const [manualGrade, setManualGrade] = useState<{ [key: string]: number }>({});
    const [manualFeedback, setManualGradeFeedback] = useState<{ [key: string]: string }>({});
    const [isSavingManual, setIsSavingManual] = useState<string | null>(null);

    const canUserManage = canManage(userRole);
    const assignmentForm = useForm<z.infer<typeof assignmentSchema>>({ resolver: zodResolver(assignmentSchema) });

    const assignmentIds = useMemo(() => assignments.map(a => a.id), [assignments]);

    useEffect(() => {
        if (!classroomId) return;
        const q = query(collection(db, 'classrooms', classroomId, 'assignments'), orderBy('dueDate', 'desc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setAssignments(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Assignment)));
        });
        return unsubscribe;
    }, [classroomId]);

    useEffect(() => {
        if (!classroomId || assignmentIds.length === 0) {
            setSubmissions([]);
            return;
        }
    
        const unsubscribers = assignmentIds.map(id => {
            const submissionsQuery = query(collection(db, 'classrooms', classroomId, 'assignments', id, 'submissions'));
            return onSnapshot(submissionsQuery, (snapshot) => {
                const newSubmissions = snapshot.docs.map(doc => ({ assignmentId: id, ...doc.data(), id: doc.id } as Submission));
                setSubmissions(prev => {
                    const otherSubmissions = prev.filter(s => s.assignmentId !== id);
                    return [...otherSubmissions, ...newSubmissions];
                });
            });
        });
    
        return () => unsubscribers.forEach(unsub => unsub());
    }, [classroomId, assignmentIds]);

    const onAssignmentSubmit = useCallback(async (data: z.infer<typeof assignmentSchema>) => {
        if (!canUserManage || !user) return;
        
        setIsSavingManual("creating-assignment");
        const answerKeyFile = data.answerKey?.[0];
        
        const toastHandle = toast({ title: "Creating Assignment...", description: "Please wait." });
        try {
            let answerKeyUrl = "";
            let storagePath = "";

            if (answerKeyFile) {
                const path = `classrooms/${classroomId}/assignments/keys/${Date.now()}-${answerKeyFile.name}`;
                const fileRef = storageRef(storage, path);
                const snapshot = await uploadBytes(fileRef, answerKeyFile);
                answerKeyUrl = await getDownloadURL(snapshot.ref);
                storagePath = path;
            }

            await addDoc(collection(db, 'classrooms', classroomId, 'assignments'), {
                title: data.title,
                dueDate: Timestamp.fromDate(data.dueDate),
                answerKeyUrl,
                creatorId: user.uid,
                uploaderId: user.uid,
                createdAt: serverTimestamp(),
                storagePath: storagePath || null,
            });

            toastHandle.update({ title: "Assignment Created!" });
            setIsDialogOpen(false);
            assignmentForm.reset();
        } catch (error: any) {
            console.error("Failed to create assignment:", error);
            toastHandle.update({ variant: 'destructive', title: "Creation Failed", description: error.message || "An unexpected error occurred." });
        } finally {
            setIsSavingManual(null);
        }
    }, [canUserManage, user, classroomId, toast, assignmentForm]);

    const handleStudentSubmission = useCallback(async (e: React.FormEvent<HTMLFormElement>, assignmentId: string) => {
        e.preventDefault();
        if (!user) return;
        const fileInput = e.currentTarget.querySelector('input[type="file"]') as HTMLInputElement;
        const submissionFile = fileInput?.files?.[0];
        if (!submissionFile) return;

        const toastHandle = toast({ title: "Submitting..." });
        try {
            const fileRef = storageRef(storage, `classrooms/${classroomId}/assignments/${assignmentId}/submissions/${user.uid}-${submissionFile.name}`);
            const submissionUrl = await getDownloadURL(await uploadBytes(fileRef, submissionFile).then(s => s.ref));
            await setDoc(doc(db, "classrooms", classroomId, "assignments", assignmentId, "submissions", user.uid), {
                studentId: user.uid, studentName: user.displayName || 'Student', submittedAt: serverTimestamp(), submissionUrl, grade: null, feedback: null
            });
            toastHandle.update({ title: "Submission Successful!" });
        } catch (error: any) {
            console.error("Failed to submit assignment:", error);
            toastHandle.update({ variant: 'destructive', title: "Submission Failed", description: error.message });
        }
    }, [classroomId, user, toast]);

    const handleGradeAssignmentAI = useCallback(async (assignment: Assignment, submission: Submission) => {
        if (!canUserManage || !assignment.answerKeyUrl) return;
        const submissionRef = doc(db, "classrooms", classroomId, "assignments", assignment.id, "submissions", submission.studentId);
        try {
            await updateDoc(submissionRef, { isGrading: true });
            const [answerKeyRes, submissionRes] = await Promise.all([fetch(assignment.answerKeyUrl), fetch(submission.submissionUrl)]);
            const [answerKeyBlob, submissionBlob] = await Promise.all([answerKeyRes.blob(), submissionRes.blob()]);
            const input: GradeAssignmentInput = { 
                teacherAssignmentDataUri: await fileToDataUri(new File([answerKeyBlob], "answerkey")), 
                studentSubmissionDataUri: await fileToDataUri(new File([submissionBlob], "submission")) 
            };
            const result = await gradeAssignment(input);
            await updateDoc(submissionRef, { grade: result.score, feedback: result.feedback, isGrading: false });
            toast({ title: "Grading Complete!", description: `Scored ${result.score}/100 for ${submission.studentName}.` });
        } catch (error) {
            await updateDoc(submissionRef, { isGrading: false });
            toast({ variant: "destructive", title: "Grading Failed" });
        }
    }, [canUserManage, classroomId, toast]);

    const handleManualGradeSubmit = async (assignmentId: string, submission: Submission) => {
        const score = manualGrade[submission.id];
        const feedback = manualFeedback[submission.id];
        if (score === undefined) return;

        setIsSavingManual(submission.id);
        try {
            const submissionRef = doc(db, "classrooms", classroomId, "assignments", assignmentId, "submissions", submission.studentId);
            await updateDoc(submissionRef, { grade: score, feedback: feedback || "", isGrading: false });
            toast({ title: "Grade Saved", description: `Grade for ${submission.studentName} updated.` });
        } catch (error) {
            toast({ variant: "destructive", title: "Failed to save grade" });
        } finally {
            setIsSavingManual(null);
        }
    };

    const handleDelete = useCallback(async (itemToDelete: DeletableItem | null) => {
        if (!itemToDelete || !classroomId) return;
        const { collectionName, item } = itemToDelete;
        try {
            if (item.storagePath) {
                await deleteObject(storageRef(storage, item.storagePath)).catch(err => { if (err.code !== 'storage/object-not-found') throw err; });
            }
            await deleteDoc(doc(db, "classrooms", classroomId, collectionName, item.id));
            toast({ title: "Assignment Deleted" });
        } catch (error: any) {
            toast({ variant: 'destructive', title: "Deletion Failed", description: error.message });
        }
    }, [classroomId, toast]);

    const visibleAssignments = assignments.filter(a => {
        if (canUserManage) return true;
        const now = new Date();
        const dueDate = new Date(a.dueDate.toDate());
        return dueDate > now;
    });

    return (
        <Card className="border-0 shadow-none bg-transparent">
            <CardHeader className="flex flex-row items-center justify-between px-0">
                <div>
                    <CardTitle>Assignments</CardTitle>
                    <CardDescription>
                        {canUserManage ? "Manage and grade assignments here." : "Submit your assignments before the deadline."}
                    </CardDescription>
                </div>
                {canUserManage && (
                    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                        <DialogTrigger asChild><Button className="btn-gel"><PlusCircle className="mr-2 h-4 w-4"/>Create Assignment</Button></DialogTrigger>
                        <DialogContent className="rounded-xl">
                            <DialogHeader><DialogTitle>Create New Assignment</DialogTitle></DialogHeader>
                            <form onSubmit={assignmentForm.handleSubmit(onAssignmentSubmit)} className="space-y-4 py-2">
                                <div className="space-y-2"><Label>Title</Label><Input placeholder="Assignment Title" {...assignmentForm.register('title')} />{assignmentForm.formState.errors.title && <p className="text-destructive text-xs">{assignmentForm.formState.errors.title.message}</p>}</div>
                                <div className="space-y-2"><Label>Due Date</Label><Controller control={assignmentForm.control} name="dueDate" render={({ field }) => (<Input type="datetime-local" className="rounded-lg" onChange={(e) => field.onChange(new Date(e.target.value))} value={field.value ? format(field.value, "yyyy-MM-dd'T'HH:mm") : ""} />)} />{assignmentForm.formState.errors.dueDate && <p className="text-destructive text-xs">{assignmentForm.formState.errors.dueDate.message}</p>}</div>
                                <div className="space-y-2"><Label className="flex items-center gap-2">Answer Key File <span className="text-[10px] text-muted-foreground uppercase bg-muted px-1.5 py-0.5 rounded">Optional</span></Label><Input type="file" className="rounded-lg" {...assignmentForm.register('answerKey')} /> <p className="text-[10px] text-muted-foreground mt-1">If uploaded, AI will automatically check student submissions.</p></div>
                                <DialogFooter><DialogClose asChild><Button type="button" variant="ghost">Cancel</Button></DialogClose><Button type="submit" disabled={isSavingManual === "creating-assignment"}>{isSavingManual === "creating-assignment" ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null}Post Assignment</Button></DialogFooter>
                            </form>
                        </DialogContent>
                    </Dialog>
                )}
            </CardHeader>
            <CardContent className="px-0">
                <div className="space-y-4">
                    {visibleAssignments.length > 0 ? visibleAssignments.map(assignment => {
                        const userSubmission = user ? submissions.find(s => s.assignmentId === assignment.id && s.studentId === user.uid) : undefined;
                        return (
                            <Card key={assignment.id} className="p-4 group shadow-md rounded-xl">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <h3 className="font-semibold text-lg">{assignment.title}</h3>
                                        <p className="text-xs text-muted-foreground">Due: {new Date(assignment.dueDate.toDate()).toLocaleString()}</p>
                                        {!assignment.answerKeyUrl && canUserManage && <Badge variant="outline" className="mt-2 text-[10px]">Manual Grading Required</Badge>}
                                        {assignment.answerKeyUrl && canUserManage && <Badge variant="secondary" className="mt-2 text-[10px]"><BrainCircuit className="h-3 w-3 mr-1"/> AI Grading Enabled</Badge>}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {canUserManage ? (
                                            <Dialog>
                                                <DialogTrigger asChild><Button variant="outline" size="sm">View Submissions</Button></DialogTrigger>
                                                <DialogContent className="max-w-2xl rounded-xl">
                                                    <DialogHeader><DialogTitle>Submissions: {assignment.title}</DialogTitle></DialogHeader>
                                                    <ScrollArea className="max-h-[60vh] -mx-6 px-6">
                                                        <div className="py-4 space-y-4">
                                                            {submissions.filter(s => s.assignmentId === assignment.id).length === 0 ? (
                                                                <p className="text-center text-muted-foreground text-sm py-8">No submissions yet.</p>
                                                            ) : (
                                                                submissions.filter(s => s.assignmentId === assignment.id).map(sub => (
                                                                    <Card key={sub.id} className="p-4 bg-muted/30">
                                                                        <div className="flex justify-between items-start mb-4">
                                                                            <div>
                                                                                <p className="font-semibold">{sub.studentName}</p>
                                                                                <a href={sub.submissionUrl} target="_blank" rel="noreferrer" className="text-xs text-accent hover:underline flex items-center gap-1 mt-1">View Submission File</a>
                                                                            </div>
                                                                            <div className="text-right">
                                                                                {sub.grade != null ? <Badge className="text-base h-8">{sub.grade}/100</Badge> : <Badge variant="outline">Not Graded</Badge>}
                                                                            </div>
                                                                        </div>
                                                                        <div className="space-y-3 pt-3 border-t">
                                                                            <div className="grid grid-cols-2 gap-3">
                                                                                <div className="space-y-1">
                                                                                    <Label className="text-[10px] uppercase font-bold text-muted-foreground">Score</Label>
                                                                                    <Input type="number" min="0" max="100" placeholder="0-100" value={manualGrade[sub.id] ?? sub.grade ?? ""} onChange={(e) => setManualGrade(prev => ({...prev, [sub.id]: parseInt(e.target.value)}))} className="h-8 text-sm" />
                                                                                </div>
                                                                                <div className="flex items-end gap-2">
                                                                                    {assignment.answerKeyUrl && sub.grade == null && (
                                                                                        <Button size="sm" variant="secondary" className="flex-1 h-8 text-xs" onClick={() => handleGradeAssignmentAI(assignment, sub)} disabled={sub.isGrading}>
                                                                                            {sub.isGrading ? <Loader2 className="h-3 w-3 animate-spin mr-1"/> : <BrainCircuit className="h-3 w-3 mr-1"/>} AI Grade
                                                                                        </Button>
                                                                                    )}
                                                                                    <Button size="sm" className="flex-1 h-8 text-xs btn-gel" onClick={() => handleManualGradeSubmit(assignment.id, sub)} disabled={isSavingManual === sub.id}>
                                                                                        {isSavingManual === sub.id ? <Loader2 className="h-3 w-3 animate-spin"/> : <CheckCircle2 className="h-3 w-3 mr-1"/>} Save
                                                                                    </Button>
                                                                                </div>
                                                                            </div>
                                                                            <div className="space-y-1">
                                                                                <Label className="text-[10px] uppercase font-bold text-muted-foreground">Feedback</Label>
                                                                                <Textarea placeholder="Constructive feedback..." value={manualFeedback[sub.id] ?? sub.feedback ?? ""} onChange={(e) => setManualGradeFeedback(prev => ({...prev, [sub.id]: e.target.value}))} className="text-xs min-h-[60px] resize-none" />
                                                                            </div>
                                                                        </div>
                                                                    </Card>
                                                                ))
                                                            )}
                                                        </div>
                                                    </ScrollArea>
                                                </DialogContent>
                                            </Dialog>
                                        ) : userRole === 'student' && user && (
                                            userSubmission ? (
                                                <div className="text-right">
                                                    <Badge className="bg-green-100 text-green-700 hover:bg-green-100 mb-1 border-green-200">Submitted</Badge>
                                                    {userSubmission.grade != null && <div className="font-bold text-xl text-primary">{userSubmission.grade}/100</div>}
                                                </div>
                                            ) : (
                                                <form onSubmit={(e) => handleStudentSubmission(e, assignment.id)} className="flex flex-col items-end gap-2">
                                                    <Input type="file" required className="text-xs h-auto w-40" />
                                                    <Button type="submit" size="sm" className="btn-gel w-full">Submit</Button>
                                                </form>
                                            )
                                        )}
                                        {canUserManage && (
                                            <AlertDialog>
                                                <AlertDialogTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive/70 opacity-0 group-hover:opacity-100"><Trash2 className="h-4 w-4" /></Button>
                                                </AlertDialogTrigger>
                                                <AlertDialogContent className="rounded-xl">
                                                    <AlertDialogHeader>
                                                        <AlertDialogTitle>Delete Assignment?</AlertDialogTitle>
                                                        <AlertDialogDescription>This will permanently delete "{assignment.title}" and all its submissions.</AlertDialogDescription>
                                                    </AlertDialogHeader>
                                                    <AlertDialogFooter>
                                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                        <AlertDialogAction onClick={() => handleDelete({ collectionName: 'assignments', item: assignment })} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
                                                    </AlertDialogFooter>
                                                </AlertDialogContent>
                                            </AlertDialog>
                                        )}
                                    </div>
                                </div>
                                {userSubmission?.feedback && (
                                    <div className="mt-4 p-3 bg-primary/5 border border-primary/10 rounded-lg">
                                        <p className="text-[10px] uppercase font-bold text-primary mb-1">Teacher Feedback</p>
                                        <p className="text-sm text-foreground/80 italic">"{userSubmission.feedback}"</p>
                                    </div>
                                )}
                            </Card>
                        );
                    }) : (
                        <div className="text-center py-12 bg-muted/20 rounded-xl border border-dashed">
                            <p className="text-muted-foreground">No active assignments found.</p>
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
