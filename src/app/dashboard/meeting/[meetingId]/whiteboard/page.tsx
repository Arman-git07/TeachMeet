
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

// Type definitions
interface Point {
  x: number;
  y: number;
}

interface DrawnPath {
  id: string;
  points: Point[];
  color: string;
  lineWidth: number;
}

interface TextElement {
  id: string;
  text: string;
  x: number;
  y: number;
  color: string;
  font: string;
  width: number;
  height: number;
}

interface HistoryState {
  paths: DrawnPath[];
  texts: TextElement[];
}

const MAX_HISTORY_STEPS = 50;
const drawingTools = ['draw', 'line', 'circle', 'square', 'arrow', 'triangle'];

// UI Components
const ToolButton = React.memo(({ icon: Icon, label, onClick, isActive = false, disabled = false }: { icon: React.ElementType; label: string; onClick: () => void; isActive?: boolean; disabled?: boolean; }) => (
  <Button variant={isActive ? "default" : "outline"} size="icon" className="rounded-lg w-12 h-12 flex flex-col items-center justify-center text-xs" onClick={onClick} aria-label={label} disabled={disabled}>
    <Icon className="h-5 w-5 mb-0.5" />
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

  // --- Refs for canvas and contexts ---
  const mainCanvasRef = useRef<HTMLCanvasElement>(null);
  const tempCanvasRef = useRef<HTMLCanvasElement>(null);

  // --- Core Drawing Data ---
  const [paths, setPaths] = useState<DrawnPath[]>([]);
  const [texts, setTexts] = useState<TextElement[]>([]);
  
  // --- History State ---
  const [history, setHistory] = useState<HistoryState[]>([{ paths: [], texts: [] }]);
  const [historyStep, setHistoryStep] = useState(0);

  // --- UI State ---
  const [activeTool, setActiveTool] = useState<string>("draw");
  const [selectedColor, setSelectedColor] = useState<string>("#000000");
  const [selectedBrushSize, setSelectedBrushSize] = useState<string>("medium");
  const [selectedTextSize, setSelectedTextSize] = useState<string>("medium");
  const [canvasBackgroundColor, setCanvasBackgroundColor] = useState<string>("#FFFFFF");
  const [showToolOptions, setShowToolOptions] = useState(true);

  // --- Refs for active operations ---
  const operationStateRef = useRef<'idle' | 'drawing' | 'shaping' | 'typing'>('idle');
  const currentPathRef = useRef<DrawnPath | null>(null);
  const shapeStartPointRef = useRef<Point | null>(null);
  const [textInputPosition, setTextInputPosition] = useState<Point | null>(null);
  const [currentText, setCurrentText] = useState('');
  const liveTextInputRef = useRef<HTMLTextAreaElement>(null);

  // --- Brush/Font Size Mappings ---
  const brushSizes = [ { name: 'tiny', lineWidth: 1 }, { name: 'small', lineWidth: 3 }, { name: 'medium', lineWidth: 6 }, { name: 'large', lineWidth: 10 }, { name: 'xlarge', lineWidth: 15 } ];
  const textSizes = [ { name: 'small', fontSize: 12 }, { name: 'medium', fontSize: 16 }, { name: 'large', fontSize: 24 }, { name: 'xlarge', fontSize: 32 } ];
  const getLineWidth = useCallback(() => brushSizes.find(b => b.name === selectedBrushSize)?.lineWidth || 6, [selectedBrushSize]);
  const getFontSize = useCallback(() => textSizes.find(s => s.name === selectedTextSize)?.fontSize || 16, [selectedTextSize]);

  // --- Drawing functions ---
  const drawPath = (ctx: CanvasRenderingContext2D, path: DrawnPath) => {
    if (path.points.length < 2) return;
    ctx.beginPath();
    ctx.strokeStyle = path.color;
    ctx.lineWidth = path.lineWidth;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.moveTo(path.points[0].x, path.points[0].y);
    for (let i = 1; i < path.points.length; i++) {
      ctx.lineTo(path.points[i].x, path.points[i].y);
    }
    ctx.stroke();
  };

  const drawText = (ctx: CanvasRenderingContext2D, textObj: TextElement) => {
    ctx.fillStyle = textObj.color;
    ctx.font = textObj.font;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    const lines = textObj.text.split('\n');
    lines.forEach((line, index) => ctx.fillText(line, textObj.x, textObj.y + (index * (textObj.height/lines.length))));
  };
  
  const clearCanvas = (ctx: CanvasRenderingContext2D) => {
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  };

  // --- Main Render Effect ---
  useEffect(() => {
    const mainCtx = mainCanvasRef.current?.getContext('2d');
    if (mainCtx) {
      clearCanvas(mainCtx);
      mainCtx.fillStyle = canvasBackgroundColor;
      mainCtx.fillRect(0, 0, mainCtx.canvas.width, mainCtx.canvas.height);
      paths.forEach(path => drawPath(mainCtx, path));
      texts.forEach(text => drawText(mainCtx, text));
    }
  }, [paths, texts, canvasBackgroundColor]);

  // --- Initialization and Resize ---
  useEffect(() => {
    const mainCanvas = mainCanvasRef.current;
    const tempCanvas = tempCanvasRef.current;
    if (mainCanvas && tempCanvas) {
      const resizeCanvases = () => {
        const { width, height } = mainCanvas.getBoundingClientRect();
        if (width > 0 && height > 0) {
          mainCanvas.width = width;
          mainCanvas.height = height;
          tempCanvas.width = width;
          tempCanvas.height = height;
          // Trigger a redraw after resize
          const mainCtx = mainCanvas.getContext('2d');
           if (mainCtx) {
              clearCanvas(mainCtx);
              mainCtx.fillStyle = canvasBackgroundColor;
              mainCtx.fillRect(0, 0, mainCtx.canvas.width, mainCtx.canvas.height);
              paths.forEach(path => drawPath(mainCtx, path));
              texts.forEach(text => drawText(mainCtx, text));
           }
        }
      };
      resizeCanvases();
      window.addEventListener('resize', resizeCanvases);
      return () => window.removeEventListener('resize', resizeCanvases);
    }
  }, [paths, texts, canvasBackgroundColor]); // Rerun on data change too

  // --- History Management ---
  const saveStateToHistory = useCallback((newPaths: DrawnPath[], newTexts: TextElement[]) => {
    const newHistoryState = { paths: newPaths, texts: newTexts };
    const newHistory = history.slice(0, historyStep + 1);
    
    let updatedHistory = [...newHistory, newHistoryState];
    if (updatedHistory.length > MAX_HISTORY_STEPS) {
        updatedHistory = updatedHistory.slice(updatedHistory.length - MAX_HISTORY_STEPS);
    }
    
    setHistory(updatedHistory);
    setHistoryStep(updatedHistory.length - 1);
  }, [history, historyStep]);

  const handleUndo = () => {
    if (historyStep > 0) {
      const newStep = historyStep - 1;
      setHistoryStep(newStep);
      const { paths: prevPaths, texts: prevTexts } = history[newStep];
      setPaths(prevPaths);
      setTexts(prevTexts);
    }
  };

  const handleRedo = () => {
    if (historyStep < history.length - 1) {
      const newStep = historyStep + 1;
      setHistoryStep(newStep);
      const { paths: nextPaths, texts: nextTexts } = history[newStep];
      setPaths(nextPaths);
      setTexts(nextTexts);
    }
  };
  
  const handleToolClick = (toolName: string) => {
    operationStateRef.current = 'idle';
    setActiveTool(toolName);
    const isOptionsTool = drawingTools.includes(toolName) || ['erase', 'text'].includes(toolName);
    setShowToolOptions(isOptionsTool);
  };
  
  // --- Pointer/Mouse Event Handlers ---
  const getPointerPosition = useCallback((event: React.MouseEvent | React.TouchEvent): Point | null => {
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
    
    if (activeTool === 'text') {
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
  }, [getPointerPosition, activeTool, selectedColor, getLineWidth, canvasBackgroundColor]);

  const handlePointerMove = useCallback((event: React.MouseEvent | React.TouchEvent) => {
    if (operationStateRef.current === 'idle' || operationStateRef.current === 'typing') return;
    const pos = getPointerPosition(event);
    const tempCtx = tempCanvasRef.current?.getContext('2d');
    if (!pos || !tempCtx) return;
    
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
            tempPath.points.push(...Array.from({length: 37}, (_, i) => ({
                x: centerX + radius * Math.cos(i * 10 * Math.PI / 180),
                y: centerY + radius * Math.sin(i * 10 * Math.PI / 180)
            })));
        } else if (activeTool === 'arrow') {
            const headlen = 10 + getLineWidth(); const angle = Math.atan2(pos.y - start.y, pos.x - start.x);
            tempPath.points.push(start, pos, {x: pos.x - headlen * Math.cos(angle - Math.PI / 6), y: pos.y - headlen * Math.sin(angle - Math.PI / 6)}, pos, {x: pos.x - headlen * Math.cos(angle + Math.PI / 6), y: pos.y - headlen * Math.sin(angle + Math.PI / 6)});
        } else if (activeTool === 'triangle') tempPath.points.push({ x: start.x + (pos.x - start.x) / 2, y: start.y }, { x: start.x, y: pos.y }, { x: pos.x, y: pos.y }, { x: start.x + (pos.x - start.x) / 2, y: start.y });
        drawPath(tempCtx, tempPath);
    }
  }, [getPointerPosition, activeTool, getLineWidth, selectedColor]);

  const handlePointerUp = useCallback((event: React.MouseEvent | React.TouchEvent) => {
    const tempCtx = tempCanvasRef.current?.getContext('2d');
    if (!tempCtx || operationStateRef.current === 'idle' || operationStateRef.current === 'typing') return;
    
    let newPaths = paths;

    if (operationStateRef.current === 'drawing' && currentPathRef.current && currentPathRef.current.points.length > 1) {
        newPaths = [...paths, currentPathRef.current];
    } else if (operationStateRef.current === 'shaping' && shapeStartPointRef.current) {
        const start = shapeStartPointRef.current;
        const pos = getPointerPosition(event)!;
        const newPath: DrawnPath = { id: Date.now().toString(), points: [], color: selectedColor, lineWidth: getLineWidth() };

        if (activeTool === 'line') newPath.points.push(start, pos);
        else if (activeTool === 'square') newPath.points.push(start, {x: pos.x, y: start.y}, pos, {x: start.x, y: pos.y}, start);
        else if (activeTool === 'circle') {
            const radius = Math.hypot(pos.x - start.x, pos.y - start.y) / 2;
            const centerX = start.x + (pos.x - start.x) / 2, centerY = start.y + (pos.y - start.y) / 2;
            newPath.points.push(...Array.from({length: 37}, (_, i) => ({
                x: centerX + radius * Math.cos(i * 10 * Math.PI / 180),
                y: centerY + radius * Math.sin(i * 10 * Math.PI / 180)
            })));
        } else if (activeTool === 'arrow') {
            const headlen = 10 + getLineWidth(); const angle = Math.atan2(pos.y - start.y, pos.x - start.x);
            newPath.points.push(start, pos, {x: pos.x - headlen * Math.cos(angle - Math.PI / 6), y: pos.y - headlen * Math.sin(angle - Math.PI / 6)}, pos, {x: pos.x - headlen * Math.cos(angle + Math.PI / 6), y: pos.y - headlen * Math.sin(angle - Math.PI / 6)});
        } else if (activeTool === 'triangle') newPath.points.push({ x: start.x + (pos.x - start.x) / 2, y: start.y }, { x: start.x, y: pos.y }, { x: pos.x, y: pos.y }, { x: start.x + (pos.x - start.x) / 2, y: start.y });
        
        if (newPath.points.length > 0) newPaths = [...paths, newPath];
    }
    
    if (newPaths !== paths) {
        setPaths(newPaths);
        saveStateToHistory(newPaths, texts);
    }
    
    clearCanvas(tempCtx);
    operationStateRef.current = 'idle';
    currentPathRef.current = null;
    shapeStartPointRef.current = null;
  }, [getLineWidth, selectedColor, getPointerPosition, activeTool, paths, texts, saveStateToHistory]);

  // --- Text Handling ---
  const finalizeLiveText = useCallback(() => {
    operationStateRef.current = 'idle';
    if (!currentText.trim() || !textInputPosition) {
        setTextInputPosition(null);
        return;
    }

    const tempCtx = tempCanvasRef.current?.getContext('2d');
    if (!tempCtx) return;

    const lines = currentText.split('\n');
    const fontSize = getFontSize();
    const font = `${fontSize}px sans-serif`;
    tempCtx.font = font;
    
    const textMetrics = lines.map(line => tempCtx.measureText(line));
    const maxWidth = Math.max(...textMetrics.map(m => m.width));
    const lineHeight = fontSize * 1.2;
    const totalHeight = lines.length * lineHeight;
    
    const newTextElement: TextElement = {
      id: Date.now().toString(),
      text: currentText,
      x: textInputPosition.x, y: textInputPosition.y,
      color: selectedColor,
      font,
      width: maxWidth,
      height: totalHeight
    };
    
    const newTexts = [...texts, newTextElement];
    setTexts(newTexts);
    saveStateToHistory(paths, newTexts);
    
    setCurrentText('');
    setTextInputPosition(null);
  }, [currentText, textInputPosition, getFontSize, selectedColor, texts, paths, saveStateToHistory]);

  const handleClearWhiteboard = () => {
    setPaths([]);
    setTexts([]);
    saveStateToHistory([], []);
  }

  // --- Header Setup ---
  useEffect(() => {
    setHeaderContent(
      <div className="flex items-center justify-between w-full">
        <div className="flex items-center gap-3">
          <Edit3 className="h-7 w-7 text-primary" />
          <h1 className="text-xl font-semibold truncate">TeachMeet Whiteboard</h1>
        </div>
        {meetingId && (
          <Link href={`/dashboard/meeting/${meetingId}`} passHref legacyBehavior>
            <Button variant="outline" size="sm" className="rounded-lg">
              <ArrowLeft className="mr-2 h-4 w-4" />Back
            </Button>
          </Link>
        )}
      </div>
    );
    return () => setHeaderContent(null);
  }, [setHeaderContent, meetingId]);

  return (
    <>
      {textInputPosition && mainCanvasRef.current && (
          <textarea
              ref={liveTextInputRef} value={currentText} onChange={e => setCurrentText(e.target.value)}
              onBlur={finalizeLiveText} onKeyDown={e => { if (e.key === 'Escape') { e.preventDefault(); finalizeLiveText(); } }}
              style={{ position: 'absolute', top: textInputPosition.y + mainCanvasRef.current.getBoundingClientRect().top, left: textInputPosition.x + mainCanvasRef.current.getBoundingClientRect().left,
                       background: 'transparent', border: '1px dashed hsl(var(--primary))', outline: 'none', color: selectedColor,
                       font: `${getFontSize()}px sans-serif`, lineHeight: `${getFontSize() * 1.2}px`, zIndex: 10,
                       minWidth: '50px', resize: 'none', overflow: 'hidden', whiteSpace: 'pre' }}
              autoFocus
          />
      )}
      <div className="flex flex-col h-full bg-muted/30">
        <div className="flex-none p-2 border-b bg-background shadow-md sticky top-16 z-20">
          <div className="container mx-auto flex flex-wrap items-center justify-center gap-2">
             <ToolButton icon={Brush} label="Draw" onClick={() => handleToolClick("draw")} isActive={drawingTools.includes(activeTool) && activeTool !== "erase"} />
             <ToolButton icon={Type} label="Text" onClick={() => handleToolClick("text")} isActive={activeTool === "text"}/>
             <ToolButton icon={Eraser} label="Erase" onClick={() => handleToolClick("erase")} isActive={activeTool === "erase"}/>
             <ToolButton icon={Undo2} label="Undo" onClick={handleUndo} disabled={historyStep === 0} />
             <ToolButton icon={Redo2} label="Redo" onClick={handleRedo} disabled={historyStep === history.length - 1}/>
             <AlertDialog>
                <AlertDialogTrigger asChild>
                    <Button variant="outline" size="icon" className="rounded-lg w-12 h-12 flex flex-col items-center justify-center text-xs" aria-label="Clear">
                        <Trash2 className="h-5 w-5 mb-0.5" />
                    </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="rounded-xl"><AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle><AlertDialogDescription>This will clear the entire whiteboard. This action cannot be undone.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel className="rounded-lg">Cancel</AlertDialogCancel><AlertDialogAction onClick={handleClearWhiteboard} className="rounded-lg">Clear Whiteboard</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
             </AlertDialog>
          </div>
        </div>

        {showToolOptions && (
           <div className="p-3 border-b bg-muted/50 shadow-lg flex flex-col items-center justify-center md:flex-row md:justify-center md:items-start gap-4">
             <div className="flex flex-col items-center md:flex-row md:items-start flex-wrap justify-center gap-x-6 gap-y-4">
                {activeTool === 'text' ? (
                    <>
                      <div><span className="text-xs font-medium text-muted-foreground">Color:</span><div className="flex flex-wrap gap-2 mt-1 justify-center">{['#000000', '#EF4444', '#F97316', '#EAB308', '#22C55E', '#0EA5E9', '#6366F1', '#EC4899'].map(c => (<ColorSwatch key={c} color={c} onClick={() => setSelectedColor(c)} isSelected={selectedColor === c} />))}</div></div>
                      <div><span className="text-xs font-medium text-muted-foreground">Text Size:</span><div className="flex gap-2 mt-1 justify-center">{textSizes.map(s => (<Button key={s.name} variant={selectedTextSize === s.name ? "default" : "outline"} size="sm" className="rounded-lg" onClick={() => setSelectedTextSize(s.name)}>{s.name.charAt(0).toUpperCase() + s.name.slice(1)}</Button>))}</div></div>
                    </>
                ) : activeTool === 'erase' ? (
                    <div className="flex flex-col items-center justify-center"><span className="text-xs font-medium text-muted-foreground">Eraser Size:</span><div className="flex gap-2 mt-1 justify-center">{brushSizes.map(b => (<Button key={b.name} variant={selectedBrushSize === b.name ? "default" : "outline"} size="icon" className="rounded-lg w-10 h-10" onClick={() => setSelectedBrushSize(b.name)}><CircleIconShape className={cn("h-5 w-5", b.name === 'tiny' && 'h-2 w-2', b.name === 'small' && 'h-3 w-3', b.name === 'large' && 'h-6 w-6', b.name === 'xlarge' && 'h-7 w-7')} /></Button>))}</div></div>
                ) : ( // Drawing tools
                    <>
                        <div><span className="text-xs font-medium text-muted-foreground">Color:</span><div className="flex flex-wrap gap-2 mt-1 justify-center">{['#000000', '#EF4444', '#F97316', '#EAB308', '#22C55E', '#0EA5E9', '#6366F1', '#EC4899'].map(c => (<ColorSwatch key={c} color={c} onClick={() => setSelectedColor(c)} isSelected={selectedColor === c} />))}</div></div>
                        <div><span className="text-xs font-medium text-muted-foreground">Size:</span><div className="flex gap-2 mt-1 justify-center">{brushSizes.map(b => (<Button key={b.name} variant={selectedBrushSize === b.name ? "default" : "outline"} size="icon" className="rounded-lg w-10 h-10" onClick={() => setSelectedBrushSize(b.name)}><CircleIconShape className={cn("h-5 w-5", b.name === 'tiny' && 'h-2 w-2', b.name === 'small' && 'h-3 w-3', b.name === 'large' && 'h-6 w-6', b.name === 'xlarge' && 'h-7 w-7')} /></Button>))}</div></div>
                        <div><span className="text-xs font-medium text-muted-foreground">Shape:</span><div className="flex flex-wrap gap-2 mt-1 justify-center">{[ {tool: "draw", icon: Edit3, label: "Freehand"}, {tool: "line", icon: Minus, label: "Line"}, {tool: "arrow", icon: ArrowRight, label: "Arrow"}, {tool: "circle", icon: CircleIconShape, label: "Circle"}, {tool: "square", icon: SquareIconShape, label: "Square"}, {tool: "triangle", icon: TriangleIcon, label: "Triangle"} ].map(t => (<ToolButton key={t.tool} icon={t.icon} label={t.label} onClick={() => setActiveTool(t.tool)} isActive={activeTool === t.tool}/>))}</div></div>
                    </>
                )}
             </div>
           </div>
        )}

        <main className="flex-grow flex flex-col overflow-hidden min-h-0"> 
          <Card className="w-full h-full max-w-full text-center shadow-none rounded-none border-0 flex flex-col overflow-hidden">
            <CardContent className="flex-grow bg-card flex items-center justify-center relative p-0"> 
                <canvas ref={mainCanvasRef} className="touch-none w-full h-full block absolute top-0 left-0" style={{ zIndex: 1 }} />
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
