
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
  'data-options-toggler'?: boolean;
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

  const [activeTool, setActiveTool] = useState<string | null>("draw");

  const [selectedColor, setSelectedColor] = useState<string>("#000000");
  const [selectedBrushSize, setSelectedBrushSize] = useState<string>("medium");
  const [selectedTextSize, setSelectedTextSize] = useState<string>("medium");
  const [showDrawingToolOptions, setShowDrawingToolOptions] = useState<boolean>(true);
  const [showClearConfirmDialog, setShowClearConfirmDialog] = useState<boolean>(false);
  const [canvasBackgroundColor, setCanvasBackgroundColor] = useState<string>("#FFFFFF");

  const [history, setHistory] = useState<HistoryState[]>([{ paths: [], texts: [] }]);
  const [historyStep, setHistoryStep] = useState<number>(0);
  
  const [drawnPaths, setDrawnPaths] = useState<DrawnPath[]>([]);
  const [drawnTextObjects, setDrawnTextObjects] = useState<TextElement[]>([]);
  const [selectedPathIds, setSelectedPathIds] = useState<string[]>([]);
  const [selectedTextObjectIds, setSelectedTextObjectIds] = useState<string[]>([]);
  
  const [currentDrawingPath, setCurrentDrawingPath] = useState<DrawnPath | null>(null);
  const [isTypingText, setIsTypingText] = useState(false);
  const [currentText, setCurrentText] = useState('');
  const [textInputPosition, setTextInputPosition] = useState<{ x: number, y: number } | null>(null);
  const liveTextInputRef = useRef<HTMLTextAreaElement>(null);
  const [cursorBlinkVisible, setCursorBlinkVisible] = useState(true);
  const cursorIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const [isDrawingLasso, setIsDrawingLasso] = useState(false);
  const [lassoPath, setLassoPath] = useState<{x: number, y: number}[]>([]);
  const [isDraggingSelection, setIsDraggingSelection] = useState(false);
  const dragStartOffsetRef = useRef<{ x: number, y: number, pathOffsets: Map<string, {x: number, y: number}[]>, textOffsets: Map<string, {x: number, y: number}> } | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const contextRef = useRef<CanvasRenderingContext2D | null>(null);
  const drawingOptionsToolbarRef = useRef<HTMLDivElement>(null);
  const isDrawingRef = useRef(false);
  const shapeStartPointRef = useRef<{ x: number, y: number } | null>(null);

  const availableColors = [ "#000000", "#EF4444", "#F97316", "#EAB308", "#22C55E", "#0EA5E9", "#6366F1", "#EC4899", "#A855F7", "#8B5CF6", "#3B82F6", "#10B981", "#F59E0B", "#D946EF", "#78716C", "#FFFFFF" ];
  const brushSizes = [ { name: 'tiny', icon: CircleIconShape, label: 'Tiny Brush', lineWidth: 1 }, { name: 'small', icon: CircleIconShape, label: 'Small Brush', lineWidth: 3 }, { name: 'medium', icon: CircleIconShape, label: 'Medium Brush', lineWidth: 6 }, { name: 'large', icon: CircleIconShape, label: 'Large Brush', lineWidth: 10 }, { name: 'xlarge', icon: CircleIconShape, label: 'X-Large Brush', lineWidth: 15 } ];
  const textSizes = [ { name: 'small', label: 'Small Text', fontSize: 12 }, { name: 'medium', label: 'Medium Text', fontSize: 16 }, { name: 'large', label: 'Large Text', fontSize: 24 }, { name: 'xlarge', label: 'X-Large Text', fontSize: 32 } ];

  const getLineWidth = useCallback(() => brushSizes.find(b => b.name === selectedBrushSize)?.lineWidth || 6, [selectedBrushSize]);
  const getFontSize = useCallback(() => textSizes.find(s => s.name === selectedTextSize)?.fontSize || 16, [selectedTextSize]);

  useEffect(() => {
    if (history[historyStep]) {
        setDrawnPaths(history[historyStep].paths);
        setDrawnTextObjects(history[historyStep].texts);
    }
  }, [history, historyStep]);

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

  const redrawCanvasContent = useCallback(() => {
    if (!contextRef.current || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const context = contextRef.current;
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = canvasBackgroundColor;
    context.fillRect(0, 0, canvas.width, canvas.height);

    const drawPath = (path: DrawnPath) => {
        context.beginPath();
        context.strokeStyle = path.color;
        context.lineWidth = path.lineWidth;
        context.moveTo(path.points[0].x, path.points[0].y);
        for (let i = 1; i < path.points.length; i++) context.lineTo(path.points[i].x, path.points[i].y);
        context.stroke();
    };

    drawnPaths.forEach(path => {
        drawPath(path);
        if (selectedPathIds.includes(path.id)) {
            const minX = Math.min(...path.points.map(p => p.x));
            const minY = Math.min(...path.points.map(p => p.y));
            const maxX = Math.max(...path.points.map(p => p.x));
            const maxY = Math.max(...path.points.map(p => p.y));
            context.strokeStyle = "rgba(0, 123, 255, 0.7)";
            context.lineWidth = 1;
            context.setLineDash([4, 2]);
            context.strokeRect(minX - 5, minY - 5, (maxX - minX) + 10, (maxY - minY) + 10);
            context.setLineDash([]);
        }
    });

    if (currentDrawingPath) drawPath(currentDrawingPath);

    drawnTextObjects.forEach(textObj => {
        context.fillStyle = textObj.color;
        context.font = textObj.font;
        context.textAlign = "left";
        context.textBaseline = "top";
        textObj.textLines.forEach((line, index) => context.fillText(line, textObj.x, textObj.y + (index * textObj.lineHeight)));
        if (selectedTextObjectIds.includes(textObj.id)) {
            context.strokeStyle = "rgba(0, 123, 255, 0.7)";
            context.lineWidth = 1;
            context.setLineDash([4, 2]);
            context.strokeRect(textObj.x - 2, textObj.y - 2, textObj.width + 4, textObj.height + 4);
            context.setLineDash([]);
        }
    });

    if (isTypingText && textInputPosition) {
        const liveFontSize = getFontSize();
        const liveLineHeight = liveFontSize * 1.2;
        context.fillStyle = selectedColor;
        context.font = `${liveFontSize}px sans-serif`;
        context.textAlign = "left";
        context.textBaseline = "top";
        const lines = currentText.split('\n');
        lines.forEach((line, index) => context.fillText(line, textInputPosition.x, textInputPosition.y + (index * liveLineHeight)));
        if (cursorBlinkVisible) {
            const lastLine = lines[lines.length - 1];
            const cursorX = textInputPosition.x + context.measureText(lastLine).width;
            const cursorY = textInputPosition.y + (lines.length - 1) * liveLineHeight;
            context.beginPath();
            context.moveTo(cursorX, cursorY);
            context.lineTo(cursorX, cursorY + liveFontSize);
            context.strokeStyle = selectedColor;
            context.lineWidth = 1;
            context.stroke();
        }
    }

    if (isDrawingLasso && lassoPath.length > 1) {
        context.beginPath();
        context.moveTo(lassoPath[0].x, lassoPath[0].y);
        for (let i = 1; i < lassoPath.length; i++) context.lineTo(lassoPath[i].x, lassoPath[i].y);
        context.strokeStyle = "rgba(0, 123, 255, 0.7)";
        context.lineWidth = 1;
        context.setLineDash([4, 2]);
        context.stroke();
        context.setLineDash([]);
    }
  }, [canvasBackgroundColor, drawnPaths, drawnTextObjects, selectedPathIds, selectedTextObjectIds, currentDrawingPath, isTypingText, textInputPosition, currentText, cursorBlinkVisible, getFontSize, selectedColor, isDrawingLasso, lassoPath]);

  useEffect(() => {
    const storedBg = localStorage.getItem("teachmeet-whiteboard-bg-color");
    if (storedBg) setCanvasBackgroundColor(storedBg);
    const storedPen = localStorage.getItem("teachmeet-whiteboard-pen-color");
    if (storedPen) setSelectedColor(storedPen);
  }, []);

  useEffect(() => {
    let intervalId: NodeJS.Timeout;
    if (isTypingText) {
      intervalId = setInterval(() => setCursorBlinkVisible(prev => !prev), 500);
    } else {
      setCursorBlinkVisible(true);
    }
    return () => clearInterval(intervalId);
  }, [isTypingText]);

  useEffect(() => {
    setHeaderContent(<div className="flex items-center justify-between w-full"><div className="flex items-center gap-3"><Edit3 className="h-7 w-7 text-primary" /><h1 className="text-xl font-semibold truncate">TeachMeet Whiteboard</h1></div>{meetingId && <Link href={`/dashboard/meeting/${meetingId}`} passHref legacyBehavior><Button variant="outline" size="sm" className="rounded-lg"><ArrowLeft className="mr-2 h-4 w-4" />Back</Button></Link>}</div>);
    return () => setHeaderContent(null);
  }, [setHeaderContent, meetingId]);

  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (canvas && canvas.parentElement) {
        const context = contextRef.current;
        const newWidth = canvas.parentElement.clientWidth;
        const newHeight = canvas.parentElement.clientHeight;
        if (canvas.width !== newWidth || canvas.height !== newHeight) {
            const tempCanvas = document.createElement('canvas');
            const tempCtx = tempCanvas.getContext('2d');
            if (tempCtx) {
                tempCanvas.width = canvas.width;
                tempCanvas.height = canvas.height;
                tempCtx.drawImage(canvas, 0, 0);
                canvas.width = newWidth;
                canvas.height = newHeight;
                if (context) {
                    context.lineCap = "round";
                    context.lineJoin = "round";
                    context.drawImage(tempCanvas, 0, 0);
                    redrawCanvasContent();
                }
            }
        }
    }
  }, [redrawCanvasContent]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
        contextRef.current = canvas.getContext("2d", { willReadFrequently: true });
        if (contextRef.current) {
            contextRef.current.lineCap = "round";
            contextRef.current.lineJoin = "round";
        }
        resizeCanvas();
    }
    window.addEventListener("resize", resizeCanvas);
    return () => window.removeEventListener("resize", resizeCanvas);
  }, [resizeCanvas]);

  useEffect(() => { redrawCanvasContent(); }, [drawnPaths, drawnTextObjects, currentDrawingPath, redrawCanvasContent]);

  const finalizeLiveText = useCallback(() => {
    if (!isTypingText || !contextRef.current) return;
    const textToDraw = currentText.trimEnd();
    if (textToDraw && textInputPosition) {
        const fontSize = getFontSize();
        const font = `${fontSize}px sans-serif`;
        const lineHeight = fontSize * 1.2;
        const lines = textToDraw.split('\n');
        let maxWidth = 0;
        lines.forEach(line => {
            contextRef.current!.font = font;
            const metrics = contextRef.current!.measureText(line);
            if (metrics.width > maxWidth) maxWidth = metrics.width;
        });
        const textHeight = lines.length * lineHeight;
        const newTextElement: TextElement = { id: Date.now().toString(), textLines: lines, x: textInputPosition.x, y: textInputPosition.y, color: selectedColor, fontSize, font, lineHeight, width: maxWidth, height: textHeight };
        const newTexts = [...drawnTextObjects, newTextElement];
        setDrawnTextObjects(newTexts);
        saveStateToHistory(drawnPaths, newTexts);
    }
    setIsTypingText(false);
    setCurrentText('');
    setTextInputPosition(null);
  }, [isTypingText, currentText, textInputPosition, selectedColor, getFontSize, drawnTextObjects, drawnPaths, saveStateToHistory]);

  const getPointerPosition = useCallback((event: MouseEvent | TouchEvent | React.MouseEvent | React.TouchEvent): { x: number, y: number } | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const nativeEvent = 'nativeEvent' in event ? event.nativeEvent : event;
    const clientX = nativeEvent instanceof TouchEvent ? (nativeEvent.touches[0] || nativeEvent.changedTouches[0]).clientX : (nativeEvent as MouseEvent).clientX;
    const clientY = nativeEvent instanceof TouchEvent ? (nativeEvent.touches[0] || nativeEvent.changedTouches[0]).clientY : (nativeEvent as MouseEvent).clientY;
    if (typeof clientX !== 'number' || typeof clientY !== 'number') return null;
    return { x: clientX - rect.left, y: clientY - rect.top };
  }, []);

  const handlePointerDown = useCallback((event: React.MouseEvent | React.TouchEvent) => {
    if ((event as React.MouseEvent).nativeEvent instanceof MouseEvent && (event as React.MouseEvent).nativeEvent.button !== 0) return;
    const pos = getPointerPosition(event);
    if (!pos) return;
    if (isTypingText) finalizeLiveText();

    if (activeTool === 'select') {
        const onSelectedPath = selectedPathIds.some(id => {
            const path = drawnPaths.find(p => p.id === id);
            return path && path.points.some(point => Math.hypot(point.x - pos.x, point.y - pos.y) < path.lineWidth / 2 + 5);
        });
        const onSelectedText = selectedTextObjectIds.some(id => {
            const obj = drawnTextObjects.find(t => t.id === id);
            return obj && pos.x >= obj.x && pos.x <= obj.x + obj.width && pos.y >= obj.y && pos.y <= obj.y + obj.height;
        });

        if (onSelectedPath || onSelectedText) {
            setIsDraggingSelection(true);
            const pathOffsets = new Map<string, {x: number, y: number}[]>();
            selectedPathIds.forEach(id => { const path = drawnPaths.find(p => p.id === id); if (path) pathOffsets.set(id, path.points.map(p => ({...p}))); });
            const textOffsets = new Map<string, {x: number, y: number}>();
            selectedTextObjectIds.forEach(id => { const obj = drawnTextObjects.find(t => t.id === id); if (obj) textOffsets.set(id, {x: obj.x, y: obj.y}); });
            dragStartOffsetRef.current = { x: pos.x, y: pos.y, pathOffsets, textOffsets };
        } else {
            setIsDrawingLasso(true);
            setLassoPath([pos]);
            setSelectedPathIds([]);
            setSelectedTextObjectIds([]);
        }
    } else if (activeTool === 'text') {
        setTextInputPosition(pos);
        setCurrentText('');
        setIsTypingText(true);
        setTimeout(() => liveTextInputRef.current?.focus(), 0);
    } else if (activeTool && (drawingTools.includes(activeTool) || activeTool === 'erase')) {
        if (event.type === 'touchstart') event.preventDefault();
        isDrawingRef.current = true;
        shapeStartPointRef.current = pos;
        setCurrentDrawingPath({ id: Date.now().toString(), points: [pos], color: activeTool === 'erase' ? canvasBackgroundColor : selectedColor, lineWidth: getLineWidth() });
    }
  }, [activeTool, getPointerPosition, isTypingText, finalizeLiveText, selectedPathIds, selectedTextObjectIds, drawnPaths, drawnTextObjects, getLineWidth, selectedColor, canvasBackgroundColor]);

  const handlePointerMove = useCallback((event: MouseEvent | TouchEvent) => {
    const pos = getPointerPosition(event);
    if (!pos || !canvasRef.current) return;
    const canvas = canvasRef.current;
    
    if (isDrawingRef.current && currentDrawingPath) {
        if (event instanceof TouchEvent || (event.type === 'touchmove')) event.preventDefault();
        const start = shapeStartPointRef.current!;
        let newPoints: {x: number, y: number}[];
        if (activeTool === 'draw' || activeTool === 'erase') {
            newPoints = [...currentDrawingPath.points, pos];
        } else {
            newPoints = [];
            if (activeTool === 'line') { newPoints.push(start, pos); }
            else if (activeTool === 'square') { newPoints.push(start, {x: pos.x, y: start.y}, pos, {x: start.x, y: pos.y}, start); }
            else if (activeTool === 'circle') {
                const dx = pos.x - start.x, dy = pos.y - start.y;
                const radius = Math.hypot(dx, dy) / 2;
                const centerX = start.x + dx/2, centerY = start.y + dy/2;
                for (let i=0; i <= 360; i+=10) {
                    const angle = i * Math.PI / 180;
                    newPoints.push({ x: centerX + radius * Math.cos(angle), y: centerY + radius * Math.sin(angle) });
                }
            } else if (activeTool === 'arrow') {
                const headlen = 10 + getLineWidth();
                const angle = Math.atan2(pos.y - start.y, pos.x - start.x);
                newPoints.push(start, pos, {x: pos.x - headlen * Math.cos(angle - Math.PI / 6), y: pos.y - headlen * Math.sin(angle - Math.PI / 6)}, pos, {x: pos.x - headlen * Math.cos(angle + Math.PI / 6), y: pos.y - headlen * Math.sin(angle + Math.PI / 6)});
            } else if (activeTool === 'triangle') {
                newPoints.push({ x: start.x + (pos.x - start.x) / 2, y: start.y }, { x: start.x, y: pos.y }, { x: pos.x, y: pos.y }, { x: start.x + (pos.x - start.x) / 2, y: start.y });
            }
        }
        setCurrentDrawingPath(prev => prev ? {...prev, points: newPoints} : null);
        canvas.style.cursor = 'crosshair';
    } else if (isDrawingLasso) {
        if (event instanceof TouchEvent || (event.type === 'touchmove')) event.preventDefault();
        setLassoPath(prev => [...prev, pos]);
        canvas.style.cursor = 'crosshair';
    } else if (isDraggingSelection && dragStartOffsetRef.current) {
        if (event instanceof TouchEvent || (event.type === 'touchmove')) event.preventDefault();
        const deltaX = pos.x - dragStartOffsetRef.current.x, deltaY = pos.y - dragStartOffsetRef.current.y;
        setDrawnPaths(prevPaths => prevPaths.map(path => {
            if (selectedPathIds.includes(path.id)) {
                const initialPoints = dragStartOffsetRef.current!.pathOffsets.get(path.id)!;
                return { ...path, points: initialPoints.map(p => ({ x: p.x + deltaX, y: p.y + deltaY })) };
            }
            return path;
        }));
        setDrawnTextObjects(prevTexts => prevTexts.map(text => {
            if (selectedTextObjectIds.includes(text.id)) {
                const initialPos = dragStartOffsetRef.current!.textOffsets.get(text.id)!;
                return { ...text, x: initialPos.x + deltaX, y: initialPos.y + deltaY };
            }
            return text;
        }));
        canvas.style.cursor = 'grabbing';
    } else {
      let cursor = isTypingText || activeTool === 'text' ? 'text' : activeTool === 'select' ? 'crosshair' : (activeTool && (drawingTools.includes(activeTool) || activeTool === 'erase')) ? 'crosshair' : 'default';
      if(activeTool === 'select') {
        const onSelected = selectedPathIds.some(id => drawnPaths.find(p => p.id === id)?.points.some(point => Math.hypot(point.x - pos.x, point.y - pos.y) < 10)) || selectedTextObjectIds.some(id => { const obj = drawnTextObjects.find(t => t.id === id); return obj && pos.x >= obj.x && pos.x <= obj.x + obj.width && pos.y >= obj.y && pos.y <= obj.y + obj.height; });
        if(onSelected) cursor = 'grab';
      }
      canvas.style.cursor = cursor;
    }
  }, [getPointerPosition, isDrawingRef.current, currentDrawingPath, activeTool, getLineWidth, isDrawingLasso, isDraggingSelection, selectedPathIds, selectedTextObjectIds, drawnPaths, drawnTextObjects]);

  const isPointInPolygon = (point: {x: number, y: number}, polygon: {x: number, y: number}[]) => {
      let isInside = false;
      for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
          const intersect = ((polygon[i].y > point.y) !== (polygon[j].y > point.y)) && (point.x < (polygon[j].x - polygon[i].x) * (point.y - polygon[i].y) / (polygon[j].y - polygon[i].y) + polygon[i].x);
          if (intersect) isInside = !isInside;
      }
      return isInside;
  };

  const handlePointerUp = useCallback(() => {
    if (isDrawingRef.current && currentDrawingPath) {
        const newPaths = [...drawnPaths, currentDrawingPath];
        setDrawnPaths(newPaths);
        saveStateToHistory(newPaths, drawnTextObjects);
    }
    isDrawingRef.current = false;
    setCurrentDrawingPath(null);
    shapeStartPointRef.current = null;
    
    if (isDrawingLasso) {
        const selectedPaths = drawnPaths.filter(path => path.points.some(p => isPointInPolygon(p, lassoPath))).map(p => p.id);
        setSelectedPathIds(selectedPaths);
        const selectedTexts = drawnTextObjects.filter(obj => isPointInPolygon({x: obj.x + obj.width/2, y: obj.y + obj.height/2}, lassoPath)).map(t => t.id);
        setSelectedTextObjectIds(selectedTexts);
        setIsDrawingLasso(false);
        setLassoPath([]);
    }

    if (isDraggingSelection) {
        setIsDraggingSelection(false);
        dragStartOffsetRef.current = null;
        saveStateToHistory(drawnPaths, drawnTextObjects);
    }
  }, [currentDrawingPath, drawnPaths, drawnTextObjects, saveStateToHistory, isDrawingLasso, lassoPath, isDraggingSelection]);
  
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const eventOptions = { passive: false };
    canvas.addEventListener('mousemove', handlePointerMove);
    canvas.addEventListener('mouseup', handlePointerUp);
    canvas.addEventListener('mouseout', handlePointerUp);
    canvas.addEventListener('touchmove', handlePointerMove, eventOptions);
    canvas.addEventListener('touchend', handlePointerUp, eventOptions);
    return () => {
        canvas.removeEventListener('mousemove', handlePointerMove);
        canvas.removeEventListener('mouseup', handlePointerUp);
        canvas.removeEventListener('mouseout', handlePointerUp);
        canvas.removeEventListener('touchmove', handlePointerMove);
        canvas.removeEventListener('touchend', handlePointerUp);
    };
  }, [handlePointerMove, handlePointerUp]);

  const handleToolClick = (toolName: string) => {
    const toolId = toolName.toLowerCase().replace(/\s+/g, '');
    if (isTypingText && toolId !== 'text') finalizeLiveText();
    const isOptionsTool = drawingTools.includes(toolId) || ['erase', 'text', 'select'].includes(toolId);
    if (activeTool === toolId && isOptionsTool) {
      setShowDrawingToolOptions(prev => !prev);
    } else {
      setActiveTool(toolId);
      setShowDrawingToolOptions(isOptionsTool);
    }
    if (toolId !== 'select') {
        setSelectedPathIds([]);
        setSelectedTextObjectIds([]);
    }
  };
  
  const handleConfirmClearAll = () => {
    setDrawnPaths([]);
    setDrawnTextObjects([]);
    finalizeLiveText();
    saveStateToHistory([], []);
    setShowClearConfirmDialog(false);
  };
  
  const handleUndo = useCallback(() => {
    finalizeLiveText();
    if (historyStep > 0) setHistoryStep(prev => prev - 1);
    else toast({ title: "Nothing to undo", duration: 2000 });
  }, [historyStep, toast, finalizeLiveText]);

  const handleRedo = useCallback(() => {
    finalizeLiveText();
    if (historyStep < history.length - 1) setHistoryStep(prev => prev + 1);
    else toast({ title: "Nothing to redo", duration: 2000 });
  }, [historyStep, history.length, toast, finalizeLiveText]);

  return (
    <>
      <textarea ref={liveTextInputRef} value={currentText} onChange={e => setCurrentText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); setCurrentText(prev => prev + '\n'); }}} onBlur={finalizeLiveText} style={{ position: 'absolute', opacity: 0, width: 1, height: 1, border: 'none', padding: 0, top: -9999, left: -9999 }} tabIndex={-1} />
      <div className="flex flex-col h-full bg-muted/30">
        <div className="flex-none p-2 border-b bg-background shadow-md sticky top-16 z-20">
          <div className="container mx-auto flex flex-wrap items-center justify-center gap-2">
             <ToolButton icon={Lasso} label="Lasso Select" onClick={() => handleToolClick("select")} isActive={activeTool === "select"} data-options-toggler={true}/>
             <ToolButton icon={Brush} label="Draw" onClick={() => handleToolClick("draw")} isActive={drawingTools.includes(activeTool || "") && activeTool !== "erase"} data-options-toggler={true}/>
             <ToolButton icon={Type} label="Text" onClick={() => handleToolClick("Text")} isActive={activeTool === "text"} data-options-toggler={true}/>
             <ToolButton icon={Eraser} label="Erase" onClick={() => handleToolClick("Erase")} isActive={activeTool === "erase"} data-options-toggler={true}/>
             <ToolButton icon={Undo2} label="Undo" onClick={handleUndo} disabled={historyStep <= 0} />
             <ToolButton icon={Redo2} label="Redo" onClick={handleRedo} disabled={historyStep >= history.length - 1}/>
             <AlertDialog open={showClearConfirmDialog} onOpenChange={setShowClearConfirmDialog}><AlertDialogTrigger asChild><Button variant="outline" size="icon" className="rounded-lg w-12 h-12 flex flex-col items-center justify-center text-xs" aria-label="Clear"><Trash2 className="h-5 w-5 mb-0.5" /></Button></AlertDialogTrigger><AlertDialogContent className="rounded-xl"><AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle><AlertDialogDescription>This will clear the entire whiteboard. This action cannot be undone.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel className="rounded-lg">Cancel</AlertDialogCancel><AlertDialogAction onClick={handleConfirmClearAll} className="rounded-lg">Clear Whiteboard</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
          </div>
        </div>

        {showDrawingToolOptions && activeTool && (drawingTools.includes(activeTool) || ['erase', 'text', 'select'].includes(activeTool)) && (
           <div ref={drawingOptionsToolbarRef} className="p-3 border-b bg-muted/50 absolute top-32 left-0 right-0 z-10 shadow-lg">
             <div className="container mx-auto">
                {activeTool === 'select' ? ( <div className="text-center"><p className="text-sm text-muted-foreground">Lasso Select active. Drag to select items.</p>{(selectedPathIds.length + selectedTextObjectIds.length) > 0 && <p className="text-xs text-primary">{(selectedPathIds.length + selectedTextObjectIds.length)} item(s) selected. Drag to move.</p>}</div> ) 
                : activeTool === 'text' ? (
                    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                      <div><span className="text-xs font-medium text-muted-foreground">Color:</span><div className="flex flex-wrap gap-2 mt-1">{availableColors.map(c => (<ColorSwatch key={c} color={c} onClick={() => setSelectedColor(c)} isSelected={selectedColor === c} />))}</div></div>
                      <div><span className="text-xs font-medium text-muted-foreground">Text Size:</span><div className="flex gap-2 mt-1">{textSizes.map(s => (<Button key={s.name} variant={selectedTextSize === s.name ? "default" : "outline"} size="sm" className="rounded-lg" onClick={() => setSelectedTextSize(s.name)}>{s.label.split(' ')[0]}</Button>))}</div></div>
                    </div>
                ) : activeTool === 'erase' ? (
                    <div><span className="text-xs font-medium text-muted-foreground">Eraser Size:</span><div className="flex gap-2 mt-1">{brushSizes.map(b => (<Button key={b.name} variant={selectedBrushSize === b.name ? "default" : "outline"} size="icon" className="rounded-lg w-10 h-10" onClick={() => setSelectedBrushSize(b.name)}><b.icon className={cn("h-5 w-5", b.name === 'tiny' && 'h-2 w-2', b.name === 'small' && 'h-3 w-3', b.name === 'large' && 'h-6 w-6', b.name === 'xlarge' && 'h-7 w-7')} /></Button>))}</div></div>
                ) : (
                    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                        <div><span className="text-xs font-medium text-muted-foreground">Color:</span><div className="flex flex-wrap gap-2 mt-1">{availableColors.map(c => (<ColorSwatch key={c} color={c} onClick={() => setSelectedColor(c)} isSelected={selectedColor === c} />))}</div></div>
                        <div><span className="text-xs font-medium text-muted-foreground">Size:</span><div className="flex gap-2 mt-1">{brushSizes.map(b => (<Button key={b.name} variant={selectedBrushSize === b.name ? "default" : "outline"} size="icon" className="rounded-lg w-10 h-10" onClick={() => setSelectedBrushSize(b.name)}><b.icon className={cn("h-5 w-5", b.name === 'tiny' && 'h-2 w-2', b.name === 'small' && 'h-3 w-3', b.name === 'large' && 'h-6 w-6', b.name === 'xlarge' && 'h-7 w-7')} /></Button>))}</div></div>
                        <div><span className="text-xs font-medium text-muted-foreground">Shape:</span><div className="flex flex-wrap gap-2 mt-1">{[ {tool: "draw", icon: Edit3, label: "Freehand"}, {tool: "line", icon: Minus, label: "Line"}, {tool: "arrow", icon: ArrowRight, label: "Arrow"}, {tool: "circle", icon: CircleIconShape, label: "Circle"}, {tool: "square", icon: SquareIconShape, label: "Square"}, {tool: "triangle", icon: TriangleIcon, label: "Triangle"} ].map(t => (<ToolButton key={t.tool} icon={t.icon} label={t.label} onClick={() => setActiveTool(t.tool)} isActive={activeTool === t.tool}/>))}</div></div>
                    </div>
                )}
             </div>
           </div>
        )}

        <main className="flex-grow flex flex-col overflow-hidden min-h-0"> 
          <Card className="w-full h-full max-w-full text-center shadow-none rounded-none border-0 flex flex-col overflow-hidden">
            <CardContent className="flex-grow bg-card flex items-center justify-center relative p-0"> 
              <canvas ref={canvasRef} onMouseDown={handlePointerDown} onTouchStart={handlePointerDown} className="touch-none w-full h-full block" style={{ backgroundColor: canvasBackgroundColor }} />
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
