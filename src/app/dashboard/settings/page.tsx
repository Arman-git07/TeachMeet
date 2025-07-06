
'use client';

import React, { useEffect, useState, useRef } from "react";
import { useSearchParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Bell, Palette, UserCircle, ShieldCheck, BarChart3, Video as VideoIcon, Clapperboard, Settings as SettingsIcon, ArrowRightCircle, BookOpen, ShieldQuestion, Users as UsersIconLucide, ImageIcon, Mic, Save, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { updateProfile } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

const SettingsSection = React.forwardRef<
  HTMLDivElement,
  { title: string, description: string, icon: React.ElementType, children: React.ReactNode, className?: string, id?: string }
>(({ title, description, icon: Icon, children, className, id }, ref) => (
  <Card id={id} ref={ref} className={cn("shadow-lg rounded-xl border-border/50", className)}>
    <CardHeader>
      <div className="flex items-center gap-3">
        <Icon className="h-7 w-7 text-primary" />
        <div>
          <CardTitle className="text-xl">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
      </div>
    </CardHeader>
    <CardContent className="space-y-6">
      {children}
    </CardContent>
  </Card>
));
SettingsSection.displayName = "SettingsSection";

export default function SettingsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();

  const advancedMeetingSettingsRef = useRef<HTMLDivElement>(null);
  const recordingSettingsRef = useRef<HTMLDivElement>(null); 
  const whiteboardSettingsRef = useRef<HTMLDivElement>(null);
  const [highlightedSectionId, setHighlightedSectionId] = useState<string | null>(null);

  // General Settings State
  const [displayNameInput, setDisplayNameInput] = useState<string>('');
  const [isSavingGeneralSettings, setIsSavingGeneralSettings] = useState<boolean>(false);

  // Meeting Settings State
  const [selectedFilter, setSelectedFilter] = useState<string>("none");

  // Whiteboard Settings State
  const [whiteboardBackgroundColor, setWhiteboardBackgroundColor] = useState<string>("#FFFFFF");
  const [enableShapeRecognition, setEnableShapeRecognition] = useState<boolean>(true);
  const [showDrawTool, setShowDrawTool] = useState<boolean>(true);
  const [showSelectTool, setShowSelectTool] = useState<boolean>(true);
  const [showTextTool, setShowTextTool] = useState<boolean>(true);
  const [showEraseTool, setShowEraseTool] = useState<boolean>(true);
  
  const [initialWhiteboardSettings, setInitialWhiteboardSettings] = useState({
    backgroundColor: "#FFFFFF",
    shapeRecognition: true,
    showDrawTool: true,
    showSelectTool: true,
    showTextTool: true,
    showEraseTool: true,
  });

  const isWhiteboardDirty =
    whiteboardBackgroundColor !== initialWhiteboardSettings.backgroundColor ||
    enableShapeRecognition !== initialWhiteboardSettings.shapeRecognition ||
    showDrawTool !== initialWhiteboardSettings.showDrawTool ||
    showSelectTool !== initialWhiteboardSettings.showSelectTool ||
    showTextTool !== initialWhiteboardSettings.showTextTool ||
    showEraseTool !== initialWhiteboardSettings.showEraseTool;

  useEffect(() => {
    if (user && !authLoading) {
      setDisplayNameInput(user.displayName || '');
    }
    // Camera filter
    const storedFilter = localStorage.getItem("teachmeet-camera-filter") || "none";
    setSelectedFilter(storedFilter);
    
    // Whiteboard settings
    const loadedSettings = {
      backgroundColor: localStorage.getItem("teachmeet-whiteboard-bg-color") || "#FFFFFF",
      shapeRecognition: localStorage.getItem("teachmeet-whiteboard-shape-recognition") !== 'false',
      showDrawTool: localStorage.getItem("teachmeet-whiteboard-showDrawTool") !== 'false',
      showSelectTool: localStorage.getItem("teachmeet-whiteboard-showSelectTool") !== 'false',
      showTextTool: localStorage.getItem("teachmeet-whiteboard-showTextTool") !== 'false',
      showEraseTool: localStorage.getItem("teachmeet-whiteboard-showEraseTool") !== 'false',
    };
    
    setWhiteboardBackgroundColor(loadedSettings.backgroundColor);
    setEnableShapeRecognition(loadedSettings.shapeRecognition);
    setShowDrawTool(loadedSettings.showDrawTool);
    setShowSelectTool(loadedSettings.showSelectTool);
    setShowTextTool(loadedSettings.showTextTool);
    setShowEraseTool(loadedSettings.showEraseTool);
    setInitialWhiteboardSettings(loadedSettings);

  }, [user, authLoading]);

  const handleSaveGeneralSettings = async () => {
    if (!auth.currentUser) {
      toast({ variant: "destructive", title: "Error", description: "You are not signed in." });
      return;
    }
    if (!displayNameInput.trim()) {
      toast({ variant: "destructive", title: "Validation Error", description: "Display name cannot be empty." });
      return;
    }
    setIsSavingGeneralSettings(true);
    try {
      await updateProfile(auth.currentUser, { displayName: displayNameInput.trim() });
      toast({ title: "Success", description: "Display name updated successfully." });
      // The useAuth hook's onAuthStateChanged should pick up the change and update context
    } catch (error: any) {
      console.error("Error updating display name:", error);
      toast({ variant: "destructive", title: "Update Failed", description: error.message || "Could not update display name." });
    } finally {
      setIsSavingGeneralSettings(false);
    }
  };
  
  const handleGenericSave = (sectionName: string) => {
    toast({
        title: `${sectionName} Settings Saved`,
        description: `Your preferences for ${sectionName.toLowerCase()} have been updated (Mock).`,
    });
  };

  const handleFilterChange = (value: string) => {
    setSelectedFilter(value);
    localStorage.setItem("teachmeet-camera-filter", value);
    const filterDisplayName = value === "none" ? "No filter" : value.charAt(0).toUpperCase() + value.slice(1).replace(/([A-Z])/g, ' $1');
    toast({
      title: "Filter Selected",
      description: `${filterDisplayName} filter has been applied. This will take effect in the meeting waiting area.`,
    });
  };

  const handleWhiteboardBackgroundColorChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setWhiteboardBackgroundColor(event.target.value);
  };
  
  const handleShapeRecognitionToggle = (checked: boolean) => {
    setEnableShapeRecognition(checked);
  };

  const handleToggleToolVisibility = (tool: 'draw' | 'select' | 'text' | 'erase', checked: boolean) => {
    const stateSetterMap = {
      draw: setShowDrawTool,
      select: setShowSelectTool,
      text: setShowTextTool,
      erase: setShowEraseTool,
    };
    stateSetterMap[tool](checked);
  };
  
  const handleSaveWhiteboardSettings = () => {
    localStorage.setItem("teachmeet-whiteboard-bg-color", whiteboardBackgroundColor);
    localStorage.setItem("teachmeet-whiteboard-shape-recognition", String(enableShapeRecognition));
    localStorage.setItem("teachmeet-whiteboard-showDrawTool", String(showDrawTool));
    localStorage.setItem("teachmeet-whiteboard-showSelectTool", String(showSelectTool));
    localStorage.setItem("teachmeet-whiteboard-showTextTool", String(showTextTool));
    localStorage.setItem("teachmeet-whiteboard-showEraseTool", String(showEraseTool));
    
    setInitialWhiteboardSettings({
        backgroundColor: whiteboardBackgroundColor,
        shapeRecognition: enableShapeRecognition,
        showDrawTool: showDrawTool,
        showSelectTool: showSelectTool,
        showTextTool: showTextTool,
        showEraseTool: showEraseTool,
    });

    toast({
        title: "Settings Saved",
        description: "Your whiteboard settings have been updated.",
    });
  };

  useEffect(() => {
    const highlightParam = searchParams.get('highlight');
    if (highlightParam) {
      setHighlightedSectionId(highlightParam);
      
      const sectionRefMap: { [key: string]: React.RefObject<HTMLDivElement> } = {
        advancedMeetingSettings: advancedMeetingSettingsRef,
        recordingSettings: recordingSettingsRef,
        whiteboardSettings: whiteboardSettingsRef,
      };

      const targetRef = sectionRefMap[highlightParam];
      if (targetRef && targetRef.current) {
        targetRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      
      const timer = setTimeout(() => {
        setHighlightedSectionId(null);
        const current = new URL(window.location.toString());
        current.searchParams.delete('highlight');
        router.replace(current.pathname + current.search, { scroll: false });
      }, 2000); 
      return () => clearTimeout(timer);
    }
  }, [searchParams, router]);

  const handleNavigateToSection = (sectionId: string) => {
    router.push(`/dashboard/settings?highlight=${sectionId}`, { scroll: false });
  };

  return (
    <div className="container mx-auto py-8 space-y-10">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold tracking-tight text-foreground">Settings</h1>
        <p className="text-lg text-muted-foreground mt-2">Customize your TeachMeet experience.</p>
      </div>

      <SettingsSection title="Quick Navigation" description="Jump to specific settings sections." icon={ArrowRightCircle}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <Button 
            variant="outline" 
            className="rounded-lg justify-start text-left py-3" 
            onClick={() => handleNavigateToSection('advancedMeetingSettings')}
          >
            <VideoIcon className="mr-2 h-5 w-5" />
            Meeting Visuals
          </Button>
          <Button 
            variant="outline" 
            className="rounded-lg justify-start text-left py-3" 
            onClick={() => handleNavigateToSection('recordingSettings')}
          >
            <Clapperboard className="mr-2 h-5 w-5" />
            Recording Settings
          </Button>
          <Button 
            variant="outline" 
            className="rounded-lg justify-start text-left py-3" 
            onClick={() => handleNavigateToSection('whiteboardSettings')}
          >
            <Palette className="mr-2 h-5 w-5" />
            Whiteboard Settings
          </Button>
        </div>
      </SettingsSection>

      <SettingsSection title="General Settings" description="Manage your profile and basic preferences." icon={UserCircle}>
        <div className="space-y-4">
          <div>
            <Label htmlFor="displayNameInput">Display Name</Label>
            <Input 
              id="displayNameInput" 
              value={displayNameInput} 
              onChange={(e) => setDisplayNameInput(e.target.value)} 
              className="mt-1 rounded-lg" 
              disabled={isSavingGeneralSettings || authLoading}
              placeholder={authLoading ? "Loading name..." : "Enter your display name"}
            />
          </div>
        </div>
        <Button 
          className="mt-6 btn-gel rounded-lg" 
          onClick={handleSaveGeneralSettings}
          disabled={isSavingGeneralSettings || authLoading || (user?.displayName === displayNameInput.trim() && displayNameInput.trim() !== '')}
        >
          {isSavingGeneralSettings ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          {isSavingGeneralSettings ? 'Saving...' : 'Save General Settings'}
        </Button>
      </SettingsSection>

      <SettingsSection 
        id="advancedMeetingSettings"
        ref={advancedMeetingSettingsRef}
        title="Advanced Meeting Settings" 
        description="Configure your camera and visual effects." 
        icon={VideoIcon}
        className={highlightedSectionId === 'advancedMeetingSettings' ? 'highlight-blink' : ''}
      >
        <div className="space-y-4">
          <div className="pt-4">
            <Label htmlFor="cameraFilterSelect" className="block mb-1">Select camera filter</Label>
            <Select value={selectedFilter} onValueChange={handleFilterChange}>
              <SelectTrigger id="cameraFilterSelect" className="w-full mt-1 rounded-lg">
                <SelectValue placeholder="Select a filter" />
              </SelectTrigger>
              <SelectContent className="rounded-lg">
                <SelectItem value="none" className="rounded-md">No Filter</SelectItem>
                <SelectItem value="vintage" className="rounded-md">Vintage</SelectItem>
                <SelectItem value="luminous" className="rounded-md">Luminous</SelectItem>
                <SelectItem value="dramatic" className="rounded-md">Dramatic</SelectItem>
                <SelectItem value="goldenhour" className="rounded-md">Golden Hour</SelectItem>
                <SelectItem value="grayscale" className="rounded-md">Grayscale</SelectItem>
                <SelectItem value="sepia" className="rounded-md">Sepia</SelectItem>
                <SelectItem value="softfocus" className="rounded-md">Soft Focus</SelectItem>
                <SelectItem value="brightclear" className="rounded-md">Bright & Clear</SelectItem>
                <SelectItem value="naturalglow" className="rounded-md">Natural Glow</SelectItem>
                <SelectItem value="radiantskin" className="rounded-md">Radiant Skin</SelectItem>
                <SelectItem value="smoothbright" className="rounded-md">Smooth & Bright</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <Button className="mt-6 btn-gel rounded-lg" onClick={() => handleGenericSave('Meeting Visuals')}>Save Meeting Visuals</Button>
      </SettingsSection>

      <SettingsSection 
        id="recordingSettings" 
        ref={recordingSettingsRef} 
        title="Recording Settings" 
        description="Manage cloud storage and auto-recording preferences." 
        icon={Clapperboard} 
        className={highlightedSectionId === 'recordingSettings' ? 'highlight-blink' : ''}
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Cloud Storage Used: <span className="font-semibold text-foreground">0 GB / 5 GB</span></span>
            <Button variant="outline" size="sm" className="rounded-lg">Manage Storage</Button>
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="autoRecord" className="flex-grow">Auto-record new meetings</Label>
            <Switch id="autoRecord" />
          </div>
        </div>
        <Button className="mt-6 btn-gel rounded-lg" onClick={() => handleGenericSave('Recording')}>Save Recording Settings</Button>
      </SettingsSection>
      

      <SettingsSection title="Notifications" description="Control how you receive notifications." icon={Bell} id="notifications">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="meetingReminders" className="flex-grow">Meeting Reminders</Label>
            <Switch id="meetingReminders" defaultChecked />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="chatNotifications" className="flex-grow">Chat Message Notifications</Label>            
            <Switch id="chatNotifications" defaultChecked />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="emailSummaries" className="flex-grow">Email Summaries</Label>
            <Switch id="emailSummaries" />
          </div>
        </div>
         <Button className="mt-6 btn-gel rounded-lg" onClick={() => handleGenericSave('Notification')}>Save Notification Settings</Button>
      </SettingsSection>

      <SettingsSection 
        id="whiteboardSettings"
        ref={whiteboardSettingsRef}
        title="Whiteboard Customization" 
        description="Personalize your whiteboard appearance and tools." 
        icon={Palette}
        className={highlightedSectionId === 'whiteboardSettings' ? 'highlight-blink' : ''}
      >
        <div className="space-y-6">
          <div className="space-y-2">
            <Label>Toolbar Buttons</Label>
            <p className="text-sm text-muted-foreground">Choose which tools appear on the whiteboard toolbar.</p>
            <div className="pl-2 space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="showDrawTool" className="flex-grow">Show Draw/Shapes Tool</Label>
                <Switch id="showDrawTool" checked={showDrawTool} onCheckedChange={(checked) => handleToggleToolVisibility('draw', checked)} />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="showSelectTool" className="flex-grow">Show Select Tool</Label>
                <Switch id="showSelectTool" checked={showSelectTool} onCheckedChange={(checked) => handleToggleToolVisibility('select', checked)} />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="showTextTool" className="flex-grow">Show Text Tool</Label>
                <Switch id="showTextTool" checked={showTextTool} onCheckedChange={(checked) => handleToggleToolVisibility('text', checked)} />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="showEraseTool" className="flex-grow">Show Erase Tool</Label>
                <Switch id="showEraseTool" checked={showEraseTool} onCheckedChange={(checked) => handleToggleToolVisibility('erase', checked)} />
              </div>
            </div>
          </div>
          <div>
            <Label htmlFor="backgroundColor">Background Color</Label>
            <Input id="backgroundColor" type="color" value={whiteboardBackgroundColor} onChange={handleWhiteboardBackgroundColorChange} className="mt-1 w-full h-10 rounded-lg" />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="shapeRecognition" className="flex-grow">Enable Shape Recognition (Experimental)</Label>
            <Switch id="shapeRecognition" checked={enableShapeRecognition} onCheckedChange={handleShapeRecognitionToggle} />
          </div>
          <div className="mt-6 flex justify-end">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button className="btn-gel rounded-lg" disabled={!isWhiteboardDirty}>
                  Save Whiteboard Settings
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="rounded-xl">
                <AlertDialogHeader>
                  <AlertDialogTitle>Save Your Changes?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will save your current whiteboard customization settings. Are you sure you want to continue?
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel className="rounded-lg">Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleSaveWhiteboardSettings} className="rounded-lg">
                    Save Changes
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </SettingsSection>
      
      <SettingsSection title="Privacy & Security" description="Manage your account security and data." icon={ShieldCheck}>
        <div className="space-y-4">
           <div>
            <Button variant="outline" className="w-full rounded-lg">Change Password</Button>
          </div>
           <div>
            <Button variant="outline" className="w-full rounded-lg">Manage Connected Devices</Button>
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="twoFactorAuth" className="flex-grow">Two-Factor Authentication</Label>
            <Button variant="link" className="text-accent">Enable</Button>
          </div>
          <div className="mt-4 space-y-2">
            <Button asChild variant="link" className="p-0 h-auto text-muted-foreground hover:text-accent justify-start">
              <Link href="/privacy-policy" target="_blank">
                <ShieldQuestion className="mr-2 h-4 w-4"/> View Privacy Policy
              </Link>
            </Button>
            <Button asChild variant="link" className="p-0 h-auto text-muted-foreground hover:text-accent justify-start">
              <Link href="/terms-of-service" target="_blank">
                <BookOpen className="mr-2 h-4 w-4"/> View Terms of Service
              </Link>
            </Button>
            <Button asChild variant="link" className="p-0 h-auto text-muted-foreground hover:text-accent justify-start">
              <Link href="/community-guidelines" target="_blank">
                <UsersIconLucide className="mr-2 h-4 w-4"/> View Community Guidelines
              </Link>
            </Button>
          </div>
           <p className="text-xs text-muted-foreground mt-2">
              Communications are secured using HTTPS. Data stored with Firebase is encrypted at rest.
            </p>
        </div>
      </SettingsSection>

       <SettingsSection title="Data & Usage" description="Understand and manage your app data." icon={BarChart3}>
        <div className="space-y-4">
           <div>
            <Button variant="outline" className="w-full rounded-lg">Export My Data</Button>
          </div>
           <div>
            <Button variant="destructive" className="w-full rounded-lg">Delete Account</Button>
            <p className="text-xs text-muted-foreground mt-1">This action is irreversible.</p>
          </div>
        </div>
      </SettingsSection>
    </div>
  );
}
