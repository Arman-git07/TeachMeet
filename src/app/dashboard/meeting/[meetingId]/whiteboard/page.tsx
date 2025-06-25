
'use client';

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
} from "@/components/ui/alert-dialog";
import { ArrowLeft, Brush, Type, Eraser, Trash2, Undo2, Redo2, Lasso } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import React, { useState, useEffect, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";
import { useDynamicHeader } from '@/contexts/DynamicHeaderContext';

// --- Type Definitions ---
interface Point { x: number; y: number; }
type PathElement = { type: 'path'; id: string; points: Point[]; color: string; lineWidth: number; };
type TextElement = { type: 'text'; id: string; text: string; x: number; y: number; color: string; font: string; width: number; height: number; };
type WhiteboardElement = PathElement | TextElement;
interface WhiteboardState { elements: WhiteboardElement[]; }
interface BoundingBox { minX: number; minY: number; maxX: number; maxY: number; }

// --- Constants ---
const MAX_HISTORY_STEPS = 50;
const ERASER_THRESHOLD = 10; 

// --- Helper Functions ---
function distToSegment(p: Point, v: Point, w: Point): number {
  const l2 = (v.x - w.x) ** 2 + (v.y - w.y) ** 2;
  if (l2 === 0) return Math.hypot(p.x - v.x, p.y - v.y);
  let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
  t = Math.max(0, Math.min(1, t));
  const projectionX = v.x + t * (w.x - v.x);
  const projectionY = v.y + t * (w.y - v.y);
  return Math.hypot(p.x - projectionX, p.y - projectionY);
}

const isPointInRect = (point: Point, rect: BoundingBox) => (point.x >= rect.minX && point.x <= rect.maxX && point.y >= rect.minY && point.y <= rect.maxY);

// --- UI Components ---
const ToolButton = React.memo(({ icon: Icon, label, onClick, isActive = false }: { icon: React.ElementType; label: string; onClick: () => void; isActive?: boolean; }) => (
  <Button variant={isActive ? "default" : "outline"} size="icon" className="rounded-lg w-12 h-12 flex flex-col items-center justify-center text-xs" onClick={onClick} aria-label={label}>
    <Icon className="h-5 w-5 mb-0.5" />
    <span className="text-[10px] leading-tight">{label}</span>
  </Button>
));
ToolButton.displayName = "ToolButton";

const ColorSwatch = React.memo(({ color, onClick, isSelected }: { color: string, onClick: () => void, isSelected: boolean }) => (
  <Button variant="outline" size="icon" className={cn("rounded-full w-8 h-8 border-2", isSelected ? "border-ring ring-2 ring-offset-2 ring-offset-background ring-ring" : "border-muted-foreground/50 hover:border-foreground")} style={{ backgroundColor: color }} onClick={onClick} aria-label={`Select color ${color}`} />
));
ColorSwatch.displayName = "ColorSwatch";


export default function WhiteboardPage() {
  const params = useParams();
  const meetingId = params.meetingId as string;
  const { setHeaderContent } = useDynamicHeader();

  // --- Refs for Canvases & DOM elements ---
  const mainCanvasRef = useRef<HTMLCanvasElement>(null);
  const tempCanvasRef = useRef<HTMLCanvasElement>(null);
  const liveTextInputRef = useRef<HTMLTextAreaElement>(null);

  // --- Core Data State (triggers re-renders) ---
  const [whiteboardState, setWhiteboardState] = useState<WhiteboardState>({ elements: [] });
  
  // --- UI and Tool State ---
  const [activeTool, setActiveTool] = useState<string>("draw");
  const [selectedColor, setSelectedColor] = useState<string>("#000000");
  const [lineWidth, setLineWidth] = useState<number>(5);

  // --- Refs for Live Operations & State Snapshots (do not trigger re-renders) ---
  const operationStateRef = useRef<'idle' | 'drawing' | 'texting' | 'erasing'>('idle');
  const currentPathRef = useRef<Point[] | null>(null);
  const textCursorPosition = useRef<Point | null>(null);

  // --- History State ---
  const historyRef = useRef<WhiteboardState[]>([]);
  const historyStepRef = useRef(-1);

  // --- Font Size Mappings ---
  const getFontSize = () => 16;
  const getFontString = () => `${getFontSize()}px sans-serif`;

  // --- Drawing Functions ---
  const drawElement = (ctx: CanvasRenderingContext2D, element: WhiteboardElement) => {
    if (element.type === 'path') {
      ctx.strokeStyle = element.color;
      ctx.lineWidth = element.lineWidth;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      if(element.points.length > 0) {
        ctx.moveTo(element.points[0].x, element.points[0].y);
        for (let i = 1; i < element.points.length; i++) {
          ctx.lineTo(element.points[i].x, element.points[i].y);
        }
      }
      ctx.stroke();
    } else if (element.type === 'text') {
      ctx.fillStyle = element.color;
      ctx.font = element.font;
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      element.text.split('\n').forEach((line, index) => ctx.fillText(line, element.x, element.y + (index * (getFontSize() * 1.2))));
    }
  };

  const clearCanvas = (ctx: CanvasRenderingContext2D) => ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

  // --- Main Render & Resize Effect ---
  useEffect(() => {
    const mainCanvas = mainCanvasRef.current;
    if (!mainCanvas) return;
    const mainCtx = mainCanvas.getContext('2d');
    if (!mainCtx) return;

    const redrawMainCanvas = () => {
      clearCanvas(mainCtx);
      whiteboardState.elements.forEach(element => drawElement(mainCtx, element));
    };

    const resizeCanvases = () => {
        const { width, height } = mainCanvas.getBoundingClientRect();
        if (mainCanvas.width !== width || mainCanvas.height !== height) {
          mainCanvas.width = width;
          mainCanvas.height = height;
          if (tempCanvasRef.current) {
            tempCanvasRef.current.width = width;
            tempCanvasRef.current.height = height;
          }
          redrawMainCanvas();
        }
    };
      
    resizeCanvases();
    redrawMainCanvas();
    window.addEventListener('resize', resizeCanvases);
    
    return () => window.removeEventListener('resize', resizeCanvases);
  }, [whiteboardState]);

  const pushToHistory = useCallback((state: WhiteboardState) => {
    historyStepRef.current++;
    historyRef.current.splice(historyStepRef.current);
    historyRef.current.push(state);
    if (historyRef.current.length > MAX_HISTORY_STEPS) {
      historyRef.current.shift();
      historyStepRef.current--;
    }
  }, []);

  const handleUndo = () => {
    if (historyStepRef.current > 0) {
      historyStepRef.current--;
      const prevState = historyRef.current[historyStepRef.current];
      setWhiteboardState(prevState);
    }
  };
  const handleRedo = () => {
    if (historyStepRef.current < historyRef.current.length - 1) {
      historyStepRef.current++;
      const nextState = historyRef.current[historyStepRef.current];
      setWhiteboardState(nextState);
    }
  };

  const getPointerPosition = useCallback((event: React.MouseEvent | React.TouchEvent): Point | null => {
      const canvas = tempCanvasRef.current;
      if (!canvas) return null;
      const rect = canvas.getBoundingClientRect();
      const nativeEvent = event.nativeEvent;
      const clientX = 'touches' in nativeEvent ? (nativeEvent.touches[0] || nativeEvent.changedTouches[0]).clientX : (nativeEvent as MouseEvent).clientX;
      const clientY = 'touches' in nativeEvent ? (nativeEvent.touches[0] || nativeEvent.changedTouches[0]).clientY : (nativeEvent as MouseEvent).clientY;
      return { x: clientX - rect.left, y: clientY - rect.top };
  }, []);

  const handleToolClick = (tool: string) => {
    setActiveTool(tool);
    finalizeLiveText();
  };
  
  const finalizeLiveText = useCallback(() => {
    const textInput = liveTextInputRef.current;
    const pos = textCursorPosition.current;
    
    if (!textInput || !pos || operationStateRef.current !== 'texting') {
        if(textInput) {
             textInput.style.display = 'none';
        }
        return;
    }
    
    if (textInput.value.trim()){
        const tempCtx = tempCanvasRef.current?.getContext('2d');
        if(!tempCtx) return;

        const font = getFontString();
        tempCtx.font = font;
        const lines = textInput.value.split('\n');
        const textMetrics = lines.map(line => tempCtx.measureText(line));
        const maxWidth = Math.max(...textMetrics.map(m => m.width));
        const totalHeight = lines.length * (getFontSize() * 1.2);
        
        const newTextElement: TextElement = { type: 'text', id: Date.now().toString(), text: textInput.value, x: pos.x, y: pos.y, color: selectedColor, font, width: maxWidth, height: totalHeight };
        
        setWhiteboardState(prevState => {
           const newState = { elements: [...prevState.elements, newTextElement] };
           pushToHistory(newState);
           return newState;
        });
    }

    textInput.value = '';
    textInput.style.display = 'none';
    operationStateRef.current = 'idle';
    textCursorPosition.current = null;
  }, [selectedColor, pushToHistory, getFontString]);

  // --- Event Handlers ---
  const handlePointerDown = useCallback((event: React.MouseEvent | React.TouchEvent) => {
    if ((event as React.MouseEvent).button !== 0) return;
    const pos = getPointerPosition(event);
    if (!pos) return;

    finalizeLiveText();
    
    if (activeTool === 'draw') {
        operationStateRef.current = 'drawing';
        currentPathRef.current = [pos];
    }
    else if (activeTool === 'text') {
        operationStateRef.current = 'texting';
        textCursorPosition.current = pos;
        if(liveTextInputRef.current) {
            liveTextInputRef.current.style.top = `${pos.y}px`;
            liveTextInputRef.current.style.left = `${pos.x}px`;
            liveTextInputRef.current.style.display = 'block';
            liveTextInputRef.current.style.color = selectedColor;
            liveTextInputRef.current.focus();
        }
    }
    else if (activeTool === 'erase') {
        operationStateRef.current = 'erasing';
    }

  }, [getPointerPosition, activeTool, selectedColor, finalizeLiveText]);

  const handlePointerMove = useCallback((event: React.MouseEvent | React.TouchEvent) => {
    if (operationStateRef.current !== 'drawing') return;
    const pos = getPointerPosition(event);
    const tempCtx = tempCanvasRef.current?.getContext('2d');
    if (!pos || !tempCtx || !currentPathRef.current) return;
    
    currentPathRef.current.push(pos);
    
    clearCanvas(tempCtx);
    const pathElement: PathElement = { type: 'path', id: '', points: currentPathRef.current, color: selectedColor, lineWidth: lineWidth };
    drawElement(tempCtx, pathElement);

  }, [getPointerPosition, selectedColor, lineWidth]);

  const handlePointerUp = useCallback((event: React.MouseEvent | React.TouchEvent) => {
    const tempCtx = tempCanvasRef.current?.getContext('2d');
    if (!tempCtx) return;

    if (operationStateRef.current === 'drawing' && currentPathRef.current && currentPathRef.current.length > 1) {
        const newPath: PathElement = { type: 'path', id: Date.now().toString(), points: currentPathRef.current, color: selectedColor, lineWidth };
        setWhiteboardState(prevState => {
            const newState = { elements: [...prevState.elements, newPath] };
            pushToHistory(newState);
            return newState;
        });
    } else if (operationStateRef.current === 'erasing') {
        const pos = getPointerPosition(event);
        if (!pos) {
            operationStateRef.current = 'idle';
            return;
        }

        let elementToDeleteId: string | null = null;
        
        // Loop backwards to check top-most elements first
        for (let i = whiteboardState.elements.length - 1; i >= 0; i--) {
            const element = whiteboardState.elements[i];
            if (element.type === 'path') {
                for (let j = 0; j < element.points.length - 1; j++) {
                    if (distToSegment(pos, element.points[j], element.points[j + 1]) < ERASER_THRESHOLD) {
                        elementToDeleteId = element.id;
                        break;
                    }
                }
            } else if (element.type === 'text') {
                const box = { minX: element.x, minY: element.y, maxX: element.x + element.width, maxY: element.y + element.height };
                if(isPointInRect(pos, box)) {
                    elementToDeleteId = element.id;
                }
            }
            if (elementToDeleteId) break;
        }

        if (elementToDeleteId) {
            const idToDelete = elementToDeleteId;
            setWhiteboardState(prevState => {
                const newElements = prevState.elements.filter(el => el.id !== idToDelete);
                const newState = { elements: newElements };
                pushToHistory(newState);
                return newState;
            });
        }
    }

    clearCanvas(tempCtx);
    operationStateRef.current = 'idle';
    currentPathRef.current = null;
  }, [getPointerPosition, selectedColor, lineWidth, whiteboardState.elements, pushToHistory]);

  const handleClearWhiteboard = () => { 
    setWhiteboardState({ elements: [] });
    pushToHistory({ elements: [] });
  };

  useEffect(() => {
    // Initial history entry
    pushToHistory({ elements: [] });

    setHeaderContent(
      <div className="flex items-center justify-between w-full">
        <div className="flex items-center gap-3"><Brush className="h-7 w-7 text-primary" /><h1 className="text-xl font-semibold truncate">TeachMeet Whiteboard</h1></div>
        {meetingId && <Link href={`/dashboard/meeting/${meetingId}`} passHref legacyBehavior><Button variant="outline" size="sm" className="rounded-lg"><ArrowLeft className="mr-2 h-4 w-4" />Back</Button></Link>}
      </div>
    );

    return () => setHeaderContent(null);
  }, [setHeaderContent, meetingId, pushToHistory]);


  return (
    <>
      <textarea ref={liveTextInputRef} onBlur={finalizeLiveText} style={{ position: 'absolute', display: 'none', border: '1px dashed hsl(var(--primary))', outline: 'none', background: 'hsl(var(--background)/0.8)', font: getFontString(), lineHeight: `${getFontSize() * 1.2}px`, zIndex: 10, resize: 'none', overflow: 'hidden', whiteSpace: 'pre', padding: '4px' }} tabIndex={-1} />
      <div className="flex flex-col h-full bg-muted/30">
        <div className="flex-none p-2 border-b bg-background shadow-md sticky top-16 z-20">
          <div className="container mx-auto flex flex-wrap items-center justify-center gap-2">
             <ToolButton icon={Brush} label="Draw" onClick={() => handleToolClick("draw")} isActive={activeTool === "draw"}/>
             <ToolButton icon={Type} label="Text" onClick={() => handleToolClick("text")} isActive={activeTool === "text"}/>
             <ToolButton icon={Eraser} label="Erase" onClick={() => handleToolClick("erase")} isActive={activeTool === "erase"}/>
             <ToolButton icon={Undo2} label="Undo" onClick={handleUndo} />
             <ToolButton icon={Redo2} label="Redo" onClick={handleRedo} />
             <AlertDialog>
                <AlertDialogTrigger asChild>
                    <Button variant="outline" size="icon" className="rounded-lg w-12 h-12 flex flex-col items-center justify-center text-xs" aria-label="Clear">
                        <Trash2 className="h-5 w-5 mb-0.5" />
                        <span className="text-[10px] leading-tight">Clear</span>
                    </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="rounded-xl"><AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle><AlertDialogDescription>This will clear the entire whiteboard. This action cannot be undone.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel className="rounded-lg">Cancel</AlertDialogCancel><AlertDialogAction onClick={handleClearWhiteboard} className="rounded-lg">Clear Whiteboard</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
             </AlertDialog>
          </div>
        </div>

        <div className="p-3 border-b bg-muted/50 shadow-lg flex flex-col md:flex-row items-center justify-center gap-4">
            <div className="flex flex-col items-center md:flex-row md:items-start flex-wrap justify-center gap-x-6 gap-y-4">
                {(activeTool === 'draw' || activeTool === 'text') && (
                    <div><span className="text-xs font-medium text-muted-foreground">Color:</span><div className="flex flex-wrap gap-2 mt-1 justify-center">{['#000000', '#EF4444', '#F97316', '#EAB308', '#22C55E', '#0EA5E9', '#6366F1', '#EC4899'].map(c => (<ColorSwatch key={c} color={c} onClick={() => setSelectedColor(c)} isSelected={selectedColor === c} />))}</div></div>
                )}
            </div>
        </div>

        <main className="flex-grow flex flex-col overflow-hidden min-h-0">
          <Card className="w-full h-full max-w-full text-center shadow-none rounded-none border-0 flex flex-col overflow-hidden">
            <CardContent className="flex-grow bg-card flex items-center justify-center relative p-0">
                <canvas ref={mainCanvasRef} className="touch-none w-full h-full block absolute top-0 left-0" style={{ zIndex: 1 }} />
                <canvas ref={tempCanvasRef} onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} onPointerLeave={handlePointerUp} className="touch-none w-full h-full block absolute top-0 left-0" style={{ zIndex: 2, cursor: activeTool === 'erase' ? 'cell' : 'crosshair' }} />
            </CardContent>
          </Card>
        </main>
        <footer className="flex-none p-2 text-center text-xs text-muted-foreground border-t bg-background">
          Whiteboard is in active development. Drawings and text are currently local.
        </footer>
      </div>
    </>
  );
}
