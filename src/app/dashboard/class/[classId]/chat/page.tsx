
'use client';

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Send, MessageSquare as MessageSquareIcon } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams, useParams } from "next/navigation"; // Added useParams
import { useState, useEffect, use, useRef } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card"; // Removed CardDescription, CardTitle
import { cn } from "@/lib/utils";

interface ChatMessage {
  id: string;
  senderName: string;
  senderAvatar?: string;
  text: string;
  timestamp: Date;
  isMe: boolean;
  isSystem?: boolean; // Added to differentiate system messages
}

export default function ClassChatPage({ params: paramsPromise }: { params: Promise<{ classId: string }> }) {
  const resolvedParams = use(paramsPromise); // Use `use` hook for promises
  const { classId } = resolvedParams;
  const router = useRouter();
  const searchParams = useSearchParams();
  const className = searchParams.get('name') || "Class Discussion";

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");

  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setMessages([
      {
        id: 'sys_join',
        senderName: 'System',
        text: `All class members and teacher of this class can chat here.`,
        timestamp: new Date(),
        isMe: false,
        isSystem: true
      }
    ]);
  }, [className]);

  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTo({ top: scrollAreaRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [messages]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'; // Reset height
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`; // Set to scroll height
    }
  }, [inputValue]);


  const handleSendMessage = () => {
    if (!inputValue.trim()) return;
    const newMessage: ChatMessage = {
      id: Date.now().toString(),
      senderName: 'You',
      text: inputValue.trim(),
      timestamp: new Date(),
      isMe: true,
      // In a real app, fetch senderAvatar from auth user: auth.currentUser.photoURL || undefined
    };
    setMessages(prev => [...prev, newMessage]);
    setInputValue("");
  };

  const backToClassDetailsLink = `/dashboard/class/${classId}?name=${encodeURIComponent(className)}`;

  return (
    <div className="flex flex-col h-full bg-muted/30">
      <header className="flex-none p-3 border-b bg-background shadow-sm">
        <div className="container mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <MessageSquareIcon className="h-7 w-7 text-primary flex-shrink-0" />
            <div className="flex-grow min-w-0">
              <h1 className="text-xl font-semibold text-foreground truncate" title={className}>
                {className}
              </h1>
              <p className="text-xs text-muted-foreground">Class ID: {classId}</p>
            </div>
          </div>
          <Link href={backToClassDetailsLink} passHref legacyBehavior>
            <Button variant="outline" className="rounded-lg flex-shrink-0">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Class
            </Button>
          </Link>
        </div>
      </header>

      <main className="flex-grow flex flex-col overflow-hidden"> {/* Adjusted pt for header height + a bit of space */}
        <Card className="w-full h-full max-w-full text-center shadow-none rounded-none border-0 flex flex-col">
          <CardContent className="flex-grow p-0 overflow-hidden">
            <ScrollArea className="h-full p-4 md:p-6" ref={scrollAreaRef}>
              {messages.length === 0 && !messages.some(m => m.isSystem) ? ( // Check if only system messages are not there
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                  <MessageSquareIcon className="w-16 h-16 mb-4" />
                  <p className="text-lg">No messages yet.</p>
                  <p>Be the first to send a message!</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {messages.map((msg) => (
                    msg.isSystem ? (
                      <div key={msg.id} className="text-center my-3">
                        <span className="text-xs text-muted-foreground italic bg-muted/60 px-3 py-1 rounded-full">
                          {msg.text}
                        </span>
                      </div>
                    ) : (
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
                            : "bg-card text-card-foreground rounded-bl-none"
                        )}
                      >
                        {!msg.isMe && <p className="text-xs font-medium mb-0.5">{msg.senderName}</p>}
                        <p className="text-sm whitespace-pre-wrap">{msg.text}</p>
                        <p className="text-xs opacity-70 mt-1 text-right">{msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                      </div>
                      {msg.isMe && (
                        <Avatar className="h-8 w-8 self-start">
                           <AvatarImage src={`https://placehold.co/40x40/7F00FF/FFFFFF.png?text=Y`} alt="You" data-ai-hint="avatar user"/> {/* Changed avatar color for "You" */}
                          <AvatarFallback>Y</AvatarFallback>
                        </Avatar>
                      )}
                    </div>
                  )))}
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
              className="flex w-full items-end gap-2" // items-end for better alignment with growing textarea
            >
              <Textarea
                ref={textareaRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder={"Type your message..."}
                className="flex-grow rounded-lg border-border/80 focus:ring-primary text-sm min-h-[40px] max-h-[120px] resize-none overflow-y-auto" // Added resize-none and overflow-y-auto
                rows={1}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
              />
              <Button type="submit" size="icon" className="rounded-lg btn-gel w-10 h-10 self-end" disabled={!inputValue.trim()}> {/* self-end */}
                <Send className="h-5 w-5" />
                <span className="sr-only">Send message</span>
              </Button>
            </form>
          </CardFooter>
        </Card>
      </main>
       <footer className="flex-none p-2 text-center text-xs text-muted-foreground border-t bg-background">
        TeachMeet Class Chat - Messages are local and not sent to a server.
      </footer>
    </div>
  );
}
