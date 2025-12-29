
"use client";

import React from "react";
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
import { Cast } from 'lucide-react';
import { cn } from "@/lib/utils";
import { buttonVariants } from "../ui/button";

type Props = {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

export const ScreenShareModal: React.FC<Props> = ({ open, onClose, onConfirm }) => {

  const handleContinue = () => {
    onConfirm();
  };
  
  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      onClose();
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent className="sm:max-w-md text-center">
        <AlertDialogHeader className="items-center">
          <Cast className="h-8 w-8 text-primary mb-3" />
          <AlertDialogTitle className="text-xl">Start recording or casting with Meet?</AlertDialogTitle>
          <AlertDialogDescription className="text-muted-foreground px-2">
            Meet will have access to all of the information that is visible on your screen or played from your device while recording or casting. This includes information such as passwords, payment details, photos, messages and audio that you play.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-row gap-2 justify-center pt-4">
          <AlertDialogCancel className="w-full">CANCEL</AlertDialogCancel>
          <AlertDialogAction onClick={handleContinue} className={cn(buttonVariants(), "w-full")}>START NOW</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
