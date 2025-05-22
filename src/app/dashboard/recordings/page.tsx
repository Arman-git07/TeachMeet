
'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Clapperboard, VideoOff, Search } from "lucide-react";
import Link from "next/link";
import { Input } from "@/components/ui/input";

// Mock data for recordings - replace with actual data fetching
const recordings = [
  { id: "rec1", title: "Project Alpha - Sprint Review", date: "2024-08-20", duration: "45:12", size: "120MB" },
  { id: "rec2", title: "Client Onboarding Session", date: "2024-08-18", duration: "01:12:30", size: "250MB" },
  { id: "rec3", title: "Team Brainstorming - Q4 Goals", date: "2024-08-15", duration: "30:55", size: "85MB" },
];

export default function RecordingsPage() {
  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Meeting Recordings</h1>
          <p className="text-muted-foreground">Access and manage your saved meeting recordings.</p>
        </div>
        <div className="relative w-full md:w-auto md:max-w-xs">
          <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input 
            type="search" 
            placeholder="Search recordings..." 
            className="pl-10 rounded-lg w-full" 
          />
        </div>
      </div>

      {recordings.length === 0 ? (
        <Card className="text-center py-12 rounded-xl shadow-lg border-border/50">
          <CardHeader>
            <VideoOff className="mx-auto h-16 w-16 text-muted-foreground mb-4" />
            <CardTitle className="text-2xl">No Recordings Yet</CardTitle>
            <CardDescription>Your recorded meetings will appear here once saved.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Start a meeting and enable recording to save your sessions.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {recordings.map(recording => (
            <Card key={recording.id} className="rounded-xl shadow-lg hover:shadow-xl transition-shadow duration-300 border-border/50 flex flex-col">
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <CardTitle className="text-xl truncate" title={recording.title}>{recording.title}</CardTitle>
                  <Clapperboard className="h-6 w-6 text-primary flex-shrink-0 ml-2" />
                </div>
                <CardDescription className="text-sm">
                  {new Date(recording.date).toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-1 text-sm flex-grow">
                <p className="text-muted-foreground">Duration: {recording.duration}</p>
                <p className="text-muted-foreground">File Size: {recording.size}</p>
              </CardContent>
              <CardFooter className="border-t pt-4 grid grid-cols-2 gap-2">
                <Button variant="default" className="w-full btn-gel rounded-md">
                  Play
                </Button>
                <Button variant="outline" className="w-full rounded-md">
                  Download
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
       <Card className="mt-8 p-6 rounded-xl shadow-lg border-border/50 bg-card">
        <CardHeader className="p-0 pb-4">
          <CardTitle className="text-xl">Recording Settings</CardTitle>
          <CardDescription>Manage your cloud storage and auto-recording preferences.</CardDescription>
        </CardHeader>
        <CardContent className="p-0 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Cloud Storage Used: <span className="font-semibold text-foreground">1.5 GB / 5 GB</span></span>
            <Button variant="outline" size="sm" className="rounded-md">Manage Storage</Button>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Auto-record new meetings:</span>
            <Link href="/dashboard/settings#notifications" passHref> {/* Example link to settings section */}
                <Button variant="link" className="text-accent">Configure</Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
