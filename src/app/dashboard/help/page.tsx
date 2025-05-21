'use client';

import { HelpChat, type HelpChatRef } from '@/components/help/HelpChat';
import { Input } from '@/components/ui/input';
import { useRef } from 'react';

export default function HelpPage() {
  const helpChatRef = useRef<HelpChatRef>(null);

  const handleTopInputInteraction = () => {
    helpChatRef.current?.focusChatInput();
  };

  return (
    <div className="container mx-auto py-8 flex flex-col items-center">
      <div className="w-full max-w-3xl mb-8 text-center">
        <h1 className="text-3xl font-bold text-foreground mb-2">How can we help?</h1>
        <p className="text-muted-foreground">
          Ask our AI Assistant any questions you have about using TeachMeet.
          You can type your query in the chat window below, or use the field here to start.
        </p>
      </div>

      <div className="w-full max-w-xl mb-6 px-4"> {/* Reduced mb from 8 to 6 */}
        <Input
          type="text"
          placeholder="Click here or scroll down to type your question..."
          onFocus={handleTopInputInteraction}
          onClick={handleTopInputInteraction}
          className="text-center text-base py-3 rounded-lg shadow-md border-primary/30 focus:ring-2 focus:ring-primary cursor-pointer hover:border-primary/60 transition-colors"
          readOnly 
        />
        <p className="text-xs text-muted-foreground text-center mt-2">
          This will focus the main chat input below.
        </p>
      </div>

      {/* The HelpChat component itself contains the actual question asking textbox */}
      <HelpChat ref={helpChatRef} />
    </div>
  );
}
