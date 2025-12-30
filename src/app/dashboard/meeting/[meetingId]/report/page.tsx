
'use client';

import { Suspense } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { X, AlertCircle, Loader2 } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { collection, onSnapshot, doc, getDoc, DocumentData, query, addDoc, serverTimestamp, getDocs, where, setDoc } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface Participant {
  id: string;
  name: string;
  photoURL?: string;
  role: 'host' | 'participant';
}

const abuseTypes = [
  "Spam or unwanted content",
  "Fraud, phishing and other deceptive practices",
  "Malware (distributed via link in the chat window)",
  "Harassment and hateful content",
  "Unwanted sexual content",
  "Violence and gore",
  "Child endangerment",
  "Other"
];

function ReportAbusePageContent() {
  const { meetingId } = useParams() as { meetingId: string };
  const router = useRouter();
  const searchParams = useSearchParams();
  const topic = searchParams.get('topic') || "TeachMeet Meeting";
  const initiallyReportedUserId = searchParams.get('reportedUser');

  const [participants, setParticipants] = useState<Participant[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedParticipants, setSelectedParticipants] = useState<Set<string>>(new Set());
  const [abuseType, setAbuseType] = useState<string>('');
  const [additionalInfo, setAdditionalInfo] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (initiallyReportedUserId) {
      setSelectedParticipants(prev => new Set(prev).add(initiallyReportedUserId));
    }
  }, [initiallyReportedUserId]);

  useEffect(() => {
    if (!meetingId) return;
    const participantsColRef = collection(db, "meetings", meetingId, "participants");
    const q = query(participantsColRef);
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetched: Participant[] = [];
      snapshot.forEach(docSnap => {
        const data = docSnap.data() as DocumentData;
        fetched.push({
          id: docSnap.id,
          name: data.name || "Guest",
          photoURL: data.photoURL,
          role: data.isHost ? 'host' : 'participant',
        });
      });
      setParticipants(fetched);
      setIsLoading(false);
    }, (error) => {
      console.error("Error fetching participants for report:", error);
      toast({ variant: "destructive", title: "Error", description: "Could not load participant list." });
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [meetingId, toast]);

  const handleParticipantSelect = (participantId: string) => {
    setSelectedParticipants(prev => {
      const newSet = new Set(prev);
      if (newSet.has(participantId)) {
        newSet.delete(participantId);
      } else {
        newSet.add(participantId);
      }
      return newSet;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedParticipants.size === 0) {
      toast({ variant: 'destructive', title: 'Selection Required', description: 'Please select at least one participant to report.' });
      return;
    }
    if (!abuseType) {
      toast({ variant: 'destructive', title: 'Abuse Type Required', description: 'Please select a type of abuse from the list.' });
      return;
    }
    if (!auth.currentUser) {
        toast({ variant: 'destructive', title: 'Authentication Error', description: 'You must be signed in to submit a report.' });
        return;
    }

    setIsSubmitting(true);
    const reporterId = auth.currentUser.uid;

    try {
        const reportPromises = Array.from(selectedParticipants).map(reportedUserId => {
            const reportedUser = participants.find(p => p.id === reportedUserId);
            return addDoc(collection(db, "reports"), {
                reportedUserId: reportedUserId,
                reportedUserName: reportedUser?.name || 'Unknown User',
                meetingId: meetingId,
                abuseType: abuseType,
                additionalInfo: additionalInfo,
                reporterId: reporterId, // Stored for admin review, not shown to user
                timestamp: serverTimestamp(),
            });
        });
        
        await Promise.all(reportPromises);

        // --- Simulate backend logic (e.g., Cloud Function) ---
        for (const reportedUserId of selectedParticipants) {
             // 1. Simulate notifying the reported user
            console.log(`[SIMULATION] Notifying user ${reportedUserId} that they have been reported for violating community guidelines.`);

            // 2. Check report count for auto-blocking
            const reportsQuery = query(collection(db, "reports"), where("reportedUserId", "==", reportedUserId));
            const reportsSnapshot = await getDocs(reportsQuery);
            const reportCount = reportsSnapshot.size;
            
            console.log(`[SIMULATION] User ${reportedUserId} now has ${reportCount} reports.`);

            if (reportCount >= 3) {
                console.log(`[SIMULATION] Report count for ${reportedUserId} reached ${reportCount}. Applying a one-year block.`);
                const oneYearFromNow = new Date();
                oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);
                
                // In a real app, you would set a custom claim or write to a 'blocked_users' collection
                // that is checked by security rules and login logic.
                const blockedUserRef = doc(db, 'systemBlockedUsers', reportedUserId);
                await setDoc(blockedUserRef, {
                    blockedAt: serverTimestamp(),
                    expiresAt: oneYearFromNow,
                    reason: `Auto-blocked after ${reportCount} reports. Last report type: ${abuseType}`,
                });
                 console.log(`[SIMULATION] User ${reportedUserId} has been blocked until ${oneYearFromNow.toISOString()}`);
            }
        }
        
        toast({
            title: "Report Submitted",
            description: "Thank you for helping keep TeachMeet safe. Our team will review your report.",
        });
        
        router.back();

    } catch (error) {
        console.error("Error submitting abuse report:", error);
        toast({ variant: 'destructive', title: "Submission Error", description: "Could not submit your report. Please try again." });
    } finally {
        setIsSubmitting(false);
    }
  };
  
  const backLink = `/dashboard/meeting/${meetingId}/participants?${searchParams.toString()}`;

  return (
    <div className="flex flex-col h-full bg-background">
      <header className="flex-none p-4 border-b shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button asChild variant="ghost" size="icon" className="rounded-full">
            <Link href={backLink}>
              <X className="h-5 w-5" />
            </Link>
          </Button>
          <h1 className="text-xl font-semibold">Report abuse</h1>
        </div>
      </header>

      <main className="flex-grow container mx-auto max-w-2xl py-8">
        <form onSubmit={handleSubmit} className="space-y-8">
          <section>
            <h2 className="font-semibold text-lg mb-2">Identify the people in this meeting to report as abusive.</h2>
            <p className="text-muted-foreground text-sm">
              Information about the meeting and participants, plus an optional short video clip (not implemented in this prototype), will be sent to TeachMeet for review. <a href="/community-guidelines" target="_blank" className="text-accent hover:underline">Learn more about reporting abuse</a>.
            </p>
            <Card className="mt-4">
              <CardContent className="p-4 space-y-2">
                {isLoading ? (
                  [...Array(3)].map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-md" />)
                ) : (
                  participants.map(p => {
                    const isCurrentUser = p.id === auth.currentUser?.uid;
                    return (
                    <div key={p.id} className={cn(
                        "flex items-center gap-3 p-2 rounded-lg", 
                        !isCurrentUser && "cursor-pointer hover:bg-muted/50", 
                        selectedParticipants.has(p.id) && "bg-primary/10",
                        isCurrentUser && "opacity-60 cursor-not-allowed"
                    )}>
                      <Checkbox
                        id={`participant-${p.id}`}
                        checked={selectedParticipants.has(p.id)}
                        onCheckedChange={() => !isCurrentUser && handleParticipantSelect(p.id)}
                        aria-label={`Select ${p.name}`}
                        disabled={isCurrentUser}
                      />
                      <Label htmlFor={`participant-${p.id}`} className={cn("flex items-center gap-3 flex-grow", !isCurrentUser && "cursor-pointer")}>
                        <Avatar className="h-9 w-9">
                          <AvatarImage src={p.photoURL || undefined} alt={p.name} data-ai-hint="avatar user" />
                          <AvatarFallback>{p.name.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <span className="font-medium text-sm">{p.name} {isCurrentUser && "(You)"}</span>
                      </Label>
                    </div>
                  )})
                )}
              </CardContent>
            </Card>
          </section>

          <section>
            <Label htmlFor="abuse-type" className="font-semibold text-lg">Type of abuse*</Label>
            <Select value={abuseType} onValueChange={setAbuseType} required>
              <SelectTrigger id="abuse-type" className="w-full mt-2 rounded-lg text-base p-3 h-auto">
                <SelectValue placeholder="Select a type of abuse..." />
              </SelectTrigger>
              <SelectContent className="rounded-lg">
                {abuseTypes.map(type => (
                  <SelectItem key={type} value={type} className="p-3">{type}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </section>

          <section>
            <Label htmlFor="additional-info" className="font-semibold text-lg">Additional information (optional)</Label>
            <Textarea
              id="additional-info"
              value={additionalInfo}
              onChange={e => setAdditionalInfo(e.target.value)}
              placeholder="Provide more details about the incident..."
              className="mt-2 rounded-lg min-h-[120px]"
            />
          </section>

          <footer className="flex justify-end gap-2 pt-4 border-t">
            <Button type="button" variant="ghost" className="rounded-lg" asChild>
              <Link href={backLink}>Cancel</Link>
            </Button>
            <Button type="submit" className="rounded-lg btn-gel" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null}
              {isSubmitting ? "Submitting..." : "Submit Report"}
            </Button>
          </footer>
        </form>
      </main>
    </div>
  );
}

export default function ReportAbusePage() {
    return (
        <Suspense fallback={<div className="h-full w-full flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>}>
            <ReportAbusePageContent />
        </Suspense>
    )
}
