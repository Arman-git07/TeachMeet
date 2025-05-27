
'use client';

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Edit3, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";

export default function WhiteboardPage() {
  const params = useParams();
  const meetingId = params.meetingId as string;

  return (
    <div className="flex flex-col h-screen bg-muted/30">
      <header className="p-4 border-b bg-background shadow-sm sticky top-0 z-10">
        <div className="container mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Edit3 className="h-7 w-7 text-primary" />
            <h1 className="text-xl font-semibold text-foreground">
              Collaborative Whiteboard
            </h1>
          </div>
          {meetingId && (
            <Link href={`/dashboard/meeting/${meetingId}`} passHref legacyBehavior>
              <Button variant="outline" className="rounded-lg">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Meeting
              </Button>
            </Link>
          )}
        </div>
      </header>
      <main className="flex-grow flex items-center justify-center p-4">
        <Card className="w-full max-w-4xl text-center shadow-xl rounded-xl border-border/50">
          <CardHeader>
            <CardTitle className="text-2xl">Whiteboard Area</CardTitle>
            <CardDescription>
              This is where the collaborative whiteboard will be. This feature is currently under development.
            </CardDescription>
          </CardHeader>
          <CardContent className="min-h-[300px] flex flex-col items-center justify-center">
            <Edit3 className="h-24 w-24 text-muted-foreground/50 mb-6 animate-pulse" />
            <p className="text-muted-foreground">
              Imagine a shared canvas here, with tools for drawing shapes, text, and more!
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              (Meeting ID: {meetingId || "N/A"})
            </p>
          </CardContent>
        </Card>
      </main>
      <footer className="p-4 text-center text-xs text-muted-foreground border-t bg-background">
        TeachMeet Whiteboard - Collaboration in real-time.
      </footer>
    </div>
  );
}
