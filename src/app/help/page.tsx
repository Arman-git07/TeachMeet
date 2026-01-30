'use client';

import { AppHeader } from "@/components/common/AppHeader";
import { HelpChat, type HelpChatRef } from "@/components/help/HelpChat";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { LifeBuoy, MessageCircle } from "lucide-react";
import { useRef } from "react";

export default function HelpPage() {
    const chatRef = useRef<HelpChatRef>(null);

    const handleContactSupportClick = () => {
        chatRef.current?.focusChatInput();
    };

  return (
    <div className="flex flex-col min-h-screen">
      <AppHeader showLogo={true} />
      <main className="flex-grow container mx-auto py-12 px-4">
        <div className="text-center mb-12">
            <LifeBuoy className="mx-auto h-16 w-16 text-primary mb-4" />
            <h1 className="text-4xl font-bold tracking-tight">Help & Support</h1>
            <p className="mt-2 text-lg text-muted-foreground">
                How can we assist you today?
            </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
            <Card className="shadow-lg rounded-xl">
                <CardHeader>
                    <CardTitle>Frequently Asked Questions</CardTitle>
                    <CardDescription>
                        Find quick answers to common questions about TeachMeet.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div>
                        <h4 className="font-semibold">How do I start or join a meeting?</h4>
                        <p className="text-sm text-muted-foreground">Use the "Start New Meeting" or "Join Meeting" buttons on the home page or in the sidebar. You'll need a meeting code or link to join.</p>
                    </div>
                     <div>
                        <h4 className="font-semibold">How can I share my screen?</h4>
                        <p className="text-sm text-muted-foreground">During a meeting, use the screen share button in the control bar. You can choose to share your entire screen, a window, or a browser tab.</p>
                    </div>
                     <div>
                        <h4 className="font-semibold">Where are my recordings and documents?</h4>
                        <p className="text-sm text-muted-foreground">You can find all your saved recordings and uploaded documents in the "Recordings" and "Documents" sections in the sidebar.</p>
                    </div>
                </CardContent>
            </Card>

             <Card className="shadow-lg rounded-xl sticky top-24">
                <CardHeader>
                    <CardTitle>Contact Support</CardTitle>
                    <CardDescription>
                        Can't find what you're looking for? Chat with our AI Assistant.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                   <p className="text-sm text-muted-foreground">
                        Our AI assistant can help answer your questions about using TeachMeet. Just type your question below.
                    </p>
                    <Button className="w-full mt-4 btn-gel" onClick={handleContactSupportClick}>
                        <MessageCircle className="mr-2 h-4 w-4" /> Chat with AI Assistant
                    </Button>
                </CardContent>
            </Card>
        </div>
        
        <div className="mt-12">
            <HelpChat ref={chatRef} />
        </div>
      </main>
      <footer className="py-8 text-center text-muted-foreground text-sm border-t border-border">
        © {new Date().getFullYear()} TeachMeet. All rights reserved.
      </footer>
    </div>
  );
}
