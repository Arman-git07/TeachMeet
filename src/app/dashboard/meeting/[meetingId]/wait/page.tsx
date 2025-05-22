
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Mic, MicOff, Video, VideoOff, Settings2, User } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

export default function WaitingAreaPage({ params: { meetingId } }: { params: { meetingId: string } }) {
  // Mock state, in real app this would use useState and useEffect for device access
  const isMicOn = true;
  const isCameraOn = true;

  return (
    <div className="container mx-auto py-8 flex flex-col items-center justify-center min-h-[calc(100vh-8rem)]">
      <Card className="w-full max-w-2xl shadow-xl rounded-xl border-border/50">
        <CardHeader className="text-center">
          <User className="mx-auto h-12 w-12 text-primary mb-3" />
          <CardTitle className="text-2xl">Joining Meeting: {meetingId}</CardTitle>
          <CardDescription>Configure your audio and video before entering.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="aspect-video bg-muted rounded-lg flex items-center justify-center relative overflow-hidden">
            {isCameraOn ? (
              <Image src="https://placehold.co/600x338.png" alt="Camera Preview" layout="fill" objectFit="cover" data-ai-hint="webcam preview" />
            ) : (
              <div className="text-center text-muted-foreground">
                <VideoOff className="h-16 w-16 mx-auto mb-2" />
                <p>Camera is off</p>
              </div>
            )}
             <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex space-x-3">
              <Button variant={isMicOn ? "secondary" : "destructive"} size="icon" className="rounded-full shadow-md">
                {isMicOn ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
              </Button>
              <Button variant={isCameraOn ? "secondary" : "destructive"} size="icon" className="rounded-full shadow-md">
                {isCameraOn ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="micSource">Microphone</Label>
              <Select defaultValue="default">
                <SelectTrigger id="micSource" className="mt-1 rounded-lg">
                  <SelectValue placeholder="Select microphone" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">Default Microphone</SelectItem>
                  <SelectItem value="mic1">External Mic (Example)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="cameraSource">Camera</Label>
              <Select defaultValue="default">
                <SelectTrigger id="cameraSource" className="mt-1 rounded-lg">
                  <SelectValue placeholder="Select camera" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">Default Camera</SelectItem>
                  <SelectItem value="cam1">Integrated Webcam (Example)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <Checkbox id="virtualBackground" />
              <Label htmlFor="virtualBackground">Enable Virtual Background</Label>
            </div>
             <div className="flex items-center space-x-2">
              <Checkbox id="cameraFilter" />
              <Label htmlFor="cameraFilter">Apply Camera Filter</Label>
            </div>
          </div>

          <Link href="/dashboard/settings" passHref legacyBehavior>
            <Button asChild variant="outline" className="w-full flex items-center justify-center gap-2 rounded-lg">
              <a> {/* Added anchor tag for proper Link behavior with Button asChild */}
                <Settings2 className="h-5 w-5" />
                Advanced Settings
              </a>
            </Button>
          </Link>
          
          <Link href={`/dashboard/meeting/${meetingId}`} passHref legacyBehavior>
            <Button className="w-full btn-gel text-lg py-3 rounded-lg">
              Join Now
            </Button>
          </Link>
          <p className="text-xs text-muted-foreground text-center">
            By joining, you agree to TeachMeet&apos;s Terms of Service and Privacy Policy.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
