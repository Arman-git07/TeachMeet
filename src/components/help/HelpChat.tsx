
'use client';
import React, { useState, useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Paperclip, Send, MessageSquare, AlertTriangle } from 'lucide-react';
// Removed direct import of aiHelpAssistantFlow
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'ai' | 'system';
  timestamp: Date;
}

const predefinedFAQs = [
  { q: "How do I start a new meeting?", a: "To start a new meeting, click the 'Start New Meeting' button on the main screen or in the left sidebar. If you are not logged in, you will be redirected to the sign-in page." },
  { q: "How do I join a meeting?", a: "To join a meeting, click the 'Join Meeting' button and enter the meeting code or link. If you are not logged in, you will be redirected to the sign-in page." },
  { q: "How do I share my screen?", a: "During a meeting, click the screen share icon located in the top right corner of the screen. Select the screen or application window you want to share." },
  { q: "Where can I find settings?", a: "You can access settings by clicking the 'Settings' button in the left sidebar or the icon in the top right corner during a meeting." },
];

export interface HelpChatRef {
  focusChatInput: () => void;
}

const HelpChatComponent = forwardRef<HelpChatRef, {}>((props, ref) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  useImperativeHandle(ref, () => ({
    focusChatInput: () => {
      chatInputRef.current?.focus();
      chatInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }));

  useEffect(() => {
    setMessages([
      { id: 'greeting', text: "Hello! I'm TeachMeet AI Assistant. How can I help you today?", sender: 'ai', timestamp: new Date() },
      { id: 'faq-intro', text: "Here are some frequently asked questions:", sender: 'system', timestamp: new Date() }
    ]);
  }, []);

  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTo({ top: scrollAreaRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [messages]);

  const handleSendMessage = async (text?: string) => {
    const question = text || inputValue;
    if (!question.trim()) return;

    const userMessage: Message = { id: Date.now().toString(), text: question, sender: 'user', timestamp: new Date() };
    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);
    setError(null);

    try {
      // Call the API route instead of the flow directly
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ question }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch from API');
      }

      const aiMessage: Message = { id: (Date.now() + 1).toString(), text: data.answer, sender: 'ai', timestamp: new Date() };
      setMessages(prev => [...prev, aiMessage]);

    } catch (err) {
      console.error("AI Help Assistant Error:", err);
      let displayMessage = "Sorry, I encountered an error trying to respond. Please try again.";
      let detailErrorState = "Failed to get response from AI assistant.";

      if (err instanceof Error) {
        const errorMessageLower = err.message.toLowerCase();
        if (errorMessageLower.includes('failed to fetch') || errorMessageLower.includes('network error') || errorMessageLower.includes('disconnected')) {
          displayMessage += " This could be due to a network issue, the AI service being temporarily unavailable, or missing API configuration. Please ensure your API key for the AI service is correctly set up in your .env file (e.g., GOOGLE_API_KEY) and check your internet connection.";
          detailErrorState = "Network or connection error. Check console, API key, and internet.";
        } else if (errorMessageLower.includes('failed to fetch from api')) {
           displayMessage = "An error occurred with the AI service. This might be a server-side issue. Please check the server logs for more details.";
           detailErrorState = "API route error. Check server logs.";
        }
      }
      
      const errorMessage: Message = { 
        id: (Date.now() + 1).toString(), 
        text: displayMessage, 
        sender: 'system', 
        timestamp: new Date() 
      };
      setMessages(prev => [...prev, errorMessage]);
      setError(detailErrorState);
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleFAQClick = (question: string) => {
    setInputValue(question);
    handleSendMessage(question);
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      console.log("File selected:", file.name, file.type, file.size);
      toast({
        title: "File Selected (Mock)",
        description: `You selected: ${file.name}. Actual upload/processing is not yet implemented.`,
      });
      event.target.value = '';
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto shadow-2xl rounded-xl border-border/50 flex flex-col h-full min-h-[400px]">
      <CardHeader className="border-b">
        <CardTitle className="flex items-center text-xl font-semibold">
          <MessageSquare className="h-7 w-7 mr-3 text-primary" />
          AI Help Assistant
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-grow p-0">
        <ScrollArea className="h-full p-6" ref={scrollAreaRef}>
          <div className="space-y-6">
            {messages.map((msg) => (
              <div key={msg.id} className={`flex gap-3 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.sender !== 'user' && (
                  <Avatar className="h-10 w-10 border-2 border-primary/50">
                    <AvatarImage src={msg.sender === 'ai' ? `https://placehold.co/40x40/32CD32/FFFFFF.png?text=AI` : `https://placehold.co/40x40/00FFFF/223D4A.png?text=S`} alt={msg.sender} data-ai-hint="avatar ai" />
                    <AvatarFallback>{msg.sender.charAt(0).toUpperCase()}</AvatarFallback>
                  </Avatar>
                )}
                <div className={`max-w-[70%] p-3 rounded-xl shadow-md ${
                  msg.sender === 'user' ? 'bg-primary text-primary-foreground rounded-br-none' : 
                  msg.sender === 'ai' ? 'bg-card text-foreground rounded-bl-none' : 
                  'bg-muted text-muted-foreground text-sm italic text-center w-full'
                }`}>
                  <p className="whitespace-pre-wrap">{msg.text}</p>
                  {msg.sender !== 'system' && <p className="text-xs opacity-70 mt-1 text-right">{msg.timestamp.toLocaleTimeString()}</p>}
                }

                {msg.sender !== 'system' && msg.sender !== 'user' && (
                  <p className="text-xs opacity-70 mt-1 text-right">{msg.timestamp.toLocaleTimeString()}</p>
                )}

                </div>
                {msg.sender === 'user' && (
                  <Avatar className="h-10 w-10 border-2 border-accent/50">
                     <AvatarImage src={`https://placehold.co/40x40/00FFFF/223D4A.png?text=U`} alt="User" data-ai-hint="avatar user" />
                    <AvatarFallback>U</AvatarFallback>
                  </Avatar>
                )}
              </div>
            ))}
            {messages.some(m => m.id === 'faq-intro') && (
              <div className="space-y-2 pt-4 border-t border-border/50">
                <p className="text-sm text-muted-foreground font-medium">Or click a common question:</p>
                {predefinedFAQs.map(faq => (
                  <Button key={faq.q} variant="outline" size="sm" className="mr-2 mb-2 rounded-full text-xs" onClick={() => handleFAQClick(faq.q)}>
                    {faq.q}
                  </Button>
                ))}
              </div>
            )}
            {isLoading && (
              <div className="flex justify-start gap-3">
                 <Avatar className="h-10 w-10 border-2 border-primary/50">
                    <AvatarImage src={`https://placehold.co/40x40/32CD32/FFFFFF.png?text=AI`} alt="AI typing" data-ai-hint="avatar ai" />
                    <AvatarFallback>AI</AvatarFallback>
                  </Avatar>
                <div className="bg-card text-foreground p-3 rounded-xl rounded-bl-none shadow-md">
                  <div className="flex items-center space-x-1">
                    <span className="h-2 w-2 bg-muted-foreground rounded-full animate-pulse delay-75"></span>
                    <span className="h-2 w-2 bg-muted-foreground rounded-full animate-pulse delay-150"></span>
                    <span className="h-2 w-2 bg-muted-foreground rounded-full animate-pulse delay-300"></span>
                  </div>
                </div>
              </div>
            )}
            {error && (
              <div className="flex items-center gap-2 text-destructive bg-destructive/10 p-3 rounded-lg">
                <AlertTriangle className="h-5 w-5" />
                <p className="text-sm">{error}</p>
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>
      <CardFooter className="p-4 border-t">
        <form onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }} className="flex w-full items-center gap-3">
          <Button asChild variant="ghost" size="icon" className="text-muted-foreground hover:text-accent cursor-pointer">
            <label htmlFor="file-upload-input">
              <Paperclip className="h-5 w-5" />
              <span className="sr-only">Attach file</span>
            </label>
          </Button>
          <input 
            type="file" 
            id="file-upload-input" 
            className="hidden" 
            onChange={handleFileChange} 
            disabled={isLoading}
            accept="image/*,application/pdf,.doc,.docx,.txt"
          />
          <Input
            ref={chatInputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Type your question here..."
            className="flex-grow rounded-full bg-card border-border/80 focus:ring-accent text-base"
            disabled={isLoading}
            aria-label="Your question"
          />
          <Button type="submit" size="icon" className="rounded-full btn-gel w-10 h-10" disabled={isLoading || !inputValue.trim()}>
            <Send className="h-5 w-5" />
            <span className="sr-only">Send message</span>
          </Button>
        </form>
      </CardFooter>
    </Card>
  );
});
HelpChatComponent.displayName = 'HelpChat';

export { HelpChatComponent as HelpChat };
