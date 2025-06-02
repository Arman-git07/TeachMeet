
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
import { ArrowLeft, Brush, Minus, Type, Eraser, MousePointer2, Trash2, Circle as CircleIconShape, Square as SquareIconShape, Edit3, ArrowRight, Triangle as TriangleIcon, Undo2, Redo2, Wand2 } from "lucide-react";
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
  // For resizing
  originalX?: number;
  originalY?: number;
  originalFontSize?: number;
}

const drawingTools = ['draw', 'line', 'circle', 'square', 'arrow', 'triangle'];
const MAX_HISTORY_STEPS = 20;
const HANDLE_SIZE = 8;
type ResizeHandleType = 'tl' | 'tm' | 'tr' | 'ml' | 'mr' | 'bl' | 'bm' | 'br';

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
  
  const [activeSelection, setActiveSelection] = useState<{ x: number, y: number, w: number, h: number } | null>(null);
  const selectionContentForResizeRef = useRef<{ drawing: ImageData | null; texts: TextElement[] }>({ drawing: null, texts: [] });
  const originalContentBoundsRef = useRef<{ x: number, y: number, w: number, h: number } | null>(null);


  const [isTypingText, setIsTypingText] = useState(false);
  const [currentText, setCurrentText] = useState('');
  const [textInputPosition, setTextInputPosition] = useState<{ x: number, y: number } | null>(null);
  const liveTextInputRef = useRef<HTMLTextAreaElement>(null);
  const [cursorBlinkVisible, setCursorBlinkVisible] = useState(true);
  const cursorIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [drawnTextObjects, setDrawnTextObjects] = useState<TextElement[]>([]);


  const canvasRef = useRef<HTMLCanvasElement>(null);
  const contextRef = useRef<CanvasRenderingContext2D | null>(null);
  const drawingOptionsToolbarRef = useRef<HTMLDivElement>(null);

  const isDrawingRef = useRef(false);
  const lastPositionRef = useRef<{ x: number, y: number } | null>(null);
  const shapeStartPointRef = useRef<{ x: number, y: number } | null>(null);

  const isSelectingRef = useRef(false);
  const selectionStartPointRef = useRef<{ x: number, y: number } | null>(null);
  const initialCanvasDataForSelectionRef = useRef<ImageData | null>(null);
  const currentSelectionRectRef = useRef<{ x: number, y: number, w: number, h: number } | null>(null);

  const isResizingRef = useRef(false);
  const resizeHandleTypeRef = useRef<ResizeHandleType | null>(null);
  const originalSelectionRectRef = useRef<{ x: number, y: number, w: number, h: number } | null>(null);
  const resizeStartPointRef = useRef<{ x: number, y: number } | null>(null);


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
  }, [selectedBrushSize, brushSizes]);
  
  const getFontSize = useCallback(() => {
    return textSizes.find(s => s.name === selectedTextSize)?.fontSize || 16;
  }, [selectedTextSize, textSizes]);


  const getResizeHandles = useCallback((rect: { x: number, y: number, w: number, h: number }): Record<ResizeHandleType, { x: number, y: number }> => {
    return {
        tl: { x: rect.x, y: rect.y },
        tm: { x: rect.x + rect.w / 2, y: rect.y },
        tr: { x: rect.x + rect.w, y: rect.y },
        ml: { x: rect.x, y: rect.y + rect.h / 2 },
        mr: { x: rect.x + rect.w, y: rect.y + rect.h / 2 },
        bl: { x: rect.x, y: rect.y + rect.h },
        bm: { x: rect.x + rect.w / 2, y: rect.y + rect.h },
        br: { x: rect.x + rect.w, y: rect.y + rect.h },
    };
  }, []);

  const drawSelectionBoxWithHandles = useCallback((rect: { x: number, y: number, w: number, h: number }) => {
    if (!contextRef.current || !canvasRef.current) return;
    const ctx = contextRef.current;

    ctx.save(); 

    ctx.strokeStyle = 'rgba(0, 100, 255, 0.9)'; 
    ctx.lineWidth = 1.5;
    ctx.setLineDash([]); 
    ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);

    const handles = getResizeHandles(rect);

    ctx.fillStyle = 'white';
    ctx.strokeStyle = 'rgba(0, 100, 255, 0.9)';
    ctx.lineWidth = 1;

    Object.values(handles).forEach(handle => {
        ctx.beginPath();
        ctx.arc(handle.x, handle.y, HANDLE_SIZE / 2, 0, 2 * Math.PI);
        ctx.fill();
        ctx.stroke();
    });
    ctx.restore(); 
  }, [HANDLE_SIZE, getResizeHandles]);

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

    if (activeSelection) {
      drawSelectionBoxWithHandles(activeSelection);
    }
  }, [history, historyStep, canvasBackgroundColor, activeSelection, drawSelectionBoxWithHandles, isInitialStateSaved, setIsInitialStateSaved, drawnTextObjects, isTypingText, currentText, textInputPosition, selectedColor, getFontSize, cursorBlinkVisible]);

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
        
        // Capture only the drawing layer from the main canvas by excluding text and selection box
        // This means we need to draw *only* what the drawing tools draw onto this tempCtx
        // The current approach is to take the full main context.getImageData(), which is problematic
        // because it includes text.
        // A better approach is: the drawing operations directly modify history[historyStep] (or its successor)
        // So, context.getImageData() should be what we want for the *drawing layer*.

        // Get current state of main canvas (which SHOULD include latest drawing, but not text yet)
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
  }, [historyStep, MAX_HISTORY_STEPS, canvasBackgroundColor, history]); // Removed `contextRef` and `canvasRef` as they are refs

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
      
      const oldImageData = context ? context.getImageData(0, 0, canvas.width, canvas.height) : null; // Not used for restore currently, but might be for complex redraws
      // const oldTextObjects = [...drawnTextObjects]; // Not used for restore

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
    if (contextRef.current) {
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
  }, [activeSelection, historyStep, drawnTextObjects, canvasBackgroundColor, redrawCanvasContent, isTypingText, cursorBlinkVisible, currentText]); 

  const finalizeLiveText = useCallback(() => {
    if (!isTypingText || !contextRef.current) return; 

    const textToDraw = currentText.trimEnd(); 
    if (textToDraw && textInputPosition) {
      const newTextElement: TextElement = {
        id: Date.now().toString(),
        textLines: textToDraw.split('\n'),
        x: textInputPosition.x,
        y: textInputPosition.y,
        color: selectedColor,
        fontSize: getFontSize(),
        font: `${getFontSize()}px sans-serif`,
        lineHeight: getFontSize() * 1.2,
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
        if (canvasElem && canvasElem.contains(target) && (isDrawingRef.current || isSelectingRef.current || (activeTool === 'text' && !isTypingText))) {
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
    if (!contextRef.current || !activeTool || activeTool === 'select' || activeTool === 'text') return;
    
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
    if (!contextRef.current || !lastPositionRef.current || !activeTool || !isDrawingRef.current || activeTool === 'select' || activeTool === 'text') return;

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
    if (!contextRef.current || !isDrawingRef.current || activeTool === 'select' || activeTool === 'text') {
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

  const getHandleAtPosition = useCallback((pos: { x: number, y: number }): ResizeHandleType | null => {
    if (!activeSelection) return null;
    const handles = getResizeHandles(activeSelection);
    const checkRadius = HANDLE_SIZE; 

    for (const [type, handlePos] of Object.entries(handles) as [ResizeHandleType, { x: number, y: number }][]) {
        if (Math.abs(pos.x - handlePos.x) < checkRadius && Math.abs(pos.y - handlePos.y) < checkRadius) {
            return type;
        }
    }
    return null;
  }, [activeSelection, getResizeHandles, HANDLE_SIZE]);

  const getCursorForHandle = useCallback((handleType: ResizeHandleType | null): string => {
    if (!handleType) return 'default'; 
    switch (handleType) {
        case 'tl': case 'br': return 'nwse-resize';
        case 'tr': case 'bl': return 'nesw-resize';
        case 'tm': case 'bm': return 'ns-resize';
        case 'ml': case 'mr': return 'ew-resize';
        default: return 'default';
    }
  }, []);

  const handlePointerMove = useCallback((event: MouseEvent | TouchEvent) => {
    const pos = getPointerPosition(event);
    if (!pos || !canvasRef.current) return;

    let currentCursor: string;

    if (isResizingRef.current && activeSelection && originalSelectionRectRef.current && resizeStartPointRef.current && resizeHandleTypeRef.current) {
        if (event instanceof TouchEvent || (event.type === 'touchmove')) event.preventDefault();
        
        const type = resizeHandleTypeRef.current;
        const originalRect = originalSelectionRectRef.current;
        const startPoint = resizeStartPointRef.current;
        let { x, y, w, h } = originalRect;

        const deltaX = pos.x - startPoint.x;
        const deltaY = pos.y - startPoint.y;

        if (type.includes('l')) { 
            w -= deltaX;
            x += deltaX;
        } else if (type.includes('r')) { 
            w += deltaX;
        }

        if (type.includes('t')) { 
            h -= deltaY;
            y += deltaY;
        } else if (type.includes('b')) { 
            h += deltaY;
        }
        
        const minDim = HANDLE_SIZE * 2;
        if (w < minDim) {
            if (type.includes('l')) x = originalRect.x + originalRect.w - minDim;
            w = minDim;
        }
        if (h < minDim) {
            if (type.includes('t')) y = originalRect.y + originalRect.h - minDim;
            h = minDim;
        }

        setActiveSelection({ x, y, w, h });
        currentCursor = getCursorForHandle(resizeHandleTypeRef.current);
    } else if (isDrawingRef.current) {
      if (event instanceof TouchEvent || (event.type === 'touchmove')) event.preventDefault();
      drawInternal(pos);
      currentCursor = (activeTool && (drawingTools.includes(activeTool) || activeTool === 'erase')) ? 'crosshair' : 'default';
    } else if (isSelectingRef.current && activeTool === 'select') {
      if (event instanceof TouchEvent || (event.type === 'touchmove')) event.preventDefault();
      if (contextRef.current && initialCanvasDataForSelectionRef.current && selectionStartPointRef.current) {
        contextRef.current.putImageData(initialCanvasDataForSelectionRef.current, 0, 0); 
        
        const start = selectionStartPointRef.current;
        const rectX = Math.min(start.x, pos.x);
        const rectY = Math.min(start.y, pos.y);
        const rectW = Math.abs(pos.x - start.x);
        const rectH = Math.abs(pos.y - start.y);

        currentSelectionRectRef.current = { x: rectX, y: rectY, w: rectW, h: rectH };
        
        contextRef.current.save();
        contextRef.current.strokeStyle = 'rgba(0, 100, 255, 0.7)';
        contextRef.current.lineWidth = 1.5;
        contextRef.current.setLineDash([5, 3]); 
        contextRef.current.strokeRect(rectX, rectY, rectW, rectH);
        contextRef.current.restore(); 
      }
      currentCursor = 'crosshair';
    } else if (activeSelection && activeTool === 'select') {
        const handle = getHandleAtPosition(pos);
        currentCursor = getCursorForHandle(handle);
    } else {
        currentCursor = isTypingText ? 'text' :
                        activeTool === 'text' ? 'text' :
                        (activeTool === 'select') ? (getHandleAtPosition(pos) ? getCursorForHandle(getHandleAtPosition(pos)) : 'crosshair') :
                        (activeTool && (drawingTools.includes(activeTool) || activeTool === 'erase')) ? 'crosshair' :
                        'default';
    }
    canvasRef.current.style.cursor = currentCursor || 'default'; 
  }, [getPointerPosition, drawInternal, activeTool, activeSelection, getHandleAtPosition, getCursorForHandle, isTypingText]);


  const handlePointerUp = useCallback((event: MouseEvent | TouchEvent) => {
    const pos = getPointerPosition(event);

    if (isResizingRef.current && activeSelection && originalSelectionRectRef.current && selectionContentForResizeRef.current && originalContentBoundsRef.current) {
        const oldRect = originalContentBoundsRef.current; 
        const newRect = activeSelection; 

        if (contextRef.current && canvasRef.current) {
            const ctx = contextRef.current;
            const canvas = canvasRef.current;

            // 1. Prepare drawing layer base: Load history[historyStep] or blank.
            const baseDrawingLayer = document.createElement('canvas');
            baseDrawingLayer.width = canvas.width;
            baseDrawingLayer.height = canvas.height;
            const baseCtx = baseDrawingLayer.getContext('2d');

            if (baseCtx) {
                if (history[historyStep]) {
                    baseCtx.putImageData(history[historyStep], 0, 0);
                } else {
                    baseCtx.fillStyle = canvasBackgroundColor;
                    baseCtx.fillRect(0, 0, canvas.width, canvas.height);
                }
                // Clear the area of the original selection from this base layer
                baseCtx.fillStyle = canvasBackgroundColor; // Erase with background color
                baseCtx.fillRect(oldRect.x, oldRect.y, oldRect.w, oldRect.h);
            }
            
            // 2. Scale and draw the captured drawing content onto the base layer
            if (selectionContentForResizeRef.current.drawing && baseCtx) {
                const drawingContent = selectionContentForResizeRef.current.drawing;
                if (drawingContent.width > 0 && drawingContent.height > 0 && newRect.w > 0 && newRect.h > 0) {
                    const tempScaleCanvas = document.createElement('canvas');
                    tempScaleCanvas.width = drawingContent.width;
                    tempScaleCanvas.height = drawingContent.height;
                    tempScaleCanvas.getContext('2d')?.putImageData(drawingContent, 0, 0);
                    baseCtx.drawImage(tempScaleCanvas, 0, 0, drawingContent.width, drawingContent.height, newRect.x, newRect.y, newRect.w, newRect.h);
                }
            }
            
            // 3. Save the modified drawing layer to history
            if (baseCtx) {
                 const newDrawingLayerData = baseCtx.getImageData(0, 0, canvas.width, canvas.height);
                 setHistory(prevHistory => {
                    const newHistoryBase = historyStep === -1 ? [] : prevHistory.slice(0, historyStep + 1);
                    let updatedHistory = [...newHistoryBase, newDrawingLayerData];
                    if (updatedHistory.length > MAX_HISTORY_STEPS) {
                        updatedHistory = updatedHistory.slice(updatedHistory.length - MAX_HISTORY_STEPS);
                    }
                    setHistoryStep(updatedHistory.length - 1);
                    return updatedHistory;
                });
            }


            // 4. Scale and update text objects
            const scaleX = oldRect.w === 0 ? 1 : newRect.w / oldRect.w; // Avoid division by zero
            const scaleY = oldRect.h === 0 ? 1 : newRect.h / oldRect.h; // Avoid division by zero
            const fontScale = Math.sqrt(Math.abs(scaleX * scaleY)); 

            const updatedTextObjects = drawnTextObjects.map(textObj => {
                const originallySelectedText = selectionContentForResizeRef.current.texts.find(t => t.id === textObj.id);
                if (originallySelectedText && originallySelectedText.originalX !== undefined && originallySelectedText.originalY !== undefined && originallySelectedText.originalFontSize !== undefined) {
                    const relX = (originallySelectedText.originalX - oldRect.x) * scaleX;
                    const relY = (originallySelectedText.originalY - oldRect.y) * scaleY;
                    const newFontSize = originallySelectedText.originalFontSize * fontScale;

                    return {
                        ...textObj,
                        x: newRect.x + relX,
                        y: newRect.y + relY,
                        fontSize: Math.max(newFontSize, 5), 
                        font: `${Math.max(newFontSize, 5)}px sans-serif`,
                        lineHeight: Math.max(newFontSize, 5) * 1.2,
                    };
                }
                return textObj; 
            });
            setDrawnTextObjects(updatedTextObjects);

            toast({ title: "Content Resized", description: "Selected content has been resized." });
        }

        isResizingRef.current = false;
        resizeHandleTypeRef.current = null;
        originalSelectionRectRef.current = null;
        resizeStartPointRef.current = null;
        selectionContentForResizeRef.current = { drawing: null, texts: [] };
        originalContentBoundsRef.current = null;
        redrawCanvasContent();
    } else if (isDrawingRef.current) {
      stopDrawingInternal(pos || undefined);
    } else if (isSelectingRef.current && activeTool === 'select') {
      if (contextRef.current && initialCanvasDataForSelectionRef.current) {
          contextRef.current.putImageData(initialCanvasDataForSelectionRef.current, 0, 0);

          if (currentSelectionRectRef.current && (currentSelectionRectRef.current.w > HANDLE_SIZE || currentSelectionRectRef.current.h > HANDLE_SIZE)) { 
              setActiveSelection(currentSelectionRectRef.current); 
              toast({ title: "Area Selected", description: "Drag handles to resize. Content will scale on release." });
          } else {
              setActiveSelection(null); 
          }
          if (!currentSelectionRectRef.current || (currentSelectionRectRef.current.w <= HANDLE_SIZE && currentSelectionRectRef.current.h <= HANDLE_SIZE)) {
              redrawCanvasContent();
          }
      }
      isSelectingRef.current = false;
      selectionStartPointRef.current = null;
      initialCanvasDataForSelectionRef.current = null;
      currentSelectionRectRef.current = null;
    }

    window.removeEventListener('touchmove', handlePointerMove);
    window.removeEventListener('touchend', handlePointerUp);
    window.removeEventListener('touchcancel', handlePointerUp);
    window.removeEventListener('mousemove', handlePointerMove);
    window.removeEventListener('mouseup', handlePointerUp);
  }, [getPointerPosition, stopDrawingInternal, handlePointerMove, activeTool, toast, redrawCanvasContent, drawnTextObjects, history, historyStep, canvasBackgroundColor, MAX_HISTORY_STEPS, activeSelection]);

  const handleCanvasPointerDown = useCallback((event: React.MouseEvent | React.TouchEvent) => {
    if ((event as React.MouseEvent).nativeEvent instanceof MouseEvent && (event as React.MouseEvent).nativeEvent.button !== 0) return; 

    const pos = getPointerPosition(event);
    if (!pos) return;
    
    if (isTypingText) {
      finalizeLiveText();
    }

    if (activeSelection && activeTool === 'select') {
        const handle = getHandleAtPosition(pos);
        if (handle) {
            isResizingRef.current = true;
            resizeHandleTypeRef.current = handle;
            originalSelectionRectRef.current = { ...activeSelection }; 
            originalContentBoundsRef.current = { ...activeSelection }; // Store bounds of current selection for content scaling base
            resizeStartPointRef.current = pos;

            if (contextRef.current && canvasRef.current && originalSelectionRectRef.current) {
                const currentSelectionRect = originalSelectionRectRef.current;
                
                const tempDrawingCanvas = document.createElement('canvas');
                tempDrawingCanvas.width = canvasRef.current.width;
                tempDrawingCanvas.height = canvasRef.current.height;
                const tempDrawingCtx = tempDrawingCanvas.getContext('2d');

                if (tempDrawingCtx && history[historyStep]) {
                    tempDrawingCtx.putImageData(history[historyStep], 0, 0);
                    if (currentSelectionRect.w > 0 && currentSelectionRect.h > 0) {
                         try {
                            selectionContentForResizeRef.current.drawing = tempDrawingCtx.getImageData(currentSelectionRect.x, currentSelectionRect.y, currentSelectionRect.w, currentSelectionRect.h);
                         } catch (e) {
                            console.error("Error getting image data for resize:", e, currentSelectionRect);
                            selectionContentForResizeRef.current.drawing = null;
                         }
                    } else {
                        selectionContentForResizeRef.current.drawing = null;
                    }
                } else {
                    selectionContentForResizeRef.current.drawing = null;
                }

                selectionContentForResizeRef.current.texts = drawnTextObjects.filter(textObj => {
                    const textFontSize = textObj.fontSize;
                    const textApproxWidth = contextRef.current!.measureText(textObj.textLines.join(" ")).width; // Very rough
                    const textApproxHeight = textObj.textLines.length * textObj.lineHeight;
                    const textRight = textObj.x + textApproxWidth;
                    const textBottom = textObj.y + textApproxHeight;
                    return !(textObj.x > currentSelectionRect.x + currentSelectionRect.w ||
                             textRight < currentSelectionRect.x ||
                             textObj.y > currentSelectionRect.y + currentSelectionRect.h ||
                             textBottom < currentSelectionRect.y);
                }).map(t => ({ ...t, originalX: t.x, originalY: t.y, originalFontSize: t.fontSize }));
            } else {
                 selectionContentForResizeRef.current = { drawing: null, texts: [] };
            }
            if (event.type === 'touchstart') event.preventDefault();
        } else {
            const rect = activeSelection;
            const clickedInsideSelection = pos.x >= rect.x && pos.x <= rect.x + rect.w && pos.y >= rect.y && pos.y <= rect.y + rect.h;
            
            if (clickedInsideSelection) {
                 console.log("Clicked inside active selection, but not on a handle. Drag planned for future.");
                 return; 
            } else {
                 setActiveSelection(null); 
                 isResizingRef.current = false; 
                 startNewSelection(pos, event); 
            }
        }
    } else if (activeTool === 'select') {
        setActiveSelection(null); 
        isResizingRef.current = false; 
        startNewSelection(pos, event);
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
        setActiveSelection(null); 
        isResizingRef.current = false;
        if (event.type === 'touchstart') event.preventDefault(); 
        startDrawingInternal(pos);
    } else {
       setActiveSelection(null);
       isResizingRef.current = false;
    }

    if (event.type.startsWith('touch')) {
      window.addEventListener('touchmove', handlePointerMove, { passive: false });
      window.addEventListener('touchend', handlePointerUp);
      window.addEventListener('touchcancel', handlePointerUp);
    } else {
      window.addEventListener('mousemove', handlePointerMove);
      window.addEventListener('mouseup', handlePointerUp);
    }
  }, [activeTool, getPointerPosition, startDrawingInternal, handlePointerMove, handlePointerUp, finalizeLiveText, isTypingText, activeSelection, getHandleAtPosition, drawnTextObjects, canvasBackgroundColor, history, historyStep]);

  const startNewSelection = useCallback((pos: {x: number, y:number}, event: React.MouseEvent | React.TouchEvent) => {
     if (contextRef.current && canvasRef.current) {
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = canvasRef.current.width;
        tempCanvas.height = canvasRef.current.height;
        const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true }); 
        if (tempCtx) {
            tempCtx.fillStyle = canvasBackgroundColor;
            tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
            if (history[historyStep]) {
                tempCtx.putImageData(history[historyStep], 0, 0);
            }
            drawnTextObjects.forEach(textObj => {
                tempCtx.fillStyle = textObj.color;
                tempCtx.font = textObj.font;
                tempCtx.textAlign = "left";
                tempCtx.textBaseline = "top";
                textObj.textLines.forEach((line, index) => {
                    tempCtx.fillText(line, textObj.x, textObj.y + (index * textObj.lineHeight));
                });
            });
            initialCanvasDataForSelectionRef.current = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
        } else {
             initialCanvasDataForSelectionRef.current = null; 
        }
    } else {
        initialCanvasDataForSelectionRef.current = null;
    }
    isSelectingRef.current = true;
    selectionStartPointRef.current = pos;
    currentSelectionRectRef.current = null; 
    if (event.type === 'touchstart' && activeTool === 'select') event.preventDefault(); 
  }, [canvasBackgroundColor, history, historyStep, drawnTextObjects, activeTool]);


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
    
    if (toolId !== 'select' && activeSelection) {
        setActiveSelection(null);
    }
    isResizingRef.current = false; 


    const isToolWithToggleableOptions = drawingTools.includes(toolId) || toolId === 'erase' || toolId === 'text';

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
      setActiveSelection(null); 
      isResizingRef.current = false;
      finalizeLiveText(); 
      
      const blankImageData = context.getImageData(0, 0, canvas.width, canvas.height);
      setHistory([blankImageData]);
      setHistoryStep(0);
      setIsInitialStateSaved(true); 
      redrawCanvasContent(); 
    }
    setShowClearConfirmDialog(false);
  };

  const handleUndo = useCallback(() => {
    finalizeLiveText(); 
    if (historyStep > 0) {
        const newStep = historyStep - 1;
        setHistoryStep(newStep);
        setActiveSelection(null);
        isResizingRef.current = false;
        redrawCanvasContent(); 
    } else if (historyStep === 0) { 
        setHistoryStep(-1); 
        setActiveSelection(null);
        isResizingRef.current = false;
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
        setActiveSelection(null);
        isResizingRef.current = false;
        redrawCanvasContent(); 
    } else {
        toast({ title: "Nothing to redo", duration: 2000 });
    }
  }, [history, historyStep, toast, finalizeLiveText, redrawCanvasContent]);

  const isOptionsPanelToolActive = activeTool && (drawingTools.includes(activeTool) || activeTool === 'erase' || activeTool === 'text');


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
                icon={MousePointer2} 
                label="Select" 
                onClick={() => handleToolClick("Select")} 
                isActive={activeTool === "select"}
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
              {activeTool === 'text' ? (
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
              {(!activeTool || !isOptionsPanelToolActive) && !isDrawingRef.current && !isSelectingRef.current && !isTypingText && !activeSelection && !isResizingRef.current && (
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
          TeachMeet Whiteboard - Content resizing, drawings, live text, erase (drawings only), and area selection with resize handles. Undo/Redo for drawings.
        </footer>
      </div>
    </>
  );
}

