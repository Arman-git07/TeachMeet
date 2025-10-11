
"use client";

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface JoinRequestModalProps {
  isOpen: boolean;
  request: {
    userName: string;
    userPhotoURL?: string;
  } | null;
  onApprove: () => void;
  onDeny: () => void;
}

export function JoinRequestModal({ isOpen, request, onApprove, onDeny }: JoinRequestModalProps) {
  if (!request) {
    return null;
  }

  return (
    <AlertDialog open={isOpen}>
      <AlertDialogContent>
        <AlertDialogHeader className="flex flex-col items-center text-center">
          <Avatar className="h-16 w-16 mb-4">
            <AvatarImage src={request.userPhotoURL} alt={request.userName} data-ai-hint="avatar user"/>
            <AvatarFallback>{request.userName.charAt(0).toUpperCase()}</AvatarFallback>
          </Avatar>
          <AlertDialogTitle>{`'${request.userName}' wants to join`}</AlertDialogTitle>
          <AlertDialogDescription>
            Do you want to allow this user to join the meeting?
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
