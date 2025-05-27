
'use client';

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Brush, Minus, Type, Eraser, MousePointer2, Wand2, Trash2, Palette, Circle, Square, MinusSquare } from "lucide-react"; // Added Circle, Square, MinusSquare
import Link from "next/link";
import { useParams } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect, useRef } from "react";
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

  const [selectedColor, setSelectedColor] = useState<string>("#000000"); // Default to black
  const [selectedBrushSize, setSelectedBrushSize] = useState<string>("medium"); // 'small', 'medium', 'large'
  const [showDrawOptions, setShowDrawOptions] = useState<boolean>(false);

  const availableColors = [
    "#000000", "#EF4444", "#F97316", "#EAB308", "#22C55E", "#0EA5E9", "#6366F1", "#EC4899",
    "#FFFFFF", "#DC2626", "#EA580C", "#D97706", "#16A34A", "#0284C7", "#4F46E5", "#DB2777"
  ];

  const brushSizes = [
    { name: 'small', icon: Circle, label: 'Small Brush' },
    { name: 'medium', icon: MinusSquare, label: 'Medium Brush' }, // Using MinusSquare for a medium circle representation
    { name: 'large', icon: Square, label: 'Large Brush' }, // Using Square for a large circle representation
  ];


  const handleToolClick = (toolName: string) => {
    const toolId = toolName.toLowerCase().replace(/\s+/g, '');

    if (activeTool === toolId) {
      // If the same tool is clicked again
      if (toolId === 'draw') {
        setShowDrawOptions(prev => !prev); // Toggle draw options
      } else {
        // For other tools, clicking again might deactivate them or do nothing
        // For simplicity, let's allow deactivation for now.
        // setActiveTool(null);
        // toast({ title: `${toolName} Tool Deactivated`, duration: 2000 });
      }
    } else {
      // Switching to a new tool
      setActiveTool(toolId);
      if (toolId === 'draw') {
        setShowDrawOptions(true); // Show draw options when draw tool is first activated
      } else {
        setShowDrawOptions(false); // Hide draw options for other tools
      }
      toast({
        title: `${toolName} Selected`,
        description: toolId === 'text'
          ? `The ${toolName.toLowerCase()} tool is now active. Click on the canvas or type in the area.`
          : `The ${toolName.toLowerCase()} feature is currently under development.`,
        duration: 3000,
      });
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
    setActiveTool(null);
    setTextToolInput("");
    setShowDrawOptions(false);
    toast({
      title: "Clear All",
      description: "Whiteboard cleared (mock action).",
      duration: 3000,
    });
  }

  return (
    <div className="flex flex-col h-screen bg-muted/30">
      <header className="p-3 border-b bg-background shadow-sm sticky top-0 z-20">
        <div className="container mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Wand2 className="h-7 w-7 text-primary" />
            <h1 className="text-xl font-semibold text-foreground">
              Collaborative Whiteboard
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

      <div className="flex-none p-2 border-b bg-background shadow-md sticky top-[65px] z-10"> {/* Main Toolbar */}
        <div className="container mx-auto flex flex-wrap items-center justify-center gap-2">
          <ToolButton icon={MousePointer2} label="Select" onClick={() => handleToolClick("Select")} isActive={activeTool === "select"} />
          <ToolButton icon={Brush} label="Draw" onClick={() => handleToolClick("Draw")} isActive={activeTool === "draw"} />
          <ToolButton icon={Minus} label="Line" onClick={() => handleToolClick("Line")} isActive={activeTool === "line"} />
          <ToolButton icon={Wand2} label="Assist" onClick={() => handleToolClick("Shape Assist")} isActive={activeTool === "shapeassist"} />
          <ToolButton icon={Type} label="Text" onClick={() => handleToolClick("Text")} isActive={activeTool === "text"} />
          <ToolButton icon={Eraser} label="Erase" onClick={() => handleToolClick("Erase")} isActive={activeTool === "erase"} />
          <ToolButton icon={Trash2} label="Clear" onClick={handleClearAll} />
        </div>
      </div>

      {activeTool === 'draw' && showDrawOptions && ( /* Sub-toolbar for Draw Options */
        <div className="flex-none p-2 border-b bg-muted/50 shadow-sm sticky top-[calc(65px+58px)] z-10">
          <div className="container mx-auto">
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <div className="flex flex-wrap justify-center gap-2 items-center">
                <span className="text-xs font-medium text-muted-foreground mr-2">Color:</span>
                {availableColors.map(color => (
                  <ColorSwatch
                    key={color}
                    color={color}
                    onClick={() => handleColorSelect(color)}
                    isSelected={selectedColor === color}
                  />
                ))}
              </div>
              <div className="flex items-center justify-center gap-2">
                <span className="text-xs font-medium text-muted-foreground mr-2">Size:</span>
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
          </div>
        </div>
      )}

      <main className={cn(
        "flex-grow flex items-center justify-center", // Removed p-4
        (activeTool === 'draw' && showDrawOptions) ? "pt-[calc(65px+58px+66px)]" : "pt-[calc(65px+58px)]"
      )}>
        <Card className="w-full h-full max-w-full text-center shadow-xl rounded-xl border-border/50 overflow-hidden flex flex-col">
          <CardHeader className="flex-none">
            <CardTitle className="text-xl">Whiteboard Canvas</CardTitle>
            <CardDescription>
              Meeting ID: {meetingId || "N/A"} - Draw, write, and collaborate!
              {activeTool === 'draw' && (
                <span className="block text-xs mt-1">
                  Color: <span style={{ color: selectedColor, display: 'inline-block', width: '12px', height: '12px', borderRadius: '50%', backgroundColor: selectedColor, border: '1px solid #ccc', verticalAlign: 'middle' }}></span> | Size: {selectedBrushSize}
                </span>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex-grow bg-card flex items-center justify-center relative">
            <div className="w-full h-full bg-white dark:bg-muted/20 rounded-md border-2 border-dashed border-border/30 flex items-center justify-center"> {/* Removed p-4 */}
              {activeTool === 'text' ? (
                <Textarea
                  ref={textareaRef}
                  value={textToolInput}
                  onChange={(e) => setTextToolInput(e.target.value)}
                  placeholder="Type here..."
                  className="absolute inset-0 w-full h-full z-10 rounded-lg shadow-xl border-primary resize-none p-4 text-base"
                />
              ) : (
                <p className="text-muted-foreground text-lg">
                  Interactive canvas area - Select a tool to begin.
                  {activeTool === 'draw' && " Click and drag to draw (mock)."}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </main>
      <footer className="flex-none p-3 text-center text-xs text-muted-foreground border-t bg-background">
        TeachMeet Whiteboard - Features under development.
      </footer>
    </div>
  );
}
