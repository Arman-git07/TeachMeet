'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db, storage } from '@/lib/firebase';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useAuth } from '@/hooks/useAuth';
import { useClassroom } from '@/contexts/ClassroomContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from '@/components/ui/badge';
import { Loader2, ArrowLeft, FileText, CheckCircle } from 'lucide-react';

export default function TakeExamPage() {
    const { classroomId, examId } = useParams() as { classroomId: string; examId: string };
    const { user } = useAuth();
    const { toast } = useToast();
    const router = useRouter();

    const [exam, setExam] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [examAnswers, setExamAnswers] = useState<Record<number, string>>({});
    const [currentTime, setCurrentTime] = useState(new Date());
    const [hasSubmitted, setHasSubmitted] = useState(false);

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        if (!classroomId || !examId || !user) return;

        const fetchData = async () => {
            try {
                // Check if already submitted
                const subRef = doc(db, 'classrooms', classroomId, 'exams', examId, 'submissions', user.uid);
                const subSnap = await getDoc(subRef);
                if (subSnap.exists()) {
                    setHasSubmitted(true);
                }

                // Get exam details
                const examRef = doc(db, 'classrooms', classroomId, 'exams', examId);
                const examSnap = await getDoc(examRef);
                if (examSnap.exists()) {
                    setExam({ id: examSnap.id, ...examSnap.data() });
                } else {
                    toast({ variant: 'destructive', title: "Error", description: "Exam not found." });
                    router.back();
                }
            } catch (error) {
                console.error("Fetch failed:", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, [classroomId, examId, user, toast, router]);

    const handleSubmitBuiltIn = async () => {
        if (!exam || !user || !classroomId) return;
        setIsSubmitting(true);

        try {
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

            const percentage = Math.round((score / questions.length) * 100);

            await setDoc(doc(db, 'classrooms', classroomId, 'exams', examId, 'submissions', user.uid), {
                studentId: user.uid,
                studentName: user.displayName || 'Anonymous',
                submittedAt: serverTimestamp(),
                score,
                total: questions.length,
                percentage,
                results
            });

            toast({ title: "Exam Submitted Successfully!" });
            router.replace(`/dashboard/classrooms/${classroomId}`);
        } catch (error) {
            toast({ variant: 'destructive', title: "Submission Failed" });
        } finally {
            setIsSubmitting(false);
        }
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

            await setDoc(doc(db, 'classrooms', classroomId, 'exams', examId, 'submissions', user.uid), {
                studentId: user.uid,
                studentName: user.displayName || 'Anonymous',
                submittedAt: serverTimestamp(),
                submissionUrl: url,
                storagePath: path,
                grade: null,
                feedback: null
            });

            toast({ title: "Answers Uploaded Successfully!" });
            router.replace(`/dashboard/classrooms/${classroomId}`);
        } catch (error) {
            toast({ variant: 'destructive', title: "Upload Failed" });
        } finally {
            setIsSubmitting(false);
        }
    };

    if (isLoading) return <div className="h-full flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
    
    if (hasSubmitted) return (
        <div className="h-full flex flex-col items-center justify-center p-8 text-center space-y-4">
            <CheckCircle className="h-16 w-16 text-primary" />
            <h1 className="text-2xl font-bold">Already Submitted</h1>
            <p className="text-muted-foreground">You have already completed this exam.</p>
            <Button onClick={() => router.back()}>Go Back</Button>
        </div>
    );

    const start = exam.startDate?.toDate();
    const end = exam.endDate?.toDate();
    const isLive = start && end && currentTime >= start && currentTime <= end;

    if (!isLive) return (
        <div className="h-full flex flex-col items-center justify-center p-8 text-center space-y-4">
            <h1 className="text-2xl font-bold">Exam Not Active</h1>
            <p className="text-muted-foreground">This exam is either upcoming or has already ended.</p>
            <Button onClick={() => router.back()}>Go Back</Button>
        </div>
    );

    return (
        <div className="container mx-auto p-4 md:p-8 flex flex-col h-full bg-background overflow-hidden">
            <header className="flex items-center justify-between mb-6 shrink-0">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full">
                        <ArrowLeft />
                    </Button>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">{exam.title}</h1>
                        <p className="text-sm text-muted-foreground">Deadline: {end?.toLocaleString()}</p>
                    </div>
                </div>
            </header>

            <main className="flex-1 min-h-0">
                <ScrollArea className="h-full pr-4">
                    {exam.type === 'file' ? (
                        <div className="space-y-6 max-w-3xl mx-auto pb-12">
                            <Card className="p-6">
                                <h3 className="font-bold flex items-center gap-2 mb-4"><FileText className="h-5 w-5 text-primary" /> Question Paper</h3>
                                <Button asChild className="w-full btn-gel">
                                    <a href={exam.fileUrl} target="_blank" rel="noreferrer">Download / View Paper</a>
                                </Button>
                            </Card>
                            <Card className="p-6">
                                <h3 className="font-bold mb-2">Your Answer Sheet</h3>
                                <p className="text-sm text-muted-foreground mb-4">Upload your handwritten or typed answers here.</p>
                                <form onSubmit={handleFileUploadSubmission} className="space-y-4">
                                    <Input type="file" required disabled={isSubmitting} />
                                    <Button type="submit" className="w-full" disabled={isSubmitting}>
                                        {isSubmitting ? <Loader2 className="animate-spin mr-2 h-4 w-4"/> : "Upload & Submit"}
                                    </Button>
                                </form>
                            </Card>
                        </div>
                    ) : (
                        <div className="space-y-8 max-w-3xl mx-auto pb-12">
                            {exam.questions?.map((q: any, index: number) => (
                                <div key={index} className="space-y-4 p-6 bg-background rounded-xl border shadow-sm relative">
                                    <Badge className="absolute -top-3 left-4" variant="secondary">Question {index + 1}</Badge>
                                    <p className="text-lg font-medium pt-2">{q.question}</p>
                                    {q.type === 'mcq' ? (
                                        <RadioGroup onValueChange={(val) => setExamAnswers(prev => ({ ...prev, [index]: val }))} value={examAnswers[index]} className="space-y-3 mt-4">
                                            {q.options?.map((opt: string, i: number) => (
                                                <div key={i} className="flex items-center space-x-3 p-3 rounded-lg border hover:bg-primary/5 cursor-pointer">
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
                                                placeholder="Type answer here..."
                                                className="rounded-lg h-12"
                                            />
                                        </div>
                                    )}
                                </div>
                            ))}
                            <Button 
                                className="w-full btn-gel h-12 text-lg rounded-xl" 
                                onClick={handleSubmitBuiltIn} 
                                disabled={isSubmitting || Object.keys(examAnswers).length < (exam.questions?.length || 0)}
                            >
                                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : "Submit All Answers"}
                            </Button>
                        </div>
                    )}
                </ScrollArea>
            </main>
        </div>
    );
}
