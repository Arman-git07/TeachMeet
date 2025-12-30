
'use client';

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useBlock, type BlockSettings, type BlockScope } from '@/contexts/BlockContext';
import { useToast } from '@/hooks/use-toast';
import { UserX, MessageCircle, EyeOff, VideoOff, MicOff } from 'lucide-react';

interface BlockUserDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  participant: { id: string; name: string } | null;
}

export function BlockUserDialog({ isOpen, onOpenChange, participant }: BlockUserDialogProps) {
  const { blockUser } = useBlock();
  const { toast } = useToast();
  
  const [settings, setSettings] = useState<BlockSettings>({
    privateChat: true,
    publicChat: false,
    video: true,
    audio: true,
  });
  const [scope, setScope] = useState<BlockScope>('thisMeeting');

  if (!participant) return null;

  const handleSettingChange = (key: keyof BlockSettings, checked: boolean) => {
    setSettings(prev => ({ ...prev, [key]: checked }));
  };

  const handleBlockConfirm = () => {
    blockUser(participant.id, settings, scope);
    toast({
      title: 'User Blocked',
      description: `${participant.name} has been blocked with your selected settings.`,
    });
    onOpenChange(false);
  };
  
  const CheckboxItem = ({ id, label, icon: Icon, checked, onCheckedChange }: { id: keyof BlockSettings, label: string, icon: React.ElementType, checked: boolean, onCheckedChange: (checked: boolean) => void }) => (
    <div className="flex items-center space-x-3 rounded-md border p-3 hover:bg-muted/50 transition-colors">
        <Checkbox id={id} checked={checked} onCheckedChange={onCheckedChange} />
        <Label htmlFor={id} className="flex items-center gap-2 text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer">
            <Icon className="h-4 w-4 text-muted-foreground" />
            {label}
        </Label>
    </div>
  );

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><UserX className="h-5 w-5" />Block '{participant.name}'?</DialogTitle>
          <DialogDescription>
            Select what you want to block. The user will not be notified that you have blocked them.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-6">
          <div className="space-y-3">
              <h4 className="text-sm font-medium text-muted-foreground">Block Actions</h4>
              <CheckboxItem id="privateChat" label="Block private messages" icon={MessageCircle} checked={settings.privateChat} onCheckedChange={(c) => handleSettingChange('privateChat', c)} />
              <CheckboxItem id="publicChat" label="Hide their public messages" icon={EyeOff} checked={settings.publicChat} onCheckedChange={(c) => handleSettingChange('publicChat', c)} />
              <CheckboxItem id="video" label="Stop their video" icon={VideoOff} checked={settings.video} onCheckedChange={(c) => handleSettingChange('video', c)} />
              <CheckboxItem id="audio" label="Mute their audio" icon={MicOff} checked={settings.audio} onCheckedChange={(c) => handleSettingChange('audio', c)} />
          </div>
          <div className="space-y-3">
              <h4 className="text-sm font-medium text-muted-foreground">Block Scope</h4>
              <RadioGroup defaultValue="thisMeeting" value={scope} onValueChange={(value) => setScope(value as BlockScope)}>
                  <div className="flex items-center space-x-2"><RadioGroupItem value="thisMeeting" id="r1" /><Label htmlFor="r1">For this meeting only</Label></div>
                  <div className="flex items-center space-x-2"><RadioGroupItem value="allMeetings" id="r2" /><Label htmlFor="r2">For all future meetings</Label></div>
              </RadioGroup>
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild><Button variant="ghost">Cancel</Button></DialogClose>
          <Button variant="destructive" onClick={handleBlockConfirm}>Block</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

