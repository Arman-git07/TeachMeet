
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

const drawingTools = ['draw', 'line', 'circle', 'square', 'arrow', 'triangle'];
const MAX_HISTORY_STEPS = 20;

export default function WhiteboardPage() {
  const params = useParams();
  const meetingId = params.meetingId as string;
  const { toast } = useToast();
  const router = useRouter();
  const { setHeaderContent } = useDynamicHeader();

  const [activeTool, setActiveTool] = useState<string | null>("draw");

  const [selectedColor, setSelectedColor] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const storedColor = localStorage.getItem("teachmeet-whiteboard-pen-color");
      return storedColor || "#000000";
    }
    return "#000000";
  });
  const [selectedBrushSize, setSelectedBrushSize] = useState<string>("medium");
  const [selectedTextSize, setSelectedTextSize] = useState<string>("medium");
  const [showDrawingToolOptions, setShowDrawingToolOptions] = useState<boolean>(true);
  const [showClearConfirmDialog, setShowClearConfirmDialog] = useState<boolean>(false);

  const [canvasBackgroundColor, setCanvasBackgroundColor] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem("teachmeet-whiteboard-bg-color") || "#FFFFFF";
    }
    return "#FFFFFF";
  });

  const [history, setHistory] = useState<ImageData[]>([]);
  const [historyStep, setHistoryStep] = useState<number>(-1);
  const [isInitialStateSaved, setIsInitialStateSaved] = useState(false);
  
  const [isTypingText, setIsTypingText] = useState(false);
  const [currentText, setCurrentText] = useState('');
  const [textInputPosition, setTextInputPosition] = useState<{ x: number, y: number } | null>(null);
  const liveTextInputRef = useRef<HTMLTextAreaElement>(null);
  const [cursorBlinkVisible, setCursorBlinkVisible] = useState(true);
  const cursorIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [drawnTextObjects, setDrawnTextObjects] = useState<TextElement[]>([]);

  // State for select tool
  const [isDrawingLasso, setIsDrawingLasso] = useState(false);
  const [lassoPath, setLassoPath] = useState<{x: number, y: number}[]>([]);
  const [selectedTextObjectIds, setSelectedTextObjectIds] = useState<string[]>([]);
  const [isDraggingSelection, setIsDraggingSelection] = useState(false);
  const dragStartOffsetRef = useRef<{ x: number, y: number, objOffsets: Map<string, {x: number, y: number}> } | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const contextRef = useRef<CanvasRenderingContext2D | null>(null);
  const drawingOptionsToolbarRef = useRef<HTMLDivElement>(null);

  const isDrawingRef = useRef(false);
  const lastPositionRef = useRef<{ x: number, y: number } | null>(null);
  const shapeStartPointRef = useRef<{ x: number, y: number } | null>(null);


  const availableColors = [
    "#000000", "#EF4444", "#F97316", "#EAB308", "#22C55E", "#0EA5E9", "#6366F1", "#EC4899",
    "#A855F7", "#8B5CF6", "#3B82F6", "#10B981", "#F59E0B", "#D946EF", "#78716C", "#FFFFFF"
  ];

  const brushSizes = [
    { name: 'tiny', icon: CircleIconShape, label: 'Tiny Brush', lineWidth: 1 },
    { name: 'small', icon: CircleIconShape, label: 'Small Brush', lineWidth: 3 },
    { name: 'medium', icon: CircleIconShape, label: 'Medium Brush', lineWidth: 6 },
    { name: 'large', icon: CircleIconShape, label: 'Large Brush', lineWidth: 10 },
    { name: 'xlarge', icon: CircleIconShape, label: 'X-Large Brush', lineWidth: 15 },
  ];
  
  const textSizes = [
    { name: 'small', label: 'Small Text', fontSize: 12 },
    { name: 'medium', label: 'Medium Text', fontSize: 16 },
    { name: 'large', label: 'Large Text', fontSize: 24 },
    { name: 'xlarge', label: 'X-Large Text', fontSize: 32 },
  ];

  const getLineWidth = useCallback(() => {
    return brushSizes.find(b => b.name === selectedBrushSize)?.lineWidth || 6;
  }, [selectedBrushSize]);
  
  const getFontSize = useCallback(() => {
    return textSizes.find(s => s.name === selectedTextSize)?.fontSize || 16;
  }, [selectedTextSize]);


  const redrawCanvasContent = useCallback(() => {
    if (!contextRef.current || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const context = contextRef.current;
    
    context.globalCompositeOperation = 'source-over';
    context.fillStyle = canvasBackgroundColor;
    context.fillRect(0, 0, canvas.width, canvas.height);

    if (history.length > 0 && historyStep >= 0 && historyStep < history.length && history[historyStep]) {
      try {
        context.putImageData(history[historyStep], 0, 0);
      } catch (e) {
        console.error("Error redrawing drawings from history:", e);
        context.fillStyle = canvasBackgroundColor;
        context.fillRect(0, 0, canvas.width, canvas.height);
      }
    } else if (!isInitialStateSaved && canvas.width > 0 && canvas.height > 0) {
      const blankImageData = context.getImageData(0,0, canvas.width, canvas.height);
      setHistory([blankImageData]);
      setHistoryStep(0);
      setIsInitialStateSaved(true);
    }
    
    drawnTextObjects.forEach(textObj => {
      context.fillStyle = textObj.color;
      context.font = textObj.font;
      context.textAlign = "left";
      context.textBaseline = "top";
      textObj.textLines.forEach((line, index) => {
        context.fillText(line, textObj.x, textObj.y + (index * textObj.lineHeight));
      });

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
      lines.forEach((line, index) => {
        context.fillText(line, textInputPosition.x, textInputPosition.y + (index * liveLineHeight));
      });

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
        for (let i = 1; i < lassoPath.length; i++) {
            context.lineTo(lassoPath[i].x, lassoPath[i].y);
        }
        context.strokeStyle = "rgba(0, 123, 255, 0.7)";
        context.lineWidth = 1;
        context.setLineDash([4, 2]);
        context.stroke();
        context.setLineDash([]);
    }

  }, [history, historyStep, canvasBackgroundColor, isInitialStateSaved, setIsInitialStateSaved, drawnTextObjects, isTypingText, currentText, textInputPosition, selectedColor, getFontSize, cursorBlinkVisible, selectedTextObjectIds, isDrawingLasso, lassoPath]);

  const saveCurrentCanvasState = useCallback(() => {
    if (!canvasRef.current || !contextRef.current || canvasRef.current.width === 0 || canvasRef.current.height === 0) return;
    const canvas = canvasRef.current;
    const context = contextRef.current;
    try {
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = canvas.width;
        tempCanvas.height = canvas.height;
        const tempCtx = tempCanvas.getContext('2d');
        if (!tempCtx) return;

        tempCtx.fillStyle = canvasBackgroundColor;
        tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
        
        if (history.length > 0 && historyStep >= 0 && history[historyStep]) {
            tempCtx.putImageData(history[historyStep], 0, 0);
        }
        
        const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
        
        setHistory(prevHistory => {
            const newHistoryBase = historyStep === -1 ? [] : prevHistory.slice(0, historyStep + 1);
            let updatedHistory = [...newHistoryBase, imageData];
            if (updatedHistory.length > MAX_HISTORY_STEPS) {
                updatedHistory = updatedHistory.slice(updatedHistory.length - MAX_HISTORY_STEPS);
            }
            setHistoryStep(updatedHistory.length - 1);
            return updatedHistory;
        });
    } catch (e) {
        console.error("Error saving canvas state for history:", e);
    }
  }, [historyStep, MAX_HISTORY_STEPS, canvasBackgroundColor, history]);

 useEffect(() => {
    if (typeof window !== 'undefined') {
        const storedBgColor = localStorage.getItem("teachmeet-whiteboard-bg-color");
        if (storedBgColor) {
            setCanvasBackgroundColor(storedBgColor);
        }
        const storedPenColor = localStorage.getItem("teachmeet-whiteboard-pen-color");
        if (storedPenColor) {
            setSelectedColor(storedPenColor);
        } else {
           localStorage.setItem("teachmeet-whiteboard-pen-color", "#000000");
        }
    }
  }, []);

  useEffect(() => {
    if (isTypingText) {
      cursorIntervalRef.current = setInterval(() => {
        setCursorBlinkVisible(prev => !prev);
      }, 500);
    } else {
      if (cursorIntervalRef.current) {
        clearInterval(cursorIntervalRef.current);
        cursorIntervalRef.current = null;
      }
      setCursorBlinkVisible(true); 
    }
    return () => {
      if (cursorIntervalRef.current) {
        clearInterval(cursorIntervalRef.current);
      }
    };
  }, [isTypingText]);

  useEffect(() => {
    const WhiteboardPageHeader = () => (
      <div className="flex items-center justify-between w-full">
        <div className="flex items-center gap-2 sm:gap-3">
          <Edit3 className="h-6 w-6 sm:h-7 sm:w-7 text-primary" />
          <h1 className="text-lg sm:text-xl font-semibold text-foreground truncate">
            TeachMeet Whiteboard
          </h1>
        </div>
        {meetingId && (
          <Link href={`/dashboard/meeting/${meetingId}`} passHref legacyBehavior>
            <Button variant="outline" size="sm" className="rounded-lg text-xs sm:text-sm">
              <ArrowLeft className="mr-1.5 h-3.5 w-3.5 sm:mr-2 sm:h-4 sm:w-4" />
              Back to Meeting
            </Button>
          </Link>
        )}
      </div>
    );
    setHeaderContent(<WhiteboardPageHeader />);

    return () => {
      setHeaderContent(null);
    };
  }, [setHeaderContent, meetingId, router]);
  
  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (canvas && canvas.parentElement) {
      const context = contextRef.current;
      
      const newWidth = canvas.parentElement.clientWidth;
      const newHeight = canvas.parentElement.clientHeight;

      if (newWidth > 0 && newHeight > 0) {
        canvas.width = newWidth;
        canvas.height = newHeight;

        if (context) {
          context.lineCap = "round";
          context.lineJoin = "round";
          redrawCanvasContent(); 
        }
      }
    }
  }, [redrawCanvasContent]);


  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (context) {
        contextRef.current = context;
        resizeCanvas(); 
        if (history.length === 0 && canvas.width > 0 && canvas.height > 0 && !isInitialStateSaved) {
            context.fillStyle = canvasBackgroundColor;
            context.fillRect(0, 0, canvas.width, canvas.height);
            const blankImageData = context.getImageData(0, 0, canvas.width, canvas.height);
            setHistory([blankImageData]);
            setHistoryStep(0);
            setIsInitialStateSaved(true);
        }
      }
    }
    window.addEventListener("resize", resizeCanvas);
    return () => window.removeEventListener("resize", resizeCanvas);
  }, [resizeCanvas, history.length, canvasBackgroundColor, isInitialStateSaved]);


  useEffect(() => {
    if (contextRef.current && activeTool !== 'select') {
      if (activeTool === 'erase') {
        contextRef.current.strokeStyle = canvasBackgroundColor; 
        contextRef.current.globalCompositeOperation = 'source-over';
      } else {
        contextRef.current.strokeStyle = selectedColor;
        contextRef.current.globalCompositeOperation = 'source-over';
      }
      contextRef.current.lineWidth = getLineWidth();
    }
  }, [selectedColor, selectedBrushSize, getLineWidth, activeTool, canvasBackgroundColor]);
  
  useEffect(() => {
    redrawCanvasContent();
  }, [historyStep, drawnTextObjects, canvasBackgroundColor, redrawCanvasContent, isTypingText, cursorBlinkVisible, currentText, selectedTextObjectIds, isDrawingLasso, lassoPath]); 

  const finalizeLiveText = useCallback(() => {
    if (!isTypingText || !contextRef.current || !liveTextInputRef.current) return; 
    const context = contextRef.current;

    const textToDraw = currentText.trimEnd(); 
    if (textToDraw && textInputPosition) {
        const fontSize = getFontSize();
        const font = `${fontSize}px sans-serif`;
        context.font = font;
        const lines = textToDraw.split('\n');
        let maxWidth = 0;
        lines.forEach(line => {
            const metrics = context.measureText(line);
            if (metrics.width > maxWidth) {
                maxWidth = metrics.width;
            }
        });
        const lineHeight = fontSize * 1.2;
        const textHeight = lines.length * lineHeight;

      const newTextElement: TextElement = {
        id: Date.now().toString(),
        textLines: lines,
        x: textInputPosition.x,
        y: textInputPosition.y,
        color: selectedColor,
        fontSize: fontSize,
        font: font,
        lineHeight: lineHeight,
        width: maxWidth,
        height: textHeight,
      };
      setDrawnTextObjects(prev => [...prev, newTextElement]);
    }
    setIsTypingText(false);
    setCurrentText('');
    setTextInputPosition(null);
    if (liveTextInputRef.current) {
      liveTextInputRef.current.blur();
      liveTextInputRef.current.value = '';
    }
    redrawCanvasContent(); 
  }, [isTypingText, currentText, textInputPosition, selectedColor, getFontSize, setDrawnTextObjects, redrawCanvasContent]);


  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node;
      const isClickOnOptionsToggler = (target as HTMLElement).closest('[data-options-toggler="true"]');
      
      if (isTypingText) {
         if (canvasRef.current && canvasRef.current.contains(target)) {
           return;
         }
         if (isClickOnOptionsToggler && activeTool === 'text') {
           return;
         }
         if (drawingOptionsToolbarRef.current && drawingOptionsToolbarRef.current.contains(target) && activeTool === 'text') {
            return;
         }
         finalizeLiveText();
      }

      if (
        drawingOptionsToolbarRef.current &&
        !drawingOptionsToolbarRef.current.contains(target) &&
        !isClickOnOptionsToggler &&
        showDrawingToolOptions
      ) {
        const canvasElem = canvasRef.current;
        if (canvasElem && canvasElem.contains(target) && (isDrawingRef.current || (activeTool === 'text' && !isTypingText) || activeTool === 'select')) {
          // Do nothing
        } else {
          setShowDrawingToolOptions(false);
        }
      }
    };

    if (showDrawingToolOptions || isTypingText) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("touchstart", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [showDrawingToolOptions, isTypingText, finalizeLiveText, activeTool]);


  const getPointerPosition = useCallback((event: MouseEvent | TouchEvent | React.MouseEvent | React.TouchEvent): { x: number, y: number } | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    let clientX: number | undefined;
    let clientY: number | undefined;

    const nativeEvent = 'nativeEvent' in event ? event.nativeEvent : event;

    if (nativeEvent instanceof TouchEvent) {
      if (nativeEvent.touches && nativeEvent.touches.length > 0) {
        clientX = nativeEvent.touches[0].clientX;
        clientY = nativeEvent.touches[0].clientY;
      } else if (nativeEvent.changedTouches && nativeEvent.changedTouches.length > 0) {
        clientX = nativeEvent.changedTouches[0].clientX;
        clientY = nativeEvent.changedTouches[0].clientY;
      }
    } else if (nativeEvent instanceof MouseEvent) {
      clientX = nativeEvent.clientX;
      clientY = nativeEvent.clientY;
    }

    if (typeof clientX !== 'number' || typeof clientY !== 'number') {
      return null;
    }

    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  }, []);

  const startDrawingInternal = useCallback((pos: { x: number, y: number }) => {
    if (!contextRef.current || !activeTool || activeTool === 'text' || activeTool === 'select') return;
    
    isDrawingRef.current = true;
    lastPositionRef.current = pos;
    shapeStartPointRef.current = pos;

    if (history[historyStep] && canvasRef.current) {
      contextRef.current.putImageData(history[historyStep], 0, 0);
    } else if(canvasRef.current) { 
      contextRef.current.fillStyle = canvasBackgroundColor;
      contextRef.current.fillRect(0,0,canvasRef.current.width, canvasRef.current.height);
    }

    contextRef.current.beginPath();
    contextRef.current.moveTo(pos.x, pos.y);

    if (activeTool === 'erase') {
      contextRef.current.globalCompositeOperation = 'source-over'; 
      contextRef.current.strokeStyle = canvasBackgroundColor; 
    } else {
      contextRef.current.globalCompositeOperation = 'source-over';
      contextRef.current.strokeStyle = selectedColor;
    }
    contextRef.current.lineWidth = getLineWidth();
  }, [activeTool, selectedColor, getLineWidth, canvasBackgroundColor, history, historyStep]);

  const drawInternal = useCallback((pos: { x: number, y: number }) => {
    if (!contextRef.current || !lastPositionRef.current || !activeTool || !isDrawingRef.current || activeTool === 'text' || activeTool === 'select') return;

    const currentCtx = contextRef.current;

    if (activeTool === 'draw' || activeTool === 'erase') {
      currentCtx.lineTo(pos.x, pos.y);
      currentCtx.stroke();
      lastPositionRef.current = pos;
    } else if (drawingTools.includes(activeTool) && shapeStartPointRef.current) {
        if (history[historyStep] && canvasRef.current) {
            currentCtx.putImageData(history[historyStep], 0, 0);
        } else if (canvasRef.current) { 
            currentCtx.fillStyle = canvasBackgroundColor; 
            currentCtx.fillRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        }
        
        const start = shapeStartPointRef.current;
        const end = pos;
        currentCtx.beginPath(); 
        currentCtx.globalCompositeOperation = 'source-over';
        currentCtx.strokeStyle = activeTool === 'erase' ? canvasBackgroundColor : selectedColor;
        currentCtx.lineWidth = getLineWidth();

        if (activeTool === 'line') {
            currentCtx.moveTo(start.x, start.y);
            currentCtx.lineTo(end.x, end.y);
        } else if (activeTool === 'square') {
            currentCtx.rect(start.x, start.y, end.x - start.x, end.y - start.y);
        } else if (activeTool === 'circle') {
            const dx = end.x - start.x;
            const dy = end.y - start.y;
            const radius = Math.sqrt(dx * dx + dy * dy) / 2;
            const centerX = start.x + dx / 2;
            const centerY = start.y + dy / 2;
            currentCtx.arc(centerX, centerY, Math.abs(radius), 0, 2 * Math.PI);
        } else if (activeTool === 'arrow') {
            const headlen = 10 + getLineWidth();
            const angle = Math.atan2(end.y - start.y, end.x - start.x);
            currentCtx.moveTo(start.x, start.y);
            currentCtx.lineTo(end.x, end.y);
            currentCtx.lineTo(end.x - headlen * Math.cos(angle - Math.PI / 6), end.y - headlen * Math.sin(angle - Math.PI / 6));
            currentCtx.moveTo(end.x, end.y);
            currentCtx.lineTo(end.x - headlen * Math.cos(angle + Math.PI / 6), end.y - headlen * Math.sin(angle + Math.PI / 6));
        } else if (activeTool === 'triangle') {
            const p1 = { x: start.x + (end.x - start.x) / 2, y: start.y };
            const p2 = { x: start.x, y: end.y };
            const p3 = { x: end.x, y: end.y };
            currentCtx.moveTo(p1.x, p1.y);
            currentCtx.lineTo(p2.x, p2.y);
            currentCtx.lineTo(p3.x, p3.y);
            currentCtx.closePath();
        }
        currentCtx.stroke();
    }
  }, [activeTool, history, historyStep, canvasBackgroundColor, selectedColor, getLineWidth]);

  const stopDrawingInternal = useCallback((pos?: { x: number, y: number }) => {
    if (!contextRef.current || !isDrawingRef.current || activeTool === 'text' || activeTool === 'select') {
      if (isDrawingRef.current) { 
        isDrawingRef.current = false;
        lastPositionRef.current = null;
        shapeStartPointRef.current = null;
      }
      return;
    }
    
    const currentCtx = contextRef.current;
    if (drawingTools.includes(activeTool || "") && activeTool !== 'draw' && shapeStartPointRef.current && (pos || lastPositionRef.current)) {
        if (history[historyStep] && canvasRef.current) {
            currentCtx.putImageData(history[historyStep], 0, 0);
        } else if (canvasRef.current) { 
            currentCtx.fillStyle = canvasBackgroundColor; 
            currentCtx.fillRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        }

        const finalPos = pos || lastPositionRef.current!; 
        const start = shapeStartPointRef.current;
        const end = finalPos;
        currentCtx.beginPath();
        currentCtx.globalCompositeOperation = 'source-over';
        currentCtx.strokeStyle = activeTool === 'erase' ? canvasBackgroundColor : selectedColor;
        currentCtx.lineWidth = getLineWidth();
        if (activeTool === 'line') {
            currentCtx.moveTo(start.x, start.y);
            currentCtx.lineTo(end.x, end.y);
        } else if (activeTool === 'square') {
            currentCtx.rect(start.x, start.y, end.x - start.x, end.y - start.y);
        } else if (activeTool === 'circle') {
            const dx = end.x - start.x;
            const dy = end.y - start.y;
            const radius = Math.sqrt(dx * dx + dy * dy) / 2;
            const centerX = start.x + dx / 2;
            const centerY = start.y + dy / 2;
            currentCtx.arc(centerX, centerY, Math.abs(radius), 0, 2 * Math.PI);
        } else if (activeTool === 'arrow') {
            const headlen = 10 + getLineWidth();
            const angle = Math.atan2(end.y - start.y, end.x - start.x);
            currentCtx.moveTo(start.x, start.y);
            currentCtx.lineTo(end.x, end.y);
            currentCtx.lineTo(end.x - headlen * Math.cos(angle - Math.PI / 6), end.y - headlen * Math.sin(angle - Math.PI / 6));
            currentCtx.moveTo(end.x, end.y);
            currentCtx.lineTo(end.x - headlen * Math.cos(angle + Math.PI / 6), end.y - headlen * Math.sin(angle + Math.PI / 6));
        } else if (activeTool === 'triangle') {
            const p1 = { x: start.x + (end.x - start.x) / 2, y: start.y };
            const p2 = { x: start.x, y: end.y };
            const p3 = { x: end.x, y: end.y };
            currentCtx.moveTo(p1.x, p1.y);
            currentCtx.lineTo(p2.x, p2.y);
            currentCtx.lineTo(p3.x, p3.y);
            currentCtx.closePath();
        }
        currentCtx.stroke();
    }

    saveCurrentCanvasState(); 
    isDrawingRef.current = false;
    lastPositionRef.current = null;
    shapeStartPointRef.current = null;
    redrawCanvasContent(); 
  }, [activeTool, selectedColor, getLineWidth, saveCurrentCanvasState, history, historyStep, canvasBackgroundColor, redrawCanvasContent]);

  const handlePointerMove = useCallback((event: MouseEvent | TouchEvent) => {
    const pos = getPointerPosition(event);
    if (!pos || !canvasRef.current) return;

    let currentCursor: string = 'default';

    if (isDrawingRef.current) {
      if (event instanceof TouchEvent || (event.type === 'touchmove')) event.preventDefault();
      drawInternal(pos);
      currentCursor = (activeTool && (drawingTools.includes(activeTool) || activeTool === 'erase')) ? 'crosshair' : 'default';
    } else if (isDrawingLasso) {
        if (event instanceof TouchEvent || (event.type === 'touchmove')) event.preventDefault();
        setLassoPath(prev => [...prev, pos]);
        currentCursor = 'crosshair';
    } else if (isDraggingSelection && activeTool === 'select' && dragStartOffsetRef.current) {
      if (event instanceof TouchEvent || (event.type === 'touchmove')) event.preventDefault();
        const deltaX = pos.x - dragStartOffsetRef.current.x;
        const deltaY = pos.y - dragStartOffsetRef.current.y;
        setDrawnTextObjects(prevObjs =>
            prevObjs.map(obj => {
                if (selectedTextObjectIds.includes(obj.id)) {
                    const initialPos = dragStartOffsetRef.current!.objOffsets.get(obj.id)!;
                    return { ...obj, x: initialPos.x + deltaX, y: initialPos.y + deltaY };
                }
                return obj;
            })
        );
        currentCursor = 'grabbing';
    } else { 
        if (activeTool === 'select') {
            const onSelected = selectedTextObjectIds.some(id => {
                const obj = drawnTextObjects.find(t => t.id === id);
                return obj && pos.x >= obj.x && pos.x <= obj.x + obj.width && pos.y >= obj.y && pos.y <= obj.y + obj.height;
            });
            currentCursor = onSelected ? 'grab' : 'crosshair';
        } else {
            currentCursor = isTypingText ? 'text' :
                            activeTool === 'text' ? 'text' :
                            (activeTool && (drawingTools.includes(activeTool) || activeTool === 'erase')) ? 'crosshair' :
                            'default';
        }
    }
    canvasRef.current.style.cursor = currentCursor; 
  }, [getPointerPosition, drawInternal, activeTool, isTypingText, isDrawingLasso, isDraggingSelection, selectedTextObjectIds, drawnTextObjects]);

  const isPointInPolygon = (point: {x: number, y: number}, polygon: {x: number, y: number}[]) => {
      let isInside = false;
      for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
          const xi = polygon[i].x, yi = polygon[i].y;
          const xj = polygon[j].x, yj = polygon[j].y;

          const intersect = ((yi > point.y) !== (yj > point.y))
              && (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi);
          if (intersect) isInside = !isInside;
      }
      return isInside;
  };

  const handlePointerUp = useCallback((event: MouseEvent | TouchEvent) => {
    const pos = getPointerPosition(event);

    if (isDrawingRef.current) {
      stopDrawingInternal(pos || undefined);
    } else if (isDrawingLasso) {
        const finalLassoPath = [...lassoPath, lassoPath[0]]; // Close the path for accurate detection
        const newSelectedIds = drawnTextObjects.filter(obj => {
            const corners = [
                { x: obj.x, y: obj.y },
                { x: obj.x + obj.width, y: obj.y },
                { x: obj.x, y: obj.y + obj.height },
                { x: obj.x + obj.width, y: obj.y + obj.height },
            ];
            // Select if any corner is inside the lasso
            return corners.some(corner => isPointInPolygon(corner, finalLassoPath));
        }).map(obj => obj.id);
        
        setSelectedTextObjectIds(newSelectedIds);
        setIsDrawingLasso(false);
        setLassoPath([]);
        redrawCanvasContent();
    } else if (isDraggingSelection) {
        setIsDraggingSelection(false);
        dragStartOffsetRef.current = null;
        redrawCanvasContent();
    }

    window.removeEventListener('touchmove', handlePointerMove);
    window.removeEventListener('touchend', handlePointerUp);
    window.removeEventListener('touchcancel', handlePointerUp);
    window.removeEventListener('mousemove', handlePointerMove);
    window.removeEventListener('mouseup', handlePointerUp);
  }, [getPointerPosition, stopDrawingInternal, handlePointerMove, lassoPath, drawnTextObjects, isDraggingSelection, redrawCanvasContent]);

  const handleCanvasPointerDown = useCallback((event: React.MouseEvent | React.TouchEvent) => {
    if ((event as React.MouseEvent).nativeEvent instanceof MouseEvent && (event as React.MouseEvent).nativeEvent.button !== 0) return; 

    const pos = getPointerPosition(event);
    if (!pos) return;
    
    if (isTypingText) {
      finalizeLiveText();
    }

    if (activeTool === 'select') {
        let clickedOnSelectedObject = false;
        if (selectedTextObjectIds.length > 0) {
            for (const id of selectedTextObjectIds) {
                const obj = drawnTextObjects.find(t => t.id === id);
                if (obj && pos.x >= obj.x && pos.x <= obj.x + obj.width && pos.y >= obj.y && pos.y <= obj.y + obj.height) {
                    clickedOnSelectedObject = true;
                    break;
                }
            }
        }

        if (clickedOnSelectedObject) {
            setIsDraggingSelection(true);
            const objOffsets = new Map<string, {x: number, y: number}>();
            selectedTextObjectIds.forEach(id => {
                const obj = drawnTextObjects.find(t => t.id === id);
                if (obj) objOffsets.set(id, {x: obj.x, y: obj.y});
            });
            dragStartOffsetRef.current = { x: pos.x, y: pos.y, objOffsets };
        } else {
            setIsDrawingLasso(true);
            setLassoPath([pos]);
            setSelectedTextObjectIds([]);
        }
    } else if (activeTool === 'text') {
        setTextInputPosition(pos);
        setCurrentText(''); 
        setIsTypingText(true);
        setTimeout(() => { 
            if (liveTextInputRef.current) {
                const canvasRect = canvasRef.current?.getBoundingClientRect();
                if (canvasRect) {
                    liveTextInputRef.current.style.top = `${pos.y + canvasRect.top + window.scrollY}px`;
                    liveTextInputRef.current.style.left = `${pos.x + canvasRect.left + window.scrollX}px`;
                }
                liveTextInputRef.current.focus();
            }
        }, 0);
    } else if (activeTool && (drawingTools.includes(activeTool) || activeTool === 'erase')) { 
        if (event.type === 'touchstart') event.preventDefault(); 
        startDrawingInternal(pos);
    }

    if (event.type.startsWith('touch')) {
      window.addEventListener('touchmove', handlePointerMove, { passive: false });
      window.addEventListener('touchend', handlePointerUp);
      window.addEventListener('touchcancel', handlePointerUp);
    } else {
      window.addEventListener('mousemove', handlePointerMove);
      window.addEventListener('mouseup', handlePointerUp);
    }
  }, [activeTool, getPointerPosition, startDrawingInternal, handlePointerMove, handlePointerUp, finalizeLiveText, isTypingText, selectedTextObjectIds, drawnTextObjects]);


  useEffect(() => {
    return () => {
      window.removeEventListener('touchmove', handlePointerMove);
      window.removeEventListener('touchend', handlePointerUp);
      window.removeEventListener('touchcancel', handlePointerUp);
      window.removeEventListener('mousemove', handlePointerMove);
      window.removeEventListener('mouseup', handlePointerUp);
    };
  }, [handlePointerMove, handlePointerUp]);

  const handleToolClick = (toolName: string) => {
    const toolId = toolName.toLowerCase().replace(/\s+/g, '');
    
    if (isTypingText && toolId !== 'text') { 
      finalizeLiveText();
    }
    
    const isToolWithToggleableOptions = drawingTools.includes(toolId) || toolId === 'erase' || toolId === 'text' || toolId === 'select';

    if (activeTool === toolId && isToolWithToggleableOptions) {
      setShowDrawingToolOptions(prev => !prev);
    } else {
      setActiveTool(toolId);
      if (isToolWithToggleableOptions) {
        setShowDrawingToolOptions(true); 
      } else {
        setShowDrawingToolOptions(false); 
      }
    }
    if (toolId !== 'select') {
        setSelectedTextObjectIds([]);
        setLassoPath([]);
    }
  };

  const handleColorSelect = (color: string) => {
    setSelectedColor(color);
    localStorage.setItem("teachmeet-whiteboard-pen-color", color);
  };

  const handleBrushSizeSelect = (size: string) => {
    setSelectedBrushSize(size);
  };
  
  const handleTextSizeSelect = (sizeName: string) => {
    setSelectedTextSize(sizeName);
  };

  const handleConfirmClearAll = () => {
    if (contextRef.current && canvasRef.current) {
      const context = contextRef.current;
      const canvas = canvasRef.current;
      context.globalCompositeOperation = 'source-over';
      context.fillStyle = canvasBackgroundColor;
      context.fillRect(0, 0, canvas.width, canvas.height);
      
      setDrawnTextObjects([]); 
      finalizeLiveText(); 
      
      const blankImageData = context.getImageData(0, 0, canvas.width, canvas.height);
      setHistory([blankImageData]);
      setHistoryStep(0);
      setIsInitialStateSaved(true); 
      setSelectedTextObjectIds([]);
      setLassoPath([]);
      redrawCanvasContent(); 
    }
    setShowClearConfirmDialog(false);
  };

  const handleUndo = useCallback(() => {
    finalizeLiveText(); 
    if (historyStep > 0) {
        const newStep = historyStep - 1;
        setHistoryStep(newStep);
        redrawCanvasContent(); 
    } else if (historyStep === 0) { 
        setHistoryStep(-1); 
        redrawCanvasContent(); 
    } else {
        toast({ title: "Nothing to undo", duration: 2000 });
    }
  }, [historyStep, toast, finalizeLiveText, redrawCanvasContent]);

  const handleRedo = useCallback(() => {
    finalizeLiveText(); 
    if (historyStep < history.length - 1) {
        const newStep = historyStep + 1;
        setHistoryStep(newStep);
        redrawCanvasContent(); 
    } else {
        toast({ title: "Nothing to redo", duration: 2000 });
    }
  }, [history, historyStep, toast, finalizeLiveText, redrawCanvasContent]);

  const isOptionsPanelToolActive = activeTool && (drawingTools.includes(activeTool) || activeTool === 'erase' || activeTool === 'text' || activeTool === 'select');


  const handleLiveTextInputChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setCurrentText(event.target.value);
  };

  const handleLiveTextInputKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => { 
    if (event.key === 'Enter' && !event.shiftKey) { 
      event.preventDefault(); 
      setCurrentText(prev => prev + '\n'); 
    }
  };

  return (
    <>
      <textarea
        ref={liveTextInputRef}
        value={currentText} 
        onChange={handleLiveTextInputChange}
        onKeyDown={handleLiveTextInputKeyDown}
        onBlur={finalizeLiveText} 
        style={{
          position: 'absolute',
          opacity: 0, 
          width: '1px', height: '1px', 
          border: 'none', padding: 0, margin: 0,
          overflow: 'hidden', resize: 'none',
          whiteSpace: 'pre', 
          fontSize: `${getFontSize()}px`, 
          fontFamily: 'sans-serif', 
          color: selectedColor, 
          background: 'transparent', 
          top: '-9999px', 
          left: '-9999px',
        }}
        aria-hidden="true" 
        tabIndex={-1} 
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck="false"
      />
      <div className="flex flex-col h-full bg-muted/30">
        <div className="flex-none p-2 border-b bg-background shadow-md sticky top-16 z-20">
          <div className="container mx-auto flex flex-wrap items-center justify-center gap-2">
             <ToolButton
              icon={Lasso}
              label="Lasso Select"
              onClick={() => handleToolClick("select")}
              isActive={activeTool === "select"}
              data-options-toggler={true}
            />
            <ToolButton
              icon={Brush}
              label="Draw"
              onClick={() => handleToolClick("draw")}
              isActive={drawingTools.includes(activeTool || "") && activeTool !== "erase"}
              data-options-toggler={true}
            />
            <ToolButton 
                icon={Type} 
                label="Text" 
                onClick={() => handleToolClick("Text")} 
                isActive={activeTool === "text"} 
                data-options-toggler={true}
            />
            <ToolButton
              icon={Eraser}
              label="Erase"
              onClick={() => handleToolClick("Erase")}
              isActive={activeTool === "erase"}
              data-options-toggler={true}
            />
            <ToolButton
                icon={Undo2}
                label="Undo"
                onClick={handleUndo}
                disabled={historyStep < 0} 
            />
            <ToolButton
                icon={Redo2}
                label="Redo"
                onClick={handleRedo}
                disabled={historyStep >= history.length - 1 || history.length === 0}
            />
            <AlertDialog open={showClearConfirmDialog} onOpenChange={setShowClearConfirmDialog}>
                <AlertDialogTrigger asChild>
                    <Button variant="outline" size="icon" className="rounded-lg w-12 h-12 flex flex-col items-center justify-center text-xs" aria-label="Clear">
                        <Trash2 className="h-5 w-5 mb-0.5" />
                    </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="rounded-xl">
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                        This will clear the entire whiteboard including all drawings and text. This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel className="rounded-lg">Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleConfirmClearAll} className="rounded-lg">Clear Whiteboard</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        {showDrawingToolOptions && isOptionsPanelToolActive && (
           <div ref={drawingOptionsToolbarRef} className="p-3 border-b bg-muted/50 absolute top-32 left-0 right-0 z-10 shadow-lg">
            <div className="container mx-auto">
              {activeTool === 'select' ? (
                <div className="flex flex-col items-center gap-2">
                    <p className="text-sm text-muted-foreground">Lasso Select tool active. Click and drag to select text objects.</p>
                    {selectedTextObjectIds.length > 0 && (
                        <p className="text-xs text-primary">{selectedTextObjectIds.length} text object(s) selected. Drag to move.</p>
                    )}
                </div>
              ) : activeTool === 'text' ? (
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                  <div className="flex flex-col items-center md:items-start gap-2">
                    <span className="text-xs font-medium text-muted-foreground">Color:</span>
                    <div className="flex flex-wrap justify-center md:justify-start gap-2 items-center">
                      {availableColors.map(color => (
                        <ColorSwatch
                          key={color}
                          color={color}
                          onClick={() => handleColorSelect(color)}
                          isSelected={selectedColor === color}
                        />
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-col items-center md:items-start gap-2">
                    <span className="text-xs font-medium text-muted-foreground">Text Size:</span>
                    <div className="flex items-center justify-center md:justify-start gap-2 flex-wrap">
                      {textSizes.map(size => (
                        <Button
                          key={size.name}
                          variant={selectedTextSize === size.name ? "default" : "outline"}
                          size="sm"
                          className="rounded-lg px-3 py-1.5 h-auto"
                          onClick={() => handleTextSizeSelect(size.name)}
                          aria-label={size.label}
                        >
                          {size.label.split(' ')[0]}
                        </Button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (activeTool === 'draw' || (drawingTools.includes(activeTool || ""))) && activeTool !== 'erase' ? ( 
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                  <div className="flex flex-col items-center md:items-start gap-2">
                    <span className="text-xs font-medium text-muted-foreground">Color:</span>
                    <div className="flex flex-wrap justify-center md:justify-start gap-2 items-center">
                      {availableColors.map(color => (
                        <ColorSwatch
                          key={color}
                          color={color}
                          onClick={() => handleColorSelect(color)}
                          isSelected={selectedColor === color}
                        />
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-col items-center md:items-start gap-2">
                      <span className="text-xs font-medium text-muted-foreground">Size:</span>
                      <div className="flex items-center justify-center md:justify-start gap-2">
                      {brushSizes.map(brush => (
                          <Button
                              key={brush.name}
                              variant={selectedBrushSize === brush.name ? "default" : "outline"}
                              size="icon"
                              className="rounded-lg w-10 h-10"
                              onClick={() => handleBrushSizeSelect(brush.name)}
                              aria-label={brush.label}
                          >
                              <brush.icon className={cn(
                                  "h-5 w-5", 
                                  brush.name === 'tiny' && 'h-2 w-2',
                                  brush.name === 'small' && 'h-3 w-3',
                                  brush.name === 'large' && 'h-6 w-6',
                                  brush.name === 'xlarge' && 'h-7 w-7'
                              )} />
                          </Button>
                      ))}
                      </div>
                  </div>
                  <div className="flex flex-col items-center md:items-start gap-2">
                      <span className="text-xs font-medium text-muted-foreground">Shape:</span>
                      <div className="flex items-center justify-center md:justify-start gap-2 flex-wrap">
                          <ToolButton icon={Edit3} label="Freehand" onClick={() => {setActiveTool("draw");}} isActive={activeTool === "draw"} />
                          <ToolButton icon={Minus} label="Line" onClick={() => {setActiveTool("line");}} isActive={activeTool === "line"} />
                          <ToolButton icon={ArrowRight} label="Arrow" onClick={() => {setActiveTool("arrow");}} isActive={activeTool === "arrow"} />
                          <ToolButton icon={CircleIconShape} label="Circle" onClick={() => {setActiveTool("circle");}} isActive={activeTool === "circle"} />
                          <ToolButton icon={SquareIconShape} label="Square" onClick={() => {setActiveTool("square");}} isActive={activeTool === "square"} />
                          <ToolButton icon={TriangleIcon} label="Triangle" onClick={() => {setActiveTool("triangle");}} isActive={activeTool === "triangle"} />
                      </div>
                  </div>
                </div>
              ) : activeTool === 'erase' ? (
                 <div className="flex flex-col md:flex-row md:items-start md:justify-center gap-4">
                    <div className="flex flex-col items-center md:items-start gap-2">
                      <span className="text-xs font-medium text-muted-foreground">Eraser Size:</span>
                      <div className="flex items-center justify-center md:justify-start gap-2">
                        {brushSizes.map(brush => (
                            <Button
                                key={brush.name}
                                variant={selectedBrushSize === brush.name ? "default" : "outline"}
                                size="icon"
                                className="rounded-lg w-10 h-10"
                                onClick={() => handleBrushSizeSelect(brush.name)}
                                aria-label={brush.label}
                            >
                                <brush.icon className={cn(
                                    "h-5 w-5",
                                    brush.name === 'tiny' && 'h-2 w-2',
                                    brush.name === 'small' && 'h-3 w-3',
                                    brush.name === 'large' && 'h-6 w-6',
                                    brush.name === 'xlarge' && 'h-7 w-7'
                                )} />
                            </Button>
                        ))}
                      </div>
                    </div>
                  </div>
              ) : null}
            </div>
          </div>
        )}

        <main className="flex-grow flex flex-col overflow-hidden min-h-0"> 
          <Card className="w-full h-full max-w-full text-center shadow-none rounded-none border-0 flex flex-col overflow-hidden">
            <CardContent className="flex-grow bg-card flex items-center justify-center relative p-0"> 
              <canvas
                ref={canvasRef}
                onMouseDown={handleCanvasPointerDown}
                onTouchStart={(e) => {
                  handleCanvasPointerDown(e);
                }}
                className={cn(
                  "border-2 border-dashed border-border/30 touch-none w-full h-full block"
                )}
                style={{ backgroundColor: canvasBackgroundColor }}
              />
              {(!activeTool || !isOptionsPanelToolActive) && !isDrawingRef.current && !isTypingText && activeTool !== 'select' && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <p className="text-muted-foreground text-sm p-3 bg-background/50 rounded-md backdrop-blur-sm">
                    Interactive canvas area - Select a tool to begin.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </main>
        <footer className="flex-none p-2 text-center text-xs text-muted-foreground border-t bg-background">
          TeachMeet Whiteboard - Lasso Select for Text, Draw, Text Input, Erase. Undo/Redo for drawings.
        </footer>
      </div>
    </>
  );

    