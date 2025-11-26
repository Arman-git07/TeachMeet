
'use client';

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Send, Users, MessageSquare, UserCheck, Lock } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect, useRef } from "react";
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

export default function MeetingChatPage({ params }: { params: { meetingId: string } }) {
  const { meetingId } = params;
  const router = useRouter();
  const searchParams = useSearchParams();
  const topic = searchParams.get('topic') || "Meeting Chat";
  const privateWithId = searchParams.get('privateWith');
  const privateWithName = searchParams.get('privateWithName');

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [showMeetingId, setShowMeetingId] = useState(false);

  const scrollViewportRef = useRef<HTMLDivElement>(null);
  
  const isPrivateChat = !!privateWithId;

  useEffect(() => {
    // Show an initial message depending on whether it's a public or private chat
    const initialMessage: ChatMessage = isPrivateChat
      ? { id: 'sys_private_switch', senderName: 'System', text: `This is a private chat with ${privateWithName}. Messages are only between you and them.`, timestamp: new Date(), isMe: false }
      : { id: 'sys_public_switch', senderName: 'System', text: `Welcome to the public chat for "${topic}".`, timestamp: new Date(), isMe: false };
      
    setMessages([initialMessage]);
  }, [isPrivateChat, privateWithName, topic]);

  useEffect(() => {
    if (scrollViewportRef.current) {
        const viewport = scrollViewportRef.current.parentElement;
        if (viewport) {
          viewport.scrollTo({ top: viewport.scrollHeight, behavior: 'smooth' });
        }
    }
  }, [messages]);

  const handleSendMessage = () => {
    if (!inputValue.trim()) return;
    const newMessage: ChatMessage = {
      id: Date.now().toString(),
      senderName: 'You',
      text: inputValue,
      timestamp: new Date(),
      isMe: true,
    };
    setMessages(prev => [...prev, newMessage]);
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
             {isPrivateChat ? <Lock className="h-7 w-7 text-accent" /> : <MessageSquare className="h-7 w-7 text-primary" />}
            <div className="cursor-pointer" onClick={() => setShowMeetingId(prev => !prev)}>
              <h1 className="text-xl font-semibold text-foreground truncate" title={topic}>
                {showMeetingId ? meetingId : (isPrivateChat ? `Chat with ${privateWithName}` : topic)}
              </h1>
              <p className="text-xs text-muted-foreground">
                 {showMeetingId ? 'Click to show topic' : 'Click to show Meeting ID'}
              </p>
            </div>
          </div>
          <Button asChild variant="outline" className="rounded-lg">
            <Link href={backToMeetingLink}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Meeting
            </Link>
          </Button>
        </div>
      </header>

      {/* Tabs are removed as we now handle private/public via URL params */}
      
      <main className="flex-grow flex flex-col overflow-hidden">
        <Card className="w-full h-full max-w-full text-center shadow-none rounded-none border-0 flex flex-col">
          <CardContent className="flex-grow p-0 overflow-hidden">
            <ScrollArea className="h-full">
                <div className="p-4 md:p-6 space-y-4" ref={scrollViewportRef}>
                  {messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground pt-16">
                      <MessageSquare className="w-16 h-16 mb-4" />
                      <p className="text-lg">No messages yet.</p>
                      <p>Be the first to send a message!</p>
                    </div>
                  ) : (
                    <>
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
                              msg.sender === 'system' ? 'bg-muted text-muted-foreground text-center text-xs w-full' : 
                              msg.isMe ? "bg-primary text-primary-foreground rounded-br-none" : "bg-card text-card-foreground rounded-bl-none"
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
                    </>
                  )}
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
                placeholder={isPrivateChat ? `Message ${privateWithName}...` : "Type your message..."}
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
        TeachMeet Chat - Real-time features require backend integration.
      </footer>
    </div>
  );
}
