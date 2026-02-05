'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { ArrowLeft, Loader2, BrainCircuit, Save, FileText, CheckCircle2, UserCircle, Pencil, Eraser, RotateCcw, Palette, X, Settings2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { gradeAssignment, GradeAssignmentInput } from '@/ai/flows/grade-assignment-flow';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Slider } from '@/components/ui/slider';

interface AssignmentData {
    title: string;
    answerKeyUrl?: string;
}

interface SubmissionData {
    studentName: string;
    submissionUrl: string;
    grade?: number | null;
    feedback?: string | null;
}

interface Point { x: number; y: number; }
interface Path { points: Point[]; color: string; width: number; isEraser: boolean; }

export default function CheckingPage() {
    const { classroomId, assignmentId, studentId } = useParams() as { classroomId: string; assignmentId: string; studentId: string };
    const router = useRouter();
    const { toast } = useToast();
    const { user } = useAuth();

    const [assignment, setAssignment] = useState<AssignmentData | null>(null);
    const [submission, setSubmission] = useState<SubmissionData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isAIGrading, setIsAiGrading] = useState(false);

    const [score, setScore] = useState<string>("");
    const [feedback, setFeedback] = useState<string>("");

    // Drawing State
    const [isMarkupMode, setIsMarkupMode] = useState(false);
    const [drawColor, setDrawColor] = useState("#ef4444"); // Red for corrections
    const [penSize, setPenSize] = useState(3);
    const [isEraser, setIsEraser] = useState(false);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [paths, setPaths] = useState<Path[]>([]);
    const isDrawingRef = useRef(false);

    const isDemo = studentId === 'demo-student';

    useEffect(() => {
        if (isDemo) {
            setAssignment({ title: "Demo Assignment" });
            setSubmission({
                studentName: "Demo Student",
                submissionUrl: "https://picsum.photos/seed/doc/800/1200",
                grade: null,
                feedback: ""
            });
            setIsLoading(false);
            return;
        }

        const fetchData = async () => {
            try {
                const assignmentRef = doc(db, 'classrooms', classroomId, 'assignments', assignmentId);
                const submissionRef = doc(db, 'classrooms', classroomId, 'assignments', assignmentId, 'submissions', studentId);

                const [assignmentSnap, submissionSnap] = await Promise.all([
                    getDoc(assignmentRef),
                    getDoc(submissionSnap)
                ]);

                if (assignmentSnap.exists()) {
                    setAssignment(assignmentSnap.data() as AssignmentData);
                }
                if (submissionSnap.exists()) {
                    const data = submissionSnap.data() as SubmissionData;
                    setSubmission(data);
                    setScore(data.grade?.toString() || "");
                    setFeedback(data.feedback || "");
                }
            } catch (error) {
                console.error("Fetch failed:", error);
                toast({ variant: 'destructive', title: "Error", description: "Failed to load submission data." });
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, [classroomId, assignmentId, studentId, isDemo, toast]);

    // Canvas Logic
    const redraw = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        paths.forEach(path => {
            if (path.points.length < 2) return;
            ctx.beginPath();
            ctx.strokeStyle = path.color;
            ctx.lineWidth = path.width;
            ctx.globalCompositeOperation = path.isEraser ? 'destination-out' : 'source-over';
            ctx.moveTo(path.points[0].x, path.points[0].y);
            for (let i = 1; i < path.points.length; i++) {
                ctx.lineTo(path.points[i].x, path.points[i].y);
            }
            ctx.stroke();
        });
    }, [paths]);

    useEffect(() => {
        if (isMarkupMode) {
            const handleResize = () => {
                const canvas = canvasRef.current;
                const container = containerRef.current;
                if (canvas && container) {
                    canvas.width = container.clientWidth;
                    canvas.height = container.clientHeight;
                    redraw();
                }
            };
            handleResize();
            window.addEventListener('resize', handleResize);
            return () => window.removeEventListener('resize', handleResize);
        }
    }, [isMarkupMode, redraw]);

    useEffect(() => {
        redraw();
    }, [redraw]);

    const getPointerPos = (e: React.PointerEvent | PointerEvent) => {
        const canvas = canvasRef.current;
        if (!canvas) return { x: 0, y: 0 };
        const rect = canvas.getBoundingClientRect();
        return {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
    };

    const handlePointerDown = (e: React.PointerEvent) => {
        if (!isMarkupMode) return;
        isDrawingRef.current = true;
        const pos = getPointerPos(e);
        const newPath: Path = {
            points: [pos],
            color: drawColor,
            width: isEraser ? 20 : penSize,
            isEraser
        };
        setPaths(prev => [...prev, newPath]);
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        if (!isDrawingRef.current || !isMarkupMode) return;
        const pos = getPointerPos(e);
        setPaths(prev => {
            const newPaths = [...prev];
            const currentPath = newPaths[newPaths.length - 1];
            currentPath.points.push(pos);
            return newPaths;
        });
    };

    const handlePointerUp = () => {
        isDrawingRef.current = false;
    };

    const handleManualSave = async () => {
        if (isDemo) {
            toast({ title: "Demo Mode", description: "Changes are not saved in demo mode." });
            return;
        }
        setIsSaving(true);
        try {
            const submissionRef = doc(db, 'classrooms', classroomId, 'assignments', assignmentId, 'submissions', studentId);
            await updateDoc(submissionRef, {
                grade: score ? parseInt(score) : null,
                feedback: feedback || null
            });
            toast({ title: "Grade Saved Successfully" });
        } catch (error) {
            toast({ variant: 'destructive', title: "Save Failed" });
        } finally {
            setIsSaving(false);
        }
    };

    const handleAICheck = async () => {
        if (isDemo) {
            setIsAiGrading(true);
            setTimeout(() => {
                setScore("85");
                setFeedback("Excellent work on the demo assignment! Clear structure and correct logic throughout.");
                setIsAiGrading(false);
                toast({ title: "AI Grading Complete (Demo)" });
            }, 2000);
            return;
        }

        if (!assignment?.answerKeyUrl || !submission?.submissionUrl) {
            toast({ variant: 'destructive', title: "Missing Data", description: "Answer key or submission file is missing for AI check." });
            return;
        }

        setIsAiGrading(true);
        try {
            const [keyRes, subRes] = await Promise.all([fetch(assignment.answerKeyUrl), fetch(submission.submissionUrl)]);
            const [keyBlob, subBlob] = await Promise.all([keyRes.blob(), subRes.blob()]);

            const fileToUri = (file: Blob): Promise<string> => new Promise((resolve) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result as string);
                reader.readAsDataURL(file);
            });

            const result = await gradeAssignment({
                teacherAssignmentDataUri: await fileToUri(keyBlob),
                studentSubmissionDataUri: await fileToUri(subBlob)
            });

            setScore(result.score.toString());
            setFeedback(result.feedback);
            toast({ title: "AI Grading Complete", description: `Scored ${result.score}/100` });
        } catch (error) {
            toast({ variant: 'destructive', title: "AI Grading Failed" });
        } finally {
            setIsAiGrading(false);
        }
    };

    if (isLoading) {
        return (
            <div className="container mx-auto p-4 space-y-6">
                <Skeleton className="h-12 w-48" />
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <Skeleton className="lg:col-span-2 h-[80vh] rounded-xl" />
                    <Skeleton className="h-96 rounded-xl" />
                </div>
            </div>
        );
    }

    return (
        <div className="container mx-auto p-4 md:p-8 flex flex-col h-full overflow-hidden">
            <header className="flex items-center justify-between mb-6 shrink-0">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full">
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">Checking Page</h1>
                        <p className="text-sm text-muted-foreground">{assignment?.title} • {submission?.studentName}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Button 
                        variant={isMarkupMode ? "default" : "outline"} 
                        onClick={() => setIsMarkupMode(!isMarkupMode)}
                        className="rounded-lg"
                    >
                        {isMarkupMode ? <X className="mr-2 h-4 w-4" /> : <Pencil className="mr-2 h-4 w-4" />}
                        {isMarkupMode ? "Exit Markup" : "Mark up"}
                    </Button>
                    {(assignment?.answerKeyUrl || isDemo) && (
                        <Button 
                            variant="secondary" 
                            className="rounded-lg"
                            onClick={handleAICheck}
                            disabled={isAIGrading}
                        >
                            {isAIGrading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <BrainCircuit className="mr-2 h-4 w-4" />}
                            AI Check
                        </Button>
                    )}
                    <Button onClick={handleManualSave} disabled={isSaving} className="btn-gel rounded-lg">
                        {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4" />}
                        Save Grade
                    </Button>
                </div>
            </header>

            <main className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6 min-h-0 overflow-hidden">
                <Card className="lg:col-span-2 flex flex-col overflow-hidden shadow-lg border-border/50 relative">
                    <CardHeader className="py-3 border-b bg-muted/20 flex flex-row items-center justify-between">
                        <CardTitle className="text-sm flex items-center gap-2">
                            <FileText className="h-4 w-4 text-primary" />
                            Submitted Work
                        </CardTitle>
                        {isMarkupMode && (
                            <div className="flex items-center gap-2 bg-background/80 p-1 rounded-lg border border-primary/20 backdrop-blur-sm">
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button 
                                            size="sm" 
                                            variant={!isEraser ? "secondary" : "ghost"} 
                                            className="h-8 w-8 p-0 rounded-md"
                                            onClick={() => setIsEraser(false)}
                                            title="Pen settings"
                                        >
                                            <Pencil className="h-4 w-4" />
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-48 p-3" side="bottom" align="start">
                                        <div className="space-y-3">
                                            <div className="flex justify-between items-center">
                                                <Label className="text-xs font-semibold uppercase text-muted-foreground">Pen Size</Label>
                                                <span className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded">{penSize}px</span>
                                            </div>
                                            <Slider 
                                                value={[penSize]} 
                                                onValueChange={(val) => setPenSize(val[0])} 
                                                min={1} 
                                                max={20} 
                                                step={1} 
                                                className="py-2"
                                            />
                                        </div>
                                    </PopoverContent>
                                </Popover>
                                <Button 
                                    size="sm" 
                                    variant={isEraser ? "secondary" : "ghost"} 
                                    className="h-8 w-8 p-0 rounded-md"
                                    onClick={() => setIsEraser(true)}
                                    title="Eraser"
                                >
                                    <Eraser className="h-4 w-4" />
                                </Button>
                                <div className="w-px h-4 bg-border mx-1" />
                                {["#ef4444", "#3b82f6", "#22c55e"].map(color => (
                                    <button 
                                        key={color}
                                        onClick={() => { setDrawColor(color); setIsEraser(false); }}
                                        className={cn(
                                            "w-5 h-5 rounded-full border border-black/10 transition-transform hover:scale-110",
                                            drawColor === color && !isEraser && "ring-2 ring-primary ring-offset-1"
                                        )}
                                        style={{ backgroundColor: color }}
                                    />
                                ))}
                                <div className="w-px h-4 bg-border mx-1" />
                                <Button 
                                    size="sm" 
                                    variant="ghost" 
                                    className="h-8 w-8 p-0 rounded-md text-destructive"
                                    onClick={() => setPaths([])}
                                    title="Clear marks"
                                >
                                    <RotateCcw className="h-4 w-4" />
                                </Button>
                            </div>
                        )}
                    </CardHeader>
                    <CardContent ref={containerRef} className="flex-1 p-0 overflow-hidden bg-muted/10 relative">
                        <div className={cn("w-full h-full", isMarkupMode && "pointer-events-none")}>
                            {isDemo ? (
                                <div className="w-full h-full flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
                                    <img 
                                        src={submission?.submissionUrl} 
                                        alt="Demo Submission" 
                                        className="max-w-full max-h-full object-contain rounded-lg shadow-md mb-4"
                                        data-ai-hint="student work"
                                    />
                                    <p className="text-sm font-medium">This is a simulated student submission for checking.</p>
                                </div>
                            ) : (
                                <iframe 
                                    src={submission?.submissionUrl} 
                                    className="w-full h-full border-none"
                                    title="Submission Preview"
                                />
                            )}
                        </div>
                        
                        <canvas 
                            ref={canvasRef}
                            className={cn(
                                "absolute inset-0 z-10 touch-none",
                                isMarkupMode ? "cursor-crosshair opacity-100" : "pointer-events-none opacity-0"
                            )}
                            onPointerDown={handlePointerDown}
                            onPointerMove={handlePointerMove}
                            onPointerUp={handlePointerUp}
                            onPointerLeave={handlePointerUp}
                        />
                    </CardContent>
                </Card>

                <aside className="space-y-6 overflow-y-auto pr-1">
                    <Card className="shadow-lg border-border/50">
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                                <CheckCircle2 className="h-5 w-5 text-primary" />
                                Assignment Details
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <Label className="text-xs text-muted-foreground uppercase tracking-wider">Assignment Title</Label>
                                <p className="font-semibold">{assignment?.title}</p>
                            </div>
                            <div className="flex items-center gap-3 pt-2 border-t">
                                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                                    <UserCircle className="h-6 w-6 text-primary" />
                                </div>
                                <div>
                                    <Label className="text-xs text-muted-foreground uppercase tracking-wider">Student Name</Label>
                                    <p className="font-medium">{submission?.studentName}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="shadow-lg border-border/50">
                        <CardHeader>
                            <CardTitle className="text-lg">Grading & Feedback</CardTitle>
                            <CardDescription>Enter the final score and constructive comments.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="score">Final Score (0-100)</Label>
                                <div className="relative">
                                    <Input 
                                        id="score"
                                        type="number"
                                        placeholder="e.g. 85"
                                        value={score}
                                        onChange={(e) => setScore(e.target.value)}
                                        className="text-2xl font-bold h-12 pr-12 rounded-lg"
                                    />
                                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">/ 100</span>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="feedback">Feedback</Label>
                                <Textarea 
                                    id="feedback"
                                    placeholder="Provide detailed feedback for the student..."
                                    className="min-h-[150px] rounded-xl resize-none"
                                    value={feedback}
                                    onChange={(e) => setFeedback(e.target.value)}
                                />
                            </div>
                        </CardContent>
                        <CardFooter className="bg-muted/10 border-t py-4">
                            <p className="text-[10px] text-muted-foreground italic">
                                Note: Once saved, the student will be notified and can view their results immediately.
                            </p>
                        </CardFooter>
                    </Card>
                </aside>
            </main>
        </div>
    );
}
