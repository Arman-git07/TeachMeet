'use client';

import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ArrowLeft, Send, MessageSquare, Loader2, UserCircle } from "lucide-react";
import { db, auth } from "@/lib/firebase";
import { collection, query, where, onSnapshot, orderBy, limit, addDoc, serverTimestamp, getDoc, doc } from 'firebase/firestore';
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useAuth } from '@/hooks/useAuth';

interface PrivateMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: any;
  isMe: boolean;
}

export default function PrivateChatPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const otherUserId = params.userId as string;
  const initialName = searchParams.get('name');
  
  const { user } = useAuth();
  const { toast } = useToast();
  const router = useRouter();

  const [messages, setMessages] = useState<PrivateMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [otherUserName, setOtherUserName] = useState(initialName || "User");
  const [isLoadingUser, setIsLoadingUser] = useState(!initialName);

  const scrollViewportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!otherUserId || !initialName) {
        const fetchUser = async () => {
            try {
                const snap = await getDoc(doc(db, 'users', otherUserId));
                if (snap.exists()) {
                    setOtherUserName(snap.data().name || "User");
                }
            } catch (e) {
                console.error("User fetch failed:", e);
            } finally {
                setIsLoadingUser(false);
            }
        };
        fetchUser();
    }
  }, [otherUserId, initialName]);

  useEffect(() => {
    if (!otherUserId || !user) return;

    const chatId = [user.uid, otherUserId].sort().join('_');
    const messagesQuery = query(
      collection(db, 'privateMessages'),
      where('chatId', '==', chatId),
      orderBy('timestamp', 'asc'),
      limit(100)
    );

    const unsubscribe = onSnapshot(messagesQuery, (snapshot) => {
      const fetched = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          isMe: data.senderId === user.uid
        } as PrivateMessage;
      });
      setMessages(fetched);
      
      setTimeout(() => {
        if (scrollViewportRef.current) {
            scrollViewportRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
        }
      }, 100);
    }, (err) => {
        console.error("Private chat sync error:", err);
        toast({ variant: 'destructive', title: "Chat Disconnected", description: "You may not have permission to view this chat." });
    });

    return () => unsubscribe();
  }, [otherUserId, user, toast]);

  const handleSendMessage = async () => {
    if (!inputValue.trim() || !user || !otherUserId || isSending) return;

    const textToSend = inputValue.trim();
    setIsSending(true);
    setInputValue("");

    try {
      await addDoc(collection(db, 'privateMessages'), {
        chatId: [user.uid, otherUserId].sort().join('_'),
        senderId: user.uid,
        senderName: user.displayName || 'Anonymous',
        recipientId: otherUserId,
        text: textToSend,
        timestamp: serverTimestamp(),
      });
    } catch (error: any) {
      console.error("Failed to send private message:", error);
      setInputValue(textToSend);
      toast({ 
        variant: 'destructive', 
        title: "Message Failed", 
        description: "Could not send your private message."
      });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-background">
      <header className="flex-none p-4 border-b bg-card shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2">
            <Avatar className="h-8 w-8">
                <AvatarFallback><UserCircle className="h-6 w-6 opacity-50"/></AvatarFallback>
            </Avatar>
            <div>
                <h1 className="text-lg font-semibold">{otherUserName}</h1>
                <p className="text-[10px] uppercase text-muted-foreground font-bold tracking-widest">Private Conversation</p>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-grow overflow-hidden flex flex-col">
        <ScrollArea className="flex-1 p-4 md:p-6">
            <div className="space-y-4">
                {messages.map((msg) => (
                    <div key={msg.id} className={cn("flex flex-col", msg.isMe ? "items-end" : "items-start")}>
                        <div className={cn(
                            "max-w-[80%] p-3 rounded-2xl shadow-sm",
                            msg.isMe 
                                ? "bg-primary text-primary-foreground rounded-br-none" 
                                : "bg-muted text-foreground rounded-bl-none"
                        )}>
                            <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.text}</p>
                            <p className="text-[9px] opacity-60 mt-1.5 text-right">
                                {msg.timestamp?.toDate ? msg.timestamp.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '...'}
                            </p>
                        </div>
                    </div>
                ))}
                <div ref={scrollViewportRef} />
            </div>
        </ScrollArea>
      </main>

      <CardFooter className="p-4 border-t bg-card">
        <div className="flex w-full items-center gap-2">
            <Input
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Type a private message..."
                className="flex-grow rounded-full border-border focus:ring-primary h-11"
                onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                    }
                }}
                disabled={isSending}
            />
            <Button 
                size="icon" 
                className="rounded-full btn-gel w-11 h-11" 
                onClick={handleSendMessage}
                disabled={!inputValue.trim() || isSending}
            >
                {isSending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
            </Button>
        </div>
      </CardFooter>
    </div>
  );
}
