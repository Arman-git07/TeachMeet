
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
import { Youtube, Lock, Globe, Loader2 } from 'lucide-react';
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
  
  const handleOpenYouTube = () => {
    // This is the direct upload page for YouTube Studio.
    window.open('https://studio.youtube.com/', '_blank', 'noopener,noreferrer');
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md rounded-xl">
        <DialogHeader>
          <DialogTitle>Save Your Recording</DialogTitle>
          <DialogDescription>
            First, save your recording to TeachMeet. After it's saved, you can download it from your library and upload it to other sites.
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
             <Label className="font-semibold">2. Optional: Upload to YouTube</Label>
             <Button variant="outline" className="w-full justify-start border-red-500/50 text-red-600 hover:bg-red-500/10 hover:text-red-700" onClick={handleOpenYouTube}>
                <Youtube className="mr-2 h-4 w-4" />
                Open YouTube Upload Page
             </Button>
             <p className="text-xs text-muted-foreground">This will open YouTube Studio in a new tab. You can upload your video there after you have saved and downloaded it.</p>
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
