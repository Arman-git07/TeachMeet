
'use client';

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Send, Users, MessageSquare, UserCheck } from "lucide-react";
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

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [activeTab, setActiveTab] = useState<string>("public");
  const [privateChatTarget, setPrivateChatTarget] = useState<{id: string, name: string} | null>(null);

  // Use a ref for the scroll viewport's inner content div
  const scrollContentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Scroll to bottom when messages change
    if (scrollContentRef.current) {
        // Find the viewport element managed by Radix ScrollArea
        const viewport = scrollContentRef.current.parentElement;
        if (viewport) {
          viewport.scrollTo({ top: viewport.scrollHeight, behavior: 'smooth' });
        }
    }
  }, [messages]);

  const handleSendMessage = () => {
    if (!inputValue.trim()) return;
    const newMessage: ChatMessage = {
      id: Date.now().toString(),
      senderName: 'You', // In a real app, get from auth
      text: inputValue,
      timestamp: new Date(),
      isMe: true,
    };
    // In a real app, you'd send this message to a backend/P2P service
    // and differentiate between public and private messages based on activeTab
    setMessages(prev => [...prev, newMessage]);
    setInputValue("");
  };
  
  const handleTabChange = (value: string) => {
    setActiveTab(value);
    if (value === 'public') {
      setPrivateChatTarget(null);
      // TODO: In a real app, load/filter public messages
      // For now, we can clear messages or show a system message
      setMessages([ { id: 'sys_public_switch', senderName: 'System', text: `Switched to Public Chat for ${topic}.`, timestamp: new Date(), isMe: false } ]);
    } else {
      // This part will not be reachable with current UI as mockMeetingParticipants is removed
      // Kept for potential future use if participants are loaded dynamically
      // const targetUser = mockMeetingParticipants.find(p => p.id === value);
      // if (targetUser) {
      //   setPrivateChatTarget({id: targetUser.id, name: targetUser.name});
      //   setMessages([ { id: 'sys_private_switch', senderName: 'System', text: `Private chat with ${targetUser.name} for ${topic}.`, timestamp: new Date(), isMe: false } ]);
      // }
    }
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
            <div>
              <h1 className="text-xl font-semibold text-foreground truncate" title={topic}>
                {privateChatTarget ? `Chat with ${privateChatTarget.name}` : topic}
              </h1>
              <p className="text-xs text-muted-foreground">Meeting ID: {meetingId}</p>
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

      <Tabs value={activeTab} onValueChange={handleTabChange} className="flex-none bg-background shadow-md">
        <TabsList className="container mx-auto rounded-none border-b p-0 h-12">
          <TabsTrigger value="public" className="h-full rounded-none data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none px-4">
            <Users className="mr-2 h-5 w-5" /> Public Chat
          </TabsTrigger>
          {/* Private chat tabs generation removed as mockMeetingParticipants is removed */}
        </TabsList>
      </Tabs>
      
      <main className="flex-grow flex flex-col overflow-hidden">
        <Card className="w-full h-full max-w-full text-center shadow-none rounded-none border-0 flex flex-col">
          <CardContent className="flex-grow p-0 overflow-hidden">
            <ScrollArea className="h-full">
                <div className="p-4 md:p-6 space-y-4" ref={scrollContentRef}>
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
                placeholder={privateChatTarget ? `Message ${privateChatTarget.name}...` : "Type your message..."}
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
