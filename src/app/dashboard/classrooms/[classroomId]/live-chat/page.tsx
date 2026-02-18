'use client';

/**
 * @fileOverview A new classroom live chat page implementation.
 * Performs a permission pre-check against the participants sub-collection before allowing access.
 */

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
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
  getDoc,
  getDocs
} from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Send, ArrowLeft, ShieldAlert } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Message {
  id: string;
  senderId: string;
  text: string;
  timestamp: any;
}

interface ParticipantMap {
  [uid: string]: {
    name: string;
    photoURL?: string;
  };
}

export default function LiveChatPage() {
  const { classroomId } = useParams() as { classroomId: string };
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const router = useRouter();

  const [messages, setMessages] = useState<Message[]>([]);
  const [participants, setParticipants] = useState<ParticipantMap>({});
  const [inputValue, setInputValue] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isCheckingPermissions, setIsCheckingPermissions] = useState(true);
  const [hasPermission, setHasPermission] = useState(false);
  const [isLoadingMessages, setIsLoading] = useState(true);

  const scrollRef = useRef<HTMLDivElement>(null);

  // 1. Permission Pre-Check & Participant Loading
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push('/auth/signin');
      return;
    }

    const checkPermissionAndLoadParticipants = async () => {
      try {
        const participantRef = doc(db, 'classrooms', classroomId, 'participants', user.uid);
        const participantSnap = await getDoc(participantRef);

        if (participantSnap.exists()) {
          setHasPermission(true);
          // Fetch all participants to resolve names in chat
          const participantsSnap = await getDocs(collection(db, 'classrooms', classroomId, 'participants'));
          const pMap: ParticipantMap = {};
          participantsSnap.forEach(d => {
            const data = d.data();
            pMap[d.id] = { name: data.name || 'User', photoURL: data.photoURL };
          });
          setParticipants(pMap);
        } else {
          setHasPermission(false);
        }
      } catch (error) {
        console.error("Permission check failed:", error);
        setHasPermission(false);
      } finally {
        setIsCheckingPermissions(false);
      }
    };

    checkPermissionAndLoadParticipants();
  }, [classroomId, user, authLoading, router]);

  // 2. Real-time Message Listener
  useEffect(() => {
    if (!hasPermission || !classroomId) return;

    const q = query(
      collection(db, 'classrooms', classroomId, 'messages'),
      orderBy('timestamp', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(d => ({
        id: d.id,
        ...d.data()
      })) as Message[];
      setMessages(msgs);
      setIsLoading(false);
    }, (error) => {
      console.error("Chat listener error:", error);
      toast({
        variant: 'destructive',
        title: 'Connection Error',
        description: 'You might not have permission to view messages.'
      });
    });

    return () => unsubscribe();
  }, [classroomId, hasPermission, toast]);

  // 3. Auto-scroll to latest message
  useEffect(() => {
    if (scrollRef.current) {
      const scrollContainer = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || !user || !hasPermission || isSending) return;

    setIsSending(true);
    const messageText = inputValue.trim();
    setInputValue('');

    try {
      // STRICT: Only send senderId, text, and timestamp as per rules
      await addDoc(collection(db, 'classrooms', classroomId, 'messages'), {
        senderId: user.uid,
        text: messageText,
        timestamp: serverTimestamp()
      });
    } catch (error: any) {
      console.error("Send message failed:", error);
      setInputValue(messageText); // Restore input on failure
      toast({
        variant: 'destructive',
        title: 'Message failed',
        description: error.message || 'Missing permissions to chat.'
      });
    } finally {
      setIsSending(false);
    }
  };

  if (authLoading || isCheckingPermissions) {
    return (
      <div className="h-full flex flex-col items-center justify-center space-y-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground font-bold tracking-tighter uppercase">Authenticating Access...</p>
      </div>
    );
  }

  if (!hasPermission) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 text-center space-y-6">
        <div className="h-20 w-20 rounded-full bg-destructive/10 flex items-center justify-center">
          <ShieldAlert className="h-10 w-10 text-destructive" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold">Access Denied</h1>
          <p className="text-muted-foreground max-w-md">
            You are not currently enrolled in this classroom. Only approved students and teachers can participate in the chat.
          </p>
        </div>
        <Button onClick={() => router.back()} variant="outline" className="rounded-xl">
          <ArrowLeft className="mr-2 h-4 w-4" /> Go Back
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden">
      <header className="flex-none p-4 border-b flex items-center gap-4 bg-card/50 backdrop-blur-md">
        <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full h-10 w-10">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold truncate">Live Classroom Chat</h1>
          <p className="text-[10px] text-primary font-black uppercase tracking-widest leading-none">Safe Environment</p>
        </div>
      </header>

      <main className="flex-1 min-h-0 bg-muted/10">
        <ScrollArea className="h-full" ref={scrollRef}>
          <div className="p-4 md:p-6 space-y-6 max-w-4xl mx-auto">
            {isLoadingMessages && messages.length === 0 ? (
              <div className="py-20 text-center space-y-4">
                <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary/50" />
                <p className="text-sm text-muted-foreground">Syncing history...</p>
              </div>
            ) : messages.length === 0 ? (
              <div className="py-20 text-center space-y-2">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                    <Send className="h-6 w-6 text-primary opacity-50" />
                </div>
                <p className="text-sm font-medium text-muted-foreground">The conversation starts here.</p>
                <p className="text-xs text-muted-foreground italic">Type a message below to begin.</p>
              </div>
            ) : (
              messages.map((msg) => {
                const isMe = msg.senderId === user?.uid;
                const sender = participants[msg.senderId] || { name: 'User' };
                
                return (
                  <div key={msg.id} className={cn("flex flex-col animate-in fade-in slide-in-from-bottom-2 duration-300", isMe ? "items-end" : "items-start")}>
                    <div className={cn("flex items-end gap-2 max-w-[85%]", isMe && "flex-row-reverse")}>
                      <Avatar className="h-8 w-8 shrink-0 border border-border shadow-sm">
                        <AvatarImage src={sender.photoURL} data-ai-hint="avatar user" />
                        <AvatarFallback>{sender.name.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <div className={cn(
                        "p-3 rounded-2xl shadow-sm border transition-all",
                        isMe 
                            ? "bg-primary text-primary-foreground rounded-tr-none border-primary" 
                            : "bg-card text-foreground rounded-tl-none border-border/50"
                      )}>
                        {!isMe && <p className="text-[9px] font-black uppercase mb-1 opacity-60 tracking-[0.1em]">{sender.name}</p>}
                        <p className="text-sm whitespace-pre-wrap break-words leading-relaxed font-medium">{msg.text}</p>
                      </div>
                    </div>
                    <span className="text-[8px] text-muted-foreground mt-1 px-1 font-bold uppercase">
                      {msg.timestamp?.toDate ? msg.timestamp.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Sending...'}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </ScrollArea>
      </main>

      <footer className="flex-none p-4 border-t bg-card/80 backdrop-blur-md">
        <form onSubmit={handleSendMessage} className="flex gap-3 max-w-4xl mx-auto">
          <Input 
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Type a message to the class..."
            className="rounded-xl h-12 bg-background border-border/50 focus:ring-primary shadow-sm text-base"
            disabled={isSending}
            autoComplete="off"
          />
          <Button type="submit" disabled={isSending || !inputValue.trim()} className="h-12 w-12 rounded-xl btn-gel shrink-0 p-0 shadow-lg">
            {isSending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
          </Button>
        </form>
        <p className="text-center text-[9px] text-muted-foreground mt-2 font-medium uppercase tracking-tighter">Your messages are visible to everyone in the class.</p>
      </footer>
    </div>
  );
}
