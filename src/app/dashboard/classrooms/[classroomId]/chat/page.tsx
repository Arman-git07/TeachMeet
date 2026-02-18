'use client';

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Send, MessageSquare, Loader2, Mic, StopCircle, Volume2, Trash2, Settings2, Clock, AlertTriangle } from "lucide-react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger, PopoverAnchor } from "@/components/ui/popover";
import { db, storage } from "@/lib/firebase";
import { doc, collection, addDoc, serverTimestamp, query, orderBy, onSnapshot, limit, deleteDoc, updateDoc, where, Timestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useClassroom } from "@/contexts/ClassroomContext";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError, type SecurityRuleContext } from '@/firebase/errors';

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
  const { userRole, classroom } = useClassroom();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [isLoadingParticipants, setIsLoadingParticipants] = useState(true);
  const [showMentions, setShowMentions] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  
  const [isRecording, setIsRecording] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isUpdatingSettings, setIsUpdatingSettings] = useState(false);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const scrollViewportRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const isCreator = userRole === 'creator';

  // Fetch Participants for Mentions
  useEffect(() => {
    if (!classroomId) return;
    setIsLoadingParticipants(true);
    
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
    if (!classroomId || !user) return;

    setSyncError(null);

    let messagesQuery = query(
      collection(db, 'classrooms', classroomId, 'messages'),
      orderBy('timestamp', 'desc'),
      limit(50)
    );

    const vanishDuration = (classroom as any)?.chatVanishDuration;
    if (vanishDuration && vanishDuration !== 'never') {
        const now = new Date();
        let threshold = new Date();
        switch (vanishDuration) {
            case '1d': threshold.setDate(now.getDate() - 1); break;
            case '2d': threshold.setDate(now.getDate() - 2); break;
            case '1w': threshold.setDate(now.getDate() - 7); break;
            case '1m': threshold.setMonth(now.getMonth() - 1); break;
        }
        
        messagesQuery = query(
            collection(db, 'classrooms', classroomId, 'messages'),
            where('timestamp', '>=', Timestamp.fromDate(threshold)),
            orderBy('timestamp', 'desc'),
            limit(50)
        );
    }

    const unsubscribe = onSnapshot(messagesQuery, (snapshot) => {
      const fetchedMessages = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          isMe: data.senderId === user?.uid
        } as ChatMessage;
      });
      
      setMessages(fetchedMessages.reverse());
      setSyncError(null);
      
      setTimeout(() => {
        if (scrollViewportRef.current) {
            scrollViewportRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
        }
      }, 100);
    }, (error) => {
        console.error("Chat sync error:", error);
        setSyncError(error.message?.includes('permission') ? "Missing or insufficient permissions. Are you enrolled?" : "Connection error. Sync failed.");
    });

    return () => unsubscribe();
  }, [classroomId, user, (classroom as any)?.chatVanishDuration]);

  const handleUpdateVanishDuration = async (value: string) => {
    if (!isCreator || !classroomId) return;
    setIsUpdatingSettings(true);
    try {
        await updateDoc(doc(db, 'classrooms', classroomId), {
            chatVanishDuration: value
        });
        toast({ title: "Chat Policy Updated" });
    } catch (error) {
        console.error("Failed to update vanish duration:", error);
        toast({ variant: 'destructive', title: "Update Failed" });
    } finally {
        setIsUpdatingSettings(false);
    }
  };

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
      setInputValue(textToSend);
      toast({ 
        variant: 'destructive', 
        title: "Message Failed", 
        description: error.message || "Could not send message. Please check your permissions or connection." 
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
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setIsRecording(false);
        stream.getTracks().forEach(track => track.stop());

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
        } catch (error) {
          console.error("Voice note upload failed:", error);
          toast({ variant: 'destructive', title: "Upload Failed" });
        }
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
    } catch (error) {
      console.error("Mic access error:", error);
      toast({ variant: 'destructive', title: "Mic Access Required" });
    }
  };

  const handleDeleteMessage = (messageId: string) => {
    if (!classroomId || !messageId) return;
    const docRef = doc(db, 'classrooms', classroomId, 'messages', messageId);
    
    deleteDoc(docRef)
      .then(() => {
        toast({ title: "Message deleted" });
      })
      .catch(async (serverError) => {
        const permissionError = new FirestorePermissionError({
          path: docRef.path,
          operation: 'delete',
        } satisfies SecurityRuleContext);

        errorEmitter.emit('permission-error', permissionError);
      });
  };

  return (
    <div className="flex flex-col h-full bg-muted/30">
      <header className="flex-none p-3 border-b bg-background shadow-sm">
        <div className="container mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <MessageSquare className="h-7 w-7 text-primary shrink-0" />
            <div className="min-w-0">
                <h1 className="text-xl font-bold text-foreground truncate">
                  {classroom?.title || "Classroom Chat"}
                </h1>
                <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest flex items-center gap-1.5">
                    Public Chat Room
                    {(classroom as any)?.chatVanishDuration && (classroom as any)?.chatVanishDuration !== 'never' && (
                        <span className="text-primary flex items-center gap-1">
                            <Clock className="h-3 w-3" /> Vanish Mode ON
                        </span>
                    )}
                </p>
            </div>
            {isCreator && (
                <Popover>
                    <PopoverTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full shrink-0">
                            <Settings2 className="h-4 w-4 text-muted-foreground" />
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-64 p-4 rounded-xl shadow-xl" align="start">
                        <div className="space-y-4">
                            <div className="flex items-center gap-2 border-b pb-2">
                                <Clock className="h-4 w-4 text-primary" />
                                <span className="font-bold text-sm">Vanish Settings</span>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs uppercase font-bold text-muted-foreground tracking-widest">Keep Messages For</Label>
                                <Select 
                                    defaultValue={(classroom as any)?.chatVanishDuration || 'never'} 
                                    onValueChange={handleUpdateVanishDuration}
                                    disabled={isUpdatingSettings}
                                >
                                    <SelectTrigger className="rounded-lg h-10">
                                        <SelectValue placeholder="Select duration" />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-lg">
                                        <SelectItem value="1d">1 Day</SelectItem>
                                        <SelectItem value="2d">2 Days</SelectItem>
                                        <SelectItem value="1w">1 Week</SelectItem>
                                        <SelectItem value="2w">2 Weeks</SelectItem>
                                        <SelectItem value="1m">1 Month</SelectItem>
                                        <SelectItem value="never">Never (Forever)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </PopoverContent>
                </Popover>
            )}
          </div>
          <Button asChild variant="outline" size="sm" className="rounded-lg shrink-0">
            <Link href={`/dashboard/classrooms/${classroomId}`}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Exit
            </Link>
          </Button>
        </div>
      </header>

      <main className="flex-grow flex flex-col overflow-hidden">
        <Card className="w-full h-full max-w-full shadow-none rounded-none border-0 flex flex-col">
          <CardContent className="flex-grow p-0 overflow-hidden bg-background">
            <ScrollArea className="h-full">
                <div className="p-4 md:p-6 space-y-4">
                  {syncError && (
                    <div className="p-3 bg-destructive/10 text-destructive rounded-lg flex items-center gap-2 mb-4">
                      <AlertTriangle className="h-4 w-4" />
                      <p className="text-xs font-medium">{syncError}</p>
                    </div>
                  )}
                  
                  {messages.length === 0 && !syncError && (
                      <div className="flex flex-col items-center justify-center py-20 text-center opacity-40">
                          <MessageSquare className="h-12 w-12 mb-2" />
                          <p className="text-sm font-medium">No messages yet.</p>
                          <p className="text-xs">Start the conversation by typing below.</p>
                      </div>
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