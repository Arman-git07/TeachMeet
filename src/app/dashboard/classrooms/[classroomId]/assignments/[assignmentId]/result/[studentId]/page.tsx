'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ArrowLeft, FileText, CheckCircle2, UserCircle, Download, FileDown, Clock, Info } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { useClassroom } from '@/contexts/ClassroomContext';
import { useToast } from '@/hooks/use-toast';

export default function AssignmentResultPage() {
    const { classroomId, assignmentId, studentId } = useParams() as { classroomId: string; assignmentId: string; studentId: string };
    const router = useRouter();
    const { userRole } = useClassroom();
    const { toast } = useToast();
    
    const [assignment, setAssignment] = useState<any>(null);
    const [submission, setSubmission] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);

    const isDemo = studentId === 'demo-student';

    useEffect(() => {
        const fetchData = async () => {
            if (isDemo) {
                setAssignment({ title: "Demo: History Essay", dueDate: Timestamp.fromDate(new Date('2024-01-01')) });
                setSubmission({
                    studentName: "Demo Student",
                    submissionUrl: "https://www.africau.edu/images/default/sample.pdf",
                    checkedUrl: "https://picsum.photos/seed/checked/800/1200", // Sample flattened check
                    grade: 92,
                    feedback: "Great analysis of the French Revolution! Your points on the social causes were very well-argued.",
                    submittedAt: Timestamp.fromDate(new Date('2023-12-31'))
                });
                setIsLoading(false);
                return;
            }

            try {
                const assignRef = doc(db, 'classrooms', classroomId, 'assignments', assignmentId);
                const subRef = doc(db, 'classrooms', classroomId, 'assignments', assignmentId, 'submissions', studentId);
                const [aSnap, sSnap] = await Promise.all([getDoc(assignRef), getDoc(subRef)]);
                
                if (aSnap.exists()) setAssignment({ id: aSnap.id, ...aSnap.data() });
                if (sSnap.exists()) setSubmission({ id: sSnap.id, ...sSnap.data() });
            } catch (error) {
                console.error("Fetch result failed:", error);
                toast({ variant: 'destructive', title: "Fetch Failed", description: "Could not load assignment result." });
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, [classroomId, assignmentId, studentId, isDemo, toast]);

    if (isLoading) {
        return <div className="container mx-auto p-8"><Skeleton className="h-[80vh] w-full rounded-2xl" /></div>;
    }

    if (!submission) {
        return (
            <div className="container mx-auto p-8 flex flex-col items-center justify-center h-full space-y-4">
                <FileText className="h-16 w-16 text-muted-foreground opacity-20" />
                <h2 className="text-xl font-bold">Result Not Found</h2>
                <p className="text-muted-foreground">The requested assignment result could not be retrieved.</p>
                <Button onClick={() => router.back()}>Go Back</Button>
            </div>
        );
    }

    const isPdf = submission.submissionUrl.toLowerCase().split('?')[0].endsWith('.pdf') || submission.submissionUrl.includes('africau.edu');
    const displayUrl = submission.checkedUrl || submission.submissionUrl;

    return (
        <div className="container mx-auto p-4 md:p-8 flex flex-col h-full bg-background overflow-hidden">
            <header className="flex items-center justify-between mb-6 shrink-0">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full">
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">Assignment Review</h1>
                        <p className="text-sm text-muted-foreground">{assignment?.title || 'Assignment'} • {submission.studentName}</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <Button asChild variant="outline" size="sm" className="rounded-lg">
                        <a href={submission.submissionUrl} target="_blank" rel="noreferrer">
                            <Download className="mr-2 h-4 w-4"/> Original Work
                        </a>
                    </Button>
                    <Button asChild size="sm" className="btn-gel rounded-lg">
                        <a href={displayUrl} target="_blank" rel="noreferrer">
                            <FileDown className="mr-2 h-4 w-4"/> Download Graded Paper
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
                                {submission.checkedUrl ? "Graded & Checked Paper" : "Student Submission"}
                            </CardTitle>
                            {submission.checkedUrl && <Badge className="bg-primary/20 text-primary border-primary/20">Checked & Marked</Badge>}
                        </CardHeader>
                        <CardContent className="flex-1 p-0 overflow-auto bg-white relative">
                            {/* Layered Viewer for PDFs or single viewer for Images */}
                            <div className="w-full h-full min-h-[600px] flex flex-col relative">
                                {isPdf ? (
                                    <div className="w-full h-full relative" style={{ height: '8000px' }}>
                                        {/* Base Layer: The PDF */}
                                        <iframe 
                                            src={`${submission.submissionUrl}#toolbar=0&navpanes=0`} 
                                            className="w-full h-full border-none block absolute inset-0 z-0" 
                                            title="PDF Viewer" 
                                        />
                                        {/* Overlay Layer: The Teacher's Markups */}
                                        {submission.checkedUrl && (
                                            <img 
                                                src={submission.checkedUrl} 
                                                className="w-full h-full block absolute inset-0 z-10 pointer-events-none mix-blend-multiply" 
                                                alt="Teacher Markups" 
                                            />
                                        )}
                                    </div>
                                ) : (
                                    <div className="p-4 flex-grow overflow-auto bg-muted/5 flex items-center justify-center">
                                        <img 
                                            src={displayUrl} 
                                            className="max-w-full h-auto rounded-lg shadow-md border" 
                                            alt="Graded Assignment" 
                                        />
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <aside className="lg:col-span-1 space-y-6 overflow-y-auto pr-1">
                    <Card className="shadow-lg border-primary/10 overflow-hidden sticky top-0">
                        <CardHeader className="bg-primary/5 border-b py-4">
                            <CardTitle className="text-lg">Assessment Summary</CardTitle>
                        </CardHeader>
                        <CardContent className="pt-6 space-y-6">
                            <div className="flex justify-between items-end bg-muted/30 p-4 rounded-xl border">
                                <div>
                                    <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider mb-1">Score</p>
                                    <p className="text-3xl font-black">
                                        {submission.grade != null ? submission.grade : 'N/A'} 
                                        <span className="text-muted-foreground font-normal text-sm ml-1">/ 100</span>
                                    </p>
                                </div>
                                <div className="text-right">
                                    <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider mb-1">Status</p>
                                    <Badge className={cn("text-lg font-bold px-4 py-1", submission.grade != null ? "bg-primary text-white" : "bg-muted text-muted-foreground")}>
                                        {submission.grade != null ? "Graded" : "Pending"}
                                    </Badge>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label className="text-xs text-muted-foreground uppercase font-bold px-1">Teacher Feedback</Label>
                                <div className="p-4 bg-primary/5 rounded-xl border border-primary/10 italic text-sm text-foreground/80 leading-relaxed min-h-[100px]">
                                    {submission.feedback ? `"${submission.feedback}"` : "No specific feedback provided."}
                                </div>
                            </div>

                            <div className="pt-4 border-t space-y-4">
                                <div className="flex items-center gap-3">
                                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                        <UserCircle className="h-6 w-6 text-primary" />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-[10px] text-muted-foreground uppercase font-bold">Student</p>
                                        <p className="font-semibold truncate">{submission.studentName}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="h-10 w-10 rounded-full bg-secondary/10 flex items-center justify-center shrink-0">
                                        <Clock className="h-6 w-6 text-secondary" />
                                    </div>
                                    <div>
                                        <p className="text-[10px] text-muted-foreground uppercase font-bold">Submitted At</p>
                                        <p className="font-semibold text-xs">
                                            {submission.submittedAt?.toDate ? submission.submittedAt.toDate().toLocaleString() : 'N/A'}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                    
                    <Card className="bg-muted/30 border-dashed">
                        <CardContent className="p-4 flex gap-3 items-start">
                            <Info className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                            <p className="text-xs text-muted-foreground leading-relaxed">
                                {isPdf 
                                    ? "This is a PDF submission. Teacher markups are overlaid on your original document. Scroll down to see all pages."
                                    : "This was an image submission. The teacher's markups have been flattened onto your work."
                                }
                            </p>
                        </CardContent>
                    </Card>
                </aside>
            </main>
        </div>
    );
}

// Simple Timestamp polyfill for demo mode
const Timestamp = {
    fromDate: (date: Date) => ({ toDate: () => date })
};
