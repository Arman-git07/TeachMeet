
'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LinkIcon, Hash, LogIn, XCircle } from "lucide-react";
import Link from "next/link";

export default function JoinMeetingPage() {
  return (
    <div className="container mx-auto py-8 flex justify-center items-center min-h-[calc(100vh-8rem)]">
      <Card className="w-full max-w-lg shadow-xl rounded-xl border-border/50">
        <CardHeader className="text-center">
          <LogIn className="mx-auto h-12 w-12 text-primary mb-3" />
          <CardTitle className="text-2xl">Join a Meeting</CardTitle>
          <CardDescription>Enter the meeting code or link to join.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <label htmlFor="meetingCode" className="block text-sm font-medium text-muted-foreground mb-1">
              Meeting Code
            </label>
            <div className="relative">
              <Hash className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
              <Input id="meetingCode" placeholder="e.g., abc-def-ghi" className="pl-10 rounded-lg text-base"/>
            </div>
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">
                Or
              </span>
            </div>
          </div>

          <div>
            <label htmlFor="meetingLink" className="block text-sm font-medium text-muted-foreground mb-1">
              Meeting Link
            </label>
            <div className="relative">
              <LinkIcon className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
              <Input id="meetingLink" placeholder="https://teachmeet.example.com/join/..." className="pl-10 rounded-lg text-base"/>
            </div>
          </div>
          
          <Link href="/dashboard/meeting/joined-meeting-id/wait" passHref legacyBehavior>
            <Button type="submit" className="w-full btn-gel text-lg py-3 rounded-lg">
              Join Meeting
            </Button>
          </Link>
        </CardContent>
         <CardFooter className="flex justify-between border-t pt-4">
            <Link href="/dashboard" passHref legacyBehavior>
                <Button variant="ghost" className="text-muted-foreground hover:text-destructive rounded-lg">
                    <XCircle className="mr-2 h-5 w-5" />
                    Cancel
                </Button>
            </Link>
        </CardFooter>
      </Card>
    </div>
  );
}
