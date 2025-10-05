// src/components/modals/ScreenShareHostModal.tsx
"use client";

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

interface ScreenShareHostModalProps {
  isOpen: boolean;
  participantName: string;
  onApprove: () => void;
  onDeny: () => void;
}

export function ScreenShareHostModal({ isOpen, participantName, onApprove, onDeny }: ScreenShareHostModalProps) {
  return (
    <AlertDialog open={isOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{`'${participantName}' wants to share their screen`}</AlertDialogTitle>
          <AlertDialogDescription>
            Do you want to allow them to share their screen? Allowing this will replace their camera feed with their screen content for everyone in the meeting.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onDeny}>Deny</AlertDialogCancel>
          <AlertDialogAction onClick={onApprove}>Allow</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
