
'use client';

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Send, MessageSquare } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { io, Socket } from "socket.io-client";

interface ChatMessage {
  id: string;
  senderName: string;
  senderAvatar?: string;
  senderId?: string;
  text: string;
  timestamp: Date;
  isMe: boolean;
}

export default function MeetingChatPage({ params }: { params: { meetingId: string } }) {
  const { meetingId } = params;
  const searchParams = useSearchParams();
  const topic = searchParams.get('topic') || "Meeting Chat";

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const { user } = useAuth();
  const socketRef = useRef<Socket | null>(null);
  const scrollViewportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;

    const socket = io({
      path: "/api/socketio",
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      socket.emit("join-room", meetingId, user.uid);
    });

    socket.on("new-public-message", (message: Omit<ChatMessage, 'isMe'>) => {
      setMessages((prev) => [
        ...prev,
        { ...message, timestamp: new Date(message.timestamp), isMe: message.senderId === user.uid },
      ]);
    });

    setMessages([
        { id: 'sys_public_switch', senderName: 'System', text: `Welcome to the public chat for "${topic}". Messages are not persisted.`, timestamp: new Date(), isMe: false }
    ]);

    return () => {
      socket.disconnect();
    };
  }, [meetingId, user]);


  useEffect(() => {
    if (scrollViewportRef.current) {
        const viewport = scrollViewportRef.current.parentElement;
        if (viewport) {
          viewport.scrollTo({ top: viewport.scrollHeight, behavior: 'smooth' });
        }
    }
  }, [messages]);

  const handleSendMessage = () => {
    if (!inputValue.trim() || !user || !socketRef.current) return;
    
    const message: Omit<ChatMessage, 'isMe'> = {
      id: Date.now().toString(),
      senderId: user.uid,
      senderName: user.displayName || 'Anonymous',
      senderAvatar: user.photoURL || undefined,
      text: inputValue,
      timestamp: new Date(),
    };

    // Add message locally immediately for responsiveness
    setMessages(prev => [...prev, { ...message, isMe: true }]);
    
    // Emit to server to broadcast to others
    socketRef.current.emit('public-chat-message', meetingId, message);

    setInputValue("");
  };
  
  const backToMeetingLink = topic 
    ? `/dashboard/meeting/${meetingId}?topic=${encodeURIComponent(topic)}`
    : `/dashboard/meeting/${meetingId}`;

  return (
    <div className="flex flex-col h-full bg-muted/30">
      <header className="flex-none p-3 border-b bg-background shadow-sm">
        <div className="container mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
             <MessageSquare className="h-7 w-7 text-primary" />
             <h1 className="text-xl font-semibold text-foreground truncate" title={topic}>
                {topic}
              </h1>
          </div>
          <Button asChild variant="outline" className="rounded-lg">
            <Link href={backToMeetingLink}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Meeting
            </Link>
          </Button>
        </div>
      </header>
      
      <main className="flex-grow flex flex-col overflow-hidden">
        <Card className="w-full h-full max-w-full text-center shadow-none rounded-none border-0 flex flex-col">
          <CardContent className="flex-grow p-0 overflow-hidden">
            <ScrollArea className="h-full">
                <div className="p-4 md:p-6 space-y-4" ref={scrollViewportRef}>
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
                          msg.senderName === 'System' ? 'bg-muted text-muted-foreground text-center text-xs w-full' : 
                          msg.isMe ? "bg-primary text-primary-foreground rounded-br-none" : "bg-card text-card-foreground rounded-bl-none"
                        )}
                      >
                        {!msg.isMe && msg.senderName !== 'System' && <p className="text-xs font-medium mb-0.5">{msg.senderName}</p>}
                        <p className="text-sm whitespace-pre-wrap">{msg.text}</p>
                        {msg.senderName !== 'System' && <p className="text-xs opacity-70 mt-1 text-right">{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>}
                      </div>
                      {msg.isMe && (
                        <Avatar className="h-8 w-8 self-start">
                           <AvatarImage src={user?.photoURL || undefined} alt={user?.displayName || 'You'} data-ai-hint="avatar user"/>
                          <AvatarFallback>{user?.displayName?.charAt(0) || 'Y'}</AvatarFallback>
                        </Avatar>
                      )}
                    </div>
                  ))}
                </div>
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
        Public chat messages are not stored.
      </footer>
    </div>
  );
}
