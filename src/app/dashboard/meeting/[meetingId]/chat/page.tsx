
'use client';

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Send, MessageSquare, User, Users } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { io, Socket } from "socket.io-client";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface ChatMessage {
  id: string;
  senderName: string;
  senderAvatar?: string;
  senderId: string;
  recipientId?: string; // For private messages
  text: string;
  timestamp: Date;
  isMe: boolean;
  isPrivate: boolean;
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

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const { user } = useAuth();
  const socketRef = useRef<Socket | null>(null);
  const scrollViewportRef = useRef<HTMLDivElement>(null);
  
  const [activeTab, setActiveTab] = useState(privateWithId ? privateWithId : 'public');

  useEffect(() => {
    if (!user) return;

    const socket = io({
      path: "/api/socketio",
      query: { userId: user.uid, displayName: user.displayName, photoURL: user.photoURL || '' },
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      socket.emit("join-room", meetingId, user.uid);
    });

    socket.on("new-public-message", (message: Omit<ChatMessage, 'isMe' | 'isPrivate'>) => {
      if (activeTab === 'public') {
        setMessages((prev) => [
          ...prev,
          { ...message, timestamp: new Date(message.timestamp), isMe: message.senderId === user.uid, isPrivate: false },
        ]);
      }
    });

    socket.on("new-private-message", (message: Omit<ChatMessage, 'isMe' | 'isPrivate'>) => {
        const currentPrivateChatId = activeTab;
        const relevantPartyId = message.senderId === user.uid ? message.recipientId : message.senderId;

        if (currentPrivateChatId === relevantPartyId) {
            setMessages((prev) => [
                ...prev,
                { ...message, timestamp: new Date(message.timestamp), isMe: message.senderId === user.uid, isPrivate: true },
            ]);
        }
    });

    return () => {
      socket.disconnect();
    };
  }, [meetingId, user, activeTab]);

  // Effect to handle tab changes and set initial system messages
  useEffect(() => {
      if (activeTab === 'public') {
          setMessages([
              { id: 'sys_public_switch', senderName: 'System', text: `Welcome to the public chat for "${topic}". Messages are not persisted.`, timestamp: new Date(), isMe: false, isPrivate: false, senderId: 'system' }
          ]);
      } else if (activeTab === privateWithId && privateWithName) {
          setMessages([
            { id: 'sys_private_switch', senderName: 'System', text: `This is a private chat with ${privateWithName}. Messages are not persisted.`, timestamp: new Date(), isMe: false, isPrivate: true, senderId: 'system' }
          ]);
      } else {
        // Fallback or clear if tab is unknown
        setMessages([]);
      }
  }, [activeTab, privateWithId, privateWithName, topic]);


  useEffect(() => {
    if (scrollViewportRef.current) {
        scrollViewportRef.current.scrollTo({ top: scrollViewportRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [messages]);

  const notifyOtherComponents = (message: any) => {
    if (!user) return;
    try {
        const LATEST_ACTIVITY_KEY = `${LATEST_ACTIVITY_KEY_PREFIX}${user.uid}`;
        const newNotification = {
            id: `publicChat-${message.id}`,
            type: 'publicChat',
            title: `New Message from ${message.senderName}`,
            text: message.text,
            timestamp: Date.now(),
            senderId: message.senderId,
            meetingId: meetingId,
            meetingTopic: topic,
        };
        // In a real multi-user app, we'd get all users and write to their localStorage
        // For this simulation, we'll just write to our own to trigger the event for this user.
        // A real implementation would involve the server pushing this update to all clients.
        localStorage.setItem(LATEST_ACTIVITY_KEY, JSON.stringify([newNotification]));
        window.dispatchEvent(new CustomEvent('teachmeet_activity_updated'));
    } catch (e) {
        console.error("Failed to update latest activity for chat notification", e);
    }
  };

  const handleSendMessage = () => {
    if (!inputValue.trim() || !user || !socketRef.current) return;
    
    const isPrivate = activeTab !== 'public';

    if (isPrivate) {
      const recipientId = activeTab;
      const privateMessage = {
          id: Date.now().toString(),
          senderId: user.uid,
          senderName: user.displayName || 'You',
          senderAvatar: user.photoURL || undefined,
          recipientId: recipientId,
          text: inputValue,
          timestamp: new Date(),
          isPrivate: true,
      };
      socketRef.current.emit('private-chat-message', meetingId, privateMessage);

    } else {
       const publicMessage = {
        id: Date.now().toString(),
        senderId: user.uid,
        senderName: user.displayName || 'Anonymous',
        senderAvatar: user.photoURL || undefined,
        text: inputValue,
        timestamp: new Date(),
        isPrivate: false,
      };
      socketRef.current.emit('public-chat-message', meetingId, publicMessage);
      notifyOtherComponents(publicMessage);
    }
    setInputValue("");
  };
  
  const backToMeetingParams = new URLSearchParams();
  if (topic) backToMeetingParams.set('topic', topic);
  if (cam) backToMeetingParams.set('cam', cam);
  if (mic) backToMeetingParams.set('mic', mic);
  const backToMeetingLink = `/dashboard/meeting/${meetingId}?${backToMeetingParams.toString()}`;


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
      </main>
       <footer className="flex-none p-2 text-center text-xs text-muted-foreground border-t bg-background">
        Chat messages are not stored.
      </footer>
    </div>
  );
}
