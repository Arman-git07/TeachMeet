'use client';

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Send, MessageSquare, Loader2, Mic, StopCircle, Volume2, AlertTriangle, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger, PopoverAnchor } from "@/components/ui/popover";
import { db, storage } from "@/lib/firebase";
import { doc, getDoc, collection, addDoc, serverTimestamp, query, orderBy, onSnapshot, limit, deleteDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useAuth } from "@/hooks/useAuth";
import { useClassroom } from "@/contexts/ClassroomContext";

interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  text?: string;
  audioUrl?: string;
  timestamp: any;
  isMe: boolean;
}

interface Participant {
  id: string;
  name: string;
  photoURL?: string;
}

export default function ClassroomChatPage() {
  const params = useParams();
  const classroomId = params?.classroomId as string;
  const router = useRouter();
  const { toast } = useToast();
  const { user } = useAuth();
  const { userRole } = useClassroom();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [isLoadingParticipants, setIsLoadingParticipants] = useState(true);
  const [showMentions, setShowMentions] = useState(false);
  
  const [isRecording, setIsRecording] = useState(false);
  const [hasMicPermission, setHasMicPermission] = useState<boolean | null>(null);
  const [isSending, setIsSending] = useState(false);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const scrollViewportRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Fetch Participants for Mentions
  useEffect(() => {
    if (!classroomId) return;
    setIsLoadingParticipants(true);
    
    // Fetch from the participants subcollection directly for accurate classroom context
    const unsub = onSnapshot(collection(db, 'classrooms', classroomId, 'participants'), (snapshot) => {
        const list = snapshot.docs.map(doc => ({
            id: doc.id,
            name: doc.data().name || 'Anonymous',
            photoURL: doc.data().photoURL
        } as Participant));
        setParticipants(list);
        setIsLoadingParticipants(false);
    }, (err) => {
        console.error("Mentions fetch failed:", err);
        setIsLoadingParticipants(false);
    });

    return () => unsub();
  }, [classroomId]);

  // Real-time Messages Listener
  useEffect(() => {
    if (!classroomId) return;

    const messagesQuery = query(
      collection(db, 'classrooms', classroomId, 'messages'),
      orderBy('timestamp', 'asc'),
      limit(100)
    );

    const unsubscribe = onSnapshot(messagesQuery, (snapshot) => {
      const fetchedMessages = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          isMe: data.senderId === user?.uid
        } as ChatMessage;
      });
      setMessages(fetchedMessages);
      
      // Auto-scroll to bottom
      setTimeout(() => {
        if (scrollViewportRef.current) {
            scrollViewportRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
        }
      }, 100);
    }, (error) => {
        console.error("Chat sync error:", error);
        toast({ 
            variant: 'destructive', 
            title: "Chat Disconnected", 
            description: "You may not have permission to view this chat. Ensure you are an approved member." 
        });
    });

    return () => unsubscribe();
  }, [classroomId, user, toast]);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setInputValue(value);
    
    const cursorPosition = e.target.selectionStart;
    const textBeforeCursor = value.substring(0, cursorPosition);
    const lastAt = textBeforeCursor.lastIndexOf('@');

    if (lastAt !== -1 && !textBeforeCursor.substring(lastAt + 1).includes(' ')) {
      setShowMentions(true);
    } else {
      setShowMentions(false);
    }
  };

  const handleMentionSelect = (name: string) => {
    const cursorPosition = textareaRef.current?.selectionStart || 0;
    const textBeforeCursor = inputValue.substring(0, cursorPosition);
    const lastAt = textBeforeCursor.lastIndexOf('@');

    const newValue = 
      inputValue.substring(0, lastAt) + 
      `@${name} ` + 
      inputValue.substring(cursorPosition);
    
    setInputValue(newValue);
    setShowMentions(false);
    
    setTimeout(() => {
        textareaRef.current?.focus();
        const newCursorPos = lastAt + name.length + 2;
        textareaRef.current?.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim() || !user || !classroomId || isSending) return;

    const textToSend = inputValue.trim();
    setIsSending(true);
    setInputValue("");
    setShowMentions(false);

    try {
      await addDoc(collection(db, 'classrooms', classroomId, 'messages'), {
        senderId: user.uid,
        senderName: user.displayName || 'Anonymous',
        senderAvatar: user.photoURL || null,
        text: textToSend,
        timestamp: serverTimestamp(),
      });
    } catch (error: any) {
      console.error("Failed to send message:", error);
      setInputValue(textToSend); // Restore input on failure
      toast({ 
        variant: 'destructive', 
        title: "Message Failed", 
        description: error.message?.includes('permission-denied') 
            ? "You don't have permission to chat in this room." 
            : "Could not send message. Please check your connection." 
      });
    } finally {
      setIsSending(false);
    }
  };
  
  const handleToggleRecording = async () => {
    if (isRecording) {
      mediaRecorderRef.current?.stop();
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setHasMicPermission(true);

      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setIsRecording(false);
        stream.getTracks().forEach(track => track.stop());

        const toastId = `upload-${Date.now()}`;
        toast({ id: toastId, title: "Sending voice note..." });

        try {
          const audioPath = `classrooms/${classroomId}/audio/${user?.uid}-${Date.now()}.webm`;
          const audioRef = ref(storage, audioPath);
          await uploadBytes(audioRef, audioBlob);
          const audioUrl = await getDownloadURL(audioRef);

          await addDoc(collection(db, 'classrooms', classroomId, 'messages'), {
            senderId: user?.uid,
            senderName: user?.displayName || 'Anonymous',
            senderAvatar: user?.photoURL || null,
            audioUrl: audioUrl,
            timestamp: serverTimestamp(),
          });
          toast.update(toastId, { title: "Voice note sent!" });
        } catch (error) {
          console.error("Voice note upload failed:", error);
          toast.update(toastId, { variant: 'destructive', title: "Upload Failed" });
        }
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
    } catch (error) {
      console.error("Mic access error:", error);
      setHasMicPermission(false);
      toast({ variant: 'destructive', title: "Mic Access Required" });
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    if (!classroomId || !messageId) return;
    
    try {
      await deleteDoc(doc(db, 'classrooms', classroomId, 'messages', messageId));
      toast({ title: "Message deleted" });
    } catch (error: any) {
      console.error("Failed to delete message:", error);
      toast({ 
        variant: 'destructive', 
        title: "Delete Failed", 
        description: "You don't have permission to delete this message." 
      });
    }
  };

  return (
    <div className="flex flex-col h-full bg-muted/30">
      <header className="flex-none p-3 border-b bg-background shadow-sm">
        <div className="container mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <MessageSquare className="h-7 w-7 text-primary" />
            <h1 className="text-xl font-semibold text-foreground truncate">
              Classroom Chat
            </h1>
          </div>
          <Button asChild variant="outline" size="sm" className="rounded-lg">
            <Link href={`/dashboard/classrooms/${classroomId}`}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Link>
          </Button>
        </div>
      </header>

      <main className="flex-grow flex flex-col overflow-hidden">
        <Card className="w-full h-full max-w-full shadow-none rounded-none border-0 flex flex-col">
          <CardContent className="flex-grow p-0 overflow-hidden bg-background">
            <ScrollArea className="h-full">
                <div className="p-4 md:p-6 space-y-4">
                  {hasMicPermission === false && (
                    <Alert variant="destructive">
                      <AlertTitle>Microphone Access Denied</AlertTitle>
                      <AlertDescription>
                        Voice recording is disabled. Please allow microphone access in your browser settings.
                      </AlertDescription>
                    </Alert>
                  )}
                  {messages.map((msg) => (
                    <div key={msg.id} className={cn("flex items-end gap-2", msg.isMe ? "justify-end" : "justify-start")}>
                      {!msg.isMe && (
                        <Avatar className="h-8 w-8 self-start">
                          <AvatarImage src={msg.senderAvatar || undefined} data-ai-hint="avatar user"/>
                          <AvatarFallback>{msg.senderName.charAt(0)}</AvatarFallback>
                        </Avatar>
                      )}
                      <div className="relative group max-w-[75%]">
                        <div
                          className={cn(
                            "p-3 rounded-xl shadow-sm",
                            msg.isMe
                              ? "bg-primary text-primary-foreground rounded-br-none"
                              : "bg-card text-card-foreground rounded-bl-none border"
                          )}
                        >
                          {!msg.isMe && <p className="text-[10px] font-bold mb-1 opacity-80 uppercase tracking-tight">{msg.senderName}</p>}
                          {msg.text && <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.text}</p>}
                          {msg.audioUrl && (
                            <div className="flex items-center gap-2 mt-1 py-1 px-2 bg-black/5 rounded-lg">
                              <Volume2 className="h-4 w-4 opacity-70" />
                              <audio src={msg.audioUrl} controls className="h-8 max-w-[200px]" />
                            </div>
                          )}
                          <p className="text-[9px] opacity-60 mt-1.5 text-right">
                            {msg.timestamp?.toDate ? msg.timestamp.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Sending...'}
                          </p>
                        </div>
                        
                        {(msg.isMe || userRole === 'creator') && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className={cn(
                              "absolute -top-2 h-6 w-6 rounded-full bg-background border shadow-sm opacity-0 group-hover:opacity-100 transition-opacity z-10",
                              msg.isMe ? "-left-2" : "-right-2"
                            )}
                            onClick={() => handleDeleteMessage(msg.id)}
                            title="Delete message"
                          >
                            <Trash2 className="h-3 w-3 text-destructive" />
                          </Button>
                        )}
                      </div>
                      {msg.isMe && (
                        <Avatar className="h-8 w-8 self-start">
                           <AvatarImage src={user?.photoURL || undefined} data-ai-hint="avatar user"/>
                          <AvatarFallback>{user?.displayName?.charAt(0) || 'Y'}</AvatarFallback>
                        </Avatar>
                      )}
                    </div>
                  ))}
                  <div ref={scrollViewportRef} />
                </div>
              </ScrollArea>
          </CardContent>
          <CardFooter className="p-4 border-t bg-card">
            <div className="w-full relative">
                <Popover open={showMentions} onOpenChange={setShowMentions}>
                  <PopoverAnchor asChild>
                    <div className="flex w-full items-end gap-2">
                      <Textarea
                        ref={textareaRef}
                        value={inputValue}
                        onChange={handleInputChange}
                        placeholder="Type a message..."
                        className="flex-grow rounded-xl border-border/80 focus:ring-primary text-sm min-h-[44px] max-h-[150px] py-3 shadow-inner resize-none"
                        rows={1}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSendMessage();
                          }
                        }}
                        disabled={isSending}
                      />
                      <div className="flex flex-col gap-2 shrink-0">
                        {inputValue.trim() || isSending ? (
                          <Button 
                            type="button" 
                            size="icon" 
                            className="rounded-full btn-gel w-11 h-11" 
                            onClick={handleSendMessage}
                            disabled={!inputValue.trim() || isSending}
                          >
                            {isSending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                          </Button>
                        ) : (
                          <Button 
                            type="button" 
                            size="icon" 
                            className={cn("rounded-full w-11 h-11 transition-all", isRecording ? "bg-destructive animate-pulse text-white scale-110" : "btn-gel")} 
                            onClick={handleToggleRecording}
                          >
                            {isRecording ? <StopCircle className="h-5 w-5"/> : <Mic className="h-5 w-5" />}
                          </Button>
                        )}
                      </div>
                    </div>
                  </PopoverAnchor>
                  <PopoverContent onOpenAutoFocus={(e) => e.preventDefault()} className="w-72 p-1 space-y-1 max-h-60 overflow-y-auto rounded-xl shadow-xl">
                    <p className="text-[10px] font-bold uppercase text-muted-foreground px-3 py-2 border-b">Mention Someone</p>
                    {isLoadingParticipants ? (
                        <div className="flex items-center justify-center p-4"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground"/></div>
                    ) : participants.length === 0 ? (
                        <p className="text-xs text-center py-4 text-muted-foreground">No participants to mention</p>
                    ) : (
                      participants.map((p) => (
                        <Button
                          key={p.id}
                          variant="ghost"
                          className="w-full justify-start h-auto p-2 rounded-lg"
                          onClick={() => handleMentionSelect(p.name)}
                        >
                          <Avatar className="h-7 w-7 mr-2">
                             <AvatarImage src={p.photoURL || undefined} data-ai-hint="avatar user"/>
                            <AvatarFallback>{p.name.charAt(0)}</AvatarFallback>
                          </Avatar>
                          <span className="text-sm font-medium">{p.name}</span>
                        </Button>
                      ))
                    )}
                  </PopoverContent>
                </Popover>
            </div>
          </CardFooter>
        </Card>
      </main>
    </div>
  );
}