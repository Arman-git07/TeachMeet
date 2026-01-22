
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
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle as ShadDialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import { ArrowLeft, Brush, Type, Eraser, Trash2, Undo2, Redo2, Lasso, RectangleHorizontal, Circle, Minus, Files, PlusCircle, Triangle, MoveRight, Diamond, Settings, Sparkles, MoreVertical, Baseline, FileDown, Loader2, Lock, Globe, Camera, UserCheck } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import React, { useState, useEffect, useRef, useCallback } from "react";
import { useDynamicHeader } from '@/contexts/DynamicHeaderContext';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { recognizeShape } from "@/ai/flows/recognize-shape-flow";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import jsPDF from 'jspdf';
import { auth, storage, db } from '@/lib/firebase';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { collection, addDoc, serverTimestamp, onSnapshot } from 'firebase/firestore';
import { io, Socket } from "socket.io-client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";


// --- Type Definitions ---
interface Point { x: number; y: number; }
type PathElement = { type: 'path'; id: string; points: Point[]; color: string; lineWidth: number; };
type TextElement = { type: 'text'; id: string; text: string; x: number; y: number; color: string; font: string; width: number; height: number; };
type ShapeElement = { type: 'shape'; id: string; shapeType: 'rectangle' | 'circle' | 'line' | 'triangle' | 'arrow' | 'diamond'; x1: number; y1: number; x2: number; y2: number; color: string; lineWidth: number; };
type ImageElement = { type: 'image'; id: string; src: string; x: number; y: number; width: number; height: number; };
type WhiteboardElement = PathElement | TextElement | ShapeElement | ImageElement;


interface ElementState {
  elements: WhiteboardElement[];
  selectedElementIds: Set<string>;
}

interface BoundingBox { minX: number; minY: number; maxX: number; maxY: number; }

type OperationState = 
  | { type: 'idle' }
  | { type: 'drawing'; currentPath: Point[] }
  | { type: 'shaping'; startPoint: Point, currentPoint: Point }
  | { type: 'texting'; position: Point; isEditing: boolean }
  | { type: 'lassoing'; lassoPath: Point[] }
  | { type: 'dragging'; startPos: Point; originalElements: Map<string, WhiteboardElement> };
  
interface Participant {
  id: string;
  name: string;
  photoURL?: string;
  isHost?: boolean;
}

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
    } else if (element.type === 'shape') {
        const minX = Math.min(element.x1, element.x2);
        const minY = Math.min(element.y1, element.y2);
        const maxX = Math.max(element.x1, element.x2);
        const maxY = Math.max(element.y1, element.y2);
        return { minX, minY, maxX, maxY };
    } else if (element.type === 'image') {
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
const ToolButton = React.memo(({ icon: Icon, label, onClick, isActive = false, disabled = false }: { icon: React.ElementType; label: string; onClick?: () => void; isActive?: boolean; disabled?: boolean; }) => (
  <Button variant={isActive ? "default" : "outline"} size="icon" className="rounded-lg w-12 h-12 flex flex-col items-center justify-center text-xs" onClick={onClick} aria-label={label} disabled={disabled}>
    <Icon className="h-5 w-5 mb-0.5" />
    <span className="text-[10px] leading-tight">{label}</span>
  </Button>
));
ToolButton.displayName = "ToolButton";

const CollaborateDialogContent = ({ participants, drawingPermissions, onPermissionChange }: { participants: Participant[], drawingPermissions: Record<string, boolean>, onPermissionChange: (id: string, canDraw: boolean) => void }) => {
    return (
        <DialogContent className="sm:max-w-md">
            <DialogHeader>
                <ShadDialogTitle>Whiteboard Collaboration</ShadDialogTitle>
                <DialogDescription>
                    Allow others in the meeting to draw on your whiteboard. Only one person can draw at a time.
                </DialogDescription>
            </DialogHeader>
            <ScrollArea className="max-h-64">
                <div className="space-y-2 p-1">
                    {participants.map((p) => (
                        <div key={p.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-muted">
                            <div className="flex items-center gap-3">
                                <Avatar className="h-9 w-9">
                                    <AvatarImage src={p.photoURL} data-ai-hint="avatar user"/>
                                    <AvatarFallback>{p.name.charAt(0)}</AvatarFallback>
                                </Avatar>
                                <div>
                                    <p className="text-sm font-medium">{p.name}</p>
                                    <p className="text-xs text-muted-foreground">{p.isHost ? "Host (You)" : "Participant"}</p>
                                </div>
                            </div>
                            {!p.isHost && (
                                <Switch
                                    checked={!!drawingPermissions[p.id]}
                                    onCheckedChange={(checked) => onPermissionChange(p.id, checked)}
                                    aria-label={`Allow ${p.name} to draw`}
                                />
                            )}
                        </div>
                    ))}
                </div>
            </ScrollArea>
        </DialogContent>
    );
};

export default function WhiteboardPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const topic = searchParams.get('topic');
  const cam = searchParams.get('cam');
  const mic = searchParams.get('mic');
  const meetingId = params.meetingId as string;
  const { setHeaderContent, setHeaderAction } = useDynamicHeader();
  const { toast } = useToast();
  
  const socketRef = useRef<Socket | null>(null);

  const mainCanvasRef = useRef<HTMLCanvasElement>(null);
  const tempCanvasRef = useRef<HTMLCanvasElement>(null);
  const liveTextInputRef = useRef<HTMLTextAreaElement>(null);

  const [pages, setPages] = useState<ElementState[]>([{ elements: [], selectedElementIds: new Set() }]);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const pagesHistoryRef = useRef<ElementState[][]>([[]]);
  const pagesHistoryStepRef = useRef<number[]>([-1]);

  const [activeTool, setActiveTool] = useState<'draw' | 'shape' | 'text' | 'erase' | 'lasso' | 'select'>("draw");
  const [selectedColor, setSelectedColor] = useState<string>("#000000");
  const [lineWidth, setLineWidth] = useState<number>(5);
  const [fontSize, setFontSize] = useState<number>(16);
  const [fontFamily, setFontFamily] = useState<string>('sans-serif');
  const [selectedShape, setSelectedShape] = useState<'rectangle' | 'circle' | 'line' | 'triangle' | 'arrow' | 'diamond'>('rectangle');
  
  const [isDrawPanelVisible, setIsDrawPanelVisible] = useState(false);
  const [isTextPanelVisible, setIsTextPanelVisible] = useState(false);
  const [isPagesPopoverOpen, setIsPagesPopoverOpen] = useState(false);
  const lastDrawToolRef = useRef<'draw' | 'shape'>('draw');

  const operationStateRef = useRef<OperationState>({ type: 'idle' });
  const [tempDragPreview, setTempDragPreview] = useState<WhiteboardElement[]>([]);
  const [bgColor, setBgColor] = useState('#FFFFFF');
  const [loadedImages, setLoadedImages] = useState<Map<string, HTMLImageElement>>(new Map());
  const [isProcessing, setIsProcessing] = useState(false);
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const [isScreenshotDialogOpen, setIsScreenshotDialogOpen] = useState(false);


  const [isRefineDialogOpen, setIsRefineDialogOpen] = useState(false);
  const [refinePrompt, setRefinePrompt] = useState("");

  const [participants, setParticipants] = useState<Participant[]>([]);
  const [drawingPermissions, setDrawingPermissions] = useState<Record<string, boolean>>({});
  const [canIDraw, setCanIDraw] = useState(true); // Default to true, managed by host


  useEffect(() => {
    setBgColor(localStorage.getItem('teachmeet-whiteboard-bg-color') || '#FFFFFF');
    setSelectedColor(localStorage.getItem('teachmeet-whiteboard-color') || '#000000');
    setLineWidth(parseInt(localStorage.getItem('teachmeet-whiteboard-linewidth') || '5', 10));
    setFontSize(parseInt(localStorage.getItem('teachmeet-whiteboard-fontsize') || '16', 10));
    setFontFamily(localStorage.getItem('teachmeet-whiteboard-fontfamily') || 'sans-serif');
  }, []);
  
  const getFontString = useCallback(() => `${fontSize}px ${fontFamily}`, [fontSize, fontFamily]);

  const pushToHistory = useCallback((pageIndex: number, state: ElementState) => {
    const history = pagesHistoryRef.current[pageIndex] || [];
    let step = pagesHistoryStepRef.current[pageIndex] ?? -1;
    
    if (step < history.length - 1) {
        history.splice(step + 1);
    }
    history.push(state);
    if (history.length > MAX_HISTORY_STEPS) {
      history.shift();
    } else {
      step++;
    }
    pagesHistoryRef.current[pageIndex] = history;
    pagesHistoryStepRef.current[pageIndex] = step;
  }, []);
  
  const handleDeleteSelected = useCallback(() => {
    setPages(currentPages => {
      const newPages = [...currentPages];
      const currentPage = newPages[currentPageIndex];
      if (currentPage.selectedElementIds.size === 0) return currentPages;

      const newElements = currentPage.elements.filter(el => !currentPage.selectedElementIds.has(el.id));
      const updatedPage = { elements: newElements, selectedElementIds: new Set<string>() };
      newPages[currentPageIndex] = updatedPage;
      pushToHistory(currentPageIndex, updatedPage);
      return newPages;
    });
  }, [currentPageIndex, pushToHistory]);

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
      const parsedFontSize = parseInt(element.font.match(/(\d+)px/)?.[1] || '16', 10);
      element.text.split('\n').forEach((line, index) => ctx.fillText(line, element.x, element.y + (index * (parsedFontSize * 1.2))));
    } else if (element.type === 'shape') {
      ctx.strokeStyle = element.color;
      ctx.lineWidth = element.lineWidth;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      const { x1, y1, x2, y2, shapeType } = element;
      if (shapeType === 'rectangle') {
        ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
      } else if (shapeType === 'line') {
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      } else if (shapeType === 'circle') {
        const radiusX = Math.abs(x2 - x1) / 2;
        const radiusY = Math.abs(y2 - y1) / 2;
        const centerX = x1 + (x2 - x1) / 2;
        const centerY = y1 + (y2 - y1) / 2;
        ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, 2 * Math.PI);
        ctx.stroke();
      } else if (shapeType === 'triangle') {
        ctx.moveTo(x1 + (x2 - x1) / 2, y1); // Top point
        ctx.lineTo(x2, y2); // Bottom right
        ctx.lineTo(x1, y2); // Bottom left
        ctx.closePath();
        ctx.stroke();
      } else if (shapeType === 'diamond') {
        const midX = x1 + (x2 - x1) / 2;
        const midY = y1 + (y2 - y1) / 2;
        ctx.moveTo(midX, y1); // Top
        ctx.lineTo(x2, midY); // Right
        ctx.lineTo(midX, y2); // Bottom
        ctx.lineTo(x1, midY); // Left
        ctx.closePath();
        ctx.stroke();
      } else if (shapeType === 'arrow') {
        const headlen = Math.max(10, element.lineWidth * 3); // Arrow head size
        const angle = Math.atan2(y2 - y1, x2 - x1);
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.lineTo(x2 - headlen * Math.cos(angle - Math.PI / 6), y2 - headlen * Math.sin(angle - Math.PI / 6));
        ctx.moveTo(x2, y2);
        ctx.lineTo(x2 - headlen * Math.cos(angle + Math.PI / 6), y2 - headlen * Math.sin(angle + Math.PI / 6));
        ctx.stroke();
      }
    } else if (element.type === 'image') {
      const cachedImg = loadedImages.get(element.id);
      if (cachedImg) {
        ctx.drawImage(cachedImg, element.x, element.y, element.width, element.height);
      } else {
        const img = new Image();
        img.onload = () => {
          setLoadedImages(prev => new Map(prev).set(element.id, img));
        };
        img.src = element.src;
      }
    }
  }, [loadedImages]);
  
  const clearCanvas = useCallback((ctx: CanvasRenderingContext2D) => {
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  }, [bgColor]);
  

  const redrawMainCanvas = useCallback(() => {
    const mainCtx = mainCanvasRef.current?.getContext('2d');
    if (!mainCtx) return;
    clearCanvas(mainCtx);
    const currentPage = pages[currentPageIndex];
    if (!currentPage) return;
    
    currentPage.elements.forEach(element => drawElement(mainCtx, element));

    const selectionBox = getSelectionBoundingBox(currentPage.elements, currentPage.selectedElementIds);
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
  }, [pages, currentPageIndex, drawElement, clearCanvas]);
  
  const redrawTempCanvas = useCallback(() => {
    const tempCtx = tempCanvasRef.current?.getContext('2d');
    if (!tempCtx) return;
    tempCtx.clearRect(0, 0, tempCtx.canvas.width, tempCtx.canvas.height);

    const opState = operationStateRef.current;
    if (opState.type === 'drawing') {
      drawElement(tempCtx, { type: 'path', id: '', points: opState.currentPath, color: selectedColor, lineWidth });
    } else if (opState.type === 'shaping') {
       drawElement(tempCtx, { type: 'shape', id: '', shapeType: selectedShape, x1: opState.startPoint.x, y1: opState.startPoint.y, x2: opState.currentPoint.x, y2: opState.currentPoint.y, color: selectedColor, lineWidth });
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
  }, [selectedColor, lineWidth, drawElement, tempDragPreview, selectedShape]);

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
  }, [pages, currentPageIndex, redrawMainCanvas, loadedImages]);
  
  useEffect(() => {
    redrawTempCanvas();
  }, [tempDragPreview, redrawTempCanvas]);

  const handleUndo = useCallback(() => {
    const currentHistory = pagesHistoryRef.current[currentPageIndex];
    let currentStep = pagesHistoryStepRef.current[currentPageIndex];
    if (currentStep > 0) {
      currentStep--;
      pagesHistoryStepRef.current[currentPageIndex] = currentStep;
      const prevState = currentHistory[currentStep];
      setPages(currentPages => {
          const newPages = [...currentPages];
          newPages[currentPageIndex] = prevState;
          return newPages;
      });
    }
  }, [currentPageIndex]);

  const handleRedo = useCallback(() => {
    const currentHistory = pagesHistoryRef.current[currentPageIndex];
    let currentStep = pagesHistoryStepRef.current[currentPageIndex];
    if (currentStep < currentHistory.length - 1) {
      currentStep++;
      pagesHistoryStepRef.current[currentPageIndex] = currentStep;
      const nextState = currentHistory[currentStep];
      setPages(currentPages => {
          const newPages = [...currentPages];
          newPages[currentPageIndex] = nextState;
          return newPages;
      });
    }
  }, [currentPageIndex]);
  
  const getPointerPosition = useCallback((event: React.PointerEvent): Point => {
      const rect = tempCanvasRef.current!.getBoundingClientRect();
      return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }, []);

  const finalizeLiveText = useCallback(() => {
    const opState = operationStateRef.current;
    if (opState.type !== 'texting' || !opState.isEditing) return;

    const textInput = liveTextInputRef.current;
    if (!textInput) return;
    
    if (textInput.value.trim()) {
        const tempCtx = tempCanvasRef.current!.getContext('2d')!;
        const font = getFontString();
        tempCtx.font = font;
        const lines = textInput.value.split('\n');
        const textMetrics = lines.map(line => tempCtx.measureText(line));
        const maxWidth = Math.max(...textMetrics.map(m => m.width));
        const totalHeight = lines.length * (fontSize * 1.2);
        
        const newTextElement: TextElement = { type: 'text', id: `text_${Date.now()}`, text: textInput.value, x: opState.position.x, y: opState.position.y, color: selectedColor, font, width: maxWidth, height: totalHeight };
        
        setPages(currentPages => {
            const newPages = [...currentPages];
            const currentPage = newPages[currentPageIndex];
            const newElements = [...currentPage.elements, newTextElement];
            const updatedPage = { ...currentPage, elements: newElements, selectedElementIds: new Set() };
            newPages[currentPageIndex] = updatedPage;
            pushToHistory(currentPageIndex, updatedPage);
            return newPages;
        });
    }

    textInput.value = '';
    textInput.style.display = 'none';
    operationStateRef.current = { type: 'idle' };
  }, [selectedColor, pushToHistory, getFontString, currentPageIndex, fontSize, fontFamily]);
  
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.target as HTMLElement).tagName.toLowerCase() === 'input' || (event.target as HTMLElement).tagName.toLowerCase() === 'textarea') {
        return;
      }
      
      const currentPage = pages[currentPageIndex];
      if (currentPage && currentPage.selectedElementIds.size > 0) {
          if (event.key === 'Delete' || event.key === 'Backspace') {
            event.preventDefault();
            handleDeleteSelected();
          }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleDeleteSelected, pages, currentPageIndex]);

  const handlePointerDown = useCallback((event: React.PointerEvent) => {
    if (event.buttons !== 1 || !canIDraw) return;
    
    if (activeTool === 'text' && event.target === liveTextInputRef.current) {
        return;
    }

    if (operationStateRef.current.type === 'texting' && operationStateRef.current.isEditing) {
      finalizeLiveText();
    }
    
    setIsDrawPanelVisible(false);
    setIsTextPanelVisible(false);

    const pos = getPointerPosition(event);
    const currentPage = pages[currentPageIndex];

    if (activeTool === 'select' || activeTool === 'lasso') {
      const selectionBox = getSelectionBoundingBox(currentPage.elements, currentPage.selectedElementIds);
      if (activeTool === 'select' && selectionBox && isPointInRect(pos, selectionBox)) {
        const originalElements = new Map<string, WhiteboardElement>();
        currentPage.elements.forEach(el => {
            if (currentPage.selectedElementIds.has(el.id)) {
                originalElements.set(el.id, JSON.parse(JSON.stringify(el)));
            }
        });
        operationStateRef.current = { type: 'dragging', startPos: pos, originalElements };
        return;
      }

      let elementToSelectId: string | null = null;
      for (let i = currentPage.elements.length - 1; i >= 0; i--) {
        const element = currentPage.elements[i];
        const box = getElementBoundingBox(element);
        if (box && isPointInRect(pos, box)) {
          elementToSelectId = element.id;
          break;
        }
      }

      if (elementToSelectId) {
        const originalElement = currentPage.elements.find(el => el.id === elementToSelectId)!;
        const originalElementsMap = new Map<string, WhiteboardElement>();
        originalElementsMap.set(elementToSelectId, JSON.parse(JSON.stringify(originalElement)));

        setPages(currentPages => {
            const newPages = [...currentPages];
            newPages[currentPageIndex] = { ...newPages[currentPageIndex], selectedElementIds: new Set([elementToSelectId!]) };
            return newPages;
        });

        operationStateRef.current = { type: 'dragging', startPos: pos, originalElements: originalElementsMap };
        setActiveTool('select');
        return;
      }
      
      if (currentPage.selectedElementIds.size > 0) {
        setPages(currentPages => {
            const newPages = [...currentPages];
            newPages[currentPageIndex] = { ...newPages[currentPageIndex], selectedElementIds: new Set() };
            return newPages;
        });
      }
      operationStateRef.current = { type: 'lassoing', lassoPath: [pos] };
      setActiveTool('lasso');
      return;
    }
    
    if (currentPage.selectedElementIds.size > 0) {
      setPages(currentPages => {
        const newPages = [...currentPages];
        newPages[currentPageIndex] = { ...newPages[currentPageIndex], selectedElementIds: new Set() };
        return newPages;
      });
    }
    
    switch(activeTool) {
        case 'draw':
            operationStateRef.current = { type: 'drawing', currentPath: [pos] };
            socketRef.current?.emit('draw', { type: 'start', point: pos, tool: activeTool, color: selectedColor, lineWidth });
            break;
        case 'shape':
            operationStateRef.current = { type: 'shaping', startPoint: pos, currentPoint: pos };
            break;
        case 'text':
            operationStateRef.current = { type: 'texting', position: pos, isEditing: true };
            if (liveTextInputRef.current) {
                const input = liveTextInputRef.current;
                input.style.top = `${pos.y}px`;
                input.style.left = `${pos.x}px`;
                input.style.display = 'block';
                input.style.color = selectedColor;
                input.style.font = getFontString();
                input.style.lineHeight = `${fontSize * 1.2}px`;
                input.style.height = 'auto'; // Reset height
                input.style.width = 'auto'; // Reset width
                input.style.minWidth = '50px';
                setTimeout(() => input.focus(), 0);
            }
            break;
        case 'erase':
            break;
    }
  }, [getPointerPosition, activeTool, selectedColor, pages, currentPageIndex, finalizeLiveText, getFontString, fontSize, fontFamily, canIDraw]);

  const handlePointerMove = useCallback((event: React.PointerEvent) => {
    if (event.buttons !== 1 || !canIDraw) return;
    const pos = getPointerPosition(event);
    const opState = operationStateRef.current;

    if (opState.type === 'drawing') {
        opState.currentPath.push(pos);
        redrawTempCanvas();
        socketRef.current?.emit('draw', { type: 'move', point: pos });
    } else if (opState.type === 'shaping') {
        opState.currentPoint = pos;
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
            } else if (originalElement.type === 'shape') {
                draggedElements.push({ ...originalElement, x1: originalElement.x1 + dx, y1: originalElement.y1 + dy, x2: originalElement.x2 + dx, y2: originalElement.y2 + dy });
            } else if (originalElement.type === 'image') {
              draggedElements.push({ ...originalElement, x: originalElement.x + dx, y: originalElement.y + dy });
            }
        }
        setTempDragPreview(draggedElements);
    }
  }, [getPointerPosition, redrawTempCanvas, canIDraw]);

  const handlePointerUp = useCallback((event: React.PointerEvent) => {
    const opState = operationStateRef.current;

    if (opState.type === 'texting' && opState.isEditing) {
      // Don't finalize on pointer up, wait for another click or blur.
      return;
    }
    
    if (opState.type === 'drawing' && opState.currentPath.length > 1) {
        socketRef.current?.emit('draw', { type: 'end' });
        const newPath: PathElement = { type: 'path', id: `path_${Date.now()}`, points: opState.currentPath, color: selectedColor, lineWidth };
        setPages(currentPages => {
            const newPages = [...currentPages];
            const currentPage = newPages[currentPageIndex];
            const newElements = [...currentPage.elements, newPath];
            const updatedPage = { ...currentPage, elements: newElements, selectedElementIds: new Set() };
            newPages[currentPageIndex] = updatedPage;
            pushToHistory(currentPageIndex, updatedPage);
            return newPages;
        });
    } else if (opState.type === 'shaping') {
        const { startPoint, currentPoint } = opState;
        if (Math.hypot(currentPoint.x - startPoint.x, currentPoint.y - startPoint.y) > 2) {
             const newShape: ShapeElement = { type: 'shape', id: `shape_${Date.now()}`, shapeType: selectedShape, x1: startPoint.x, y1: startPoint.y, x2: currentPoint.x, y2: currentPoint.y, color: selectedColor, lineWidth };
             setPages(currentPages => {
                 const newPages = [...currentPages];
                 const currentPage = newPages[currentPageIndex];
                 const newElements = [...currentPage.elements, newShape];
                 const updatedPage = { ...currentPage, elements: newElements, selectedElementIds: new Set() };
                 newPages[currentPageIndex] = updatedPage;
                 pushToHistory(currentPageIndex, updatedPage);
                 return newPages;
             });
        }
    } else if (opState.type === 'lassoing') {
        if (opState.lassoPath.length > 2) {
            const newSelectedIds = new Set<string>();
            const lassoPolygon = opState.lassoPath;
            const lassoBox = getElementBoundingBox({type:'path', id:'', points:lassoPolygon, color:'', lineWidth:1});
            
            pages[currentPageIndex].elements.forEach(element => {
                const elementBox = getElementBoundingBox(element);
                if(!elementBox || (lassoBox && !boxesIntersect(lassoBox, elementBox))) return;
                
                if (element.type === 'path' ? element.points.some(p => isPointInPolygon(p, lassoPolygon)) : isPointInPolygon({x: element.x, y: element.y}, lassoPolygon)) {
                    newSelectedIds.add(element.id);
                }
            });

            if (newSelectedIds.size > 0) {
                 setPages(currentPages => {
                    const newPages = [...currentPages];
                    newPages[currentPageIndex] = { ...newPages[currentPageIndex], selectedElementIds: newSelectedIds };
                    return newPages;
                });
                setActiveTool('select');
            }
        }
    } else if (opState.type === 'dragging') {
        const { startPos, originalElements } = opState;
        const pos = getPointerPosition(event);
        const dx = pos.x - startPos.x;
        const dy = pos.y - startPos.y;

        if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
            setPages(currentPages => {
                const newPages = [...currentPages];
                const currentPage = newPages[currentPageIndex];
                const newElements = currentPage.elements.map(el => {
                    if (currentPage.selectedElementIds.has(el.id)) {
                        const originalElement = originalElements.get(el.id);
                        if (!originalElement) return el;
                        if (originalElement.type === 'path') {
                            return { ...originalElement, points: originalElement.points.map(p => ({ x: p.x + dx, y: p.y + dy })) };
                        } else if (originalElement.type === 'text') {
                            return { ...originalElement, x: originalElement.x + dx, y: originalElement.y + dy };
                        } else if (originalElement.type === 'shape') {
                            return { ...originalElement, x1: originalElement.x1 + dx, y1: originalElement.y1 + dy, x2: originalElement.x2 + dx, y2: originalElement.y2 + dy };
                        } else if (originalElement.type === 'image') {
                          return { ...originalElement, x: originalElement.x + dx, y: originalElement.y + dy };
                        }
                    }
                    return el;
                });
                const updatedPage = { ...currentPage, elements: newElements };
                newPages[currentPageIndex] = updatedPage;
                pushToHistory(currentPageIndex, updatedPage);
                return newPages;
            });
        }
        setTempDragPreview([]);
    }
    
    if (activeTool === 'erase' && opState.type === 'idle' && canIDraw) {
         let elementToDeleteId: string | null = null;
         const pos = getPointerPosition(event);
         const currentPageElements = pages[currentPageIndex].elements;
         for (let i = currentPageElements.length - 1; i >= 0; i--) {
            const element = currentPageElements[i];
            if (element.type === 'path') {
                for (let j = 0; j < element.points.length - 1; j++) {
                    if (distToSegment(pos, element.points[j], element.points[j + 1]) < ERASER_THRESHOLD + element.lineWidth / 2) {
                        elementToDeleteId = element.id; break;
                    }
                }
            } else if (element.type === 'text' || element.type === 'shape' || element.type === 'image') {
                const box = getElementBoundingBox(element);
                if(box) {
                    const inflatedBox = { minX: box.minX - ERASER_THRESHOLD, minY: box.minY - ERASER_THRESHOLD, maxX: box.maxX + ERASER_THRESHOLD, maxY: box.maxY + ERASER_THRESHOLD };
                    if(isPointInRect(pos, inflatedBox)) {
                        elementToDeleteId = element.id;
                    }
                }
            }
            if (elementToDeleteId) break;
        }
        if (elementToDeleteId) {
            const idToDelete = elementToDeleteId;
            setPages(currentPages => {
                const newPages = [...currentPages];
                const currentPage = newPages[currentPageIndex];
                const newElements = currentPage.elements.filter(el => el.id !== idToDelete);
                const updatedPage = { ...currentPage, elements: newElements, selectedElementIds: new Set() };
                newPages[currentPageIndex] = updatedPage;
                pushToHistory(currentPageIndex, updatedPage);
                return newPages;
            });
        }
    }

    if (opState.type !== 'texting') {
      operationStateRef.current = { type: 'idle' };
    }
    const tempCtx = tempCanvasRef.current?.getContext('2d');
    if (tempCtx) tempCtx.clearRect(0, 0, tempCtx.canvas.width, tempCtx.canvas.height);

  }, [getPointerPosition, selectedColor, lineWidth, pages, currentPageIndex, activeTool, pushToHistory, selectedShape, canIDraw]);

  const handleClearPage = () => { 
    const clearedPage: ElementState = { elements: [], selectedElementIds: new Set() };
    setPages(currentPages => {
        const newPages = [...currentPages];
        newPages[currentPageIndex] = clearedPage;
        return newPages;
    });
    pushToHistory(currentPageIndex, clearedPage);
  };
  
  const handleDrawButtonClick = () => {
    const isDrawingToolActive = activeTool === 'draw' || activeTool === 'shape';
    if (isDrawingToolActive) {
      setIsDrawPanelVisible(prev => !prev);
    } else {
      setActiveTool(lastDrawToolRef.current);
      setIsTextPanelVisible(false);
      setIsDrawPanelVisible(true);
    }
  };

  const handleTextButtonClick = () => {
    const isTextToolActive = activeTool === 'text';
    if (isTextToolActive) {
      setIsTextPanelVisible(prev => !prev);
    } else {
      setActiveTool('text');
      setIsDrawPanelVisible(false);
      setIsTextPanelVisible(true);
    }
  };

  const handleToolSelectFromPanel = (tool: 'draw' | 'shape') => {
    setActiveTool(tool);
    lastDrawToolRef.current = tool;
  };
  
  const handleNonDrawingToolSelect = (tool: 'erase' | 'lasso' | 'select') => {
      setActiveTool(tool);
      setIsDrawPanelVisible(false);
      setIsTextPanelVisible(false);
  };

  const handleAddPage = () => {
    const newPageIndex = pages.length;
    const newPage: ElementState = { elements: [], selectedElementIds: new Set() };
    setPages(currentPages => [...currentPages, newPage]);
    pagesHistoryRef.current.push([]);
    pagesHistoryStepRef.current.push(-1);
    setCurrentPageIndex(newPageIndex); 
    pushToHistory(newPageIndex, newPage);
    setIsPagesPopoverOpen(false);
  };

  const handleSwitchPage = (index: number) => {
    if (index !== currentPageIndex) {
        finalizeLiveText();
        setPages(currentPages => {
            const newPages = [...currentPages];
            newPages[currentPageIndex] = { ...newPages[currentPageIndex], selectedElementIds: new Set() };
            return newPages;
        });
        setCurrentPageIndex(index);
    }
    setIsPagesPopoverOpen(false);
  };

  const handleDeletePage = (indexToDelete: number) => {
    if (pages.length <= 1) {
        handleClearPage();
        setIsPagesPopoverOpen(false);
        return;
    }
    setPages(currentPages => currentPages.filter((_, i) => i !== indexToDelete));
    pagesHistoryRef.current.splice(indexToDelete, 1);
    pagesHistoryStepRef.current.splice(indexToDelete, 1);
    
    if (currentPageIndex === indexToDelete) {
        setCurrentPageIndex(Math.max(0, indexToDelete - 1));
    } else if (currentPageIndex > indexToDelete) {
        setCurrentPageIndex(currentPageIndex - 1);
    }
    setIsPagesPopoverOpen(false);
  };
  
  const handleRecognizeShape = useCallback(async () => {
    setIsRefineDialogOpen(false);
    
    const currentPage = pages[currentPageIndex];
    if (currentPage.selectedElementIds.size === 0) {
      toast({
        title: "Nothing to Refine",
        description: "Please select a drawing first using the select tool.",
      });
      setRefinePrompt('');
      return;
    }
  
    const selectionBox = getSelectionBoundingBox(currentPage.elements, currentPage.selectedElementIds);
    if (!selectionBox) {
      toast({ variant: "destructive", title: "Error", description: "Could not determine selection area." });
      setRefinePrompt('');
      return;
    }
  
    const recognitionToast = toast({
      title: "Refining Shape...",
      description: "The AI is analyzing your drawing. This might take a moment.",
      duration: Infinity,
    });
  
    const PADDING = 20;
    const width = selectionBox.maxX - selectionBox.minX + PADDING * 2;
    const height = selectionBox.maxY - selectionBox.minY + PADDING * 2;
  
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = width;
    tempCanvas.height = height;
    const tempCtx = tempCanvas.getContext('2d');
    if (!tempCtx) {
      recognitionToast.update({ id: recognitionToast.id, variant: "destructive", title: "Canvas Error", description: "Could not create temporary canvas for recognition." });
      setRefinePrompt('');
      return;
    }
  
    tempCtx.fillStyle = 'white';
    tempCtx.fillRect(0, 0, width, height);
  
    tempCtx.translate(-selectionBox.minX + PADDING, -selectionBox.minY + PADDING);
    currentPage.elements.forEach(element => {
      if (currentPage.selectedElementIds.has(element.id)) {
        drawElement(tempCtx, element);
      }
    });
  
    const drawingDataUri = tempCanvas.toDataURL('image/png');
  
    try {
      const result = await recognizeShape({ drawingDataUri, prompt: refinePrompt });
  
      const newImg = new Image();
      newImg.onload = () => {
        const originalWidth = selectionBox.maxX - selectionBox.minX;
        const originalHeight = selectionBox.maxY - selectionBox.minY;
        const aspectRatio = newImg.width / newImg.height;
  
        let newWidth = originalWidth;
        let newHeight = newWidth / aspectRatio;
  
        if (newHeight > originalHeight) {
          newHeight = originalHeight;
          newWidth = newHeight * aspectRatio;
        }
  
        const newX = selectionBox.minX + (originalWidth - newWidth) / 2;
        const newY = selectionBox.minY + (originalHeight - newHeight) / 2;
  
        const newImageElement: ImageElement = {
          type: 'image',
          id: `image_${Date.now()}`,
          src: result.refinedImageUri,
          x: newX,
          y: newY,
          width: newWidth,
          height: newHeight,
        };
  
        setLoadedImages(prev => new Map(prev).set(newImageElement.id, newImg));
  
        setPages(currentPages => {
          const newPages = [...currentPages];
          const pageToUpdate = { ...newPages[currentPageIndex] };
          const elementsWithoutOld = pageToUpdate.elements.filter(el => !pageToUpdate.selectedElementIds.has(el.id));
          const finalElements = [...elementsWithoutOld, newImageElement];
          const updatedPage: ElementState = {
            elements: finalElements,
            selectedElementIds: new Set([newImageElement.id])
          };
          newPages[currentPageIndex] = updatedPage;
          pushToHistory(currentPageIndex, updatedPage);
          return newPages;
        });
  
        recognitionToast.update({ id: recognitionToast.id, title: "Shape Refined!", description: "Your drawing has been transformed." });
      };
      newImg.onerror = () => {
        recognitionToast.update({ id: recognitionToast.id, variant: "destructive", title: "Image Load Error", description: "The AI generated an image that could not be loaded." });
      };
      newImg.src = result.refinedImageUri;
    } catch (error) {
      console.error("Shape recognition failed:", error);
      recognitionToast.update({ id: recognitionToast.id, 
        variant: "destructive",
        title: "Refinement Failed",
        description: error instanceof Error ? error.message : "An unknown error occurred.",
      });
    } finally {
        setRefinePrompt('');
    }
  }, [pages, currentPageIndex, toast, refinePrompt, drawElement, pushToHistory]);

  const getCanvasAsBlob = async (): Promise<Blob | null> => {
    const canvas = mainCanvasRef.current;
    if (!canvas) return null;
    return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  };

  const handleDownloadScreenshot = async () => {
    setIsScreenshotDialogOpen(false);
    const blob = await getCanvasAsBlob();
    if (!blob) {
        toast({ variant: "destructive", title: "Error", description: "Could not capture screenshot." });
        return;
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `TeachMeet Whiteboard - ${new Date().toISOString()}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast({ title: "Screenshot Downloaded", description: "Your whiteboard has been saved." });
  };
  
  const handleSaveScreenshotToDocuments = async (destination: 'private' | 'public') => {
    setIsScreenshotDialogOpen(false);
    if (isProcessing) return;
    setIsProcessing(true);
    
    const toastResult = toast({ title: "Saving Screenshot...", description: "Please wait...", duration: Infinity });
    
    try {
      const blob = await getCanvasAsBlob();
      if (!blob) throw new Error("Could not capture screenshot blob.");

      if (!auth.currentUser) throw new Error("Authentication required to save.");
      const userId = auth.currentUser.uid;
      const fileName = `Whiteboard Screenshot - ${new Date().toISOString()}.png`;
      const path = `documents/${userId}/${destination}/${Date.now()}-${fileName}`;
      const fileRef = storageRef(storage, path);
      
      await uploadBytes(fileRef, blob);
      const downloadURL = await getDownloadURL(fileRef);

      await addDoc(collection(db, "documents"), {
          name: fileName,
          lastModified: new Date().toISOString(),
          size: `${(blob.size / 1024 / 1024).toFixed(2)}MB`,
          uploaderId: userId,
          isPrivate: destination === 'private',
          downloadURL,
          storagePath: path,
          createdAt: serverTimestamp(),
      });
      
      toastResult.update({ id: toastResult.id, title: "Screenshot Saved!", description: `Saved to your ${destination} documents.` });

    } catch (error) {
      console.error("Failed to save screenshot:", error);
      toastResult.update({ id: toastResult.id, variant: "destructive", title: "Save Failed", description: error instanceof Error ? error.message : "An unknown error occurred." });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleExportToPdf = async (destination: 'private' | 'public') => {
    if (isProcessing) return;
    setIsExportDialogOpen(false);
    setIsProcessing(true);
    setIsPagesPopoverOpen(false);

    const exportToast = toast({
        title: "Exporting to PDF...",
        description: "Please wait while your whiteboard is being converted.",
        duration: Infinity
    });

    const offscreenCanvas = document.createElement('canvas');
    const mainCanvas = mainCanvasRef.current;
    if (!mainCanvas) {
        exportToast.update({ id: exportToast.id, variant: "destructive", title: "Export Failed", description: "Canvas element not found." });
        setIsProcessing(false);
        return;
    }

    offscreenCanvas.width = mainCanvas.width;
    offscreenCanvas.height = mainCanvas.height;
    const offscreenCtx = offscreenCanvas.getContext('2d');
    if (!offscreenCtx) {
        exportToast.update({ id: exportToast.id, variant: "destructive", title: "Export Failed", description: "Could not create offscreen canvas context." });
        setIsProcessing(false);
        return;
    }

    const doc = new jsPDF({
        orientation: mainCanvas.width > mainCanvas.height ? 'landscape' : 'portrait',
        unit: 'px',
        format: [mainCanvas.width, mainCanvas.height]
    });

    try {
        for (let i = 0; i < pages.length; i++) {
            exportToast.update({ id: exportToast.id, title: "Exporting to PDF...", description: `Processing page ${i + 1} of ${pages.length}...` });
            
            offscreenCtx.fillStyle = bgColor;
            offscreenCtx.fillRect(0, 0, offscreenCanvas.width, offscreenCanvas.height);
            for (const element of pages[i].elements) {
                drawElement(offscreenCtx, element);
            }

            const imgData = offscreenCanvas.toDataURL('image/png');
            if (i > 0) {
                doc.addPage();
            }
            doc.addImage(imgData, 'PNG', 0, 0, mainCanvas.width, mainCanvas.height);
        }

        const pdfBlob = doc.output('blob');
        
        if (!auth.currentUser) throw new Error("Authentication required.");
        
        const fileName = `Whiteboard - ${topic || meetingId} - ${new Date().toISOString()}.pdf`;
        const userId = auth.currentUser.uid;
        const storagePath = `documents/${userId}/${destination}/${Date.now()}-${fileName}`;
        const fileRef = storageRef(storage, storagePath);

        await uploadBytes(fileRef, pdfBlob);
        const downloadURL = await getDownloadURL(fileRef);

        await addDoc(collection(db, "documents"), {
            name: fileName,
            lastModified: new Date().toISOString(),
            size: `${(pdfBlob.size / (1024 * 1024)).toFixed(2)}MB`,
            uploaderId: userId,
            isPrivate: destination === 'private',
            downloadURL,
            storagePath,
            createdAt: serverTimestamp(),
        });

        exportToast.update({ id: exportToast.id, title: "Export Successful!", description: `Your whiteboard has been saved to your ${destination} documents.` });
        
    } catch (error) {
        console.error("PDF Export or Upload Failed:", error);
        exportToast.update({ id: exportToast.id, variant: "destructive", title: "Export Failed", description: error instanceof Error ? error.message : "An unknown error occurred during export." });
    } finally {
        setIsProcessing(false);
    }
};

  const memoizedHeaderAction = useCallback(() => (
    <Dialog>
      <div className="flex items-center gap-2">
        {meetingId && (
          <Button asChild variant="outline" size="sm" className="rounded-lg">
            <Link href={`/dashboard/meeting/${meetingId}?topic=${encodeURIComponent(topic || '')}&cam=${cam}&mic=${mic}`}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Link>
          </Button>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="rounded-full">
              <MoreVertical className="h-5 w-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="rounded-xl">
            <DialogTrigger asChild>
              <DropdownMenuItem onSelect={e => e.preventDefault()} className="cursor-pointer">
                <UserCheck className="mr-2 h-4 w-4" />
                <span>Collaborate</span>
              </DropdownMenuItem>
            </DialogTrigger>
            <DropdownMenuItem onSelect={() => setIsScreenshotDialogOpen(true)} className="cursor-pointer">
              <Camera className="mr-2 h-4 w-4" />
              <span>Screenshot</span>
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => router.push(`/dashboard/settings?highlight=whiteboardSettings&meetingId=${meetingId}&topic=${encodeURIComponent(topic || '')}`)} className="cursor-pointer">
              <Settings className="mr-2 h-4 w-4" />
              <span>Whiteboard Settings</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <CollaborateDialogContent
          participants={participants}
          drawingPermissions={drawingPermissions}
          onPermissionChange={handlePermissionChange}
      />
    </Dialog>
  ), [meetingId, router, topic, participants, drawingPermissions, cam, mic]);
  
  useEffect(() => {
    const newInitialPage = { elements: [], selectedElementIds: new Set() };
    setPages([newInitialPage]);
    pagesHistoryRef.current = [[newInitialPage]];
    pagesHistoryStepRef.current = [0];

    // --- Socket.IO Connection ---
    if (meetingId && auth.currentUser) {
      const whiteboardRoomId = `whiteboard-owner-${auth.currentUser.uid}`;
      const socket = io({
        path: "/api/socketio",
        query: { userId: auth.currentUser.uid }
      });
      socketRef.current = socket;

      socket.on('connect', () => {
        socket.emit('join-room', whiteboardRoomId);
        console.log(`Whiteboard owner joined own room: ${whiteboardRoomId}`);
      });
      
      socket.on('draw-from-collaborator', (data) => {
        // Here, the owner receives drawing data from a collaborator and draws it locally.
        console.log('Received draw event from collaborator:', data);
        // This part needs logic to draw the received data, possibly on a temporary canvas layer for collaborators.
        // For now, we'll just log it.
      });
      
      const unsubParticipants = onSnapshot(collection(db, "meetings", meetingId, "participants"), (snapshot) => {
          const fetchedParticipants: Participant[] = [];
          snapshot.forEach((doc) => {
              fetchedParticipants.push({ id: doc.id, ...doc.data() } as Participant);
          });
          setParticipants(fetchedParticipants);
      });

      return () => {
        console.log('[Whiteboard] Disconnecting socket...');
        socket.disconnect();
        unsubParticipants();
      };
    }
  }, [meetingId]);
  
  const handlePermissionChange = (participantId: string, canDraw: boolean) => {
    setDrawingPermissions(prev => {
        const newPermissions = {...prev, [participantId]: canDraw };
        socketRef.current?.emit('set-permission', { ownerId: auth.currentUser?.uid, participantId, canDraw });
        return newPermissions;
    });
  };
  
  useEffect(() => {
    setHeaderContent(
        <div className="flex items-center gap-3">
          <Brush className="h-7 w-7 text-primary" />
          <h1 className="text-xl font-semibold truncate">Whiteboard</h1>
        </div>
    );
    setHeaderAction(memoizedHeaderAction());

    return () => {
        setHeaderContent(null);
        setHeaderAction(null);
    };
  }, [setHeaderContent, setHeaderAction, memoizedHeaderAction]);


  return (
    <>
      <textarea
        ref={liveTextInputRef}
        onBlur={finalizeLiveText}
        onInput={(e) => {
            const textarea = e.currentTarget;
            textarea.style.height = 'auto';
            textarea.style.height = `${textarea.scrollHeight}px`;
            const tempCtx = tempCanvasRef.current?.getContext('2d');
            if (tempCtx) {
              tempCtx.font = getFontString();
              const textMetrics = tempCtx.measureText(textarea.value);
              textarea.style.width = `${Math.max(50, textMetrics.width + 10)}px`;
            }
        }}
        style={{
          position: 'absolute',
          display: 'none',
          border: '1px dashed hsl(var(--primary))',
          outline: 'none',
          background: 'transparent',
          zIndex: 10,
          resize: 'none',
          overflow: 'hidden',
          whiteSpace: 'pre',
          padding: '4px',
          fontFamily: fontFamily,
        }}
        tabIndex={-1}
      />
      <div className="flex flex-col h-full bg-muted/30">
        <div className="flex-none p-2 border-b bg-background shadow-md z-20">
          <div className="container mx-auto flex flex-wrap items-center justify-center gap-2 relative">
            <ToolButton icon={Brush} label="Draw" onClick={handleDrawButtonClick} isActive={activeTool === 'draw' || activeTool === 'shape'}/>
            {isDrawPanelVisible && (
              <Card className="absolute top-full mt-2 w-[320px] p-4 rounded-xl z-30 bg-popover text-popover-foreground shadow-lg border left-1/2 -translate-x-1/2">
                <div className="space-y-4">
                  <div className="space-y-2">
                      <Label className="text-xs font-semibold text-muted-foreground">COLOR</Label>
                      <div className="flex flex-wrap gap-2 items-center">
                          {['#000000', '#ef4444', '#3b82f6', '#22c55e', '#facc15', '#f97316'].map(color => (
                              <button key={color} style={{ backgroundColor: color }} className={cn('w-6 h-6 rounded-full border-2 transition-transform hover:scale-110', selectedColor === color ? 'border-primary ring-2 ring-offset-2 ring-offset-background ring-primary' : 'border-background')} onClick={() => setSelectedColor(color)} />
                          ))}
                          <div className="w-8 h-8 rounded-full border-2 border-border overflow-hidden inline-flex items-center justify-center">
                              <input type="color" value={selectedColor} onChange={(e) => setSelectedColor(e.target.value)} className="w-full h-full p-0 m-0 border-none appearance-none cursor-pointer bg-transparent" style={{'WebkitAppearance': 'none'}}/>
                          </div>
                      </div>
                  </div>
                  <div className="space-y-2">
                      <Label className="text-xs font-semibold text-muted-foreground">LINE WIDTH</Label>
                      <div className="flex items-center gap-2">
                          <Slider
                            value={[lineWidth]}
                            onValueChange={(value) => setLineWidth(value[0])}
                            min={1} max={50} step={1}
                          />
                          <span className="text-sm font-mono w-8 text-center">{lineWidth}</span>
                      </div>
                  </div>
                  <div className="space-y-2">
                      <Label className="text-xs font-semibold text-muted-foreground">TOOLS</Label>
                      <div className="flex gap-2 flex-wrap">
                          <Button title="Pen" size="icon" variant={activeTool === 'draw' ? 'secondary' : 'ghost'} onClick={() => handleToolSelectFromPanel('draw')}><Brush className="h-5 w-5" /></Button>
                          <Button title="Rectangle" size="icon" variant={activeTool === 'shape' && selectedShape === 'rectangle' ? 'secondary' : 'ghost'} onClick={() => {setSelectedShape('rectangle'); handleToolSelectFromPanel('shape');}}><RectangleHorizontal className="h-5 w-5" /></Button>
                          <Button title="Circle" size="icon" variant={activeTool === 'shape' && selectedShape === 'circle' ? 'secondary' : 'ghost'} onClick={() => {setSelectedShape('circle'); handleToolSelectFromPanel('shape');}}><Circle className="h-5 w-5" /></Button>
                          <Button title="Line" size="icon" variant={activeTool === 'shape' && selectedShape === 'line' ? 'secondary' : 'ghost'} onClick={() => {setSelectedShape('line'); handleToolSelectFromPanel('shape');}}><Minus className="h-5 w-5" /></Button>
                          <Button title="Triangle" size="icon" variant={activeTool === 'shape' && selectedShape === 'triangle' ? 'secondary' : 'ghost'} onClick={() => {setSelectedShape('triangle'); handleToolSelectFromPanel('shape');}}><Triangle className="h-5 w-5" /></Button>
                          <Button title="Arrow" size="icon" variant={activeTool === 'shape' && selectedShape === 'arrow' ? 'secondary' : 'ghost'} onClick={() => {setSelectedShape('arrow'); handleToolSelectFromPanel('shape');}}><MoveRight className="h-5 w-5" /></Button>
                          <Button title="Diamond" size="icon" variant={activeTool === 'shape' && selectedShape === 'diamond' ? 'secondary' : 'ghost'} onClick={() => {setSelectedShape('diamond'); handleToolSelectFromPanel('shape');}}><Diamond className="h-5 w-5" /></Button>
                      </div>
                  </div>
                </div>
              </Card>
            )}
             <ToolButton icon={Lasso} label="Select" onClick={() => handleNonDrawingToolSelect("lasso")} isActive={activeTool === "lasso" || activeTool === "select"}/>
             <Dialog open={isRefineDialogOpen} onOpenChange={setIsRefineDialogOpen}>
              <DialogTrigger asChild>
                <ToolButton icon={Sparkles} label="Refine" disabled={pages[currentPageIndex]?.selectedElementIds.size === 0} />
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <ShadDialogTitle>Refine Your Drawing</ShadDialogTitle>
                  <DialogDescription>
                    Optionally, tell the AI what you drew to get a better result.
                  </DialogDescription>
                </DialogHeader>
                <div className="py-2">
                  <Label htmlFor="refine-prompt" className="text-sm text-muted-foreground">What did you draw? (e.g., "a bird", "a house")</Label>
                  <Input
                    id="refine-prompt"
                    value={refinePrompt}
                    onChange={(e) => setRefinePrompt(e.target.value)}
                    placeholder="Optional prompt..."
                    className="mt-2"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleRecognizeShape();
                      }
                    }}
                  />
                </div>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button type="button" variant="secondary" onClick={() => setRefinePrompt('')}>Cancel</Button>
                  </DialogClose>
                  <Button type="button" onClick={handleRecognizeShape}>Refine</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
             <ToolButton icon={Type} label="Text" onClick={handleTextButtonClick} isActive={activeTool === "text"}/>
             {isTextPanelVisible && (
                <Card className="absolute top-full mt-2 w-[320px] p-4 rounded-xl z-30 bg-popover text-popover-foreground shadow-lg border left-1/2 -translate-x-1/2">
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label className="text-xs font-semibold text-muted-foreground">COLOR</Label>
                            <div className="flex flex-wrap gap-2 items-center">
                                {['#000000', '#ef4444', '#3b82f6', '#22c55e', '#facc15', '#f97316'].map(color => (
                                    <button key={color} style={{ backgroundColor: color }} className={cn('w-6 h-6 rounded-full border-2 transition-transform hover:scale-110', selectedColor === color ? 'border-primary ring-2 ring-offset-2 ring-offset-background ring-primary' : 'border-background')} onClick={() => setSelectedColor(color)} />
                                ))}
                                <div className="w-8 h-8 rounded-full border-2 border-border overflow-hidden inline-flex items-center justify-center">
                                    <input type="color" value={selectedColor} onChange={(e) => setSelectedColor(e.target.value)} className="w-full h-full p-0 m-0 border-none appearance-none cursor-pointer bg-transparent" style={{'WebkitAppearance': 'none'}}/>
                                </div>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="font-family-select" className="text-xs font-semibold text-muted-foreground flex items-center gap-1"><Baseline className="h-4 w-4"/>FONT</Label>
                            <Select value={fontFamily} onValueChange={setFontFamily}>
                                <SelectTrigger id="font-family-select" className="rounded-lg">
                                    <SelectValue placeholder="Select a font..." />
                                </SelectTrigger>
                                <SelectContent className="rounded-lg">
                                    <SelectItem value="sans-serif">Sans-Serif</SelectItem>
                                    <SelectItem value="serif">Serif</SelectItem>
                                    <SelectItem value="monospace">Monospace</SelectItem>
                                    <SelectItem value="cursive">Cursive</SelectItem>
                                    <SelectItem value="fantasy">Fantasy</SelectItem>
                                    <SelectItem value="Arial">Arial</SelectItem>
                                    <SelectItem value="Georgia">Georgia</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-xs font-semibold text-muted-foreground">FONT SIZE</Label>
                            <div className="flex items-center gap-2">
                                <Slider
                                  value={[fontSize]}
                                  onValueChange={(value) => setFontSize(value[0])}
                                  min={8} max={128} step={1}
                                />
                                <span className="text-sm font-mono w-10 text-center">{fontSize}px</span>
                            </div>
                        </div>
                    </div>
                </Card>
             )}
             <ToolButton icon={Eraser} label="Erase" onClick={() => handleNonDrawingToolSelect("erase")} isActive={activeTool === "erase"}/>
             <ToolButton icon={Undo2} label="Undo" onClick={handleUndo} />
             <ToolButton icon={Redo2} label="Redo" onClick={handleRedo} />
             
             <Popover open={isPagesPopoverOpen} onOpenChange={setIsPagesPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="icon" className="rounded-lg w-12 h-12 flex flex-col items-center justify-center text-xs" aria-label={`Pages (${currentPageIndex + 1}/${pages.length})`}>
                    <Files className="h-5 w-5 mb-0.5" />
                    <span className="text-[10px] leading-tight">Pages ({currentPageIndex + 1}/{pages.length})</span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-64 p-2 rounded-xl" side="bottom">
                    <div className="space-y-2">
                        <Button onClick={handleAddPage} className="w-full rounded-lg btn-gel" size="sm">
                            <PlusCircle className="mr-2 h-4 w-4" /> Add New Page
                        </Button>
                        <Button onClick={() => { setIsPagesPopoverOpen(false); setIsExportDialogOpen(true); }} className="w-full rounded-lg" size="sm" variant="outline" disabled={isProcessing}>
                            {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileDown className="mr-2 h-4 w-4" />}
                            {isProcessing ? 'Processing...' : 'Export as PDF'}
                        </Button>
                        <div className="relative py-2">
                            <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
                            <div className="relative flex justify-center text-xs uppercase"><span className="bg-popover px-2 text-muted-foreground">Or Manage Pages</span></div>
                        </div>
                        <ScrollArea className="h-40 border rounded-lg">
                            <div className="p-1 space-y-1">
                                {pages.map((page, index) => (
                                    <div 
                                        key={index}
                                        onClick={() => handleSwitchPage(index)}
                                        className={cn(
                                            "flex items-center justify-between p-2 rounded-md cursor-pointer hover:bg-muted",
                                            currentPageIndex === index && "bg-primary text-primary-foreground"
                                        )}
                                    >
                                        <span className="text-sm font-medium">Page {index + 1}</span>
                                        <Button 
                                          variant="ghost" 
                                          size="icon" 
                                          className={cn(
                                            "h-6 w-6 text-muted-foreground hover:text-destructive",
                                            currentPageIndex === index && "text-primary-foreground/70 hover:text-primary-foreground hover:bg-white/20"
                                          )}
                                          onClick={(e) => { e.stopPropagation(); handleDeletePage(index); }}
                                          disabled={pages.length <= 1}
                                        >
                                            <Trash2 className="h-4 w-4"/>
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        </ScrollArea>
                    </div>
                </PopoverContent>
             </Popover>

             <AlertDialog>
                <AlertDialogTrigger asChild>
                    <ToolButton icon={Trash2} label="Clear" />
                </AlertDialogTrigger>
                <AlertDialogContent className="rounded-xl"><AlertDialogHeader><AlertDialogTitle>Clear this page?</AlertDialogTitle><AlertDialogDescription>This will clear the current page. This action cannot be undone.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel className="rounded-lg">Cancel</AlertDialogCancel><AlertDialogAction onClick={handleClearPage} className="rounded-lg">Clear Page</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
             </AlertDialog>
          </div>
        </div>

        <main className="flex-grow flex flex-col overflow-hidden min-h-0">
          <Card className="w-full h-full max-w-full text-center shadow-none rounded-none border-0 flex flex-col overflow-hidden">
            <CardContent className="flex-grow flex items-center justify-center relative p-0">
                <canvas ref={mainCanvasRef} className="touch-none w-full h-full block absolute top-0 left-0" style={{ zIndex: 1, backgroundColor: bgColor }} />
                <canvas 
                    ref={tempCanvasRef} 
                    onPointerDown={handlePointerDown} 
                    onPointerMove={handlePointerMove} 
                    onPointerUp={handlePointerUp} 
                    onPointerLeave={handlePointerUp} 
                    className="touch-none w-full h-full block absolute top-0 left-0" 
                    style={{ zIndex: 2, cursor: activeTool === 'select' ? 'default' : (activeTool === 'lasso' || activeTool === 'draw' || activeTool === 'erase' || activeTool === 'shape' ? 'crosshair' : 'text') }} 
                />
            </CardContent>
          </Card>
        </main>
        <footer className="flex-none p-2 text-center text-xs text-muted-foreground border-t bg-background">
          Whiteboard is in active development. All drawings are currently local.
        </footer>
      </div>

       <Dialog open={isExportDialogOpen} onOpenChange={setIsExportDialogOpen}>
        <DialogContent className="sm:max-w-md rounded-xl">
          <DialogHeader>
            <ShadDialogTitle className="text-xl">Choose Export Destination</ShadDialogTitle>
            <DialogDescription>Where would you like to save this PDF?</DialogDescription>
          </DialogHeader>
          <div className="py-6 space-y-4">
            <Button variant="outline" className="w-full rounded-lg py-6 text-base" onClick={() => handleExportToPdf('private')} disabled={isProcessing}>
              <Lock className="mr-2 h-5 w-5" /> Save to Private
            </Button>
            <Button variant="outline" className="w-full rounded-lg py-6 text-base" onClick={() => handleExportToPdf('public')} disabled={isProcessing}>
              <Globe className="mr-2 h-5 w-5" /> Save to Public
            </Button>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="secondary" className="rounded-lg" disabled={isProcessing}>Cancel</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      <Dialog open={isScreenshotDialogOpen} onOpenChange={setIsScreenshotDialogOpen}>
        <DialogContent className="sm:max-w-md rounded-xl">
          <DialogHeader>
            <ShadDialogTitle className="text-xl">Save Screenshot</ShadDialogTitle>
            <DialogDescription>How would you like to save the screenshot of your whiteboard?</DialogDescription>
          </DialogHeader>
          <div className="py-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            <Button variant="outline" className="w-full rounded-lg py-6 text-base" onClick={handleDownloadScreenshot} disabled={isProcessing}>
              <FileDown className="mr-2 h-5 w-5" /> Download to Device
            </Button>
            <Dialog>
              <DialogTrigger asChild>
                 <Button variant="outline" className="w-full rounded-lg py-6 text-base" disabled={isProcessing}>
                   <Globe className="mr-2 h-5 w-5" /> Save to Documents
                 </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-xs rounded-xl">
                 <DialogHeader>
                    <ShadDialogTitle>Save to Documents</ShadDialogTitle>
                    <DialogDescription>Choose a destination for your screenshot.</DialogDescription>
                  </DialogHeader>
                  <div className="py-4 space-y-3">
                    <Button variant="outline" className="w-full rounded-lg" onClick={() => handleSaveScreenshotToDocuments('private')} disabled={isProcessing}>
                      <Lock className="mr-2 h-4 w-4" /> Save as Private
                    </Button>
                    <Button variant="outline" className="w-full rounded-lg" onClick={() => handleSaveScreenshotToDocuments('public')} disabled={isProcessing}>
                      <Globe className="mr-2 h-4 w-4" /> Save as Public
                    </Button>
                  </div>
              </DialogContent>
            </Dialog>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="secondary" className="w-full rounded-lg" disabled={isProcessing}>Cancel</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
