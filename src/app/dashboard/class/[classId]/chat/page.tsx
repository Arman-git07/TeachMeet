
'use client';

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Send, Users, MessageSquare as MessageSquareIcon } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect, use, useRef } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

interface ChatMessage {
  id: string;
  senderName: string;
  senderAvatar?: string;
  text: string;
  timestamp: Date;
  isMe: boolean;
}

export default function ClassChatPage({ params: paramsPromise }: { params: Promise<{ classId: string }> }) {
  const resolvedParams = use(paramsPromise);
  const { classId } = resolvedParams;
  const router = useRouter();
  const searchParams = useSearchParams();
  const className = searchParams.get('name') || "Class Discussion";

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");

  const scrollAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Initial system message
    setMessages([
      { id: 'sys_join', senderName: 'System', text: `Welcome to the chat for ${className}.`, timestamp: new Date(), isMe: false }
    ]);
  }, [className]);

  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTo({ top: scrollAreaRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [messages]);

  const handleSendMessage = () => {
    if (!inputValue.trim()) return;
    const newMessage: ChatMessage = {
      id: Date.now().toString(),
      senderName: 'You', // In a real app, get from auth.currentUser.displayName
      text: inputValue,
      timestamp: new Date(),
      isMe: true,
      // senderAvatar: auth.currentUser.photoURL || undefined // Example
    };
    setMessages(prev => [...prev, newMessage]);
    setInputValue("");

    // Mock AI/other user response for demonstration
    setTimeout(() => {
      const mockResponse: ChatMessage = {
        id: (Date.now() + 1).toString(),
        senderName: 'Classmate AI (Mock)',
        text: `Thinking about: "${newMessage.text.substring(0,30)}${newMessage.text.length > 30 ? '...' : ''}"`,
        timestamp: new Date(),
        isMe: false,
      };
      setMessages(prev => [...prev, mockResponse]);
    }, 1000 + Math.random() * 1000);
  };
  
  const backToClassDetailsLink = `/dashboard/class/${classId}?name=${encodeURIComponent(className)}`;

  return (
    <div className="flex flex-col h-screen bg-muted/30">
      <header className="flex-none p-3 border-b bg-background shadow-sm sticky top-0 z-20">
        <div className="container mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <MessageSquareIcon className="h-7 w-7 text-primary" />
            <h1 className="text-xl font-semibold text-foreground truncate" title={className}>
              {className}
            </h1>
            <span className="text-sm text-muted-foreground"> (Class ID: {classId})</span>
          </div>
          <Link href={backToClassDetailsLink} passHref legacyBehavior>
            <Button variant="outline" className="rounded-lg">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Class Details
            </Button>
          </Link>
        </div>
      </header>

      {/* Simplified: No tabs for now, just one public chat room */}
      <main className="flex-grow flex flex-col overflow-hidden pt-[65px]"> {/* Adjust pt if header height changes */}
        <Card className="w-full h-full max-w-full text-center shadow-none rounded-none border-0 flex flex-col">
          <CardContent className="flex-grow p-0 overflow-hidden">
            <ScrollArea className="h-full p-4 md:p-6" ref={scrollAreaRef}>
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                  <MessageSquareIcon className="w-16 h-16 mb-4" />
                  <p className="text-lg">No messages yet.</p>
                  <p>Be the first to send a message!</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {messages.map((msg) => (
                    <div key={msg.id} className={cn("flex items-end gap-2", msg.isMe ? "justify-end" : "justify-start")}>
                      {!msg.isMe && (
                        <Avatar className="h-8 w-8 self-start">
                          <AvatarImage src={msg.senderAvatar || `https://placehold.co/40x40.png?text=${msg.senderName.charAt(0)}`} alt={msg.senderName} data-ai-hint="avatar user"/>
                          <AvatarFallback>{msg.senderName.charAt(0)}</AvatarFallback>
                        </Avatar>
                      )}
                      <div
                        className={cn(
                          "max-w-[70%] p-3 rounded-xl shadow",
                          msg.isMe
                            ? "bg-primary text-primary-foreground rounded-br-none"
                            : (msg.sender === 'System' 
                                ? "bg-muted/80 text-muted-foreground text-xs italic text-center w-full rounded-md" 
                                : "bg-card text-card-foreground rounded-bl-none")
                        )}
                      >
                        {!msg.isMe && msg.sender !== 'System' && <p className="text-xs font-medium mb-0.5">{msg.senderName}</p>}
                        <p className="text-sm whitespace-pre-wrap">{msg.text}</p>
                        {msg.sender !== 'System' && <p className="text-xs opacity-70 mt-1 text-right">{msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>}
                      </div>
                      {msg.isMe && (
                        <Avatar className="h-8 w-8 self-start">
                           <AvatarImage src={`https://placehold.co/40x40/00FFFF/000000.png?text=Y`} alt="You" data-ai-hint="avatar user"/>
                          <AvatarFallback>Y</AvatarFallback>
                        </Avatar>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
          <CardFooter className="p-4 border-t bg-background">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="flex w-full items-center gap-2"
            >
              <Textarea
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder={"Type your message..."}
                className="flex-grow rounded-lg border-border/80 focus:ring-primary text-sm min-h-[40px] max-h-[120px]"
                rows={1}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
              />
              <Button type="submit" size="icon" className="rounded-lg btn-gel w-10 h-10" disabled={!inputValue.trim()}>
                <Send className="h-5 w-5" />
                <span className="sr-only">Send message</span>
              </Button>
            </form>
          </CardFooter>
        </Card>
      </main>
       <footer className="flex-none p-2 text-center text-xs text-muted-foreground border-t bg-background">
        TeachMeet Class Chat - This is a local mock-up. Messages are not sent to a server.
      </footer>
    </div>
  );
}
