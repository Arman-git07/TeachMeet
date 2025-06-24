
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
import React, { useState, useEffect, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";
import { useDynamicHeader } from '@/contexts/DynamicHeaderContext';

// --- Type Definitions ---
interface Point { x: number; y: number; }
interface DrawnPath { id: string; points: Point[]; color: string; lineWidth: number; }
interface TextElement { id:string; text: string; x: number; y: number; color: string; font: string; width: number; height: number; }
interface HistoryState { paths: DrawnPath[]; texts: TextElement[]; }
interface BoundingBox { minX: number; minY: number; maxX: number; maxY: number; }

// --- Constants ---
const MAX_HISTORY_STEPS = 50;
const canvasBackgroundColor = "hsl(0 0% 100%)";
const darkCanvasBackgroundColor = "hsl(202 34% 21%)";

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
  const [paths, setPaths] = useState<DrawnPath[]>([]);
  const [texts, setTexts] = useState<TextElement[]>([]);
  const [selectedPathIds, setSelectedPathIds] = useState(new Set<string>());
  const [selectedTextIds, setSelectedTextIds] = useState(new Set<string>());

  // --- UI and Tool State ---
  const [activeTool, setActiveTool] = useState<string>("draw");
  const [selectedColor, setSelectedColor] = useState<string>("#000000");
  const [selectedBrushSize, setSelectedBrushSize] = useState<string>("medium");
  const [isDarkMode, setIsDarkMode] = useState(false);
  
  // --- Refs for Live Operations & State Snapshots (do not trigger re-renders) ---
  const operationStateRef = useRef<'idle' | 'drawing' | 'shaping' | 'lassoing' | 'movingSelection' | 'texting'>('idle');
  const currentPathRef = useRef<DrawnPath | null>(null);
  const shapeStartPointRef = useRef<Point | null>(null);
  const lassoPathRef = useRef<Point[]>([]);
  const moveStartPointRef = useRef<Point | null>(null);
  const originalPositionsRef = useRef<{ paths: Map<string, Point[]>, texts: Map<string, Point> } | null>(null);
  const textCursorPosition = useRef<Point | null>(null);

  // --- History State ---
  const historyRef = useRef<HistoryState[]>([{ paths: [], texts: [] }]);
  const historyStepRef = useRef(0);

  // --- Brush/Font Size Mappings ---
  const brushSizes = [{ name: 'tiny', lineWidth: 1 }, { name: 'small', lineWidth: 3 }, { name: 'medium', lineWidth: 6 }, { name: 'large', lineWidth: 10 }, { name: 'xlarge', lineWidth: 15 }];
  const getLineWidth = useCallback(() => brushSizes.find(b => b.name === selectedBrushSize)?.lineWidth || 6, [selectedBrushSize]);
  const getFontSize = () => 16;
  const getFontString = () => `${getFontSize()}px sans-serif`;

  // --- Geometry and Bounding Box Helpers ---
  const getPathBoundingBox = (path: DrawnPath): BoundingBox => {
    if (!path || !path.points || path.points.length === 0) return {minX: 0, minY: 0, maxX: 0, maxY: 0};
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    path.points.forEach(p => {
      minX = Math.min(minX, p.x); minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y);
    });
    return { minX, minY, maxX, maxY };
  };
  const getTextBoundingBox = (text: TextElement): BoundingBox => ({ minX: text.x, minY: text.y, maxX: text.x + text.width, maxY: text.y + text.height });
  const isPointInRect = (point: Point, rect: BoundingBox) => (point.x >= rect.minX && point.x <= rect.maxX && point.y >= rect.minY && point.y <= rect.maxY);
  const isPointInPolygon = (point: Point, polygon: Point[]): boolean => {
    let isInside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i].x, yi = polygon[i].y;
      const xj = polygon[j].x, yj = polygon[j].y;
      const intersect = ((yi > point.y) !== (yj > point.y)) && (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi);
      if (intersect) isInside = !isInside;
    }
    return isInside;
  };
  const getSelectionBoundingBox = useCallback((): BoundingBox | null => {
    if (selectedPathIds.size === 0 && selectedTextIds.size === 0) return null;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    selectedPathIds.forEach(id => {
      const path = paths.find(p => p.id === id);
      if (path) { const box = getPathBoundingBox(path); minX = Math.min(minX, box.minX); minY = Math.min(minY, box.minY); maxX = Math.max(maxX, box.maxX); maxY = Math.max(maxY, box.maxY); }
    });
    selectedTextIds.forEach(id => {
      const text = texts.find(t => t.id === id);
      if (text) { const box = getTextBoundingBox(text); minX = Math.min(minX, box.minX); minY = Math.min(minY, box.minY); maxX = Math.max(maxX, box.maxX); maxY = Math.max(maxY, box.maxY); }
    });
    return (minX === Infinity) ? null : { minX, minY, maxX, maxY };
  }, [paths, texts, selectedPathIds, selectedTextIds]);


  // --- Drawing Functions ---
  const drawPath = (ctx: CanvasRenderingContext2D, path: DrawnPath) => {
    if (!path || !path.points || path.points.length === 0) return;
    if (path.points.length < 2 && activeTool !== 'draw' && activeTool !== 'erase') return;
    ctx.beginPath();
    ctx.strokeStyle = path.color;
    ctx.lineWidth = path.lineWidth;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.moveTo(path.points[0].x, path.points[0].y);
    for (let i = 1; i < path.points.length; i++) ctx.lineTo(path.points[i].x, path.points[i].y);
    ctx.stroke();
  };
  const drawText = (ctx: CanvasRenderingContext2D, textObj: TextElement) => {
    if (!textObj || !textObj.text) return;
    ctx.fillStyle = textObj.color;
    ctx.font = textObj.font;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    textObj.text.split('\n').forEach((line, index) => ctx.fillText(line, textObj.x, textObj.y + (index * (getFontSize() * 1.2))));
  };
  const clearCanvas = (ctx: CanvasRenderingContext2D) => ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  
  // --- Main Render & Resize Effect ---
  useEffect(() => {
    const mainCanvas = mainCanvasRef.current;
    const tempCanvas = tempCanvasRef.current;
    if (!mainCanvas || !tempCanvas) return;
    
    const mainCtx = mainCanvas.getContext('2d');
    if (!mainCtx) return;

    const redrawMainCanvas = () => {
      clearCanvas(mainCtx);
      mainCtx.fillStyle = isDarkMode ? darkCanvasBackgroundColor : canvasBackgroundColor;
      mainCtx.fillRect(0, 0, mainCtx.canvas.width, mainCtx.canvas.height);
      paths.forEach(path => drawPath(mainCtx, path));
      texts.forEach(text => drawText(mainCtx, text));
    };

    const resizeCanvases = () => {
        const { width, height } = mainCanvas.getBoundingClientRect();
        if (mainCanvas.width !== width || mainCanvas.height !== height) {
          mainCanvas.width = width; mainCanvas.height = height;
          tempCanvas.width = width; tempCanvas.height = height;
          redrawMainCanvas();
        }
    };
      
    resizeCanvases();
    redrawMainCanvas();
    window.addEventListener('resize', resizeCanvases);
    
    return () => window.removeEventListener('resize', resizeCanvases);
  }, [paths, texts, isDarkMode]);
  

  // --- Selection Box Drawing Effect ---
  useEffect(() => {
    const tempCtx = tempCanvasRef.current?.getContext('2d');
    if (!tempCtx) return;
    clearCanvas(tempCtx);
    const selectionBounds = getSelectionBoundingBox();
    if (selectionBounds) {
      tempCtx.strokeStyle = 'rgba(0, 120, 215, 0.8)';
      tempCtx.lineWidth = 2;
      tempCtx.setLineDash([6, 3]);
      tempCtx.strokeRect(selectionBounds.minX - 5, selectionBounds.minY - 5, selectionBounds.maxX - selectionBounds.minX + 10, selectionBounds.maxY - selectionBounds.minY + 10);
      tempCtx.setLineDash([]);
    }
  }, [selectedPathIds, selectedTextIds, getSelectionBoundingBox]);

  const pushToHistory = useCallback((currentPaths: DrawnPath[], currentTexts: TextElement[]) => {
    const newHistory = historyRef.current.slice(0, historyStepRef.current + 1);
    const newState = { paths: currentPaths, texts: currentTexts };
    historyRef.current = [...newHistory, newState].slice(-MAX_HISTORY_STEPS);
    historyStepRef.current = historyRef.current.length - 1;
  }, []);

  useEffect(() => {
    pushToHistory(paths, texts);
  }, [paths, texts, pushToHistory]);


  const handleUndo = () => {
    if (historyStepRef.current > 0) {
      historyStepRef.current--;
      const { paths: prevPaths, texts: prevTexts } = historyRef.current[historyStepRef.current];
      setPaths(prevPaths);
      setTexts(prevTexts);
      setSelectedPathIds(new Set());
      setSelectedTextIds(new Set());
    }
  };
  const handleRedo = () => {
    if (historyStepRef.current < historyRef.current.length - 1) {
      historyStepRef.current++;
      const { paths: nextPaths, texts: nextTexts } = historyRef.current[historyStepRef.current];
      setPaths(nextPaths);
      setTexts(nextTexts);
      setSelectedPathIds(new Set());
      setSelectedTextIds(new Set());
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
    setSelectedPathIds(new Set());
    setSelectedTextIds(new Set());
  };
  
  const finalizeLiveText = useCallback(() => {
    const textInput = liveTextInputRef.current;
    const pos = textCursorPosition.current;
    
    if (!textInput || !pos || operationStateRef.current !== 'texting') {
        if(textInput) {
             textInput.style.opacity = '0';
             textInput.style.top = '-9999px';
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
        
        const newTextElement: TextElement = { id: Date.now().toString(), text: textInput.value, x: pos.x, y: pos.y, color: selectedColor, font, width: maxWidth, height: totalHeight };
        setTexts(prev => [...prev, newTextElement]);
    }

    textInput.value = '';
    textInput.style.opacity = '0';
    textInput.style.top = '-9999px';
    operationStateRef.current = 'idle';
    textCursorPosition.current = null;
  }, [selectedColor]);

  // --- Event Handlers ---
  const handlePointerDown = useCallback((event: React.MouseEvent | React.TouchEvent) => {
    if ((event as React.MouseEvent).button !== 0) return;
    const pos = getPointerPosition(event);
    if (!pos) return;
    
    finalizeLiveText();

    const selectionBounds = getSelectionBoundingBox();
    if (activeTool === 'select' && selectionBounds && isPointInRect(pos, selectionBounds)) {
        operationStateRef.current = 'movingSelection';
        moveStartPointRef.current = pos;
        const originalPaths = new Map<string, Point[]>();
        selectedPathIds.forEach(id => { const path = paths.find(p => p.id === id); if (path) originalPaths.set(id, path.points.map(p => ({...p}))); });
        const originalTexts = new Map<string, Point>();
        selectedTextIds.forEach(id => { const text = texts.find(t => t.id === id); if (text) originalTexts.set(id, { x: text.x, y: text.y }); });
        originalPositionsRef.current = { paths: originalPaths, texts: originalTexts };
        return;
    }

    setSelectedPathIds(new Set()); setSelectedTextIds(new Set());

    if (activeTool === 'select') { operationStateRef.current = 'lassoing'; lassoPathRef.current = [pos]; } 
    else if (activeTool === 'text') {
        operationStateRef.current = 'texting';
        textCursorPosition.current = pos;
        if(liveTextInputRef.current) {
            liveTextInputRef.current.style.top = `${pos.y}px`;
            liveTextInputRef.current.style.left = `${pos.x}px`;
            liveTextInputRef.current.style.opacity = '1';
            liveTextInputRef.current.style.color = selectedColor;
            liveTextInputRef.current.focus();
        }
    }
    else if (activeTool === 'draw' || activeTool === 'erase') {
        operationStateRef.current = 'drawing';
        currentPathRef.current = { id: Date.now().toString(), points: [pos], color: activeTool === 'erase' ? (isDarkMode ? darkCanvasBackgroundColor : canvasBackgroundColor) : selectedColor, lineWidth: getLineWidth() };
    } else { // Shape tools
        operationStateRef.current = 'shaping'; 
        shapeStartPointRef.current = pos; 
    }
  }, [getPointerPosition, activeTool, selectedColor, getLineWidth, getSelectionBoundingBox, paths, texts, selectedPathIds, selectedTextIds, finalizeLiveText, isDarkMode]);

  const handlePointerMove = useCallback((event: React.MouseEvent | React.TouchEvent) => {
    if (operationStateRef.current === 'idle' || operationStateRef.current === 'texting') return;
    const pos = getPointerPosition(event);
    const tempCtx = tempCanvasRef.current?.getContext('2d');
    if (!pos || !tempCtx) return;
    
    clearCanvas(tempCtx);

    if (operationStateRef.current === 'drawing' && currentPathRef.current) {
        currentPathRef.current.points.push(pos);
        drawPath(tempCtx, currentPathRef.current);
    } else if (operationStateRef.current === 'shaping' && shapeStartPointRef.current) {
        const start = shapeStartPointRef.current;
        tempCtx.strokeStyle = selectedColor; tempCtx.lineWidth = getLineWidth();
        
        if (activeTool === 'line') { tempCtx.beginPath(); tempCtx.moveTo(start.x, start.y); tempCtx.lineTo(pos.x, pos.y); tempCtx.stroke(); }
        else if (activeTool === 'square') { tempCtx.strokeRect(start.x, start.y, pos.x - start.x, pos.y - start.y); }
        else if (activeTool === 'circle') { const radius = Math.hypot(pos.x - start.x, pos.y - start.y); tempCtx.beginPath(); tempCtx.arc(start.x, start.y, radius, 0, 2 * Math.PI); tempCtx.stroke(); }
        else if (activeTool === 'arrow') {
            const headlen = 10 + getLineWidth(); const angle = Math.atan2(pos.y - start.y, pos.x - start.x);
            tempCtx.beginPath(); tempCtx.moveTo(start.x, start.y); tempCtx.lineTo(pos.x, pos.y); tempCtx.moveTo(pos.x, pos.y); tempCtx.lineTo(pos.x - headlen * Math.cos(angle - Math.PI / 6), pos.y - headlen * Math.sin(angle - Math.PI / 6)); tempCtx.moveTo(pos.x, pos.y); tempCtx.lineTo(pos.x - headlen * Math.cos(angle + Math.PI / 6), pos.y - headlen * Math.sin(angle + Math.PI / 6)); tempCtx.stroke();
        } else if (activeTool === 'triangle') { tempCtx.beginPath(); tempCtx.moveTo(start.x + (pos.x - start.x) / 2, start.y); tempCtx.lineTo(start.x, pos.y); tempCtx.lineTo(pos.x, pos.y); tempCtx.closePath(); tempCtx.stroke(); }
    } else if (operationStateRef.current === 'lassoing') {
        lassoPathRef.current.push(pos);
        tempCtx.fillStyle = "rgba(0, 120, 215, 0.1)"; tempCtx.strokeStyle = "rgba(0, 120, 215, 0.8)";
        tempCtx.lineWidth = 1; tempCtx.setLineDash([4, 2]);
        tempCtx.beginPath(); tempCtx.moveTo(lassoPathRef.current[0].x, lassoPathRef.current[0].y);
        for(let i=1; i<lassoPathRef.current.length; i++) tempCtx.lineTo(lassoPathRef.current[i].x, lassoPathRef.current[i].y);
        tempCtx.closePath(); tempCtx.fill(); tempCtx.stroke(); tempCtx.setLineDash([]);
    } else if (operationStateRef.current === 'movingSelection' && moveStartPointRef.current && originalPositionsRef.current) {
        const dx = pos.x - moveStartPointRef.current.x; const dy = pos.y - moveStartPointRef.current.y;
        tempCtx.globalAlpha = 0.7;
        originalPositionsRef.current.paths.forEach((originalPoints, id) => {
            const path = paths.find(p => p.id === id);
            if (path) drawPath(tempCtx, { ...path, points: originalPoints.map(p => ({ x: p.x + dx, y: p.y + dy })) });
        });
        originalPositionsRef.current.texts.forEach((originalPos, id) => {
            const text = texts.find(t => t.id === id);
            if (text) drawText(tempCtx, { ...text, x: originalPos.x + dx, y: originalPos.y + dy });
        });
        tempCtx.globalAlpha = 1.0;
    }
  }, [getPointerPosition, activeTool, getLineWidth, selectedColor, paths, texts]);

  const handlePointerUp = useCallback((event: React.MouseEvent | React.TouchEvent) => {
    const tempCtx = tempCanvasRef.current?.getContext('2d');
    if (!tempCtx || operationStateRef.current === 'idle' || operationStateRef.current === 'texting') return;
    
    if (operationStateRef.current === 'lassoing') {
        const newSelectedPathIds = new Set<string>();
        const newSelectedTextIds = new Set<string>();
        paths.forEach(path => {
            const box = getPathBoundingBox(path);
            if (path.points.some(p => isPointInPolygon(p, lassoPathRef.current)) || isPointInPolygon({x: box.minX, y: box.minY}, lassoPathRef.current)) newSelectedPathIds.add(path.id);
        });
        texts.forEach(text => {
            const box = getTextBoundingBox(text);
            const corners = [{x:box.minX, y:box.minY}, {x:box.maxX, y:box.minY}, {x:box.maxX, y:box.maxY}, {x:box.minX, y:box.maxY}];
            if (corners.some(c => isPointInPolygon(c, lassoPathRef.current))) newSelectedTextIds.add(text.id);
        });
        setSelectedPathIds(newSelectedPathIds);
        setSelectedTextIds(newSelectedTextIds);
    } else if (operationStateRef.current === 'movingSelection' && moveStartPointRef.current) {
        const pos = getPointerPosition(event)!;
        const dx = pos.x - moveStartPointRef.current.x; const dy = pos.y - moveStartPointRef.current.y;
        if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
            setPaths(prev => prev.map(path => selectedPathIds.has(path.id) ? { ...path, points: originalPositionsRef.current!.paths.get(path.id)!.map(p => ({ x: p.x + dx, y: p.y + dy })) } : path));
            setTexts(prev => prev.map(text => selectedTextIds.has(text.id) ? { ...text, x: originalPositionsRef.current!.texts.get(text.id)!.x + dx, y: originalPositionsRef.current!.texts.get(text.id)!.y + dy } : text));
        }
    } else if (currentPathRef.current && currentPathRef.current.points.length > 1) {
        setPaths(prev => [...prev, currentPathRef.current!]);
    } else if (operationStateRef.current === 'shaping' && shapeStartPointRef.current) {
        const start = shapeStartPointRef.current;
        const pos = getPointerPosition(event)!;
        if (Math.hypot(pos.x - start.x, pos.y - start.y) < getLineWidth()) { // Ignore tiny shapes
             operationStateRef.current = 'idle'; clearCanvas(tempCtx); return;
        }

        const newPath: DrawnPath = { id: Date.now().toString(), points: [], color: selectedColor, lineWidth: getLineWidth() };
        if (activeTool === 'line') newPath.points.push(start, pos);
        else if (activeTool === 'square') newPath.points.push(start, {x: pos.x, y: start.y}, pos, {x: start.x, y: pos.y}, start);
        else if (activeTool === 'circle') {
             const radius = Math.hypot(pos.x - start.x, pos.y - start.y);
             for(let i=0; i<=360; i+=10) newPath.points.push({ x: start.x + radius * Math.cos(i * Math.PI / 180), y: start.y + radius * Math.sin(i * Math.PI / 180) });
        } else if (activeTool === 'arrow') {
            const headlen = 10 + getLineWidth(); const angle = Math.atan2(pos.y - start.y, pos.x - start.x);
            newPath.points.push(start, pos); 
            const path2 = { id: (Date.now()+1).toString(), points: [{x: pos.x, y: pos.y}, {x: pos.x - headlen * Math.cos(angle - Math.PI / 6), y: pos.y - headlen * Math.sin(angle - Math.PI / 6)}], color: selectedColor, lineWidth: getLineWidth() };
            const path3 = { id: (Date.now()+2).toString(), points: [{x: pos.x, y: pos.y}, {x: pos.x - headlen * Math.cos(angle + Math.PI / 6), y: pos.y - headlen * Math.sin(angle + Math.PI / 6)}], color: selectedColor, lineWidth: getLineWidth() };
            setPaths(prev => [...prev, newPath, path2, path3]);
            operationStateRef.current = 'idle'; clearCanvas(tempCtx); return;
        } else if (activeTool === 'triangle') newPath.points.push({ x: start.x + (pos.x - start.x) / 2, y: start.y }, { x: start.x, y: pos.y }, { x: pos.x, y: pos.y }, { x: start.x + (pos.x - start.x) / 2, y: start.y });
        
        if (newPath.points.length > 0) {
            setPaths(prev => [...prev, newPath]);
        }
    }

    clearCanvas(tempCtx);
    operationStateRef.current = 'idle';
    currentPathRef.current = null;
    shapeStartPointRef.current = null;
    lassoPathRef.current = [];
    moveStartPointRef.current = null;
    originalPositionsRef.current = null;
  }, [getLineWidth, selectedColor, getPointerPosition, activeTool, paths, texts, selectedPathIds, selectedTextIds]);

  const handleClearWhiteboard = () => { setPaths([]); setTexts([]); setSelectedPathIds(new Set()); setSelectedTextIds(new Set()); };

  useEffect(() => {
    setHeaderContent(
      <div className="flex items-center justify-between w-full">
        <div className="flex items-center gap-3"><Edit3 className="h-7 w-7 text-primary" /><h1 className="text-xl font-semibold truncate">TeachMeet Whiteboard</h1></div>
        {meetingId && <Link href={`/dashboard/meeting/${meetingId}`} passHref legacyBehavior><Button variant="outline" size="sm" className="rounded-lg"><ArrowLeft className="mr-2 h-4 w-4" />Back</Button></Link>}
      </div>
    );
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    setIsDarkMode(mql.matches);
    const listener = (e: MediaQueryListEvent) => setIsDarkMode(e.matches);
    mql.addEventListener('change', listener);
    return () => {
      setHeaderContent(null);
      mql.removeEventListener('change', listener);
    }
  }, [setHeaderContent, meetingId]);

  return (
    <>
      <textarea ref={liveTextInputRef} onBlur={finalizeLiveText} style={{ position: 'absolute', opacity: 0, border: '1px dashed hsl(var(--primary))', outline: 'none', background: 'hsl(var(--background)/0.8)', font: getFontString(), lineHeight: `${getFontSize() * 1.2}px`, zIndex: 10, resize: 'none', overflow: 'hidden', whiteSpace: 'pre', top: -9999, left: -9999, padding: '4px' }} tabIndex={-1} />
      <div className="flex flex-col h-full bg-muted/30">
        <div className="flex-none p-2 border-b bg-background shadow-md sticky top-16 z-20">
          <div className="container mx-auto flex flex-wrap items-center justify-center gap-2">
             <ToolButton icon={Lasso} label="Select" onClick={() => handleToolClick("select")} isActive={activeTool === "select"}/>
             <ToolButton icon={Brush} label="Draw" onClick={() => handleToolClick("draw")} isActive={activeTool === "draw"} />
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
                {(activeTool !== 'select') && (
                    <div><span className="text-xs font-medium text-muted-foreground">Color:</span><div className="flex flex-wrap gap-2 mt-1 justify-center">{['#000000', '#EF4444', '#F97316', '#EAB308', '#22C55E', '#0EA5E9', '#6366F1', '#EC4899'].map(c => (<ColorSwatch key={c} color={c} onClick={() => setSelectedColor(c)} isSelected={selectedColor === c} />))}</div></div>
                )}
                {(activeTool === 'draw' || activeTool === 'erase') && (
                    <div><span className="text-xs font-medium text-muted-foreground">Size:</span><div className="flex gap-2 mt-1 justify-center">{brushSizes.map(b => (<Button key={b.name} variant={selectedBrushSize === b.name ? "default" : "outline"} size="icon" className="rounded-lg w-10 h-10" onClick={() => setSelectedBrushSize(b.name)}><CircleIconShape className={cn("h-5 w-5", b.name === 'tiny' && 'h-2 w-2', b.name === 'small' && 'h-3 w-3', b.name === 'large' && 'h-6 w-6', b.name === 'xlarge' && 'h-7 w-7')} /></Button>))}</div></div>
                )}
                <div className="flex flex-wrap gap-2 mt-1 justify-center">
                    <ToolButton icon={Minus} label="Line" onClick={() => handleToolClick('line')} isActive={activeTool === 'line'} />
                    <ToolButton icon={ArrowRight} label="Arrow" onClick={() => handleToolClick('arrow')} isActive={activeTool === 'arrow'} />
                    <ToolButton icon={CircleIconShape} label="Circle" onClick={() => handleToolClick('circle')} isActive={activeTool === 'circle'} />
                    <ToolButton icon={SquareIconShape} label="Square" onClick={() => handleToolClick('square')} isActive={activeTool === 'square'} />
                    <ToolButton icon={TriangleIcon} label="Triangle" onClick={() => handleToolClick('triangle')} isActive={activeTool === 'triangle'} />
                </div>
            </div>
        </div>

        <main className="flex-grow flex flex-col overflow-hidden min-h-0">
          <Card className="w-full h-full max-w-full text-center shadow-none rounded-none border-0 flex flex-col overflow-hidden">
            <CardContent className="flex-grow bg-card flex items-center justify-center relative p-0">
                <canvas ref={mainCanvasRef} className="touch-none w-full h-full block absolute top-0 left-0" style={{ zIndex: 1 }} />
                <canvas ref={tempCanvasRef} onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} onPointerLeave={handlePointerUp} className="touch-none w-full h-full block absolute top-0 left-0" style={{ zIndex: 2 }} />
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
