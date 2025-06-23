
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
import { useParams, useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import React, { useState, useEffect, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";
import { useDynamicHeader } from '@/contexts/DynamicHeaderContext';

interface ToolButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: React.ElementType;
  label: string;
  onClick: () => void;
  isActive?: boolean;
  disabled?: boolean;
}

const ToolButton = React.forwardRef<HTMLButtonElement, ToolButtonProps>(
  ({ icon: Icon, label, onClick, isActive = false, disabled = false, ...rest }, ref) => (
  <Button
    ref={ref}
    variant={isActive ? "default" : "outline"}
    size="icon"
    className="rounded-lg w-12 h-12 flex flex-col items-center justify-center text-xs"
    onClick={onClick}
    aria-label={label}
    disabled={disabled}
    {...rest}
  >
    <Icon className="h-5 w-5 mb-0.5" />
  </Button>
));
ToolButton.displayName = "ToolButton";


const ColorSwatch = ({ color, onClick, isSelected }: { color: string, onClick: () => void, isSelected: boolean }) => (
  <Button
    variant="outline"
    size="icon"
    className={cn(
      "rounded-full w-8 h-8 border-2",
      isSelected ? "border-ring ring-2 ring-offset-2 ring-offset-background ring-ring" : "border-muted-foreground/50 hover:border-foreground"
    )}
    style={{ backgroundColor: color }}
    onClick={onClick}
    aria-label={`Select color ${color}`}
  />
);

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

const drawingTools = ['draw', 'line', 'circle', 'square', 'arrow', 'triangle'];
const MAX_HISTORY_STEPS = 30;

export default function WhiteboardPage() {
  const params = useParams();
  const meetingId = params.meetingId as string;
  const { toast } = useToast();
  const router = useRouter();
  const { setHeaderContent } = useDynamicHeader();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const contextRef = useRef<CanvasRenderingContext2D | null>(null);
  const liveTextInputRef = useRef<HTMLTextAreaElement>(null);
  
  const operationStateRef = useRef<'idle' | 'drawing' | 'lassoing' | 'dragging'>('idle');
  const shapeStartPointRef = useRef<{ x: number; y: number } | null>(null);
  const currentDrawingPathRef = useRef<DrawnPath | null>(null);
  const lassoPathRef = useRef<{x: number, y: number}[]>([]);
  const canvasSnapshotRef = useRef<ImageData | null>(null);
  const dragStartOffsetRef = useRef<{ x: number, y: number, pathOffsets: Map<string, {x: number, y: number}[]>, textOffsets: Map<string, {x: number, y: number}> } | null>(null);

  const [activeTool, setActiveTool] = useState<string>("draw");
  const [selectedColor, setSelectedColor] = useState<string>("#000000");
  const [selectedBrushSize, setSelectedBrushSize] = useState<string>("medium");
  const [selectedTextSize, setSelectedTextSize] = useState<string>("medium");
  const [showDrawingToolOptions, setShowDrawingToolOptions] = useState<boolean>(true);
  const [canvasBackgroundColor, setCanvasBackgroundColor] = useState<string>("#FFFFFF");
  const [showClearConfirmDialog, setShowClearConfirmDialog] = useState(false);
  
  const [drawnPaths, setDrawnPaths] = useState<DrawnPath[]>([]);
  const [drawnTextObjects, setDrawnTextObjects] = useState<TextElement[]>([]);
  const [selectedPathIds, setSelectedPathIds] = useState<string[]>([]);
  const [selectedTextObjectIds, setSelectedTextObjectIds] = useState<string[]>([]);
  
  const [isTypingText, setIsTypingText] = useState(false);
  const [currentText, setCurrentText] = useState('');
  const [textInputPosition, setTextInputPosition] = useState<{ x: number, y: number } | null>(null);

  const [history, setHistory] = useState<HistoryState[]>([{ paths: [], texts: [] }]);
  const [historyStep, setHistoryStep] = useState<number>(0);

  const availableColors = [ "#000000", "#EF4444", "#F97316", "#EAB308", "#22C55E", "#0EA5E9", "#6366F1", "#EC4899", "#A855F7", "#8B5CF6", "#3B82F6", "#10B981", "#F59E0B", "#D946EF", "#78716C", "#FFFFFF" ];
  const brushSizes = [ { name: 'tiny', lineWidth: 1 }, { name: 'small', lineWidth: 3 }, { name: 'medium', lineWidth: 6 }, { name: 'large', lineWidth: 10 }, { name: 'xlarge', lineWidth: 15 } ];
  const textSizes = [ { name: 'small', fontSize: 12 }, { name: 'medium', fontSize: 16 }, { name: 'large', fontSize: 24 }, { name: 'xlarge', fontSize: 32 } ];

  const getLineWidth = useCallback(() => brushSizes.find(b => b.name === selectedBrushSize)?.lineWidth || 6, [selectedBrushSize]);
  const getFontSize = useCallback(() => textSizes.find(s => s.name === selectedTextSize)?.fontSize || 16, [selectedTextSize]);

  const saveStateToHistory = useCallback((newPaths: DrawnPath[], newTexts: TextElement[]) => {
      setHistory(prevHistory => {
          const currentCanvasState = { paths: newPaths, texts: newTexts };
          const newHistory = prevHistory.slice(0, historyStep + 1);
          let updatedHistory = [...newHistory, currentCanvasState];
          if (updatedHistory.length > MAX_HISTORY_STEPS) {
              updatedHistory = updatedHistory.slice(updatedHistory.length - MAX_HISTORY_STEPS);
          }
          setHistoryStep(updatedHistory.length - 1);
          return updatedHistory;
      });
  }, [historyStep]);

  const drawPath = useCallback((ctx: CanvasRenderingContext2D, path: DrawnPath) => {
      if (path.points.length < 1) return;
      ctx.beginPath();
      ctx.strokeStyle = path.color;
      ctx.lineWidth = path.lineWidth;
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

  const drawSelectionBox = useCallback((ctx: CanvasRenderingContext2D, items: (DrawnPath | TextElement)[]) => {
      if (items.length === 0) return;
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      items.forEach(item => {
          if ('points' in item) {
              item.points.forEach(p => {
                  minX = Math.min(minX, p.x); minY = Math.min(minY, p.y);
                  maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y);
              });
          } else {
              minX = Math.min(minX, item.x); minY = Math.min(minY, item.y);
              maxX = Math.max(maxX, item.x + item.width); maxY = Math.max(maxY, item.y + item.height);
          }
      });
      ctx.strokeStyle = "rgba(0, 123, 255, 0.7)";
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 2]);
      ctx.strokeRect(minX - 5, minY - 5, (maxX - minX) + 10, (maxY - minY) + 10);
      ctx.setLineDash([]);
  }, []);

  const redrawCanvasContent = useCallback(() => {
    if (!contextRef.current || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const context = contextRef.current;
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = canvasBackgroundColor;
    context.fillRect(0, 0, canvas.width, canvas.height);

    drawnPaths.forEach(path => drawPath(context, path));
    drawnTextObjects.forEach(textObj => drawText(context, textObj));
    
    const selectedItems = [
      ...drawnPaths.filter(p => selectedPathIds.includes(p.id)),
      ...drawnTextObjects.filter(t => selectedTextObjectIds.includes(t.id))
    ];
    if (selectedItems.length > 0) {
      drawSelectionBox(context, selectedItems);
    }
  }, [canvasBackgroundColor, drawnPaths, drawnTextObjects, selectedPathIds, selectedTextObjectIds, drawPath, drawText, drawSelectionBox]);

  useEffect(() => {
    redrawCanvasContent();
  }, [redrawCanvasContent]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
        contextRef.current = canvas.getContext("2d", { willReadFrequently: true });
        if (contextRef.current) {
            contextRef.current.lineCap = "round";
            contextRef.current.lineJoin = "round";
        }
    }
  }, []);

  const finalizeLiveText = useCallback(() => {
    if (!isTypingText || !contextRef.current) return;
    const textToDraw = currentText.trimEnd();
    if (textToDraw && textInputPosition) {
        const fontSize = getFontSize();
        const font = `${fontSize}px sans-serif`;
        const lineHeight = fontSize * 1.2;
        const lines = textToDraw.split('\n');
        let maxWidth = 0;
        contextRef.current.font = font;
        lines.forEach(line => maxWidth = Math.max(maxWidth, contextRef.current!.measureText(line).width));
        const textHeight = lines.length * lineHeight;
        const newTextElement: TextElement = { id: Date.now().toString(), textLines: lines, x: textInputPosition.x, y: textInputPosition.y, color: selectedColor, fontSize, font, lineHeight, width: maxWidth, height: textHeight };
        
        const newPaths = history[historyStep].paths;
        const newTexts = [...history[historyStep].texts, newTextElement];
        setDrawnTextObjects(newTexts);
        saveStateToHistory(newPaths, newTexts);
    }
    setIsTypingText(false);
    setCurrentText('');
    setTextInputPosition(null);
  }, [isTypingText, currentText, textInputPosition, selectedColor, getFontSize, saveStateToHistory, history, historyStep]);

  const getPointerPosition = useCallback((event: React.MouseEvent | React.TouchEvent | MouseEvent | TouchEvent): { x: number, y: number } | null => {
      const canvas = canvasRef.current;
      if (!canvas) return null;
      const rect = canvas.getBoundingClientRect();
      const nativeEvent = 'nativeEvent' in event ? event.nativeEvent : event;
      const clientX = 'touches' in nativeEvent ? (nativeEvent.touches[0] || nativeEvent.changedTouches[0]).clientX : (nativeEvent as MouseEvent).clientX;
      const clientY = 'touches' in nativeEvent ? (nativeEvent.touches[0] || nativeEvent.changedTouches[0]).clientY : (nativeEvent as MouseEvent).clientY;
      if (typeof clientX !== 'number' || typeof clientY !== 'number') return null;
      return { x: clientX - rect.left, y: clientY - rect.top };
  }, []);

  const isPointInPolygon = (point: {x: number, y: number}, polygon: {x: number, y: number}[]) => {
    let isInside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        if (((polygon[i].y > point.y) !== (polygon[j].y > point.y)) && (point.x < (polygon[j].x - polygon[i].x) * (point.y - polygon[i].y) / (polygon[j].y - polygon[i].y) + polygon[i].x)) isInside = !isInside;
    }
    return isInside;
  };
  
  const handlePointerDown = useCallback((event: React.MouseEvent | React.TouchEvent) => {
      if ((event as React.MouseEvent).button !== 0) return;
      const pos = getPointerPosition(event);
      if (!pos || !canvasRef.current || !contextRef.current) return;

      if (isTypingText) finalizeLiveText();
      
      canvasSnapshotRef.current = contextRef.current.getImageData(0, 0, canvasRef.current.width, canvasRef.current.height);
      shapeStartPointRef.current = pos;

      if (activeTool === 'select') {
          const clickedOnSelection = [
            ...drawnPaths.filter(p => selectedPathIds.includes(p.id)),
            ...drawnTextObjects.filter(t => selectedTextObjectIds.includes(t.id))
          ].some(item => {
              if('points' in item) return item.points.some(p => Math.hypot(p.x - pos.x, p.y - pos.y) < item.lineWidth / 2 + 5);
              return pos.x >= item.x && pos.x <= item.x + item.width && pos.y >= item.y && pos.y <= item.y + item.height;
          });

          if (clickedOnSelection) {
              operationStateRef.current = 'dragging';
              const pathOffsets = new Map(selectedPathIds.map(id => [id, drawnPaths.find(p => p.id === id)!.points]));
              const textOffsets = new Map(selectedTextObjectIds.map(id => {
                  const textObj = drawnTextObjects.find(t=>t.id===id)!;
                  return [id, {x: textObj.x, y: textObj.y}]
              }));
              dragStartOffsetRef.current = { x: pos.x, y: pos.y, pathOffsets, textOffsets };
          } else {
              operationStateRef.current = 'lassoing';
              lassoPathRef.current = [pos];
              setSelectedPathIds([]);
              setSelectedTextObjectIds([]);
          }
      } else if (activeTool === 'text') {
          setTextInputPosition(pos);
          setCurrentText('');
          setIsTypingText(true);
          setTimeout(() => liveTextInputRef.current?.focus(), 0);
      } else if (activeTool && (drawingTools.includes(activeTool) || activeTool === 'erase')) {
          operationStateRef.current = 'drawing';
          currentDrawingPathRef.current = { id: Date.now().toString(), points: [pos], color: activeTool === 'erase' ? canvasBackgroundColor : selectedColor, lineWidth: getLineWidth() };
      }
  }, [getPointerPosition, isTypingText, finalizeLiveText, activeTool, selectedPathIds, selectedTextObjectIds, drawnPaths, drawnTextObjects, canvasBackgroundColor, selectedColor, getLineWidth]);

  const handlePointerMove = useCallback((event: MouseEvent | TouchEvent) => {
    if (operationStateRef.current === 'idle') return;
    const pos = getPointerPosition(event);
    if (!pos || !canvasSnapshotRef.current || !contextRef.current) return;
    
    contextRef.current.putImageData(canvasSnapshotRef.current, 0, 0);

    if (operationStateRef.current === 'drawing' && currentDrawingPathRef.current) {
        const start = shapeStartPointRef.current!;
        let newPoints: {x: number, y: number}[];
        if (activeTool === 'draw' || activeTool === 'erase') {
            newPoints = [...currentDrawingPathRef.current.points, pos];
        } else {
            newPoints = [];
            if (activeTool === 'line') newPoints.push(start, pos);
            else if (activeTool === 'square') newPoints.push(start, {x: pos.x, y: start.y}, pos, {x: start.x, y: pos.y}, start);
            else if (activeTool === 'circle') {
                const radius = Math.hypot(pos.x - start.x, pos.y - start.y) / 2;
                const centerX = start.x + (pos.x - start.x) / 2, centerY = start.y + (pos.y - start.y) / 2;
                for (let i = 0; i <= 360; i += 10) newPoints.push({ x: centerX + radius * Math.cos(i * Math.PI / 180), y: centerY + radius * Math.sin(i * Math.PI / 180) });
            } else if (activeTool === 'arrow') {
                const headlen = 10 + getLineWidth();
                const angle = Math.atan2(pos.y - start.y, pos.x - start.x);
                newPoints.push(start, pos, {x: pos.x - headlen * Math.cos(angle - Math.PI / 6), y: pos.y - headlen * Math.sin(angle - Math.PI / 6)}, pos, {x: pos.x - headlen * Math.cos(angle + Math.PI / 6), y: pos.y - headlen * Math.sin(angle + Math.PI / 6)});
            } else if (activeTool === 'triangle') newPoints.push({ x: start.x + (pos.x - start.x) / 2, y: start.y }, { x: start.x, y: pos.y }, { x: pos.x, y: pos.y }, { x: start.x + (pos.x - start.x) / 2, y: start.y });
        }
        currentDrawingPathRef.current.points = newPoints!;
        drawPath(contextRef.current, currentDrawingPathRef.current);
    } else if (operationStateRef.current === 'lassoing') {
        lassoPathRef.current.push(pos);
        contextRef.current.beginPath();
        contextRef.current.moveTo(lassoPathRef.current[0].x, lassoPathRef.current[0].y);
        lassoPathRef.current.forEach(p => contextRef.current!.lineTo(p.x, p.y));
        contextRef.current.strokeStyle = "rgba(0, 123, 255, 0.7)";
        contextRef.current.lineWidth = 1;
        contextRef.current.setLineDash([4, 2]);
        contextRef.current.stroke();
        contextRef.current.setLineDash([]);
    } else if (operationStateRef.current === 'dragging' && dragStartOffsetRef.current) {
        const deltaX = pos.x - dragStartOffsetRef.current.x, deltaY = pos.y - dragStartOffsetRef.current.y;
        const tempMovedItems: (DrawnPath | TextElement)[] = [];
        dragStartOffsetRef.current.pathOffsets.forEach((initialPoints, id) => {
            const originalPath = drawnPaths.find(p => p.id === id)!;
            tempMovedItems.push({ ...originalPath, points: initialPoints.map(p => ({ x: p.x + deltaX, y: p.y + deltaY })) });
        });
        dragStartOffsetRef.current.textOffsets.forEach((initialPos, id) => {
            const originalText = drawnTextObjects.find(t => t.id === id)!;
            tempMovedItems.push({ ...originalText, x: initialPos.x + deltaX, y: initialPos.y + deltaY });
        });
        tempMovedItems.forEach(item => 'points' in item ? drawPath(contextRef.current!, item) : drawText(contextRef.current!, item));
        drawSelectionBox(contextRef.current, tempMovedItems);
    }
  }, [getPointerPosition, activeTool, getLineWidth, drawPath, drawText, drawSelectionBox, drawnPaths, drawnTextObjects]);

  const handlePointerUp = useCallback((event: MouseEvent | TouchEvent) => {
    const pos = getPointerPosition(event);
    if (!pos || !contextRef.current) return;

    if (operationStateRef.current === 'drawing' && currentDrawingPathRef.current) {
        const newPaths = [...drawnPaths, currentDrawingPathRef.current];
        setDrawnPaths(newPaths);
        saveStateToHistory(newPaths, drawnTextObjects);
    } else if (operationStateRef.current === 'lassoing') {
        const finalLassoPath = lassoPathRef.current;
        const selectedPaths = drawnPaths.filter(path => path.points.some(p => isPointInPolygon(p, finalLassoPath))).map(p => p.id);
        const selectedTexts = drawnTextObjects.filter(obj => isPointInPolygon({x: obj.x + obj.width/2, y: obj.y + obj.height/2}, finalLassoPath)).map(t => t.id);
        setSelectedPathIds(selectedPaths);
        setSelectedTextObjectIds(selectedTexts);
    } else if (operationStateRef.current === 'dragging' && dragStartOffsetRef.current) {
        const deltaX = pos.x - dragStartOffsetRef.current.x, deltaY = pos.y - dragStartOffsetRef.current.y;
        const finalPaths = drawnPaths.map(path => {
            if (selectedPathIds.includes(path.id)) return { ...path, points: dragStartOffsetRef.current!.pathOffsets.get(path.id)!.map(p => ({ x: p.x + deltaX, y: p.y + deltaY })) };
            return path;
        });
        const finalTexts = drawnTextObjects.map(text => {
            if (selectedTextObjectIds.includes(text.id)) return { ...text, x: dragStartOffsetRef.current!.textOffsets.get(text.id)!.x + deltaX, y: dragStartOffsetRef.current!.textOffsets.get(text.id)!.y + deltaY };
            return text;
        });
        setDrawnPaths(finalPaths);
        setDrawnTextObjects(finalTexts);
        saveStateToHistory(finalPaths, finalTexts);
    }

    operationStateRef.current = 'idle';
    currentDrawingPathRef.current = null;
    shapeStartPointRef.current = null;
    canvasSnapshotRef.current = null;
    dragStartOffsetRef.current = null;
    lassoPathRef.current = [];
    
    redrawCanvasContent();
  }, [getPointerPosition, drawnPaths, drawnTextObjects, saveStateToHistory, redrawCanvasContent, selectedPathIds, selectedTextObjectIds]);

  const handleToolClick = (toolName: string) => {
    if (isTypingText) finalizeLiveText();
    const isOptionsTool = drawingTools.includes(toolName) || ['erase', 'text', 'select'].includes(toolName);
    if (activeTool === toolName && isOptionsTool) setShowDrawingToolOptions(prev => !prev);
    else { setActiveTool(toolName); setShowDrawingToolOptions(isOptionsTool); }
    if (toolName !== 'select') { setSelectedPathIds([]); setSelectedTextObjectIds([]); }
  };

  const handleUndo = useCallback(() => {
    if (isTypingText) finalizeLiveText();
    if (historyStep > 0) {
      const prevStep = historyStep - 1;
      setHistoryStep(prevStep);
      setDrawnPaths(history[prevStep].paths);
      setDrawnTextObjects(history[prevStep].texts);
    } else toast({ title: "Nothing to undo", duration: 2000 });
  }, [historyStep, history, toast, finalizeLiveText]);

  const handleRedo = useCallback(() => {
    if (isTypingText) finalizeLiveText();
    if (historyStep < history.length - 1) {
      const nextStep = historyStep + 1;
      setHistoryStep(nextStep);
      setDrawnPaths(history[nextStep].paths);
      setDrawnTextObjects(history[nextStep].texts);
    } else toast({ title: "Nothing to redo", duration: 2000 });
  }, [historyStep, history, toast, finalizeLiveText]);

  useEffect(() => {
    const handleGlobalPointerMove = (e: MouseEvent | TouchEvent) => handlePointerMove(e);
    const handleGlobalPointerUp = (e: MouseEvent | TouchEvent) => handlePointerUp(e);
    
    window.addEventListener('mousemove', handleGlobalPointerMove);
    window.addEventListener('mouseup', handleGlobalPointerUp);
    window.addEventListener('touchmove', handleGlobalPointerMove, { passive: false });
    window.addEventListener('touchend', handleGlobalPointerUp);
    return () => {
        window.removeEventListener('mousemove', handleGlobalPointerMove);
        window.removeEventListener('mouseup', handleGlobalPointerUp);
        window.removeEventListener('touchmove', handleGlobalPointerMove);
        window.removeEventListener('touchend', handleGlobalPointerUp);
    };
  }, [handlePointerMove, handlePointerUp]);

  useEffect(() => {
    const storedBg = localStorage.getItem("teachmeet-whiteboard-bg-color"); if (storedBg) setCanvasBackgroundColor(storedBg);
    const storedPen = localStorage.getItem("teachmeet-whiteboard-pen-color"); if (storedPen) setSelectedColor(storedPen);
  }, []);

  useEffect(() => {
    setHeaderContent(<div className="flex items-center justify-between w-full"><div className="flex items-center gap-3"><Edit3 className="h-7 w-7 text-primary" /><h1 className="text-xl font-semibold truncate">TeachMeet Whiteboard</h1></div>{meetingId && <Link href={`/dashboard/meeting/${meetingId}`} passHref legacyBehavior><Button variant="outline" size="sm" className="rounded-lg"><ArrowLeft className="mr-2 h-4 w-4" />Back</Button></Link>}</div>);
    return () => setHeaderContent(null);
  }, [setHeaderContent, meetingId]);

  return (
    <>
      <textarea ref={liveTextInputRef} value={currentText} onChange={e => setCurrentText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); setCurrentText(prev => prev + '\n'); }}} onBlur={finalizeLiveText} style={{ position: 'absolute', opacity: 0, width: 1, height: 1, border: 'none', padding: 0, top: -9999, left: -9999 }} tabIndex={-1} />
      <div className="flex flex-col h-full bg-muted/30">
        <div className="flex-none p-2 border-b bg-background shadow-md sticky top-16 z-20">
          <div className="container mx-auto flex flex-wrap items-center justify-center gap-2">
             <ToolButton icon={Lasso} label="Lasso Select" onClick={() => handleToolClick("select")} isActive={activeTool === "select"}/>
             <ToolButton icon={Brush} label="Draw" onClick={() => handleToolClick("draw")} isActive={drawingTools.includes(activeTool || "") && activeTool !== "erase"} />
             <ToolButton icon={Type} label="Text" onClick={() => handleToolClick("text")} isActive={activeTool === "text"}/>
             <ToolButton icon={Eraser} label="Erase" onClick={() => handleToolClick("erase")} isActive={activeTool === "erase"}/>
             <ToolButton icon={Undo2} label="Undo" onClick={handleUndo} disabled={historyStep <= 0} />
             <ToolButton icon={Redo2} label="Redo" onClick={handleRedo} disabled={historyStep >= history.length - 1}/>
             <AlertDialog open={showClearConfirmDialog} onOpenChange={setShowClearConfirmDialog}>
                <AlertDialogTrigger asChild>
                    <Button variant="outline" size="icon" className="rounded-lg w-12 h-12 flex flex-col items-center justify-center text-xs" aria-label="Clear">
                        <Trash2 className="h-5 w-5 mb-0.5" />
                    </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="rounded-xl"><AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle><AlertDialogDescription>This will clear the entire whiteboard. This action cannot be undone.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel className="rounded-lg">Cancel</AlertDialogCancel><AlertDialogAction onClick={() => { setDrawnPaths([]); setDrawnTextObjects([]); saveStateToHistory([], []); }} className="rounded-lg">Clear Whiteboard</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
             </AlertDialog>
          </div>
        </div>

        {showDrawingToolOptions && activeTool && (
           <div className="p-3 border-b bg-muted/50 absolute top-32 left-0 right-0 z-10 shadow-lg">
             <div className="container mx-auto">
                {activeTool === 'select' ? ( <div className="text-center"><p className="text-sm text-muted-foreground">Lasso Select active. Drag to select items.</p>{(selectedPathIds.length + selectedTextObjectIds.length) > 0 && <p className="text-xs text-primary">{(selectedPathIds.length + selectedTextObjectIds.length)} item(s) selected. Drag to move.</p>}</div> ) 
                : activeTool === 'text' ? (
                    <div className="flex flex-col md:flex-row md:items-center md:justify-center flex-wrap gap-x-6 gap-y-4">
                      <div><span className="text-xs font-medium text-muted-foreground">Color:</span><div className="flex flex-wrap gap-2 mt-1">{availableColors.map(c => (<ColorSwatch key={c} color={c} onClick={() => setSelectedColor(c)} isSelected={selectedColor === c} />))}</div></div>
                      <div><span className="text-xs font-medium text-muted-foreground">Text Size:</span><div className="flex gap-2 mt-1">{textSizes.map(s => (<Button key={s.name} variant={selectedTextSize === s.name ? "default" : "outline"} size="sm" className="rounded-lg" onClick={() => setSelectedTextSize(s.name)}>{s.name.charAt(0).toUpperCase() + s.name.slice(1)}</Button>))}</div></div>
                    </div>
                ) : activeTool === 'erase' ? (
                    <div><span className="text-xs font-medium text-muted-foreground">Eraser Size:</span><div className="flex gap-2 mt-1">{brushSizes.map(b => (<Button key={b.name} variant={selectedBrushSize === b.name ? "default" : "outline"} size="icon" className="rounded-lg w-10 h-10" onClick={() => setSelectedBrushSize(b.name)}><CircleIconShape className={cn("h-5 w-5", b.name === 'tiny' && 'h-2 w-2', b.name === 'small' && 'h-3 w-3', b.name === 'large' && 'h-6 w-6', b.name === 'xlarge' && 'h-7 w-7')} /></Button>))}</div></div>
                ) : (
                    <div className="flex flex-col md:flex-row md:items-center md:justify-center flex-wrap gap-x-6 gap-y-4">
                        <div><span className="text-xs font-medium text-muted-foreground">Color:</span><div className="flex flex-wrap gap-2 mt-1">{availableColors.map(c => (<ColorSwatch key={c} color={c} onClick={() => setSelectedColor(c)} isSelected={selectedColor === c} />))}</div></div>
                        <div><span className="text-xs font-medium text-muted-foreground">Size:</span><div className="flex gap-2 mt-1">{brushSizes.map(b => (<Button key={b.name} variant={selectedBrushSize === b.name ? "default" : "outline"} size="icon" className="rounded-lg w-10 h-10" onClick={() => setSelectedBrushSize(b.name)}><CircleIconShape className={cn("h-5 w-5", b.name === 'tiny' && 'h-2 w-2', b.name === 'small' && 'h-3 w-3', b.name === 'large' && 'h-6 w-6', b.name === 'xlarge' && 'h-7 w-7')} /></Button>))}</div></div>
                        <div><span className="text-xs font-medium text-muted-foreground">Shape:</span><div className="flex flex-wrap gap-2 mt-1">{[ {tool: "draw", icon: Edit3, label: "Freehand"}, {tool: "line", icon: Minus, label: "Line"}, {tool: "arrow", icon: ArrowRight, label: "Arrow"}, {tool: "circle", icon: CircleIconShape, label: "Circle"}, {tool: "square", icon: SquareIconShape, label: "Square"}, {tool: "triangle", icon: TriangleIcon, label: "Triangle"} ].map(t => (<ToolButton key={t.tool} icon={t.icon} label={t.label} onClick={() => setActiveTool(t.tool)} isActive={activeTool === t.tool}/>))}</div></div>
                    </div>
                )}
             </div>
           </div>
        )}

        <main className="flex-grow flex flex-col overflow-hidden min-h-0"> 
          <Card className="w-full h-full max-w-full text-center shadow-none rounded-none border-0 flex flex-col overflow-hidden">
            <CardContent className="flex-grow bg-card flex items-center justify-center relative p-0"> 
              <canvas 
                ref={canvasRef} 
                onMouseDown={handlePointerDown} 
                onTouchStart={handlePointerDown} 
                width={800} height={600} 
                className="touch-none w-full h-full block" 
                style={{ backgroundColor: canvasBackgroundColor }} 
              />
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
