
'use client';

import Link from 'next/link';
import { LogOut, UserCircle as UserIconFallback, ExternalLink, ImageIcon, Phone } from 'lucide-react';
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
  AlertDialogTrigger as SignOutAlertDialogTrigger, // Alias to avoid conflict
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import { useAuth } from '@/hooks/useAuth';
import { Skeleton } from '../ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import Image from 'next/image';
import React, { useState, useRef } from 'react';

const popularAvatars = [
  { id: 'panda', src: 'https://placehold.co/80x80.png', alt: 'Panda Avatar', hint: 'panda animal' },
  { id: 'cat', src: 'https://placehold.co/80x80.png', alt: 'Cat Avatar', hint: 'cat animal' },
  { id: 'robot', src: 'https://placehold.co/80x80.png', alt: 'Robot Avatar', hint: 'robot technology' },
  { id: 'astronaut', src: 'https://placehold.co/80x80.png', alt: 'Astronaut Avatar', hint: 'astronaut space' },
];

export function UserProfileDropdown() {
  const { user, isAuthenticated, signOut, loading } = useAuth();
  const { toast } = useToast();
  const [selectedAvatar, setSelectedAvatar] = useState<string | null>(null);
  const [isAvatarDialogOpen, setIsAvatarDialogOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (loading) {
    return (
      <div className="flex items-center gap-2">
        <Skeleton className="h-10 w-10 rounded-full" />
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
  const userAvatarSrc = user.photoURL || `https://placehold.co/40x40.png?text=${userName.charAt(0).toUpperCase()}`;

  const handleSaveAvatar = () => {
    if (selectedAvatar) {
      const chosenAvatar = popularAvatars.find(avatar => avatar.id === selectedAvatar);
      toast({
        title: "Avatar Changed (Mock)",
        description: `Your avatar is now ${chosenAvatar?.alt || selectedAvatar}. (This is a mock action)`,
      });
      // In a real app, you would update user.photoURL here via Firebase
      // For example: updateProfile(auth.currentUser, { photoURL: chosenAvatar.src })
    } else {
      toast({
        variant: "destructive",
        title: "No Avatar Selected",
        description: "Please select an avatar first.",
      });
    }
    setIsAvatarDialogOpen(false); // Close dialog
  };

  const handleUploadCustomAvatar = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelected = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      toast({
        title: "Image Selected (Mock)",
        description: `You selected: ${file.name}. Uploading and processing would happen here.`,
      });
      // In a real app, you would handle the file upload here
      if (event.target) {
        event.target.value = ""; // Reset file input to allow selecting the same file again
      }
    }
  };

  return (
    <AlertDialog>
      <Dialog open={isAvatarDialogOpen} onOpenChange={setIsAvatarDialogOpen}>
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
                  "w-full flex items-center justify-start text-sm"
                )}
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                <span>Manage Google Account</span>
              </a>
            </DropdownMenuItem>
            
            <DialogTrigger asChild>
              <DropdownMenuItem 
                onSelect={(e) => { e.preventDefault(); setIsAvatarDialogOpen(true); }} 
                className="cursor-pointer px-3 py-2"
              >
                <ImageIcon className="mr-2.5 h-4 w-4" />
                <span>Change Avatar</span>
              </DropdownMenuItem>
            </DialogTrigger>

            <DropdownMenuSeparator className="mx-1" />
            <SignOutAlertDialogTrigger asChild>
              <DropdownMenuItem
                onSelect={(event) => event.preventDefault()} 
                className="text-destructive focus:bg-destructive/10 focus:text-destructive cursor-pointer px-3 py-2"
              >
                <LogOut className="mr-2.5 h-4 w-4" />
                <span>Sign Out</span>
              </DropdownMenuItem>
            </SignOutAlertDialogTrigger>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Avatar Change Dialog Content */}
        <DialogContent className="sm:max-w-md rounded-lg">
          <DialogHeader>
            <DialogTitle>Choose Your Avatar</DialogTitle>
            <DialogDescription>
              Select one of the popular avatars or upload your own.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <p className="text-sm font-medium text-foreground">Popular Avatars</p>
            <div className="grid grid-cols-4 gap-4">
              {popularAvatars.map((avatar) => (
                <button
                  key={avatar.id}
                  onClick={() => setSelectedAvatar(avatar.id)}
                  className={cn(
                    "rounded-full overflow-hidden border-2 p-0.5 transition-all",
                    selectedAvatar === avatar.id ? "border-primary ring-2 ring-primary" : "border-transparent hover:border-primary/50"
                  )}
                  aria-label={`Select ${avatar.alt}`}
                >
                  <Image src={avatar.src} alt={avatar.alt} width={80} height={80} className="rounded-full" data-ai-hint={avatar.hint} />
                </button>
              ))}
            </div>
            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">
                  Or
                </span>
              </div>
            </div>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelected}
              accept="image/*"
              className="hidden"
            />
            <Button variant="outline" className="w-full rounded-md" onClick={handleUploadCustomAvatar}>
              <ImageIcon className="mr-2 h-4 w-4" />
              Upload Custom Avatar
            </Button>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" className="rounded-md">
                Cancel
              </Button>
            </DialogClose>
            <Button type="button" onClick={handleSaveAvatar} className="btn-gel rounded-md">
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sign Out Alert Dialog Content */}
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
