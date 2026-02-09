'use client';

import { useState, useEffect, useCallback } from 'react';
import { collection, query, onSnapshot, orderBy, addDoc, serverTimestamp, deleteDoc, doc, Timestamp, setDoc, updateDoc } from 'firebase/firestore';
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from '@/components/ui/dialog';
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
import { PlusCircle, Trash2, Loader2, FileDown, Eye, Clock, Edit3, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import type { Assignment, Submission } from '@/app/dashboard/classrooms/[classroomId]/page';

const assignmentSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters long."),
  dueDate: z.date({ required_error: "A due date is required." }),
  answerKey: z.any().optional(),
});

export function Assignments() {
    const { classroomId, user, userRole } = useClassroom();
    const { toast } = useToast();
    const [assignments, setAssignments] = useState<Assignment[]>([]);
    const [submissions, setSubmissions] = useState<Submission[]>([]);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [isProcessing, setIsProcessing] = useState<string | null>(null);
    const [currentTime, setCurrentTime] = useState(new Date());

    // Tracking which assignments are being modified by the student
    const [modifyingAssignments, setModifyingAssignments] = useState<Set<string>>(new Set());

    // Rescheduling state for teachers
    const [reschedulingAssignment, setReschedulingAssignment] = useState<Assignment | null>(null);
    const [rescheduleValue, setRescheduleValue] = useState("");

    const canUserManage = canManage(userRole);
    const assignmentForm = useForm<z.infer<typeof assignmentSchema>>({ resolver: zodResolver(assignmentSchema) });

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 10000);
        return () => clearInterval(timer);
    }, []);

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
                // @ts-ignore
                creatorName: user.displayName || 'Teacher',
                createdAt: serverTimestamp(), 
                updatedAt: serverTimestamp(),
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
            setModifyingAssignments(prev => {
                const next = new Set(prev);
                next.delete(assignmentId);
                return next;
            });
        } catch (error) {
            toast({ variant: 'destructive', title: "Submission Failed" });
        } finally {
            setIsProcessing(null);
        }
    }, [classroomId, user, toast]);

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

    const handleReschedule = async () => {
        if (!reschedulingAssignment || !rescheduleValue || !classroomId) return;
        
        setIsProcessing("rescheduling");
        const newDueDate = new Date(rescheduleValue);
        const assignmentRef = doc(db, 'classrooms', classroomId, 'assignments', reschedulingAssignment.id);

        try {
            await updateDoc(assignmentRef, { 
                dueDate: Timestamp.fromDate(newDueDate),
                updatedAt: serverTimestamp() 
            });
            toast({ title: "Assignment Rescheduled Successfully" });
            setReschedulingAssignment(null);
        } catch (error) {
            console.error("Reschedule failed:", error);
            toast({ variant: 'destructive', title: "Reschedule Failed", description: "You might not have permission to modify this assignment." });
        } finally {
            setIsProcessing(null);
        }
    };

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
                {assignments.length > 0 ? assignments.map(assignment => {
                    const userSub = submissions.find(s => s.assignmentId === assignment.id && s.studentId === user?.uid);
                    const canEdit = userRole === 'creator' || assignment.creatorId === user?.uid;
                    const isDeadlinePassed = new Date(assignment.dueDate.toDate()) < currentTime;
                    const isModifying = modifyingAssignments.has(assignment.id);
                    // @ts-ignore
                    const teacherName = assignment.creatorName || "Teacher";

                    return (
                        <Card key={assignment.id} className="p-4 shadow-md rounded-xl">
                            <div className="flex justify-between items-start">
                                <div>
                                    <h3 className="font-semibold">{assignment.title}</h3>
                                    <p className="text-xs text-muted-foreground">Due: {new Date(assignment.dueDate.toDate()).toLocaleString()}</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    {canUserManage ? (
                                        <>
                                            <Dialog>
                                                <DialogTrigger asChild><Button variant="outline" size="sm">Submissions</Button></DialogTrigger>
                                                <DialogContent className="max-w-md">
                                                    <DialogHeader>
                                                        <DialogTitle>Student Submissions</DialogTitle>
                                                        <DialogDescription>Select a student to review their work.</DialogDescription>
                                                    </DialogHeader>
                                                    <ScrollArea className="max-h-[60vh] py-4">
                                                        <div className="space-y-3 px-1">
                                                            {submissions.filter(s => s.assignmentId === assignment.id).length === 0 ? (
                                                                <p className="text-center py-8 text-sm text-muted-foreground">No submissions yet.</p>
                                                            ) : (
                                                                submissions.filter(s => s.assignmentId === assignment.id).map(sub => (
                                                                    <div key={sub.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border">
                                                                        <div className="flex flex-col">
                                                                            <p className="font-medium text-sm">{sub.studentName}</p>
                                                                            {sub.grade != null && <p className="text-[10px] text-primary font-bold">Graded: {sub.grade}/100</p>}
                                                                        </div>
                                                                        <Button asChild variant="outline" size="sm" className="h-8 rounded-lg">
                                                                            <Link href={`/dashboard/classrooms/${classroomId}/assignments/${assignment.id}/check/${sub.studentId}`}>
                                                                                <Eye className="mr-2 h-3.5 w-3.5"/>View
                                                                            </Link>
                                                                        </Button>
                                                                    </div>
                                                                ))
                                                            )}
                                                        </div>
                                                    </ScrollArea>
                                                </DialogContent>
                                            </Dialog>
                                            
                                            {canEdit && (
                                                <Button 
                                                    variant="ghost" 
                                                    size="icon" 
                                                    className="h-8 w-8 text-muted-foreground"
                                                    onClick={() => {
                                                        setReschedulingAssignment(assignment);
                                                        const d = assignment.dueDate?.toDate();
                                                        if (d) setRescheduleValue(format(d, "yyyy-MM-dd'T'HH:mm"));
                                                    }}
                                                    title="Reschedule Assignment"
                                                >
                                                    <Clock className="h-4 w-4" />
                                                </Button>
                                            )}

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
                                                {isDeadlinePassed ? (
                                                    <Badge variant="outline" className="border-primary/20 text-primary font-bold bg-primary/5">Already Submitted</Badge>
                                                ) : (
                                                    isModifying ? (
                                                        <form onSubmit={(e) => handleStudentSubmission(e, assignment.id)} className="flex gap-2">
                                                            <Input type="file" required className="h-9 text-xs" disabled={isProcessing === `submitting-${assignment.id}`}/>
                                                            <Button size="sm" type="submit" disabled={isProcessing === `submitting-${assignment.id}`}>
                                                                {isProcessing === `submitting-${assignment.id}` ? <Loader2 className="animate-spin h-4 w-4"/> : "Update"}
                                                            </Button>
                                                            <Button size="sm" variant="ghost" onClick={() => setModifyingAssignments(prev => { const n = new Set(prev); n.delete(assignment.id); return n; })}>Cancel</Button>
                                                        </form>
                                                    ) : (
                                                        <div className="flex items-center gap-2">
                                                            <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-none">Submitted</Badge>
                                                            <Button size="sm" variant="outline" onClick={() => setModifyingAssignments(prev => new Set(prev).add(assignment.id))}>
                                                                <Edit3 className="mr-1.5 h-3.5 w-3.5"/> Modify
                                                            </Button>
                                                        </div>
                                                    )
                                                )}
                                                {userSub.grade != null && (
                                                    <Dialog>
                                                        <DialogTrigger asChild><Button size="sm" variant="outline">View Result</Button></DialogTrigger>
                                                        <DialogContent>
                                                            <DialogHeader><DialogTitle>Result: {assignment.title}</DialogTitle></DialogHeader>
                                                            <div className="py-4 text-center space-y-4">
                                                                <div className="text-4xl font-bold text-primary">{userSub.grade}/100</div>
                                                                {userSub.feedback && <p className="text-sm bg-muted p-4 rounded-lg italic">"{userSub.feedback}"</p>}
                                                                <div className="grid grid-cols-1 gap-2">
                                                                    <Button asChild variant="outline" size="sm" className="w-full">
                                                                        <a href={userSub.submissionUrl} target="_blank" rel="noreferrer"><FileDown className="mr-2 h-4 w-4"/>Download My Original</a>
                                                                    </Button>
                                                                    {userSub.checkedUrl && (
                                                                        <Button asChild className="w-full btn-gel" size="sm">
                                                                            <a href={userSub.checkedUrl} target="_blank" rel="noreferrer">
                                                                                <Eye className="mr-2 h-4 w-4"/>View Checked Work
                                                                            </a>
                                                                        </Button>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </DialogContent>
                                                    </Dialog>
                                                )}
                                            </div>
                                        ) : (
                                            isDeadlinePassed ? (
                                                <div className="flex flex-col items-end gap-1">
                                                    <Badge variant="destructive" className="font-bold flex items-center gap-1.5">
                                                        <AlertCircle className="h-3 w-3" /> Time Over
                                                    </Badge>
                                                    <p className="text-[10px] text-muted-foreground font-medium">connect to @{teacherName}</p>
                                                </div>
                                            ) : (
                                                <form onSubmit={(e) => handleStudentSubmission(e, assignment.id)} className="flex gap-2">
                                                    <Input type="file" required className="h-9 text-xs" disabled={isProcessing === `submitting-${assignment.id}`}/>
                                                    <Button size="sm" type="submit" disabled={isProcessing === `submitting-${assignment.id}`}>
                                                        {isProcessing === `submitting-${assignment.id}` ? <Loader2 className="animate-spin h-4 w-4"/> : "Submit"}
                                                    </Button>
                                                </form>
                                            )
                                        )
                                    )}
                                </div>
                            </div>
                            {userSub?.feedback && !isModifying && <p className="text-sm text-muted-foreground mt-2 border-t pt-2"><b>Feedback:</b> {userSub.feedback}</p>}
                        </Card>
                    );
                }) : <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-xl"><p className="text-sm">No active assignments found.</p></div>}
            </CardContent>

            <Dialog open={!!reschedulingAssignment} onOpenChange={(open) => !open && setReschedulingAssignment(null)}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Reschedule Assignment</DialogTitle>
                        <DialogDescription>Update the due date for "{reschedulingAssignment?.title}".</DialogDescription>
                    </DialogHeader>
                    <div className="py-6 space-y-4">
                        <Label>New Due Date & Time</Label>
                        <Input 
                            type="datetime-local" 
                            value={rescheduleValue} 
                            onChange={(e) => setRescheduleValue(e.target.value)} 
                            disabled={isProcessing === "rescheduling"}
                        />
                    </div>
                    <DialogFooter className="gap-2">
                        <Button variant="outline" onClick={() => setReschedulingAssignment(null)} disabled={isProcessing === "rescheduling"}>Cancel</Button>
                        <Button onClick={handleReschedule} disabled={isProcessing === "rescheduling" || !rescheduleValue} className="btn-gel">
                            {isProcessing === "rescheduling" ? <Loader2 className="animate-spin mr-2 h-4 w-4"/> : "Update Due Date"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </Card>
    );
}
