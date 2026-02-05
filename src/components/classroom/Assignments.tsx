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
import { PlusCircle, Trash2, Loader2, BrainCircuit, CheckCircle2 } from 'lucide-react';
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
    const [manualGrade, setManualGrade] = useState<{ [key: string]: number }>({});
    const [manualFeedback, setManualGradeFeedback] = useState<{ [key: string]: string }>({});
    const [isSavingManual, setIsSavingManual] = useState<string | null>(null);

    const canUserManage = canManage(userRole);
    const assignmentForm = useForm<z.infer<typeof assignmentSchema>>({ resolver: zodResolver(assignmentSchema) });

    useEffect(() => {
        if (!classroomId) return;
        const q = query(collection(db, 'classrooms', classroomId, 'assignments'), orderBy('dueDate', 'desc'));
        return onSnapshot(q, (snapshot) => {
            setAssignments(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Assignment)));
        });
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
        setIsSavingManual("creating");
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
                title: data.title, dueDate: Timestamp.fromDate(data.dueDate), answerKeyUrl, creatorId: user.uid, createdAt: serverTimestamp(), storagePath: storagePath || null,
            });
            toast({ title: "Assignment Created!" });
            setIsDialogOpen(false);
            assignmentForm.reset();
        } catch (error) {
            toast({ variant: 'destructive', title: "Creation Failed" });
        } finally {
            setIsSavingManual(null);
        }
    }, [canUserManage, user, classroomId, toast, assignmentForm]);

    const handleStudentSubmission = useCallback(async (e: React.FormEvent<HTMLFormElement>, assignmentId: string) => {
        e.preventDefault();
        if (!user) return;
        const fileInput = e.currentTarget.querySelector('input[type="file"]') as HTMLInputElement;
        const file = fileInput?.files?.[0];
        if (!file) return;
        try {
            const fileRef = storageRef(storage, `classrooms/${classroomId}/assignments/${assignmentId}/submissions/${user.uid}-${file.name}`);
            const url = await getDownloadURL(await uploadBytes(fileRef, file).then(s => s.ref));
            await setDoc(doc(db, "classrooms", classroomId, "assignments", assignmentId, "submissions", user.uid), {
                studentId: user.uid, studentName: user.displayName || 'Student', submittedAt: serverTimestamp(), submissionUrl: url, grade: null, feedback: null
            });
            toast({ title: "Submitted Successfully!" });
        } catch (error) {
            toast({ variant: 'destructive', title: "Submission Failed" });
        }
    }, [classroomId, user, toast]);

    const handleManualGradeSubmit = async (assignmentId: string, submission: Submission) => {
        const score = manualGrade[submission.id];
        const feedback = manualFeedback[submission.id];
        if (score === undefined) return;
        setIsSavingManual(submission.id);
        try {
            await updateDoc(doc(db, "classrooms", classroomId, "assignments", assignmentId, "submissions", submission.studentId), { grade: score, feedback: feedback || "" });
            toast({ title: "Grade Saved" });
        } catch (error) {
            toast({ variant: "destructive", title: "Failed to save grade" });
        } finally {
            setIsSavingManual(null);
        }
    };

    const handleDelete = useCallback(async (collectionName: string, item: any) => {
        if (!classroomId) return;
        try {
            if (item.storagePath) await deleteObject(storageRef(storage, item.storagePath)).catch(() => {});
            await deleteDoc(doc(db, "classrooms", classroomId, collectionName, item.id));
            toast({ title: "Deleted" });
        } catch (error) {
            toast({ variant: 'destructive', title: "Deletion Failed" });
        }
    }, [classroomId, toast]);

    const visibleAssignments = assignments.filter(a => canUserManage || new Date(a.dueDate.toDate()) > new Date());

    return (
        <Card className="border-0 shadow-none bg-transparent">
            <CardHeader className="flex flex-row items-center justify-between px-0">
                <div><CardTitle>Assignments</CardTitle><CardDescription>{canUserManage ? "Manage and grade assignments." : "Submit before the deadline."}</CardDescription></div>
                {canUserManage && (
                    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                        <DialogTrigger asChild><Button className="btn-gel"><PlusCircle className="mr-2 h-4 w-4"/>Create</Button></DialogTrigger>
                        <DialogContent>
                            <DialogHeader><DialogTitle>New Assignment</DialogTitle></DialogHeader>
                            <form onSubmit={assignmentForm.handleSubmit(onAssignmentSubmit)} className="space-y-4">
                                <div className="space-y-2"><Label>Title</Label><Input {...assignmentForm.register('title')} /></div>
                                <div className="space-y-2"><Label>Due Date</Label><Controller control={assignmentForm.control} name="dueDate" render={({ field }) => (<Input type="datetime-local" onChange={(e) => field.onChange(new Date(e.target.value))} value={field.value ? format(field.value, "yyyy-MM-dd'T'HH:mm") : ""} />)} /></div>
                                <div className="space-y-2"><Label>Answer Key (Optional)</Label><Input type="file" {...assignmentForm.register('answerKey')} /></div>
                                <DialogFooter><Button type="submit" disabled={isSavingManual === "creating"}>Post Assignment</Button></DialogFooter>
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
                                <div><h3 className="font-semibold">{assignment.title}</h3><p className="text-xs text-muted-foreground">Due: {new Date(assignment.dueDate.toDate()).toLocaleString()}</p></div>
                                <div className="flex items-center gap-2">
                                    {canUserManage ? (
                                        <Dialog>
                                            <DialogTrigger asChild><Button variant="outline" size="sm">Grading</Button></DialogTrigger>
                                            <DialogContent className="max-w-2xl"><DialogHeader><DialogTitle>Submissions</DialogTitle></DialogHeader>
                                                <ScrollArea className="max-h-[60vh] py-4 space-y-4">
                                                    {submissions.filter(s => s.assignmentId === assignment.id).map(sub => (
                                                        <Card key={sub.id} className="p-4 bg-muted/30">
                                                            <div className="flex justify-between items-center mb-2"><p className="font-semibold">{sub.studentName}</p><Badge>{sub.grade != null ? `${sub.grade}/100` : "Not Graded"}</Badge></div>
                                                            <div className="flex gap-2 mb-2"><a href={sub.submissionUrl} target="_blank" rel="noreferrer" className="text-xs text-accent hover:underline">View File</a></div>
                                                            <div className="grid grid-cols-2 gap-2">
                                                                <Input type="number" placeholder="Score" value={manualGrade[sub.id] ?? sub.grade ?? ""} onChange={(e) => setManualGrade(prev => ({...prev, [sub.id]: parseInt(e.target.value)}))} className="h-8" />
                                                                <Button size="sm" onClick={() => handleManualGradeSubmit(assignment.id, sub)} disabled={isSavingManual === sub.id}>Save</Button>
                                                            </div>
                                                            <Textarea placeholder="Feedback" value={manualFeedback[sub.id] ?? sub.feedback ?? ""} onChange={(e) => setManualGradeFeedback(prev => ({...prev, [sub.id]: e.target.value}))} className="mt-2 text-xs h-16" />
                                                        </Card>
                                                    ))}
                                                </ScrollArea>
                                            </DialogContent>
                                        </Dialog>
                                    ) : user && (userSub ? <Badge className="bg-green-100 text-green-700">Submitted: {userSub.grade ?? "Pending"}</Badge> : <form onSubmit={(e) => handleStudentSubmission(e, assignment.id)} className="flex gap-2"><Input type="file" required className="h-8 text-xs"/><Button size="sm" type="submit">Submit</Button></form>)}
                                    {canUserManage && <Button variant="ghost" size="icon" onClick={() => handleDelete('assignments', assignment)}><Trash2 className="h-4 w-4 text-destructive"/></Button>}
                                </div>
                            </div>
                        </Card>
                    );
                }) : <div className="text-center py-12 text-muted-foreground">No assignments.</div>}
            </CardContent>
        </Card>
    );
}
