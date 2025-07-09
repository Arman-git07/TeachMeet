
'use client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { ArrowLeft, Send, MessageSquare, Loader2, Users } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import { Popover, PopoverContent, PopoverAnchor } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/useAuth";
import { collection, addDoc, serverTimestamp, query, orderBy, onSnapshot, doc, getDoc } from "firebase/firestore";
import { Skeleton } from "@/components/ui/skeleton";

interface ClassChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  text: string;
  timestamp: Date;
}

interface ClassMember {
  id: string;
  name: string;
  avatar?: string;
}

export default function ClassChatPage() {
    const params = useParams();
    const classId = params.classId as string;
    const { user: currentUser } = useAuth();
    const [messages, setMessages] = useState<ClassChatMessage[]>([]);
    const [classMembers, setClassMembers] = useState<ClassMember[]>([]);
    const [inputValue, setInputValue] = useState("");
    const [isLoading, setIsLoading] = useState(true);
    const scrollAreaRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const [mentionSuggestions, setMentionSuggestions] = useState<ClassMember[]>([]);
    const [isMentionPopoverOpen, setIsMentionPopoverOpen] = useState(false);
    const { toast } = useToast();

    useEffect(() => {
        if (!classId) return;

        // Fetch class members
        const membersUnsub = onSnapshot(collection(db, "classes", classId, "members"), (snapshot) => {
            const members: ClassMember[] = [];
            snapshot.forEach(doc => members.push({ id: doc.id, ...doc.data() } as ClassMember));
            setClassMembers(members);
        });

        // Fetch chat messages
        const messagesQuery = query(collection(db, "classes", classId, "messages"), orderBy("timestamp", "asc"));
        const messagesUnsub = onSnapshot(messagesQuery, (snapshot) => {
            const fetchedMessages: ClassChatMessage[] = [];
            snapshot.forEach(doc => {
                const data = doc.data();
                fetchedMessages.push({
                    id: doc.id,
                    ...data,
                    timestamp: data.timestamp?.toDate()
                } as ClassChatMessage);
            });
            setMessages(fetchedMessages);
            setIsLoading(false);
        });

        return () => {
            membersUnsub();
            messagesUnsub();
        };
    }, [classId]);

    useEffect(() => {
        if (scrollAreaRef.current) {
            scrollAreaRef.current.scrollTo({ top: scrollAreaRef.current.scrollHeight, behavior: 'smooth' });
        }
    }, [messages]);

    const handleSendMessage = async () => {
        if (!inputValue.trim() || !currentUser || !classId) return;

        const messagesColRef = collection(db, "classes", classId, "messages");
        await addDoc(messagesColRef, {
            senderId: currentUser.uid,
            senderName: currentUser.displayName || "Anonymous",
            senderAvatar: currentUser.photoURL || null,
            text: inputValue.trim(),
            timestamp: serverTimestamp(),
        });
        
        setInputValue("");
        setIsMentionPopoverOpen(false);
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const { value, selectionStart } = e.target;
        setInputValue(value);
        const textBeforeCursor = value.substring(0, selectionStart);
        const lastAt = textBeforeCursor.lastIndexOf('@');
        if (lastAt !== -1) {
            const textSinceAt = textBeforeCursor.substring(lastAt + 1);
            if (!textSinceAt.includes(' ')) {
                const query = textSinceAt.toLowerCase();
                const suggestions = classMembers.filter(member =>
                    member.name.toLowerCase().includes(query) && member.id !== currentUser?.uid
                );
                setMentionSuggestions(suggestions);
                setIsMentionPopoverOpen(suggestions.length > 0);
                return;
            }
        }
        setIsMentionPopoverOpen(false);
    };

    const handleMentionSelect = (name: string) => {
        if (!textareaRef.current) return;
        const { selectionStart } = textareaRef.current;
        const textBeforeCursor = inputValue.substring(0, selectionStart);
        const textAfterCursor = inputValue.substring(selectionStart);
        const lastAt = textBeforeCursor.lastIndexOf('@');
        const newTextBeforeCursor = textBeforeCursor.substring(0, lastAt) + `@${name} `;
        setInputValue(newTextBeforeCursor + textAfterCursor);
        setIsMentionPopoverOpen(false);
        setTimeout(() => {
            textareaRef.current?.focus();
            textareaRef.current?.setSelectionRange(newTextBeforeCursor.length, newTextBeforeCursor.length);
        }, 0);
    };

    const renderMessageWithMentions = (text: string) => {
        const mentionRegex = /@([\w\s.]+)/g;
        const parts = text.split(mentionRegex);
        return parts.map((part, index) => {
            if (index % 2 === 1) {
                const trimmedPart = part.trim();
                const isMember = classMembers.some(member => member.name.trim() === trimmedPart);
                if (isMember) {
                    return <strong key={index} className="text-accent bg-accent/10 px-1 rounded-sm">@{trimmedPart}</strong>;
                }
            }
            return part;
        });
    };

    return (
        <div className="flex flex-col h-full bg-muted/30">
            <header className="flex-none p-3 border-b bg-background shadow-sm">
                <div className="container mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <MessageSquare className="h-7 w-7 text-primary" />
                        <h1 className="text-xl font-semibold text-foreground truncate">Class Chat</h1>
                    </div>
                    <Button asChild variant="outline" className="rounded-lg">
                        <Link href={`/dashboard/class/${classId}`}><ArrowLeft className="mr-2 h-4 w-4" />Back to Class</Link>
                    </Button>
                </div>
            </header>
            <main className="flex-grow flex flex-col overflow-hidden">
                <Card className="w-full h-full max-w-full text-center shadow-none rounded-none border-0 flex flex-col">
                    <CardContent className="flex-grow p-0 overflow-hidden">
                        <ScrollArea className="h-full p-4 md:p-6" ref={scrollAreaRef}>
                            {isLoading ? (
                                <div className="flex justify-center items-center h-full"><Loader2 className="h-8 w-8 animate-spin text-primary"/></div>
                            ) : messages.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                                    <MessageSquare className="w-16 h-16 mb-4" />
                                    <p className="text-lg">No messages yet.</p>
                                    <p>Be the first to send a message!</p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {messages.map((msg) => {
                                        const isMe = msg.senderId === currentUser?.uid;
                                        return (
                                            <div key={msg.id} className={cn("flex items-end gap-2", isMe ? "justify-end" : "justify-start")}>
                                            {!isMe && (
                                                <Avatar className="h-8 w-8 self-start">
                                                <AvatarImage src={msg.senderAvatar || `https://placehold.co/40x40.png?text=${msg.senderName.charAt(0)}`} alt={msg.senderName} data-ai-hint="avatar user"/>
                                                <AvatarFallback>{msg.senderName.charAt(0)}</AvatarFallback>
                                                </Avatar>
                                            )}
                                            <div className={cn("max-w-[70%] p-3 rounded-xl shadow", isMe ? "bg-primary text-primary-foreground rounded-br-none" : "bg-card text-card-foreground rounded-bl-none")}>
                                                {!isMe && <p className="text-xs font-medium mb-0.5">{msg.senderName}</p>}
                                                <p className="text-sm whitespace-pre-wrap">{renderMessageWithMentions(msg.text)}</p>
                                                <p className="text-xs opacity-70 mt-1 text-right">{msg.timestamp?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                                            </div>
                                            {isMe && (
                                                <Avatar className="h-8 w-8 self-start">
                                                <AvatarImage src={currentUser.photoURL || `https://placehold.co/40x40/00FFFF/000000.png?text=Y`} alt="You" data-ai-hint="avatar user"/>
                                                <AvatarFallback>{currentUser.displayName?.charAt(0) || 'Y'}</AvatarFallback>
                                                </Avatar>
                                            )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </ScrollArea>
                    </CardContent>
                    <CardFooter className="p-4 border-t bg-background">
                         <Popover open={isMentionPopoverOpen} onOpenChange={setIsMentionPopoverOpen}>
                            <form onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }} className="flex w-full items-center gap-2">
                                <PopoverAnchor asChild>
                                    <Textarea
                                        ref={textareaRef}
                                        value={inputValue}
                                        onChange={handleInputChange}
                                        placeholder="Type your message to the class... (@ to mention)"
                                        className="flex-grow rounded-lg border-border/80 focus:ring-primary text-sm min-h-[40px] max-h-[120px]"
                                        rows={1}
                                        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }}
                                    />
                                </PopoverAnchor>
                                <Button type="submit" size="icon" className="rounded-lg btn-gel w-10 h-10" disabled={!inputValue.trim()}>
                                    <Send className="h-5 w-5" /><span className="sr-only">Send message</span>
                                </Button>
                            </form>
                             <PopoverContent className="w-64 p-1 space-y-1" side="top" align="start">
                                {mentionSuggestions.map(member => (
                                    <button key={member.id} type="button" className="w-full text-left p-2 text-sm rounded-md hover:bg-muted flex items-center gap-2" onMouseDown={(e) => e.preventDefault()} onClick={() => handleMentionSelect(member.name)}>
                                        <Avatar className="h-6 w-6">
                                            <AvatarImage src={member.avatar || `https://placehold.co/40x40.png?text=${member.name.charAt(0)}`} data-ai-hint="avatar user"/>
                                            <AvatarFallback>{member.name.charAt(0)}</AvatarFallback>
                                        </Avatar>
                                        {member.name}
                                    </button>
                                ))}
                            </PopoverContent>
                        </Popover>
                    </CardFooter>
                </Card>
            </main>
        </div>
    );
}
