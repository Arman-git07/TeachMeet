'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { collection, query, onSnapshot, orderBy, addDoc, serverTimestamp, deleteDoc, doc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
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
import { PlusCircle, Trash2, ClipboardCheck, Clock, CheckCircle2, Loader2, Play, Eye } from 'lucide-react';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { Exam } from '@/app/dashboard/classrooms/[classroomId]/page';

const examSchema = z.object({
    title: z.string().min(1, "Exam title is required"),
    startDate: z.date({ required_error: "Start date is required" }),
    endDate: z.date({ required_error: "End date is required" }),
    questions: z.array(z.object({
        type: z.enum(['qa', 'mcq']),
        question: z.string().min(1, 'Required'),
        answer: z.string().min(1, 'Correct answer is required for auto-grading'),
        options: z.array(z.string()).optional(), // Only for MCQ
    })).min(1, "At least one question is required"),
}).refine(data => data.endDate > data.startDate, {
    message: "End date must be after start date",
    path: ["endDate"]
});

export function Exams() {
    const { classroomId, user, userRole } = useClassroom();
    const { toast } = useToast();
    const [exams, setExams] = useState<Exam[]>([]);
    const [userSubmissions, setUserSubmissions] = useState<Record<string, any>>({});
    const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
    const [isTakingExam, setIsTakingExam] = useState<Exam | null>(null);
    const [isViewingResults, setIsViewingResults] = useState<any | null>(null);
    const [examAnswers, setExamAnswers] = useState<Record<number, string>>({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [currentTime, setCurrentTime] = useState(new Date());

    const canUserManage = canManage(userRole);
    
    const examForm = useForm<z.infer<typeof examSchema>>({ 
        resolver: zodResolver(examSchema),
        defaultValues: { questions: [] }
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

    useEffect(() => {
        if (!classroomId || !user || exams.length === 0) return;
        
        const unsubs = exams.map(exam => {
            const subRef = doc(db, 'classrooms', classroomId, 'exams', exam.id, 'submissions', user.uid);
            return onSnapshot(subRef, (docSnap) => {
                if (docSnap.exists()) {
                    setUserSubmissions(prev => ({ ...prev, [exam.id]: docSnap.data() }));
                }
            });
        });
        
        return () => unsubs.forEach(unsub => unsub());
    }, [classroomId, user, exams]);

    const onExamSubmit = useCallback(async (data: z.infer<typeof examSchema>) => {
        if (!canUserManage || !user) return;
        try {
            await addDoc(collection(db, 'classrooms', classroomId, 'exams'), { 
                title: data.title, 
                startDate: data.startDate, 
                endDate: data.endDate,
                authorId: user.uid, 
                questions: data.questions, 
                type: 'text', 
                createdAt: serverTimestamp() 
            });
            toast({ title: "Exam Published!", description: "Students can now see and take this exam during the scheduled window." });
            setIsCreateDialogOpen(false);
            examForm.reset({ questions: [] });
        } catch (error) {
            toast({ variant: 'destructive', title: "Failed to create exam" });
        }
    }, [canUserManage, user, classroomId, toast, examForm]);

    const handleSubmitExam = async () => {
        if (!isTakingExam || !user || !classroomId) return;
        setIsSubmitting(true);

        try {
            const questions = (isTakingExam as any).questions || [];
            let score = 0;
            const results = questions.map((q: any, index: number) => {
                const studentAnswer = examAnswers[index] || "";
                const isCorrect = studentAnswer.trim().toLowerCase() === q.answer.trim().toLowerCase();
                if (isCorrect) score++;
                return {
                    question: q.question,
                    studentAnswer,
                    correctAnswer: q.answer,
                    isCorrect
                };
            });

            const percentage = Math.round((score / questions.length) * 100);

            await setDoc(doc(db, 'classrooms', classroomId, 'exams', isTakingExam.id, 'submissions', user.uid), {
                userId: user.uid,
                userName: user.displayName || 'Anonymous',
                submittedAt: serverTimestamp(),
                score,
                total: questions.length,
                percentage,
                results
            });

            toast({ 
                title: "Exam Submitted!", 
                description: `You scored ${score}/${questions.length} (${percentage}%).` 
            });
            
            setIsTakingExam(null);
            setExamAnswers({});
        } catch (error) {
            console.error("Submit error:", error);
            toast({ variant: 'destructive', title: "Submission Failed" });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="space-y-6">
            <Card className="border-0 shadow-none bg-transparent">
                <CardHeader className="flex flex-row items-center justify-between px-0">
                    <div>
                        <CardTitle className="text-2xl">Exams</CardTitle>
                        <CardDescription>Scheduled tests and assessments with automatic grading.</CardDescription>
                    </div>
                    {canUserManage && (
                        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                            <DialogTrigger asChild>
                                <Button className="btn-gel"><PlusCircle className="mr-2 h-4 w-4" /> Create Exam</Button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-3xl max-h-[90dvh] flex flex-col p-0">
                                <DialogHeader className="p-6 pb-4 border-b">
                                    <DialogTitle>Exam Paper Builder</DialogTitle>
                                    <DialogDescription>Add questions and correct answers for automatic checking.</DialogDescription>
                                </DialogHeader>
                                <form id="exam-form" onSubmit={examForm.handleSubmit(onExamSubmit)} className="flex-1 overflow-y-auto p-6 space-y-6">
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

                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between">
                                            <Label className="text-lg font-bold">Questions</Label>
                                            <div className="flex gap-2">
                                                <Button type="button" variant="outline" size="sm" onClick={() => append({ type: 'qa', question: '', answer: '' })}>
                                                    <PlusCircle className="mr-1.5 h-4 w-4" /> Add Q/A
                                                </Button>
                                                <Button type="button" variant="outline" size="sm" onClick={() => append({ type: 'mcq', question: '', answer: '', options: ['', '', '', ''] })}>
                                                    <PlusCircle className="mr-1.5 h-4 w-4" /> Add MCQ
                                                </Button>
                                            </div>
                                        </div>

                                        {fields.length === 0 && (
                                            <div className="text-center py-12 border-2 border-dashed rounded-xl text-muted-foreground">
                                                <ClipboardCheck className="mx-auto h-12 w-12 mb-2 opacity-20" />
                                                <p>No questions added. Use the buttons above to start building.</p>
                                            </div>
                                        )}

                                        {fields.map((field, index) => (
                                            <Card key={field.id} className="relative overflow-hidden border-primary/10 shadow-sm">
                                                <div className="absolute top-0 left-0 w-1 h-full bg-primary" />
                                                <CardHeader className="py-3 flex flex-row items-center justify-between bg-muted/30">
                                                    <Badge variant="outline" className="uppercase text-[10px]">
                                                        {examForm.watch(`questions.${index}.type`) === 'mcq' ? 'Multiple Choice' : 'Short Answer'}
                                                    </Badge>
                                                    <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={() => remove(index)}>
                                                        <Trash2 className="h-4 w-4"/>
                                                    </Button>
                                                </CardHeader>
                                                <CardContent className="pt-4 space-y-4">
                                                    <div className="space-y-2">
                                                        <Label className="text-xs font-bold text-muted-foreground uppercase">Question {index + 1}</Label>
                                                        <Textarea 
                                                            {...examForm.register(`questions.${index}.question` as const)} 
                                                            placeholder="e.g., What is the unit of force?"
                                                            className="resize-none"
                                                        />
                                                    </div>

                                                    {examForm.watch(`questions.${index}.type`) === 'mcq' && (
                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                            {[0, 1, 2, 3].map((optIdx) => (
                                                                <div key={optIdx} className="space-y-1">
                                                                    <Label className="text-[10px] uppercase">Option {optIdx + 1}</Label>
                                                                    <Input 
                                                                        {...examForm.register(`questions.${index}.options.${optIdx}` as const)} 
                                                                        placeholder={`Option ${optIdx + 1}`}
                                                                    />
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}

                                                    <div className="space-y-2 p-3 bg-primary/5 rounded-lg border border-primary/10">
                                                        <Label className="text-xs font-bold text-primary uppercase flex items-center gap-1.5">
                                                            <CheckCircle2 className="h-3.5 w-3.5" /> Correct Answer (System Only)
                                                        </Label>
                                                        {examForm.watch(`questions.${index}.type`) === 'mcq' ? (
                                                            <Controller
                                                                control={examForm.control}
                                                                name={`questions.${index}.answer` as const}
                                                                render={({ field }) => (
                                                                    <RadioGroup onValueChange={field.onChange} value={field.value} className="flex flex-wrap gap-4 mt-2">
                                                                        {[0, 1, 2, 3].map(i => {
                                                                            const val = examForm.watch(`questions.${index}.options.${i}`);
                                                                            return (
                                                                                <div key={i} className="flex items-center space-x-2">
                                                                                    <RadioGroupItem value={val || `opt-${i}`} id={`q-${index}-opt-${i}`} disabled={!val} />
                                                                                    <Label htmlFor={`q-${index}-opt-${i}`} className="text-sm">{val || `Option ${i+1}`}</Label>
                                                                                </div>
                                                                            );
                                                                        })}
                                                                    </RadioGroup>
                                                                )}
                                                            />
                                                        ) : (
                                                            <Input 
                                                                {...examForm.register(`questions.${index}.answer` as const)} 
                                                                placeholder="The exact answer the system should look for..."
                                                            />
                                                        )}
                                                        <p className="text-[10px] text-muted-foreground italic mt-1">This answer will not be shown to students. It is used for automatic grading.</p>
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        ))}
                                    </div>
                                </form>
                                <DialogFooter className="p-6 border-t bg-muted/10">
                                    <DialogClose asChild>
                                        <Button variant="outline" type="button">Cancel</Button>
                                    </DialogClose>
                                    <Button type="submit" form="exam-form" disabled={fields.length === 0}>
                                        Publish Exam
                                    </Button>
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

                            return (
                                <Card key={exam.id} className="shadow-md hover:shadow-lg transition-shadow border-border/50 group flex flex-col">
                                    <CardHeader className="pb-2">
                                        <div className="flex justify-between items-start">
                                            <CardTitle className="text-lg leading-tight">{exam.title}</CardTitle>
                                            {canUserManage && (
                                                <AlertDialog>
                                                    <AlertDialogTrigger asChild>
                                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive/70 opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <Trash2 className="h-4 w-4"/>
                                                        </Button>
                                                    </AlertDialogTrigger>
                                                    <AlertDialogContent>
                                                        <AlertDialogHeader>
                                                            <AlertDialogTitle>Delete Exam?</AlertDialogTitle>
                                                            <AlertDialogDescription>
                                                                Are you sure you want to delete "{exam.title}"? This action cannot be undone and will remove all associated student scores.
                                                            </AlertDialogDescription>
                                                        </AlertDialogHeader>
                                                        <AlertDialogFooter>
                                                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                            <AlertDialogAction 
                                                                onClick={async () => { 
                                                                    await deleteDoc(doc(db, "classrooms", classroomId!, "exams", exam.id)); 
                                                                    toast({ title: "Exam Deleted" }); 
                                                                }}
                                                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                                            >
                                                                Delete
                                                            </AlertDialogAction>
                                                        </AlertDialogFooter>
                                                    </AlertDialogContent>
                                                </AlertDialog>
                                            )}
                                        </div>
                                        <div className="space-y-1 mt-2">
                                            <div className="flex items-center gap-2 text-[10px] text-muted-foreground uppercase font-bold">
                                                <Clock className="h-3 w-3" /> Starts: {start?.toLocaleString()}
                                            </div>
                                            <div className="flex items-center gap-2 text-[10px] text-muted-foreground uppercase font-bold">
                                                <Clock className="h-3 w-3" /> Ends: {end?.toLocaleString()}
                                            </div>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="flex-grow pt-2">
                                        {isLive && <Badge className="bg-green-500 hover:bg-green-500 animate-pulse">Live Now</Badge>}
                                        {isUpcoming && <Badge variant="secondary">Upcoming</Badge>}
                                        {isExpired && <Badge variant="outline">Ended</Badge>}
                                        {mySub && <Badge className="ml-2 bg-primary/20 text-primary hover:bg-primary/20 border-none">Completed</Badge>}
                                    </CardContent>
                                    <CardFooter className="pt-2">
                                        {userRole === 'student' ? (
                                            mySub ? (
                                                <Button variant="outline" className="w-full rounded-lg" onClick={() => setIsViewingResults(mySub)}>
                                                    <Eye className="mr-2 h-4 w-4" /> View My Results
                                                </Button>
                                            ) : isExpired ? (
                                                <Button disabled variant="outline" className="w-full rounded-lg">Time Expired</Button>
                                            ) : isUpcoming ? (
                                                <Button disabled variant="outline" className="w-full rounded-lg">Not Started</Button>
                                            ) : (
                                                <Button className="w-full btn-gel rounded-lg" onClick={() => setIsTakingExam(exam)}>
                                                    <Play className="mr-2 h-4 w-4" /> Start Exam
                                                </Button>
                                            )
                                        ) : (
                                            <Button variant="outline" className="w-full" onClick={() => toast({ title: "Teacher Review", description: "You can view all student scores in the classroom participants management area." })}>
                                                Teacher View
                                            </Button>
                                        )}
                                    </CardFooter>
                                </Card>
                            );
                        }) : (
                            <div className="col-span-full text-center py-16 text-muted-foreground border-2 border-dashed rounded-2xl">
                                <ClipboardCheck className="mx-auto h-16 w-16 mb-4 opacity-10" />
                                <p className="text-lg font-medium">No exams scheduled yet.</p>
                                <p className="text-sm">Teachers can create exams with specific start/end windows.</p>
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Exam Taking Dialog */}
            <Dialog open={!!isTakingExam} onOpenChange={(open) => !open && !isSubmitting && setIsTakingExam(null)}>
                <DialogContent className="sm:max-w-3xl max-h-[95dvh] flex flex-col p-0 overflow-hidden">
                    <DialogHeader className="p-6 border-b bg-primary/5">
                        <DialogTitle className="text-2xl">{isTakingExam?.title}</DialogTitle>
                        <DialogDescription>Please answer all questions. Your score will be calculated automatically upon submission.</DialogDescription>
                    </DialogHeader>
                    
                    <ScrollArea className="flex-1 p-6 bg-muted/10">
                        <div className="space-y-8 max-w-2xl mx-auto pb-12">
                            {(isTakingExam as any)?.questions?.map((q: any, index: number) => (
                                <div key={index} className="space-y-4 p-6 bg-background rounded-xl border shadow-sm relative">
                                    <Badge className="absolute -top-3 left-4" variant="secondary">Question {index + 1}</Badge>
                                    <p className="text-lg font-medium pt-2">{q.question}</p>
                                    
                                    {q.type === 'mcq' ? (
                                        <RadioGroup onValueChange={(val) => setExamAnswers(prev => ({ ...prev, [index]: val }))} value={examAnswers[index]} className="space-y-3 mt-4">
                                            {q.options?.map((opt: string, i: number) => (
                                                <div key={i} className={cn(
                                                    "flex items-center space-x-3 p-3 rounded-lg border hover:bg-primary/5 transition-colors cursor-pointer",
                                                    examAnswers[index] === opt && "border-primary bg-primary/5"
                                                )}>
                                                    <RadioGroupItem value={opt} id={`exam-q-${index}-opt-${i}`} />
                                                    <Label htmlFor={`exam-q-${index}-opt-${i}`} className="flex-grow cursor-pointer">{opt}</Label>
                                                </div>
                                            ))}
                                        </RadioGroup>
                                    ) : (
                                        <div className="mt-4">
                                            <Label className="text-xs uppercase text-muted-foreground mb-1 block">Your Answer</Label>
                                            <Input 
                                                value={examAnswers[index] || ''} 
                                                onChange={(e) => setExamAnswers(prev => ({ ...prev, [index]: e.target.value }))}
                                                placeholder="Type your answer here..."
                                                className="rounded-lg h-12"
                                            />
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </ScrollArea>

                    <DialogFooter className="p-6 t border-t bg-background">
                        <Button 
                            variant="ghost" 
                            onClick={() => setIsTakingExam(null)} 
                            disabled={isSubmitting}
                        >
                            Cancel
                        </Button>
                        <Button 
                            className="btn-gel px-8 rounded-lg" 
                            onClick={handleSubmitExam} 
                            disabled={isSubmitting || Object.keys(examAnswers).length < ((isTakingExam as any)?.questions?.length || 0)}
                        >
                            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <ClipboardCheck className="mr-2 h-4 w-4" />}
                            Submit Exam
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Results Viewing Dialog */}
            <Dialog open={!!isViewingResults} onOpenChange={(open) => !open && setIsViewingResults(null)}>
                <DialogContent className="sm:max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Exam Results</DialogTitle>
                        <DialogDescription>Only you can see these results.</DialogDescription>
                    </DialogHeader>
                    {isViewingResults && (
                        <div className="space-y-6">
                            <div className="flex justify-between items-center bg-primary/10 p-6 rounded-xl border border-primary/20">
                                <div className="space-y-1">
                                    <p className="text-sm font-medium text-primary">Your Total Score</p>
                                    <p className="text-3xl font-bold">{isViewingResults.score} / {isViewingResults.total}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-sm font-medium text-primary">Percentage</p>
                                    <p className="text-4xl font-black text-primary">{isViewingResults.percentage}%</p>
                                </div>
                            </div>
                            
                            <ScrollArea className="max-h-[50vh] pr-4">
                                <div className="space-y-4">
                                    {isViewingResults.results?.map((res: any, i: number) => (
                                        <div key={i} className={cn(
                                            "p-4 rounded-lg border",
                                            res.isCorrect ? "bg-green-50 border-green-100" : "bg-red-50 border-red-100"
                                        )}>
                                            <p className="font-semibold text-sm mb-3">Q{i+1}: {res.question}</p>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                                                <div className="space-y-1">
                                                    <p className="text-muted-foreground uppercase font-bold">Your Answer</p>
                                                    <p className={cn("font-medium", res.isCorrect ? "text-green-700" : "text-red-700")}>{res.studentAnswer || '(No answer provided)'}</p>
                                                </div>
                                                {!res.isCorrect && (
                                                    <div className="space-y-1">
                                                        <p className="text-muted-foreground uppercase font-bold">Correct Answer</p>
                                                        <p className="font-medium text-green-700">{res.correctAnswer}</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </ScrollArea>
                        </div>
                    )}
                    <DialogFooter>
                        <DialogClose asChild><Button variant="secondary" className="rounded-lg">Close</Button></DialogClose>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
