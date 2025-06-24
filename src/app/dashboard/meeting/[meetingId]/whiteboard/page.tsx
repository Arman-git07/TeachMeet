
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
import { ArrowLeft, Brush, Minus, Type, Eraser, Trash2, Circle as CircleIconShape, Square as SquareIconShape, Edit3, ArrowRight, Triangle as TriangleIcon, Undo2, Redo2, Lasso } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import React, { useState, useEffect, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";
import { useDynamicHeader } from '@/contexts/DynamicHeaderContext';

// Type definitions for canvas elements
interface DrawnPath {
  id: string;
  points: { x: number; y: number }[];
  color: string;
  lineWidth: number;
}

interface TextElement {
  id: string;
  textLines: string[];
  x: number;
  y: number;
  color: string;
  font: string;
  fontSize: number;
  lineHeight: number;
  width: number;
  height: number;
}

interface HistoryState {
  paths: DrawnPath[];
  texts: TextElement[];
}

// Tool definitions and constants
const drawingTools = ['draw', 'line', 'circle', 'square', 'arrow', 'triangle'];
const MAX_HISTORY_STEPS = 50;

// UI Component for tool buttons
const ToolButton = React.memo(React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement> & { icon: React.ElementType; label: string; onClick: () => void; isActive?: boolean; disabled?: boolean; }>(
  ({ icon: Icon, label, onClick, isActive = false, disabled = false, ...rest }, ref) => (
  <Button ref={ref} variant={isActive ? "default" : "outline"} size="icon" className="rounded-lg w-12 h-12 flex flex-col items-center justify-center text-xs" onClick={onClick} aria-label={label} disabled={disabled} {...rest}>
    <Icon className="h-5 w-5 mb-0.5" />
  </Button>
)));
ToolButton.displayName = "ToolButton";

// UI Component for color swatches
const ColorSwatch = React.memo(({ color, onClick, isSelected }: { color: string, onClick: () => void, isSelected: boolean }) => (
  <Button variant="outline" size="icon" className={cn("rounded-full w-8 h-8 border-2", isSelected ? "border-ring ring-2 ring-offset-2 ring-offset-background ring-ring" : "border-muted-foreground/50 hover:border-foreground")} style={{ backgroundColor: color }} onClick={onClick} aria-label={`Select color ${color}`} />
));
ColorSwatch.displayName = "ColorSwatch";


export default function WhiteboardPage() {
  const params = useParams();
  const meetingId = params.meetingId as string;
  const { setHeaderContent } = useDynamicHeader();

  // --- Canvas and Context Refs ---
  const mainCanvasRef = useRef<HTMLCanvasElement>(null);
  const tempCanvasRef = useRef<HTMLCanvasElement>(null);
  const mainContextRef = useRef<CanvasRenderingContext2D | null>(null);
  const tempContextRef = useRef<CanvasRenderingContext2D | null>(null);

  // --- Core Drawing Data (managed with refs to prevent re-renders) ---
  const pathsRef = useRef<DrawnPath[]>([]);
  const textObjectsRef = useRef<TextElement[]>([]);
  const historyRef = useRef<HistoryState[]>([{ paths: [], texts: [] }]);
  const historyStepRef = useRef<number>(0);
  const currentPathRef = useRef<DrawnPath | null>(null);

  // --- UI State (managed with useState to trigger UI updates) ---
  const [activeTool, setActiveTool] = useState<string>("draw");
  const [selectedColor, setSelectedColor] = useState<string>("#000000");
  const [selectedBrushSize, setSelectedBrushSize] = useState<string>("medium");
  const [selectedTextSize, setSelectedTextSize] = useState<string>("medium");
  const [canvasBackgroundColor, setCanvasBackgroundColor] = useState<string>("#FFFFFF");
  const [isUndoable, setIsUndoable] = useState(false);
  const [isRedoable, setIsRedoable] = useState(false);
  
  // --- Operation State (managed with refs for high-frequency events) ---
  const operationStateRef = useRef<'idle' | 'drawing' | 'shaping' | 'lassoing' | 'dragging' | 'typing'>('idle');
  const shapeStartPointRef = useRef<{ x: number; y: number } | null>(null);
  const lassoPathRef = useRef<{x: number, y: number}[]>([]);
  const dragStartPointRef = useRef<{ x: number; y: number } | null>(null);
  const selectionSnapshotRef = useRef<{ paths: DrawnPath[], texts: TextElement[] }>({ paths: [], texts: []});
  const liveTextInputRef = useRef<HTMLTextAreaElement>(null);
  const [currentText, setCurrentText] = useState('');
  const [textInputPosition, setTextInputPosition] = useState<{ x: number, y: number } | null>(null);
  const [selectedElementIds, setSelectedElementIds] = useState<{ paths: string[], texts: string[]}>({ paths: [], texts: [] });
  const [showToolOptions, setShowToolOptions] = useState(true);

  // --- Brush/Font Size Mappings ---
  const brushSizes = [ { name: 'tiny', lineWidth: 1 }, { name: 'small', lineWidth: 3 }, { name: 'medium', lineWidth: 6 }, { name: 'large', lineWidth: 10 }, { name: 'xlarge', lineWidth: 15 } ];
  const textSizes = [ { name: 'small', fontSize: 12 }, { name: 'medium', fontSize: 16 }, { name: 'large', fontSize: 24 }, { name: 'xlarge', fontSize: 32 } ];
  const getLineWidth = useCallback(() => brushSizes.find(b => b.name === selectedBrushSize)?.lineWidth || 6, [selectedBrushSize]);
  const getFontSize = useCallback(() => textSizes.find(s => s.name === selectedTextSize)?.fontSize || 16, [selectedTextSize]);

  // --- Core Drawing Functions ---
  const drawPath = useCallback((ctx: CanvasRenderingContext2D, path: DrawnPath) => {
    if (path.points.length < 2) return;
    ctx.beginPath();
    ctx.strokeStyle = path.color;
    ctx.lineWidth = path.lineWidth;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.moveTo(path.points[0].x, path.points[0].y);
    for (let i = 1; i < path.points.length; i++) ctx.lineTo(path.points[i].x, path.points[i].y);
    ctx.stroke();
  }, []);

  const drawText = useCallback((ctx: CanvasRenderingContext2D, textObj: TextElement) => {
    ctx.fillStyle = textObj.color;
    ctx.font = textObj.font;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    textObj.textLines.forEach((line, index) => ctx.fillText(line, textObj.x, textObj.y + (index * textObj.lineHeight)));
  }, []);

  const clearCanvas = useCallback((ctx: CanvasRenderingContext2D) => {
    if (!ctx.canvas) return;
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  }, []);
  
  const redrawMainCanvas = useCallback(() => {
    const mainCtx = mainContextRef.current;
    if (!mainCtx?.canvas) return;
    clearCanvas(mainCtx);
    mainCtx.fillStyle = canvasBackgroundColor;
    mainCtx.fillRect(0, 0, mainCtx.canvas.width, mainCtx.canvas.height);
    pathsRef.current.forEach(path => drawPath(mainCtx, path));
    textObjectsRef.current.forEach(textObj => drawText(mainCtx, textObj));
  }, [canvasBackgroundColor, clearCanvas, drawPath, drawText]);

  // --- History Management ---
  const saveStateToHistory = useCallback(() => {
    const newHistoryStep = historyStepRef.current + 1;
    const currentState = { paths: [...pathsRef.current], texts: [...textObjectsRef.current] };
    const newHistory = historyRef.current.slice(0, newHistoryStep);
    let updatedHistory = [...newHistory, currentState];
    if (updatedHistory.length > MAX_HISTORY_STEPS) {
        updatedHistory = updatedHistory.slice(updatedHistory.length - MAX_HISTORY_STEPS);
    }
    historyRef.current = updatedHistory;
    historyStepRef.current = updatedHistory.length - 1;
    setIsUndoable(true);
    setIsRedoable(false);
  }, []);

  const handleUndo = useCallback(() => {
    if (historyStepRef.current > 0) {
      const prevStep = historyStepRef.current - 1;
      historyStepRef.current = prevStep;
      const { paths, texts } = historyRef.current[prevStep];
      pathsRef.current = paths.map(p => ({...p}));
      textObjectsRef.current = texts.map(t => ({...t}));
      redrawMainCanvas();
      setIsUndoable(prevStep > 0);
      setIsRedoable(true);
      setSelectedElementIds({ paths: [], texts: []});
    }
  }, [redrawMainCanvas]);

  const handleRedo = useCallback(() => {
    if (historyStepRef.current < historyRef.current.length - 1) {
      const nextStep = historyStepRef.current + 1;
      historyStepRef.current = nextStep;
      const { paths, texts } = historyRef.current[nextStep];
      pathsRef.current = paths.map(p => ({...p}));
      textObjectsRef.current = texts.map(t => ({...t}));
      redrawMainCanvas();
      setIsUndoable(true);
      setIsRedoable(nextStep < historyRef.current.length - 1);
      setSelectedElementIds({ paths: [], texts: []});
    }
  }, [redrawMainCanvas]);

  const handleToolClick = (toolName: string) => {
    operationStateRef.current = 'idle';
    setSelectedElementIds({ paths: [], texts: [] });
    setActiveTool(toolName);
    const isOptionsTool = drawingTools.includes(toolName) || ['erase', 'text', 'select'].includes(toolName);
    setShowToolOptions(isOptionsTool);
  };
  
  // --- Pointer/Mouse Event Handlers ---
  const getPointerPosition = useCallback((event: React.MouseEvent | React.TouchEvent): { x: number, y: number } | null => {
      const canvas = tempCanvasRef.current;
      if (!canvas) return null;
      const rect = canvas.getBoundingClientRect();
      const nativeEvent = event.nativeEvent;
      const clientX = 'touches' in nativeEvent ? (nativeEvent.touches[0] || nativeEvent.changedTouches[0]).clientX : (nativeEvent as MouseEvent).clientX;
      const clientY = 'touches' in nativeEvent ? (nativeEvent.touches[0] || nativeEvent.changedTouches[0]).clientY : (nativeEvent as MouseEvent).clientY;
      return { x: (clientX - rect.left) * (canvas.width / rect.width), y: (clientY - rect.top) * (canvas.height / rect.height) };
  }, []);
  
  const handlePointerDown = useCallback((event: React.MouseEvent | React.TouchEvent) => {
    if ((event as React.MouseEvent).button !== 0) return;
    const pos = getPointerPosition(event);
    if (!pos) return;
    
    if (activeTool === 'select') {
      const clickedOnSelection = [
        ...pathsRef.current.filter(p => selectedElementIds.paths.includes(p.id)),
        ...textObjectsRef.current.filter(t => selectedElementIds.texts.includes(t.id))
      ].some(item => 'points' in item ? item.points.some(p => Math.hypot(p.x - pos.x, p.y - pos.y) < item.lineWidth / 2 + 5) : (pos.x >= item.x && pos.x <= item.x + item.width && pos.y >= item.y && pos.y <= item.y + item.height));

      if (clickedOnSelection) {
        operationStateRef.current = 'dragging';
        dragStartPointRef.current = pos;
        selectionSnapshotRef.current.paths = pathsRef.current.filter(p => selectedElementIds.paths.includes(p.id));
        selectionSnapshotRef.current.texts = textObjectsRef.current.filter(t => selectedElementIds.texts.includes(t.id));
        pathsRef.current = pathsRef.current.filter(p => !selectedElementIds.paths.includes(p.id));
        textObjectsRef.current = textObjectsRef.current.filter(t => !selectedElementIds.texts.includes(t.id));
        redrawMainCanvas();
      } else {
        operationStateRef.current = 'lassoing';
        lassoPathRef.current = [pos];
        setSelectedElementIds({ paths: [], texts: [] });
      }
    } else if (activeTool === 'text') {
        setTextInputPosition(pos);
        setCurrentText('');
        operationStateRef.current = 'typing';
        setTimeout(() => liveTextInputRef.current?.focus(), 0);
    } else if (activeTool === 'draw' || activeTool === 'erase') {
        operationStateRef.current = 'drawing';
        currentPathRef.current = {
            id: Date.now().toString(),
            points: [pos],
            color: activeTool === 'erase' ? canvasBackgroundColor : selectedColor,
            lineWidth: getLineWidth()
        };
    } else if (drawingTools.includes(activeTool)) {
        operationStateRef.current = 'shaping';
        shapeStartPointRef.current = pos;
    }
  }, [getPointerPosition, activeTool, selectedElementIds, redrawMainCanvas, selectedColor, getLineWidth, canvasBackgroundColor]);

  const handlePointerMove = useCallback((event: React.MouseEvent | React.TouchEvent) => {
    if (operationStateRef.current === 'idle' || operationStateRef.current === 'typing') return;
    const pos = getPointerPosition(event);
    if (!pos || !tempContextRef.current) return;
    
    const tempCtx = tempContextRef.current;
    clearCanvas(tempCtx);

    if (operationStateRef.current === 'drawing' && currentPathRef.current) {
        currentPathRef.current.points.push(pos);
        drawPath(tempCtx, currentPathRef.current);
    } else if (operationStateRef.current === 'shaping' && shapeStartPointRef.current) {
      const start = shapeStartPointRef.current;
      const tempPath: DrawnPath = { id: '', points: [], color: selectedColor, lineWidth: getLineWidth()};
      if (activeTool === 'line') tempPath.points.push(start, pos);
      else if (activeTool === 'square') tempPath.points.push(start, {x: pos.x, y: start.y}, pos, {x: start.x, y: pos.y}, start);
      else if (activeTool === 'circle') {
          const radius = Math.hypot(pos.x - start.x, pos.y - start.y) / 2;
          const centerX = start.x + (pos.x - start.x) / 2, centerY = start.y + (pos.y - start.y) / 2;
          for (let i = 0; i <= 360; i += 10) tempPath.points.push({ x: centerX + radius * Math.cos(i * Math.PI / 180), y: centerY + radius * Math.sin(i * Math.PI / 180) });
      } else if (activeTool === 'arrow') {
          const headlen = 10 + getLineWidth(); const angle = Math.atan2(pos.y - start.y, pos.x - start.x);
          tempPath.points.push(start, pos, {x: pos.x - headlen * Math.cos(angle - Math.PI / 6), y: pos.y - headlen * Math.sin(angle - Math.PI / 6)}, pos, {x: pos.x - headlen * Math.cos(angle + Math.PI / 6), y: pos.y - headlen * Math.sin(angle - Math.PI / 6)});
      } else if (activeTool === 'triangle') tempPath.points.push({ x: start.x + (pos.x - start.x) / 2, y: start.y }, { x: start.x, y: pos.y }, { x: pos.x, y: pos.y }, { x: start.x + (pos.x - start.x) / 2, y: start.y });
      drawPath(tempCtx, tempPath);
    } else if (operationStateRef.current === 'lassoing') {
        lassoPathRef.current.push(pos);
        tempCtx.beginPath(); tempCtx.moveTo(lassoPathRef.current[0].x, lassoPathRef.current[0].y);
        lassoPathRef.current.forEach(p => tempCtx.lineTo(p.x, p.y));
        tempCtx.strokeStyle = "rgba(0, 123, 255, 0.7)"; tempCtx.lineWidth = 1; tempCtx.setLineDash([4, 2]); tempCtx.stroke(); tempCtx.setLineDash([]);
    } else if (operationStateRef.current === 'dragging' && dragStartPointRef.current) {
        const deltaX = pos.x - dragStartPointRef.current.x, deltaY = pos.y - dragStartPointRef.current.y;
        selectionSnapshotRef.current.paths.forEach(p => drawPath(tempCtx, {...p, points: p.points.map(pt => ({ x: pt.x + deltaX, y: pt.y + deltaY}))}));
        selectionSnapshotRef.current.texts.forEach(t => drawText(tempCtx, {...t, x: t.x + deltaX, y: t.y + deltaY}));
    }
  }, [getPointerPosition, activeTool, getLineWidth, drawPath, drawText, clearCanvas, selectedColor]);

  const handlePointerUp = useCallback((event: React.MouseEvent | React.TouchEvent) => {
    const tempCtx = tempContextRef.current;
    if (!tempCtx || operationStateRef.current === 'idle' || operationStateRef.current === 'typing') return;
    
    if (operationStateRef.current === 'drawing') {
        if (currentPathRef.current && currentPathRef.current.points.length > 1) {
            pathsRef.current.push(currentPathRef.current);
            saveStateToHistory();
            redrawMainCanvas(); // Redraw main canvas with the new path
        }
        currentPathRef.current = null;
    } else if (operationStateRef.current === 'shaping' && shapeStartPointRef.current) {
        const start = shapeStartPointRef.current;
        const pos = getPointerPosition(event)!;
        const newPath: DrawnPath = { id: Date.now().toString(), points: [], color: selectedColor, lineWidth: getLineWidth() };
        if (activeTool === 'line') newPath.points.push(start, pos);
        else if (activeTool === 'square') newPath.points.push(start, {x: pos.x, y: start.y}, pos, {x: start.x, y: pos.y}, start);
        else if (activeTool === 'circle') {
            const radius = Math.hypot(pos.x - start.x, pos.y - start.y) / 2;
            const centerX = start.x + (pos.x - start.x) / 2, centerY = start.y + (pos.y - start.y) / 2;
            for (let i = 0; i <= 360; i += 10) newPath.points.push({ x: centerX + radius * Math.cos(i * Math.PI / 180), y: centerY + radius * Math.sin(i * Math.PI / 180) });
        } else if (activeTool === 'arrow') {
            const headlen = 10 + getLineWidth(); const angle = Math.atan2(pos.y - start.y, pos.x - start.x);
            newPath.points.push(start, pos, {x: pos.x - headlen * Math.cos(angle - Math.PI / 6), y: pos.y - headlen * Math.sin(angle - Math.PI / 6)}, pos, {x: pos.x - headlen * Math.cos(angle + Math.PI / 6), y: pos.y - headlen * Math.sin(angle - Math.PI / 6)});
        } else if (activeTool === 'triangle') newPath.points.push({ x: start.x + (pos.x - start.x) / 2, y: start.y }, { x: start.x, y: pos.y }, { x: pos.x, y: pos.y }, { x: start.x + (pos.x - start.x) / 2, y: start.y });
        
        if (newPath.points.length > 0) {
            pathsRef.current.push(newPath);
            saveStateToHistory();
            redrawMainCanvas();
        }
    } else if (operationStateRef.current === 'lassoing') {
        const finalLassoPath = lassoPathRef.current;
        const isPointInPolygon = (point: {x: number, y: number}, polygon: {x: number, y: number}[]) => {
          if (polygon.length < 3) return false;
          let isInside = false;
          for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) { if (((polygon[i].y > point.y) !== (polygon[j].y > point.y)) && (point.x < (polygon[j].x - polygon[i].x) * (point.y - polygon[i].y) / (polygon[j].y - polygon[i].y) + polygon[i].x)) isInside = !isInside; }
          return isInside;
        };
        const selectedPaths = pathsRef.current.filter(path => path.points.some(p => isPointInPolygon(p, finalLassoPath))).map(p => p.id);
        const selectedTexts = textObjectsRef.current.filter(obj => isPointInPolygon({x: obj.x + obj.width/2, y: obj.y + obj.height/2}, finalLassoPath)).map(t => t.id);
        setSelectedElementIds({ paths: selectedPaths, texts: selectedTexts });
    } else if (operationStateRef.current === 'dragging' && dragStartPointRef.current) {
        const pos = getPointerPosition(event)!;
        const deltaX = pos.x - dragStartPointRef.current.x, deltaY = pos.y - dragStartPointRef.current.y;
        selectionSnapshotRef.current.paths.forEach(p => pathsRef.current.push({ ...p, points: p.points.map(pt => ({ x: pt.x + deltaX, y: pt.y + deltaY })) }));
        selectionSnapshotRef.current.texts.forEach(t => textObjectsRef.current.push({ ...t, x: t.x + deltaX, y: t.y + deltaY }));
        redrawMainCanvas();
        saveStateToHistory();
    }
    
    clearCanvas(tempCtx);
    operationStateRef.current = 'idle';
    shapeStartPointRef.current = null;
    lassoPathRef.current = [];
    dragStartPointRef.current = null;
    selectionSnapshotRef.current = { paths: [], texts: []};
  }, [getLineWidth, selectedColor, redrawMainCanvas, clearCanvas, saveStateToHistory, activeTool, getPointerPosition]);

  // --- Initialization and Setup Effects ---
  useEffect(() => {
    const mainCanvas = mainCanvasRef.current; const tempCanvas = tempCanvasRef.current;
    if (mainCanvas && tempCanvas) {
        const resizeCanvases = () => {
          const { width, height } = mainCanvas.getBoundingClientRect();
          if (width > 0 && height > 0) {
            mainCanvas.width = width; mainCanvas.height = height;
            tempCanvas.width = width; tempCanvas.height = height;
            redrawMainCanvas();
          }
        };
        resizeCanvases();
        mainContextRef.current = mainCanvas.getContext("2d");
        tempContextRef.current = tempCanvas.getContext("2d");
        window.addEventListener('resize', resizeCanvases);
        return () => window.removeEventListener('resize', resizeCanvases);
    }
  }, [redrawMainCanvas]);
  
  useEffect(() => {
    setHeaderContent(<div className="flex items-center justify-between w-full"><div className="flex items-center gap-3"><Edit3 className="h-7 w-7 text-primary" /><h1 className="text-xl font-semibold truncate">TeachMeet Whiteboard</h1></div>{meetingId && <Link href={`/dashboard/meeting/${meetingId}`} passHref legacyBehavior><Button variant="outline" size="sm" className="rounded-lg"><ArrowLeft className="mr-2 h-4 w-4" />Back</Button></Link>}</div>);
    return () => setHeaderContent(null);
  }, [setHeaderContent, meetingId]);

  const finalizeLiveText = useCallback(() => {
    operationStateRef.current = 'idle';
    if (!currentText.trim() || !textInputPosition) {
        setTextInputPosition(null); return;
    }
    const lines = currentText.trimEnd().split('\n');
    const fontSize = getFontSize();
    const font = `${fontSize}px sans-serif`;
    const tempCtx = tempContextRef.current!;
    tempCtx.font = font;
    let maxWidth = 0;
    lines.forEach(line => maxWidth = Math.max(maxWidth, tempCtx.measureText(line).width));
    const lineHeight = fontSize * 1.2;
    const textHeight = lines.length * lineHeight;
    
    textObjectsRef.current.push({
      id: Date.now().toString(), textLines: lines, x: textInputPosition.x, y: textInputPosition.y,
      color: selectedColor, fontSize, font, lineHeight, width: maxWidth, height: textHeight
    });
    
    redrawMainCanvas();
    saveStateToHistory();
    setCurrentText('');
    setTextInputPosition(null);
  }, [currentText, textInputPosition, getFontSize, selectedColor, redrawMainCanvas, saveStateToHistory]);

  return (
    <>
      {textInputPosition && mainCanvasRef.current && (
          <textarea
              ref={liveTextInputRef} value={currentText} onChange={e => setCurrentText(e.target.value)}
              onBlur={finalizeLiveText} onKeyDown={e => { if (e.key === 'Escape') { e.preventDefault(); finalizeLiveText(); } }}
              style={{ position: 'absolute', top: textInputPosition.y + mainCanvasRef.current.getBoundingClientRect().top, left: textInputPosition.x + mainCanvasRef.current.getBoundingClientRect().left,
                       background: 'transparent', border: '1px dashed hsl(var(--primary))', outline: 'none', color: selectedColor,
                       font: `${getFontSize()}px sans-serif`, lineHeight: `${getFontSize() * 1.2}px`, zIndex: 10,
                       minWidth: '50px', resize: 'none', overflow: 'hidden', whiteSpace: 'pre-wrap' }}
              autoFocus
          />
      )}
      <div className="flex flex-col h-full bg-muted/30">
        <div className="flex-none p-2 border-b bg-background shadow-md sticky top-16 z-20">
          <div className="container mx-auto flex flex-wrap items-center justify-center gap-2">
             <ToolButton icon={Lasso} label="Lasso Select" onClick={() => handleToolClick("select")} isActive={activeTool === "select"}/>
             <ToolButton icon={Brush} label="Draw" onClick={() => handleToolClick("draw")} isActive={drawingTools.includes(activeTool) && activeTool !== "erase"} />
             <ToolButton icon={Type} label="Text" onClick={() => handleToolClick("text")} isActive={activeTool === "text"}/>
             <ToolButton icon={Eraser} label="Erase" onClick={() => handleToolClick("erase")} isActive={activeTool === "erase"}/>
             <ToolButton icon={Undo2} label="Undo" onClick={handleUndo} disabled={!isUndoable} />
             <ToolButton icon={Redo2} label="Redo" onClick={handleRedo} disabled={!isRedoable}/>
             <AlertDialog>
                <AlertDialogTrigger asChild>
                    <Button variant="outline" size="icon" className="rounded-lg w-12 h-12 flex flex-col items-center justify-center text-xs" aria-label="Clear">
                        <Trash2 className="h-5 w-5 mb-0.5" />
                    </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="rounded-xl"><AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle><AlertDialogDescription>This will clear the entire whiteboard. This action cannot be undone.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel className="rounded-lg">Cancel</AlertDialogCancel><AlertDialogAction onClick={() => { pathsRef.current = []; textObjectsRef.current = []; redrawMainCanvas(); saveStateToHistory(); setSelectedElementIds({paths:[], texts:[]});}} className="rounded-lg">Clear Whiteboard</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
             </AlertDialog>
          </div>
        </div>

        {showToolOptions && (
           <div className="p-3 border-b bg-muted/50 shadow-lg flex flex-col items-center justify-center md:flex-row md:items-start gap-4">
             <div className="flex flex-col md:flex-row md:items-center md:justify-center flex-wrap gap-x-6 gap-y-4">
                {activeTool === 'select' ? ( <div className="text-center"><p className="text-sm text-muted-foreground">Lasso Select active. Drag to select items.</p>{(selectedElementIds.paths.length + selectedElementIds.texts.length) > 0 && <p className="text-xs text-primary">{(selectedElementIds.paths.length + selectedElementIds.texts.length)} item(s) selected. Drag to move.</p>}</div> ) 
                : activeTool === 'text' ? (
                    <>
                      <div><span className="text-xs font-medium text-muted-foreground">Color:</span><div className="flex flex-wrap gap-2 mt-1">{['#000000', '#EF4444', '#F97316', '#EAB308', '#22C55E', '#0EA5E9', '#6366F1', '#EC4899'].map(c => (<ColorSwatch key={c} color={c} onClick={() => setSelectedColor(c)} isSelected={selectedColor === c} />))}</div></div>
                      <div><span className="text-xs font-medium text-muted-foreground">Text Size:</span><div className="flex gap-2 mt-1">{textSizes.map(s => (<Button key={s.name} variant={selectedTextSize === s.name ? "default" : "outline"} size="sm" className="rounded-lg" onClick={() => setSelectedTextSize(s.name)}>{s.name.charAt(0).toUpperCase() + s.name.slice(1)}</Button>))}</div></div>
                    </>
                ) : activeTool === 'erase' ? (
                    <div className="flex flex-col items-center justify-center"><span className="text-xs font-medium text-muted-foreground">Eraser Size:</span><div className="flex gap-2 mt-1">{brushSizes.map(b => (<Button key={b.name} variant={selectedBrushSize === b.name ? "default" : "outline"} size="icon" className="rounded-lg w-10 h-10" onClick={() => setSelectedBrushSize(b.name)}><CircleIconShape className={cn("h-5 w-5", b.name === 'tiny' && 'h-2 w-2', b.name === 'small' && 'h-3 w-3', b.name === 'large' && 'h-6 w-6', b.name === 'xlarge' && 'h-7 w-7')} /></Button>))}</div></div>
                ) : ( // Drawing tools
                    <>
                        <div><span className="text-xs font-medium text-muted-foreground">Color:</span><div className="flex flex-wrap gap-2 mt-1">{['#000000', '#EF4444', '#F97316', '#EAB308', '#22C55E', '#0EA5E9', '#6366F1', '#EC4899'].map(c => (<ColorSwatch key={c} color={c} onClick={() => setSelectedColor(c)} isSelected={selectedColor === c} />))}</div></div>
                        <div><span className="text-xs font-medium text-muted-foreground">Size:</span><div className="flex gap-2 mt-1">{brushSizes.map(b => (<Button key={b.name} variant={selectedBrushSize === b.name ? "default" : "outline"} size="icon" className="rounded-lg w-10 h-10" onClick={() => setSelectedBrushSize(b.name)}><CircleIconShape className={cn("h-5 w-5", b.name === 'tiny' && 'h-2 w-2', b.name === 'small' && 'h-3 w-3', b.name === 'large' && 'h-6 w-6', b.name === 'xlarge' && 'h-7 w-7')} /></Button>))}</div></div>
                        <div><span className="text-xs font-medium text-muted-foreground">Shape:</span><div className="flex flex-wrap gap-2 mt-1">{[ {tool: "draw", icon: Edit3, label: "Freehand"}, {tool: "line", icon: Minus, label: "Line"}, {tool: "arrow", icon: ArrowRight, label: "Arrow"}, {tool: "circle", icon: CircleIconShape, label: "Circle"}, {tool: "square", icon: SquareIconShape, label: "Square"}, {tool: "triangle", icon: TriangleIcon, label: "Triangle"} ].map(t => (<ToolButton key={t.tool} icon={t.icon} label={t.label} onClick={() => setActiveTool(t.tool)} isActive={activeTool === t.tool}/>))}</div></div>
                    </>
                )}
             </div>
           </div>
        )}

        <main className="flex-grow flex flex-col overflow-hidden min-h-0"> 
          <Card className="w-full h-full max-w-full text-center shadow-none rounded-none border-0 flex flex-col overflow-hidden">
            <CardContent className="flex-grow bg-card flex items-center justify-center relative p-0"> 
                <canvas ref={mainCanvasRef} className="touch-none w-full h-full block absolute top-0 left-0" style={{ zIndex: 1, backgroundColor: canvasBackgroundColor }} />
                <canvas ref={tempCanvasRef} onMouseDown={handlePointerDown} onMouseMove={handlePointerMove} onMouseUp={handlePointerUp} onMouseLeave={handlePointerUp} onTouchStart={handlePointerDown} onTouchMove={handlePointerMove} onTouchEnd={handlePointerUp} className="touch-none w-full h-full block absolute top-0 left-0" style={{ zIndex: 2 }} />
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

    