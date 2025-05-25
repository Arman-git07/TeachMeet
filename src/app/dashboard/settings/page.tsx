
'use client';

import React, { useEffect, useState, useRef } from "react";
import { useSearchParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Bell, Palette, UserCircle, ShieldCheck, BarChart3, Video as VideoIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

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
  const [highlightedSectionId, setHighlightedSectionId] = useState<string | null>(null);
  const advancedMeetingSettingsRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const [selectedFilter, setSelectedFilter] = useState<string>("none");

  useEffect(() => {
    const storedFilter = localStorage.getItem("teachmeet-camera-filter");
    if (storedFilter) {
      setSelectedFilter(storedFilter);
    }
  }, []);

  const handleFilterChange = (value: string) => {
    setSelectedFilter(value);
    localStorage.setItem("teachmeet-camera-filter", value);
    toast({
      title: "Filter Selected",
      description: `${value === "none" ? "No filter" : value.charAt(0).toUpperCase() + value.slice(1).replace(/([A-Z])/g, ' $1')} filter has been applied.`,
    });
  };
  

  useEffect(() => {
    const highlightParam = searchParams.get('highlight');
    if (highlightParam) {
      setHighlightedSectionId(highlightParam);
      
      const sectionRefMap: { [key: string]: React.RefObject<HTMLDivElement> } = {
        advancedMeetingSettings: advancedMeetingSettingsRef,
      };

      const targetRef = sectionRefMap[highlightParam];
      if (targetRef && targetRef.current) {
        targetRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      
      const timer = setTimeout(() => {
        setHighlightedSectionId(null);
      }, 2000); 
      return () => clearTimeout(timer);
    }
  }, [searchParams]);

  return (
    <div className="container mx-auto py-8 space-y-10">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold tracking-tight text-foreground">Settings</h1>
        <p className="text-lg text-muted-foreground mt-2">Customize your TeachMeet experience.</p>
      </div>

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
              <SelectContent>
                <SelectItem value="none">No Filter</SelectItem>
                <SelectItem value="vintage">Vintage</SelectItem>
                <SelectItem value="luminous">Luminous</SelectItem>
                <SelectItem value="dramatic">Dramatic</SelectItem>
                <SelectItem value="goldenhour">Golden Hour</SelectItem>
                <SelectItem value="grayscale">Grayscale</SelectItem>
                <SelectItem value="sepia">Sepia</SelectItem>
                <SelectItem value="softfocus">Soft Focus</SelectItem>
                <SelectItem value="brightclear">Bright & Clear</SelectItem>
                <SelectItem value="naturalglow">Natural Glow</SelectItem>
                <SelectItem value="radiantskin">Radiant Skin</SelectItem>
                <SelectItem value="smoothbright">Smooth & Bright</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <Button className="mt-6 btn-gel rounded-lg">Save Meeting Visuals</Button>
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
            <Label htmlFor="defaultColor">Default Pen Color</Label>
            <Input id="defaultColor" type="color" defaultValue="#32CD32" className="mt-1 w-full h-10 rounded-lg" />
          </div>
          <div>
            <Label htmlFor="backgroundColor">Background Color</Label>
            <Input id="backgroundColor" type="color" defaultValue="#FFFFFF" className="mt-1 w-full h-10 rounded-lg" />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="shapeRecognition" className="flex-grow">Enable Shape Recognition</Label>
            <Switch id="shapeRecognition" defaultChecked />
          </div>
        </div>
        <Button className="mt-6 btn-gel rounded-lg">Save Whiteboard Settings</Button>
      </SettingsSection>
      
      <SettingsSection title="Privacy &amp; Security" description="Manage your account security and data." icon={ShieldCheck}>
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
        </div>
      </SettingsSection>

       <SettingsSection title="Data &amp; Usage" description="Understand and manage your app data." icon={BarChart3}>
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
