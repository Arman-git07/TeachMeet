'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { doc, setDoc, serverTimestamp, onSnapshot } from 'firebase/firestore';
import { db, storage } from '@/lib/firebase';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from '@/components/ui/badge';
import { Loader2, ArrowLeft, FileText, CheckCircle, AlertTriangle, Clock, Upload, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError, type SecurityRuleContext } from '@/firebase/errors';

export default function TakeExamPage() {
    const { classroomId, examId } = useParams() as { classroomId: string; examId: string };
    const { user } = useAuth();
    const { toast } = useToast();
    const router = useRouter();

    const [exam, setExam] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [examAnswers, setExamAnswers] = useState<Record<number, string>>({});
    const [currentTime, setCurrentTime] = useState<Date | null>(null);
    const [hasSubmitted, setHasSubmitted] = useState(false);
    const [fetchError, setFetchError] = useState<string | null>(null);

    useEffect(() => {
        // Initialize clock on client only to prevent hydration mismatch
        setCurrentTime(new Date());
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        if (!classroomId || !examId || !user) return;

        setIsLoading(true);
        setFetchError(null);

        // 1. Listen for submission status - Real-time protection against re-takes
        const subRef = doc(db, 'classrooms', classroomId, 'exams', examId, 'submissions', user.uid);
        const unsubSub = onSnapshot(subRef, (docSnap) => {
            if (docSnap.exists()) {
                setHasSubmitted(true);
            }
        }, (err) => {
            console.error("Submission check failed:", err);
        });

        // 2. Listen for exam details
        const examRef = doc(db, 'classrooms', classroomId, 'exams', examId);
        const unsubExam = onSnapshot(examRef, (docSnap) => {
            if (docSnap.exists()) {
                setExam({ id: docSnap.id, ...docSnap.data() });
                setFetchError(null);
            } else {
                // EXAM DELETED
                toast({ title: "Exam Unavailable", description: "The exam has been removed by the teacher." });
                router.replace(`/dashboard/classrooms/${classroomId}`);
            }
            setIsLoading(false);
        }, (err) => {
            console.error("Exam load failed:", err);
            setFetchError("Missing or insufficient permissions. Please ensure you are logged in and enrolled.");
            setIsLoading(false);
        });

        return () => {
            unsubSub();
            unsubExam();
        };
    }, [classroomId, examId, user, router, toast]);

    // Handle redirection for ended exams in real-time
    useEffect(() => {
        if (!exam || !currentTime || !classroomId || hasSubmitted) return;

        const start = exam.startDate?.toDate();
        const end = exam.endDate?.toDate();

        if (start && end) {
            if (currentTime < start) {
                toast({ title: "Session Not Started", description: "This exam is scheduled for later." });
                router.replace(`/dashboard/classrooms/${classroomId}`);
            } else if (currentTime > end) {
                toast({ title: "Time's Up!", description: "The exam session has ended." });
                router.replace(`/dashboard/classrooms/${classroomId}`);
            }
        }
    }, [exam, currentTime, classroomId, router, toast, hasSubmitted]);

    const handleSubmitBuiltIn = () => {
        if (!exam || !user || !classroomId) return;
        setIsSubmitting(true);

        const questions = exam.questions || [];
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

        const percentage = questions.length > 0 ? Math.round((score / questions.length) * 100) : 0;
        const subRef = doc(db, 'classrooms', classroomId, 'exams', examId, 'submissions', user.uid);
        const subData = {
            studentId: user.uid,
            studentName: user.displayName || 'Anonymous',
            submittedAt: serverTimestamp(),
            score,
            total: questions.length,
            percentage,
            results
        };

        setDoc(subRef, subData)
            .catch(async (error) => {
                const pError = new FirestorePermissionError({
                    path: subRef.path,
                    operation: 'create',
                    requestResourceData: subData
                });
                errorEmitter.emit('permission-error', pError);
            });

        toast({ title: "Exam Submitted Successfully!" });
        router.replace(`/dashboard/classrooms/${classroomId}`);
    };

    const handleFileUploadSubmission = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!user || !classroomId || !exam) return;
        const fileInput = e.currentTarget.querySelector('input[type="file"]') as HTMLInputElement;
        const file = fileInput?.files?.[0];
        if (!file) return;

        setIsSubmitting(true);
        try {
            const path = `classrooms/${classroomId}/exams/submissions/${examId}/${user.uid}-${file.name}`;
            const fileRef = storageRef(storage, path);
            const snapshot = await uploadBytes(fileRef, file);
            const url = await getDownloadURL(snapshot.ref);

            const subRef = doc(db, 'classrooms', classroomId, 'exams', examId, 'submissions', user.uid);
            const subData = {
                studentId: user.uid,
                studentName: user.displayName || 'Anonymous',
                submittedAt: serverTimestamp(),
                submissionUrl: url,
                storagePath: path,
                grade: null,
                feedback: null
            };

            setDoc(subRef, subData)
                .catch(async (error) => {
                    const pError = new FirestorePermissionError({
                        path: subRef.path,
                        operation: 'create',
                        requestResourceData: subData
                    });
                    errorEmitter.emit('permission-error', pError);
                });

            toast({ title: "Answers Uploaded Successfully!" });
            router.replace(`/dashboard/classrooms/${classroomId}`);
        } catch (error) {
            toast({ variant: 'destructive', title: "Upload Failed" });
            setIsSubmitting(false);
        }
    };

    const handleSkipQuestion = (index: number) => {
        setExamAnswers(prev => {
            const next = { ...prev };
            delete next[index];
            return next;
        });
    };

    if (isLoading || !currentTime) {
        return (
            <div className="h-full flex flex-col items-center justify-center space-y-4">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground animate-pulse">Entering exam room...</p>
            </div>
        );
    }

    if (fetchError) {
        return (
            <div className="h-full flex flex-col items-center justify-center p-8 text-center space-y-6">
                <AlertTriangle className="h-16 w-16 text-destructive opacity-50" />
                <div className="space-y-2">
                    <h1 className="text-2xl font-bold">Unable to Load Exam</h1>
                    <p className="text-muted-foreground max-w-md">{fetchError}</p>
                </div>
                <Button onClick={() => router.replace(`/dashboard/classrooms/${classroomId}`)} variant="outline">
                    <ArrowLeft className="mr-2 h-4 w-4" /> Return to Classroom
                </Button>
            </div>
        );
    }
    
    // Strict block for students who have already submitted
    if (hasSubmitted) {
        return (
            <div className="h-full flex flex-col items-center justify-center p-8 text-center space-y-6">
                <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center">
                    <CheckCircle className="h-12 w-12 text-primary" />
                </div>
                <div className="space-y-2">
                    <h1 className="text-3xl font-bold">Exam Completed</h1>
                    <p className="text-muted-foreground">You have already submitted your response for this assessment.</p>
                </div>
                <Button onClick={() => router.replace(`/dashboard/classrooms/${classroomId}`)} className="rounded-xl px-8">Return to Classroom</Button>
            </div>
        );
    }

    if (!exam || !exam.startDate || !exam.endDate) {
        return (
            <div className="h-full flex flex-col items-center justify-center p-8 text-center space-y-4">
                <h1 className="text-2xl font-bold">Error</h1>
                <p className="text-muted-foreground">Invalid exam configuration.</p>
                <Button onClick={() => router.replace(`/dashboard/classrooms/${classroomId}`)}>Go Back</Button>
            </div>
        );
    }

    const end = exam.endDate.toDate();

    return (
        <div className="container mx-auto p-4 md:p-8 flex flex-col h-full bg-background overflow-hidden">
            <header className="flex items-center justify-between mb-6 shrink-0">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full">
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <div className="min-w-0">
                        <h1 className="text-xl md:text-2xl font-bold tracking-tight truncate">{exam.title}</h1>
                        <p className="text-xs md:text-sm text-muted-foreground flex items-center gap-1.5">
                            <Clock className="h-3.5 w-3.5" /> 
                            Ends: {end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                    </div>
                </div>
                <Badge className="bg-green-500 hover:bg-green-500 animate-pulse hidden sm:inline-flex">Live Session</Badge>
            </header>

            <main className="flex-1 min-h-0">
                <ScrollArea className="h-full pr-4">
                    {exam.type === 'file' ? (
                        <div className="space-y-6 max-w-3xl mx-auto pb-12 pt-6">
                            <Card className="p-6 shadow-lg border-primary/10">
                                <h3 className="font-bold flex items-center gap-2 mb-4">
                                    <FileText className="h-5 w-5 text-primary" /> 
                                    Question Paper
                                </h3>
                                <Button asChild className="w-full btn-gel h-12 text-lg rounded-xl">
                                    <a href={exam.fileUrl} target="_blank" rel="noreferrer">Download / View Paper</a>
                                </Button>
                            </Card>
                            <Card className="p-6 shadow-lg border-primary/10">
                                <h3 className="font-bold mb-2">Your Answer Sheet</h3>
                                <p className="text-sm text-muted-foreground mb-6">Upload your handwritten or typed answers here before the deadline.</p>
                                <form onSubmit={handleFileUploadSubmission} className="space-y-4">
                                    <div className="p-4 border-2 border-dashed rounded-xl bg-muted/30 text-center hover:bg-muted/50 transition-colors cursor-pointer relative">
                                        <Input type="file" required disabled={isSubmitting} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                                        <Upload className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
                                        <p className="text-sm font-medium">Click or drag your file here to upload</p>
                                        <p className="text-xs text-muted-foreground mt-1">PDF or Image preferred</p>
                                    </div>
                                    <Button type="submit" className="w-full h-12 text-lg rounded-xl btn-gel" disabled={isSubmitting}>
                                        {isSubmitting ? <Loader2 className="animate-spin mr-2 h-5 w-5"/> : "Upload & Finalize Submission"}
                                    </Button>
                                </form>
                            </Card>
                        </div>
                    ) : (
                        <div className="space-y-10 max-w-3xl mx-auto pb-12 pt-10">
                            {exam.questions?.length > 0 ? exam.questions.map((q: any, index: number) => (
                                <div key={index} className="space-y-4 p-6 bg-card rounded-xl border shadow-sm relative group hover:border-primary/30 transition-colors">
                                    <Badge className="absolute -top-3 left-4 px-3 py-1 shadow-md bg-secondary text-secondary-foreground" variant="secondary">
                                        Question {index + 1}
                                    </Badge>
                                    
                                    <div className="flex justify-between items-start gap-4">
                                        <p className="text-lg font-medium pt-2 leading-relaxed flex-1">{q.question}</p>
                                        <Button 
                                            variant="outline" 
                                            size="sm" 
                                            className="h-8 text-[10px] uppercase font-bold tracking-wider rounded-lg text-muted-foreground hover:text-destructive hover:border-destructive transition-colors"
                                            onClick={() => handleSkipQuestion(index)}
                                            title="Clear answer and skip this question"
                                        >
                                            <Trash2 className="h-3 w-3 mr-1.5" /> Skip
                                        </Button>
                                    </div>

                                    {q.type === 'mcq' ? (
                                        <RadioGroup 
                                            onValueChange={(val) => setExamAnswers(prev => ({ ...prev, [index]: val }))} 
                                            value={examAnswers[index] || ""} 
                                            className="space-y-3 mt-4"
                                        >
                                            {q.options?.filter((opt: string) => opt && opt.trim() !== "").map((opt: string, i: number) => (
                                                <div key={i} className={cn(
                                                    "flex items-center space-x-3 p-4 rounded-lg border transition-all cursor-pointer",
                                                    examAnswers[index] === opt ? "bg-primary/5 border-primary ring-1 ring-primary" : "hover:bg-muted/50"
                                                )}>
                                                    <RadioGroupItem value={opt} id={`exam-q-${index}-opt-${i}`} className="h-5 w-5" />
                                                    <Label htmlFor={`exam-q-${index}-opt-${i}`} className="flex-grow cursor-pointer text-base font-normal">{opt}</Label>
                                                </div>
                                            ))}
                                        </RadioGroup>
                                    ) : (
                                        <div className="mt-4">
                                            <Label className="text-xs uppercase text-muted-foreground mb-2 block font-bold tracking-wider">Your Response</Label>
                                            <Input 
                                                value={examAnswers[index] || ''} 
                                                onChange={(e) => setExamAnswers(prev => ({ ...prev, [index]: e.target.value }))}
                                                placeholder="Type your answer here..."
                                                className="rounded-lg h-14 text-base focus:ring-primary shadow-inner"
                                            />
                                        </div>
                                    )}
                                </div>
                            )) : (
                                <div className="text-center py-12 text-muted-foreground">
                                    <p>No questions found in this exam.</p>
                                </div>
                            )}
                            <Button 
                                className="w-full btn-gel h-14 text-xl rounded-2xl shadow-xl hover:shadow-primary/20 transition-all mt-8" 
                                onClick={handleSubmitBuiltIn} 
                                disabled={isSubmitting}
                            >
                                {isSubmitting ? <Loader2 className="mr-2 h-6 w-6 animate-spin"/> : "Submit All Answers"}
                            </Button>
                            
                            <p className="text-center text-xs text-muted-foreground animate-pulse">
                                Skipped questions will be marked as incorrect. You can return to any question before submitting.
                            </p>
                        </div>
                    )}
                </ScrollArea>
            </main>
        </div>
    );
}