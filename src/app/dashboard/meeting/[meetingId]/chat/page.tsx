
'use client';

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Send, Users, MessageSquare, UserCheck } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect, use } from "react";
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

// Mock participants for private chat selection
const mockMeetingParticipants = [
  { id: 'user1', name: 'Alice', avatar: 'https://placehold.co/40x40/FFC0CB/000000.png?text=A' },
  { id: 'user2', name: 'Bob', avatar: 'https://placehold.co/40x40/ADD8E6/000000.png?text=B' },
  { id: 'user3', name: 'Charlie', avatar: 'https://placehold.co/40x40/90EE90/000000.png?text=C' },
];


export default function MeetingChatPage({ params: paramsPromise }: { params: Promise<{ meetingId: string }> }) {
  const resolvedParams = use(paramsPromise);
  const { meetingId } = resolvedParams;
  const router = useRouter();
  const searchParams = useSearchParams();
  const topic = searchParams.get('topic') || "Meeting Chat"; // Get topic from URL or default

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [activeTab, setActiveTab] = useState<string>("public"); // 'public' or participantId for private
  const [privateChatTarget, setPrivateChatTarget] = useState<{id: string, name: string} | null>(null);

  const scrollAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Mock initial messages
    setMessages([
      { id: '1', senderName: 'System', text: `Welcome to the chat for ${topic}!`, timestamp: new Date(), isMe: false },
      { id: '2', senderName: 'Alice', text: 'Hello everyone!', timestamp: new Date(), isMe: false, senderAvatar: mockMeetingParticipants[0].avatar },
      { id: '3', senderName: 'You', text: 'Hi Alice!', timestamp: new Date(), isMe: true },
    ]);
  }, [topic]);

  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTo({ top: scrollAreaRef.current.scrollHeight, behavior: 'smooth' });
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
    // In a real app, you'd send this message to a backend/P2P service
    // and differentiate between public and private messages
    setMessages(prev => [...prev, newMessage]);
    setInputValue("");
  };
  
  const handleTabChange = (value: string) => {
    setActiveTab(value);
    if (value === 'public') {
      setPrivateChatTarget(null);
      // Load public messages
      setMessages([ { id: 'pub1', senderName: 'System', text: `Switched to Public Chat for ${topic}.`, timestamp: new Date(), isMe: false } ]);
    } else {
      const targetUser = mockMeetingParticipants.find(p => p.id === value);
      if (targetUser) {
        setPrivateChatTarget({id: targetUser.id, name: targetUser.name});
        // Load private messages with targetUser
        setMessages([ { id: 'priv1', senderName: 'System', text: `Private chat with ${targetUser.name} for ${topic}.`, timestamp: new Date(), isMe: false } ]);
      }
    }
  };

  const backToMeetingLink = topic 
    ? `/dashboard/meeting/${meetingId}?topic=${encodeURIComponent(topic)}`
    : `/dashboard/meeting/${meetingId}`;

  return (
    <div className="flex flex-col h-screen bg-muted/30">
      <header className="flex-none p-3 border-b bg-background shadow-sm sticky top-0 z-20">
        <div className="container mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <MessageSquare className="h-7 w-7 text-primary" />
            <h1 className="text-xl font-semibold text-foreground truncate" title={topic}>
              {privateChatTarget ? `Chat with ${privateChatTarget.name}` : topic}
            </h1>
            <span className="text-sm text-muted-foreground"> (Meeting ID: {meetingId})</span>
          </div>
          <Link href={backToMeetingLink} passHref legacyBehavior>
            <Button variant="outline" className="rounded-lg">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Meeting
            </Button>
          </Link>
        </div>
      </header>

      <Tabs value={activeTab} onValueChange={handleTabChange} className="flex-none sticky top-[65px] z-10 bg-background shadow-md">
        <TabsList className="container mx-auto rounded-none border-b p-0 h-12">
          <TabsTrigger value="public" className="h-full rounded-none data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none px-4">
            <Users className="mr-2 h-5 w-5" /> Public Chat
          </TabsTrigger>
          {mockMeetingParticipants.map(p => (
            <TabsTrigger key={p.id} value={p.id} className="h-full rounded-none data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none px-4">
               <UserCheck className="mr-2 h-5 w-5" /> {p.name}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      
      <main className="flex-grow flex flex-col overflow-hidden" style={{ paddingTop: '113px' /* Header + TabsList height */ }}>
        <Card className="w-full h-full max-w-full text-center shadow-none rounded-none border-0 flex flex-col">
          <CardContent className="flex-grow p-0 overflow-hidden">
            <ScrollArea className="h-full p-4 md:p-6" ref={scrollAreaRef}>
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
        TeachMeet Chat - Real-time features are illustrative.
      </footer>
    </div>
  );
}

