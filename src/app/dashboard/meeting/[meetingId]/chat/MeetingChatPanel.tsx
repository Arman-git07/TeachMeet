
'use client';

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Send, Users, XCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useMeetingRTC } from "@/contexts/MeetingRTCContext";
import { v4 as uuidv4 } from 'uuid';

interface MeetingChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
  meetingId: string;
  topic: string;
}

export function MeetingChatPanel({ isOpen, onClose, meetingId, topic }: MeetingChatPanelProps) {
  const { user } = useAuth();
  const { rtc, chatHistory, addChatMessage } = useMeetingRTC();
  const [inputValue, setInputValue] = useState('');
  const scrollViewportRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    // Add a welcome message when the panel is opened and chat history is empty
    if (isOpen && chatHistory.length === 0) {
      addChatMessage({
          id: 'welcome',
          senderId: 'system',
          senderName: 'System',
          text: `Welcome to the public chat for ${topic}.`,
          timestamp: Date.now(),
          isPrivate: false,
        });
    }
  }, [isOpen, topic, chatHistory.length, addChatMessage]);

  useEffect(() => {
    if (scrollViewportRef.current) {
        scrollViewportRef.current.scrollTo({ top: scrollViewportRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [chatHistory]);
  
  const handleSendMessage = () => {
    if (!inputValue.trim() || !user || !rtc) return;
    
    const message = {
      id: uuidv4(),
      senderId: user.uid,
      senderName: user.displayName || 'You',
      senderAvatar: user.photoURL || undefined,
      text: inputValue,
      timestamp: Date.now(),
      isPrivate: false
    };

    // 1. Optimistically update the UI by adding to the central state
    addChatMessage(message);
    
    // 2. Broadcast the message over the network
    rtc.sendPublicMessage(message);

    setInputValue("");
  };

  return (
    <div className={cn(
        "absolute top-0 right-0 h-full w-96 bg-background border-l transition-transform duration-300 ease-in-out z-50",
        isOpen ? "translate-x-0" : "translate-x-full"
    )}>
        <div className="flex flex-col h-full">
            <header className="flex-none p-3 border-b bg-background shadow-sm">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Users className="h-6 w-6 text-primary" />
                        <h1 className="text-lg font-semibold text-foreground truncate" title={topic}>
                            {`Public Chat: ${topic}`}
                        </h1>
                    </div>
                    <Button variant="ghost" size="icon" className="rounded-full h-8 w-8" onClick={onClose}>
                        <XCircle className="h-5 w-5" />
                    </Button>
                </div>
            </header>
            
            <main className="flex-grow flex flex-col overflow-hidden">
                <Card className="w-full h-full max-w-full text-center shadow-none rounded-none border-0 flex flex-col">
                <CardContent className="flex-grow p-0 overflow-hidden">
                    <ScrollArea className="h-full">
                        <div className="p-4 md:p-6 space-y-4" ref={scrollViewportRef}>
                        {chatHistory.map((msg) => (
                            <div key={msg.id} className={cn("flex items-end gap-2", msg.senderId === user?.uid ? "justify-end" : "justify-start")}>
                            {msg.senderId !== user?.uid && (
                                <Avatar className="h-8 w-8 self-start">
                                <AvatarImage src={msg.senderAvatar || `https://placehold.co/40x40.png?text=${msg.senderName.charAt(0)}`} alt={msg.senderName} data-ai-hint="avatar user"/>
                                <AvatarFallback>{msg.senderName.charAt(0)}</AvatarFallback>
                                </Avatar>
                            )}
                            <div
                                className={cn(
                                "max-w-[85%] p-3 rounded-xl shadow",
                                msg.senderName === 'System' ? 'bg-muted text-muted-foreground text-center text-xs w-full' : 
                                msg.senderId === user?.uid ? "bg-primary text-primary-foreground rounded-br-none" : "bg-card text-card-foreground rounded-bl-none"
                                )}
                            >
                                {msg.senderId !== user?.uid && msg.senderName !== 'System' && <p className="text-xs font-medium mb-0.5">{msg.senderName}</p>}
                                <p className="text-sm whitespace-pre-wrap">{msg.text}</p>
                                {msg.senderName !== 'System' && <p className="text-xs opacity-70 mt-1 text-right">{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>}
                            </div>
                            {msg.senderId === user?.uid && (
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
                        placeholder="Type your message..."
                        className="flex-grow rounded-lg border-border/80 focus:ring-primary text-sm min-h-[40px] max-h-[120px]"
                        rows={1}
                        onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSendMessage();
                        }
                        }}
                        disabled={!rtc}
                    />
                    <Button type="submit" size="icon" className="rounded-lg btn-gel w-10 h-10" disabled={!inputValue.trim() || !rtc}>
                        <Send className="h-5 w-5" />
                        <span className="sr-only">Send message</span>
                    </Button>
                    </form>
                </CardFooter>
                </Card>
            </main>
        </div>
    </div>
  );
}
