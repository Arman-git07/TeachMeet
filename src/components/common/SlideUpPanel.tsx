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
      <div className="container mx-auto max-w-2xl flex flex-col sm:flex-row items-center justify-around gap-4">
        <Link href="/auth/signin?action=start" passHref legacyBehavior>
          <Button
            size="lg"
            className="w-full sm:w-auto btn-gel text-lg py-8 px-10 rounded-xl shadow-lg hover:shadow-primary/50"
            aria-label="Start New Meeting"
          >
            <PlusCircle className="mr-2 h-6 w-6" />
            Start New Meeting
          </Button>
        </Link>
        <Link href="/auth/signin?action=join" passHref legacyBehavior>
          <Button
            variant="secondary"
            size="lg"
            className="w-full sm:w-auto bg-accent text-accent-foreground hover:bg-accent/90 text-lg py-8 px-10 rounded-xl shadow-lg hover:shadow-accent/50"
            aria-label="Join Existing Meeting"
          >
            <Video className="mr-2 h-6 w-6" />
            Join Meeting
          </Button>
        </Link>
      </div>
      <div className="mt-6 flex items-center justify-center gap-2">
        <Input 
          type="text"
          placeholder="Enter Meeting Code"
          className="max-w-xs rounded-lg bg-card border-border focus:ring-accent text-center"
          aria-label="Meeting Code"
        />
        <Button variant="outline" className="rounded-lg border-accent text-accent hover:bg-accent hover:text-accent-foreground">
          <Code className="mr-2 h-5 w-5" /> Go
        </Button>
      </div>
    </div>
  );
}
