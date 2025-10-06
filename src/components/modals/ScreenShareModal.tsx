// src/components/modals/ScreenShareModal.tsx
import React from "react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "../ui/button";

type Props = {
  open: boolean;
  onClose: () => void;
  onConfirm: (mode: "replace" | "alongside") => void;
  cameraOn: boolean; // if camera is currently on (shows different text/options)
};

export const ScreenShareModal: React.FC<Props> = ({ open, onClose, onConfirm, cameraOn }) => {
  return (
    <AlertDialog open={open} onOpenChange={onClose}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Share Your Screen</AlertDialogTitle>
                {cameraOn ? (
                    <AlertDialogDescription>
                        Would you like to replace your camera with your screen share, or show it as a new, separate video tile?
                    </AlertDialogDescription>
                ) : (
                    <AlertDialogDescription>
                        Your camera is off. Ready to start sharing your screen?
                    </AlertDialogDescription>
                )}
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel onClick={onClose}>Cancel</AlertDialogCancel>
                {cameraOn ? (
                    <>
                        <Button variant="outline" onClick={() => onConfirm("alongside")}>Share on New Tile</Button>
                        <AlertDialogAction onClick={() => onConfirm("replace")}>Replace Camera</AlertDialogAction>
                    </>
                ) : (
                    <AlertDialogAction onClick={() => onConfirm("replace")}>Share Screen</AlertDialogAction>
                )}
            </AlertDialogFooter>
        </AlertDialogContent>
    </AlertDialog>
  );
};
