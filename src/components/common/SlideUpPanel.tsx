
'use client';
import { Button } from '@/components/ui/button';
import { Video, PlusCircle, Code } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useState, useEffect } from 'react';
import Link from 'next/link';

export function SlideUpPanel() {
  const [showPanel, setShowPanel] = useState(false);

  useEffect(() => {
    // Trigger slide up animation after a short delay for visual effect
    const timer = setTimeout(() => setShowPanel(true), 300);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div
      className={`fixed bottom-0 left-0 right-0 transform transition-all duration-700 ease-in-out ${
        showPanel ? 'translate-y-0' : 'translate-y-full'
      } bg-gradient-to-t from-background to-background/90 backdrop-blur-sm p-6 shadow-2xl rounded-t-2xl border-t border-border`}
    >
      <div className="container mx-auto max-w-3xl flex flex-col sm:flex-row items-center sm:items-start justify-center gap-x-6 gap-y-4">
        {/* Start New Meeting Button */}
        <div className="w-full sm:flex-1 flex justify-center">
          <Link href="/auth/signin?action=start" passHref legacyBehavior>
            <Button
              size="lg"
              className="w-full max-w-xs btn-gel text-lg py-6 px-8 rounded-xl shadow-lg hover:shadow-primary/50"
              aria-label="Start New Meeting"
            >
              <PlusCircle className="mr-2 h-6 w-6" />
              Start New Meeting
            </Button>
          </Link>
        </div>

        {/* Join Meeting Section */}
        <div className="w-full sm:flex-1 flex flex-col items-center">
          {/* Relative container for the "Join Meeting" button, so "Go" can be positioned over it */}
          <div className="relative w-full max-w-xs">
            <Link href="/auth/signin?action=join" passHref legacyBehavior className="block">
              <Button
                size="lg"
                className="w-full btn-gel text-lg py-6 px-8 rounded-xl shadow-lg hover:shadow-primary/50"
                aria-label="Join Existing Meeting"
              >
                <Video className="mr-2 h-6 w-6" />
                Join Meeting
              </Button>
            </Link>

            {/* The "Go" button, positioned to overlap a corner of the "Join Meeting" button */}
            <Button
              className="absolute top-1 right-1 bg-cta-orange text-cta-orange-foreground hover:bg-cta-orange/90 shrink-0 rounded-md shadow-lg z-10 px-3 py-1.5 text-sm flex items-center"
              aria-label="Submit Meeting Code"
              // onClick logic would need to handle form submission or read from input with id="meetingCodeInputSlideUp"
            >
              <Code className="h-4 w-4" /> 
            </Button>
          </div>

          {/* Input field for meeting code, now sits below the Join Meeting button group */}
          <div className="mt-3 w-full max-w-xs">
            <Input
              id="meetingCodeInputSlideUp" // Unique ID for this input
              type="text"
              placeholder="Enter Meeting Code"
              className="w-full rounded-lg bg-card border-border focus:ring-accent text-center"
              aria-label="Meeting Code"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
    
