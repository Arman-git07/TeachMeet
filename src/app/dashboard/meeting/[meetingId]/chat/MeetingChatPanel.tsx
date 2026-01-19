
'use client';

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from "@/components/ui/sheet";
import { Send, MessageSquare } from "lucide-react";
import { useState, useEffect, useRef, useCallback } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useMeetingRTC, type ChatMessage } from "@/contexts/MeetingRTCContext";
import { useBlock } from "@/contexts/BlockContext";

export function MeetingChatPanel() {
  const { user } = useAuth();
  const { rtc, chatHistory, addChatMessage, isChatOpen, setIsChatOpen } = useMeetingRTC();
  const { isBlockedByMe } = useBlock();

  const [inputValue, setInputValue] = useState("");
  const scrollViewportRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isChatOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isChatOpen]);

  useEffect(() => {
    if (scrollViewportRef.current) {
        scrollViewportRef.current.scrollTo({ top: scrollViewportRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [chatHistory]);

  const handleSendMessage = useCallback(() => {
    if (!inputValue.trim() || !user || !rtc) return;

    const newMessage: ChatMessage = {
      id: `${Date.now()}-${user.uid}`,
      senderId: user.uid,
      senderName: user.displayName || 'You',
      senderAvatar: user.photoURL || undefined,
      text: inputValue,
      timestamp: Date.now(),
      isPrivate: false, // For now, all messages are public in the meeting
    };
    
    // Optimistic update
    addChatMessage(newMessage);
    // Send to others
    rtc.socket.emit('chat-message', newMessage);

    setInputValue("");
    inputRef.current?.focus();
  }, [inputValue, user, rtc, addChatMessage]);

  const filteredMessages = chatHistory.filter(msg => !msg.isPrivate && !isBlockedByMe(msg.senderId, 'publicChat'));

  return (
    <Sheet open={isChatOpen} onOpenChange={setIsChatOpen}>
        <SheetContent className="flex flex-col p-0">
            <SheetHeader className="p-4 border-b">
                <SheetTitle className="flex items-center gap-2"><MessageSquare className="h-5 w-5"/>Meeting Chat</SheetTitle>
            </SheetHeader>
            <div className="flex-grow overflow-hidden">
                 <ScrollArea className="h-full">
                    <div className="p-4 space-y-4" ref={scrollViewportRef}>
                    {filteredMessages.map((msg) => (
                        <div key={msg.id} className={cn("flex items-end gap-2", msg.senderId === user?.uid ? "justify-end" : "justify-start")}>
                        {msg.senderId !== user?.uid && (
                            <Avatar className="h-8 w-8 self-start">
                            <AvatarImage src={msg.senderAvatar || `https://placehold.co/40x40.png?text=${msg.senderName.charAt(0)}`} alt={msg.senderName} data-ai-hint="avatar user"/>
                            <AvatarFallback>{msg.senderName.charAt(0)}</AvatarFallback>
                            </Avatar>
                        )}
                        <div
                            className={cn(
                            "max-w-[80%] p-3 rounded-xl shadow",
                            msg.senderId === user?.uid
                                ? "bg-primary text-primary-foreground rounded-br-none"
                                : "bg-card text-card-foreground rounded-bl-none"
                            )}
                        >
                            {msg.senderId !== user?.uid && <p className="text-xs font-medium mb-0.5">{msg.senderName}</p>}
                            <p className="text-sm whitespace-pre-wrap">{msg.text}</p>
                            <p className="text-xs opacity-70 mt-1 text-right">{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                        </div>
                        {msg.senderId === user?.uid && (
                            <Avatar className="h-8 w-8 self-start">
                            <AvatarImage src={user?.photoURL || `https://placehold.co/40x40/00FFFF/000000.png?text=Y`} alt="You" data-ai-hint="avatar user"/>
                            <AvatarFallback>{user?.displayName?.charAt(0) || 'Y'}</AvatarFallback>
                            </Avatar>
                        )}
                        </div>
                    ))}
                    </div>
                </ScrollArea>
            </div>
            <SheetFooter className="p-4 border-t bg-background">
                <form
                    onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }}
                    className="flex w-full items-center gap-2"
                >
                    <Input
                        ref={inputRef}
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        placeholder="Type your message..."
                        className="flex-grow rounded-full border-border/80 focus:ring-primary text-sm h-10"
                        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }}
                    />
                    <Button type="submit" size="icon" className="rounded-full btn-gel w-10 h-10" disabled={!inputValue.trim()}>
                        <Send className="h-5 w-5" />
                        <span className="sr-only">Send message</span>
                    </Button>
                </form>
            </SheetFooter>
        </SheetContent>
    </Sheet>
  );
}
