
'use client';

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Brush, Minus, Type, Eraser, MousePointer2, Wand2, Trash2, Palette, Circle as CircleIcon, Square as SquareIcon, Edit3 } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect, useRef, useCallback } from "react";
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

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const contextRef = useRef<CanvasRenderingContext2D | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [lastPosition, setLastPosition] = useState<{ x: number, y: number } | null>(null);
  const [shapeStartPoint, setShapeStartPoint] = useState<{ x: number, y: number } | null>(null);


  const availableColors = [
    "#000000", "#EF4444", "#F97316", "#EAB308", "#22C55E", "#0EA5E9", "#6366F1", "#EC4899",
    "#FFFFFF", "#DC2626", "#EA580C", "#D97706", "#16A34A", "#0284C7", "#4F46E5", "#DB2777"
  ];

  const brushSizes = [
    { name: 'small', icon: CircleIcon, label: 'Small Brush', lineWidth: 2 },
    { name: 'medium', icon: SquareIcon, label: 'Medium Brush', lineWidth: 5 },
    { name: 'large', icon: SquareIcon, label: 'Large Brush', lineWidth: 10 },
  ];

  const getLineWidth = useCallback(() => {
    return brushSizes.find(b => b.name === selectedBrushSize)?.lineWidth || 5;
  }, [selectedBrushSize, brushSizes]);

  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (canvas && canvas.parentElement) {
      const imageData = contextRef.current?.getImageData(0, 0, canvas.width, canvas.height);
      
      let availableHeight = canvas.parentElement.clientHeight;
      
      canvas.width = canvas.parentElement.clientWidth;
      canvas.height = availableHeight;

      if (contextRef.current) {
        contextRef.current.lineCap = "round";
        contextRef.current.lineJoin = "round";
        contextRef.current.strokeStyle = selectedColor;
        contextRef.current.lineWidth = getLineWidth();
        if (imageData) {
          // Temporarily set to source-over for clearing and redrawing
          const currentComposite = contextRef.current.globalCompositeOperation;
          contextRef.current.globalCompositeOperation = 'source-over';
          contextRef.current.clearRect(0, 0, canvas.width, canvas.height);
          contextRef.current.putImageData(imageData, 0, 0);
          contextRef.current.globalCompositeOperation = currentComposite; // Restore
        }
      }
    }
  }, [selectedColor, getLineWidth]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      const context = canvas.getContext("2d");
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
      // Reset composite operation if tool changes away from eraser
      if (activeTool !== 'erase') {
        contextRef.current.globalCompositeOperation = 'source-over';
      }
    }
  }, [selectedColor, selectedBrushSize, getLineWidth, activeTool]);

  const getMousePosition = (event: React.MouseEvent | React.TouchEvent): { x: number, y: number } | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    let clientX, clientY;
    if ('clientX' in event.nativeEvent) { // MouseEvent
        clientX = event.nativeEvent.clientX;
        clientY = event.nativeEvent.clientY;
    } else if ('touches' in event.nativeEvent && event.nativeEvent.touches.length > 0) { // TouchEvent
        clientX = event.nativeEvent.touches[0].clientX;
        clientY = event.nativeEvent.touches[0].clientY;
    } else {
        return null;
    }
    return {
        x: clientX - rect.left,
        y: clientY - rect.top
    };
  };

  const startDrawing = (event: React.MouseEvent | React.TouchEvent) => {
    if (!contextRef.current || !activeTool) return;
    const pos = getMousePosition(event);
    if (!pos) return;

    setIsDrawing(true);
    setLastPosition(pos); 
    
    contextRef.current.beginPath();
    contextRef.current.moveTo(pos.x, pos.y);

    if (activeTool === 'erase') {
      contextRef.current.globalCompositeOperation = 'destination-out';
      contextRef.current.lineWidth = getLineWidth(); // Eraser uses current brush size
    } else {
      contextRef.current.globalCompositeOperation = 'source-over';
      contextRef.current.strokeStyle = selectedColor;
      contextRef.current.lineWidth = getLineWidth();
    }
    
    if (['line', 'circle', 'square'].includes(activeTool)) {
      setShapeStartPoint(pos);
    }
  };

  const draw = (event: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || !contextRef.current || !lastPosition || !activeTool) return;
    const pos = getMousePosition(event);
    if (!pos) return;
    
    if (activeTool === 'draw' || activeTool === 'erase') {
      contextRef.current.lineTo(pos.x, pos.y);
      contextRef.current.stroke();
      setLastPosition(pos);
    }
  };

  const stopDrawing = (event: React.MouseEvent | React.TouchEvent) => {
    if (!contextRef.current || !isDrawing || !activeTool) return;
    const pos = getMousePosition(event); 
    
    if (contextRef.current) { // Ensure context is still valid
        contextRef.current.closePath();
    }
    
    if (shapeStartPoint && pos && contextRef.current && ['line', 'circle', 'square'].includes(activeTool)) {
      contextRef.current.globalCompositeOperation = 'source-over'; 
      contextRef.current.strokeStyle = selectedColor;
      contextRef.current.lineWidth = getLineWidth();
      const start = shapeStartPoint;
      const end = pos;
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
      }
      contextRef.current.stroke();
      contextRef.current.closePath();
    }

    if (activeTool === 'erase' && contextRef.current) {
      contextRef.current.globalCompositeOperation = 'source-over';
    }

    setIsDrawing(false);
    setLastPosition(null);
    setShapeStartPoint(null);
  };

  const drawingTools = ['draw', 'line', 'circle', 'square'];

  const handleToolClick = (toolName: string) => {
    const toolId = toolName.toLowerCase().replace(/\s+/g, '');
    
    if (activeTool === toolId && (drawingTools.includes(toolId) || toolId === 'draw' || toolId === 'erase')) {
        setShowDrawingToolOptions(prev => !prev);
    } else {
        setActiveTool(toolId);
        setIsDrawing(false); 
        if (drawingTools.includes(toolId) || toolId === 'draw' || toolId === 'erase') {
            setShowDrawingToolOptions(true); 
        } else {
            setShowDrawingToolOptions(false); 
        }

        if (!drawingTools.includes(toolId) && toolId !== 'text' && toolId !== 'select' && toolId !== 'clear' && toolId !== 'erase') {
            toast({
            title: `${toolName} Selected`,
            description: `The ${toolName.toLowerCase()} feature is currently under development.`,
            duration: 3000,
            });
        }
    }
     if (toolId !== 'erase' && contextRef.current) {
        contextRef.current.globalCompositeOperation = 'source-over';
    }
  };

  const handleColorSelect = (color: string) => {
    setSelectedColor(color);
    toast({ title: "Color Selected", description: `Drawing color set to ${color}`, duration: 2000 });
  };

  const handleBrushSizeSelect = (size: string) => {
    setSelectedBrushSize(size);
    toast({ title: "Brush Size Selected", description: `Brush size set to ${size}`, duration: 2000 });
  };

  useEffect(() => {
    if (activeTool === "text" && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [activeTool]);

  const handleClearAll = () => {
    if (contextRef.current && canvasRef.current) {
      contextRef.current.globalCompositeOperation = 'source-over';
      contextRef.current.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    }
    setTextToolInput("");
    toast({
      title: "Whiteboard Cleared",
      description: "The canvas has been cleared.",
      duration: 3000,
    });
  }
  
  const topToolbarOffset = 65; 
  const mainToolsToolbarOffset = 58; 
  const drawingOptionsToolbarOffset = showDrawingToolOptions ? 106 : 0; 
  const totalOffset = topToolbarOffset + mainToolsToolbarOffset + drawingOptionsToolbarOffset;

  const currentActiveToolIsDrawingTool = activeTool && (drawingTools.includes(activeTool) || activeTool === 'draw' || activeTool === 'erase');

  return (
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
          <ToolButton icon={Brush} label="Draw" onClick={() => handleToolClick("Draw")} isActive={activeTool !== 'erase' && currentActiveToolIsDrawingTool} />
          <ToolButton icon={Wand2} label="Assist" onClick={() => handleToolClick("Shape Assist")} isActive={activeTool === "shapeassist"} />
          <ToolButton icon={Type} label="Text" onClick={() => handleToolClick("Text")} isActive={activeTool === "text"} />
          <ToolButton icon={Eraser} label="Erase" onClick={() => handleToolClick("Erase")} isActive={activeTool === "erase"} />
          <ToolButton icon={Trash2} label="Clear" onClick={handleClearAll} />
        </div>
      </div>

      {showDrawingToolOptions && currentActiveToolIsDrawingTool && (
        <div className="flex-none p-2 border-b bg-muted/50 shadow-sm sticky top-[calc(65px+58px)] z-10">
          <div className="container mx-auto">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-center justify-center">
              <div className="flex flex-wrap justify-center sm:justify-start gap-2 items-center col-span-1 sm:col-span-2">
                <span className="text-xs font-medium text-muted-foreground mr-2 sm:hidden md:inline">Color:</span>
                {availableColors.map(color => (
                  <ColorSwatch
                    key={color}
                    color={color}
                    onClick={() => handleColorSelect(color)}
                    isSelected={selectedColor === color}
                  />
                ))}
              </div>
              <div className="flex flex-col sm:flex-row items-center justify-center sm:justify-end gap-4">
                <div className="flex items-center justify-center gap-2">
                    <span className="text-xs font-medium text-muted-foreground mr-1">Size:</span>
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
                <div className="flex items-center justify-center gap-2">
                    <span className="text-xs font-medium text-muted-foreground mr-1">Shape:</span>
                    <ToolButton icon={Edit3} label="Freehand" onClick={() => handleToolClick("Draw")} isActive={activeTool === "draw"} />
                    <ToolButton icon={Minus} label="Line" onClick={() => handleToolClick("Line")} isActive={activeTool === "line"} />
                    <ToolButton icon={CircleIcon} label="Circle" onClick={() => handleToolClick("Circle")} isActive={activeTool === "circle"} />
                    <ToolButton icon={SquareIcon} label="Square" onClick={() => handleToolClick("Square")} isActive={activeTool === "square"} />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <main className={cn(
        "flex-grow flex items-center justify-center",
      )} style={{ paddingTop: `${totalOffset}px` }}>
        <Card className="w-full h-full max-w-full text-center shadow-xl rounded-xl border-border/50 overflow-hidden flex flex-col">
          <CardHeader className="flex-none">
            <CardTitle className="text-xl">TeachMeet Whiteboard</CardTitle>
            <CardDescription>
              Meeting ID: {meetingId || "N/A"} - Draw, write, and collaborate!
              {currentActiveToolIsDrawingTool && (
                <span className="block text-xs mt-1">
                  Tool: {activeTool?.charAt(0).toUpperCase() + activeTool?.slice(1)} | 
                  {activeTool !== 'erase' && <>Color: <span style={{ display: 'inline-block', width: '12px', height: '12px', borderRadius: '50%', backgroundColor: selectedColor, border: '1px solid #ccc', verticalAlign: 'middle' }}></span> |</>}
                  Size: {selectedBrushSize}
                </span>
              )}
               {(!activeTool || (!currentActiveToolIsDrawingTool && activeTool !== 'text')) &&  (
                <span className="block text-xs mt-1 text-muted-foreground">Select a tool to begin.</span>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex-grow bg-card flex items-center justify-center relative p-0">
            <canvas
              ref={canvasRef}
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing} 
              onTouchStart={(e) => { e.preventDefault(); startDrawing(e);}}
              onTouchMove={(e) => { e.preventDefault(); draw(e);}}
              onTouchEnd={(e) => { e.preventDefault(); stopDrawing(e);}}
              className="bg-white dark:bg-muted/20 rounded-md border-2 border-dashed border-border/30 cursor-crosshair touch-none w-full h-full block"
            />
            {activeTool === 'text' && (
              <Textarea
                ref={textareaRef}
                value={textToolInput}
                onChange={(e) => setTextToolInput(e.target.value)}
                placeholder="Type here..."
                className="absolute inset-0 w-full h-full z-10 rounded-lg shadow-xl border-primary resize-none p-4 text-base"
              />
            )}
             {(!activeTool || (!currentActiveToolIsDrawingTool && activeTool !== 'text')) && !isDrawing && (
                 <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <p className="text-muted-foreground text-lg p-4 bg-background/50 rounded-md">
                        Interactive canvas area - Select a tool to begin.
                    </p>
                 </div>
             )}
          </CardContent>
        </Card>
      </main>
      <footer className="flex-none p-3 text-center text-xs text-muted-foreground border-t bg-background">
        TeachMeet Whiteboard - Basic drawing and shape tools enabled. Other features under development.
      </footer>
    </div>
  );
}

