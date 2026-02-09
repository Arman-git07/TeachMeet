'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ArrowLeft, FileText, CheckCircle2, UserCircle, Download, Printer } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

export default function ExamResultPage() {
    const { classroomId, examId, studentId } = useParams() as { classroomId: string; examId: string; studentId: string };
    const router = useRouter();
    
    const [exam, setExam] = useState<any>(null);
    const [submission, setSubmission] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const examRef = doc(db, 'classrooms', classroomId, 'exams', examId);
                const subRef = doc(db, 'classrooms', classroomId, 'exams', examId, 'submissions', studentId);
                const [eSnap, sSnap] = await Promise.all([getDoc(examRef), getDoc(subRef)]);
                
                if (eSnap.exists()) setExam({ id: eSnap.id, ...eSnap.data() });
                if (sSnap.exists()) setSubmission({ id: sSnap.id, ...sSnap.data() });
            } catch (error) {
                console.error("Fetch result failed:", error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, [classroomId, examId, studentId]);

    if (isLoading) {
        return <div className="container mx-auto p-8"><Skeleton className="h-[80vh] w-full rounded-2xl" /></div>;
    }

    if (!submission) {
        return (
            <div className="container mx-auto p-8 flex flex-col items-center justify-center h-full space-y-4">
                <FileText className="h-16 w-16 text-muted-foreground opacity-20" />
                <h2 className="text-xl font-bold">Result Not Found</h2>
                <p className="text-muted-foreground">The requested exam result could not be retrieved.</p>
                <Button onClick={() => router.back()}>Go Back</Button>
            </div>
        );
    }

    const displayUrl = submission.checkedUrl || submission.submissionUrl || "https://www.africau.edu/images/default/sample.pdf";
    const isPdf = displayUrl.toLowerCase().includes('.pdf') || displayUrl.includes('sample.pdf');

    return (
        <div className="container mx-auto p-4 md:p-8 flex flex-col h-full bg-background overflow-hidden">
            <header className="flex items-center justify-between mb-6 shrink-0">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full">
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">Exam Review</h1>
                        <p className="text-sm text-muted-foreground">{exam?.title || 'Exam'} • {submission.studentName}</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => window.print()} className="hidden md:flex rounded-lg">
                        <Printer className="mr-2 h-4 w-4" /> Print
                    </Button>
                    <Button asChild size="sm" className="btn-gel rounded-lg">
                        <a href={displayUrl} target="_blank" rel="noreferrer">
                            <Download className="mr-2 h-4 w-4"/> Download Paper
                        </a>
                    </Button>
                </div>
            </header>

            <main className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6 min-h-0 overflow-hidden">
                <div className="lg:col-span-2 flex flex-col gap-4 overflow-hidden h-full">
                    <Card className="flex-1 flex flex-col overflow-hidden shadow-lg border-border/50">
                        <CardHeader className="py-3 border-b bg-muted/20 flex flex-row items-center justify-between">
                            <CardTitle className="text-sm flex items-center gap-2">
                                <FileText className="h-4 w-4 text-primary" />
                                {submission.checkedUrl ? "Checked Answer Sheet" : "Student Submission"}
                            </CardTitle>
                            {submission.checkedUrl && <Badge className="bg-primary/20 text-primary border-none">Graded & Marked</Badge>}
                        </CardHeader>
                        <CardContent className="flex-1 p-0 overflow-auto bg-white relative">
                            {isPdf ? (
                                <iframe 
                                    src={`${displayUrl}#toolbar=0&navpanes=0`} 
                                    className="w-full h-[3000px] border-none" 
                                    title="Answer Sheet Viewer" 
                                />
                            ) : (
                                <img src={displayUrl} className="max-w-full h-auto mx-auto block" alt="Exam Paper" />
                            )}
                        </CardContent>
                    </Card>
                </div>

                <aside className="lg:col-span-1 space-y-6 overflow-y-auto pr-1">
                    <Card className="shadow-lg border-primary/10 overflow-hidden">
                        <CardHeader className="bg-primary/5 border-b">
                            <CardTitle className="text-lg">Performance Summary</CardTitle>
                        </CardHeader>
                        <CardContent className="pt-6 space-y-6">
                            <div className="flex justify-between items-end bg-muted/30 p-4 rounded-xl border">
                                <div>
                                    <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider mb-1">Score</p>
                                    <p className="text-3xl font-black">{submission.score != null ? `${submission.score} / ${submission.total || '100'}` : 'Final Marks'}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider mb-1">Percentage</p>
                                    <p className="text-5xl font-black text-primary leading-none">{(submission.percentage ?? submission.grade ?? 0)}%</p>
                                </div>
                            </div>

                            {submission.feedback && (
                                <div className="space-y-2">
                                    <Label className="text-xs text-muted-foreground uppercase font-bold px-1">Teacher's Feedback</Label>
                                    <div className="p-4 bg-primary/5 rounded-xl border border-primary/10 italic text-sm text-foreground/80 leading-relaxed">
                                        "{submission.feedback}"
                                    </div>
                                </div>
                            )}

                            <div className="pt-4 border-t space-y-4">
                                <div className="flex items-center gap-3">
                                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                        <UserCircle className="h-6 w-6 text-primary" />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-[10px] text-muted-foreground uppercase font-bold">Student Name</p>
                                        <p className="font-semibold truncate">{submission.studentName}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="h-10 w-10 rounded-full bg-secondary/10 flex items-center justify-center shrink-0">
                                        <CheckCircle2 className="h-6 w-6 text-secondary" />
                                    </div>
                                    <div>
                                        <p className="text-[10px] text-muted-foreground uppercase font-bold">Submission Date</p>
                                        <p className="font-semibold">{submission.submittedAt?.toDate().toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</p>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {submission.results && submission.results.length > 0 && (
                        <Card className="shadow-lg border-border/50">
                            <CardHeader className="border-b bg-muted/10">
                                <CardTitle className="text-lg">Detailed Breakdown</CardTitle>
                            </CardHeader>
                            <CardContent className="pt-4 px-3">
                                <ScrollArea className="max-h-[50vh]">
                                    <div className="space-y-3 pb-2">
                                        {submission.results.map((res: any, i: number) => (
                                            <div key={i} className={cn("p-3 rounded-lg border text-sm transition-colors", res.isCorrect ? "bg-green-50/30 border-green-100" : "bg-red-50/30 border-red-100")}>
                                                <div className="flex items-start gap-2">
                                                    <span className={cn("font-bold mt-0.5", res.isCorrect ? "text-green-600" : "text-red-600")}>Q{i+1}:</span>
                                                    <p className="font-medium leading-tight">{res.question}</p>
                                                </div>
                                                <div className="mt-3 grid grid-cols-1 gap-2 pl-6">
                                                    <div className="bg-background/50 p-2 rounded border border-border/50">
                                                        <p className="text-[10px] text-muted-foreground font-bold uppercase mb-0.5">Your Answer</p>
                                                        <p className={cn("font-medium", res.isCorrect ? "text-green-700" : "text-red-700")}>{res.studentAnswer || '(Not Answered)'}</p>
                                                    </div>
                                                    {!res.isCorrect && (
                                                        <div className="bg-green-100/20 p-2 rounded border border-green-200/50">
                                                            <p className="text-[10px] text-green-600 font-bold uppercase mb-0.5">Correct Answer</p>
                                                            <p className="font-medium text-green-800">{res.correctAnswer}</p>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </ScrollArea>
                            </CardContent>
                        </Card>
                    )}
                </aside>
            </main>
        </div>
    );
}