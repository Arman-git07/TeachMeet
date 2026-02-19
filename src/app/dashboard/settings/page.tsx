'use client';

import React, { useEffect, useState, useRef, useCallback } from "react";
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { 
  UserCircle, 
  Video, 
  Palette, 
  ShieldCheck, 
  Save, 
  Loader2, 
  Trash2, 
  Mic, 
  Image as ImageIcon, 
  Camera, 
  AlertTriangle, 
  Bell, 
  MessageSquare, 
  Hand, 
  ArrowLeft, 
  History, 
  Brush, 
  Type as TypeIcon, 
  Clapperboard, 
  FileText, 
  ToggleLeft, 
  ToggleRight, 
  FlipHorizontal, 
  MapPin, 
  Locate,
  BookOpen,
  Users,
  LogOut
} from "lucide-react";
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
import { doc, setDoc, serverTimestamp, getDoc } from 'firebase/firestore';

const SettingsSection = React.forwardRef<
  HTMLDivElement,
  { title: string, description: string, icon: React.ElementType, children: React.ReactNode, id?: string, headerAction?: React.ReactNode }
>(({ title, description, icon: Icon, children, id, headerAction }, ref) => (
    <Card id={id} ref={ref} className="shadow-lg rounded-2xl border-border/50 scroll-mt-20 overflow-hidden">
      <CardHeader className="border-b bg-muted/10">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
                <Icon className="h-6 w-6" />
            </div>
            <div>
              <CardTitle className="text-xl font-bold">{title}</CardTitle>
              <CardDescription className="text-xs font-medium">{description}</CardDescription>
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
  const profileRef = useRef<HTMLDivElement>(null);
  const avRef = useRef<HTMLDivElement>(null);
  const recordingRef = useRef<HTMLDivElement>(null);
  const whiteboardRef = useRef<HTMLDivElement>(null);
  const dataRef = useRef<HTMLDivElement>(null);

  // General Settings
  const [displayName, setDisplayName] = useState<string>('');
  const [location, setLocation] = useState<string>('');
  const [isLocating, setIsLocating] = useState(false);
  const [isSavingGeneral, setIsSavingGeneral] = useState<boolean>(false);
  
  // Audio & Video Settings
  const videoPreviewRef = useRef<HTMLVideoElement>(null);
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [audioInDevices, setAudioInDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedVideoDevice, setSelectedVideoDevice] = useState<string>('');
  const [selectedAudioInDevice, setSelectedAudioInDevice] = useState<string>('');
  const [hasAVPermissions, setHasAVPermissions] = useState<boolean | null>(null);

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
    if (highlight === 'profile') targetRef = profileRef;
    if (highlight === 'advancedMeetingSettings') targetRef = avRef;
    if (highlight === 'whiteboardSettings') targetRef = whiteboardRef;
    if (highlight === 'historyAndData') targetRef = dataRef;
    
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
  
  // Load preferences
  useEffect(() => {
    if (user && !authLoading) {
      setDisplayName(user.displayName || '');
      const fetchUserData = async () => {
        try {
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (userDoc.exists()) {
            setLocation(userDoc.data().location || '');
          }
        } catch (e) { console.warn("Could not fetch user profile details:", e); }
      };
      fetchUserData();
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

  // A/V Device detection
  const getDevices = useCallback(async () => {
    try {
      await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      const devices = await navigator.mediaDevices.enumerateDevices();
      setVideoDevices(devices.filter(d => d.kind === 'videoinput'));
      setAudioInDevices(devices.filter(d => d.kind === 'audioinput'));
      setHasAVPermissions(true);
    } catch (err) {
      console.error("Error getting A/V devices:", err);
      setHasAVPermissions(false);
    }
  }, []);

  useEffect(() => { getDevices(); }, [getDevices]);

  // Preview video stream
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
                console.error("Video Preview Error:", error);
            }
        }
    }
    setupStream();
    return () => { stream?.getTracks().forEach(track => track.stop()); };
  }, [selectedVideoDevice, hasAVPermissions]);

  const handleGetLocation = () => {
    if (!("geolocation" in navigator)) {
      toast({ variant: "destructive", title: "Unsupported", description: "Geolocation is not supported by your browser." });
      return;
    }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        try {
          const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`);
          const data = await response.json();
          const city = data.address.city || data.address.town || data.address.village || data.address.state || 'Unknown City';
          const country = data.address.country || 'Unknown Country';
          setLocation(`${city}, ${country}`);
          toast({ title: "Location Detected", description: `You are in ${city}, ${country}.` });
        } catch (error) {
          setLocation(`${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
          toast({ title: "Coordinates Saved", description: "City name could not be resolved, saved raw coordinates." });
        } finally { setIsLocating(false); }
      },
      (error) => {
        toast({ variant: "destructive", title: "Access Denied", description: "Please enable location permissions in your browser." });
        setIsLocating(false);
      }
    );
  };

  const handleSaveGeneral = async () => {
    if (!auth.currentUser) return;
    if (!location.trim()) {
        toast({ variant: "destructive", title: "Location Required", description: "Please provide your location for classroom security." });
        return;
    }
    setIsSavingGeneral(true);
    try {
      if (user?.displayName !== displayName.trim() && displayName.trim() !== '') {
        await updateProfile(auth.currentUser, { displayName });
      }
      await setDoc(doc(db, 'users', auth.currentUser.uid), {
          name: displayName,
          location: location.trim(),
          updatedAt: serverTimestamp(),
      }, { merge: true });
      toast({ title: "Profile Updated" });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Update Failed", description: error.message });
    } finally { setIsSavingGeneral(false); }
  };

  const handleSaveAV = () => {
    localStorage.setItem('teachmeet-video-device', selectedVideoDevice);
    localStorage.setItem('teachmeet-audioin-device', selectedAudioInDevice);
    localStorage.setItem('teachmeet-camera-default', defaultCameraOn ? 'on' : 'off');
    localStorage.setItem('teachmeet-mic-default', defaultMicOn ? 'on' : 'off');
    localStorage.setItem('teachmeet-camera-mirror', mirrorCamera ? 'true' : 'false');
    localStorage.setItem('teachmeet-camera-filter', appliedFilter);
    localStorage.setItem('teachmeet-filter-toggle', isFilterToggleOn ? 'on' : 'off');
    toast({ title: "Media Preferences Saved" });
  };
  
  const handleSaveWhiteboard = () => {
    localStorage.setItem('teachmeet-whiteboard-bg-color', whiteboardBgColor);
    localStorage.setItem('teachmeet-whiteboard-color', whiteboardDrawColor);
    localStorage.setItem('teachmeet-whiteboard-linewidth', String(whiteboardLineWidth));
    localStorage.setItem('teachmeet-whiteboard-fontsize', String(whiteboardFontSize));
    localStorage.setItem('teachmeet-whiteboard-fontfamily', whiteboardFontFamily);
    toast({ title: "Whiteboard Defaults Updated" });
  };
  
  const handleSaveRecordings = () => {
    localStorage.setItem('teachmeet-recording-quality', recordingQuality);
    localStorage.setItem('teachmeet-recording-default-public', String(defaultRecordingPublic));
    localStorage.setItem('teachmeet-recording-auto', String(autoRecordMeetings));
    toast({ title: "Recording Settings Updated" });
  };
  
  const handleSaveDocuments = () => {
    localStorage.setItem('teachmeet-document-default-public', String(defaultDocumentPublic));
    toast({ title: "Library Preferences Saved" });
  };

  const handleEnableNotifications = async () => {
    setIsEnablingNotifications(true);
    if (!messaging || typeof window === 'undefined' || !('serviceWorker' in navigator) || !user) {
        toast({ variant: 'destructive', title: 'Unsupported', description: 'Browser notifications are not supported here.' });
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
                await setDoc(doc(db, 'fcmTokens', user.uid), { token: fcmToken, userId: user.uid, updatedAt: serverTimestamp() }, { merge: true });
                toast({ title: 'Notifications Activated!' });
            }
        }
    } catch (error) { toast({ variant: 'destructive', title: 'Error', description: 'Could not activate push notifications.' }); }
    finally { setIsEnablingNotifications(false); }
  };

  const handleSaveNotifications = () => {
    localStorage.setItem('teachmeet-notif-reminders', meetingReminders ? 'on' : 'off');
    localStorage.setItem('teachmeet-notif-mentions', chatMentions ? 'on' : 'off');
    localStorage.setItem('teachmeet-notif-handraise', handRaiseAlerts ? 'on' : 'off');
    toast({ title: "Alert Preferences Saved" });
  };

  const handleClearHistory = () => {
    toast({ title: "History Cleared", description: "Your local meeting history has been purged." });
  };

  const handleDeleteAccount = async () => {
    if (!user) return;
    try { await deleteUserAccount(); } catch (error) { console.error("Account deletion failed:", error); }
  };
  
  const videoClassNames = cn(
    "w-full h-full object-cover rounded-xl bg-muted",
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
    <div className="container mx-auto max-w-4xl py-12 space-y-10 px-4">
      <header className="text-center space-y-2">
        <h1 className="text-5xl font-black tracking-tight text-foreground">Settings</h1>
        <p className="text-lg text-muted-foreground font-medium">Personalize your TeachMeet classroom and meeting experience.</p>
      </header>

      <SettingsSection ref={profileRef} id="profile" title="Public Profile" description="Manage your identity and mandatory location details." icon={UserCircle}>
        <div className="grid md:grid-cols-2 gap-8">
            <div className="space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="displayName" className="text-xs font-black uppercase tracking-widest text-muted-foreground">Display Name</Label>
                    <Input id="displayName" value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="rounded-xl h-12" placeholder="How others see you" disabled={isSavingGeneral} />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="location" className="flex items-center justify-between">
                        <span className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1">Location <span className="text-destructive">*</span></span>
                        <Badge variant="outline" className="text-[9px] uppercase font-bold tracking-tighter">Security Requirement</Badge>
                    </Label>
                    <div className="flex gap-2">
                        <div className="relative flex-1">
                            <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-primary" />
                            <Input 
                                id="location" 
                                value={location} 
                                onChange={(e) => setLocation(e.target.value)} 
                                className="pl-9 rounded-xl h-12" 
                                placeholder="City, Country" 
                                disabled={isSavingGeneral} 
                            />
                        </div>
                        <Button 
                            variant="secondary" 
                            size="icon" 
                            onClick={handleGetLocation} 
                            disabled={isLocating || isSavingGeneral} 
                            className="rounded-xl h-12 w-12 shrink-0 shadow-sm"
                            title="Auto-detect location"
                        >
                            {isLocating ? <Loader2 className="h-5 w-5 animate-spin" /> : <Locate className="h-5 w-5" />}
                        </Button>
                    </div>
                    <p className="text-[10px] text-muted-foreground leading-relaxed italic px-1">
                        Location access is required to authenticate classroom payments and transaction history.
                    </p>
                </div>
            </div>
            <div className="bg-muted/30 p-6 rounded-2xl border flex flex-col items-center justify-center text-center space-y-4">
                <div className="relative">
                    <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center">
                        <UserCircle className="h-12 w-12 text-primary" />
                    </div>
                    <div className="absolute -bottom-1 -right-1 bg-background p-1.5 rounded-full border shadow-sm">
                        <ShieldCheck className="h-4 w-4 text-primary" />
                    </div>
                </div>
                <div className="space-y-1">
                    <p className="font-bold text-sm">Avatar & Account</p>
                    <p className="text-xs text-muted-foreground">Manage your avatar and email in the user menu at the top right.</p>
                </div>
            </div>
        </div>
        <div className="flex justify-end pt-4 border-t">
            <Button onClick={handleSaveGeneral} disabled={isSavingGeneral || authLoading} className="rounded-xl btn-gel px-8 h-12 text-base font-bold">
                {isSavingGeneral ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Save className="mr-2 h-5 w-5" />}
                Update Profile
            </Button>
        </div>
      </SettingsSection>

      <SettingsSection
        ref={avRef}
        id="advancedMeetingSettings"
        title="Audio & Video"
        description="Select devices and configure your meeting presence."
        icon={Camera}
        headerAction={
            meetingId && (
              <Button asChild variant="outline" size="sm" className="rounded-xl font-bold">
                <Link href={`/dashboard/meeting/prejoin?meetingId=${meetingId}`}>
                  <ArrowLeft className="mr-2 h-4 w-4" /> Exit Settings
                </Link>
              </Button>
            )
        }
      >
        <div className="grid md:grid-cols-2 gap-8 items-start">
            <div className="space-y-6">
                <div className="space-y-2">
                    <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Primary Camera</Label>
                    <Select value={selectedVideoDevice} onValueChange={setSelectedVideoDevice} disabled={!hasAVPermissions}>
                        <SelectTrigger className="rounded-xl h-12"><SelectValue placeholder="Select a camera..." /></SelectTrigger>
                        <SelectContent className="rounded-xl"><SelectItem value="default">Default System Camera</SelectItem>{videoDevices.map(d => <SelectItem key={d.deviceId} value={d.deviceId}>{d.label}</SelectItem>)}</SelectContent>
                    </Select>
                </div>
                <div className="space-y-2">
                    <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Audio Input</Label>
                    <Select value={selectedAudioInDevice} onValueChange={setSelectedAudioInDevice} disabled={!hasAVPermissions}>
                        <SelectTrigger className="rounded-xl h-12"><SelectValue placeholder="Select a microphone..." /></SelectTrigger>
                        <SelectContent className="rounded-xl"><SelectItem value="default">Default Microphone</SelectItem>{audioInDevices.map(d => <SelectItem key={d.deviceId} value={d.deviceId}>{d.label}</SelectItem>)}</SelectContent>
                    </Select>
                </div>
                <div className="space-y-3 pt-2">
                    <div className="flex items-center justify-between p-4 bg-muted/20 border rounded-2xl">
                        <Label htmlFor="camera-on" className="flex items-center gap-3 font-bold"><Video className="h-5 w-5 text-primary" /> Start meetings with camera ON</Label>
                        <Switch id="camera-on" checked={defaultCameraOn} onCheckedChange={setDefaultCameraOn} />
                    </div>
                    <div className="flex items-center justify-between p-4 bg-muted/20 border rounded-2xl">
                        <Label htmlFor="mic-on" className="flex items-center gap-3 font-bold"><Mic className="h-5 w-5 text-primary" /> Start meetings with mic ON</Label>
                        <Switch id="mic-on" checked={defaultMicOn} onCheckedChange={setDefaultMicOn} />
                    </div>
                </div>
            </div>
            <div className="space-y-4">
                <div className="aspect-video bg-black rounded-2xl flex items-center justify-center relative overflow-hidden shadow-2xl ring-4 ring-muted">
                    <video ref={videoPreviewRef} className={videoClassNames} autoPlay muted playsInline />
                    <div className="absolute bottom-3 left-3 flex gap-2">
                        <Badge className="bg-black/60 backdrop-blur-md border-none font-bold">Preview</Badge>
                        {isFilterToggleOn && <Badge className="bg-primary/80 border-none font-bold uppercase text-[9px] tracking-widest">{appliedFilter}</Badge>}
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                    <div className="flex items-center justify-between p-3 border rounded-xl bg-card shadow-sm">
                        <Label htmlFor="mirror-camera" className="text-xs font-bold flex items-center gap-2"><FlipHorizontal className="h-4 w-4" /> Mirror</Label>
                        <Switch id="mirror-camera" checked={mirrorCamera} onCheckedChange={setMirrorCamera} />
                    </div>
                    <div className="flex items-center justify-between p-3 border rounded-xl bg-card shadow-sm">
                        <Label htmlFor="filter-toggle" className="text-xs font-bold flex items-center gap-2"><ImageIcon className="h-4 w-4" /> Filter</Label>
                        <Switch id="filter-toggle" checked={isFilterToggleOn} onCheckedChange={setIsFilterToggleOn} disabled={appliedFilter === 'none'}/>
                    </div>
                </div>
                <Select value={appliedFilter} onValueChange={setAppliedFilter}>
                    <SelectTrigger className="rounded-xl h-11"><SelectValue placeholder="Video Filter Effect..." /></SelectTrigger>
                    <SelectContent className="rounded-xl">
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
        <div className="flex justify-end pt-6 border-t">
          <Button onClick={handleSaveAV} className="rounded-xl btn-gel px-8 h-12 font-bold">
            <Save className="mr-2 h-5 w-5" /> Save A/V Preferences
          </Button>
        </div>
      </SettingsSection>
      
      <div className="grid md:grid-cols-2 gap-8">
          <SettingsSection ref={recordingRef} title="Recordings" description="Quality and privacy defaults." icon={Clapperboard}>
            <div className="space-y-5">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Default Export Quality</Label>
                <Select value={recordingQuality} onValueChange={setRecordingQuality}>
                  <SelectTrigger className="rounded-xl h-11"><SelectValue placeholder="Select quality..." /></SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="480p">480p (Standard)</SelectItem>
                    <SelectItem value="720p">720p (HD)</SelectItem>
                    <SelectItem value="1080p">1080p (Full HD)</SelectItem>
                    <SelectItem value="1440p">1440p (2K)</SelectItem>
                    <SelectItem value="2160p">2160p (4K UHD)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between p-4 bg-muted/20 border rounded-2xl">
                <Label htmlFor="recording-public" className="flex flex-col gap-0.5">
                  <span className="font-bold">Set Public by Default</span>
                  <span className="text-[10px] text-muted-foreground font-medium uppercase">Visible to meeting participants</span>
                </Label>
                <Switch id="recording-public" checked={defaultRecordingPublic} onCheckedChange={setDefaultRecordingPublic} />
              </div>
              <div className="flex items-center justify-between p-4 bg-muted/20 border rounded-2xl">
                <Label htmlFor="auto-record" className="flex flex-col gap-0.5">
                  <span className="font-bold">Auto-Record Meetings</span>
                  <span className="text-[10px] text-muted-foreground font-medium uppercase">Start when meeting begins</span>
                </Label>
                <Switch id="auto-record" checked={autoRecordMeetings} onCheckedChange={setAutoRecordMeetings} />
              </div>
              <Button onClick={handleSaveRecordings} className="w-full rounded-xl btn-gel h-11 font-bold">Save Recording Settings</Button>
            </div>
          </SettingsSection>

          <SettingsSection title="Library & Docs" description="Global file upload preferences." icon={FileText}>
            <div className="space-y-5">
                <div className="flex items-center justify-between p-4 bg-muted/20 border rounded-2xl">
                    <Label htmlFor="document-public" className="flex flex-col gap-0.5">
                        <span className="font-bold">Public Uploads</span>
                        <span className="text-[10px] text-muted-foreground font-medium uppercase">Shared with classroom by default</span>
                    </Label>
                    <Switch id="document-public" checked={defaultDocumentPublic} onCheckedChange={setDefaultDocumentPublic} />
                </div>
                <div className="p-4 bg-primary/5 border-2 border-primary/10 rounded-2xl">
                    <p className="text-xs text-muted-foreground italic leading-relaxed">
                        Classroom materials uploaded by teachers are always visible to students regardless of this setting.
                    </p>
                </div>
                <Button onClick={handleSaveDocuments} className="w-full rounded-xl btn-gel h-11 font-bold mt-auto">Save Library Settings</Button>
            </div>
          </SettingsSection>
      </div>

      <SettingsSection title="Notifications" description="Manage how you receive real-time alerts." icon={Bell}>
         <div className="grid md:grid-cols-2 gap-8">
            <div className="space-y-4">
                <div className="p-5 border-2 border-primary/20 bg-primary/5 rounded-3xl">
                    <div className="flex items-center justify-between mb-4">
                        <div className="space-y-1">
                            <p className="font-black text-primary uppercase tracking-widest text-xs">Push Notifications</p>
                            <p className="text-[10px] font-bold text-muted-foreground uppercase">Status: {notificationPermission}</p>
                        </div>
                        {notificationPermission !== 'granted' && (
                            <Button size="sm" onClick={handleEnableNotifications} disabled={isEnablingNotifications || notificationPermission === 'denied'} className="rounded-full px-6 font-bold shadow-lg">
                                {isEnablingNotifications ? <Loader2 className="h-4 w-4 animate-spin"/> : "Activate"}
                            </Button>
                        )}
                    </div>
                    {notificationPermission === 'denied' && <p className="text-[10px] text-destructive font-bold uppercase bg-destructive/10 p-2 rounded-lg text-center">Permissions Blocked in Browser</p>}
                </div>
                <div className="flex items-center justify-between p-4 border rounded-2xl bg-muted/10">
                    <Label htmlFor="meeting-reminders" className="flex items-center gap-3 font-bold"><Video className="h-5 w-5 text-primary" /> Meeting Reminders</Label>
                    <Switch id="meeting-reminders" checked={meetingReminders} onCheckedChange={setMeetingReminders} />
                </div>
            </div>
            <div className="space-y-4">
                <div className="flex items-center justify-between p-4 border rounded-2xl bg-muted/10">
                    <Label htmlFor="chat-mentions" className="flex items-center gap-3 font-bold"><MessageSquare className="h-5 w-5 text-primary" /> Chat Mentions</Label>
                    <Switch id="chat-mentions" checked={chatMentions} onCheckedChange={setChatMentions} />
                </div>
                <div className="flex items-center justify-between p-4 border rounded-2xl bg-muted/10">
                    <Label htmlFor="hand-raise-alerts" className="flex items-center gap-3 font-bold"><Hand className="h-5 w-5 text-primary" /> Hand Raise Alerts</Label>
                    <Switch id="hand-raise-alerts" checked={handRaiseAlerts} onCheckedChange={setHandRaiseAlerts} />
                </div>
                <Button onClick={handleSaveNotifications} className="w-full rounded-xl btn-gel h-12 text-base font-bold mt-2">Update Alerts</Button>
            </div>
        </div>
      </SettingsSection>
      
      <SettingsSection
        ref={whiteboardRef}
        id="whiteboardSettings"
        title="Collaboration Canvas"
        description="Default tools and appearance for your Whiteboard."
        icon={Palette}
        headerAction={
          meetingId && (
            <Button asChild variant="outline" size="sm" className="rounded-xl font-bold">
              <Link href={`/dashboard/meeting/${meetingId}/whiteboard`}>
                <Palette className="mr-2 h-4 w-4" /> Canvas Mode
              </Link>
            </Button>
          )
        }
      >
        <div className="grid md:grid-cols-2 gap-8">
             <div className="space-y-6">
                <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Background Color</Label>
                    <div className="flex gap-2">
                        <Input type="color" value={whiteboardBgColor} onChange={(e) => setWhiteboardBgColor(e.target.value)} className="w-12 h-12 p-1 rounded-xl cursor-pointer" />
                        <Input value={whiteboardBgColor} onChange={(e) => setWhiteboardBgColor(e.target.value)} className="rounded-xl h-12 font-mono" />
                    </div>
                </div>
                <div className="space-y-4 p-5 bg-muted/20 border rounded-2xl">
                    <h4 className="text-xs font-black uppercase tracking-widest flex items-center gap-2 text-primary"><Brush className="h-4 w-4"/> Drawing Defaults</h4>
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label className="text-[10px] font-bold">Line Color</Label>
                            <Input type="color" value={whiteboardDrawColor} onChange={(e) => setWhiteboardDrawColor(e.target.value)} className="w-full h-10 p-1 rounded-xl cursor-pointer" />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-[10px] font-bold flex justify-between">Thickness <span>{whiteboardLineWidth}px</span></Label>
                            <Slider value={[whiteboardLineWidth]} onValueChange={(v) => setWhiteboardLineWidth(v[0])} min={1} max={50} step={1} />
                        </div>
                    </div>
                </div>
            </div>

            <div className="space-y-6">
                <div className="space-y-4 p-5 bg-muted/20 border rounded-2xl">
                    <h4 className="text-xs font-black uppercase tracking-widest flex items-center gap-2 text-primary"><TypeIcon className="h-4 w-4"/> Text Tool Defaults</h4>
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label className="text-[10px] font-bold">Font Family</Label>
                            <Select value={whiteboardFontFamily} onValueChange={setWhiteboardFontFamily}>
                                <SelectTrigger className="rounded-xl h-11"><SelectValue/></SelectTrigger>
                                <SelectContent className="rounded-xl">
                                    <SelectItem value="sans-serif">Sans-Serif (Standard)</SelectItem>
                                    <SelectItem value="serif">Serif (Formal)</SelectItem>
                                    <SelectItem value="monospace">Monospace (Code)</SelectItem>
                                    <SelectItem value="cursive">Cursive (Artistic)</SelectItem>
                                    <SelectItem value="fantasy">Fantasy (Stylized)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-[10px] font-bold flex justify-between">Font Size <span>{whiteboardFontSize}px</span></Label>
                            <Slider value={[whiteboardFontSize]} onValueChange={(v) => setWhiteboardFontSize(v[0])} min={8} max={128} step={1} />
                        </div>
                    </div>
                </div>
                <div className="flex flex-col h-full justify-end">
                    <Button onClick={handleSaveWhiteboard} className="w-full rounded-xl btn-gel h-12 text-base font-bold shadow-lg">Save Canvas Defaults</Button>
                </div>
            </div>
        </div>
      </SettingsSection>

      <div className="grid md:grid-cols-2 gap-8">
          <SettingsSection ref={dataRef} id="historyAndData" title="History & Data" description="Manage generated session logs." icon={History}>
            <div className="space-y-4">
                <p className="text-xs text-muted-foreground leading-relaxed">Clearing history removes meeting logs from your dashboard but keeps your recordings and documents safe.</p>
                 <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <Button variant="destructive" className="w-full h-12 rounded-xl font-bold justify-start px-4"><Trash2 className="mr-3 h-5 w-5" /> Clear Meeting Logs</Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="rounded-3xl">
                        <AlertDialogHeader><AlertDialogTitle>Purge Meeting Logs?</AlertDialogTitle><AlertDialogDescription>This will clear your recent activity and started meetings list. This cannot be undone.</AlertDialogDescription></AlertDialogHeader>
                        <AlertDialogFooter><AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel><AlertDialogAction onClick={handleClearHistory} className="rounded-xl bg-destructive text-white">Confirm Purge</AlertDialogAction></AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </div>
          </SettingsSection>

          <SettingsSection title="Legal & Account" description="Manage access and review policies." icon={ShieldCheck}>
            <div className="space-y-3">
                <Button asChild variant="outline" className="w-full justify-between h-11 rounded-xl px-4 border-primary/20 hover:bg-primary/5">
                    <Link href="/community-guidelines" target="_blank" className="flex items-center"><Users className="mr-3 h-4 w-4 text-primary" /> Community Guidelines <PlusCircle className="ml-2 h-3 w-3 opacity-30" /></Link>
                </Button>
                <Button asChild variant="outline" className="w-full justify-between h-11 rounded-xl px-4 border-primary/20 hover:bg-primary/5">
                    <Link href="/terms-of-service" target="_blank" className="flex items-center"><BookOpen className="mr-3 h-4 w-4 text-primary" /> Terms of Service <PlusCircle className="ml-2 h-3 w-3 opacity-30" /></Link>
                </Button>
                
                <div className="flex gap-2 pt-2">
                    <AlertDialog>
                        <AlertDialogTrigger asChild><Button variant="destructive" className="flex-1 h-11 rounded-xl font-bold"><LogOut className="mr-2 h-4 w-4" /> Sign Out</Button></AlertDialogTrigger>
                        <AlertDialogContent className="rounded-3xl">
                            <AlertDialogHeader><AlertDialogTitle>Sign Out?</AlertDialogTitle><AlertDialogDescription>You will be logged out of your TeachMeet account.</AlertDialogDescription></AlertDialogHeader>
                            <AlertDialogFooter><AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel><AlertDialogAction onClick={signOut} className="rounded-xl bg-destructive text-white">Sign Out</AlertDialogAction></AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                    <AlertDialog>
                        <AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="h-11 w-11 rounded-xl text-destructive/50 hover:text-destructive hover:bg-destructive/10"><Trash2 className="h-5 w-5" /></Button></AlertDialogTrigger>
                        <AlertDialogContent className="rounded-3xl">
                            <AlertDialogHeader><AlertDialogTitle className="text-destructive">Delete Account Permanently?</AlertDialogTitle><AlertDialogDescription>This action is irreversible. All your data, classrooms, and files will be deleted from our servers. You must re-authenticate to confirm.</AlertDialogDescription></AlertDialogHeader>
                            <AlertDialogFooter><AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel><AlertDialogAction onClick={handleDeleteAccount} className="rounded-xl bg-destructive text-white">Delete Account</AlertDialogAction></AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </div>
            </div>
          </SettingsSection>
      </div>
      
      <footer className="py-12 text-center">
          <p className="text-[10px] uppercase font-black tracking-[0.3em] text-muted-foreground opacity-30">TeachMeet v1.4.0 • Secured by Firebase</p>
      </footer>
    </div>
  );
}
