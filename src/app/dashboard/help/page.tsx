
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
    // This div takes full height available in the <main> slot of DashboardLayout
    <div className="flex flex-col h-full items-center">
      {/* Top static content - kept relatively compact */}
      <div className="w-full max-w-3xl text-center pt-4 md:pt-0"> {/* Adjust pt for layout consistency */}
        <h1 className="text-3xl font-bold text-foreground mb-2">How can we help?</h1>
        <p className="text-muted-foreground">
          Ask our AI Assistant any questions you have about using TeachMeet.
          You can type your query in the chat window below, or use the field here to start.
        </p>
      </div>

      <div className="w-full max-w-xl my-4 px-4"> {/* my-4 for vertical spacing */}
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

      {/* HelpChat container - this div will grow to fill remaining vertical space */}
      <div className="w-full flex-grow flex flex-col items-center pb-4"> {/* Ensures HelpChat can take height and has some bottom padding */}
        <HelpChat ref={helpChatRef} />
      </div>
    </div>
  );
}
