
'use client';

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Send, Users, MessageSquare, AtSign, Loader2, Mic, StopCircle } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams, useParams } from "next/navigation";
import { useState, useEffect, useRef, useCallback } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger, PopoverAnchor } from "@/components/ui/popover";
import { db } from "@/lib/firebase";
import { doc, getDoc } from 'firebase/firestore';
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";


interface ChatMessage {
  id: string;
  senderName: string;
  senderAvatar?: string;
  text?: string;
  audioUrl?: string;
  timestamp: Date;
  isMe: boolean;
}

interface Participant {
  id: string;
  name: string;
  photoURL?: string;
}

const LATEST_ACTIVITY_KEY = 'teachmeet-latest-activity';

export default function ClassroomChatPage() {
  const { classroomId } = useParams() as { classroomId: string };
  const router = useRouter();
  const searchParams = useSearchParams();
  const topic = searchParams.get('topic') || "Classroom Chat";
  const { toast } = useToast();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [isLoadingParticipants, setIsLoadingParticipants] = useState(true);
  const [showMentions, setShowMentions] = useState(false);
  
  const [isRecording, setIsRecording] = useState(false);
  const [hasMicPermission, setHasMicPermission] = useState<boolean | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const scrollViewportRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    async function fetchParticipants() {
      if (!classroomId) return;
      setIsLoadingParticipants(true);
      try {
        const classroomRef = doc(db, 'classrooms', classroomId);
        const classroomSnap = await getDoc(classroomRef);

        if (classroomSnap.exists()) {
          const classroomData = classroomSnap.data();
          const studentIds: string[] = classroomData.students || [];
          const teacherIds: string[] = classroomData.teachers || [];
          const allUserIds = [...new Set([...studentIds, ...teacherIds])];

          const profilesPromises = allUserIds.map(async (userId) => {
            const userRef = doc(db, 'users', userId);
            const userSnap = await getDoc(userRef);
            if (userSnap.exists()) {
              return { id: userSnap.id, ...userSnap.data() } as Participant;
            }
            return null;
          });

          const profiles = (await Promise.all(profilesPromises)).filter(p => p !== null) as Participant[];
          setParticipants(profiles);
        }
      } catch (error) {
        console.error("Failed to fetch participants:", error);
      } finally {
        setIsLoadingParticipants(false);
      }
    }

    fetchParticipants();
  }, [classroomId]);


  useEffect(() => {
    // Dummy welcome message
    setMessages([
      { id: 'welcome', senderName: 'System', text: `Welcome to the chat for ${topic}.\nType @ to mention someone.`, timestamp: new Date(), isMe: false }
    ]);
  }, [topic]);

  useEffect(() => {
    // Scroll to bottom when messages change
    if (scrollViewportRef.current) {
        scrollViewportRef.current.scrollTo({ top: scrollViewportRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [messages]);

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

  const notifyMentionedUsers = (messageText: string) => {
    const mentions = messageText.match(/@(\w+(\s\w+)*)/g) || [];
    if (mentions.length === 0) return;

    try {
        const rawActivity = localStorage.getItem(LATEST_ACTIVITY_KEY);
        let activities = rawActivity ? JSON.parse(rawActivity) : [];
        if (!Array.isArray(activities)) activities = [];

        mentions.forEach(mention => {
            const userName = mention.substring(1);
            const newNotification = {
              id: `chatMention-${Date.now()}-${userName}`,
              type: 'chatMention',
              title: `You were mentioned in "${topic}"`,
              timestamp: Date.now(),
              mentionedBy: 'You', // In a real app, this would be the current user's name
            };
            activities.unshift(newNotification);
        });

        localStorage.setItem(LATEST_ACTIVITY_KEY, JSON.stringify(activities.slice(0, 20))); // Keep last 20 activities
        window.dispatchEvent(new CustomEvent('teachmeet_activity_updated'));
    } catch (e) {
        console.error("Failed to update latest activity in localStorage", e);
    }
  };

  const handleSendMessage = () => {
    if (!inputValue.trim()) return;

    notifyMentionedUsers(inputValue);

    const newMessage: ChatMessage = {
      id: Date.now().toString(),
      senderName: 'You', // In a real app, get from auth
      text: inputValue,
      timestamp: new Date(),
      isMe: true,
    };
    // In a real app, you'd send this message to a backend (e.g., Firestore)
    setMessages(prev => [...prev, newMessage]);
    setInputValue("");
    setShowMentions(false);
  };
  
  const handleToggleRecording = async () => {
    if (isRecording) {
      mediaRecorderRef.current?.stop();
      // The onstop event handler will handle the rest
      return;
    }

    if (hasMicPermission === false) {
      toast({ variant: 'destructive', title: "Microphone Access Denied", description: "Please enable microphone permissions in your browser settings." });
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setHasMicPermission(true);

      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorderRef.current.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const audioUrl = URL.createObjectURL(audioBlob);
        
        const newMessage: ChatMessage = {
          id: Date.now().toString(),
          senderName: 'You',
          audioUrl: audioUrl,
          timestamp: new Date(),
          isMe: true,
        };
        setMessages(prev => [...prev, newMessage]);
        setIsRecording(false); // Update state after stopping

        // Stop the media stream tracks to turn off the recording indicator
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
      toast({ title: "Recording Started", description: "Click the stop button to finish." });
    } catch (error) {
      console.error("Error accessing microphone:", error);
      setHasMicPermission(false);
      toast({ variant: 'destructive', title: "Microphone Access Denied", description: "Please enable microphone permissions in your browser settings." });
    }
  };


  const backToClassroomLink = `/dashboard/classrooms/${classroomId}`;

  return (
    <div className="flex flex-col h-full bg-muted/30">
      <header className="flex-none p-3 border-b bg-background shadow-sm">
        <div className="container mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <MessageSquare className="h-7 w-7 text-primary" />
            <h1 className="text-xl font-semibold text-foreground truncate" title={topic}>
              {topic}
            </h1>
          </div>
          <Button asChild variant="outline" className="rounded-lg">
            <Link href={backToClassroomLink}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Classroom
            </Link>
          </Button>
        </div>
      </header>

      <main className="flex-grow flex flex-col overflow-hidden">
        <Card className="w-full h-full max-w-full text-center shadow-none rounded-none border-0 flex flex-col">
          <CardContent className="flex-grow p-0 overflow-hidden">
            <ScrollArea className="h-full">
                <div className="p-4 md:p-6 space-y-4" ref={scrollViewportRef}>
                  {hasMicPermission === false && (
                    <Alert variant="destructive">
                      <AlertTitle>Microphone Access Denied</AlertTitle>
                      <AlertDescription>
                        Voice recording is disabled. Please allow microphone access in your browser settings to use this feature.
                      </AlertDescription>
                    </Alert>
                  )}
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
                          msg.isMe
                            ? "bg-primary text-primary-foreground rounded-br-none"
                            : "bg-card text-card-foreground rounded-bl-none"
                        )}
                      >
                        {!msg.isMe && msg.senderName !== 'System' && <p className="text-xs font-medium mb-0.5">{msg.senderName}</p>}
                        {msg.text && <p className="text-sm whitespace-pre-wrap">{msg.text}</p>}
                        {msg.audioUrl && (
                          <audio src={msg.audioUrl} controls className="max-w-full" />
                        )}
                        {msg.senderName !== 'System' && <p className="text-xs opacity-70 mt-1 text-right">{msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>}
                      </div>
                      {msg.isMe && (
                        <Avatar className="h-8 w-8 self-start">
                           <AvatarImage src={`https://placehold.co/40x40/00FFFF/000000.png?text=Y`} alt="You" data-ai-hint="avatar user"/>
                          <AvatarFallback>Y</AvatarFallback>
                        </Avatar>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
          </CardContent>
          <CardFooter className="p-4 border-t bg-background">
            <div className="w-full relative">
                <Popover open={showMentions} onOpenChange={setShowMentions}>
                  <PopoverAnchor asChild>
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        handleSendMessage();
                      }}
                      className="flex w-full items-center gap-2"
                    >
                      <Textarea
                        ref={textareaRef}
                        value={inputValue}
                        onChange={handleInputChange}
                        placeholder="Type your message..."
                        className="flex-grow rounded-lg border-border/80 focus:ring-primary text-sm min-h-[40px] max-h-[120px]"
                        rows={1}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSendMessage();
                          }
                        }}
                      />
                      {inputValue.trim() ? (
                        <Button type="submit" size="icon" className="rounded-lg btn-gel w-10 h-10" disabled={!inputValue.trim()}>
                          <Send className="h-5 w-5" />
                          <span className="sr-only">Send message</span>
                        </Button>
                      ) : (
                        <Button type="button" size="icon" className={cn("rounded-lg btn-gel w-10 h-10", isRecording && "bg-destructive hover:bg-destructive/90")} onClick={handleToggleRecording}>
                          {isRecording ? <StopCircle className="h-5 w-5"/> : <Mic className="h-5 w-5" />}
                          <span className="sr-only">{isRecording ? "Stop recording" : "Record voice message"}</span>
                        </Button>
                      )}
                    </form>
                  </PopoverAnchor>
                  <PopoverContent onOpenAutoFocus={(e) => e.preventDefault()} className="w-72 p-1 space-y-1 max-h-60 overflow-y-auto">
                    <p className="text-xs text-muted-foreground px-2 py-1">Mention a participant</p>
                    {isLoadingParticipants ? (
                        <div className="flex items-center justify-center p-4">
                            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground"/>
                        </div>
                    ) : (
                      participants.map((p) => (
                        <Button
                          key={p.id}
                          variant="ghost"
                          className="w-full justify-start h-auto p-2"
                          onClick={() => handleMentionSelect(p.name)}
                        >
                          <Avatar className="h-7 w-7 mr-2">
                             <AvatarImage src={p.photoURL || `https://placehold.co/28x28.png?text=${p.name.charAt(0)}`} alt={p.name} data-ai-hint="avatar user"/>
                            <AvatarFallback>{p.name.charAt(0)}</AvatarFallback>
                          </Avatar>
                          <span className="text-sm">{p.name}</span>
                        </Button>
                      ))
                    )}
                  </PopoverContent>
                </Popover>
            </div>
          </CardFooter>
        </Card>
      </main>
       <footer className="flex-none p-2 text-center text-xs text-muted-foreground border-t bg-background">
        Classroom Chat - Real-time features require backend integration.
      </footer>
    </div>
  );
}
