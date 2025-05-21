
'use client'; // Added this directive

import { HelpChat } from '@/components/help/HelpChat';
import { AppHeader } from '@/components/common/AppHeader'; // For consistency if needed
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function PublicHelpPage() {
  // This page is for unauthenticated users.
  // Authenticated users should be directed to /dashboard/help
  
  // In a real app, you might check auth status and redirect:
  // const { isAuthenticated } = useAuth(); // Fictional auth hook
  // if (isAuthenticated) {
  //   router.replace('/dashboard/help');
  //   return null; // Or a loading spinner
  // }

  return (
    <div className="flex flex-col min-h-screen">
      <AppHeader showLogo={true}/>
      <main className="flex-grow container mx-auto py-8 flex flex-col items-center">
        <div className="w-full max-w-3xl p-4 mb-8 text-center">
          <h1 className="text-3xl font-bold text-foreground mb-2">Need Help?</h1>
          <p className="text-muted-foreground">
            Use our AI Assistant to find answers to your questions about TeachMeet.
            If you have an account, <Link href="/auth/signin" className="text-accent hover:underline">sign in</Link> for more personalized support.
          </p>
        </div>
        <HelpChat />
      </main>
       <footer className="py-8 text-center text-muted-foreground text-sm border-t border-border">
        © {new Date().getFullYear()} TeachMeet. All rights reserved.
        <div className="mt-2">
          <Link href="/auth/signin" className="hover:text-accent hover:underline mx-2">Sign In</Link> | 
          <Link href="/auth/signup" className="hover:text-accent hover:underline mx-2">Sign Up</Link>
        </div>
      </footer>
    </div>
  );
}
