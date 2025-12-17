
'use client';

import React, { useEffect, useState, useRef, useCallback } from "react";
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { UserCircle, Video, Palette, ShieldCheck, Save, Loader2, BookOpen, Users, LogOut, Trash2, Mic, Settings2, Image as ImageIcon, Camera, AlertTriangle, Bell, MessageSquare, Hand, ArrowLeft, History, Brush, Type as TypeIcon, Clapperboard, FileText, ToggleLeft, ToggleRight, Radio, FlipHorizontal } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { updateProfile } from "firebase/auth";
import { auth, messaging, db } from '@/lib/firebase';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { Slider } from "@/components/ui/slider";
import { getToken } from 'firebase/messaging';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';

const SettingsSection = React.forwardRef<
  HTMLDivElement,
  { title: string, description: string, icon: React.ElementType, children: React.ReactNode, id?: string, headerAction?: React.ReactNode }
>(({ title, description, icon: Icon, children, id, headerAction }, ref) => (
    <Card id={id} ref={ref} className="shadow-lg rounded-xl border-border/50 scroll-mt-20">
      <CardHeader className="border-b">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Icon className="h-8 w-8 text-primary" />
            <div>
              <CardTitle className="text-xl">{title}</CardTitle>
              <CardDescription>{description}</CardDescription>
            </div>
          </div>
          {headerAction}
        </div>
      </CardHeader>
      <CardContent className="pt-6 space-y-6">
        {children}
      </CardContent>
    </Card>
));
SettingsSection.displayName = "SettingsSection";

export default function SettingsPage() {
  const { toast } = useToast();
  const { user, loading: authLoading, signOut, deleteUserAccount } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const meetingId = searchParams.get('meetingId');

  // Refs for scrolling to sections
  const advancedMeetingSettingsRef = useRef<HTMLDivElement>(null);
  const whiteboardSettingsRef = useRef<HTMLDivElement>(null);
  const historyAndDataRef = useRef<HTMLDivElement>(null);

  // General Settings
  const [displayName, setDisplayName] = useState<string>('');
  const [isSavingName, setIsSavingName] = useState<boolean>(false);
  const isNameChanged = user?.displayName !== displayName.trim() && displayName.trim() !== '';
  
  // Audio & Video Settings
  const videoPreviewRef = useRef<HTMLVideoElement>(null);
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [audioInDevices, setAudioInDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedVideoDevice, setSelectedVideoDevice] = useState<string>('');
  const [selectedAudioInDevice, setSelectedAudioInDevice] = useState<string>('');
  const [hasAVPermissions, setHasAVPermissions] = useState<boolean | null>(null);

  // Advanced Meeting Settings (now merged into A/V)
  const [defaultCameraOn, setDefaultCameraOn] = useState(true);
  const [defaultMicOn, setDefaultMicOn] = useState(false);
  const [mirrorCamera, setMirrorCamera] = useState(false);
  const [appliedFilter, setAppliedFilter] = useState<string>('none');
  const [isFilterToggleOn, setIsFilterToggleOn] = useState(false);

  // Whiteboard Settings
  const [whiteboardBgColor, setWhiteboardBgColor] = useState('#FFFFFF');
  const [whiteboardDrawColor, setWhiteboardDrawColor] = useState('#000000');
  const [whiteboardLineWidth, setWhiteboardLineWidth] = useState(5);
  const [whiteboardFontSize, setWhiteboardFontSize] = useState(16);
  const [whiteboardFontFamily, setWhiteboardFontFamily] = useState('sans-serif');
  
  // Recording Settings
  const [recordingQuality, setRecordingQuality] = useState('1080p');
  const [defaultRecordingPublic, setDefaultRecordingPublic] = useState(false);
  const [autoRecordMeetings, setAutoRecordMeetings] = useState(false);
  
  // Document Settings
  const [defaultDocumentPublic, setDefaultDocumentPublic] = useState(false);

  // Notification Settings
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission | 'unsupported'>('default');
  const [isEnablingNotifications, setIsEnablingNotifications] = useState(false);
  const [meetingReminders, setMeetingReminders] = useState(true);
  const [chatMentions, setChatMentions] = useState(true);
  const [handRaiseAlerts, setHandRaiseAlerts] = useState(true);

  // Highlight effect
  useEffect(() => {
    const highlight = searchParams.get('highlight');
    let targetRef: React.RefObject<HTMLDivElement> | null = null;
    if (highlight === 'advancedMeetingSettings') targetRef = advancedMeetingSettingsRef;
    if (highlight === 'whiteboardSettings') targetRef = whiteboardSettingsRef;
    if (highlight === 'historyAndData') targetRef = historyAndDataRef;
    
    if (targetRef && targetRef.current) {
        targetRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
        targetRef.current.classList.add('highlight-blink');
        setTimeout(() => targetRef!.current?.classList.remove('highlight-blink'), 2000);
    }
  }, [searchParams]);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setNotificationPermission(Notification.permission);
    } else {
      setNotificationPermission('unsupported');
    }
  }, []);
  
  // Populate state from user profile and localStorage
  useEffect(() => {
    if (user && !authLoading) {
      setDisplayName(user.displayName || '');
    }
    // A/V
    setDefaultCameraOn(localStorage.getItem('teachmeet-camera-default') !== 'off');
    setDefaultMicOn(localStorage.getItem('teachmeet-mic-default') === 'on');
    setMirrorCamera(localStorage.getItem('teachmeet-camera-mirror') === 'true');
    const filter = localStorage.getItem('teachmeet-camera-filter') || 'none';
    setAppliedFilter(filter);
    setIsFilterToggleOn(filter !== 'none' && localStorage.getItem('teachmeet-filter-toggle') === 'on');
    setSelectedVideoDevice(localStorage.getItem('teachmeet-video-device') || 'default');
    setSelectedAudioInDevice(localStorage.getItem('teachmeet-audioin-device') || 'default');
    
    // Whiteboard
    setWhiteboardBgColor(localStorage.getItem('teachmeet-whiteboard-bg-color') || '#FFFFFF');
    setWhiteboardDrawColor(localStorage.getItem('teachmeet-whiteboard-color') || '#000000');
    setWhiteboardLineWidth(parseInt(localStorage.getItem('teachmeet-whiteboard-linewidth') || '5', 10));
    setWhiteboardFontSize(parseInt(localStorage.getItem('teachmeet-whiteboard-fontsize') || '16', 10));
    setWhiteboardFontFamily(localStorage.getItem('teachmeet-whiteboard-fontfamily') || 'sans-serif');
    
    // Recordings
    setRecordingQuality(localStorage.getItem('teachmeet-recording-quality') || '1080p');
    setDefaultRecordingPublic(localStorage.getItem('teachmeet-recording-default-public') === 'true');
    setAutoRecordMeetings(localStorage.getItem('teachmeet-recording-auto') === 'true');

    // Documents
    setDefaultDocumentPublic(localStorage.getItem('teachmeet-document-default-public') === 'true');

    // Notifications
    setMeetingReminders(localStorage.getItem('teachmeet-notif-reminders') !== 'off');
    setChatMentions(localStorage.getItem('teachmeet-notif-mentions') !== 'off');
    setHandRaiseAlerts(localStorage.getItem('teachmeet-notif-handraise') !== 'off');
  }, [user, authLoading]);

  // Get A/V devices and permissions
  const getDevices = useCallback(async () => {
    try {
      await navigator.mediaDevices.getUserMedia({ video: true, audio: true }); // Request permissions
      const devices = await navigator.mediaDevices.enumerateDevices();
      setVideoDevices(devices.filter(d => d.kind === 'videoinput'));
      setAudioInDevices(devices.filter(d => d.kind === 'audioinput'));
      setHasAVPermissions(true);
    } catch (err) {
      console.error("Error getting A/V devices:", err);
      setHasAVPermissions(false);
    }
  }, []);

  useEffect(() => {
    getDevices();
  }, [getDevices]);

  // Update video preview stream
  useEffect(() => {
    let stream: MediaStream;
    async function setupStream() {
        if (hasAVPermissions && videoPreviewRef.current) {
            try {
                const constraints = {
                    video: selectedVideoDevice === 'default' ? true : { deviceId: { exact: selectedVideoDevice } },
                    audio: false
                };
                stream = await navigator.mediaDevices.getUserMedia(constraints);
                videoPreviewRef.current.srcObject = stream;
            } catch (error) {
                console.error("Failed to set video stream for preview:", error);
                toast({ variant: 'destructive', title: 'Video Preview Error', description: 'Could not switch to the selected camera.' });
            }
        }
    }
    setupStream();
    return () => {
        stream?.getTracks().forEach(track => track.stop());
    };
  }, [selectedVideoDevice, hasAVPermissions, toast]);

  const handleSaveGeneral = async () => {
    if (!auth.currentUser || !isNameChanged) return;
    setIsSavingName(true);
    try {
      await updateProfile(auth.currentUser, { displayName });
      toast({ title: "Success", description: "Your display name has been updated." });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Update Failed", description: error.message });
    } finally {
      setIsSavingName(false);
    }
  };

  const handleSaveAV = () => {
    localStorage.setItem('teachmeet-video-device', selectedVideoDevice);
    localStorage.setItem('teachmeet-audioin-device', selectedAudioInDevice);
    localStorage.setItem('teachmeet-camera-default', defaultCameraOn ? 'on' : 'off');
    localStorage.setItem('teachmeet-mic-default', defaultMicOn ? 'on' : 'off');
    localStorage.setItem('teachmeet-camera-mirror', mirrorCamera ? 'true' : 'false');
    localStorage.setItem('teachmeet-camera-filter', appliedFilter);
    localStorage.setItem('teachmeet-filter-toggle', isFilterToggleOn ? 'on' : 'off');
    toast({ title: "Audio & Video Settings Saved", description: "Your camera and microphone preferences have been updated." });
  };
  
  const handleSaveWhiteboard = () => {
    localStorage.setItem('teachmeet-whiteboard-bg-color', whiteboardBgColor);
    localStorage.setItem('teachmeet-whiteboard-color', whiteboardDrawColor);
    localStorage.setItem('teachmeet-whiteboard-linewidth', String(whiteboardLineWidth));
    localStorage.setItem('teachmeet-whiteboard-fontsize', String(whiteboardFontSize));
    localStorage.setItem('teachmeet-whiteboard-fontfamily', whiteboardFontFamily);
    toast({ title: "Whiteboard Settings Saved", description: "Your whiteboard preferences have been updated." });
  };
  
  const handleSaveRecordings = () => {
    localStorage.setItem('teachmeet-recording-quality', recordingQuality);
    localStorage.setItem('teachmeet-recording-default-public', String(defaultRecordingPublic));
    localStorage.setItem('teachmeet-recording-auto', String(autoRecordMeetings));
    toast({ title: "Recording Settings Saved", description: "Your recording preferences have been updated." });
  };
  
  const handleSaveDocuments = () => {
    localStorage.setItem('teachmeet-document-default-public', String(defaultDocumentPublic));
    toast({ title: "Document Settings Saved", description: "Your document preferences have been updated." });
  };

  const handleEnableNotifications = async () => {
    setIsEnablingNotifications(true);
    if (!messaging || typeof window === 'undefined' || !('serviceWorker' in navigator) || !user) {
        toast({ variant: 'destructive', title: 'Unsupported', description: 'Push notifications are not supported in this browser or you are not logged in.' });
        setNotificationPermission('unsupported');
        setIsEnablingNotifications(false);
        return;
    }

    try {
        const permission = await Notification.requestPermission();
        setNotificationPermission(permission);

        if (permission === 'granted') {
            const swRegistration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
            const fcmToken = await getToken(messaging, { vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY, serviceWorkerRegistration: swRegistration });
            
            if (fcmToken) {
                const tokenRef = doc(db, 'fcmTokens', user.uid);
                await setDoc(tokenRef, { token: fcmToken, userId: user.uid, updatedAt: serverTimestamp() }, { merge: true });
                toast({ title: 'Notifications Enabled', description: 'You will now receive notifications from TeachMeet.' });
            } else {
                 toast({ variant: 'destructive', title: 'Token Error', description: 'Could not retrieve a push notification token.' });
            }
        } else if (permission === 'denied') {
            toast({ variant: 'destructive', title: 'Permission Denied', description: 'You have blocked notifications. To enable them, please update your browser settings.' });
        } else {
            toast({ title: 'Permission Not Granted', description: 'You did not grant permission for notifications.' });
        }
    } catch (error) {
        console.error('Error enabling push notifications:', error);
        toast({ variant: 'destructive', title: 'Error', description: 'An error occurred while enabling notifications.' });
    } finally {
        setIsEnablingNotifications(false);
    }
};

  const handleSaveNotifications = () => {
    localStorage.setItem('teachmeet-notif-reminders', meetingReminders ? 'on' : 'off');
    localStorage.setItem('teachmeet-notif-mentions', chatMentions ? 'on' : 'off');
    localStorage.setItem('teachmeet-notif-handraise', handRaiseAlerts ? 'on' : 'off');
    toast({ title: "Notification Settings Saved", description: "Your notification preferences have been updated." });
  };

  const handleClearHistory = () => {
    toast({
      title: "Clear History (Simulated)",
      description: "In a real application, this would clear your meeting history data.",
    });
  };

  const handleDeleteAccount = async () => {
    if (!user) return;
    try {
      await deleteUserAccount();
      // The signOut method in useAuth will handle redirection
    } catch (error) {
      // The deleteUserAccount function in useAuth already handles toasts for specific errors
      console.error("Error from settings page during account deletion:", error);
    }
  };
  
  const videoClassNames = cn(
    "w-full h-full object-cover rounded-lg bg-muted",
    {
      "video-mirror": mirrorCamera,
      "video-filter-grayscale": isFilterToggleOn && appliedFilter === "grayscale",
      "video-filter-sepia": isFilterToggleOn && appliedFilter === "sepia",
      "video-filter-vintage": isFilterToggleOn && appliedFilter === "vintage",
      "video-filter-luminous": isFilterToggleOn && appliedFilter === "luminous",
      "video-filter-dramatic": isFilterToggleOn && appliedFilter === "dramatic",
      "video-filter-goldenhour": isFilterToggleOn && appliedFilter === "goldenhour",
      "video-filter-softfocus": isFilterToggleOn && appliedFilter === "softfocus",
      "video-filter-brightclear": isFilterToggleOn && appliedFilter === "brightclear",
      "video-filter-naturalglow": isFilterToggleOn && appliedFilter === "naturalglow",
      "video-filter-radiantskin": isFilterToggleOn && appliedFilter === "radiantskin",
      "video-filter-smoothbright": isFilterToggleOn && appliedFilter === "smoothbright",
    }
  );

  return (
    <div className="container mx-auto max-w-3xl py-8 space-y-8">
      <div className="text-center">
        <h1 className="text-4xl font-bold tracking-tight text-foreground">Settings</h1>
        <p className="text-lg text-muted-foreground mt-2">Customize your TeachMeet experience.</p>
      </div>

      <SettingsSection title="General" description="Manage your public profile information." icon={UserCircle}>
        <div className="space-y-2">
            <Label htmlFor="displayName">Display Name</Label>
            <Input id="displayName" value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="rounded-lg" disabled={isSavingName || authLoading} />
        </div>
        <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">Avatar settings are in the user menu.</p>
            <Button onClick={handleSaveGeneral} disabled={!isNameChanged || isSavingName} className="rounded-lg btn-gel">
                {isSavingName ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Save Name
            </Button>
        </div>
      </SettingsSection>

      <SettingsSection
        ref={advancedMeetingSettingsRef}
        id="advancedMeetingSettings"
        title="Audio & Video"
        description="Configure your camera, microphone, and default meeting states."
        icon={Camera}
        headerAction={
            meetingId && (
              <Button asChild variant="outline" size="sm" className="rounded-lg">
                <Link href={`/dashboard/meeting/prejoin?meetingId=${meetingId}`}>
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to Join Room
                </Link>
              </Button>
            )
        }
      >
        {hasAVPermissions === false ? (
          <div className="p-4 bg-destructive/10 text-destructive rounded-lg flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 mt-0.5" />
              <div>
                  <h3 className="font-semibold">Permissions Required</h3>
                  <p className="text-sm">To select devices, please grant camera and microphone permissions in your browser. <Button variant="link" size="sm" className="p-0 h-auto" onClick={getDevices}>Try Again</Button></p>
              </div>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-6 items-start">
              <div className="space-y-4">
                  <div className="space-y-2">
                      <Label htmlFor="video-device">Camera</Label>
                      <Select value={selectedVideoDevice} onValueChange={setSelectedVideoDevice} disabled={!hasAVPermissions}>
                          <SelectTrigger id="video-device" className="rounded-lg"><SelectValue placeholder="Select a camera..." /></SelectTrigger>
                          <SelectContent className="rounded-lg"><SelectItem value="default">Default</SelectItem>{videoDevices.map(d => <SelectItem key={d.deviceId} value={d.deviceId}>{d.label}</SelectItem>)}</SelectContent>
                      </Select>
                  </div>
                  <div className="space-y-2">
                      <Label htmlFor="audio-in-device">Microphone</Label>
                      <Select value={selectedAudioInDevice} onValueChange={setSelectedAudioInDevice} disabled={!hasAVPermissions}>
                          <SelectTrigger id="audio-in-device" className="rounded-lg"><SelectValue placeholder="Select a microphone..." /></SelectTrigger>
                          <SelectContent className="rounded-lg"><SelectItem value="default">Default</SelectItem>{audioInDevices.map(d => <SelectItem key={d.deviceId} value={d.deviceId}>{d.label}</SelectItem>)}</SelectContent>
                      </Select>
                  </div>
              </div>
              <div className="aspect-video bg-muted rounded-lg flex items-center justify-center relative overflow-hidden">
                  <video ref={videoPreviewRef} className={videoClassNames} autoPlay muted playsInline />
              </div>
          </div>
        )}
        
        <div className="space-y-4 pt-6 border-t">
            <div className="flex items-center justify-between p-3 border rounded-lg shadow-sm">
                <Label htmlFor="camera-on" className="flex items-center gap-2"><Video className="h-4 w-4" /> Default camera to ON</Label>
                <Switch id="camera-on" checked={defaultCameraOn} onCheckedChange={setDefaultCameraOn} />
            </div>
            <div className="flex items-center justify-between p-3 border rounded-lg shadow-sm">
                <Label htmlFor="mic-on" className="flex items-center gap-2"><Mic className="h-4 w-4" /> Default microphone to ON</Label>
                <Switch id="mic-on" checked={defaultMicOn} onCheckedChange={setDefaultMicOn} />
            </div>
             <div className="flex items-center justify-between p-3 border rounded-lg shadow-sm">
                <Label htmlFor="mirror-camera" className="flex items-center gap-2"><FlipHorizontal className="h-4 w-4" /> Mirror my video</Label>
                <Switch id="mirror-camera" checked={mirrorCamera} onCheckedChange={setMirrorCamera} />
            </div>
            <div className="flex items-center justify-between p-3 border rounded-lg shadow-sm">
                <Label htmlFor="filter-toggle" className="flex items-center gap-2"><ImageIcon className="h-4 w-4" /> Enable video filter by default</Label>
                <Switch id="filter-toggle" checked={isFilterToggleOn} onCheckedChange={setIsFilterToggleOn} disabled={appliedFilter === 'none'}/>
            </div>
             <div className="space-y-2">
                <Label htmlFor="video-filter">Default Video Filter</Label>
                <Select value={appliedFilter} onValueChange={setAppliedFilter}>
                    <SelectTrigger id="video-filter" className="rounded-lg"><SelectValue placeholder="Select a filter..." /></SelectTrigger>
                    <SelectContent className="rounded-lg">
                        <SelectItem value="none">None</SelectItem>
                        <SelectItem value="brightclear">Bright & Clear</SelectItem>
                        <SelectItem value="naturalglow">Natural Glow</SelectItem>
                        <SelectItem value="radiantskin">Radiant Skin</SelectItem>
                        <SelectItem value="smoothbright">Smooth & Bright</SelectItem>
                        <SelectItem value="vintage">Vintage</SelectItem>
                        <SelectItem value="luminous">Luminous</SelectItem>
                        <SelectItem value="goldenhour">Golden Hour</SelectItem>
                        <SelectItem value="softfocus">Soft Focus</SelectItem>
                        <SelectItem value="grayscale">Grayscale</SelectItem>
                        <SelectItem value="sepia">Sepia</SelectItem>
                        <SelectItem value="dramatic">Dramatic</SelectItem>
                    </SelectContent>
                </Select>
            </div>
        </div>
        <div className="flex justify-end pt-4 border-t">
          <Button onClick={handleSaveAV} className="rounded-lg btn-gel">
            <Save className="mr-2 h-4 w-4" /> Save A/V Settings
          </Button>
        </div>
      </SettingsSection>
      
      <SettingsSection title="Recording Settings" description="Manage your meeting recording preferences." icon={Clapperboard}>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="recording-quality">Default Recording Quality</Label>
            <Select value={recordingQuality} onValueChange={setRecordingQuality}>
              <SelectTrigger id="recording-quality" className="rounded-lg"><SelectValue placeholder="Select quality..." /></SelectTrigger>
              <SelectContent className="rounded-lg">
                <SelectItem value="480p">480p (Standard Definition)</SelectItem>
                <SelectItem value="720p">720p (Standard HD)</SelectItem>
                <SelectItem value="1080p">1080p (Full HD)</SelectItem>
                <SelectItem value="1440p">1440p (2K)</SelectItem>
                <SelectItem value="2160p">2160p (4K UHD)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between p-3 border rounded-lg shadow-sm">
            <Label htmlFor="recording-public" className="flex flex-col gap-1">
              <span>Default Save Destination</span>
              <span className="text-xs text-muted-foreground">Set recordings to public by default.</span>
            </Label>
            <div className="flex items-center gap-2">
              <ToggleLeft className="h-4 w-4 text-muted-foreground"/>
              <Switch id="recording-public" checked={defaultRecordingPublic} onCheckedChange={setDefaultRecordingPublic} />
              <ToggleRight className="h-4 w-4 text-muted-foreground"/>
            </div>
          </div>
          <div className="flex items-center justify-between p-3 border rounded-lg shadow-sm">
            <Label htmlFor="auto-record" className="flex flex-col gap-1">
              <span>Auto-Record Meetings</span>
              <span className="text-xs text-muted-foreground">Automatically start recording when you are the host.</span>
            </Label>
            <Switch id="auto-record" checked={autoRecordMeetings} onCheckedChange={setAutoRecordMeetings} />
          </div>
        </div>
        <div className="flex justify-end pt-4 border-t">
          <Button onClick={handleSaveRecordings} className="rounded-lg btn-gel">
            <Save className="mr-2 h-4 w-4" /> Save Recording Settings
          </Button>
        </div>
      </SettingsSection>

      <SettingsSection title="Document Settings" description="Manage preferences for uploaded documents." icon={FileText}>
        <div className="space-y-4">
            <div className="flex items-center justify-between p-3 border rounded-lg shadow-sm">
            <Label htmlFor="document-public" className="flex flex-col gap-1">
              <span>Default Upload Destination</span>
              <span className="text-xs text-muted-foreground">Set uploaded documents to public by default.</span>
            </Label>
            <div className="flex items-center gap-2">
              <ToggleLeft className="h-4 w-4 text-muted-foreground"/>
              <Switch id="document-public" checked={defaultDocumentPublic} onCheckedChange={setDefaultDocumentPublic} />
              <ToggleRight className="h-4 w-4 text-muted-foreground"/>
            </div>
          </div>
        </div>
        <div className="flex justify-end pt-4 border-t">
          <Button onClick={handleSaveDocuments} className="rounded-lg btn-gel">
            <Save className="mr-2 h-4 w-4" /> Save Document Settings
          </Button>
        </div>
      </SettingsSection>

      <SettingsSection title="Notifications" description="Manage how you receive alerts." icon={Bell}>
         <div className="space-y-4">
            <div className="p-3 border rounded-lg shadow-sm">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                    <Label htmlFor="push-notifications">Push Notifications</Label>
                    <p className="text-xs text-muted-foreground">
                        Status: <span className={cn(
                          "font-medium",
                          notificationPermission === 'granted' && "text-primary",
                          notificationPermission === 'denied' && "text-destructive"
                        )}>{notificationPermission}</span>
                    </p>
                </div>
                {notificationPermission !== 'granted' && (
                    <Button onClick={handleEnableNotifications} disabled={isEnablingNotifications || notificationPermission === 'denied' || notificationPermission === 'unsupported'}>
                        {isEnablingNotifications ? <Loader2 className="h-4 w-4 animate-spin"/> : "Enable"}
                    </Button>
                )}
              </div>
              {notificationPermission === 'denied' && <p className="text-xs text-destructive mt-2">You have blocked notifications. Please enable them in your browser settings.</p>}
              {notificationPermission === 'unsupported' && <p className="text-xs text-destructive mt-2">Push notifications are not supported by your browser.</p>}
            </div>
            <div className="flex items-center justify-between p-3 border rounded-lg shadow-sm">
                <Label htmlFor="meeting-reminders" className="flex items-center gap-2"><Video className="h-4 w-4" /> Meeting Reminders</Label>
                <Switch id="meeting-reminders" checked={meetingReminders} onCheckedChange={setMeetingReminders} />
            </div>
            <div className="flex items-center justify-between p-3 border rounded-lg shadow-sm">
                <Label htmlFor="chat-mentions" className="flex items-center gap-2"><MessageSquare className="h-4 w-4" /> Chat Mentions</Label>
                <Switch id="chat-mentions" checked={chatMentions} onCheckedChange={setChatMentions} />
            </div>
            <div className="flex items-center justify-between p-3 border rounded-lg shadow-sm">
                <Label htmlFor="hand-raise-alerts" className="flex items-center gap-2"><Hand className="h-4 w-4" /> Hand Raise Alerts</Label>
                <Switch id="hand-raise-alerts" checked={handRaiseAlerts} onCheckedChange={setHandRaiseAlerts} />
            </div>
        </div>
        <div className="flex justify-end pt-4 border-t">
          <Button onClick={handleSaveNotifications} className="rounded-lg btn-gel">
            <Save className="mr-2 h-4 w-4" /> Save Notifications
          </Button>
        </div>
      </SettingsSection>
      
      <SettingsSection
        ref={whiteboardSettingsRef}
        id="whiteboardSettings"
        title="Whiteboard"
        description="Personalize your collaborative canvas."
        icon={Palette}
        headerAction={
          meetingId && (
            <Button asChild variant="outline" size="sm" className="rounded-lg">
              <Link href={`/dashboard/meeting/${meetingId}/whiteboard`}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Whiteboard
              </Link>
            </Button>
          )
        }
      >
        <div className="space-y-4">
             <div className="space-y-2">
                <Label htmlFor="whiteboard-bg">Background Color</Label>
                <Input id="whiteboard-bg" type="color" value={whiteboardBgColor} onChange={(e) => setWhiteboardBgColor(e.target.value)} className="w-full h-10 rounded-lg" />
            </div>
            <div className="p-4 border rounded-lg">
              <h4 className="font-medium text-foreground mb-3 flex items-center gap-2"><Brush className="h-5 w-5"/> Drawing Tools</h4>
              <div className="space-y-4">
                <div className="space-y-2">
                      <Label htmlFor="whiteboard-draw-color">Default Drawing Color</Label>
                      <Input id="whiteboard-draw-color" type="color" value={whiteboardDrawColor} onChange={(e) => setWhiteboardDrawColor(e.target.value)} className="w-full h-10 rounded-lg" />
                  </div>
                  <div className="space-y-2">
                      <Label htmlFor="whiteboard-linewidth">Default Line Width</Label>
                      <div className="flex items-center gap-2">
                          <Slider
                              id="whiteboard-linewidth"
                              value={[whiteboardLineWidth]}
                              onValueChange={(value) => setWhiteboardLineWidth(value[0])}
                              min={1} max={50} step={1}
                          />
                          <span className="text-sm font-mono w-8 text-center">{whiteboardLineWidth}</span>
                      </div>
                  </div>
              </div>
            </div>

            <div className="p-4 border rounded-lg">
              <h4 className="font-medium text-foreground mb-3 flex items-center gap-2"><TypeIcon className="h-5 w-5"/> Text Tool</h4>
              <div className="space-y-4">
                  <div className="space-y-2">
                      <Label htmlFor="whiteboard-fontfamily">Default Font</Label>
                      <Select value={whiteboardFontFamily} onValueChange={setWhiteboardFontFamily}>
                          <SelectTrigger id="whiteboard-fontfamily" className="rounded-lg">
                              <SelectValue placeholder="Select a font..." />
                          </SelectTrigger>
                          <SelectContent className="rounded-lg">
                              <SelectItem value="sans-serif">Sans-Serif (Default)</SelectItem>
                              <SelectItem value="serif">Serif</SelectItem>
                              <SelectItem value="monospace">Monospace</SelectItem>
                              <SelectItem value="cursive">Cursive</SelectItem>
                              <SelectItem value="fantasy">Fantasy</SelectItem>
                              <SelectItem value="Arial">Arial</SelectItem>
                              <SelectItem value="Georgia">Georgia</SelectItem>
                          </SelectContent>
                      </Select>
                  </div>
                  <div className="space-y-2">
                      <Label htmlFor="whiteboard-fontsize">Default Font Size</Label>
                      <div className="flex items-center gap-2">
                          <Slider
                              id="whiteboard-fontsize"
                              value={[whiteboardFontSize]}
                              onValueChange={(value) => setWhiteboardFontSize(value[0])}
                              min={8} max={128} step={1}
                          />
                          <span className="text-sm font-mono w-10 text-center">{whiteboardFontSize}px</span>
                      </div>
                  </div>
              </div>
            </div>
        </div>
        <div className="flex justify-end items-center pt-4 border-t gap-2">
          <Button onClick={handleSaveWhiteboard} className="rounded-lg btn-gel">
            <Save className="mr-2 h-4 w-4" /> Save Whiteboard Settings
          </Button>
        </div>
      </SettingsSection>

      <SettingsSection ref={historyAndDataRef} id="historyAndData" title="History & Data" description="Manage your generated content and history." icon={History}>
        <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Quickly access your documents and recordings from the main sidebar under "Library".</p>
             <AlertDialog>
                <AlertDialogTrigger asChild>
                    <Button variant="destructive" className="w-full justify-start text-left p-3 rounded-lg"><Trash2 className="mr-2 h-4 w-4" /> Clear All Meeting History</Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                    <AlertDialogHeader><AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle><AlertDialogDescription>This action will clear your list of ongoing and recent meetings. This cannot be undone.</AlertDialogDescription></AlertDialogHeader>
                    <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={handleClearHistory}>Clear History</AlertDialogAction></AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
      </SettingsSection>

      <SettingsSection title="Account & Security" description="Manage your account and view our policies." icon={ShieldCheck}>
        <div className="space-y-4">
            <Button asChild variant="outline" className="w-full justify-start text-left p-3 rounded-lg"><Link href="/community-guidelines" target="_blank"><Users className="mr-2 h-4 w-4" /> Community Guidelines</Link></Button>
            <Button asChild variant="outline" className="w-full justify-start text-left p-3 rounded-lg"><Link href="/terms-of-service" target="_blank"><BookOpen className="mr-2 h-4 w-4" /> Terms of Service</Link></Button>
            <Button asChild variant="outline" className="w-full justify-start text-left p-3 rounded-lg"><Link href="/privacy-policy" target="_blank"><ShieldCheck className="mr-2 h-4 w-4" /> Privacy Policy</Link></Button>
        </div>
        <div className="flex flex-col sm:flex-row justify-end gap-2 pt-4 border-t">
            <AlertDialog>
                <AlertDialogTrigger asChild><Button variant="destructive" className="w-full sm:w-auto rounded-lg"><LogOut className="mr-2 h-4 w-4" /> Sign Out</Button></AlertDialogTrigger>
                <AlertDialogContent>
                    <AlertDialogHeader><AlertDialogTitle>Are you sure you want to sign out?</AlertDialogTitle><AlertDialogDescription>You will be logged out of your TeachMeet account.</AlertDialogDescription></AlertDialogHeader>
                    <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={signOut}>Sign Out</AlertDialogAction></AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
            <AlertDialog>
                <AlertDialogTrigger asChild><Button variant="destructive" className="w-full sm:w-auto rounded-lg"><Trash2 className="mr-2 h-4 w-4" /> Delete Account</Button></AlertDialogTrigger>
                <AlertDialogContent>
                    <AlertDialogHeader><AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle><AlertDialogDescription>This action cannot be undone. This will permanently delete your account and remove your data from our servers. This requires you to sign in again for security.</AlertDialogDescription></AlertDialogHeader>
                    <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={handleDeleteAccount}>Delete Account</AlertDialogAction></AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
      </SettingsSection>
    </div>
  );
}
