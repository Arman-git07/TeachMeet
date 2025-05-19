import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Bell, Palette, UserCircle, ShieldCheck, BarChart3 } from "lucide-react";

const SettingsSection = ({ title, description, icon: Icon, children }: { title: string, description: string, icon: React.ElementType, children: React.ReactNode }) => (
  <Card className="shadow-lg rounded-xl border-border/50">
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
);

export default function SettingsPage() {
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
          <div>
            <Label htmlFor="email">Email Address</Label>
            <Input id="email" type="email" defaultValue="user@example.com" disabled className="mt-1 rounded-lg bg-muted/50" />
          </div>
          <div>
            <Label htmlFor="language">Language</Label>
            <Select defaultValue="en">
              <SelectTrigger className="w-full mt-1 rounded-lg">
                <SelectValue placeholder="Select language" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="es">Español</SelectItem>
                <SelectItem value="fr">Français</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <Button className="mt-6 btn-gel rounded-lg">Save General Settings</Button>
      </SettingsSection>

      <SettingsSection title="Notifications" description="Control how you receive notifications." icon={Bell}>
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
