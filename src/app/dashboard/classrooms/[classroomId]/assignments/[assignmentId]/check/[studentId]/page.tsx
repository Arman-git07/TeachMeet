'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db, storage } from '@/lib/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { ArrowLeft, Loader2, Save, FileText, CheckCircle2, UserCircle, Pencil, Eraser, RotateCcw, X, Palette, Maximize, Minimize, Eye } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Slider } from '@/components/ui/slider';
import Link from 'next/link';

interface AssignmentData {
    title: string;
    answerKeyUrl?: string;
    maxScore?: number;
}

interface SubmissionData {
    studentName: string;
    submissionUrl: string;
    grade?: number | null;
    feedback?: string | null;
    checkedUrl?: string | null;
}

interface Point { x: number; y: number; }
interface Path { points: Point[]; color: string; width: number; isEraser: boolean; }

// Helper function to calculate distance from point p to segment vw
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

export default function CheckingPage() {
    const { classroomId, assignmentId, studentId } = useParams() as { classroomId: string; assignmentId: string; studentId: string };
    const router = useRouter();
    const { toast } = useToast();
    const { user } = useAuth();

    const [assignment, setAssignment] = useState<AssignmentData | null>(null);
    const [submission, setSubmission] = useState<SubmissionData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    const [score, setScore] = useState<string>("");
    const [maxScore, setMaxScore] = useState<string>("100");
    const [feedback, setFeedback] = useState<string>("");

    // Drawing State
    const [isMarkupMode, setIsMarkupMode] = useState(false);
    const [drawColor, setDrawColor] = useState("#ff0000"); // Standard red for checking
    const [penSize, setPenSize] = useState(3);
    const [isEraser, setIsEraser] = useState(false);
    const [isExpanded, setIsExpanded] = useState(false);
    
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);
    const [paths, setPaths] = useState<Path[]>([]);
    const isDrawingRef = useRef(false);

    const isDemo = studentId === 'demo-student';

    useEffect(() => {
        if (isDemo) {
            setAssignment({ title: "Demo Assignment", maxScore: 100 });
            setSubmission({
                studentName: "Demo Student",
                submissionUrl: "https://www.africau.edu/images/default/sample.pdf", 
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
                    getDoc(submissionRef)
                ]);

                if (assignmentSnap.exists()) {
                    const aData = assignmentSnap.data() as AssignmentData;
                    setAssignment(aData);
                    if (aData.maxScore) setMaxScore(aData.maxScore.toString());
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
            ctx.globalCompositeOperation = 'source-over';
            ctx.moveTo(path.points[0].x, path.points[0].y);
            for (let i = 1; i < path.points.length; i++) {
                ctx.lineTo(path.points[i].x, path.points[i].y);
            }
            ctx.stroke();
        });
    }, [paths]);

    // Handle resizing of canvas to match the scrollable content
    const updateCanvasSize = useCallback(() => {
        const canvas = canvasRef.current;
        const content = contentRef.current;
        if (canvas && content) {
            // Match the canvas to the actual scroll height/width of the content
            canvas.width = content.scrollWidth;
            canvas.height = content.scrollHeight;
            redraw();
        }
    }, [redraw]);

    useEffect(() => {
        updateCanvasSize();
        // Multiple timers to handle slow loading iframes/images
        const timer1 = setTimeout(updateCanvasSize, 500);
        const timer2 = setTimeout(updateCanvasSize, 2000);
        window.addEventListener('resize', updateCanvasSize);
        return () => {
            window.removeEventListener('resize', updateCanvasSize);
            clearTimeout(timer1);
            clearTimeout(timer2);
        };
    }, [isMarkupMode, isExpanded, updateCanvasSize]);

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
        const pos = getPointerPos(e);

        if (isEraser) {
            setPaths(prev => {
                const next = [...prev];
                let deletedAny = false;
                for (let i = next.length - 1; i >= 0; i--) {
                    const path = next[i];
                    for (let j = 0; j < path.points.length - 1; j++) {
                        if (distToSegment(pos, path.points[j], path.points[j+1]) < ERASER_THRESHOLD + path.width / 2) {
                            next.splice(i, 1);
                            deletedAny = true;
                            break;
                        }
                    }
                    if (deletedAny) break;
                }
                return deletedAny ? [...next] : prev;
            });
            return;
        }

        isDrawingRef.current = true;
        const newPath: Path = {
            points: [pos],
            color: drawColor,
            width: penSize,
            isEraser: false
        };
        setPaths(prev => [...prev, newPath]);
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        if (!isDrawingRef.current || !isMarkupMode || isEraser) return;
        const pos = getPointerPos(e);
        setPaths(prev => {
            const newPaths = [...prev];
            const currentPath = newPaths[newPaths.length - 1];
            if (currentPath) {
                currentPath.points.push(pos);
            }
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
            const assignmentRef = doc(db, 'classrooms', classroomId, 'assignments', assignmentId);
            
            let checkedUrl = submission?.checkedUrl || null;
            const canvas = canvasRef.current;

            // Save and flatten markup if it exists
            if (canvas && paths.length > 0) {
                const isPdf = submission?.submissionUrl.toLowerCase().split('?')[0].endsWith('.pdf') || submission?.submissionUrl.includes('africau.edu');
                
                let blob: Blob | null = null;
                
                if (!isPdf) {
                    // Merging logic for images
                    const offscreen = document.createElement('canvas');
                    offscreen.width = canvas.width;
                    offscreen.height = canvas.height;
                    const ctx = offscreen.getContext('2d');
                    if (ctx) {
                        ctx.fillStyle = 'white';
                        ctx.fillRect(0, 0, offscreen.width, offscreen.height);
                        
                        const img = document.querySelector('img[data-ai-hint="student work"]') as HTMLImageElement;
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
                    const storagePath = `classrooms/${classroomId}/assignments/${assignmentId}/checked/${studentId}-${Date.now()}.png`;
                    const fileRef = ref(storage, storagePath);
                    await uploadBytes(fileRef, blob);
                    checkedUrl = await getDownloadURL(fileRef);
                }
            }

            const updateData: any = {
                grade: score ? parseInt(score) : null,
                feedback: feedback || null
            };
            if (checkedUrl) updateData.checkedUrl = checkedUrl;
            
            await Promise.all([
                updateDoc(submissionRef, updateData),
                updateDoc(assignmentRef, {
                    maxScore: maxScore ? parseInt(maxScore) : 100
                })
            ]);
            
            toast({ title: "Marks Saved Successfully" });
        } catch (error) {
            console.error("Save failed:", error);
            toast({ variant: 'destructive', title: "Save Failed" });
        } finally {
            setIsSaving(false);
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

    const isPdf = submission?.submissionUrl.toLowerCase().split('?')[0].endsWith('.pdf') || submission?.submissionUrl.includes('africau.edu');

    return (
        <div className="container mx-auto p-4 md:p-8 flex flex-col h-full overflow-hidden bg-background">
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
                <div className="flex items-center gap-3">
                    <Button asChild variant="outline" className="rounded-lg">
                        <Link href={`/dashboard/classrooms/${classroomId}/assignments/${assignmentId}/result/${studentId}`}>
                            <Eye className="mr-2 h-4 w-4" /> View Result
                        </Link>
                    </Button>
                    <Button 
                        variant={isMarkupMode ? "default" : "outline"} 
                        onClick={() => setIsMarkupMode(!isMarkupMode)}
                        className="rounded-lg"
                    >
                        {isMarkupMode ? <X className="mr-2 h-4 w-4" /> : <Pencil className="mr-2 h-4 w-4" />}
                        {isMarkupMode ? "Exit Markup" : "Mark up"}
                    </Button>
                    <Button onClick={handleManualSave} disabled={isSaving} className="btn-gel rounded-lg">
                        {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                        Save Marks
                    </Button>
                </div>
            </header>

            <main className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6 min-h-0 overflow-hidden relative">
                <Card className={cn(
                    "flex flex-col overflow-hidden shadow-lg border-border/50 transition-all duration-300",
                    isExpanded ? "absolute inset-0 z-50 bg-background" : "lg:col-span-2 relative"
                )}>
                    <CardHeader className="py-3 border-b bg-muted/20 flex flex-row items-center justify-between">
                        <CardTitle className="text-sm flex items-center gap-2">
                            <FileText className="h-4 w-4 text-primary" />
                            Submitted Work
                        </CardTitle>
                        <div className="flex items-center gap-2">
                            {isMarkupMode && (
                                <div className="flex items-center gap-2 bg-background/80 p-1 rounded-lg border border-primary/20 backdrop-blur-sm mr-2">
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
                                    {["#ff0000", "#000000", "#0000ff"].map(color => (
                                        <button 
                                            key={color}
                                            onClick={() => { setDrawColor(color); setIsEraser(false); }}
                                            className={cn(
                                                "w-5 h-5 rounded-full border border-black/10 transition-transform hover:scale-110 shadow-sm",
                                                drawColor === color && !isEraser && "ring-2 ring-primary ring-offset-1"
                                            )}
                                            style={{ backgroundColor: color }}
                                            title={color === '#ff0000' ? 'Red' : color === '#000000' ? 'Black' : 'Blue'}
                                        />
                                    ))}
                                    <div className="relative w-6 h-6 rounded-full border border-black/10 overflow-hidden flex items-center justify-center bg-gradient-to-tr from-red-500 via-green-500 to-blue-500 transition-transform hover:scale-110 shadow-sm" title="Choose custom color">
                                        <input 
                                            type="color" 
                                            value={drawColor}
                                            onChange={(e) => { setDrawColor(e.target.value); setIsEraser(false); }}
                                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                        />
                                        <Palette className="h-3 w-3 text-white pointer-events-none drop-shadow-md" />
                                    </div>
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
                            <Button 
                                variant="ghost" 
                                size="icon" 
                                onClick={() => setIsExpanded(!isExpanded)} 
                                className="h-8 w-8 rounded-md"
                                title={isExpanded ? "Restore view" : "Expand to full area"}
                            >
                                {isExpanded ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent className="flex-1 p-0 overflow-auto bg-muted/10 relative" ref={containerRef}>
                        <div className={cn("relative min-w-full inline-block bg-white", isMarkupMode && "cursor-crosshair")} ref={contentRef}>
                            {isPdf ? (
                                <div className="w-full relative" style={{ height: '8000px' }}>
                                    <iframe 
                                        src={`${submission?.submissionUrl}#toolbar=0&navpanes=0`} 
                                        className="w-full h-full border-none block"
                                        title="Submission Preview"
                                        onLoad={updateCanvasSize}
                                    />
                                    <div className="absolute inset-0 pointer-events-none flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity bg-black/5">
                                        <p className="bg-background/80 px-4 py-2 rounded-full text-xs font-medium shadow-sm border">
                                            Scroll to view more pages. Enable "Mark up" to draw.
                                        </p>
                                    </div>
                                </div>
                            ) : (
                                <img 
                                    src={submission?.submissionUrl} 
                                    className="max-w-full h-auto mx-auto block"
                                    onLoad={updateCanvasSize}
                                    alt="Submission"
                                    data-ai-hint="student work"
                                />
                            )}
                            
                            <canvas 
                                ref={canvasRef}
                                className={cn(
                                    "absolute top-0 left-0 z-10 touch-none",
                                    isMarkupMode ? "opacity-100" : "pointer-events-none opacity-100"
                                )}
                                onPointerDown={handlePointerDown}
                                onPointerMove={handlePointerMove}
                                onPointerUp={handlePointerUp}
                                onPointerLeave={handlePointerUp}
                            />
                        </div>
                    </CardContent>
                </Card>

                {!isExpanded && (
                    <aside className="lg:col-span-1 space-y-6 overflow-y-auto pr-1 animate-in fade-in slide-in-from-right-4 duration-300 h-full">
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
                                    {submission?.studentName && (
                                        <div>
                                            <Label className="text-xs text-muted-foreground uppercase tracking-wider">Student Name</Label>
                                            <p className="font-medium">{submission.studentName}</p>
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="shadow-lg border-border/50">
                            <CardHeader>
                                <CardTitle className="text-lg">Grading & Feedback</CardTitle>
                                <CardDescription>Enter the student's marks and constructive comments.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="score">Marks</Label>
                                    <div className="relative flex items-center">
                                        <Input 
                                            id="score"
                                            type="number"
                                            placeholder="Earned"
                                            value={score}
                                            onChange={(e) => setScore(e.target.value)}
                                            className="text-2xl font-bold h-12 pr-20 rounded-lg"
                                        />
                                        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 text-muted-foreground font-medium">
                                            <span className="text-lg">/</span>
                                            <Input 
                                                type="number"
                                                value={maxScore}
                                                onChange={(e) => setMaxScore(e.target.value)}
                                                className="w-14 h-8 p-1 text-center bg-transparent border-none focus-visible:ring-0 focus-visible:ring-offset-0 font-bold text-lg hover:bg-muted/50 transition-colors rounded"
                                                title="Edit total possible marks"
                                            />
                                        </div>
                                    </div>
                                    <p className="text-[10px] text-muted-foreground">Click the number after the "/" to edit total possible marks.</p>
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
                )}
            </main>
        </div>
    );
}
