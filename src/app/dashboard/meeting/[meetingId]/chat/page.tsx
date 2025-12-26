
'use client';

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Send, MessageSquare, User, Users, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { io, Socket } from "socket.io-client";

export interface BaseActivityItem {
  id: string;
  type: string;
  title: string;
  timestamp: number;
}
export interface PublicChatActivityItem extends BaseActivityItem {
  type: 'publicChat';
  text: string;
  senderId: string;
  senderName: string;
  meetingId: string;
  meetingTopic: string;
}
export interface PrivateMessageActivityItem extends BaseActivityItem {
    type: 'privateMessage';
    from: string;
    senderId: string;
    meetingId: string;
    meetingTopic: string;
}

export interface ChatMessage {
  id: string;
  senderName: string;
  senderAvatar?: string;
  senderId: string;
  recipientId?: string; // For private messages
  text: string;
  timestamp: Date;
  isMe: boolean;
  isPrivate: boolean;
  meetingId?: string;
  meetingTopic?: string;
}
const LATEST_ACTIVITY_KEY_PREFIX = 'teachmeet-latest-activity-';

export default function MeetingChatPage({ params }: { params: { meetingId: string } }) {
  const { meetingId } = params;
  const searchParams = useSearchParams();
  const topic = searchParams.get('topic') || "Meeting Chat";
  const privateWithId = searchParams.get('privateWith');
  const privateWithName = searchParams.get('privateWithName');
  const cam = searchParams.get('cam');
  const mic = searchParams.get('mic');

  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const { user } = useAuth();
  const scrollViewportRef = useRef<HTMLDivElement>(null);
  
  const [activeTab, setActiveTab] = useState(privateWithId ? privateWithId : 'public');
  const [isConnecting, setIsConnecting] = useState(true);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!user) return;

    // Initialize socket connection
    const socket = io({
      path: "/api/socketio",
      query: { userId: user.uid, displayName: user.displayName, photoURL: user.photoURL || '' }
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      setIsConnecting(false);
      socket.emit('join-room', meetingId);
      // Add initial system message once connected
      setChatHistory([{ id: 'welcome', senderName: 'System', text: `Welcome to the chat for ${topic}. Messages are not persisted after the meeting.`, timestamp: new Date(), isMe: false, isPrivate: false, senderId: 'system' }]);
    });

    socket.on('new-public-message', (message: Omit<ChatMessage, 'isMe'>) => {
      // Don't add our own message again if we're receiving the broadcast
      if (message.senderId === user.uid) return;
      setChatHistory(prev => [...prev, { ...message, isMe: false }]);
    });
    
    socket.on('new-private-message', (message: Omit<ChatMessage, 'isMe'>) => {
      if (message.senderId === user.uid) return; // Don't re-add own private message
      setChatHistory(prev => [...prev, { ...message, isMe: false }]);
    });

    return () => {
      socket.disconnect();
    };
  }, [user, meetingId, topic]);

  useEffect(() => {
    if (scrollViewportRef.current) {
        scrollViewportRef.current.scrollTo({ top: scrollViewportRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [chatHistory]);

  const handleSendMessage = () => {
    if (!inputValue.trim() || !user || !socketRef.current) return;
    
    const isPrivate = activeTab !== 'public';
    
    const message: Omit<ChatMessage, 'isMe'> = {
      id: `${socketRef.current.id}-${Date.now()}`,
      senderId: user.uid,
      senderName: user.displayName || 'User',
      senderAvatar: user.photoURL || undefined,
      text: inputValue,
      timestamp: new Date(),
      isPrivate,
    };

    if (isPrivate) {
      // @ts-ignore
      message.recipientId = activeTab;
      socketRef.current.emit("private-chat-message", meetingId, message);
    } else {
      socketRef.current.emit("public-chat-message", meetingId, message);
       try {
            const LATEST_ACTIVITY_KEY = `${LATEST_ACTIVITY_KEY_PREFIX}${user.uid}`;
            const rawActivity = localStorage.getItem(LATEST_ACTIVITY_KEY);
            let activities = rawActivity ? JSON.parse(rawActivity) : [];
            if (!Array.isArray(activities)) activities = [];

            const newNotification: PublicChatActivityItem = {
              id: message.id,
              type: 'publicChat',
              title: `New Message from ${message.senderName}`,
              text: message.text,
              timestamp: Date.now(),
              senderId: message.senderId,
              senderName: message.senderName,
              meetingId: meetingId,
              meetingTopic: topic,
            };
            activities.unshift(newNotification);
            
            localStorage.setItem(LATEST_ACTIVITY_KEY, JSON.stringify(activities.slice(0, 20))); // Keep last 20 activities
            window.dispatchEvent(new CustomEvent('teachmeet_activity_updated'));
        } catch (e) {
            console.error("Failed to update latest activity in localStorage", e);
        }
    }
    // Add message to local state immediately for instant feedback
    setChatHistory(prev => [...prev, { ...message, isMe: true }]);
    setInputValue("");
  };
  
  const backToMeetingParams = new URLSearchParams();
  if (topic) backToMeetingParams.set('topic', topic);
  if (cam) backToMeetingParams.set('cam', cam);
  if (mic) backToMeetingParams.set('mic', mic);
  const backToMeetingLink = `/dashboard/meeting/${meetingId}?${backToMeetingParams.toString()}`;

  const messagesToDisplay = chatHistory.filter(msg => {
    if (activeTab === 'public') return !msg.isPrivate;
    return msg.isPrivate && ((msg.recipientId === activeTab && msg.senderId === user?.uid) || (msg.senderId === activeTab && msg.recipientId === user?.uid));
  });

  return (
    <div className="flex flex-col h-full bg-muted/30">
      <header className="flex-none p-3 border-b bg-background shadow-sm">
        <div className="container mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
             <MessageSquare className="h-7 w-7 text-primary" />
             <h1 className="text-xl font-semibold text-foreground truncate" title={topic}>
                {privateWithName && activeTab === privateWithId ? `Chat with ${privateWithName}` : topic}
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

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-none bg-background shadow-md">
        <TabsList className="container mx-auto rounded-none border-b p-0 h-12">
            <TabsTrigger value="public" className="h-full rounded-none data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none px-4">
                <Users className="mr-2 h-5 w-5" /> Public Chat
            </TabsTrigger>
            {privateWithId && (
                 <TabsTrigger value={privateWithId} className="h-full rounded-none data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none px-4">
                    <User className="mr-2 h-5 w-5" /> Private: {privateWithName}
                </TabsTrigger>
            )}
        </TabsList>
      </Tabs>
      
      <main className="flex-grow flex flex-col overflow-hidden">
        {isConnecting ? (
            <div className="flex-grow flex flex-col items-center justify-center text-muted-foreground">
                <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
                <p>Connecting to chat...</p>
            </div>
        ) : (
            <Card className="w-full h-full max-w-full text-center shadow-none rounded-none border-0 flex flex-col">
              <CardContent className="flex-grow p-0 overflow-hidden">
                <ScrollArea className="h-full">
                    <div className="p-4 md:p-6 space-y-4" ref={scrollViewportRef}>
                      {messagesToDisplay.map((msg) => (
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
                               msg.senderId === 'system' ? 'bg-muted text-muted-foreground text-center text-xs w-full' : 
                              msg.isMe ? "bg-primary text-primary-foreground rounded-br-none" : "bg-card text-card-foreground rounded-bl-none"
                            )}
                          >
                            {!msg.isMe && msg.senderId !== 'system' && <p className="text-xs font-medium mb-0.5">{msg.senderName}</p>}
                            <p className="text-sm whitespace-pre-wrap">{msg.text}</p>
                            {msg.senderId !== 'system' && <p className="text-xs opacity-70 mt-1 text-right">{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>}
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
                    placeholder={privateWithName && activeTab === privateWithId ? `Private message to ${privateWithName}...` : "Type your message..."}
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
        )}
      </main>
       <footer className="flex-none p-2 text-center text-xs text-muted-foreground border-t bg-background">
        Chat history is cleared after the meeting ends.
      </footer>
    </div>
  );
}
