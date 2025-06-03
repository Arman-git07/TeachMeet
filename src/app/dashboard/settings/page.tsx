
'use client';

import React, { useEffect, useState, useRef } from "react";
import { useSearchParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Bell, Palette, UserCircle, ShieldCheck, BarChart3, Video as VideoIcon, Clapperboard, Settings as SettingsIcon, ArrowRightCircle, BookOpen, ShieldQuestion, Users as UsersIconLucide, ImageIcon, Languages, Mic } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import Link from "next/link";

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


const languageOptions = [
  { value: "en-US", label: "English (US)" },
  { value: "hi-IN", label: "Hindi (India)" },
  { value: "es-ES", label: "Spanish (Spain)" },
  { value: "fr-FR", label: "French (France)" },
  { value: "de-DE", label: "German (Germany)" },
  { value: "ja-JP", label: "Japanese (Japan)" },
  { value: "ko-KR", label: "Korean (South Korea)" },
];

const ttsVoiceOptions = [
  { value: "neutral", label: "Neutral" },
  { value: "female", label: "Girl / Female" },
  { value: "male", label: "Boy / Male" },
];

export default function SettingsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { toast } = useToast();

  const [highlightedSectionId, setHighlightedSectionId] = useState<string | null>(null);
  const advancedMeetingSettingsRef = useRef<HTMLDivElement>(null);
  const recordingSettingsRef = useRef<HTMLDivElement>(null); 
  const languageSettingsRef = useRef<HTMLDivElement>(null);

  const [selectedFilter, setSelectedFilter] = useState<string>("none");
  const [whiteboardPenColor, setWhiteboardPenColor] = useState<string>("#000000");
  const [whiteboardBackgroundColor, setWhiteboardBackgroundColor] = useState<string>("#FFFFFF");
  const [enableShapeRecognition, setEnableShapeRecognition] = useState<boolean>(true);
  
  const [defaultSpokenLanguage, setDefaultSpokenLanguage] = useState<string>("en-US");
  const [preferredTranslationLanguage, setPreferredTranslationLanguage] = useState<string>("en-US");
  const [preferredTTSVoice, setPreferredTTSVoice] = useState<string>("neutral");

  useEffect(() => {
    // Camera filter
    const storedFilter = localStorage.getItem("teachmeet-camera-filter");
    if (storedFilter) setSelectedFilter(storedFilter);
    
    // Whiteboard
    const storedPenColor = localStorage.getItem("teachmeet-whiteboard-pen-color");
    if (storedPenColor) setWhiteboardPenColor(storedPenColor);
    else localStorage.setItem("teachmeet-whiteboard-pen-color", "#000000");
    
    const storedBgColor = localStorage.getItem("teachmeet-whiteboard-bg-color");
    if (storedBgColor) setWhiteboardBackgroundColor(storedBgColor);
    else localStorage.setItem("teachmeet-whiteboard-bg-color", "#FFFFFF");

    const storedShapeRecognition = localStorage.getItem("teachmeet-whiteboard-shape-recognition");
    if (storedShapeRecognition) setEnableShapeRecognition(storedShapeRecognition === 'true');
    else localStorage.setItem("teachmeet-whiteboard-shape-recognition", String(true));

    // Language & Translation
    const storedSpokenLang = localStorage.getItem("teachmeet-default-spoken-language");
    if (storedSpokenLang) setDefaultSpokenLanguage(storedSpokenLang);
    else localStorage.setItem("teachmeet-default-spoken-language", "en-US");

    const storedTranslationLang = localStorage.getItem("teachmeet-preferred-translation-language");
    if (storedTranslationLang) setPreferredTranslationLanguage(storedTranslationLang);
    else localStorage.setItem("teachmeet-preferred-translation-language", "en-US");

    const storedTTSVoice = localStorage.getItem("teachmeet-preferred-tts-voice");
    if (storedTTSVoice) setPreferredTTSVoice(storedTTSVoice);
    else localStorage.setItem("teachmeet-preferred-tts-voice", "neutral");

  }, []);

  const handleFilterChange = (value: string) => {
    setSelectedFilter(value);
    localStorage.setItem("teachmeet-camera-filter", value);
    const filterDisplayName = value === "none" ? "No filter" : value.charAt(0).toUpperCase() + value.slice(1).replace(/([A-Z])/g, ' $1');
    toast({
      title: "Filter Selected",
      description: `${filterDisplayName} filter has been applied. This will take effect in the meeting waiting area.`,
    });
  };

  const handleWhiteboardPenColorChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newColor = event.target.value;
    setWhiteboardPenColor(newColor);
    localStorage.setItem("teachmeet-whiteboard-pen-color", newColor);
  };

  const handleWhiteboardBackgroundColorChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newColor = event.target.value;
    setWhiteboardBackgroundColor(newColor);
    localStorage.setItem("teachmeet-whiteboard-bg-color", newColor);
     toast({
      title: "Whiteboard Background Changed",
      description: `Background color set to ${newColor}. This will apply when you next open or clear a whiteboard.`,
    });
  };
  
  const handleShapeRecognitionToggle = (checked: boolean) => {
    setEnableShapeRecognition(checked);
    localStorage.setItem("teachmeet-whiteboard-shape-recognition", String(checked));
     toast({
      title: "Shape Recognition Setting Changed",
      description: `Shape recognition is now ${checked ? 'enabled' : 'disabled'}.`,
    });
  };
  
  const handleSaveWhiteboardSettings = () => {
    toast({
      title: "Whiteboard Settings Confirmed",
      description: "Your whiteboard preferences are up-to-date and saved in your browser's local storage.",
    });
  };

  const handleLanguageSettingChange = (type: 'spoken' | 'translation' | 'ttsVoice', value: string) => {
    let key = '';
    let setter: React.Dispatch<React.SetStateAction<string>> | null = null;
    let title = '';

    if (type === 'spoken') {
      key = "teachmeet-default-spoken-language";
      setter = setDefaultSpokenLanguage;
      title = "Default Spoken Language Updated";
    } else if (type === 'translation') {
      key = "teachmeet-preferred-translation-language";
      setter = setPreferredTranslationLanguage;
      title = "Preferred Translation Language Updated";
    } else if (type === 'ttsVoice') {
      key = "teachmeet-preferred-tts-voice";
      setter = setPreferredTTSVoice;
      title = "Preferred TTS Voice Updated";
    }

    if (key && setter) {
      setter(value);
      localStorage.setItem(key, value);
      toast({ title, description: `Your preference has been saved.` });
    }
  };
  
  useEffect(() => {
    const highlightParam = searchParams.get('highlight');
    if (highlightParam) {
      setHighlightedSectionId(highlightParam);
      
      const sectionRefMap: { [key: string]: React.RefObject<HTMLDivElement> } = {
        advancedMeetingSettings: advancedMeetingSettingsRef,
        recordingSettings: recordingSettingsRef,
        languageSettings: languageSettingsRef,
      };

      const targetRef = sectionRefMap[highlightParam];
      if (targetRef && targetRef.current) {
        targetRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      
      const timer = setTimeout(() => {
        setHighlightedSectionId(null);
         // Clean URL by removing highlight param
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
            onClick={() => handleNavigateToSection('languageSettings')}
          >
            <Languages className="mr-2 h-5 w-5" />
            Language & Translation
          </Button>
        </div>
      </SettingsSection>

      <SettingsSection title="General Settings" description="Manage your profile and basic preferences." icon={UserCircle}>
        <div className="space-y-4">
          <div>
            <Label htmlFor="displayName">Display Name</Label>
            <Input id="displayName" defaultValue="Current User Name" className="mt-1 rounded-lg" />
          </div>
        </div>
        <Button className="mt-6 btn-gel rounded-lg">Save General Settings</Button>
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
        <Button className="mt-6 btn-gel rounded-lg">Save Meeting Visuals</Button>
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
        <Button className="mt-6 btn-gel rounded-lg">Save Recording Settings</Button>
      </SettingsSection>
      
      <SettingsSection 
        id="languageSettings"
        ref={languageSettingsRef}
        title="Language & Translation Settings" 
        description="Set your default languages for communication and translation." 
        icon={Languages}
        className={highlightedSectionId === 'languageSettings' ? 'highlight-blink' : ''}
      >
        <div className="space-y-4">
          <div>
            <Label htmlFor="defaultSpokenLanguageSelect">My Default Spoken Language</Label>
            <Select value={defaultSpokenLanguage} onValueChange={(value) => handleLanguageSettingChange('spoken', value)}>
              <SelectTrigger id="defaultSpokenLanguageSelect" className="w-full mt-1 rounded-lg">
                <SelectValue placeholder="Select your spoken language" />
              </SelectTrigger>
              <SelectContent className="rounded-lg">
                {languageOptions.map(lang => (
                  <SelectItem key={lang.value} value={lang.value} className="rounded-md">{lang.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">This language will be assumed as your input for translation features.</p>
          </div>
          <div>
            <Label htmlFor="preferredTranslationLangSelect">My Preferred Translation Target Language</Label>
            <Select value={preferredTranslationLanguage} onValueChange={(value) => handleLanguageSettingChange('translation', value)}>
              <SelectTrigger id="preferredTranslationLangSelect" className="w-full mt-1 rounded-lg">
                <SelectValue placeholder="Select preferred translation language" />
              </SelectTrigger>
              <SelectContent className="rounded-lg">
                {languageOptions.map(lang => (
                  <SelectItem key={lang.value} value={lang.value} className="rounded-md">{lang.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
             <p className="text-xs text-muted-foreground mt-1">Translated text will default to this language.</p>
          </div>
           <div>
            <Label htmlFor="preferredTTSVoiceSelect">Preferred Voice for Translated Audio</Label>
            <Select value={preferredTTSVoice} onValueChange={(value) => handleLanguageSettingChange('ttsVoice', value)}>
              <SelectTrigger id="preferredTTSVoiceSelect" className="w-full mt-1 rounded-lg">
                <SelectValue placeholder="Select preferred voice" />
              </SelectTrigger>
              <SelectContent className="rounded-lg">
                {ttsVoiceOptions.map(voice => (
                  <SelectItem key={voice.value} value={voice.value} className="rounded-md">{voice.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
             <p className="text-xs text-muted-foreground mt-1">Choose the default voice type for spoken translations.</p>
          </div>
        </div>
        {/* No explicit save button needed as changes are saved on select via localStorage */}
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
         <Button className="mt-6 btn-gel rounded-lg">Save Notification Settings</Button>
      </SettingsSection>

      <SettingsSection title="Whiteboard Customization" description="Personalize your whiteboard appearance." icon={Palette}>
        <div className="space-y-4">
          <div>
            <Label htmlFor="defaultPenColor">Default Pen Color</Label>
            <Input id="defaultPenColor" type="color" value={whiteboardPenColor} onChange={handleWhiteboardPenColorChange} className="mt-1 w-full h-10 rounded-lg" />
          </div>
          <div>
            <Label htmlFor="backgroundColor">Background Color</Label>
            <Input id="backgroundColor" type="color" value={whiteboardBackgroundColor} onChange={handleWhiteboardBackgroundColorChange} className="mt-1 w-full h-10 rounded-lg" />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="shapeRecognition" className="flex-grow">Enable Shape Recognition (Experimental)</Label>
            <Switch id="shapeRecognition" checked={enableShapeRecognition} onCheckedChange={handleShapeRecognitionToggle} />
          </div>
        </div>
        <Button className="mt-6 btn-gel rounded-lg" onClick={handleSaveWhiteboardSettings}>Save Whiteboard Settings</Button>
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
             <Link href="/privacy-policy" passHref legacyBehavior>
                <Button asChild variant="link" className="p-0 h-auto text-muted-foreground hover:text-accent justify-start">
                    <a><ShieldQuestion className="mr-2 h-4 w-4"/> View Privacy Policy</a>
                </Button>
             </Link>
             <Link href="/terms-of-service" passHref legacyBehavior>
                <Button asChild variant="link" className="p-0 h-auto text-muted-foreground hover:text-accent justify-start">
                    <a><BookOpen className="mr-2 h-4 w-4"/> View Terms of Service</a>
                </Button>
             </Link>
             <Link href="/community-guidelines" passHref legacyBehavior>
                <Button asChild variant="link" className="p-0 h-auto text-muted-foreground hover:text-accent justify-start">
                    <a><UsersIconLucide className="mr-2 h-4 w-4"/> View Community Guidelines</a>
                </Button>
             </Link>
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
