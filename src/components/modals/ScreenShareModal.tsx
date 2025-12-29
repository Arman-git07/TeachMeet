
"use client";

import React, { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Cast } from 'lucide-react';
import { cn } from "@/lib/utils";
import { buttonVariants } from "../ui/button";

type Props = {
  open: boolean;
  onClose: () => void;
  onConfirm: (shareAudio: boolean) => void;
};

export const ScreenShareModal: React.FC<Props> = ({ open, onClose, onConfirm }) => {
  const [shareAudio, setShareAudio] = useState(true);

  const handleContinue = () => {
    onConfirm(shareAudio);
  };
  
  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      onClose();
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent className="sm:max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-xl">Share your screen?</AlertDialogTitle>
          <AlertDialogDescription>
            People will see everything on your screen, including notifications. TeachMeet will have access to all of the information that is visible on your screen.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="flex items-center space-x-2 py-4">
          <Checkbox id="share-audio" checked={shareAudio} onCheckedChange={(checked) => setShareAudio(Boolean(checked))} />
          <Label htmlFor="share-audio" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
            Also share your device's audio
          </Label>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleContinue}>Continue</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
