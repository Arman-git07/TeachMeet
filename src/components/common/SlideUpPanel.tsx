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
        <div className="w-full sm:flex-1 flex flex-col items-center gap-3">
          <Link href="/auth/signin?action=join" passHref legacyBehavior className="w-full flex justify-center">
            <Button
              size="lg"
              className="w-full max-w-xs btn-gel text-lg py-6 px-8 rounded-xl shadow-lg hover:shadow-primary/50"
              aria-label="Join Existing Meeting"
            >
              <Video className="mr-2 h-6 w-6" />
              Join Meeting
            </Button>
          </Link>
          {/* Input and Go button for meeting code */}
          <div className="flex items-center justify-center gap-2 w-full max-w-xs">
            <Input
              type="text"
              placeholder="Enter Meeting Code"
              className="flex-grow rounded-lg bg-card border-border focus:ring-accent text-center"
              aria-label="Meeting Code"
            />
            <Button className="rounded-lg bg-cta-orange text-cta-orange-foreground hover:bg-cta-orange/90 shrink-0">
              <Code className="mr-2 h-5 w-5" /> Go
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
