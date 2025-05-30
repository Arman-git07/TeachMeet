
'use client';

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
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
import { ArrowLeft, Brush, Minus, Type, Eraser, MousePointer2, Wand2, Trash2, Circle as CircleIcon, Square as SquareIconShape, Edit3, ArrowRight, Triangle as TriangleIcon } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import React, { useState, useEffect, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";

const ToolButton = ({ icon: Icon, label, onClick, isActive = false }: { icon: React.ElementType, label: string, onClick: () => void, isActive?: boolean }) => (
  <Button
    variant={isActive ? "default" : "outline"}
    size="icon"
    className="rounded-lg w-12 h-12 flex flex-col items-center justify-center text-xs"
    onClick={onClick}
    aria-label={label}
  >
    <Icon className="h-5 w-5 mb-0.5" />
  </Button>
);

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

const drawingTools = ['draw', 'line', 'circle', 'square', 'arrow', 'triangle'];

export default function WhiteboardPage() {
  const params = useParams();
  const meetingId = params.meetingId as string;
  const { toast } = useToast();

  const [activeTool, setActiveTool] = useState<string | null>(null);
  const [textToolInput, setTextToolInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [selectedColor, setSelectedColor] = useState<string>("#000000");
  const [selectedBrushSize, setSelectedBrushSize] = useState<string>("medium");
  const [showDrawingToolOptions, setShowDrawingToolOptions] = useState<boolean>(false);
  const [showClearConfirmDialog, setShowClearConfirmDialog] = useState<boolean>(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const contextRef = useRef<CanvasRenderingContext2D | null>(null);

  const isDrawingRef = useRef(false);
  const lastPositionRef = useRef<{ x: number, y: number } | null>(null);
  const shapeStartPointRef = useRef<{ x: number, y: number } | null>(null);

  const availableColors = [
    "#000000", "#EF4444", "#F97316", "#EAB308", "#22C55E", "#0EA5E9", "#6366F1", "#EC4899",
    "#A855F7", "#8B5CF6", "#3B82F6", "#10B981", "#F59E0B", "#D946EF", "#78716C", "#FFFFFF"
  ];

  const brushSizes = [
    { name: 'small', icon: CircleIcon, label: 'Small Brush', lineWidth: 2 },
    { name: 'medium', icon: CircleIcon, label: 'Medium Brush', lineWidth: 5 },
    { name: 'large', icon: CircleIcon, label: 'Large Brush', lineWidth: 10 },
  ];

  const getLineWidth = useCallback(() => {
    return brushSizes.find(b => b.name === selectedBrushSize)?.lineWidth || 5;
  }, [selectedBrushSize]);

  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (canvas && canvas.parentElement) {
      const context = contextRef.current;
      let imageData: ImageData | undefined;
      if (context) {
        try {
          if (canvas.width > 0 && canvas.height > 0) {
            imageData = context.getImageData(0, 0, canvas.width, canvas.height);
          }
        } catch (e) {
          console.error("Error getting imageData during resize:", e);
        }
      }

      canvas.width = canvas.parentElement.clientWidth;
      canvas.height = canvas.parentElement.clientHeight;

      if (context) {
        context.lineCap = "round";
        context.lineJoin = "round";
        context.strokeStyle = selectedColor;
        context.lineWidth = getLineWidth();
        if (activeTool === 'erase') {
          context.globalCompositeOperation = 'destination-out';
        } else {
          context.globalCompositeOperation = 'source-over';
        }

        if (imageData) {
          try {
            context.putImageData(imageData, 0, 0);
          } catch (e) {
            console.error("Error putting imageData during resize:", e);
          }
        }
      }
    }
  }, [selectedColor, getLineWidth, activeTool]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      const context = canvas.getContext("2d", { willReadFrequently: true }); // willReadFrequently for getImageData performance
      if (context) {
        contextRef.current = context;
        resizeCanvas();
      }
    }
    window.addEventListener("resize", resizeCanvas);
    return () => window.removeEventListener("resize", resizeCanvas);
  }, [resizeCanvas]);

  useEffect(() => {
    if (contextRef.current) {
      contextRef.current.strokeStyle = selectedColor;
      contextRef.current.lineWidth = getLineWidth();
      if (activeTool === 'erase') {
        contextRef.current.globalCompositeOperation = 'destination-out';
      } else {
        contextRef.current.globalCompositeOperation = 'source-over';
      }
    }
  }, [selectedColor, selectedBrushSize, getLineWidth, activeTool]);

  const getPointerPosition = useCallback((event: MouseEvent | TouchEvent | React.MouseEvent | React.TouchEvent): { x: number, y: number } | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    let clientX, clientY;

    if (event instanceof TouchEvent || (event as React.TouchEvent).nativeEvent instanceof TouchEvent) {
      clientX = (event as TouchEvent).touches?.[0]?.clientX ?? (event as React.TouchEvent).nativeEvent.touches[0].clientX;
      clientY = (event as TouchEvent).touches?.[0]?.clientY ?? (event as React.TouchEvent).nativeEvent.touches[0].clientY;
    } else if (event instanceof MouseEvent || (event as React.MouseEvent).nativeEvent instanceof MouseEvent) {
      clientX = (event as MouseEvent).clientX ?? (event as React.MouseEvent).nativeEvent.clientX;
      clientY = (event as MouseEvent).clientY ?? (event as React.MouseEvent).nativeEvent.clientY;
    } else {
      console.warn("Could not determine pointer position from event:", event);
      return null;
    }
    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  }, []);

  const startDrawingInternal = useCallback((pos: { x: number, y: number }) => {
    if (!contextRef.current || !activeTool) return;

    isDrawingRef.current = true;
    lastPositionRef.current = pos;
    shapeStartPointRef.current = pos;

    contextRef.current.beginPath();
    contextRef.current.moveTo(pos.x, pos.y);

    if (activeTool === 'erase') {
      contextRef.current.globalCompositeOperation = 'destination-out';
      contextRef.current.lineWidth = getLineWidth();
    } else {
      contextRef.current.globalCompositeOperation = 'source-over';
      contextRef.current.strokeStyle = selectedColor;
      contextRef.current.lineWidth = getLineWidth();
    }
  }, [activeTool, selectedColor, getLineWidth]);

  const drawInternal = useCallback((pos: { x: number, y: number }) => {
    if (!contextRef.current || !lastPositionRef.current || !activeTool || !isDrawingRef.current) return;

    if (activeTool === 'draw' || activeTool === 'erase') {
      contextRef.current.lineTo(pos.x, pos.y);
      contextRef.current.stroke();
      lastPositionRef.current = pos;
    }
  }, [activeTool]);

  const stopDrawingInternal = useCallback((pos?: { x: number, y: number }) => {
    if (!contextRef.current || !isDrawingRef.current) return;

    const finalPos = pos || lastPositionRef.current;

    if (shapeStartPointRef.current && finalPos && activeTool && drawingTools.includes(activeTool) && activeTool !== 'draw') {
      contextRef.current.globalCompositeOperation = 'source-over';
      contextRef.current.strokeStyle = selectedColor;
      contextRef.current.lineWidth = getLineWidth();

      const start = shapeStartPointRef.current;
      const end = finalPos;
      contextRef.current.beginPath();
      if (activeTool === 'line') {
        contextRef.current.moveTo(start.x, start.y);
        contextRef.current.lineTo(end.x, end.y);
      } else if (activeTool === 'square') {
        contextRef.current.rect(start.x, start.y, end.x - start.x, end.y - start.y);
      } else if (activeTool === 'circle') {
        const dx = end.x - start.x;
        const dy = end.y - start.y;
        const radius = Math.sqrt(dx * dx + dy * dy) / 2;
        const centerX = start.x + dx / 2;
        const centerY = start.y + dy / 2;
        contextRef.current.arc(centerX, centerY, Math.abs(radius), 0, 2 * Math.PI);
      } else if (activeTool === 'arrow') {
        contextRef.current.moveTo(start.x, start.y);
        contextRef.current.lineTo(end.x, end.y);
        const headlen = 10 + getLineWidth();
        const angle = Math.atan2(end.y - start.y, end.x - start.x);
        contextRef.current.lineTo(end.x - headlen * Math.cos(angle - Math.PI / 6), end.y - headlen * Math.sin(angle - Math.PI / 6));
        contextRef.current.moveTo(end.x, end.y);
        contextRef.current.lineTo(end.x - headlen * Math.cos(angle + Math.PI / 6), end.y - headlen * Math.sin(angle + Math.PI / 6));
      } else if (activeTool === 'triangle') {
        const p1 = { x: start.x + (end.x - start.x) / 2, y: start.y };
        const p2 = { x: start.x, y: end.y };
        const p3 = { x: end.x, y: end.y };
        contextRef.current.moveTo(p1.x, p1.y);
        contextRef.current.lineTo(p2.x, p2.y);
        contextRef.current.lineTo(p3.x, p3.y);
        contextRef.current.closePath();
      }
      contextRef.current.stroke();
    }

    if (activeTool === 'erase') {
      contextRef.current.globalCompositeOperation = 'source-over';
    }

    isDrawingRef.current = false;
    lastPositionRef.current = null;
    shapeStartPointRef.current = null;
  }, [activeTool, selectedColor, getLineWidth]);
  
  const handlePointerMove = useCallback((event: MouseEvent | TouchEvent) => {
    if (!isDrawingRef.current) return;
    if (event instanceof TouchEvent || (event.type === 'touchmove')) event.preventDefault();
    const pos = getPointerPosition(event);
    if (!pos) return;
    drawInternal(pos);
  }, [getPointerPosition, drawInternal]);

  const handlePointerUp = useCallback((event: MouseEvent | TouchEvent) => {
    if (!isDrawingRef.current) return;
    const pos = getPointerPosition(event);
    stopDrawingInternal(pos || undefined);
    window.removeEventListener('touchmove', handlePointerMove);
    window.removeEventListener('touchend', handlePointerUp);
    window.removeEventListener('touchcancel', handlePointerUp);
    window.removeEventListener('mousemove', handlePointerMove);
    window.removeEventListener('mouseup', handlePointerUp);
  }, [getPointerPosition, stopDrawingInternal, handlePointerMove]);

  const handleCanvasPointerDown = useCallback((event: React.MouseEvent | React.TouchEvent) => {
    if ((event as React.MouseEvent).nativeEvent instanceof MouseEvent && (event as React.MouseEvent).nativeEvent.button !== 0) return;
    if (!contextRef.current || !activeTool) return;
    if (activeTool === 'select' || activeTool === 'text') return;
    if (event.type === 'touchstart') event.preventDefault();

    const pos = getPointerPosition(event);
    if (!pos) return;

    startDrawingInternal(pos);

    if (event.type.startsWith('touch')) {
      window.addEventListener('touchmove', handlePointerMove, { passive: false });
      window.addEventListener('touchend', handlePointerUp);
      window.addEventListener('touchcancel', handlePointerUp);
    } else {
      window.addEventListener('mousemove', handlePointerMove);
      window.addEventListener('mouseup', handlePointerUp);
    }
  }, [activeTool, getPointerPosition, startDrawingInternal, handlePointerMove, handlePointerUp]);
  
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
    const isAnyDrawingTool = drawingTools.includes(toolId) || toolId === 'erase';

    if (activeTool === toolId && isAnyDrawingTool) {
      setShowDrawingToolOptions(prev => !prev);
    } else {
      setActiveTool(toolId);
      if (isAnyDrawingTool) {
        setShowDrawingToolOptions(true);
      } else {
        setShowDrawingToolOptions(false);
      }

      if (!isAnyDrawingTool && toolId !== 'text' && toolId !== 'select' && toolId !== 'clear') {
        // toast({ // Keep toast for non-drawing tools for now
        //   title: `${toolName} Selected`,
        //   description: `The ${toolName.toLowerCase()} feature is currently under development.`,
        //   duration: 3000,
        // });
      }
    }
  };

  const handleColorSelect = (color: string) => {
    setSelectedColor(color);
    // toast({ title: "Color Selected", description: `Drawing color set to ${color}` });
  };

  const handleBrushSizeSelect = (size: string) => {
    setSelectedBrushSize(size);
    // toast({ title: "Brush Size Selected", description: `Brush size set to ${size}` });
  };

  useEffect(() => {
    if (activeTool === "text" && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [activeTool]);

  const handleConfirmClearAll = () => {
    if (contextRef.current && canvasRef.current) {
      contextRef.current.globalCompositeOperation = 'source-over';
      contextRef.current.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    }
    setTextToolInput("");
    setShowClearConfirmDialog(false);
  };

  const topToolbarOffset = 65;
  const mainToolsToolbarOffset = 58; 
  const drawingOptionsToolbarOffset = showDrawingToolOptions ? 150 : 0;
  const totalOffset = topToolbarOffset + mainToolsToolbarOffset + drawingOptionsToolbarOffset;

  const currentIsDrawingRelatedToolActive = activeTool && (drawingTools.includes(activeTool) || activeTool === 'erase');
  const mainDrawToolIsActive = activeTool && drawingTools.includes(activeTool) && activeTool !== 'erase';
  const activeToolDisplayName = activeTool ? activeTool.charAt(0).toUpperCase() + activeTool.slice(1) : 'None';

  return (
    <>
      <div className="flex flex-col h-screen bg-muted/30">
        <header className="flex-none p-3 border-b bg-background shadow-sm sticky top-0 z-20">
          <div className="container mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Wand2 className="h-7 w-7 text-primary" />
              <h1 className="text-xl font-semibold text-foreground">
                TeachMeet Whiteboard
              </h1>
            </div>
            {meetingId && (
              <Link href={`/dashboard/meeting/${meetingId}`} passHref legacyBehavior>
                <Button variant="outline" className="rounded-lg">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to Meeting
                </Button>
              </Link>
            )}
          </div>
        </header>

        <div className="flex-none p-2 border-b bg-background shadow-md sticky top-[65px] z-10">
          <div className="container mx-auto flex flex-wrap items-center justify-center gap-2">
            <ToolButton icon={MousePointer2} label="Select" onClick={() => handleToolClick("Select")} isActive={activeTool === "select"} />
            <ToolButton
              icon={Brush}
              label="Draw"
              onClick={() => handleToolClick(activeTool === "draw" || drawingTools.includes(activeTool || "") && activeTool !== "erase" ? (activeTool || "draw") : "draw")}
              isActive={mainDrawToolIsActive || activeTool === 'draw'}
            />
            <ToolButton icon={Wand2} label="Assist" onClick={() => handleToolClick("Shape Assist")} isActive={activeTool === "shapeassist"} />
            <ToolButton icon={Type} label="Text" onClick={() => handleToolClick("Text")} isActive={activeTool === "text"} />
            <ToolButton icon={Eraser} label="Erase" onClick={() => handleToolClick("Erase")} isActive={activeTool === "erase"} />
            <ToolButton icon={Trash2} label="Clear" onClick={() => setShowClearConfirmDialog(true)} />
          </div>
        </div>

        {showDrawingToolOptions && currentIsDrawingRelatedToolActive && (
          <div className="flex-none p-3 border-b bg-muted/50 shadow-sm sticky top-[calc(65px+58px)] z-10">
            <div className="container mx-auto">
              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                {activeTool !== 'erase' && (
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
                )}
                <div className="flex flex-col items-center md:items-start gap-2">
                    <span className="text-xs font-medium text-muted-foreground">Size:</span>
                    <div className="flex items-center justify-center gap-2">
                    {brushSizes.map(brush => (
                        <Button
                            key={brush.name}
                            variant={selectedBrushSize === brush.name ? "default" : "outline"}
                            size="icon"
                            className="rounded-lg w-10 h-10"
                            onClick={() => handleBrushSizeSelect(brush.name)}
                            aria-label={brush.label}
                        >
                            <brush.icon className={cn("h-5 w-5", brush.name === 'small' && 'h-3 w-3', brush.name === 'large' && 'h-6 w-6')} />
                        </Button>
                    ))}
                    </div>
                </div>
                 {activeTool !== 'erase' && (
                    <div className="flex flex-col items-center md:items-start gap-2">
                        <span className="text-xs font-medium text-muted-foreground">Shape:</span>
                        <div className="flex items-center justify-center gap-2 flex-wrap">
                            <ToolButton icon={Edit3} label="Freehand" onClick={() => {setActiveTool("draw");}} isActive={activeTool === "draw"} />
                            <ToolButton icon={Minus} label="Line" onClick={() => {setActiveTool("line");}} isActive={activeTool === "line"} />
                            <ToolButton icon={ArrowRight} label="Arrow" onClick={() => {setActiveTool("arrow");}} isActive={activeTool === "arrow"} />
                            <ToolButton icon={CircleIcon} label="Circle" onClick={() => {setActiveTool("circle");}} isActive={activeTool === "circle"} />
                            <ToolButton icon={SquareIconShape} label="Square" onClick={() => {setActiveTool("square");}} isActive={activeTool === "square"} />
                            <ToolButton icon={TriangleIcon} label="Triangle" onClick={() => {setActiveTool("triangle");}} isActive={activeTool === "triangle"} />
                        </div>
                    </div>
                 )}
              </div>
            </div>
          </div>
        )}

        <main className="flex-grow" style={{ paddingTop: `${totalOffset}px` }}>
          <Card className="w-full h-full max-w-full text-center shadow-xl rounded-xl border-border/50 overflow-hidden flex flex-col">
            <CardHeader className="flex-none py-3 space-y-0.5"> {/* Reduced padding and spacing */}
              <CardTitle className="text-lg">TeachMeet Whiteboard</CardTitle> {/* Reduced title size */}
              <CardDescription className="text-xs">
                Meeting ID: {meetingId || "N/A"}
                {currentIsDrawingRelatedToolActive && (
                  <span className="block text-xs mt-1">
                    Tool: {activeToolDisplayName} |
                    {activeTool !== 'erase' && <> Color: <span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%', backgroundColor: selectedColor, border: '1px solid #ccc', verticalAlign: 'middle' }}></span> |</>}
                    Size: {selectedBrushSize}
                  </span>
                )}
                {(!activeTool || (!currentIsDrawingRelatedToolActive && activeTool !== 'text')) && (
                  <span className="block text-xs mt-1 text-muted-foreground">Select a tool to begin.</span>
                )}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-grow bg-card flex items-center justify-center relative p-0">
              <canvas
                ref={canvasRef}
                onMouseDown={handleCanvasPointerDown}
                onTouchStart={(e) => { e.preventDefault(); handleCanvasPointerDown(e); }}
                className="bg-white dark:bg-muted/20 border-2 border-dashed border-border/30 cursor-crosshair touch-none w-full h-full block" 
              />
              {activeTool === 'text' && (
                <Textarea
                  ref={textareaRef}
                  value={textToolInput}
                  onChange={(e) => setTextToolInput(e.target.value)}
                  placeholder="Type here..."
                  className="absolute inset-0 w-full h-full z-10 rounded-lg shadow-xl border-primary resize-none p-4 text-base bg-background/80"
                />
              )}
              {(!activeTool || (!currentIsDrawingRelatedToolActive && activeTool !== 'text')) && !isDrawingRef.current && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <p className="text-muted-foreground text-base p-3 bg-background/50 rounded-md backdrop-blur-sm">
                    Interactive canvas area - Select a tool to begin.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </main>
        <footer className="flex-none p-2 text-center text-xs text-muted-foreground border-t bg-background">
          TeachMeet Whiteboard - Basic drawing and shape tools enabled.
        </footer>
      </div>

      <AlertDialog open={showClearConfirmDialog} onOpenChange={setShowClearConfirmDialog}>
        <AlertDialogContent className="rounded-xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will clear the entire whiteboard. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowClearConfirmDialog(false)} className="rounded-lg">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmClearAll} className="rounded-lg">Clear Whiteboard</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

