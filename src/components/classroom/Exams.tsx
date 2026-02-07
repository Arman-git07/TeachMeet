
'use client';

import { useState, useEffect, useCallback } from 'react';
import { collection, query, onSnapshot, orderBy, addDoc, serverTimestamp, deleteDoc, doc, Timestamp, updateDoc } from 'firebase/firestore';
import { db, storage } from '@/lib/firebase';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useClassroom } from '@/contexts/ClassroomContext';
import { canManage } from '@/lib/roles';
import { useToast } from '@/hooks/use-toast';
import { useForm, Controller, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { 
  Dialog, 
  DialogContent, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle, 
  DialogClose, 
  DialogTrigger, 
  DialogDescription 
} from '@/components/ui/dialog';
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
import { ScrollArea } from '@/components/ui/scroll-area';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Link from 'next/link';
import { Loader2, PlusCircle, Trash2, ClipboardCheck, Clock, CheckCircle2, Play, Eye, Upload, CheckCircle, Search } from 'lucide-react';
import type { Exam } from '@/app/dashboard/classrooms/[classroomId]/page';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError, type SecurityRuleContext } from '@/firebase/errors';

const examSchema = z.object({
    title: z.string().min(1, "Exam title is required"),
    startDate: z.date({ required_error: "Start date is required" }),
    endDate: z.date({ required_error: "End date is required" }),
    type: z.enum(['text', 'file']).optional(),
    questions: z.array(z.object({
        type: z.enum(['qa', 'mcq']),
        question: z.string().min(1, 'Required'),
        answer: z.string().min(1, 'Correct answer is required for auto-grading'),
        options: z.array(z.string()).optional(),
    })).optional(),
    examFile: z.any().optional(),
}).refine(data => data.endDate > data.startDate, {
    message: "End date must be after start date",
    path: ["endDate"]
});

export function Exams() {
    const { classroomId, user, userRole } = useClassroom();
    const { toast } = useToast();
    const [exams, setExams] = useState<Exam[]>([]);
    const [submissions, setSubmissions] = useState<Record<string, any[]>>({});
    const [userSubmissions, setUserSubmissions] = useState<Record<string, any>>({});
    const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
    const [isViewingResults, setIsViewingResults] = useState<any | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [currentTime, setCurrentTime] = useState(new Date());
    const [examType, setExamType] = useState<'text' | 'file'>('text');

    const [reschedulingExam, setReschedulingExam] = useState<Exam | null>(null);
    const [rescheduleValue, setRescheduleValue] = useState("");

    const canUserManage = canManage(userRole);
    
    const examForm = useForm<z.infer<typeof examSchema>>({ 
        resolver: zodResolver(examSchema),
        defaultValues: { questions: [], type: 'text' }
    });
    
    const { fields, append, remove } = useFieldArray({ control: examForm.control, name: "questions" });

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        if (!classroomId) return;
        const q = query(collection(db, 'classrooms', classroomId, 'exams'), orderBy('startDate', 'desc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const fetchedExams = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Exam));
            setExams(fetchedExams);
        });
        return unsubscribe;
    }, [classroomId]);

    // Submissions Sync Effect
    useEffect(() => {
        if (!classroomId || !user || exams.length === 0) return;
        
        const unsubs: (() => void)[] = [];

        exams.forEach(exam => {
            // 1. Personal Submission Listener (for students to check their own status)
            const subRef = doc(db, 'classrooms', classroomId, 'exams', exam.id, 'submissions', user.uid);
            const unsubUser = onSnapshot(subRef, (docSnap) => {
                setUserSubmissions(prev => ({ ...prev, [exam.id]: docSnap.exists() ? docSnap.data() : null }));
            }, (err) => {
                console.warn(`Submission listener failed for exam ${exam.id}:`, err);
            });
            unsubs.push(unsubUser);

            // 2. All Submissions Listener (for teachers to see all student work)
            if (canUserManage) {
                const allSubsQuery = query(collection(db, 'classrooms', classroomId, 'exams', exam.id, 'submissions'), orderBy('submittedAt', 'desc'));
                const unsubAll = onSnapshot(allSubsQuery, (snap) => {
                    const examSubs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                    setSubmissions(prev => ({ ...prev, [exam.id]: examSubs }));
                }, (err) => {
                    console.error(`Submissions aggregate listener failed for exam ${exam.id}:`, err);
                });
                unsubs.push(unsubAll);
            }
        });
        
        return () => unsubs.forEach(unsub => unsub());
    }, [classroomId, user, exams, canUserManage]);

    const onExamSubmit = useCallback(async (data: z.infer<typeof examSchema>) => {
        if (!canUserManage || !user || !classroomId) return;
        setIsSubmitting(true);
        try {
            let fileUrl = "";
            let storagePath = "";

            if (examType === 'file') {
                if (!data.examFile?.[0]) {
                    toast({ variant: 'destructive', title: "File Required", description: "Please upload a question paper for manual mode." });
                    setIsSubmitting(false);
                    return;
                }
                const file = data.examFile[0];
                const path = `classrooms/${classroomId}/exams/papers/${Date.now()}-${file.name}`;
                const fileRef = storageRef(storage, path);
                const snapshot = await uploadBytes(fileRef, file);
                fileUrl = await getDownloadURL(snapshot.ref);
                storagePath = path;
            }

            const newExamData = { 
                title: data.title, 
                startDate: Timestamp.fromDate(data.startDate), 
                endDate: Timestamp.fromDate(data.endDate),
                authorId: user.uid, 
                questions: examType === 'text' ? data.questions : null,
                fileUrl: examType === 'file' ? fileUrl : null,
                storagePath: examType === 'file' ? storagePath : null,
                type: examType, 
                createdAt: serverTimestamp() 
            };

            addDoc(collection(db, 'classrooms', classroomId, 'exams'), newExamData)
                .catch(async (error) => {
                    const pError = new FirestorePermissionError({
                        path: `classrooms/${classroomId}/exams`,
                        operation: 'create',
                        requestResourceData: newExamData
                    });
                    errorEmitter.emit('permission-error', pError);
                });

            toast({ title: "Exam Published!" });
            setIsCreateDialogOpen(false);
            examForm.reset({ questions: [] });
        } catch (error) {
            console.error("Exam setup error:", error);
            toast({ variant: 'destructive', title: "Setup Failed", description: "An unexpected error occurred during publishing." });
        } finally {
            setIsSubmitting(false);
        }
    }, [canUserManage, user, classroomId, toast, examForm, examType]);

    const onValidationError = useCallback((errors: any) => {
        console.error("Form Validation Errors:", errors);
        const errorMessages = Object.values(errors).map((e: any) => e.message).filter(Boolean);
        toast({
            variant: "destructive",
            title: "Validation Error",
            description: errorMessages[0] || "Please fill in all required fields correctly.",
        });
    }, [toast]);

    const handleReschedule = () => {
        if (!reschedulingExam || !rescheduleValue || !classroomId) return;
        
        setIsSubmitting(true);
        const newEndDate = new Date(rescheduleValue);
        const examRef = doc(db, 'classrooms', classroomId, 'exams', reschedulingExam.id);
        const updateData = { endDate: Timestamp.fromDate(newEndDate) };

        updateDoc(examRef, updateData)
            .catch(async (serverError) => {
                const pError = new FirestorePermissionError({
                    path: examRef.path,
                    operation: 'update',
                    requestResourceData: updateData
                });
                errorEmitter.emit('permission-error', pError);
            })
            .finally(() => {
                setIsSubmitting(false);
            });
        
        toast({ 
            title: "Updating Deadline...", 
            description: "The schedule will update shortly." 
        });
        setReschedulingExam(null);
    };

    const handleOpenResults = async (sub: any, examId: string) => {
        setIsViewingResults(sub);
        if (user && sub.studentId === user.uid && !sub.seenAt && (sub.grade != null || sub.percentage != null)) {
            const subRef = doc(db, 'classrooms', classroomId!, 'exams', examId, 'submissions', user.uid);
            updateDoc(subRef, { seenAt: serverTimestamp() }).catch(async (err) => {
                const pErr = new FirestorePermissionError({ path: subRef.path, operation: 'update', requestResourceData: { seenAt: 'serverTimestamp' } });
                errorEmitter.emit('permission-error', pErr);
            });
        }
    };

    return (
        <div className="space-y-6">
            <Card className="border-0 shadow-none bg-transparent">
                <CardHeader className="flex flex-row items-center justify-between px-0">
                    <div>
                        <CardTitle className="text-2xl">Exams</CardTitle>
                        <CardDescription>Scheduled tests and assessments.</CardDescription>
                    </div>
                    {canUserManage && (
                        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                            <DialogTrigger asChild>
                                <Button className="btn-gel"><PlusCircle className="mr-2 h-4 w-4" /> Create Exam</Button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-3xl w-[95vw] sm:w-full max-h-[95dvh] sm:max-h-[90dvh] flex flex-col p-0 overflow-hidden">
                                <DialogHeader className="p-4 sm:p-6 pb-2 sm:pb-4 border-b">
                                    <DialogTitle>Exam Paper Builder</DialogTitle>
                                    <DialogDescription className="text-xs sm:text-sm">Create an auto-grading exam or upload a question paper for manual grading.</DialogDescription>
                                </DialogHeader>
                                
                                <div className="p-4 sm:p-6 pb-0">
                                    <Tabs value={examType} onValueChange={(v) => setExamType(v as any)} className="w-full">
                                        <TabsList className="grid w-full grid-cols-2">
                                            <TabsTrigger value="text" className="text-xs sm:text-sm">Built-in (Auto Grading)</TabsTrigger>
                                            <TabsTrigger value="file" className="text-xs sm:text-sm">Upload Paper (Manual)</TabsTrigger>
                                        </TabsList>
                                    </Tabs>
                                </div>

                                <form id="exam-form" onSubmit={examForm.handleSubmit(onExamSubmit, onValidationError)} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 sm:space-y-6">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-2 md:col-span-2">
                                            <Label>Exam Title</Label>
                                            <Input {...examForm.register('title')} placeholder="e.g., Final Semester Physics" />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Start Date & Time</Label>
                                            <Controller control={examForm.control} name="startDate" render={({ field }) => (
                                                <Input type="datetime-local" onChange={(e) => field.onChange(new Date(e.target.value))} value={field.value ? format(field.value, "yyyy-MM-dd'T'HH:mm") : ""} />
                                            )} />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>End Date & Time</Label>
                                            <Controller control={examForm.control} name="endDate" render={({ field }) => (
                                                <Input type="datetime-local" onChange={(e) => field.onChange(new Date(e.target.value))} value={field.value ? format(field.value, "yyyy-MM-dd'T'HH:mm") : ""} />
                                            )} />
                                        </div>
                                    </div>

                                    {examType === 'file' ? (
                                        <div className="space-y-4 p-4 sm:p-6 border-2 border-dashed rounded-xl bg-muted/30 text-center">
                                            <div className="mx-auto w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-primary/10 flex items-center justify-center mb-2">
                                                <Upload className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
                                            </div>
                                            <div>
                                                <Label className="text-sm sm:text-base font-bold">Upload Question Paper</Label>
                                                <p className="text-xs sm:text-sm text-muted-foreground mb-4">Upload PDF or Image. You will check student answers manually.</p>
                                                <Input type="file" {...examForm.register('examFile')} className="max-w-xs mx-auto text-xs sm:text-sm" />
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="space-y-4">
                                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                                <Label className="text-base sm:text-lg font-bold">Questions</Label>
                                                <div className="flex gap-2">
                                                    <Button type="button" variant="outline" size="sm" onClick={() => append({ type: 'qa', question: '', answer: '' })} className="text-[10px] sm:text-xs">
                                                        <PlusCircle className="mr-1.5 h-3 w-3 sm:h-4 w-4" /> Add Q/A
                                                    </Button>
                                                    <Button type="button" variant="outline" size="sm" onClick={() => append({ type: 'mcq', question: '', answer: '', options: ['', '', '', ''] })} className="text-[10px] sm:text-xs">
                                                        <PlusCircle className="mr-1.5 h-3 w-3 sm:h-4 w-4" /> Add MCQ
                                                    </Button>
                                                </div>
                                            </div>

                                            {fields.length === 0 && (
                                                <div className="text-center py-8 sm:py-12 border-2 border-dashed rounded-xl text-muted-foreground">
                                                    <ClipboardCheck className="mx-auto h-10 w-10 sm:h-12 sm:w-12 mb-2 opacity-20" />
                                                    <p className="text-sm">No questions added yet.</p>
                                                </div>
                                            )}

                                            {fields.map((field, index) => (
                                                <Card key={field.id} className="relative overflow-hidden border-primary/10 shadow-sm">
                                                    <div className="absolute top-0 left-0 w-1 h-full bg-primary" />
                                                    <CardHeader className="py-2 sm:py-3 px-3 sm:px-4 flex flex-row items-center justify-between bg-muted/30">
                                                        <Badge variant="outline" className="uppercase text-[9px] sm:text-[10px]">
                                                            {examForm.watch(`questions.${index}.type`) === 'mcq' ? 'Multiple Choice' : 'Short Answer'}
                                                        </Badge>
                                                        <Button type="button" variant="ghost" size="icon" className="h-7 w-7 sm:h-8 w-8 text-destructive hover:bg-destructive/10" onClick={() => remove(index)}>
                                                            <Trash2 className="h-3.5 w-3.5 sm:h-4 w-4"/>
                                                        </Button>
                                                    </CardHeader>
                                                    <CardContent className="pt-3 sm:pt-4 px-3 sm:px-4 space-y-3 sm:space-y-4">
                                                        <div className="space-y-1 sm:space-y-2">
                                                            <Label className="text-[10px] sm:text-xs font-bold text-muted-foreground uppercase">Question {index + 1}</Label>
                                                            <Textarea 
                                                                {...examForm.register(`questions.${index}.question` as const)} 
                                                                placeholder="Type question here..."
                                                                className="resize-none text-sm"
                                                                rows={2}
                                                            />
                                                        </div>

                                                        {examForm.watch(`questions.${index}.type`) === 'mcq' && (
                                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                                                                {[0, 1, 2, 3].map((optIdx) => (
                                                                    <div key={optIdx}>
                                                                        <Input 
                                                                            {...examForm.register(`questions.${index}.options.${optIdx}` as const)} 
                                                                            placeholder={`Option ${optIdx + 1}`}
                                                                            className="text-sm h-9"
                                                                        />
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}

                                                        <div className="space-y-1 sm:space-y-2 p-2 sm:p-3 bg-primary/5 rounded-lg border border-primary/10">
                                                            <Label className="text-[10px] sm:text-xs font-bold text-primary uppercase flex items-center gap-1.5">
                                                                <CheckCircle2 className="h-3 w-3 sm:h-3.5 sm:w-3.5" /> Correct Answer
                                                            </Label>
                                                            {examForm.watch(`questions.${index}.type`) === 'mcq' ? (
                                                                <Controller
                                                                    control={examForm.control}
                                                                    name={`questions.${index}.answer` as const}
                                                                    render={({ field }) => (
                                                                        <RadioGroup onValueChange={field.onChange} value={field.value} className="flex flex-wrap gap-2 sm:gap-4 mt-1 sm:mt-2">
                                                                            {[0, 1, 2, 3].map(i => {
                                                                                const val = examForm.watch(`questions.${index}.options.${i}`);
                                                                                return (
                                                                                    <div key={i} className="flex items-center space-x-1.5">
                                                                                        <RadioGroupItem value={val || `opt-${i}`} id={`q-${index}-opt-${i}`} disabled={!val} className="h-3.5 w-3.5" />
                                                                                        <Label htmlFor={`q-${index}-opt-${i}`} className="text-xs sm:text-sm">{val || `Opt ${i+1}`}</Label>
                                                                                    </div>
                                                                                );
                                                                            })}
                                                                        </RadioGroup>
                                                                    )}
                                                                />
                                                            ) : (
                                                                <Input 
                                                                    {...examForm.register(`questions.${index}.answer` as const)} 
                                                                    placeholder="Exact answer for auto-grading..."
                                                                    className="text-sm h-9"
                                                                />
                                                            )}
                                                        </div>
                                                    </CardContent>
                                                </Card>
                                            ))}
                                        </div>
                                    )}
                                </form>
                                <DialogFooter className="p-4 sm:p-6 border-t bg-muted/10">
                                    <div className="flex flex-col-reverse sm:flex-row w-full sm:justify-end gap-2">
                                        <DialogClose asChild>
                                            <Button variant="outline" type="button" className="w-full sm:w-auto">Cancel</Button>
                                        </DialogClose>
                                        <Button type="submit" form="exam-form" disabled={isSubmitting || (examType === 'text' && fields.length === 0)} className="w-full sm:w-auto">
                                            {isSubmitting ? <Loader2 className="animate-spin mr-2 h-4 w-4"/> : null}
                                            Publish Exam
                                        </Button>
                                    </div>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                    )}
                </CardHeader>
                <CardContent className="px-0 pt-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {exams.length > 0 ? exams.map(exam => {
                            const mySub = userSubmissions[exam.id];
                            const start = exam.startDate?.toDate();
                            const end = exam.endDate?.toDate();
                            const isLive = start && end && currentTime >= start && currentTime <= end;
                            const isUpcoming = start && currentTime < start;
                            const isExpired = end && currentTime > end;

                            const examSubmissions = submissions[exam.id] || [];
                            const seenCount = examSubmissions.filter(s => s.seenAt).length;

                            return (
                                <Card key={exam.id} className="shadow-md border-border/50 group flex flex-col">
                                    <CardHeader className="pb-2">
                                        <div className="flex justify-between items-start gap-2">
                                            <CardTitle className="text-lg truncate flex-1">{exam.title}</CardTitle>
                                            {canUserManage && (
                                                <div className="flex items-center gap-1 shrink-0">
                                                    {(userRole === 'creator' || exam.authorId === user?.uid) && (
                                                        <Button 
                                                            variant="ghost" 
                                                            size="icon" 
                                                            className="h-8 w-8 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                                                            title="Reschedule Deadline"
                                                            onClick={() => {
                                                                setReschedulingExam(exam);
                                                                const d = exam.endDate?.toDate();
                                                                if (d) setRescheduleValue(format(d, "yyyy-MM-dd'T'HH:mm"));
                                                            }}
                                                        >
                                                            <Clock className="h-4 w-4"/>
                                                        </Button>
                                                    )}
                                                    <AlertDialog>
                                                        <AlertDialogTrigger asChild>
                                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive/70 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                <Trash2 className="h-4 w-4"/>
                                                            </Button>
                                                        </AlertDialogTrigger>
                                                        <AlertDialogContent className="rounded-xl">
                                                            <AlertDialogHeader>
                                                                <AlertDialogTitle>Delete Exam?</AlertDialogTitle>
                                                                <AlertDialogDescription>Remove this exam and all student submissions?</AlertDialogDescription>
                                                            </AlertDialogHeader>
                                                            <AlertDialogFooter>
                                                                <AlertDialogCancel className="rounded-lg">Cancel</AlertDialogCancel>
                                                                <AlertDialogAction 
                                                                    onClick={() => { 
                                                                        const examRef = doc(db, "classrooms", classroomId!, "exams", exam.id);
                                                                        deleteDoc(examRef).catch(async (err) => {
                                                                            const pError = new FirestorePermissionError({ path: examRef.path, operation: 'delete' });
                                                                            errorEmitter.emit('permission-error', pError);
                                                                        });
                                                                        toast({ title: "Exam Deleted" }); 
                                                                    }}
                                                                    className="bg-destructive rounded-lg"
                                                                >
                                                                    Delete
                                                                </AlertDialogAction>
                                                            </AlertDialogFooter>
                                                        </AlertDialogContent>
                                                    </AlertDialog>
                                                </div>
                                            )}
                                        </div>
                                        <div className="space-y-1 mt-2">
                                            <p className="text-[10px] text-muted-foreground uppercase font-bold flex items-center gap-1">
                                                <Clock className="h-3 w-3" /> {start?.toLocaleString()} - {end?.toLocaleString()}
                                            </p>
                                            <Badge variant="outline" className="text-[10px] h-5">{exam.type === 'file' ? 'Manual Grading' : 'Auto Grading'}</Badge>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="flex-grow pt-2">
                                        {isLive && <Badge className="bg-green-500 hover:bg-green-500 animate-pulse">Live Now</Badge>}
                                        {isUpcoming && <Badge variant="secondary">Upcoming</Badge>}
                                        {isExpired && <Badge variant="outline">Ended</Badge>}
                                        {mySub && <Badge className="ml-2 bg-primary/20 text-primary hover:bg-primary/20">Submitted</Badge>}
                                    </CardContent>
                                    <CardFooter className="pt-2">
                                        {userRole === 'student' ? (
                                            mySub === undefined ? (
                                                <Button disabled variant="outline" className="w-full">
                                                    Start Exam
                                                </Button>
                                            ) : mySub ? (
                                                isExpired ? (
                                                    <Button variant="default" className="w-full btn-gel" onClick={() => handleOpenResults(mySub, exam.id)}>
                                                        <Eye className="mr-2 h-4 w-4" /> View Results & Paper
                                                    </Button>
                                                ) : (
                                                    <div className="w-full flex flex-col items-center gap-1">
                                                        <Button disabled variant="outline" className="w-full">
                                                            <CheckCircle2 className="mr-2 h-4 w-4 text-primary" /> Submitted
                                                        </Button>
                                                        <p className="text-[9px] text-muted-foreground italic text-center font-medium">Wait for result till exam ends.</p>
                                                    </div>
                                                )
                                            ) : isExpired ? (
                                                <Button disabled variant="outline" className="w-full">Expired</Button>
                                            ) : isUpcoming ? (
                                                <Button disabled variant="outline" className="w-full">Upcoming</Button>
                                            ) : (
                                                <Button asChild className="w-full btn-gel">
                                                    <Link href={`/dashboard/classrooms/${classroomId}/exams/${exam.id}/take`}>
                                                        <Play className="mr-2 h-4 w-4" /> Start Exam
                                                    </Link>
                                                </Button>
                                            )
                                        ) : (
                                            <Dialog>
                                                <DialogTrigger asChild>
                                                    <Button variant="outline" className="w-full">
                                                        Submissions ({examSubmissions.length}){examSubmissions.length > 0 && ` • ${seenCount} seen`}
                                                    </Button>
                                                </DialogTrigger>
                                                <DialogContent className="sm:max-w-2xl w-[95vw] sm:w-full">
                                                    <DialogHeader>
                                                        <DialogTitle>Submissions: {exam.title}</DialogTitle>
                                                        <DialogDescription>
                                                            {exam.type === 'file' 
                                                                ? 'View uploaded papers and grade them using the markup tool.'
                                                                : 'Overview of automatically graded student results.'}
                                                        </DialogDescription>
                                                    </DialogHeader>
                                                    <ScrollArea className="max-h-[60vh] mt-4">
                                                        <div className="space-y-3 px-1">
                                                            {examSubmissions.length === 0 ? (
                                                                <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-xl">
                                                                    <p>No student submissions yet.</p>
                                                                </div>
                                                            ) : (
                                                                examSubmissions.map(sub => (
                                                                    <div key={sub.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 sm:p-4 bg-muted/30 rounded-xl border border-border/50 gap-3">
                                                                        <div className="flex-1 min-w-0">
                                                                            <p className="font-bold text-foreground truncate">{sub.studentName}</p>
                                                                            <p className="text-[10px] text-muted-foreground uppercase">
                                                                                Sub: {new Date(sub.submittedAt?.toDate()).toLocaleString()}
                                                                                {sub.seenAt && ` • Seen: ${new Date(sub.seenAt.toDate()).toLocaleString()}`}
                                                                            </p>
                                                                        </div>
                                                                        <div className="flex items-center justify-between sm:justify-end gap-2 sm:gap-4">
                                                                            {sub.percentage != null || sub.grade != null ? (
                                                                                <Badge className="bg-primary/20 text-primary hover:bg-primary/20 border-none font-bold">
                                                                                    {sub.percentage ?? sub.grade}%
                                                                                </Badge>
                                                                            ) : (
                                                                                <Badge variant="outline">Pending</Badge>
                                                                            )}
                                                                            
                                                                            {exam.type === 'file' ? (
                                                                                <Button asChild size="sm" className="rounded-lg h-8 sm:h-9">
                                                                                    <Link href={`/dashboard/classrooms/${classroomId}/exams/${exam.id}/check/${sub.studentId}`}>
                                                                                        {sub.percentage != null ? "Edit Marks" : "Check Paper"}
                                                                                    </Link>
                                                                                </Button>
                                                                            ) : (
                                                                                <Button variant="ghost" size="sm" onClick={() => handleOpenResults(sub, exam.id)}>
                                                                                    <Eye className="h-4 w-4 mr-1.5" /> Results
                                                                                </Button>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                ))
                                                            )}
                                                        </div>
                                                    </ScrollArea>
                                                </DialogContent>
                                            </Dialog>
                                        )}
                                    </CardFooter>
                                </Card>
                            );
                        }) : (
                            <div className="col-span-full text-center py-16 text-muted-foreground border-2 border-dashed rounded-2xl">
                                <ClipboardCheck className="mx-auto h-16 w-16 mb-4 opacity-10" />
                                <p>No exams scheduled yet.</p>
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>

            <Dialog open={!!isViewingResults} onOpenChange={(open) => !open && setIsViewingResults(null)}>
                <DialogContent className="sm:max-w-2xl w-[95vw] sm:w-full">
                    <DialogHeader>
                        <DialogTitle>Exam Results</DialogTitle>
                        <DialogDescription>Detailed marks and feedback breakdown.</DialogDescription>
                    </DialogHeader>
                    {isViewingResults && (
                        <div className="space-y-6 overflow-hidden">
                            <div className="flex justify-between items-center bg-primary/10 p-4 sm:p-6 rounded-xl border border-primary/20">
                                <div className="space-y-1">
                                    <p className="text-xs sm:text-sm font-medium text-primary">Score Details</p>
                                    <p className="text-xl sm:text-3xl font-bold">{isViewingResults.score != null ? `${isViewingResults.score} / ${isViewingResults.total || '100'}` : 'Final Marks'}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-xs sm:text-sm font-medium text-primary">Percentage</p>
                                    <p className="text-2xl sm:text-4xl font-black text-primary">{isViewingResults.percentage ?? isViewingResults.grade ?? 0}%</p>
                                </div>
                            </div>
                            
                            <Button asChild className="w-full btn-gel h-10 sm:h-12 rounded-xl text-base sm:text-lg">
                                <a href={isViewingResults.checkedUrl || "https://www.africau.edu/images/default/sample.pdf"} target="_blank" rel="noreferrer">
                                    <CheckCircle className="mr-2 h-4 w-4 sm:h-5 sm:w-5" /> 
                                    View Checked Answer Sheet {!isViewingResults.checkedUrl && "(Demo)"}
                                </a>
                            </Button>

                            {isViewingResults.feedback && (
                                <Card className="p-3 sm:p-4 bg-muted/30 border-none rounded-xl">
                                    <Label className="text-[10px] sm:text-xs uppercase text-muted-foreground font-bold">Teacher's Feedback</Label>
                                    <p className="mt-1 sm:mt-2 text-sm italic leading-relaxed">"{isViewingResults.feedback}"</p>
                                </Card>
                            )}
                            
                            {isViewingResults.results && (
                                <ScrollArea className="max-h-[40vh] pr-2 sm:pr-4">
                                    <div className="space-y-3 sm:space-y-4">
                                        {isViewingResults.results?.map((res: any, i: number) => (
                                            <div key={i} className={cn("p-3 sm:p-4 rounded-lg border", res.isCorrect ? "bg-green-50 border-green-100" : "bg-red-50 border-red-100")}>
                                                <p className="font-semibold text-xs sm:text-sm mb-2 sm:mb-3">Q{i+1}: {res.question}</p>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4 text-[10px] sm:text-xs">
                                                    <div><p className="text-muted-foreground uppercase font-bold">Your Answer</p><p className={cn("font-medium", res.isCorrect ? "text-green-700" : "text-red-700")}>{res.studentAnswer || '(Empty)'}</p></div>
                                                    {!res.isCorrect && <div><p className="text-muted-foreground uppercase font-bold">Correct Answer</p><p className="font-medium text-green-700">{res.correctAnswer}</p></div>}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </ScrollArea>
                            )}
                        </div>
                    )}
                    <DialogFooter className="p-4 sm:p-6 border-t sm:border-none"><DialogClose asChild><Button variant="secondary" className="w-full sm:w-auto rounded-lg">Close</Button></DialogClose></DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={!!reschedulingExam} onOpenChange={(open) => !open && setReschedulingExam(null)}>
                <DialogContent className="sm:max-w-md w-[95vw] rounded-xl">
                    <DialogHeader>
                        <DialogTitle>Reschedule Exam Deadline</DialogTitle>
                        <DialogDescription>Update the closing date and time for "{reschedulingExam?.title}".</DialogDescription>
                    </DialogHeader>
                    <div className="py-4 sm:py-6 space-y-4">
                        <div className="space-y-2">
                            <Label>New End Date & Time</Label>
                            <Input 
                                type="datetime-local" 
                                value={rescheduleValue} 
                                onChange={(e) => setRescheduleValue(e.target.value)} 
                                className="rounded-lg"
                            />
                        </div>
                        <p className="text-[10px] text-muted-foreground italic">Students already taking the exam will be cut off at this new time.</p>
                    </div>
                    <DialogFooter className="gap-2">
                        <Button variant="outline" onClick={() => setReschedulingExam(null)} className="rounded-lg">Cancel</Button>
                        <Button onClick={handleReschedule} disabled={isSubmitting || !rescheduleValue} className="rounded-lg btn-gel">
                            {isSubmitting ? <Loader2 className="animate-spin mr-2 h-4 w-4"/> : null}
                            Update Deadline
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
