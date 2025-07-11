
'use client';

import React, { useEffect, useState, useRef } from "react";
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { UserCircle, Video, Palette, ShieldCheck, Save, Loader2, BookOpen, Users, LogOut, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { updateProfile } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

const SettingsSection = React.forwardRef<
  HTMLDivElement,
  { title: string, description: string, icon: React.ElementType, children: React.ReactNode, id?: string }
>(({ title, description, icon: Icon, children, id }, ref) => (
    <Card id={id} ref={ref} className="shadow-lg rounded-xl border-border/50">
      <CardHeader className="border-b">
        <div className="flex items-center gap-4">
          <Icon className="h-8 w-8 text-primary" />
          <div>
            <CardTitle className="text-xl">{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-6 space-y-6">
        {children}
      </CardContent>
    </Card>
));
SettingsSection.displayName = "SettingsSection";

export default function SettingsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { user, loading: authLoading, signOut } = useAuth();

  // State for General Settings
  const [displayName, setDisplayName] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const isNameChanged = user?.displayName !== displayName.trim() && displayName.trim() !== '';
  
  // State for Meeting Experience Settings
  const [defaultCameraOn, setDefaultCameraOn] = useState(true);
  const [defaultMicOn, setDefaultMicOn] = useState(false);

  // State for Whiteboard Settings
  const [whiteboardBgColor, setWhiteboardBgColor] = useState('#FFFFFF');

  // Populate state from localStorage and user profile on mount
  useEffect(() => {
    if (user && !authLoading) {
      setDisplayName(user.displayName || '');
    }
    setDefaultCameraOn(localStorage.getItem('teachmeet-camera-default') !== 'off');
    setDefaultMicOn(localStorage.getItem('teachmeet-mic-default') === 'on');
    setWhiteboardBgColor(localStorage.getItem('teachmeet-whiteboard-bg-color') || '#FFFFFF');
  }, [user, authLoading]);

  // Handler for saving general settings (display name)
  const handleSaveGeneral = async () => {
    if (!auth.currentUser || !isNameChanged) return;
    setIsSaving(true);
    try {
      await updateProfile(auth.currentUser, { displayName });
      toast({ title: "Success", description: "Your display name has been updated." });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Update Failed", description: error.message });
    } finally {
      setIsSaving(false);
    }
  };

  // Handler for saving meeting experience settings
  const handleSaveMeetingExperience = () => {
    localStorage.setItem('teachmeet-camera-default', defaultCameraOn ? 'on' : 'off');
    localStorage.setItem('teachmeet-mic-default', defaultMicOn ? 'on' : 'off');
    toast({ title: "Settings Saved", description: "Your meeting preferences have been updated." });
  };
  
  // Handler for saving whiteboard settings
  const handleSaveWhiteboard = () => {
    localStorage.setItem('teachmeet-whiteboard-bg-color', whiteboardBgColor);
    toast({ title: "Settings Saved", description: "Your whiteboard preferences have been updated." });
  };

  return (
    <div className="container mx-auto max-w-3xl py-8 space-y-8">
      <div className="text-center">
        <h1 className="text-4xl font-bold tracking-tight text-foreground">Settings</h1>
        <p className="text-lg text-muted-foreground mt-2">Customize your TeachMeet experience.</p>
      </div>

      <SettingsSection title="General" description="Manage your public profile information." icon={UserCircle}>
        <div className="space-y-2">
            <Label htmlFor="displayName">Display Name</Label>
            <Input id="displayName" value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="rounded-lg" disabled={isSaving || authLoading} />
        </div>
        <div className="flex justify-end">
            <Button onClick={handleSaveGeneral} disabled={!isNameChanged || isSaving} className="rounded-lg btn-gel">
                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Save Name
            </Button>
        </div>
      </SettingsSection>

      <SettingsSection title="Meeting Experience" description="Set your default camera and microphone state." icon={Video}>
        <div className="space-y-4">
            <div className="flex items-center justify-between p-3 border rounded-lg shadow-sm">
                <Label htmlFor="camera-on">Default camera to ON</Label>
                <Switch id="camera-on" checked={defaultCameraOn} onCheckedChange={setDefaultCameraOn} />
            </div>
            <div className="flex items-center justify-between p-3 border rounded-lg shadow-sm">
                <Label htmlFor="mic-on">Default microphone to ON</Label>
                <Switch id="mic-on" checked={defaultMicOn} onCheckedChange={setDefaultMicOn} />
            </div>
        </div>
        <div className="flex justify-end">
          <Button onClick={handleSaveMeetingExperience} className="rounded-lg btn-gel">
            <Save className="mr-2 h-4 w-4" /> Save Meeting Settings
          </Button>
        </div>
      </SettingsSection>

      <SettingsSection title="Whiteboard" description="Personalize your collaborative canvas." icon={Palette}>
        <div className="space-y-2">
          <Label htmlFor="whiteboard-bg">Background Color</Label>
          <Input id="whiteboard-bg" type="color" value={whiteboardBgColor} onChange={(e) => setWhiteboardBgColor(e.target.value)} className="w-full h-10 rounded-lg" />
        </div>
        <div className="flex justify-end">
          <Button onClick={handleSaveWhiteboard} className="rounded-lg btn-gel">
            <Save className="mr-2 h-4 w-4" /> Save Whiteboard Settings
          </Button>
        </div>
      </SettingsSection>

      <SettingsSection title="Privacy & Security" description="Manage your account and view our policies." icon={ShieldCheck}>
        <div className="space-y-4">
            <Button asChild variant="outline" className="w-full justify-start text-left p-3 rounded-lg">
                <Link href="/community-guidelines" target="_blank"><Users className="mr-2 h-4 w-4" /> Community Guidelines</Link>
            </Button>
            <Button asChild variant="outline" className="w-full justify-start text-left p-3 rounded-lg">
                <Link href="/terms-of-service" target="_blank"><BookOpen className="mr-2 h-4 w-4" /> Terms of Service</Link>
            </Button>
            <Button asChild variant="outline" className="w-full justify-start text-left p-3 rounded-lg">
                <Link href="/privacy-policy" target="_blank"><ShieldCheck className="mr-2 h-4 w-4" /> Privacy Policy</Link>
            </Button>
        </div>
        <div className="flex flex-col sm:flex-row justify-end gap-2 pt-4 border-t">
            <AlertDialog>
                <AlertDialogTrigger asChild>
                    <Button variant="destructive" className="w-full sm:w-auto rounded-lg">
                        <LogOut className="mr-2 h-4 w-4" /> Sign Out
                    </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure you want to sign out?</AlertDialogTitle>
                        <AlertDialogDescription>You will be logged out of your TeachMeet account.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => signOut()}>Sign Out</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
            <AlertDialog>
                <AlertDialogTrigger asChild>
                    <Button variant="destructive" className="w-full sm:w-auto rounded-lg">
                        <Trash2 className="mr-2 h-4 w-4" /> Delete Account
                    </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This action cannot be undone. This will permanently delete your account and remove your data from our servers.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => toast({variant: 'destructive', title: "Feature Inactive", description: "Account deletion is not yet implemented."})}>
                            Delete Account
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
      </SettingsSection>
    </div>
  );
}
