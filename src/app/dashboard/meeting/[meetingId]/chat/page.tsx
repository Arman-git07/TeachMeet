
'use client';

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Send, MessageSquare, User, Users, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect, useRef, useMemo } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useMeetingRTC } from "@/contexts/MeetingRTCContext";
import { useBlock } from "@/contexts/BlockContext";

export interface PublicChatActivityItem {
  type: 'publicChat';
  id: string;
  title: string;
  text: string;
  timestamp: number;
  senderId: string;
  senderName: string;
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

  const { user } = useAuth();
  const { toast } = useToast();
  const { rtc, chatHistory, setChatHistory } = useMeetingRTC();
  const { isBlockedByMe, amIBlockedBy } = useBlock();

  const [inputValue, setInputValue] = useState("");
  const scrollViewportRef = useRef<HTMLDivElement>(null);
  
  const [activeTab, setActiveTab] = useState(privateWithId ? privateWithId : 'public');

  const isConnecting = !rtc || !rtc.socket.connected;

  useEffect(() => {
    if (chatHistory.length === 0) {
       setChatHistory([{ id: 'welcome', senderName: 'System', text: `Welcome to the chat for ${topic}. Messages are not persisted after the meeting.`, timestamp: new Date(), isMe: false, isPrivate: false, senderId: 'system' }]);
    }
  }, [topic, chatHistory.length, setChatHistory]);
  
  useEffect(() => {
    if (scrollViewportRef.current) {
        scrollViewportRef.current.scrollTo({ top: scrollViewportRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [chatHistory]);
  
  const isPrivateChatBlocked = useMemo(() => {
    if (activeTab === 'public' || !user) return false;
    // You can't message someone if YOU have blocked them, or THEY have blocked you.
    return isBlockedByMe(activeTab, 'privateChat') || amIBlockedBy(activeTab, 'privateChat');
  }, [activeTab, user, isBlockedByMe, amIBlockedBy]);

  const handleSendMessage = () => {
    if (!inputValue.trim() || !user || !rtc || isPrivateChatBlocked) return;
    
    const isPrivate = activeTab !== 'public';
    
    if (isPrivate) {
      rtc.sendPrivateMessage(activeTab, inputValue);
    } else {
      rtc.sendPublicMessage(inputValue);
    }
    
    setInputValue("");
  };
  
  const backToMeetingParams = new URLSearchParams();
  if (topic) backToMeetingParams.set('topic', topic);
  if (cam) backToMeetingParams.set('cam', cam);
  if (mic) backToMeetingParams.set('mic', mic);
  const backToMeetingLink = `/dashboard/meeting/${meetingId}?${backToMeetingParams.toString()}`;

  const messagesToDisplay = chatHistory.filter(msg => {
    // Hide messages in public chat if sender is blocked
    if (activeTab === 'public') {
      if(msg.isPrivate) return false;
      if (isBlockedByMe(msg.senderId, 'publicChat')) return false; 
      // Also hide public messages from people who have blocked me
      if (amIBlockedBy(msg.senderId, 'publicChat')) return false;
      return true;
    }
    // For private tab, show messages between me and the other person
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
            {privateWithId && !isPrivateChatBlocked && (
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
                    placeholder={isPrivateChatBlocked ? "You cannot chat with this user." : (privateWithName && activeTab === privateWithId ? `Private message to ${privateWithName}...` : "Type your message...")}
                    className="flex-grow rounded-lg border-border/80 focus:ring-primary text-sm min-h-[40px] max-h-[120px]"
                    rows={1}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                    disabled={isPrivateChatBlocked}
                  />
                  <Button type="submit" size="icon" className="rounded-lg btn-gel w-10 h-10" disabled={!inputValue.trim() || isPrivateChatBlocked}>
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
