
'use client';

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea"; // Import Textarea
import { ArrowLeft, Brush, Minus, Type, Eraser, MousePointer2, Wand2, Palette, Trash2 } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect, useRef } from "react"; // Import useState, useEffect, useRef

const ToolButton = ({ icon: Icon, label, onClick, isActive = false }: { icon: React.ElementType, label: string, onClick: () => void, isActive?: boolean }) => (
  <Button
    variant={isActive ? "default" : "outline"}
    size="icon"
    className="rounded-lg w-12 h-12 flex flex-col items-center justify-center text-xs"
    onClick={onClick}
    aria-label={label}
  >
    <Icon className="h-5 w-5 mb-0.5" />
    {/* <span className="mt-0.5">{label}</span> */}
  </Button>
);

export default function WhiteboardPage() {
  const params = useParams();
  const meetingId = params.meetingId as string;
  const { toast } = useToast();
  const [activeTool, setActiveTool] = useState<string | null>(null);
  const [textToolInput, setTextToolInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleToolClick = (toolName: string) => {
    const toolId = toolName.toLowerCase().replace(/\s+/g, '');
    if (activeTool === toolId) {
      setActiveTool(null); // Deactivate if already active
      toast({
        title: `${toolName} Tool Deactivated`,
        duration: 2000,
      });
    } else {
      setActiveTool(toolId);
      toast({
        title: `${toolName} Selected`,
        description: toolId === 'text' 
          ? `The ${toolName.toLowerCase()} tool is now active. Click on the canvas or type in the area.`
          : `The ${toolName.toLowerCase()} feature is currently under development.`,
        duration: 3000,
      });
    }
  };

  useEffect(() => {
    if (activeTool === "text" && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [activeTool]);

  const handleClearAll = () => {
    setActiveTool(null);
    setTextToolInput("");
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

      <div className="flex-none p-2 border-b bg-background shadow-md sticky top-[65px] z-10"> {/* Adjusted sticky position */}
        <div className="container mx-auto flex flex-wrap items-center justify-center gap-2">
          <ToolButton icon={MousePointer2} label="Select" onClick={() => handleToolClick("Select")} isActive={activeTool === "select"} />
          <ToolButton icon={Brush} label="Draw" onClick={() => handleToolClick("Draw")} isActive={activeTool === "draw"} />
          <ToolButton icon={Minus} label="Line" onClick={() => handleToolClick("Line")} isActive={activeTool === "line"} />
          <ToolButton icon={Wand2} label="Assist" onClick={() => handleToolClick("Shape Assist")} isActive={activeTool === "shapeassist"} />
          <ToolButton icon={Type} label="Text" onClick={() => handleToolClick("Text")} isActive={activeTool === "text"} />
          <ToolButton icon={Eraser} label="Erase" onClick={() => handleToolClick("Erase")} isActive={activeTool === "erase"} />
          <ToolButton icon={Palette} label="Color" onClick={() => handleToolClick("Color Picker")} isActive={activeTool === "colorpicker"} />
          <ToolButton icon={Trash2} label="Clear" onClick={handleClearAll} />
        </div>
      </div>

      <main className="flex-grow flex items-center justify-center p-4 pt-[calc(65px+58px)] md:pt-4"> {/* Adjusted padding-top for sticky headers */}
        <Card className="w-full h-full max-w-full text-center shadow-xl rounded-xl border-border/50 overflow-hidden flex flex-col">
          <CardHeader className="flex-none">
            <CardTitle className="text-xl">Whiteboard Canvas</CardTitle>
            <CardDescription>
              Meeting ID: {meetingId || "N/A"} - Draw, write, and collaborate!
            </CardDescription>
          </CardHeader>
          <CardContent className="flex-grow bg-card flex items-center justify-center relative">
            {/* This div represents the canvas area */}
            <div className="w-full h-full bg-white dark:bg-muted/20 rounded-md border-2 border-dashed border-border/30 flex items-center justify-center p-4">
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
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </main>
      <footer className="flex-none p-3 text-center text-xs text-muted-foreground border-t bg-background">
        TeachMeet Whiteboard - Shape recognition & text input coming soon.
      </footer>
    </div>
  );
}
