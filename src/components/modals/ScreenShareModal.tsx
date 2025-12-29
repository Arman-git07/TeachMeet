
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

type Props = {
  open: boolean;
  onClose: () => void;
  onConfirm: (shareAudio: boolean) => void;
};

export const ScreenShareModal: React.FC<Props> = ({ open, onClose, onConfirm }) => {
  const [shareAudio, setShareAudio] = useState(false);

  const handleContinue = () => {
    onConfirm(shareAudio);
  };
  
  // Reset state when dialog closes
  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      setShareAudio(false);
      onClose();
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Share your screen?</AlertDialogTitle>
          <AlertDialogDescription>
            People will see everything on your screen, including notifications.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="flex items-center space-x-2 py-4">
          <Checkbox id="share-audio" checked={shareAudio} onCheckedChange={(checked) => setShareAudio(!!checked)} />
          <div className="grid gap-1.5 leading-none">
            <Label
              htmlFor="share-audio"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              Also share your device's audio
            </Label>
            <p className="text-xs text-muted-foreground">
              The mute button stops sharing audio and turns off your mic.
            </p>
          </div>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleContinue}>Continue</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
