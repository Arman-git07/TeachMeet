'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db, storage } from '@/lib/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { ArrowLeft, Loader2, Save, FileText, CheckCircle2, UserCircle, Pencil, Eraser, RotateCcw, X, Palette, Maximize, Minimize } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Slider } from '@/components/ui/slider';

interface ExamData {
    title: string;
}

interface SubmissionData {
    studentName: string;
    submissionUrl: string;
    grade?: number | null;
    feedback?: string | null;
    checkedUrl?: string | null;
    percentage?: number | null;
}

interface Point { x: number; y: number; }
interface Path { points: Point[]; color: string; width: number; isEraser: boolean; }

function distToSegment(p: Point, v: Point, w: Point): number {
  const l2 = (v.x - w.x) ** 2 + (v.y - w.y) ** 2;
  if (l2 === 0) return Math.hypot(p.x - v.x, p.y - v.y);
  let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
  t = Math.max(0, Math.min(1, t));
  const projectionX = v.x + t * (w.x - v.x);
  const projectionY = v.y + t * (w.y - v.y);
  return Math.hypot(p.x - projectionX, p.y - projectionY);
}

const ERASER_THRESHOLD = 15;

export default function ExamCheckingPage() {
    const { classroomId, examId, studentId } = useParams() as { classroomId: string; examId: string; studentId: string };
    const router = useRouter();
    const { toast } = useToast();
    const { user } = useAuth();

    const [exam, setExam] = useState<ExamData | null>(null);
    const [submission, setSubmission] = useState<SubmissionData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    const [percentage, setPercentage] = useState<string>("");
    const [feedback, setFeedback] = useState<string>("");

    const [isMarkupMode, setIsMarkupMode] = useState(false);
    const [drawColor, setDrawColor] = useState("#ff0000"); 
    const [penSize, setPenSize] = useState(3);
    const [isEraser, setIsEraser] = useState(false);
    const [isExpanded, setIsExpanded] = useState(false);
    
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);
    const [paths, setPaths] = useState<Path[]>([]);
    const isDrawingRef = useRef(false);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const examRef = doc(db, 'classrooms', classroomId, 'exams', examId);
                const submissionRef = doc(db, 'classrooms', classroomId, 'exams', examId, 'submissions', studentId);

                const [examSnap, submissionSnap] = await Promise.all([
                    getDoc(examRef),
                    getDoc(submissionRef)
                ]);

                if (examSnap.exists()) setExam(examSnap.data() as ExamData);
                if (submissionSnap.exists()) {
                    const data = submissionSnap.data() as SubmissionData;
                    setSubmission(data);
                    setPercentage(data.percentage?.toString() || "");
                    setFeedback(data.feedback || "");
                }
            } catch (error) {
                console.error("Fetch failed:", error);
                toast({ variant: 'destructive', title: "Error loading data" });
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, [classroomId, examId, studentId, toast]);

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
            ctx.moveTo(path.points[0].x, path.points[0].y);
            for (let i = 1; i < path.points.length; i++) {
                ctx.lineTo(path.points[i].x, path.points[i].y);
            }
            ctx.stroke();
        });
    }, [paths]);

    const updateCanvasSize = useCallback(() => {
        const canvas = canvasRef.current;
        const content = contentRef.current;
        if (canvas && content) {
            canvas.width = content.scrollWidth;
            canvas.height = content.scrollHeight;
            redraw();
        }
    }, [redraw]);

    useEffect(() => {
        updateCanvasSize();
        const timer = setTimeout(updateCanvasSize, 1000);
        window.addEventListener('resize', updateCanvasSize);
        return () => {
            window.removeEventListener('resize', updateCanvasSize);
            clearTimeout(timer);
        };
    }, [isMarkupMode, isExpanded, updateCanvasSize]);

    useEffect(() => { redraw(); }, [redraw]);

    const getPointerPos = (e: React.PointerEvent) => {
        const rect = canvasRef.current!.getBoundingClientRect();
        return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };

    const handlePointerDown = (e: React.PointerEvent) => {
        if (!isMarkupMode) return;
        const pos = getPointerPos(e);
        if (isEraser) {
            setPaths(prev => {
                const next = [...prev];
                for (let i = next.length - 1; i >= 0; i--) {
                    const path = next[i];
                    for (let j = 0; j < path.points.length - 1; j++) {
                        if (distToSegment(pos, path.points[j], path.points[j+1]) < ERASER_THRESHOLD) {
                            next.splice(i, 1);
                            return [...next];
                        }
                    }
                }
                return prev;
            });
            return;
        }
        isDrawingRef.current = true;
        setPaths(prev => [...prev, { points: [pos], color: drawColor, width: penSize, isEraser: false }]);
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        if (!isDrawingRef.current || !isMarkupMode || isEraser) return;
        const pos = getPointerPos(e);
        setPaths(prev => {
            const next = [...prev];
            next[next.length - 1].points.push(pos);
            return next;
        });
    };

    const handleSaveMarks = async () => {
        setIsSaving(true);
        try {
            const submissionRef = doc(db, 'classrooms', classroomId, 'exams', examId, 'submissions', studentId);
            let checkedUrl = submission?.checkedUrl || null;
            const canvas = canvasRef.current;

            if (canvas && paths.length > 0) {
                const isPdf = submission?.submissionUrl.toLowerCase().split('?')[0].endsWith('.pdf') || submission?.submissionUrl.includes('sample.pdf');
                
                let blob: Blob | null = null;
                
                if (!isPdf) {
                    // Merging logic for images - flattened markup onto work
                    const offscreen = document.createElement('canvas');
                    offscreen.width = canvas.width;
                    offscreen.height = canvas.height;
                    const ctx = offscreen.getContext('2d');
                    if (ctx) {
                        ctx.fillStyle = 'white';
                        ctx.fillRect(0, 0, offscreen.width, offscreen.height);
                        
                        const img = document.querySelector('img[alt="Submission"]') as HTMLImageElement;
                        if (img && img.complete) {
                            ctx.drawImage(img, 0, 0, offscreen.width, offscreen.height);
                        }
                        ctx.drawImage(canvas, 0, 0);
                        blob = await new Promise<Blob | null>(resolve => offscreen.toBlob(resolve, 'image/png'));
                    }
                } else {
                    // For PDFs, we save the markup layer as a transparent overlay
                    blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));
                }

                if (blob) {
                    const storagePath = `classrooms/${classroomId}/exams/checked/${studentId}-${Date.now()}.png`;
                    const fileRef = ref(storage, storagePath);
                    await uploadBytes(fileRef, blob);
                    checkedUrl = await getDownloadURL(fileRef);
                }
            }

            await updateDoc(submissionRef, {
                percentage: percentage ? parseInt(percentage) : null,
                score: percentage ? parseInt(percentage) : null,
                feedback: feedback || null,
                checkedUrl
            });
            
            toast({ title: "Exam Graded Successfully" });
            router.back();
        } catch (error) {
            console.error("Save failed:", error);
            toast({ variant: 'destructive', title: "Save Failed" });
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) return <div className="p-8"><Skeleton className="h-[80vh] w-full" /></div>;

    const isPdf = submission?.submissionUrl.includes('.pdf') || submission?.submissionUrl.includes('sample.pdf');

    return (
        <div className="container mx-auto p-4 md:p-8 flex flex-col h-full bg-background overflow-hidden">
            <header className="flex items-center justify-between mb-6 shrink-0">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full"><ArrowLeft /></Button>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">Exam Checking</h1>
                        <p className="text-sm text-muted-foreground">{exam?.title} • {submission?.studentName}</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <Button variant={isMarkupMode ? "default" : "outline"} onClick={() => setIsMarkupMode(!isMarkupMode)}>
                        {isMarkupMode ? "Exit Markup" : "Mark up"}
                    </Button>
                    <Button onClick={handleSaveMarks} disabled={isSaving} className="btn-gel">
                        {isSaving ? <Loader2 className="animate-spin mr-2 h-4 w-4"/> : <Save className="mr-2 h-4 w-4"/>}
                        Save Result
                    </Button>
                </div>
            </header>

            <main className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6 min-h-0 overflow-hidden relative">
                <Card className={cn("flex flex-col overflow-hidden shadow-lg", isExpanded ? "absolute inset-0 z-50 bg-background" : "lg:col-span-2 relative")}>
                    <CardHeader className="py-3 border-b bg-muted/20 flex flex-row items-center justify-between">
                        <CardTitle className="text-sm">Answer Sheet</CardTitle>
                        <div className="flex items-center gap-2">
                            {isMarkupMode && (
                                <div className="flex items-center gap-2 bg-background/80 p-1 rounded-lg border mr-2">
                                    <Button size="sm" variant={!isEraser ? "secondary" : "ghost"} onClick={() => setIsEraser(false)}><Pencil className="h-4 w-4" /></Button>
                                    <Button size="sm" variant={isEraser ? "secondary" : "ghost"} onClick={() => setIsEraser(true)}><Eraser className="h-4 w-4" /></Button>
                                    <div className="w-px h-4 bg-border mx-1" />
                                    {["#ff0000", "#000000", "#0000ff"].map(color => (
                                        <button key={color} onClick={() => { setDrawColor(color); setIsEraser(false); }} className={cn("w-5 h-5 rounded-full border", drawColor === color && !isEraser && "ring-2 ring-primary")} style={{ backgroundColor: color }} />
                                    ))}
                                    <Button size="sm" variant="ghost" onClick={() => setPaths([])} className="text-destructive"><RotateCcw className="h-4 w-4" /></Button>
                                </div>
                            )}
                            <Button variant="ghost" size="icon" onClick={() => setIsExpanded(!isExpanded)}>{isExpanded ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}</Button>
                        </div>
                    </CardHeader>
                    <CardContent className="flex-1 p-0 overflow-auto bg-muted/10 relative">
                        <div className={cn("relative min-w-full inline-block", isMarkupMode && "cursor-crosshair")} ref={contentRef}>
                            {isPdf ? (
                                <iframe src={`${submission?.submissionUrl}#toolbar=0`} className="w-full h-[2000px] border-none" title="Submission" />
                            ) : (
                                <img src={submission?.submissionUrl} className="max-w-full h-auto block" alt="Submission" onLoad={updateCanvasSize} />
                            )}
                            <canvas ref={canvasRef} className="absolute top-0 left-0 z-10 touch-none" onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={() => { isDrawingRef.current = false; }} />
                        </div>
                    </CardContent>
                </Card>

                {!isExpanded && (
                    <aside className="lg:col-span-1 space-y-6 overflow-y-auto">
                        <Card className="shadow-lg">
                            <CardHeader><CardTitle className="text-lg">Marks & Feedback</CardTitle></CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-2">
                                    <Label>Final Score (%)</Label>
                                    <Input type="number" placeholder="Enter percentage..." value={percentage} onChange={(e) => setPercentage(e.target.value)} className="text-2xl font-bold h-12" />
                                </div>
                                <div className="space-y-2">
                                    <Label>Feedback</Label>
                                    <Textarea placeholder="Constructive comments..." className="min-h-[150px] rounded-xl" value={feedback} onChange={(e) => setFeedback(e.target.value)} />
                                </div>
                            </CardContent>
                        </Card>
                    </aside>
                )}
            </main>
        </div>
    );
}