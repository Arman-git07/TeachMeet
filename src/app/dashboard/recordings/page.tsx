
'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Clapperboard, VideoOff, Search, PlayCircle, Download } from "lucide-react"; // Added PlayCircle, Download
import Link from "next/link";
import { Input } from "@/components/ui/input";

// Mock data for recordings - replace with actual data fetching
const recordings: Array<{ id: string; title: string; date: string; duration: string; size: string; thumbnailUrl?: string }> = [];

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
        <Card className="text-center py-12 rounded-xl shadow-lg border-border/50 bg-card">
          <CardHeader>
            <VideoOff className="mx-auto h-20 w-20 text-primary/70 mb-4" />
            <CardTitle className="text-2xl font-semibold">No Recordings Yet</CardTitle>
            <CardDescription className="text-base text-muted-foreground mt-1">
              Your recorded meetings will appear here once saved.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Start a meeting and enable recording to save your sessions.
            </p>
            {/* Optionally, add a button to guide users, e.g., to settings or how to record */}
            {/* <Button variant="outline" className="mt-6 rounded-lg">Learn How to Record</Button> */}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {recordings.map(recording => (
            <Card key={recording.id} className="rounded-xl shadow-lg hover:shadow-primary/20 transition-shadow duration-300 border-border/50 flex flex-col bg-card overflow-hidden group">
              <div className="relative h-40 w-full bg-muted/50 group-hover:opacity-90 transition-opacity">
                {/* Placeholder for a thumbnail - replace with actual image */}
                <Clapperboard className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-16 w-16 text-primary/30" />
                 {/* Example using an img tag if thumbnailUrl is available 
                {recording.thumbnailUrl && (
                  <img src={recording.thumbnailUrl} alt={`Thumbnail for ${recording.title}`} className="w-full h-full object-cover" />
                )}
                */}
              </div>
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <CardTitle className="text-xl font-semibold truncate" title={recording.title}>{recording.title}</CardTitle>
                  {/* Optional: Icon for recording type or status */}
                </div>
                <CardDescription className="text-sm text-muted-foreground">
                  {new Date(recording.date).toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-1 text-sm flex-grow">
                <p className="text-muted-foreground">Duration: {recording.duration}</p>
                <p className="text-muted-foreground">File Size: {recording.size}</p>
              </CardContent>
              <CardFooter className="border-t pt-4 grid grid-cols-2 gap-3 bg-muted/20">
                <Button variant="default" className="w-full btn-gel rounded-md text-sm">
                  <PlayCircle className="mr-2 h-4 w-4" /> Play
                </Button>
                <Button variant="outline" className="w-full rounded-md text-sm">
                  <Download className="mr-2 h-4 w-4" /> Download
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
