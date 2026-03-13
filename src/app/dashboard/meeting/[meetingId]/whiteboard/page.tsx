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
import { ArrowLeft, Brush, Type, Eraser, Trash2, Undo2, Redo2, Lasso, RectangleHorizontal, Circle, Minus, Files, PlusCircle, Triangle, MoveRight, Diamond, Settings, Sparkles, MoreVertical, Baseline, FileDown, Loader2, Lock, Globe, Camera, Star, Pencil, X } from "lucide-react";
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
import { collection, addDoc, serverTimestamp, doc, getDoc } from 'firebase/firestore';
import HostJoinRequestNotification from "@/components/meeting/HostJoinRequestNotification";

function hasPosition(element: any): element is { x: number; y: number } {
  return 'x' in element && 'y' in element;
}

function isPathElement(element: any): element is { type: 'path'; points: { x: number; y: number }[] } {
  return element.type === 'path' && 'points' in element;
}

// --- Type Definitions ---
interface Point { x: number; y: number; }
type PathElement = { type: 'path'; id: string; points: Point[]; color: string; lineWidth: number; };
type TextElement = { type: 'text'; id: string; text: string; x: number; y: number; color: string; fontSize: number; fontFamily: string; width: number; height: number; isEditing?: boolean; };
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

export default function WhiteboardPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const topic = searchParams.get('topic');
  const meetingId = params.meetingId as string;
  const { setHeaderContent, setHeaderAction } = useDynamicHeader();
  const { toast } = useToast();

  const mainCanvasRef = useRef<HTMLCanvasElement>(null);
  const tempCanvasRef = useRef<HTMLCanvasElement>(null);

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
  const [isReviewDialogOpen, setIsReviewDialogOpen] = useState(false);
  const lastDrawToolRef = useRef<'draw' | 'shape'>('draw');

  const operationStateRef = useRef<OperationState>({ type: 'idle' });
  const [tempDragPreview, setTempDragPreview] = useState<WhiteboardElement[]>([]);
  const [bgColor, setBgColor] = useState('#FFFFFF');
  const [loadedImages, setLoadedImages] = useState<Map<string, HTMLImageElement>>(new Map());
  const [isProcessing, setIsProcessing] = useState(false);
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const [isHost, setIsHost] = useState(false);


  const [refinePrompt, setRefinePrompt] = useState("");

  const dragRef = useRef<{ id: string; startX: number; startY: number } | null>(null);
  const currentPageIndexRef = useRef(currentPageIndex);

  useEffect(() => {
    currentPageIndexRef.current = currentPageIndex;
  }, [currentPageIndex]);

  useEffect(() => {
    if (!meetingId) return;
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (user) {
        const meetingSnap = await getDoc(doc(db, 'meetings', meetingId));
        if (meetingSnap.exists() && meetingSnap.data().hostId === user.uid) {
          setIsHost(true);
        }
      }
    });
    return () => unsubscribe();
  }, [meetingId]);

  useEffect(() => {
    setBgColor(localStorage.getItem('teachmeet-whiteboard-bg-color') || '#FFFFFF');
    setSelectedColor(localStorage.getItem('teachmeet-whiteboard-color') || '#000000');
    setLineWidth(parseInt(localStorage.getItem('teachmeet-whiteboard-linewidth') || '5', 10));
    setFontSize(parseInt(localStorage.getItem('teachmeet-whiteboard-fontsize') || '16', 10));
    setFontFamily(localStorage.getItem('teachmeet-whiteboard-fontfamily') || 'sans-serif');
  }, []);
  
  const pushToHistory = useCallback((pageIndex: number, state: ElementState) => {
    const history = [...(pagesHistoryRef.current[pageIndex] || [])];
    const step = pagesHistoryStepRef.current[pageIndex] ?? -1;
    
    const truncatedHistory = history.slice(0, step + 1);
    
    const stateToPush = JSON.parse(JSON.stringify(state));
    stateToPush.selectedElementIds = new Set(state.selectedElementIds);
    
    truncatedHistory.push(stateToPush);
    
    if (truncatedHistory.length > MAX_HISTORY_STEPS) {
      truncatedHistory.shift();
    }
    
    pagesHistoryRef.current[pageIndex] = truncatedHistory;
    pagesHistoryStepRef.current[pageIndex] = truncatedHistory.length - 1;
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
      // Logic for compositing text onto canvas (used during screenshot/export)
      ctx.fillStyle = element.color;
      ctx.font = `${element.fontSize}px ${element.fontFamily}`;
      ctx.textBaseline = 'top';
      const lines = element.text.split('\n');
      const lineHeight = element.fontSize * 1.2;
      lines.forEach((line, i) => {
        ctx.fillText(line, element.x, element.y + (i * lineHeight));
      });
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
    
    currentPage.elements.forEach(element => {
        // Only draw standard elements on main canvas (text is a DOM layer)
        if (element.type !== 'text') {
            drawElement(mainCtx, element);
        }
    });

    const finalizedSelectedIds = new Set(
        Array.from(currentPage.selectedElementIds).filter(id => {
            const el = currentPage.elements.find(e => e.id === id);
            return el && el.type !== 'text';
        })
    );

    const selectionBox = getSelectionBoundingBox(currentPage.elements, finalizedSelectedIds);
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
        tempDragPreview.forEach(el => {
            if (el.type !== 'text') drawElement(tempCtx, el);
        });
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
    const history = pagesHistoryRef.current[currentPageIndex];
    const step = pagesHistoryStepRef.current[currentPageIndex];
    if (step > 0) {
      const nextStep = step - 1;
      pagesHistoryStepRef.current[currentPageIndex] = nextStep;
      const prevState = history[nextStep];
      
      setPages(currentPages => {
          const newPages = [...currentPages];
          const clonedState = JSON.parse(JSON.stringify(prevState));
          clonedState.selectedElementIds = new Set(prevState.selectedElementIds);
          newPages[currentPageIndex] = clonedState;
          return newPages;
      });
    }
  }, [currentPageIndex]);

  const handleRedo = useCallback(() => {
    const history = pagesHistoryRef.current[currentPageIndex];
    const step = pagesHistoryStepRef.current[currentPageIndex];
    if (step < history.length - 1) {
      const nextStep = step + 1;
      pagesHistoryStepRef.current[currentPageIndex] = nextStep;
      const nextState = history[nextStep];
      
      setPages(currentPages => {
          const newPages = [...currentPages];
          const clonedState = JSON.parse(JSON.stringify(nextState));
          clonedState.selectedElementIds = new Set(nextState.selectedElementIds);
          newPages[currentPageIndex] = clonedState;
          return newPages;
      });
    }
  }, [currentPageIndex]);
  
  const getPointerPosition = useCallback((event: React.PointerEvent): Point => {
      const rect = tempCanvasRef.current!.getBoundingClientRect();
      return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }, []);

  const handleDragStart = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    dragRef.current = {
      id,
      startX: e.clientX,
      startY: e.clientY
    };
  };

  const handleTouchStart = (e: React.TouchEvent, id: string) => {
    e.stopPropagation();
    const touch = e.touches[0];
    dragRef.current = {
      id,
      startX: touch.clientX,
      startY: touch.clientY
    };
  };

  useEffect(() => {
    const handleMove = (e: any) => {
      if (!dragRef.current) return;

      const clientX = e.clientX ?? e.touches?.[0]?.clientX;
      const clientY = e.clientY ?? e.touches?.[0]?.clientY;

      if (clientX === undefined || clientY === undefined) return;

      const { id, startX, startY } = dragRef.current;

      const dx = clientX - startX;
      const dy = clientY - startY;

      dragRef.current.startX = clientX;
      dragRef.current.startY = clientY;

      setPages(prev => {
        const next = [...prev];
        const pageIdx = currentPageIndexRef.current;
        const page = next[pageIdx];
        if (!page) return prev;
        
        next[pageIdx] = {
          ...page,
          elements: page.elements.map(el =>
            el.id === id && el.type === 'text'
              ? { ...el, x: el.x + dx, y: el.y + dy }
              : el
          )
        };
        return next;
      });
    };

    const handleEnd = () => {
      if (dragRef.current) {
        setPages(prev => {
            pushToHistory(currentPageIndexRef.current, prev[currentPageIndexRef.current]);
            return prev;
        });
        dragRef.current = null;
      }
    };

    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleEnd);
    window.addEventListener("touchmove", handleMove);
    window.addEventListener("touchend", handleEnd);

    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleEnd);
      window.removeEventListener("touchmove", handleMove);
      window.removeEventListener("touchend", handleEnd);
    };
  }, [pushToHistory]);

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
    if (event.buttons !== 1) return;
    const pos = getPointerPosition(event);

    setIsDrawPanelVisible(false);
    setIsTextPanelVisible(false);

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
            break;
        case 'shape':
            operationStateRef.current = { type: 'shaping', startPoint: pos, currentPoint: pos };
            break;
        case 'text':
            const newTextId = `text_${Date.now()}`;
            const newText: TextElement = {
                id: newTextId,
                type: 'text',
                x: pos.x,
                y: pos.y,
                text: "",
                color: selectedColor,
                fontSize: fontSize,
                fontFamily: fontFamily,
                width: 0,
                height: 0,
                isEditing: true
            };
            setPages(prev => {
                const next = [...prev];
                next[currentPageIndex] = {
                    ...next[currentPageIndex],
                    elements: [...next[currentPageIndex].elements, newText],
                    selectedElementIds: new Set([newTextId])
                };
                return next;
            });
            break;
        case 'erase':
            break;
    }
  }, [getPointerPosition, activeTool, pages, currentPageIndex, selectedColor, fontSize, fontFamily]);

  const handlePointerMove = useCallback((event: React.PointerEvent) => {
    if (event.buttons !== 1) return;
    const pos = getPointerPosition(event);
    const opState = operationStateRef.current;

    if (opState.type === 'drawing') {
        opState.currentPath.push(pos);
        redrawTempCanvas();
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
  }, [getPointerPosition, redrawTempCanvas]);

  const handlePointerUp = useCallback((event: React.PointerEvent) => {
    const opState = operationStateRef.current;
    
    if (opState.type === 'drawing' && opState.currentPath.length > 1) {
        const newPath: PathElement = { type: 'path', id: `path_${Date.now()}`, points: opState.currentPath, color: selectedColor, lineWidth };
        setPages(currentPages => {
            const newPages = [...currentPages];
            const currentPage = newPages[currentPageIndex];
            const newElements = [...currentPage.elements, newPath];

const updatedPage = {
  ...currentPage,
  elements: newElements,
  selectedElementIds: new Set<string>()
};

newPages[currentPageIndex] = updatedPage;
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
                const newElements = [...currentPage.elements];
               const updatedPage = {
  ...currentPage,
  elements: newElements,
  selectedElementIds: new Set<string>()
};
                 pushToHistory(currentPageIndex, updatedPage);
                 return newPages;
             });
        }
    } else if (opState.type === 'lassoing') {

    if (opState.lassoPath.length > 2) {

        const newSelectedIds = new Set<string>();
        const lassoPolygon = opState.lassoPath;

        const lassoBox = getElementBoundingBox({
            type: 'path',
            id: '',
            points: lassoPolygon,
            color: '',
            lineWidth: 1
        });

        pages[currentPageIndex].elements.forEach(element => {

            const elementBox = getElementBoundingBox(element);

            if (!elementBox || (lassoBox && !boxesIntersect(lassoBox, elementBox))) return;

            if (
                isPathElement(element)
                    ? element.points.some(p => isPointInPolygon(p, lassoPolygon))
                    : hasPosition(element) && isPointInPolygon({ x: element.x, y: element.y }, lassoPolygon)
            ) {
                newSelectedIds.add(element.id);
            }

        });   // ✅ CLOSE forEach

        if (newSelectedIds.size > 0) {

            setPages(currentPages => {
                const newPages = [...currentPages];
                newPages[currentPageIndex] = {
                    ...newPages[currentPageIndex],
                    selectedElementIds: newSelectedIds
                };
                return newPages;
            });

            setActiveTool('select');

        }

    }   // ✅ CLOSE lassoPath check
}       // ✅ CLOSE lassoing block

 else if (opState.type === 'dragging') {
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
    
    if (activeTool === 'erase' && opState.type === 'idle') {
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

    operationStateRef.current = { type: 'idle' };
    const tempCtx = tempCanvasRef.current?.getContext('2d');
    if (tempCtx) tempCtx.clearRect(0, 0, tempCtx.canvas.width, tempCtx.canvas.height);

  }, [getPointerPosition, selectedColor, lineWidth, pages, currentPageIndex, activeTool, pushToHistory, selectedShape]);

  const handleClearPage = () => { 
    operationStateRef.current = { type: 'idle' };
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
  
  const handleRecognizeShape = async () => {
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
  
    const recognitionToastId = `recognize-${Date.now()}`;
    toast({
      id: recognitionToastId,
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
      toast.update(recognitionToastId, { variant: "destructive", title: "Canvas Error", description: "Could not create temporary canvas for recognition." });
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
  
        toast.update(recognitionToastId, { title: "Shape Refined!", description: "Your drawing has been transformed." });
      };
      newImg.onerror = () => {
        toast.update(recognitionToastId, { variant: "destructive", title: "Image Load Error", description: "The AI generated an image that could not be loaded." });
      };
      newImg.src = result.refinedImageUri;
    } catch (error) {
      console.error("Shape recognition failed:", error);
      toast.update(recognitionToastId, {
        variant: "destructive",
        title: "Refinement Failed",
        description: error instanceof Error ? error.message : "An unknown error occurred.",
      });
    } finally {
        setRefinePrompt(''); 
    }
  };

  const handleTakeWhiteboardScreenshot = async () => {
    if (isProcessing) return;
    setIsProcessing(true);
    
    const toastId = `screenshot-cap-${Date.now()}`;
    toast({ id: toastId, title: "Capturing Screenshot...", description: "Compositing drawing and text layers..." });

    try {
      const mainCanvas = mainCanvasRef.current;
      if (!mainCanvas) throw new Error("Canvas not found.");

      // Create a composite canvas to combine background, drawing, and text
      const compositeCanvas = document.createElement('canvas');
      compositeCanvas.width = mainCanvas.width;
      compositeCanvas.height = mainCanvas.height;
      const ctx = compositeCanvas.getContext('2d');
      if (!ctx) throw new Error("Could not create composite context.");

      // 1. Fill Background
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, compositeCanvas.width, compositeCanvas.height);

      // 2. Draw Main Canvas content (Paths, Shapes, Images)
      ctx.drawImage(mainCanvas, 0, 0);

      // 3. Draw Text Elements onto the composite
      const currentPage = pages[currentPageIndex];
      currentPage.elements.forEach(el => {
        if (el.type === 'text') {
          ctx.fillStyle = el.color;
          ctx.font = `${el.fontSize}px ${el.fontFamily}`;
          ctx.textBaseline = 'top';
          
          const lines = el.text.split('\n');
          const lineHeight = el.fontSize * 1.2;
          lines.forEach((line, i) => {
            ctx.fillText(line, el.x, el.y + (i * lineHeight));
          });
        }
      });

      const blob = await new Promise<Blob | null>(r => compositeCanvas.toBlob(r, 'image/png'));
      if (!blob) throw new Error("Failed to generate screenshot blob.");

      if (!auth.currentUser) throw new Error("Authentication required to save screenshots.");
      
      const userId = auth.currentUser.uid;
      const fileName = `Whiteboard Screenshot - ${Date.now()}.png`;
      const path = `documents/${userId}/private/${Date.now()}-${fileName}`;
      const fileRef = storageRef(storage, path);
      
      await uploadBytes(fileRef, blob);
      const downloadURL = await getDownloadURL(fileRef);

      await addDoc(collection(db, "documents"), {
          name: fileName,
          lastModified: new Date().toISOString(),
          size: `${(blob.size / 1024 / 1024).toFixed(2)}MB`,
          uploaderId: userId,
          isPrivate: true,
          downloadURL,
          storagePath: path,
          createdAt: serverTimestamp(),
      });
      
      toast({ id: toastId, title: "Screenshot Captured!", description: "Saved to your Private Documents." });

    } catch (error) {
      console.error("Screenshot failed:", error);
      toast({ id: toastId, variant: "destructive", title: "Capture Failed", description: error instanceof Error ? error.message : "An unexpected error occurred." });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleExportToPdf = async (destination: 'private' | 'public') => {
    if (isProcessing) return;
    setIsExportDialogOpen(false);
    setIsProcessing(true);
    setIsPagesPopoverOpen(false);

    const exportToastId = `export-${Date.now()}`;
    toast({
        id: exportToastId,
        title: "Exporting to PDF...",
        description: "Please wait while your whiteboard is being converted.",
        duration: Infinity
    });

    const offscreenCanvas = document.createElement('canvas');
    const mainCanvas = mainCanvasRef.current;
    if (!mainCanvas) {
        toast({ id: exportToastId, variant: "destructive", title: "Export Failed", description: "Canvas element not found." });
        setIsProcessing(false);
        return;
    }

    offscreenCanvas.width = mainCanvas.width;
    offscreenCanvas.height = mainCanvas.height;
    const offscreenCtx = offscreenCanvas.getContext('2d');
    if (!offscreenCtx) {
        toast({ id: exportToastId, variant: "destructive", title: "Export Failed", description: "Could not create offscreen canvas context." });
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
            toast({ id: exportToastId, title: "Exporting to PDF...", description: `Processing page ${i + 1} of ${pages.length}...` });
            
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

        toast({ id: exportToastId, title: "Export Successful!", description: `Your whiteboard has been saved to your ${destination} documents.` });
        
    } catch (error) {
        console.error("PDF Export or Upload Failed:", error);
        toast({ id: exportToastId, variant: "destructive", title: "Export Failed", description: error instanceof Error ? error.message : "An unknown error occurred during export." });
    } finally {
        setIsProcessing(false);
    }
};


  useEffect(() => {
    const newInitialPage = { elements: [], selectedElementIds: new Set() };
    setPages([newInitialPage]);
    pagesHistoryRef.current = [[newInitialPage]];
    pagesHistoryStepRef.current = [0];

    setHeaderContent(
        <div className="flex items-center gap-3">
          <Brush className="h-7 w-7 text-primary" />
          <h1 className="text-xl font-semibold truncate">Whiteboard</h1>
        </div>
    );
    setHeaderAction(
        <div className="flex items-center gap-2">
            {meetingId && (
              <Button asChild variant="outline" size="sm" className="rounded-lg">
                <Link href={`/dashboard/meeting/${meetingId}?topic=${encodeURIComponent(topic || '')}`}>
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
                <DropdownMenuItem
                    onSelect={handleTakeWhiteboardScreenshot}
                    disabled={isProcessing}
                    className="cursor-pointer"
                  >
                    {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Camera className="mr-2 h-4 w-4" />}
                    <span>{isProcessing ? 'Capturing...' : 'Screenshot'}</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => router.push(`/dashboard/settings?highlight=whiteboardSettings&meetingId=${meetingId}&topic=${encodeURIComponent(topic || '')}`)}
                  className="cursor-pointer"
                >
                  <Settings className="mr-2 h-4 w-4" />
                  <span>Whiteboard Settings</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
        </div>
    );

    return () => {
        setHeaderContent(null);
        setHeaderAction(null);
    };
  }, [setHeaderContent, setHeaderAction, meetingId, router, topic, isProcessing]);

  // Handle finalizing text with dimensions
  const finalizeText = useCallback((id: string, width?: number, height?: number) => {
    setPages(prev => {
        const next = [...prev];
        const page = next[currentPageIndex];
        const updatedElements = page.elements.map(el => {
            if (el.id === id && el.type === 'text') {
                if (el.text.trim() === "") return null; // Mark for removal
                return { ...el, isEditing: false, width: width ?? el.width, height: height ?? el.height };
            }
            return el;
        }).filter(Boolean) as WhiteboardElement[];
        
        const updatedPage = { ...page, elements: updatedElements };
        next[currentPageIndex] = updatedPage;
        
        // Push to history after finalization
        pushToHistory(currentPageIndex, updatedPage);
        return next;
    });
  }, [currentPageIndex, pushToHistory]);

  const updateTextValue = useCallback((id: string, text: string) => {
    setPages(prev => {
        const next = [...prev];
        const page = next[currentPageIndex];
        next[currentPageIndex] = {
            ...page,
            elements: page.elements.map(el => (el.id === id && el.type === 'text' ? { ...el, text } : el))
        };
        return next;
    });
  }, [currentPageIndex]);

  return (
    <>
      {isHost && <HostJoinRequestNotification meetingId={meetingId} />}
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
             <ToolButton 
               icon={Sparkles} 
               label="Refine" 
               disabled={!pages[currentPageIndex]?.selectedElementIds || pages[currentPageIndex].selectedElementIds.size === 0}
               onClick={() => {
                 setIsReviewDialogOpen(true);
               }} 
             />
             <ToolButton icon={Eraser} label="Erase" onClick={() => handleNonDrawingToolSelect("erase")} isActive={activeTool === "erase"}/>
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
                    <Button variant="outline" size="icon" className="rounded-lg w-12 h-12 flex flex-col items-center justify-center text-xs" aria-label="Clear Page">
                        <Trash2 className="h-5 w-5 mb-0.5" />
                        <span className="text-[10px] leading-tight">Clear</span>
                    </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="rounded-xl"><AlertDialogHeader><AlertDialogTitle>Clear this page?</AlertDialogTitle><AlertDialogDescription>This will clear the current page. This action cannot be undone.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel className="rounded-lg">Cancel</AlertDialogCancel><AlertDialogAction onClick={handleClearPage} className="rounded-lg">Clear Page</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
             </AlertDialog>
          </div>
        </div>

        <main className="flex-grow flex flex-col overflow-hidden min-h-0 relative">
          <Card className="w-full h-full max-w-full text-center shadow-none rounded-none border-0 flex flex-col overflow-hidden">
            <CardContent className="flex-grow flex items-center justify-center relative p-0 overflow-hidden">
                <canvas ref={mainCanvasRef} className="touch-none w-full h-full block absolute top-0 left-0" style={{ zIndex: 1 }} />
                
                {/* Independent Text Layer */}
                <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 10 }}>
                    {pages[currentPageIndex].elements.map(el => {
                        if (el.type !== 'text') return null;
                        const isSelected = pages[currentPageIndex].selectedElementIds.has(el.id);
                        
                        return (
                            <div 
                                key={el.id}
                                className="absolute pointer-events-auto"
                                style={{
                                    left: el.x,
                                    top: el.y,
                                    color: el.color,
                                    fontSize: `${el.fontSize}px`,
                                    fontFamily: el.fontFamily,
                                    cursor: el.isEditing ? 'text' : 'move',
                                    border: "none",
                                    outline: "none",
                                    boxShadow: "none",
                                    background: "transparent",
                                    userSelect: "none"
                                }}
                                onMouseDown={(e) => !el.isEditing && handleDragStart(e, el.id)}
                                onTouchStart={(e) => !el.isEditing && handleTouchStart(e, el.id)}
                                onPointerDown={(e) => {
                                    e.stopPropagation();
                                    setPages(prev => {
                                        const next = [...prev];
                                        const pageIdx = currentPageIndex;
                                        if (next[pageIdx]) {
                                            next[pageIdx] = {
                                                ...next[pageIdx],
                                                selectedElementIds: new Set([el.id])
                                            };
                                        }
                                        return next;
                                    });
                                }}
                            >
                                {el.isEditing ? (
                                    <textarea
                                        autoFocus
                                        className="bg-transparent border-none outline-none p-0 m-0 resize-none overflow-hidden min-w-[50px] whitespace-pre"
                                        style={{ 
                                            color: 'inherit', 
                                            fontSize: 'inherit', 
                                            fontFamily: 'inherit',
                                            height: 'auto'
                                        }}
                                        value={el.text}
                                        onChange={(e) => updateTextValue(el.id, e.target.value)}
                                        onBlur={(e) => finalizeText(el.id, e.target.offsetWidth, e.target.offsetHeight)}
                                        onKeyDown={(e) => { if(e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); e.currentTarget.blur(); } }}
                                        ref={(ref) => {
                                            if (ref) {
                                                ref.style.height = 'auto';
                                                ref.style.height = `${ref.scrollHeight}px`;
                                                ref.style.width = 'auto';
                                                ref.style.width = `${Math.max(50, ref.scrollWidth)}px`;
                                            }
                                        }}
                                    />
                                ) : (
                                    <div className="relative group p-1 whitespace-pre">
                                        {el.text || <span className="italic opacity-30">Type something...</span>}
                                        
                                        {/* Controls */}
                                        {isSelected && (
                                            <>
                                                <button 
                                                    className="absolute -top-6 -right-6 p-1.5 bg-destructive text-white rounded-full shadow-lg z-20 hover:scale-110 transition-transform"
                                                    onClick={(e) => { e.stopPropagation(); handleDeleteSelected(); }}
                                                >
                                                    <X className="h-3 w-3" />
                                                </button>
                                                <button 
                                                    className="absolute -bottom-6 -left-6 p-1.5 bg-primary text-white rounded-full shadow-lg z-20 hover:scale-110 transition-transform"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setPages(prev => {
                                                            const next = [...prev];
                                                            next[currentPageIndex] = {
                                                                ...next[currentPageIndex],
                                                                elements: next[currentPageIndex].elements.map(item => item.id === el.id ? { ...item, isEditing: true } : item)
                                                            };
                                                            return next;
                                                        });
                                                    }}
                                                >
                                                    <Pencil className="h-3 w-3" />
                                                </button>
                                            </>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

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
              <Button type="button" variant="ghost" className="rounded-lg" disabled={isProcessing}>Cancel</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Review Dialog */}
      <Dialog open={isReviewDialogOpen} onOpenChange={setIsReviewDialogOpen}>
          <DialogContent className="sm:max-w-md rounded-2xl p-6 overflow-hidden border-none shadow-2xl">
              <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-primary via-accent to-primary" />
              <DialogHeader className="space-y-3 pt-4">
                  <div className="mx-auto bg-primary/10 w-20 h-20 rounded-full flex items-center justify-center mb-2 shadow-inner">
                      <Star className="h-10 w-10 text-primary fill-primary animate-pulse" />
                  </div>
                  <ShadDialogTitle className="text-2xl font-bold text-center">Enjoying TeachMeet?</ShadDialogTitle>
                  <DialogDescription className="text-center text-base leading-relaxed">
                      The <span className="font-bold text-primary">AI Refinement</span> feature is currently under development. 🏗️
                      <br /><br />
                      While we work on it, would you mind taking a moment to support us with a review on the Play Store?
                  </DialogDescription>
              </DialogHeader>
              <div className="flex flex-col sm:flex-row gap-3 mt-8">
                  <Button variant="outline" onClick={() => setIsReviewDialogOpen(false)} className="flex-1 rounded-xl h-12 text-muted-foreground font-semibold border-muted-foreground/20 hover:bg-muted/50">
                      Maybe Later
                  </Button>
                  <Button 
                      onClick={() => {
                          window.open('https://play.google.com/store/apps/details?id=com.teachmeet.3d', '_blank');
                          setIsReviewDialogOpen(false);
                      }} 
                      className="flex-1 btn-gel rounded-xl h-12 text-lg font-bold shadow-lg hover:shadow-primary/30"
                  >
                      Yes, I'll Review!
                  </Button>
              </div>
          </DialogContent>
      </Dialog>
    </>
  );
}
