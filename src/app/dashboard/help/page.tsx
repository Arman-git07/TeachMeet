'use client';

import { HelpChat } from '@/components/help/HelpChat';
import { LifeBuoy } from 'lucide-react';

export default function DashboardHelpPage() {
  return (
    <div className="container mx-auto p-4 md:p-8 flex flex-col items-center h-full">
        <div className="text-center mb-8">
             <h1 className="text-3xl font-bold flex items-center gap-3">
                <LifeBuoy className="h-8 w-8 text-primary" />
                AI Help Assistant
            </h1>
            <p className="text-muted-foreground mt-2">Ask me anything about how to use TeachMeet.</p>
        </div>
      <div className="w-full h-full flex-grow">
        <HelpChat />
      </div>
    </div>
  );
}
