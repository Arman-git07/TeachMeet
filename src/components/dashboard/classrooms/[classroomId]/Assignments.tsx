
'use client';

import { useState, useEffect, useCallback, memo, useMemo } from 'react';
import { collection, query, onSnapshot, orderBy, addDoc, serverTimestamp, deleteDoc, doc, updateDoc, getDocs, setDoc, Timestamp } from 'firebase/firestore';
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { PlusCircle, Trash2, Loader2, BrainCircuit } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Assignment, Submission, DeletableItem } from '@/app/dashboard/classrooms/[classroomId]/page';
import { gradeAssignment, GradeAssignmentInput } from '@/ai/flows/grade-assignment-flow';

const assignmentSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters long."),
  dueDate: z.date({ required_error: "A due date is required." }),
  answerKey: z.any().refine(files => files?.length == 1, "Answer key file is required."),
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
        const answerKeyFile = data.answerKey?.[0];
        if (!answerKeyFile) return;

        const toastId = `assignment-upload-${Date.now()}`;
        toast({ id: toastId, title: "Creating Assignment...", description: "Please wait." });
        try {
            const path = `classrooms/${classroomId}/assignments/${Date.now()}-${answerKeyFile.name}`;
            const fileRef = storageRef(storage, path);
            const snapshot = await uploadBytes(fileRef, answerKeyFile);
            const answerKeyUrl = await getDownloadURL(snapshot.ref);

            await addDoc(collection(db, 'classrooms', classroomId, 'assignments'), {
                title: data.title,
                dueDate: Timestamp.fromDate(data.dueDate),
                answerKeyUrl,
                creatorId: user.uid,
                uploaderId: user.uid,
                createdAt: serverTimestamp(),
                storagePath: path,
            });

            toast.update(toastId, { title: "Assignment Created!" });
            setIsDialogOpen(false);
            assignmentForm.reset();
        } catch (error) {
            toast.update(toastId, { variant: 'destructive', title: "Creation Failed" });
        }
    }, [canUserManage, user, classroomId, toast, assignmentForm]);

    const handleStudentSubmission = useCallback(async (e: React.FormEvent<HTMLFormElement>, assignmentId: string) => {
        e.preventDefault();
        if (!user) return;
        const fileInput = e.currentTarget.querySelector('input[type="file"]') as HTMLInputElement;
        const submissionFile = fileInput?.files?.[0];
        if (!submissionFile) return;

        const submissionToastId = `submission-${Date.now()}`;
        toast({ id: submissionToastId, title: "Submitting..." });
        try {
            const fileRef = storageRef(storage, `classrooms/${classroomId}/assignments/${assignmentId}/submissions/${user.uid}-${submissionFile.name}`);
            const submissionUrl = await getDownloadURL(await uploadBytes(fileRef, submissionFile).then(s => s.ref));
            await setDoc(doc(db, "classrooms", classroomId, "assignments", assignmentId, "submissions", user.uid), {
                studentId: user.uid, studentName: user.displayName || 'Student', submittedAt: serverTimestamp(), submissionUrl, grade: null, feedback: null
            });
            toast.update(submissionToastId, { title: "Submission Successful!" });
        } catch (error) {
            toast.update(submissionToastId, { variant: 'destructive', title: "Submission Failed" });
        }
    }, [classroomId, user, toast]);

    const handleGradeAssignment = useCallback(async (assignment: Assignment, submission: Submission) => {
        if (!canUserManage) return;
        const submissionRef = doc(db, "classrooms", classroomId, "assignments", assignment.id, "submissions", submission.studentId);
        try {
            await updateDoc(submissionRef, { isGrading: true });
            const [answerKeyRes, submissionRes] = await Promise.all([fetch(assignment.answerKeyUrl), fetch(submission.submissionUrl)]);
            const [answerKeyBlob, submissionBlob] = await Promise.all([answerKeyRes.blob(), submissionRes.blob()]);
            const input: GradeAssignmentInput = { teacherAssignmentDataUri: await fileToDataUri(new File([answerKeyBlob], "answerkey")), studentSubmissionDataUri: await fileToDataUri(new File([submissionBlob], "submission")) };
            const result = await gradeAssignment(input);
            await updateDoc(submissionRef, { grade: result.score, feedback: result.feedback, isGrading: false });
            toast({ title: "Grading Complete!", description: `Scored ${result.score}/100 for ${submission.studentName}.` });
        } catch (error) {
            await updateDoc(submissionRef, { isGrading: false });
            toast({ variant: "destructive", title: "Grading Failed" });
        }
    }, [canUserManage, classroomId, toast]);

    const handleDelete = useCallback(async (itemToDelete: DeletableItem | null) => {
        if (!itemToDelete || !classroomId) return;
        const { collectionName, item } = itemToDelete;
        try {
            if (item.storagePath) {
                await deleteObject(storageRef(storage, item.storagePath)).catch(err => { if (err.code !== 'storage/object-not-found') throw err; });
            }
            await deleteDoc(doc(db, "classrooms", classroomId, collectionName, item.id));
            toast({ title: "Item Deleted" });
        } catch (error: any) {
            toast({ variant: 'destructive', title: "Deletion Failed", description: error.message });
        }
    }, [classroomId, toast]);

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle>Assignments</CardTitle>
                    <CardDescription>Manage and grade assignments here.</CardDescription>
                </div>
                {canUserManage && (
                    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                        <DialogTrigger asChild><Button><PlusCircle className="mr-2 h-4 w-4"/>Create Assignment</Button></DialogTrigger>
                        <DialogContent>
                            <DialogHeader><DialogTitle>Create New Assignment</DialogTitle></DialogHeader>
                            <form onSubmit={assignmentForm.handleSubmit(onAssignmentSubmit)} className="space-y-4 py-2">
                                <div><Label>Title</Label><Input {...assignmentForm.register('title')} />{assignmentForm.formState.errors.title && <p className="text-destructive text-sm">{assignmentForm.formState.errors.title.message}</p>}</div>
                                <div><Label>Due Date</Label><Controller control={assignmentForm.control} name="dueDate" render={({ field }) => (<Input type="datetime-local" onChange={(e) => field.onChange(new Date(e.target.value))} value={field.value ? format(field.value, "yyyy-MM-dd'T'HH:mm") : ""} />)} />{assignmentForm.formState.errors.dueDate && <p className="text-destructive text-sm">{assignmentForm.formState.errors.dueDate.message}</p>}</div>
                                <div><Label>Answer Key File</Label><Input type="file" {...assignmentForm.register('answerKey')} />{assignmentForm.formState.errors.answerKey && <p className="text-destructive text-sm">{assignmentForm.formState.errors.answerKey.message?.toString()}</p>}</div>
                                <DialogFooter><DialogClose asChild><Button type="button" variant="secondary">Cancel</Button></DialogClose><Button type="submit">Post</Button></DialogFooter>
                            </form>
                        </DialogContent>
                    </Dialog>
                )}
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    {assignments.length > 0 ? assignments.map(assignment => {
                        const userSubmission = user ? submissions.find(s => s.assignmentId === assignment.id && s.studentId === user.uid) : undefined;
                        return (
                            <Card key={assignment.id} className="p-4 group">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <h3 className="font-semibold">{assignment.title}</h3>
                                        <p className="text-sm text-muted-foreground">Due: {new Date(assignment.dueDate.toDate()).toLocaleString()}</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {canUserManage ? (
                                            <Dialog>
                                                <DialogTrigger asChild><Button>View Submissions</Button></DialogTrigger>
                                                <DialogContent className="max-w-2xl">
                                                    <DialogHeader><DialogTitle>Submissions for: {assignment.title}</DialogTitle></DialogHeader>
                                                    <ScrollArea className="max-h-[60vh] -mx-6 px-6">
                                                        <div className="py-4 space-y-2">
                                                            {submissions.filter(s => s.assignmentId === assignment.id).map(sub => (
                                                                <Card key={sub.id} className="p-3">
                                                                    <div className="flex justify-between items-center">
                                                                        <div><p className="font-medium">{sub.studentName}</p><a href={sub.submissionUrl} target="_blank" rel="noreferrer" className={cn(buttonVariants({ variant: "link" }), "p-0 h-auto text-xs")}>View Submission</a></div>
                                                                        <div>{sub.grade != null ? <Badge className="text-lg">{sub.grade}/100</Badge> : <Button size="sm" onClick={() => handleGradeAssignment(assignment, sub)} disabled={sub.isGrading}>{sub.isGrading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <BrainCircuit className="mr-2 h-4 w-4"/>} Grade</Button>}</div>
                                                                    </div>
                                                                    {sub.feedback && <p className="text-sm text-muted-foreground mt-2 border-t pt-2"><b>Feedback:</b> {sub.feedback}</p>}
                                                                </Card>
                                                            ))}
                                                        </div>
                                                    </ScrollArea>
                                                </DialogContent>
                                            </Dialog>
                                        ) : userRole === 'student' && user && (
                                            userSubmission ? (
                                                <div className="text-right">
                                                    <p className="text-sm font-semibold text-primary">Submitted</p>
                                                    {userSubmission.grade != null && <Badge className="text-lg mt-1">{userSubmission.grade}/100</Badge>}
                                                </div>
                                            ) : (
                                                <form onSubmit={(e) => handleStudentSubmission(e, assignment.id)}><Input type="file" required /><Button type="submit" size="sm" className="mt-2">Submit</Button></form>
                                            )
                                        )}
                                        {canUserManage && <AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 text-destructive/70 opacity-0 group-hover:opacity-100" onClick={() => handleDelete({ collectionName: 'assignments', item: assignment })}><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger>}
                                    </div>
                                </div>
                                {userSubmission?.feedback && <p className="text-sm text-muted-foreground mt-2 border-t pt-2"><b>Feedback:</b> {userSubmission.feedback}</p>}
                            </Card>
                        );
                    }) : <p className="text-muted-foreground text-center py-4">No assignments yet.</p>}
                </div>
            </CardContent>
        </Card>
    );
}
