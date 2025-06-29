
'use client';

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowLeft, Send } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState, useEffect, useRef, use } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

interface ChatMessage {
    id: string;
    senderName: string;
    senderAvatar?: string;
    text: string;
    timestamp: string;
    isMe: boolean;
}

const mockMessages: ChatMessage[] = [
    { id: '1', senderName: 'John Doe', text: 'Hey everyone, what did you think of the lecture?', timestamp: '10:30 AM', isMe: false, senderAvatar: 'https://placehold.co/40x40/2ECC71/FFFFFF.png?text=JD' },
    { id: '2', senderName: 'You', text: 'I thought it was great! Especially the part about quantum mechanics.', timestamp: '10:31 AM', isMe: true, senderAvatar: 'https://placehold.co/40x40/3498DB/FFFFFF.png?text=Y' },
    { id: '3', senderName: 'Jane Smith', text: 'Agreed! It was a bit complex, but very insightful. Does anyone have the notes for the last 5 minutes? My connection dropped.', timestamp: '10:32 AM', isMe: false, senderAvatar: 'https://placehold.co/40x40/E74C3C/FFFFFF.png?text=JS' },
    { id: '4', senderName: 'You', text: 'Sure, I can send them over. I\'ll upload them to the materials section.', timestamp: '10:33 AM', isMe: true, senderAvatar: 'https://placehold.co/40x40/3498DB/FFFFFF.png?text=Y' },
];


export default function ClassChatPage({ params: paramsPromise }: { params: Promise<{ classId: string }> }) {
    const { classId } = use(paramsPromise);
    const [messages, setMessages] = useState<ChatMessage[]>(mockMessages);
    const [inputValue, setInputValue] = useState("");
    const scrollAreaRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (scrollAreaRef.current) {
            scrollAreaRef.current.scrollTo({ top: scrollAreaRef.current.scrollHeight, behavior: 'smooth' });
        }
    }, [messages]);

    const handleSendMessage = () => {
        if (inputValue.trim()) {
            const newMessage: ChatMessage = {
                id: Date.now().toString(),
                senderName: 'You',
                text: inputValue,
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                isMe: true,
                senderAvatar: 'https://placehold.co/40x40/3498DB/FFFFFF.png?text=Y',
            };
            setMessages(prev => [...prev, newMessage]);
            setInputValue("");
        }
    };

    return (
        <div className="flex flex-col h-full">
            <header className="flex-none p-3 border-b bg-background shadow-sm">
                <div className="container mx-auto flex items-center justify-between">
                    <h1 className="text-xl font-semibold text-foreground">Class Chat (ID: {classId})</h1>
                    <Link href={`/dashboard/class/${classId}`} passHref legacyBehavior>
                        <Button variant="outline" className="rounded-lg">
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back to Class Home
                        </Button>
                    </Link>
                </div>
            </header>
            <main className="flex-grow flex flex-col overflow-hidden">
                <Card className="w-full h-full max-w-full text-center shadow-none rounded-none border-0 flex flex-col">
                    <CardContent className="flex-grow p-0 overflow-hidden">
                        <ScrollArea className="h-full p-4 md:p-6" ref={scrollAreaRef}>
                            <div className="space-y-4">
                                {messages.map((msg) => (
                                    <div key={msg.id} className={`flex items-end gap-2 ${msg.isMe ? 'justify-end' : 'justify-start'}`}>
                                        {!msg.isMe && (
                                             <Avatar className="h-8 w-8 self-start">
                                                <AvatarImage src={msg.senderAvatar} alt={msg.senderName} data-ai-hint="avatar user" />
                                                <AvatarFallback>{msg.senderName.charAt(0)}</AvatarFallback>
                                            </Avatar>
                                        )}
                                        <div className={`max-w-[70%] p-3 rounded-xl shadow ${msg.isMe ? 'bg-primary text-primary-foreground rounded-br-none' : 'bg-card text-card-foreground rounded-bl-none'}`}>
                                            {!msg.isMe && <p className="text-xs font-medium mb-0.5">{msg.senderName}</p>}
                                            <p className="text-sm whitespace-pre-wrap">{msg.text}</p>
                                            <p className="text-xs opacity-70 mt-1 text-right">{msg.timestamp}</p>
                                        </div>
                                         {msg.isMe && (
                                            <Avatar className="h-8 w-8 self-start">
                                                <AvatarImage src={msg.senderAvatar} alt={msg.senderName} data-ai-hint="avatar user"/>
                                                <AvatarFallback>{msg.senderName.charAt(0)}</AvatarFallback>
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
                            <Button type="submit" size="icon" className="rounded-lg btn-gel w-10 h-10" disabled={!inputValue.trim()}>
                                <Send className="h-5 w-5" />
                                <span className="sr-only">Send message</span>
                            </Button>
                        </form>
                    </CardFooter>
                </Card>
            </main>
        </div>
    );
}
