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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import type { ShareMode } from "@/lib/webrtc/screenShare";


type Props = {
  open: boolean;
  onClose: () => void;
  onConfirm: (shareAudio: boolean, mode: ShareMode) => void;
  isCameraOn: boolean;
};

export const ScreenShareModal: React.FC<Props> = ({ open, onClose, onConfirm, isCameraOn }) => {
  const [shareAudio, setShareAudio] = useState(true);
  const [shareMode, setShareMode] = useState<ShareMode>('replace');

  const handleContinue = () => {
    // If camera is off, we default to 'replace' because 'alongside' 
    // implies sharing BESIDE the camera, which is unnecessary if cam is off.
    onConfirm(shareAudio, isCameraOn ? shareMode : 'replace');
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
            {isCameraOn 
              ? "Choose how you want to present. Your browser will ask you to select a screen, window, or tab."
              : "Your browser will ask you to select a screen, window, or tab to share."
            }
          </AlertDialogDescription>
        </AlertDialogHeader>
        
        {isCameraOn && (
          <RadioGroup defaultValue="replace" value={shareMode} onValueChange={(value) => setShareMode(value as ShareMode)} className="py-4 space-y-3">
            <Label htmlFor="replace-mode" className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer has-[:checked]:bg-primary/10 has-[:checked]:border-primary">
              <RadioGroupItem value="replace" id="replace-mode" />
              <div className="grid gap-0.5">
                  <span className="font-medium">Replace Camera Feed</span>
                  <span className="text-xs text-muted-foreground">Your screen will replace your video.</span>
              </div>
            </Label>
            <Label htmlFor="alongside-mode" className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer has-[:checked]:bg-primary/10 has-[:checked]:border-primary">
              <RadioGroupItem value="alongside" id="alongside-mode" />
              <div className="grid gap-0.5">
                  <span className="font-medium">Share as New Video</span>
                  <span className="text-xs text-muted-foreground">Your screen appears as a new participant.</span>
              </div>
            </Label>
          </RadioGroup>
        )}

        <div className="flex items-center space-x-2 pt-4 border-t">
          <Checkbox id="share-audio" checked={shareAudio} onCheckedChange={(checked) => setShareAudio(Boolean(checked))} />
          <Label htmlFor="share-audio" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
            Also share tab/device audio
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