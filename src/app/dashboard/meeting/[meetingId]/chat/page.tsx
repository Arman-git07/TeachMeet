
'use client';

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Send, MessageSquare, Users, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useMeetingRTC } from "@/contexts/MeetingRTCContext";

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  text: string;
  timestamp: Date;
  isMe: boolean;
  isPrivate: boolean;
  recipientId?: string;
}

export interface PublicChatActivityItem {
    type: 'publicChat';
    id: string;
    title: string; // "New Message in [Topic]"
    text: string;
    timestamp: number;
    senderId: string;
    senderName: string;
    meetingId: string;
    meetingTopic: string;
}

const LATEST_ACTIVITY_KEY_PREFIX = 'teachmeet-latest-activity-';

export default function MeetingChatPage({ params }: { params: { meetingId: string } }) {
  const { meetingId } = params;
  const searchParams = useSearchParams();
  const topic = searchParams.get('topic') || "Meeting Chat";
  const cam = searchParams.get('cam');
  const mic = searchParams.get('mic');

  const { user } = useAuth();
  const { rtc, chatHistory, setChatHistory } = useMeetingRTC();
  const [inputValue, setInputValue] = useState("");
  const scrollViewportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!rtc || rtc.hasRegisteredChatHandlers) return;
    
    const handleNewMessage = (message: ChatMessage) => {
      // Don't add private messages to public chat history
      if(message.isPrivate) return;

      setChatHistory(prev => [...prev, message]);
      
      if (!message.isMe && user) {
        try {
          const LATEST_ACTIVITY_KEY = `${LATEST_ACTIVITY_KEY_PREFIX}${user.uid}`;
          let activities = [];
          const rawActivity = localStorage.getItem(LATEST_ACTIVITY_KEY);
          if (rawActivity) {
            activities = JSON.parse(rawActivity);
            if (!Array.isArray(activities)) activities = [];
          }
          const newNotification: PublicChatActivityItem = {
            type: 'publicChat',
            id: message.id,
            title: `New Message in ${topic}`,
            text: `${message.senderName}: ${message.text}`,
            timestamp: new Date(message.timestamp).getTime(),
            senderId: message.senderId,
            senderName: message.senderName,
            meetingId: meetingId,
            meetingTopic: topic,
          };
          activities.unshift(newNotification);
          localStorage.setItem(LATEST_ACTIVITY_KEY, JSON.stringify(activities.slice(0, 20)));
          window.dispatchEvent(new CustomEvent('teachmeet_activity_updated'));
        } catch(e) {
            console.error("Failed to write chat notification to localStorage", e);
        }
      }
    };
    rtc.registerChatHandlers(handleNewMessage);

    if (chatHistory.length === 0) {
        setChatHistory([{ 
            id: 'welcome', 
            senderId: 'system',
            senderName: 'System', 
            text: `Welcome to the public chat for ${topic}.`, 
            timestamp: new Date(), 
            isMe: false,
            isPrivate: false,
        }]);
    }

  }, [rtc, setChatHistory, chatHistory.length, topic, user, meetingId]);
  
  useEffect(() => {
    if (scrollViewportRef.current) {
        scrollViewportRef.current.scrollTo({ top: scrollViewportRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [chatHistory]);
  
  const handleSendMessage = () => {
    if (!inputValue.trim() || !user || !rtc) return;
    
    rtc.sendPublicMessage(inputValue);
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
             <Users className="h-7 w-7 text-primary" />
             <h1 className="text-xl font-semibold text-foreground truncate" title={topic}>
                {`Public Chat: ${topic}`}
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
                  {chatHistory.map((msg) => (
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
                placeholder="Type your message to everyone..."
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
       <footer className="flex-none p-2 text-center text-xs text-muted-foreground border-t bg-background">
        {rtc ? 'Connected to chat.' : 'Connecting to chat...'}
      </footer>
    </div>
  );
}
