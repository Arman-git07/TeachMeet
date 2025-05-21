
'use client';

import Link from 'next/link';
import { LogOut, UserCircle as UserIconFallback } from 'lucide-react'; // Removed Phone icon
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button, buttonVariants } from '@/components/ui/button'; // Import buttonVariants
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
// import { useToast } from '@/hooks/use-toast'; // Toast not needed if phone option is removed

export function UserProfileDropdown() {
  const { user, isAuthenticated, signOut, loading } = useAuth();
  // const { toast } = useToast(); // Toast not needed

  if (loading) {
    return (
      <div className="flex items-center gap-2">
        <Skeleton className="h-10 w-10 rounded-full" />
        <Skeleton className="h-5 w-20 rounded-md" />
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
  const userAvatarSrc = user.photoURL || `https://placehold.co/40x40/223D4A/FFFFFF.png?text=${userName.charAt(0).toUpperCase()}`;

  return (
    <AlertDialog>
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
          {/* Removed "Add Phone Number" DropdownMenuItem */}
          <AlertDialogTrigger asChild>
            <DropdownMenuItem
              onSelect={(event) => event.preventDefault()} // Prevents DropdownMenu from closing
              className="text-destructive focus:bg-destructive/10 focus:text-destructive cursor-pointer"
            >
              <LogOut className="mr-2 h-4 w-4" />
              <span>Sign Out</span>
            </DropdownMenuItem>
          </AlertDialogTrigger>
        </DropdownMenuContent>
      </DropdownMenu>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you sure you want to sign out?</AlertDialogTitle>
          <AlertDialogDescription>
            You will be logged out of your TeachMeet account. You can always sign back in later.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={signOut} className={buttonVariants({variant: "destructive"})}>
            Sign Out
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
