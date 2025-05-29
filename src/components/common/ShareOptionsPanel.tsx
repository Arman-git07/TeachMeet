
'use client';

import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter, SheetClose } from '@/components/ui/sheet';
import { useToast } from '@/hooks/use-toast';
import { Copy, Facebook, Instagram, Mail, MessageCircle, MoreHorizontal, Twitter, X } from 'lucide-react';
import React from 'react';

interface ShareOptionsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  meetingLink: string;
  meetingCode?: string; // Made meetingCode optional
  meetingTitle: string;
}

const ShareButton = ({ icon: Icon, label, onClick, className }: { icon: React.ElementType, label: string, onClick: () => void, className?: string }) => (
  <Button
    variant="outline"
    className={`flex flex-col items-center justify-center h-24 w-24 p-2 rounded-lg shadow-sm hover:shadow-md transition-shadow ${className}`}
    onClick={onClick}
  >
    <Icon className="h-8 w-8 mb-1" />
    <span className="text-xs text-center">{label}</span>
  </Button>
);

export function ShareOptionsPanel({ isOpen, onClose, meetingLink, meetingCode, meetingTitle }: ShareOptionsPanelProps) {
  const { toast } = useToast();
  
  const inviteDetails = meetingCode 
    ? `Link: ${meetingLink}\nOr use Code: ${meetingCode}`
    : `Link: ${meetingLink}`;
  
  const fullTextToShare = `You're invited to join my TeachMeet meeting: ${meetingTitle}.\n${inviteDetails}`;


  const copyToClipboard = () => {
    navigator.clipboard.writeText(fullTextToShare)
      .then(() => {
        toast({ title: "Invite Copied!", description: "Meeting invite details copied to clipboard." });
        onClose();
      })
      .catch(err => {
        console.error('Failed to copy invite: ', err);
        toast({ variant: "destructive", title: "Copy Failed", description: "Could not copy the meeting invite." });
      });
  };

  const openShareLink = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer');
    onClose();
  };

  const shareOptions = [
    {
      label: 'WhatsApp',
      icon: MessageCircle,
      onClick: () => openShareLink(`https://wa.me/?text=${encodeURIComponent(fullTextToShare)}`),
      color: 'text-green-500 hover:bg-green-500/10',
    },
    {
      label: 'Twitter',
      icon: Twitter,
      onClick: () => openShareLink(`https://twitter.com/intent/tweet?text=${encodeURIComponent(fullTextToShare)}`),
      color: 'text-sky-500 hover:bg-sky-500/10',
    },
    {
      label: 'Facebook',
      icon: Facebook,
      onClick: () => openShareLink(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(meetingLink)}&quote=${encodeURIComponent(fullTextToShare)}`),
      color: 'text-blue-600 hover:bg-blue-600/10',
    },
    {
      label: 'Instagram',
      icon: Instagram,
      onClick: () => {
        toast({ title: "Share to Instagram", description: "Please share manually via the Instagram app. Invite details copied for convenience." });
        copyToClipboard(); // Instagram sharing via web link is limited
      },
       color: 'text-pink-500 hover:bg-pink-500/10',
    },
    {
      label: 'Gmail',
      icon: Mail,
      onClick: () => openShareLink(`mailto:?subject=${encodeURIComponent("TeachMeet Invitation: " + meetingTitle)}&body=${encodeURIComponent(fullTextToShare)}`),
      color: 'text-red-500 hover:bg-red-500/10',
    },
    {
      label: 'Copy Invite',
      icon: Copy,
      onClick: copyToClipboard,
      color: 'text-muted-foreground hover:bg-muted/20',
    },
  ];

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="bottom" className="rounded-t-2xl p-0">
        <SheetHeader className="p-6 pb-4 border-b">
          <SheetTitle className="text-xl">Share Meeting Invite</SheetTitle>
          <SheetDescription>
            Choose an option below to share your meeting invite.
          </SheetDescription>
        </SheetHeader>
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-4 p-6">
          {shareOptions.map((option) => (
            <ShareButton
              key={option.label}
              icon={option.icon}
              label={option.label}
              onClick={option.onClick}
              className={option.color}
            />
          ))}
           <ShareButton
              icon={MoreHorizontal}
              label="More Options"
              onClick={() => {
                if (navigator.share) {
                  navigator.share({
                    title: `TeachMeet Invitation: ${meetingTitle}`,
                    text: fullTextToShare,
                    url: meetingLink, // Main URL for sharing
                  }).then(() => onClose()).catch(console.error);
                } else {
                  toast({ title: "More Options", description: "Native sharing not supported. Try copying the invite." });
                }
              }}
              className="text-muted-foreground hover:bg-muted/20"
            />
        </div>
        <SheetFooter className="p-6 border-t">
          <SheetClose asChild>
            <Button variant="outline" className="w-full rounded-lg">Cancel</Button>
          </SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
