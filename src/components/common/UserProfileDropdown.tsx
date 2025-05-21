
'use client';

import Link from 'next/link';
import { LogOut, UserCircle as UserIconFallback, ExternalLink } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button, buttonVariants } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useAuth } from '@/hooks/useAuth';
import { Skeleton } from '../ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

export function UserProfileDropdown() {
  const { user, isAuthenticated, signOut, loading } = useAuth();
  const { toast } = useToast();

  if (loading) {
    return (
      <div className="flex items-center gap-2">
        <Skeleton className="h-10 w-10 rounded-full" />
        {/* Optionally show a small text skeleton if a name placeholder is desired during loading */}
        {/* <Skeleton className="h-5 w-20 rounded-md hidden sm:block" /> */}
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return (
      <Link href="/auth/signin" passHref legacyBehavior>
        <Button variant="ghost" className="rounded-full">
          <UserIconFallback className="mr-2 h-5 w-5" />
          Sign In
        </Button>
      </Link>
    );
  }

  const userName = user.displayName || user.email?.split('@')[0] || "User";
  const userEmail = user.email || "No email";
  // Updated placeholder to use theme colors for better contrast
  const userAvatarSrc = user.photoURL || `https://placehold.co/40x40.png?text=${userName.charAt(0).toUpperCase()}`;


  return (
    <AlertDialog>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="relative h-10 w-10 rounded-full p-0 group">
            <Avatar className="h-10 w-10 border-2 border-border group-hover:border-primary transition-colors">
              <AvatarImage src={userAvatarSrc} alt={userName} data-ai-hint="avatar user" />
              <AvatarFallback className="bg-muted text-muted-foreground">
                {userName.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-60 rounded-xl shadow-xl border-border/70" align="end" forceMount>
          <DropdownMenuLabel className="font-normal px-3 py-2.5">
            <div className="flex flex-col space-y-1">
              <p className="text-sm font-semibold leading-none text-foreground">{userName}</p>
              <p className="text-xs leading-none text-muted-foreground">
                {userEmail}
              </p>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator className="mx-1" />
          <DropdownMenuItem asChild className="p-1 cursor-pointer focus:bg-transparent">
            <a
              href="https://myaccount.google.com/"
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                buttonVariants({ variant: 'outline', size: 'sm' }),
                "w-full flex items-center justify-start text-sm" // Ensure icon and text alignment, explicitly set text-sm
              )}
            >
              <ExternalLink className="mr-2 h-4 w-4" /> {/* Icon size is handled by buttonVariants */}
              <span>Manage Google Account</span>
            </a>
          </DropdownMenuItem>
          <DropdownMenuSeparator className="mx-1" />
          <AlertDialogTrigger asChild>
            <DropdownMenuItem
              onSelect={(event) => event.preventDefault()} 
              className="text-destructive focus:bg-destructive/10 focus:text-destructive cursor-pointer px-3 py-2"
            >
              <LogOut className="mr-2.5 h-4 w-4" />
              <span>Sign Out</span>
            </DropdownMenuItem>
          </AlertDialogTrigger>
        </DropdownMenuContent>
      </DropdownMenu>
      <AlertDialogContent className="rounded-xl shadow-xl">
        <AlertDialogHeader>
          <AlertDialogTitle>Are you sure you want to sign out?</AlertDialogTitle>
          <AlertDialogDescription>
            You will be logged out of your TeachMeet account. You can always sign back in later.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="rounded-md">Cancel</AlertDialogCancel>
          <AlertDialogAction 
            onClick={signOut} 
            className={cn(buttonVariants({variant: "destructive", className: "rounded-md"}))}
          >
            Sign Out
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
