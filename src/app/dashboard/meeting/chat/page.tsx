
'use client';

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowLeft, Send, Users, MessageSquare, AtSign, Loader2, Mic, StopCircle } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams, useParams } from "next/navigation";
import { useState, useEffect, useRef, useCallback } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverAnchor } from "@/components/ui/popover";
import { db } from "@/lib/firebase";
import { doc, getDoc } from 'firebase/firestore';
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useMeetingRTC, type ChatMessage } from "@/contexts/MeetingRTCContext";
import { useBlock } from "@/contexts/BlockContext";

interface Participant {
  id: string;
  name: string;
  photoURL?: string;
}

const LATEST_ACTIVITY_KEY_PREFIX = 'teachmeet-latest-activity-';

export default function MeetingChatPage() {
  const { meetingId } = useParams() as { meetingId: string };
  const router = useRouter();
  const searchParams = useSearchParams();
  const topic = searchParams.get('topic') || "Meeting Chat";
  const privateWithId = searchParams.get('privateWith');
  const privateWithName = searchParams.get('privateWithName');

  const { toast } = useToast();
  const { user } = useAuth();
  const { rtc, chatHistory, addChatMessage } = useMeetingRTC();
  const { isBlockedByMe, amIBlockedBy } = useBlock();

  const [inputValue, setInputValue] = useState("");
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [isLoadingParticipants, setIsLoadingParticipants] = useState(true);
  const [showMentions, setShowMentions] = useState(false);

  const scrollViewportRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const isPrivateChat = !!privateWithId;
  const chatTitle = isPrivateChat ? `Chat with ${privateWithName}` : topic;

  useEffect(() => {
    async function fetchParticipants() {
      if (!meetingId) return;
      setIsLoadingParticipants(true);
      try {
        const pRef = doc(db, 'meetings', meetingId);
        const pSnap = await getDoc(pRef);

        if (pSnap.exists()) {
          // You need to actually fetch participant details from the subcollection.
          // This part of logic is missing, let's assume you fetch it from subcollection
        }
      } catch (error) {
        console.error("Failed to fetch participants:", error);
      } finally {
        setIsLoadingParticipants(false);
      }
    }
    fetchParticipants();
  }, [meetingId]);

  useEffect(() => {
    if (scrollViewportRef.current) {
        scrollViewportRef.current.scrollTo({ top: scrollViewportRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [chatHistory]);

  const handleSendMessage = useCallback(() => {
    if (!inputValue.trim() || !user || !rtc) return;
    
    if (isPrivateChat && isBlockedByMe(privateWithId, 'privateChat')) {
        toast({ variant: 'destructive', title: 'Message Not Sent', description: 'You have blocked this user.' });
        return;
    }
     if (isPrivateChat && amIBlockedBy(privateWithId, 'privateChat')) {
        toast({ variant: 'destructive', title: 'Message Not Sent', description: 'This user is unable to receive private messages from you.' });
        return;
    }

    const newMessage: ChatMessage = {
      id: `${Date.now()}-${user.uid}`,
      senderId: user.uid,
      senderName: user.displayName || 'You',
      senderAvatar: user.photoURL || undefined,
      text: inputValue,
      timestamp: Date.now(),
      isPrivate: isPrivateChat,
      recipientId: isPrivateChat ? privateWithId : undefined,
    };
    
    addChatMessage(newMessage);
    rtc.socket.emit('chat-message', newMessage);

    setInputValue("");
    inputRef.current?.focus();
  }, [inputValue, user, rtc, isPrivateChat, privateWithId, addChatMessage, toast, isBlockedByMe, amIBlockedBy]);

  const filteredMessages = chatHistory.filter(msg => {
    if (isPrivateChat) {
      // Show private messages between the two users
      return msg.isPrivate && 
             ((msg.senderId === user?.uid && msg.recipientId === privateWithId) || 
              (msg.senderId === privateWithId && msg.recipientId === user?.uid));
    }
    // Show public messages, but filter out ones from users I've blocked
    return !msg.isPrivate && !isBlockedByMe(msg.senderId, 'publicChat');
  });

  const backToMeetingParams = new URLSearchParams(searchParams.toString());
  backToMeetingParams.delete('privateWith');
  backToMeetingParams.delete('privateWithName');
  const backToMeetingLink = `/dashboard/meeting/${meetingId}?${backToMeetingParams.toString()}`;

  return (
    <div className="flex flex-col h-full bg-muted/30">
      <header className="flex-none p-3 border-b bg-background shadow-sm">
        <div className="container mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <MessageSquare className="h-7 w-7 text-primary" />
            <h1 className="text-xl font-semibold text-foreground truncate" title={chatTitle}>
              {chatTitle}
            </h1>
            {isPrivateChat && <Badge variant="secondary">Private</Badge>}
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
                  {filteredMessages.map((msg) => (
                    <div key={msg.id} className={cn("flex items-end gap-2", msg.senderId === user?.uid ? "justify-end" : "justify-start")}>
                      {msg.senderId !== user?.uid && (
                        <Avatar className="h-8 w-8 self-start">
                          <AvatarImage src={msg.senderAvatar || `https://placehold.co/40x40.png?text=${msg.senderName.charAt(0)}`} alt={msg.senderName} data-ai-hint="avatar user" />
                          <AvatarFallback>{msg.senderName.charAt(0)}</AvatarFallback>
                        </Avatar>
                      )}
                      <div
                        className={cn(
                          "max-w-[70%] p-3 rounded-xl shadow",
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
                           <AvatarImage src={user?.photoURL || `https://placehold.co/40x40/00FFFF/000000.png?text=Y`} alt="You" data-ai-hint="avatar user" />
                          <AvatarFallback>{user?.displayName?.charAt(0) || 'Y'}</AvatarFallback>
                        </Avatar>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
          </CardContent>
          <CardFooter className="p-4 border-t bg-background">
            <div className="w-full relative">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSendMessage();
                  }}
                  className="flex w-full items-center gap-2"
                >
                  <Input
                    ref={inputRef}
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    placeholder="Type your message..."
                    className="flex-grow rounded-full border-border/80 focus:ring-primary text-sm h-10"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                  />
                  <Button type="submit" size="icon" className="rounded-full btn-gel w-10 h-10" disabled={!inputValue.trim()}>
                    <Send className="h-5 w-5" />
                    <span className="sr-only">Send message</span>
                  </Button>
                </form>
            </div>
          </CardFooter>
        </Card>
      </main>
    </div>
  );
}
