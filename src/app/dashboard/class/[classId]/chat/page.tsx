
'use client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { ArrowLeft, Send, MessageSquare } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import { Popover, PopoverContent, PopoverAnchor } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";

interface ClassChatMessage {
  id: string;
  senderName: string;
  senderAvatar?: string;
  text: string;
  timestamp: Date;
  isMe: boolean;
}

interface ClassMember {
  id: string;
  name: string;
  avatar?: string;
}

const mockClassMembers: ClassMember[] = [
    { id: 'teacher-evelyn-reed-uid', name: 'Dr. Evelyn Reed', avatar: 'https://placehold.co/40x40/223D4A/FFFFFF.png?text=ER' },
    { id: 'user1', name: 'Alex Johnson', avatar: 'https://placehold.co/40x40/00FFFF/223D4A.png?text=AJ' },
    { id: 'user2', name: 'Bethany Smith', avatar: `https://placehold.co/40x40.png?text=BS` },
    { id: 'user3', name: 'Carlos Gomez', avatar: `https://placehold.co/40x40.png?text=CG` },
];

const mockMessages: ClassChatMessage[] = [
    { id: '1', senderName: 'Dr. Evelyn Reed', text: 'Hello class! Just a reminder that your first assignment is due next Monday. Let me know if you have any questions.', timestamp: new Date(Date.now() - 86400000), isMe: false, senderAvatar: 'https://placehold.co/40x40/223D4A/FFFFFF.png?text=ER' },
    { id: '2', senderName: 'You', text: 'Thanks for the reminder, Dr. Reed!', timestamp: new Date(Date.now() - 72000000), isMe: true },
    { id: '3', senderName: 'Alex Johnson', text: 'I had a question about problem #3. Can we use the quadratic formula?', timestamp: new Date(Date.now() - 36000000), isMe: false, senderAvatar: 'https://placehold.co/40x40/00FFFF/223D4A.png?text=AJ' },
];

export default function ClassChatPage() {
    const params = useParams();
    const classId = params.classId as string;
    const [messages, setMessages] = useState<ClassChatMessage[]>(mockMessages);
    const [inputValue, setInputValue] = useState("");
    const scrollAreaRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const [mentionSuggestions, setMentionSuggestions] = useState<ClassMember[]>([]);
    const [isMentionPopoverOpen, setIsMentionPopoverOpen] = useState(false);
    const { toast } = useToast();

    useEffect(() => {
        if (scrollAreaRef.current) {
        scrollAreaRef.current.scrollTo({ top: scrollAreaRef.current.scrollHeight, behavior: 'smooth' });
        }
    }, [messages]);

    const handleSendMessage = () => {
        if (!inputValue.trim()) return;
        const newMessage: ClassChatMessage = {
            id: Date.now().toString(),
            senderName: 'You',
            text: inputValue,
            timestamp: new Date(),
            isMe: true,
        };
        setMessages(prev => [...prev, newMessage]);

        const mentionRegex = /@([\w\s.]+)/g;
        const mentions = [...inputValue.matchAll(mentionRegex)];
        if (mentions.length > 0) {
            const mentionedNames = mentions.map(m => m[1].trim()).join(', ');
            toast({
                title: "User Mentioned",
                description: `A notification would be sent to: ${mentionedNames}`,
            });
        }

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
                const suggestions = mockClassMembers.filter(member =>
                    member.name.toLowerCase().includes(query) && member.name !== 'You'
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
            textareaRef.current?.setSelectionRange(
                newTextBeforeCursor.length,
                newTextBeforeCursor.length
            );
        }, 0);
    };

    const renderMessageWithMentions = (text: string) => {
        const mentionRegex = /@([\w\s.]+)/g;
        const parts = text.split(mentionRegex);

        return parts.map((part, index) => {
            if (index % 2 === 1) {
                const trimmedPart = part.trim();
                const isMember = mockClassMembers.some(
                    (member) => member.name.trim() === trimmedPart
                );
                if (isMember) {
                    return (
                        <strong key={index} className="text-accent bg-accent/10 px-1 rounded-sm">
                            @{trimmedPart}
                        </strong>
                    );
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
                        <Link href={`/dashboard/class/${classId}`}>
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back to Class
                        </Link>
                    </Button>
                </div>
            </header>
            <main className="flex-grow flex flex-col overflow-hidden">
                <Card className="w-full h-full max-w-full text-center shadow-none rounded-none border-0 flex flex-col">
                    <CardContent className="flex-grow p-0 overflow-hidden">
                        <ScrollArea className="h-full p-4 md:p-6" ref={scrollAreaRef}>
                            <div className="space-y-4">
                                {messages.map((msg) => (
                                    <div key={msg.id} className={cn("flex items-end gap-2", msg.isMe ? "justify-end" : "justify-start")}>
                                    {!msg.isMe && (
                                        <Avatar className="h-8 w-8 self-start">
                                        <AvatarImage src={msg.senderAvatar || `https://placehold.co/40x40.png?text=${msg.senderName.charAt(0)}`} alt={msg.senderName} data-ai-hint="avatar user"/>
                                        <AvatarFallback>{msg.senderName.charAt(0)}</AvatarFallback>
                                        </Avatar>
                                    )}
                                    <div className={cn("max-w-[70%] p-3 rounded-xl shadow", msg.isMe ? "bg-primary text-primary-foreground rounded-br-none" : "bg-card text-card-foreground rounded-bl-none")}>
                                        {!msg.isMe && <p className="text-xs font-medium mb-0.5">{msg.senderName}</p>}
                                        <p className="text-sm whitespace-pre-wrap">{renderMessageWithMentions(msg.text)}</p>
                                        <p className="text-xs opacity-70 mt-1 text-right">{msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
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
                         <Popover open={isMentionPopoverOpen} onOpenChange={setIsMentionPopoverOpen}>
                            <form
                                onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }}
                                className="flex w-full items-center gap-2"
                            >
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
                                    <Send className="h-5 w-5" />
                                    <span className="sr-only">Send message</span>
                                </Button>
                            </form>
                             <PopoverContent className="w-64 p-1 space-y-1" side="top" align="start">
                                {mentionSuggestions.map(member => (
                                    <button
                                        key={member.id}
                                        type="button"
                                        className="w-full text-left p-2 text-sm rounded-md hover:bg-muted flex items-center gap-2"
                                        onMouseDown={(e) => e.preventDefault()} // Prevents textarea blur
                                        onClick={() => handleMentionSelect(member.name)}
                                    >
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
