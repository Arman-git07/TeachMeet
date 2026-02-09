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
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { PlusCircle, Trash2, Loader2, FileDown, Eye, Clock, Edit3, AlertCircle, Sparkles, CheckCircle, Upload } from 'lucide-react';
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

    const handleStudentSubmission = useCallback(async (file: File, assignmentId: string) => {
        if (!user || !classroomId) return;
        
        setIsProcessing(`submitting-${assignmentId}`);
        const isUpdate = submissions.some(s => s.assignmentId === assignmentId && s.studentId === user.uid);
        const toastId = `sub-${Date.now()}`;
        toast({ id: toastId, title: isUpdate ? "Updating Submission..." : "Submitting Work..." });

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
            toast.update(toastId, { title: isUpdate ? "Submission Updated!" : "Submitted Successfully!" });
        } catch (error) {
            toast.update(toastId, { variant: 'destructive', title: "Action Failed" });
        } finally {
            setIsProcessing(null);
        }
    }, [classroomId, user, submissions, toast]);

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
                {/* Demo Checked Assignment */}
                <Card className="p-4 shadow-md rounded-xl border-primary/20 bg-primary/5 animate-in fade-in slide-in-from-top-4 duration-500">
                    <div className="flex justify-between items-start">
                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className="font-semibold text-primary">Demo: History Essay</h3>
                                <Badge variant="secondary" className="text-[10px] h-4 uppercase font-bold tracking-widest bg-primary/10 text-primary border-none">Sample</Badge>
                            </div>
                            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                                <Clock className="h-3 w-3" /> Due: 1/1/2024, 12:00 PM (Ended)
                            </p>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                            <Badge className="bg-primary/20 text-primary hover:bg-primary/20 border-none px-3 font-bold">Checked & Graded</Badge>
                            <Dialog>
                                <DialogTrigger asChild><Button size="sm" variant="outline" className="rounded-lg h-8 shadow-sm">View Result</Button></DialogTrigger>
                                <DialogContent className="sm:max-w-md">
                                    <DialogHeader>
                                        <DialogTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary"/> Assignment Result</DialogTitle>
                                        <DialogDescription>Sample view of a graded assignment.</DialogDescription>
                                    </DialogHeader>
                                    <div className="py-6 text-center space-y-6">
                                        <div className="flex flex-col items-center">
                                            <p className="text-sm text-muted-foreground uppercase font-black tracking-widest mb-1">Final Score</p>
                                            <div className="text-6xl font-black text-primary drop-shadow-sm">92<span className="text-2xl text-muted-foreground font-normal">/100</span></div>
                                        </div>
                                        
                                        <div className="p-4 bg-muted/50 rounded-xl border italic text-sm text-foreground/80 leading-relaxed shadow-inner">
                                            "Great analysis of the French Revolution! Your points on the social causes were very well-argued. I've highlighted some areas where you could improve your citations in the checked version."
                                        </div>

                                        <div className="grid grid-cols-1 gap-3">
                                            <Button asChild variant="outline" className="w-full rounded-xl h-12">
                                                <a href="https://picsum.photos/seed/checked/800/1200" target="_blank" rel="noreferrer">
                                                    <FileDown className="mr-2 h-5 w-5"/> Download Graded Paper
                                                </a>
                                            </Button>
                                            <Button asChild className="w-full btn-gel rounded-xl h-12 text-lg">
                                                <Link href={`/dashboard/classrooms/${classroomId}/assignments/demo-assignment/result/demo-student`}>
                                                    <Eye className="mr-2 h-5 w-5"/> View Checked Work
                                                </Link>
                                            </Button>
                                        </div>
                                    </div>
                                    <DialogFooter>
                                        <DialogClose asChild><Button variant="ghost" className="w-full">Close Preview</Button></DialogClose>
                                    </DialogFooter>
                                </DialogContent>
                            </Dialog>
                        </div>
                    </div>
                    <p className="text-sm text-muted-foreground mt-3 border-t pt-3 flex items-start gap-2">
                        <span className="font-bold text-foreground shrink-0">Teacher Feedback:</span>
                        <span className="italic">"Great analysis of the French Revolution! Your points on the social causes..."</span>
                    </p>
                </Card>

                {/* Demo Submitted (Awaiting Check) Assignment */}
                <Card className="p-4 shadow-md rounded-xl border-primary/20 bg-primary/5 animate-in fade-in slide-in-from-top-4 duration-700">
                    <div className="flex justify-between items-start">
                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className="font-semibold text-primary">Demo: Physics Project</h3>
                                <Badge variant="secondary" className="text-[10px] h-4 uppercase font-bold tracking-widest bg-primary/10 text-primary border-none">Sample</Badge>
                            </div>
                            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                                <Clock className="h-3 w-3" /> Due: Tomorrow, 5:00 PM
                            </p>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                            <div className="flex items-center gap-2">
                                <Badge className="bg-primary/10 text-primary hover:bg-primary/20 border-none px-3 font-bold">Submitted</Badge>
                                <div className="relative overflow-hidden rounded-lg">
                                    <Button 
                                        size="sm" 
                                        variant="outline" 
                                        className="h-8 rounded-lg border-primary/20 text-primary hover:bg-primary/10"
                                        onClick={() => toast({ title: "Modify Feature (Demo)", description: "In a real assignment, this would open the file picker to replace your submission." })}
                                    >
                                        Modify
                                    </Button>
                                </div>
                            </div>
                            <p className="text-[9px] text-primary/60 font-bold uppercase tracking-tighter">Handed In • Awaiting Check</p>
                        </div>
                    </div>
                </Card>

                {assignments.length > 0 ? assignments.map(assignment => {
                    const userSub = submissions.find(s => s.assignmentId === assignment.id && s.studentId === user?.uid);
                    const canEdit = userRole === 'creator' || assignment.creatorId === user?.uid;
                    const isDeadlinePassed = new Date(assignment.dueDate.toDate()) < currentTime;
                    const teacherName = assignment.creatorName || "Teacher";

                    return (
                        <Card key={assignment.id} className="p-4 shadow-md rounded-xl group">
                            <div className="flex justify-between items-start">
                                <div>
                                    <h3 className="font-semibold">{assignment.title}</h3>
                                    <p className="text-xs text-muted-foreground">Due: {new Date(assignment.dueDate.toDate()).toLocaleString()}</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    {canUserManage ? (
                                        <>
                                            {canEdit ? (
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
                                                                                    <Link href={`/dashboard/classrooms/${classroomId}/assignments/${assignment.id}/result/${sub.studentId}`}>
                                                                                        <Eye className="mr-2 h-3.5 w-3.5"/>View Result
                                                                                    </Link>
                                                                                </Button>
                                                                            </div>
                                                                        ))
                                                                    )}
                                                                </div>
                                                            </ScrollArea>
                                                        </DialogContent>
                                                    </Dialog>
                                                    
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

                                                    <AlertDialog>
                                                        <AlertDialogTrigger asChild>
                                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive/70" title="Delete Assignment">
                                                                <Trash2 className="h-4 w-4" />
                                                            </Button>
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
                                            ) : (
                                                <Badge variant="outline" className="text-[10px] opacity-50 uppercase tracking-tighter">View Restricted</Badge>
                                            )}
                                        </>
                                    ) : user && (
                                        userSub ? (
                                            <div className="flex flex-col items-end gap-2">
                                                {isDeadlinePassed ? (
                                                    <Badge variant="outline" className="border-primary/20 text-primary font-bold bg-primary/5">Already Submitted</Badge>
                                                ) : (
                                                    <div className="flex items-center gap-2">
                                                        <Badge className="bg-primary/10 text-primary hover:bg-primary/20 border-none font-bold px-3">Submitted</Badge>
                                                        <div className="relative">
                                                            <input 
                                                                type="file" 
                                                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" 
                                                                disabled={isProcessing === `submitting-${assignment.id}`}
                                                                onChange={(e) => {
                                                                    const file = e.target.files?.[0];
                                                                    if (file) handleStudentSubmission(file, assignment.id);
                                                                }}
                                                            />
                                                            <Button size="sm" variant="outline" className="rounded-lg h-8 border-primary/20 text-primary hover:bg-primary/5" disabled={isProcessing === `submitting-${assignment.id}`}>
                                                                {isProcessing === `submitting-${assignment.id}` ? <Loader2 className="animate-spin h-3.5 w-3.5"/> : <Edit3 className="mr-1.5 h-3.5 w-3.5"/>}
                                                                Modify
                                                            </Button>
                                                        </div>
                                                    </div>
                                                )}
                                                {userSub.grade != null && (
                                                    <Button asChild size="sm" variant="outline" className="rounded-lg border-primary/20 text-primary hover:bg-primary/5">
                                                        <Link href={`/dashboard/classrooms/${classroomId}/assignments/${assignment.id}/result/${user.uid}`}>
                                                            View Result
                                                        </Link>
                                                    </Button>
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
                                                <div className="flex items-center gap-2">
                                                    <div className="relative">
                                                        <input 
                                                            type="file" 
                                                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" 
                                                            disabled={isProcessing === `submitting-${assignment.id}`}
                                                            onChange={(e) => {
                                                                const file = e.target.files?.[0];
                                                                if (file) handleStudentSubmission(file, assignment.id);
                                                            }}
                                                        />
                                                        <Button size="sm" className="rounded-lg btn-gel" disabled={isProcessing === `submitting-${assignment.id}`}>
                                                            {isProcessing === `submitting-${assignment.id}` ? <Loader2 className="animate-spin h-4 w-4 mr-2"/> : <Upload className="mr-2 h-4 w-4" />}
                                                            Submit Work
                                                        </Button>
                                                    </div>
                                                </div>
                                            )
                                        )
                                    )}
                                </div>
                            </div>
                            {userSub?.feedback && <p className="text-sm text-muted-foreground mt-2 border-t pt-2"><b>Feedback:</b> {userSub.feedback}</p>}
                        </Card>
                    );
                }) : null}
                
                {assignments.length === 0 && (
                    <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-xl">
                        <p className="text-sm">No active assignments found.</p>
                    </div>
                )}
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
