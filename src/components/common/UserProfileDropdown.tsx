
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
  AlertDialogTrigger as SignOutAlertDialogTrigger,
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
import { auth, storage } from '@/lib/firebase'; // Import storage
import { ref as storageRef, uploadBytesResumable, getDownloadURL } from 'firebase/storage'; // Firebase storage functions
import { updateProfile } from 'firebase/auth'; // Firebase auth function

export function UserProfileDropdown() {
  const { user, isAuthenticated, signOut, loading } = useAuth();
  const { toast } = useToast();
  const [isAvatarDialogOpen, setIsAvatarDialogOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

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

  const handleUploadCustomAvatar = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && auth.currentUser) {
      setIsUploading(true);
      toast({
        title: "Uploading Avatar...",
        description: `Uploading ${file.name}. Please wait.`,
      });

      const filePath = `avatars/${auth.currentUser.uid}/avatar.png`;
      const fileRef = storageRef(storage, filePath);
      const uploadTask = uploadBytesResumable(fileRef, file);

      uploadTask.on('state_changed',
        (snapshot) => {
          // Optionally, update progress here
        },
        (error) => {
          console.error("Avatar Upload Error:", error);
          toast({
            variant: "destructive",
            title: "Upload Failed",
            description: "Could not upload your avatar. Please try again.",
          });
          setIsUploading(false);
        },
        async () => {
          try {
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
            await updateProfile(auth.currentUser!, { photoURL: downloadURL });
            toast({
              title: "Avatar Uploaded!",
              description: "Your new avatar has been set.",
            });
            setIsAvatarDialogOpen(false); 
          } catch (error) {
            console.error("Error setting avatar URL:", error);
            toast({
              variant: "destructive",
              title: "Update Failed",
              description: "Could not update your profile with the new avatar.",
            });
          } finally {
            setIsUploading(false);
          }
        }
      );

      if (event.target) {
        event.target.value = ""; 
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
            <DialogTitle>Change Your Avatar</DialogTitle>
            <DialogDescription>
              Upload a custom avatar.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelected}
              accept="image/*"
              className="hidden"
              disabled={isUploading}
            />
            <Button variant="outline" className="w-full rounded-md" onClick={handleUploadCustomAvatar} disabled={isUploading}>
              <ImageIcon className="mr-2 h-4 w-4" />
              {isUploading ? "Uploading..." : "Upload Custom Avatar"}
            </Button>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" className="rounded-md" disabled={isUploading}>
                Cancel
              </Button>
            </DialogClose>
            <Button type="button" className="btn-gel rounded-md" disabled={isUploading || true}>
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
