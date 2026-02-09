'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { ArrowLeft, FileText, CheckCircle2, UserCircle, Download, Printer, Save, Edit3, X, CheckCircle, AlertTriangle, Info, Clock, Loader2, FileDown } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useClassroom } from '@/contexts/ClassroomContext';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import jsPDF from 'jspdf';

export default function ExamResultPage() {
    const { classroomId, examId, studentId } = useParams() as { classroomId: string; examId: string; studentId: string };
    const router = useRouter();
    const { userRole } = useClassroom();
    const { toast } = useToast();
    
    const [exam, setExam] = useState<any>(null);
    const [submission, setSubmission] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isEditing, setIsEditing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    // Editing state for text exams and manual overrides
    const [editResults, setEditResults] = useState<any[]>([]);
    const [editFeedback, setEditFeedback] = useState("");
    const [editScore, setEditScore] = useState("");

    const isTeacher = userRole === 'creator' || userRole === 'teacher';

    useEffect(() => {
        const fetchData = async () => {
            try {
                const examRef = doc(db, 'classrooms', classroomId, 'exams', examId);
                const subRef = doc(db, 'classrooms', classroomId, 'exams', examId, 'submissions', studentId);
                const [eSnap, sSnap] = await Promise.all([getDoc(examRef), getDoc(subRef)]);
                
                if (eSnap.exists()) setExam({ id: eSnap.id, ...eSnap.data() });
                if (sSnap.exists()) {
                    const data = sSnap.data();
                    setSubmission({ id: sSnap.id, ...data });
                    if (data.results) {
                        setEditResults(JSON.parse(JSON.stringify(data.results)));
                    }
                    setEditFeedback(data.feedback || "");
                    setEditScore(data.score?.toString() || "");
                }
            } catch (error) {
                console.error("Fetch result failed:", error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, [classroomId, examId, studentId]);

    const handleSaveEdits = async () => {
        if (!isTeacher || !submission) return;
        setIsSaving(true);
        try {
            const subRef = doc(db, 'classrooms', classroomId, 'exams', examId, 'submissions', studentId);
            
            let finalScore = editScore ? parseInt(editScore) : submission.score;
            let finalPercentage = submission.percentage;

            // Automatically update score if editing a text-based auto-graded exam
            if (exam?.type === 'text') {
                const correctCount = editResults.filter(r => r.isCorrect).length;
                finalScore = correctCount;
                finalPercentage = Math.round((correctCount / editResults.length) * 100);
            }

            const updateData: any = {
                feedback: editFeedback,
                score: finalScore,
                percentage: finalPercentage,
                updatedAt: serverTimestamp()
            };

            if (exam?.type === 'text') {
                updateData.results = editResults;
            }

            await updateDoc(subRef, updateData);
            
            // Refresh local state
            setSubmission(prev => ({ ...prev, ...updateData }));
            setIsEditing(false);
            toast({ title: "Assessment Updated Successfully" });
        } catch (error) {
            console.error("Save failed:", error);
            toast({ variant: 'destructive', title: "Save Failed", description: "You might not have permission to edit this submission." });
        } finally {
            setIsSaving(false);
        }
    };

    const handleDownloadPDF = () => {
        if (!submission || !exam) return;

        const doc = new jsPDF();
        const margin = 20;
        let y = 20;

        // Title
        doc.setFontSize(22);
        doc.setTextColor(50, 205, 50); // Primary color
        doc.text("TeachMeet Exam Result", margin, y);
        y += 15;

        // Candidate Info
        doc.setFontSize(12);
        doc.setTextColor(100);
        doc.text(`Candidate: ${submission.studentName}`, margin, y);
        y += 8;
        doc.text(`Exam: ${exam.title}`, margin, y);
        y += 15;

        // Score Card
        doc.setFillColor(245, 245, 245);
        doc.rect(margin, y, 170, 30, 'F');
        doc.setTextColor(0);
        doc.setFontSize(14);
        doc.text("Assessment Summary", margin + 5, y + 10);
        doc.setFontSize(12);
        doc.text(`Score: ${submission.score} / ${submission.total || 100}`, margin + 5, y + 20);
        doc.text(`Grade: ${submission.percentage ?? 0}%`, margin + 100, y + 20);
        y += 40;

        // Feedback
        if (submission.feedback) {
            doc.setFontSize(14);
            doc.text("Teacher Feedback:", margin, y);
            y += 8;
            doc.setFontSize(11);
            doc.setTextColor(80);
            const splitFeedback = doc.splitTextToSize(`"${submission.feedback}"`, 170);
            doc.text(splitFeedback, margin, y);
            y += (splitFeedback.length * 6) + 15;
        }

        // Questions (if available)
        if (exam.type === 'text' && submission.results) {
            doc.setFontSize(14);
            doc.setTextColor(0);
            doc.text("Detailed breakdown:", margin, y);
            y += 10;

            submission.results.forEach((res: any, i: number) => {
                if (y > 270) {
                    doc.addPage();
                    y = 20;
                }
                doc.setFontSize(10);
                doc.setTextColor(0);
                doc.text(`${i + 1}. ${res.question}`, margin, y);
                y += 6;
                // Fix: pass separate RGB values instead of an array
                const r = res.isCorrect ? 0 : 200;
                const g = res.isCorrect ? 150 : 0;
                const b = 0;
                doc.setTextColor(r, g, b);
                doc.text(`   Status: ${res.isCorrect ? 'Correct' : 'Incorrect'}`, margin, y);
                y += 5;
                doc.setTextColor(100);
                doc.text(`   Student Answer: ${res.studentAnswer || 'N/A'}`, margin, y);
                y += 5;
                doc.text(`   Correct Answer: ${res.correctAnswer}`, margin, y);
                y += 10;
            });
        }

        doc.save(`${submission.studentName}_${exam.title}_Result.pdf`);
        toast({ title: "Report Downloaded", description: "Exam result has been saved to your device." });
    };

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

    const isExamEnded = exam?.endDate?.toDate() < new Date();

    // Guard: If not teacher and exam is still active, block result access
    if (!isTeacher && !isExamEnded) {
        return (
            <div className="container mx-auto p-4 md:p-8 flex flex-col items-center justify-center h-full min-h-[600px] space-y-6 text-center animate-in fade-in zoom-in duration-300">
                <div className="h-24 w-24 rounded-full bg-primary/10 flex items-center justify-center">
                    <Clock className="h-12 w-12 text-primary animate-pulse" />
                </div>
                <div className="space-y-2">
                    <h2 className="text-3xl font-bold tracking-tight text-foreground">Results Pending</h2>
                    <p className="text-muted-foreground max-w-md mx-auto">
                        This exam session is still active. To maintain exam integrity, detailed results and checked papers are released only once the session ends.
                    </p>
                </div>
                <div className="p-4 bg-muted/50 rounded-xl border border-border/50 max-w-xs w-full">
                    <p className="text-[10px] uppercase font-bold text-muted-foreground mb-1 tracking-widest">Release Time</p>
                    <p className="text-sm font-semibold">{exam?.endDate?.toDate().toLocaleString([], { dateStyle: 'long', timeStyle: 'short' })}</p>
                </div>
                <Button onClick={() => router.back()} variant="outline" className="rounded-xl px-8 h-12">
                    <ArrowLeft className="mr-2 h-4 w-4" /> Return to Classroom
                </Button>
            </div>
        );
    }

    const displayUrl = submission.checkedUrl || submission.submissionUrl || "https://www.africau.edu/images/default/sample.pdf";
    const isPdf = displayUrl.toLowerCase().includes('.pdf') || displayUrl.includes('sample.pdf');
    const isTextExam = exam?.type === 'text';

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
                    {isTeacher && (
                        isEditing ? (
                            <>
                                <Button variant="outline" size="sm" onClick={() => setIsEditing(false)} disabled={isSaving} className="rounded-lg">
                                    <X className="mr-2 h-4 w-4" /> Cancel
                                </Button>
                                <Button size="sm" onClick={handleSaveEdits} disabled={isSaving} className="btn-gel rounded-lg">
                                    {isSaving ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                                    Save Changes
                                </Button>
                            </>
                        ) : (
                            <Button variant="outline" size="sm" onClick={() => setIsEditing(true)} className="rounded-lg">
                                <Edit3 className="mr-2 h-4 w-4" /> Edit Grading
                            </Button>
                        )
                    )}
                    <Button variant="outline" size="sm" onClick={handleDownloadPDF} className="rounded-lg">
                        <FileDown className="mr-2 h-4 w-4" /> Download to Device
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => window.print()} className="hidden md:flex rounded-lg">
                        <Printer className="mr-2 h-4 w-4" /> Print
                    </Button>
                    {!isTextExam && (
                        <Button asChild size="sm" className="btn-gel rounded-lg">
                            <a href={displayUrl} target="_blank" rel="noreferrer">
                                <Download className="mr-2 h-4 w-4"/> Download Paper
                            </a>
                        </Button>
                    )}
                </div>
            </header>

            <main className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6 min-h-0 overflow-hidden">
                <div className="lg:col-span-2 flex flex-col gap-4 overflow-hidden h-full">
                    <Card className="flex-1 flex flex-col overflow-hidden shadow-lg border-border/50">
                        <CardHeader className="py-3 border-b bg-muted/20 flex flex-row items-center justify-between">
                            <CardTitle className="text-sm flex items-center gap-2">
                                <FileText className="h-4 w-4 text-primary" />
                                {isTextExam ? "Exam Paper & Responses" : (submission.checkedUrl ? "Checked Answer Sheet" : "Student Submission")}
                            </CardTitle>
                            {submission.checkedUrl && <Badge className="bg-primary/20 text-primary border-none">Graded & Marked</Badge>}
                        </CardHeader>
                        <CardContent className="flex-1 p-0 overflow-auto bg-white relative">
                            {isTextExam ? (
                                <div className="p-6 space-y-8 max-w-3xl mx-auto">
                                    {isEditing && (
                                        <div className="bg-primary/5 border border-primary/20 p-4 rounded-xl flex items-start gap-3 mb-6">
                                            <Info className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                                            <p className="text-xs text-primary/80 leading-relaxed">
                                                <b>Teacher Edit Mode:</b> You can manually override the "Correct/Incorrect" status for each question. Student answers are read-only.
                                            </p>
                                        </div>
                                    )}
                                    {(isEditing ? editResults : submission.results || []).map((res: any, i: number) => (
                                        <div key={i} className={cn(
                                            "p-6 rounded-2xl border transition-all relative",
                                            res.isCorrect ? "bg-green-50/30 border-green-100" : "bg-red-50/30 border-red-100"
                                        )}>
                                            <div className="flex justify-between items-start gap-4 mb-4">
                                                <div className="flex items-center gap-3">
                                                    <span className={cn(
                                                        "flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold shadow-sm",
                                                        res.isCorrect ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                                                    )}>
                                                        {i + 1}
                                                    </span>
                                                    <p className="text-lg font-bold leading-tight text-foreground">{res.question}</p>
                                                </div>
                                                {isEditing ? (
                                                    <Button 
                                                        size="sm" 
                                                        variant={res.isCorrect ? "default" : "destructive"}
                                                        className="h-8 rounded-full px-4 text-[10px] uppercase font-black"
                                                        onClick={() => {
                                                            const next = [...editResults];
                                                            next[i].isCorrect = !next[i].isCorrect;
                                                            setEditResults(next);
                                                        }}
                                                    >
                                                        {res.isCorrect ? "Correct" : "Incorrect"}
                                                    </Button>
                                                ) : (
                                                    res.isCorrect ? <CheckCircle className="h-6 w-6 text-green-600" /> : <X className="h-6 w-6 text-red-600" />
                                                )}
                                            </div>

                                            <div className="grid grid-cols-1 gap-4 ml-11">
                                                <div className="space-y-1.5">
                                                    <Label className="text-[10px] text-muted-foreground uppercase font-black tracking-widest">Student Answer</Label>
                                                    <div className={cn(
                                                        "font-medium text-base p-4 rounded-xl border shadow-sm",
                                                        res.isCorrect ? "bg-white text-green-800 border-green-100" : "bg-white text-red-800 border-red-100"
                                                    )}>
                                                        {res.studentAnswer || <span className="italic opacity-30">No response provided</span>}
                                                    </div>
                                                </div>
                                                
                                                <div className="space-y-1.5 opacity-80">
                                                    <Label className="text-[10px] text-green-600 uppercase font-black tracking-widest">Marked Correct Answer</Label>
                                                    <p className="font-bold text-sm text-green-700 bg-green-50/50 p-3 rounded-lg border border-green-100/50">
                                                        {res.correctAnswer}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="w-full h-full min-h-[600px] flex flex-col">
                                    {isPdf ? (
                                        <iframe 
                                            src={`${displayUrl}#toolbar=0&navpanes=0`} 
                                            className="w-full flex-grow border-none block" 
                                            title="Answer Sheet Viewer" 
                                        />
                                    ) : (
                                        <div className="p-4 flex-grow overflow-auto bg-muted/5 flex items-center justify-center">
                                            <img src={displayUrl} className="max-w-full h-auto rounded-lg shadow-md border" alt="Exam Paper" />
                                        </div>
                                    )}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                <aside className="lg:col-span-1 space-y-6 overflow-y-auto pr-1">
                    <Card className="shadow-lg border-primary/10 overflow-hidden sticky top-0">
                        <CardHeader className="bg-primary/5 border-b py-4">
                            <CardTitle className="text-lg">Assessment Overview</CardTitle>
                        </CardHeader>
                        <CardContent className="pt-6 space-y-6">
                            <div className="flex justify-between items-end bg-muted/30 p-4 rounded-xl border">
                                <div>
                                    <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider mb-1">Score</p>
                                    {isEditing && !isTextExam ? (
                                        <div className="flex items-center gap-1">
                                            <Input 
                                                type="number" 
                                                value={editScore} 
                                                onChange={(e) => setEditScore(e.target.value)} 
                                                className="w-16 h-8 text-xl font-black p-1"
                                            />
                                            <span className="text-xl font-black">/ {submission.total || '100'}</span>
                                        </div>
                                    ) : (
                                        <p className="text-3xl font-black">
                                            {isEditing && isTextExam ? editResults.filter(r => r.isCorrect).length : (submission.score != null ? submission.score : 'N/A')} 
                                            <span className="text-muted-foreground font-normal text-sm ml-1">/ {submission.total || (isTextExam ? editResults.length : '100')}</span>
                                        </p>
                                    )}
                                </div>
                                <div className="text-right">
                                    <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider mb-1">Grade (%)</p>
                                    <p className="text-5xl font-black text-primary leading-none">
                                        {isEditing && isTextExam 
                                            ? Math.round((editResults.filter(r => r.isCorrect).length / editResults.length) * 100) 
                                            : (submission.percentage ?? submission.grade ?? 0)}%
                                    </p>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label className="text-xs text-muted-foreground uppercase font-bold px-1">Evaluation & Feedback</Label>
                                {isEditing ? (
                                    <Textarea 
                                        value={editFeedback} 
                                        onChange={(e) => setEditFeedback(e.target.value)} 
                                        placeholder="Enter constructive feedback for the student..."
                                        className="min-h-[150px] rounded-xl resize-none italic text-sm border-primary/20"
                                    />
                                ) : (
                                    <div className="p-4 bg-primary/5 rounded-xl border border-primary/10 italic text-sm text-foreground/80 leading-relaxed min-h-[100px]">
                                        {submission.feedback ? `"${submission.feedback}"` : "The teacher has not provided detailed feedback yet."}
                                    </div>
                                )}
                            </div>

                            <div className="pt-4 border-t space-y-4">
                                <div className="flex items-center gap-3">
                                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                        <UserCircle className="h-6 w-6 text-primary" />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-[10px] text-muted-foreground uppercase font-bold">Candidate</p>
                                        <p className="font-semibold truncate">{submission.studentName}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="h-10 w-10 rounded-full bg-secondary/10 flex items-center justify-center shrink-0">
                                        <CheckCircle2 className="h-6 w-6 text-secondary" />
                                    </div>
                                    <div>
                                        <p className="text-[10px] text-muted-foreground uppercase font-bold">Submitted At</p>
                                        <p className="font-semibold text-xs">
                                            {submission.submittedAt?.toDate ? submission.submittedAt.toDate().toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : 'Pending'}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                        {isEditing && (
                            <CardFooter className="bg-primary/5 border-t p-4 flex flex-col gap-2">
                                <Button onClick={handleSaveEdits} disabled={isSaving} className="w-full btn-gel h-12 rounded-xl text-lg">
                                    {isSaving ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                                    Finalize Grading
                                </Button>
                                <p className="text-[10px] text-primary/70 text-center font-medium">Results will be visible to the student once the exam session ends.</p>
                            </CardFooter>
                        )}
                    </Card>
                </aside>
            </main>
        </div>
    );
}
