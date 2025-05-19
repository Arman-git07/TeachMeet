'use client';

import Link from 'next/link';
import { LogOut, Settings, UserCircle } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
// In a real app, authentication state would come from a context or hook.
// For this example, we'll use a mock state.
// import { useAuth } from '@/hooks/useAuth'; // Fictional auth hook

export function UserProfileDropdown() {
  const { toast } = useToast();
  // const { user, isAuthenticated, signOut } = useAuth(); // Fictional auth hook
  
  // Mocked authentication state and user data
  const isAuthenticated = true; // Change this to false to see the "Sign In" button
  const userName = "Demo User";
  const userEmail = "demo@example.com";
  // Placeholder image, ideally from user data
  const userAvatarSrc = `https://placehold.co/40x40/223D4A/FFFFFF.png?text=${userName.charAt(0)}`;


  const handleSignOut = async () => {
    // await signOut(); // Fictional sign out
    toast({ title: "Signed Out (Mock)", description: "You have been signed out." });
    // router.push('/'); // Redirect to home or sign-in page
  };

  if (!isAuthenticated) {
    return (
      <Link href="/auth/signin" passHref legacyBehavior>
        <Button variant="ghost" className="rounded-full">
          <UserCircle className="mr-2 h-5 w-5" />
          Sign In
        </Button>
      </Link>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-10 w-10 rounded-full p-0">
          <Avatar className="h-10 w-10 border-2 border-border hover:border-primary transition-colors">
            <AvatarImage src={userAvatarSrc} alt={userName} data-ai-hint="avatar user" />
            <AvatarFallback>{userName.charAt(0).toUpperCase()}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56 rounded-lg shadow-lg" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1 py-1">
            <p className="text-sm font-medium leading-none">{userName}</p>
            <p className="text-xs leading-none text-muted-foreground">
              {userEmail}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild className="cursor-pointer">
          <Link href="/dashboard/settings">
            <Settings className="mr-2 h-4 w-4" />
            <span>Settings</span>
          </Link>
        </DropdownMenuItem>
        {/* You can add more items like "My Profile" if applicable */}
        {/* <DropdownMenuItem asChild className="cursor-pointer">
          <Link href="/dashboard/profile">
            <UserCircle className="mr-2 h-4 w-4" />
            <span>My Profile</span>
          </Link>
        </DropdownMenuItem> */}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleSignOut} className="text-destructive focus:bg-destructive/10 focus:text-destructive cursor-pointer">
          <LogOut className="mr-2 h-4 w-4" />
          <span>Sign Out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
