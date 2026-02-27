'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { db } from '@/lib/firebase';
import { 
  collection, 
  query, 
  onSnapshot, 
  orderBy, 
  addDoc, 
  serverTimestamp, 
  doc, 
  getDoc 
} from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Send, ArrowLeft, ShieldAlert } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  text: string;
  createdAt: any;
}

export default function MeetingChatPage() {
  const { meetingId } = useParams() as { meetingId: string };
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const topic = searchParams.get('topic') || "Meeting Chat";

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isCheckingParticipant, setIsCheckingParticipant] = useState(true);
  const [hasAccess, setHasHasAccess] = useState(false);
  
  const bottomRef = useRef<HTMLDivElement>(null);

  // 1. Check If User Is Participant
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push('/auth/signin');
      return;
    }

    const checkAccess = async () => {
      try {
        const participantRef = doc(db, "meetings", meetingId, "participants", user.uid);
        const snap = await getDoc(participantRef);
        if (!snap.exists()) {
          setHasHasAccess(false);
        } else {
          setHasHasAccess(true);
        }
      } catch (err) {
        console.error("Access check failed:", err);
        setHasHasAccess(false);
      } finally {
        setIsCheckingParticipant(false);
      }
    };

    checkAccess();
  }, [user, meetingId, authLoading, router]);

  // 2. Real-Time Message Listener
  useEffect(() => {
    if (!hasAccess || !meetingId) return;

    const q = query(
      collection(db, "meetings", meetingId, "messages"),
      orderBy("createdAt", "asc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as ChatMessage[];
      setMessages(msgs);
    }, (error) => {
      console.error("Chat listener failed:", error);
      toast({
        variant: "destructive",
        title: "Connection Error",
        description: "Failed to load messages. Please try again.",
      });
    });

    return () => unsubscribe();
  }, [meetingId, hasAccess, toast]);

  // 3. Auto Scroll to Bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // 4. Send Message Function
  const sendMessage = async () => {
    if (!inputValue.trim() || !user || !hasAccess || isSending) return;

    setIsSending(true);
    const text = inputValue.trim();
    setInputValue('');

    try {
      await addDoc(collection(db, "meetings", meetingId, "messages"), {
        senderId: user.uid,
        senderName: user.displayName || "User",
        senderAvatar: user.photoURL || "",
        text: text,
        createdAt: serverTimestamp(),
      });
    } catch (error: any) {
      console.error("Send failed:", error);
      setInputValue(text); // Restore text on failure
      toast({
        variant: "destructive",
        title: "Message Failed",
        description: error.message || "You don't have permission to chat.",
      });
    } finally {
      setIsSending(false);
    }
  };

  if (authLoading || isCheckingParticipant) {
    return (
      <div className="h-full flex flex-col items-center justify-center space-y-4 bg-background">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground font-bold uppercase tracking-widest">Validating Access...</p>
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 text-center space-y-6 bg-background">
        <div className="h-24 w-24 rounded-full bg-destructive/10 flex items-center justify-center">
          <ShieldAlert className="h-12 w-12 text-destructive" />
        </div>
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Access Denied</h1>
          <p className="text-muted-foreground max-w-md mx-auto">
            You must be an approved participant of this meeting to access the chat.
          </p>
        </div>
        <Button onClick={() => router.back()} variant="outline" className="rounded-xl px-8 h-12 text-base font-bold">
          <ArrowLeft className="mr-2 h-5 w-5" /> Go Back
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-muted/30 overflow-hidden">
      {/* Header */}
      <header className="flex-none p-4 border-b bg-background/80 backdrop-blur-md flex items-center gap-4 sticky top-0 z-10">
        <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full h-10 w-10">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <h2 className="font-bold text-lg truncate leading-tight">{topic}</h2>
          <p className="text-[10px] text-primary font-black uppercase tracking-widest leading-none">Meeting Chat</p>
        </div>
      </header>

      {/* Chat Messages Area */}
      <main className="flex-1 min-h-0 overflow-hidden relative">
        <ScrollArea className="h-full">
          <div className="p-4 md:p-6 space-y-6 max-w-4xl mx-auto">
            {messages.length === 0 ? (
              <div className="py-20 text-center space-y-4">
                <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <Send className="h-8 w-8 text-primary opacity-50" />
                </div>
                <p className="text-lg font-medium text-muted-foreground">No messages yet.</p>
                <p className="text-sm text-muted-foreground italic">Be the first to start the conversation!</p>
              </div>
            ) : (
              messages.map((msg) => {
                const isMe = msg.senderId === user?.uid;
                return (
                  <div 
                    key={msg.id} 
                    className={cn(
                      "flex flex-col animate-in fade-in slide-in-from-bottom-2 duration-300", 
                      isMe ? "items-end" : "items-start"
                    )}
                  >
                    <div className={cn("flex items-end gap-3 max-w-[85%]", isMe && "flex-row-reverse")}>
                      <Avatar className="h-9 w-9 shrink-0 border border-border shadow-sm">
                        <AvatarImage src={msg.senderAvatar} data-ai-hint="avatar user" />
                        <AvatarFallback className="bg-muted text-muted-foreground font-bold">
                          {msg.senderName.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className={cn(
                        "p-4 rounded-3xl shadow-sm border transition-all",
                        isMe 
                          ? "bg-primary text-primary-foreground rounded-tr-none border-primary" 
                          : "bg-background text-foreground rounded-tl-none border-border/50"
                      )}>
                        {!isMe && <p className="text-[10px] font-black uppercase opacity-60 mb-1 tracking-wider">{msg.senderName}</p>}
                        <p className="text-sm whitespace-pre-wrap break-words leading-relaxed font-medium">{msg.text}</p>
                      </div>
                    </div>
                    <span className="text-[9px] text-muted-foreground mt-1.5 px-1 font-bold uppercase tracking-tighter">
                      {msg.createdAt?.toDate ? msg.createdAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Sending...'}
                    </span>
                  </div>
                );
              })
            )}
            <div ref={bottomRef} className="h-2" />
          </div>
        </ScrollArea>
      </main>

      {/* Input Box */}
      <footer className="flex-none p-4 border-t bg-background/80 backdrop-blur-md">
        <form 
          onSubmit={(e) => { e.preventDefault(); sendMessage(); }}
          className="flex gap-3 max-w-4xl mx-auto"
        >
          <Input 
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), sendMessage())}
            placeholder="Type a message to the team..."
            className="flex-1 rounded-2xl h-14 bg-muted/50 border-border/50 focus:ring-primary text-base px-6 shadow-inner"
            disabled={isSending}
            autoComplete="off"
          />
          <Button 
            type="submit" 
            disabled={isSending || !inputValue.trim()} 
            className="h-14 w-14 rounded-2xl btn-gel shrink-0 p-0 shadow-lg"
          >
            {isSending ? <Loader2 className="h-6 w-6 animate-spin" /> : <Send className="h-6 w-6" />}
          </Button>
        </form>
        <p className="text-center text-[10px] text-muted-foreground mt-3 font-medium uppercase tracking-tighter">
          Messages are visible to everyone currently in the meeting.
        </p>
      </footer>
    </div>
  );
}