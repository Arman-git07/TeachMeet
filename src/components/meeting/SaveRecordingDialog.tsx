
'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Mail, Lock, Globe, Loader2 } from 'lucide-react';
import { useState } from 'react';

interface SaveRecordingDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onSave: (destination: 'private' | 'public') => void;
  isSaving: boolean;
}

export function SaveRecordingDialog({ isOpen, onOpenChange, onSave, isSaving }: SaveRecordingDialogProps) {
  const [destination, setDestination] = useState<'private' | 'public'>('private');

  const handleSave = () => {
    onSave(destination);
  };
  
  const handleEmailRecording = () => {
    const subject = "TeachMeet Meeting Recording";
    const body = "I've recorded a meeting. Please find the video file attached.\n\n(After saving, please go to your recordings library, download this video, and attach it to this email.)";
    window.location.href = `mailto:07arman2004@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md rounded-xl">
        <DialogHeader>
          <DialogTitle>Save Your Recording</DialogTitle>
          <DialogDescription>
            Choose a destination for your recording. You can also share it after it's saved.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-6">
          <div className="space-y-3">
            <Label className="font-semibold">1. Choose Save Destination</Label>
            <RadioGroup value={destination} onValueChange={(value) => setDestination(value as 'private' | 'public')}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="private" id="r-private" />
                <Label htmlFor="r-private" className="flex items-center gap-2 cursor-pointer"><Lock className="h-4 w-4 text-primary" /> Private (Only you can see)</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="public" id="r-public" />
                <Label htmlFor="r-public" className="flex items-center gap-2 cursor-pointer"><Globe className="h-4 w-4 text-accent" /> Public (Visible to others)</Label>
              </div>
            </RadioGroup>
          </div>
          <div className="space-y-3">
             <Label className="font-semibold">2. Optional: Share Recording</Label>
             <div className="space-y-2">
                <Button variant="outline" className="w-full justify-start" onClick={handleEmailRecording}>
                    <Mail className="mr-2 h-4 w-4" />
                    Email Recording to Admin
                </Button>
             </div>
             <p className="text-xs text-muted-foreground mt-2">
                To upload to YouTube, please mail the creator/owner. You will need to save and download the recording first before you can attach it.
             </p>
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild><Button type="button" variant="ghost" disabled={isSaving}>Cancel</Button></DialogClose>
          <Button type="button" onClick={handleSave} disabled={isSaving} className="btn-gel">
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null}
            {isSaving ? 'Saving...' : 'Save Recording'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
