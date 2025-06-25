
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
import { useDynamicHeader } from '@/contexts/DynamicHeaderContext';

// --- Type Definitions ---
interface Point { x: number; y: number; }
type PathElement = { type: 'path'; id: string; points: Point[]; color: string; lineWidth: number; };
type TextElement = { type: 'text'; id: string; text: string; x: number; y: number; color: string; font: string; width: number; height: number; };
type WhiteboardElement = PathElement | TextElement;

interface ElementState {
  elements: WhiteboardElement[];
  selectedElementIds: Set<string>;
}

interface BoundingBox { minX: number; minY: number; maxX: number; maxY: number; }

type OperationState = 
  | { type: 'idle' }
  | { type: 'drawing'; currentPath: Point[] }
  | { type: 'texting'; position: Point }
  | { type: 'lassoing'; lassoPath: Point[] }
  | { type: 'dragging'; startPos: Point; originalElements: Map<string, WhiteboardElement> };

// --- Constants ---
const MAX_HISTORY_STEPS = 50;
const ERASER_THRESHOLD = 15;
const SELECTION_PADDING = 5;

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

function isPointInPolygon(point: Point, polygon: Point[]): boolean {
    let isInside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const xi = polygon[i].x, yi = polygon[i].y;
        const xj = polygon[j].x, yj = polygon[j].y;
        const intersect = ((yi > point.y) !== (yj > point.y)) && (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi);
        if (intersect) isInside = !isInside;
    }
    return isInside;
}

function getElementBoundingBox(element: WhiteboardElement): BoundingBox | null {
    if (element.type === 'path') {
        if (element.points.length === 0) return null;
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        element.points.forEach(p => {
            minX = Math.min(minX, p.x);
            minY = Math.min(minY, p.y);
            maxX = Math.max(maxX, p.x);
            maxY = Math.max(maxY, p.y);
        });
        return { minX, minY, maxX, maxY };
    } else if (element.type === 'text') {
        return { minX: element.x, minY: element.y, maxX: element.x + element.width, maxY: element.y + element.height };
    }
    return null;
}

function boxesIntersect(box1: BoundingBox, box2: BoundingBox): boolean {
    return box1.minX < box2.maxX && box1.maxX > box2.minX && box1.minY < box2.maxY && box1.maxY > box2.minY;
}

function getSelectionBoundingBox(elements: WhiteboardElement[], selectedIds: Set<string>): BoundingBox | null {
    let overallBox: BoundingBox | null = null;
    elements.forEach(element => {
        if (selectedIds.has(element.id)) {
            const box = getElementBoundingBox(element);
            if (box) {
                if (!overallBox) {
                    overallBox = { ...box };
                } else {
                    overallBox.minX = Math.min(overallBox.minX, box.minX);
                    overallBox.minY = Math.min(overallBox.minY, box.minY);
                    overallBox.maxX = Math.max(overallBox.maxX, box.maxX);
                    overallBox.maxY = Math.max(overallBox.maxY, box.maxY);
                }
            }
        }
    });
    return overallBox;
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

export default function WhiteboardPage() {
  const params = useParams();
  const meetingId = params.meetingId as string;
  const { setHeaderContent } = useDynamicHeader();

  const mainCanvasRef = useRef<HTMLCanvasElement>(null);
  const tempCanvasRef = useRef<HTMLCanvasElement>(null);
  const liveTextInputRef = useRef<HTMLTextAreaElement>(null);

  const [whiteboardState, setWhiteboardState] = useState<ElementState>({ elements: [], selectedElementIds: new Set() });
  const [activeTool, setActiveTool] = useState<string>("draw");
  const [selectedColor, setSelectedColor] = useState<string>("#000000");
  const [lineWidth, setLineWidth] = useState<number>(5);

  const operationStateRef = useRef<OperationState>({ type: 'idle' });
  const [tempDragPreview, setTempDragPreview] = useState<WhiteboardElement[]>([]);
  
  const historyRef = useRef<ElementState[]>([]);
  const historyStepRef = useRef(-1);

  const getFontSize = () => 16;
  const getFontString = () => `${getFontSize()}px sans-serif`;

  const pushToHistory = useCallback((state: ElementState) => {
    if (historyStepRef.current < historyRef.current.length - 1) {
        historyRef.current.splice(historyStepRef.current + 1);
    }
    historyRef.current.push(state);
    if (historyRef.current.length > MAX_HISTORY_STEPS) {
      historyRef.current.shift();
    } else {
      historyStepRef.current++;
    }
  }, []);

  const drawElement = useCallback((ctx: CanvasRenderingContext2D, element: WhiteboardElement) => {
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
  }, []);
  
  const clearCanvas = (ctx: CanvasRenderingContext2D) => ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

  const redrawMainCanvas = useCallback(() => {
    const mainCtx = mainCanvasRef.current?.getContext('2d');
    if (!mainCtx) return;
    clearCanvas(mainCtx);
    whiteboardState.elements.forEach(element => drawElement(mainCtx, element));

    const selectionBox = getSelectionBoundingBox(whiteboardState.elements, whiteboardState.selectedElementIds);
    if (selectionBox) {
      mainCtx.strokeStyle = 'rgba(0, 150, 255, 0.8)';
      mainCtx.lineWidth = 1;
      mainCtx.setLineDash([4, 4]);
      mainCtx.strokeRect(
        selectionBox.minX - SELECTION_PADDING,
        selectionBox.minY - SELECTION_PADDING,
        (selectionBox.maxX - selectionBox.minX) + SELECTION_PADDING * 2,
        (selectionBox.maxY - selectionBox.minY) + SELECTION_PADDING * 2
      );
      mainCtx.setLineDash([]);
    }
  }, [whiteboardState, drawElement]);
  
  const redrawTempCanvas = useCallback(() => {
    const tempCtx = tempCanvasRef.current?.getContext('2d');
    if (!tempCtx) return;
    clearCanvas(tempCtx);

    const opState = operationStateRef.current;
    if (opState.type === 'drawing') {
      drawElement(tempCtx, { type: 'path', id: '', points: opState.currentPath, color: selectedColor, lineWidth });
    } else if (opState.type === 'lassoing') {
      tempCtx.strokeStyle = 'rgba(0, 150, 255, 0.8)';
      tempCtx.lineWidth = 1;
      tempCtx.setLineDash([4, 4]);
      tempCtx.beginPath();
      if(opState.lassoPath.length > 0) {
        tempCtx.moveTo(opState.lassoPath[0].x, opState.lassoPath[0].y);
        opState.lassoPath.forEach(p => tempCtx.lineTo(p.x, p.y));
      }
      tempCtx.stroke();
      tempCtx.setLineDash([]);
    } else if (opState.type === 'dragging') {
        tempDragPreview.forEach(el => drawElement(tempCtx, el));
    }
  }, [selectedColor, lineWidth, drawElement, tempDragPreview]);

  useEffect(() => {
    const mainCanvas = mainCanvasRef.current;
    if (!mainCanvas) return;
    const resizeObserver = new ResizeObserver(() => {
        const { width, height } = mainCanvas.getBoundingClientRect();
        if (mainCanvas.width !== width || mainCanvas.height !== height) {
          mainCanvas.width = width;
          mainCanvas.height = height;
          if (tempCanvasRef.current) {
            tempCanvasRef.current.width = width;
            tempCanvasRef.current.height = height;
          }
        }
        redrawMainCanvas();
    });
    resizeObserver.observe(mainCanvas);
    return () => resizeObserver.disconnect();
  }, [redrawMainCanvas]);
  
  useEffect(() => {
    redrawMainCanvas();
  }, [whiteboardState, redrawMainCanvas]);
  
  useEffect(() => {
    redrawTempCanvas();
  }, [tempDragPreview, redrawTempCanvas]);

  const handleUndo = useCallback(() => {
    if (historyStepRef.current > 0) {
      historyStepRef.current--;
      const prevState = historyRef.current[historyStepRef.current];
      setWhiteboardState(prevState);
    }
  }, []);

  const handleRedo = useCallback(() => {
    if (historyStepRef.current < historyRef.current.length - 1) {
      historyStepRef.current++;
      const nextState = historyRef.current[historyStepRef.current];
      setWhiteboardState(nextState);
    }
  }, []);
  
  const getPointerPosition = useCallback((event: React.PointerEvent): Point => {
      const rect = tempCanvasRef.current!.getBoundingClientRect();
      return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }, []);

  const finalizeLiveText = useCallback(() => {
    const opState = operationStateRef.current;
    if (opState.type !== 'texting') return;
    const textInput = liveTextInputRef.current;
    if (!textInput || !textInput.value.trim()) {
      if (textInput) textInput.style.display = 'none';
      return;
    }
    
    const tempCtx = tempCanvasRef.current?.getContext('2d');
    if(!tempCtx) return;
    
    const font = getFontString();
    tempCtx.font = font;
    const lines = textInput.value.split('\n');
    const textMetrics = lines.map(line => tempCtx.measureText(line));
    const maxWidth = Math.max(...textMetrics.map(m => m.width));
    const totalHeight = lines.length * (getFontSize() * 1.2);
    
    const newTextElement: TextElement = { type: 'text', id: `text_${Date.now()}`, text: textInput.value, x: opState.position.x, y: opState.position.y, color: selectedColor, font, width: maxWidth, height: totalHeight };
    
    setWhiteboardState(prevState => {
       const newState = { ...prevState, elements: [...prevState.elements, newTextElement], selectedElementIds: new Set() };
       pushToHistory(newState);
       return newState;
    });

    textInput.value = '';
    textInput.style.display = 'none';
    operationStateRef.current = { type: 'idle' };
  }, [selectedColor, pushToHistory, getFontString]);

  const handlePointerDown = useCallback((event: React.PointerEvent) => {
    if (event.button !== 0) return;
    const pos = getPointerPosition(event);
    
    finalizeLiveText();
    
    if (activeTool === 'select') {
        const selectionBox = getSelectionBoundingBox(whiteboardState.elements, whiteboardState.selectedElementIds);
        if (selectionBox && isPointInRect(pos, selectionBox)) {
            const originalElements = new Map<string, WhiteboardElement>();
            whiteboardState.elements.forEach(el => {
                if (whiteboardState.selectedElementIds.has(el.id)) {
                    originalElements.set(el.id, JSON.parse(JSON.stringify(el)));
                }
            });
            operationStateRef.current = { type: 'dragging', startPos: pos, originalElements };
            return;
        }
    }

    if (whiteboardState.selectedElementIds.size > 0) {
      setWhiteboardState(s => ({ ...s, selectedElementIds: new Set() }));
    }
    
    switch(activeTool) {
        case 'draw':
            operationStateRef.current = { type: 'drawing', currentPath: [pos] };
            break;
        case 'text':
            operationStateRef.current = { type: 'texting', position: pos };
            if (liveTextInputRef.current) {
                liveTextInputRef.current.style.top = `${pos.y}px`;
                liveTextInputRef.current.style.left = `${pos.x}px`;
                liveTextInputRef.current.style.display = 'block';
                liveTextInputRef.current.style.color = selectedColor;
                liveTextInputRef.current.focus();
            }
            break;
        case 'erase':
            // Eraser works on pointer up (click)
            break;
        case 'lasso':
        case 'select':
            operationStateRef.current = { type: 'lassoing', lassoPath: [pos] };
            break;
    }
  }, [getPointerPosition, activeTool, selectedColor, whiteboardState, finalizeLiveText]);

  const handlePointerMove = useCallback((event: React.PointerEvent) => {
    const pos = getPointerPosition(event);
    const opState = operationStateRef.current;

    if (opState.type === 'drawing') {
        opState.currentPath.push(pos);
        redrawTempCanvas();
    } else if (opState.type === 'lassoing') {
        opState.lassoPath.push(pos);
        redrawTempCanvas();
    } else if (opState.type === 'dragging') {
        const dx = pos.x - opState.startPos.x;
        const dy = pos.y - opState.startPos.y;
        
        const draggedElements: WhiteboardElement[] = [];
        for (const originalElement of opState.originalElements.values()) {
            if (originalElement.type === 'path') {
                draggedElements.push({ ...originalElement, points: originalElement.points.map(p => ({ x: p.x + dx, y: p.y + dy })) });
            } else if (originalElement.type === 'text') {
                draggedElements.push({ ...originalElement, x: originalElement.x + dx, y: originalElement.y + dy });
            }
        }
        setTempDragPreview(draggedElements);
    }
  }, [getPointerPosition, redrawTempCanvas]);

  const handlePointerUp = useCallback((event: React.PointerEvent) => {
    const pos = getPointerPosition(event);
    const opState = operationStateRef.current;

    switch(opState.type) {
        case 'drawing':
            if (opState.currentPath.length > 1) {
                const newPath: PathElement = { type: 'path', id: `path_${Date.now()}`, points: opState.currentPath, color: selectedColor, lineWidth };
                setWhiteboardState(prevState => {
                    const newState = { ...prevState, elements: [...prevState.elements, newPath], selectedElementIds: new Set() };
                    pushToHistory(newState);
                    return newState;
                });
            }
            break;
        case 'erasing': // This case is handled in 'select' tool logic now
            break;
        case 'lassoing':
            if (opState.lassoPath.length > 2) {
                const newSelectedIds = new Set<string>();
                const lassoPolygon = opState.lassoPath;
                const lassoBox = getElementBoundingBox({type:'path', id:'', points:lassoPolygon, color:'', lineWidth:1});

                whiteboardState.elements.forEach(element => {
                    const elementBox = getElementBoundingBox(element);
                    if(!elementBox || (lassoBox && !boxesIntersect(lassoBox, elementBox))) return;
                    
                    if (element.type === 'path' ? element.points.some(p => isPointInPolygon(p, lassoPolygon)) : isPointInPolygon({x: element.x, y: element.y}, lassoPolygon)) {
                        newSelectedIds.add(element.id);
                    }
                });

                if (newSelectedIds.size > 0) {
                    setWhiteboardState(prevState => ({...prevState, selectedElementIds: newSelectedIds}));
                    setActiveTool('select');
                }
            }
            break;
        case 'dragging':
            const dx = pos.x - opState.startPos.x;
            const dy = pos.y - opState.startPos.y;

            if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
                setWhiteboardState(prevState => {
                    const newElements = prevState.elements.map(el => {
                        if (prevState.selectedElementIds.has(el.id)) {
                            const originalElement = opState.originalElements.get(el.id);
                            if (!originalElement) return el;
                            if (originalElement.type === 'path') {
                                return { ...originalElement, points: originalElement.points.map(p => ({ x: p.x + dx, y: p.y + dy })) };
                            } else if (originalElement.type === 'text') {
                                return { ...originalElement, x: originalElement.x + dx, y: originalElement.y + dy };
                            }
                        }
                        return el;
                    });
                    const newState = { ...prevState, elements: newElements };
                    pushToHistory(newState);
                    return newState;
                });
            }
            setTempDragPreview([]);
            break;
    }
    
    // Eraser Click Logic
    if (activeTool === 'erase' && opState.type === 'idle') {
         let elementToDeleteId: string | null = null;
         for (let i = whiteboardState.elements.length - 1; i >= 0; i--) {
            const element = whiteboardState.elements[i];
            if (element.type === 'path') {
                for (let j = 0; j < element.points.length - 1; j++) {
                    if (distToSegment(pos, element.points[j], element.points[j + 1]) < ERASER_THRESHOLD + element.lineWidth / 2) {
                        elementToDeleteId = element.id; break;
                    }
                }
            } else if (element.type === 'text') {
                const box = getElementBoundingBox(element);
                if(box && isPointInRect(pos, box)) {
                    elementToDeleteId = element.id;
                }
            }
            if (elementToDeleteId) break;
        }
        if (elementToDeleteId) {
            const idToDelete = elementToDeleteId;
            setWhiteboardState(prevState => {
                const newElements = prevState.elements.filter(el => el.id !== idToDelete);
                const newState = { ...prevState, elements: newElements, selectedElementIds: new Set() };
                pushToHistory(newState);
                return newState;
            });
        }
    }

    operationStateRef.current = { type: 'idle' };
    const tempCtx = tempCanvasRef.current?.getContext('2d');
    if (tempCtx) clearCanvas(tempCtx);

  }, [getPointerPosition, selectedColor, lineWidth, whiteboardState, activeTool, pushToHistory]);

  const handleClearWhiteboard = () => { 
    setWhiteboardState({ elements: [], selectedElementIds: new Set() });
    pushToHistory({ elements: [], selectedElementIds: new Set() });
  };

  useEffect(() => {
    pushToHistory({ elements: [], selectedElementIds: new Set() });
    setHeaderContent(
      <div className="flex items-center justify-between w-full">
        <div className="flex items-center gap-3"><Brush className="h-7 w-7 text-primary" /><h1 className="text-xl font-semibold truncate">Whiteboard</h1></div>
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
             <ToolButton icon={Brush} label="Draw" onClick={() => setActiveTool("draw")} isActive={activeTool === "draw"}/>
             <ToolButton icon={Lasso} label="Select" onClick={() => setActiveTool("lasso")} isActive={activeTool === "lasso" || activeTool === "select"}/>
             <ToolButton icon={Type} label="Text" onClick={() => setActiveTool("text")} isActive={activeTool === "text"}/>
             <ToolButton icon={Eraser} label="Erase" onClick={() => setActiveTool("erase")} isActive={activeTool === "erase"}/>
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

        <main className="flex-grow flex flex-col overflow-hidden min-h-0">
          <Card className="w-full h-full max-w-full text-center shadow-none rounded-none border-0 flex flex-col overflow-hidden">
            <CardContent className="flex-grow bg-card flex items-center justify-center relative p-0">
                <canvas ref={mainCanvasRef} className="touch-none w-full h-full block absolute top-0 left-0 bg-white" style={{ zIndex: 1 }} />
                <canvas 
                    ref={tempCanvasRef} 
                    onPointerDown={handlePointerDown} 
                    onPointerMove={handlePointerMove} 
                    onPointerUp={handlePointerUp} 
                    onPointerLeave={handlePointerUp} 
                    className="touch-none w-full h-full block absolute top-0 left-0" 
                    style={{ zIndex: 2, cursor: activeTool === 'select' ? 'default' : (activeTool === 'lasso' || activeTool === 'draw' || activeTool === 'erase' ? 'crosshair' : 'text') }} 
                />
            </CardContent>
          </Card>
        </main>
        <footer className="flex-none p-2 text-center text-xs text-muted-foreground border-t bg-background">
          Whiteboard is in active development. All drawings are currently local.
        </footer>
      </div>
    </>
  );
}
