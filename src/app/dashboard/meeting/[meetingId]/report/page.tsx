
'use client';

import { Suspense } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { X, AlertCircle } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { collection, onSnapshot, doc, getDoc, DocumentData, query } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedParticipants.size === 0) {
      toast({ variant: 'destructive', title: 'Selection Required', description: 'Please select at least one participant to report.' });
      return;
    }
    if (!abuseType) {
      toast({ variant: 'destructive', title: 'Abuse Type Required', description: 'Please select a type of abuse from the list.' });
      return;
    }

    setIsSubmitting(true);
    // Simulate API call for reporting
    setTimeout(() => {
      console.log("--- Abuse Report Submitted ---");
      console.log("Meeting ID:", meetingId);
      console.log("Reported Users:", Array.from(selectedParticipants));
      console.log("Abuse Type:", abuseType);
      console.log("Additional Info:", additionalInfo);
      console.log("----------------------------");

      toast({
        title: "Report Submitted",
        description: "Thank you for helping keep TeachMeet safe. Our team will review your report.",
      });
      setIsSubmitting(false);
      router.back();
    }, 1500);
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
                  participants.map(p => (
                    <div key={p.id} className={cn("flex items-center gap-3 p-2 rounded-lg cursor-pointer hover:bg-muted/50", selectedParticipants.has(p.id) && "bg-primary/10")}>
                      <Checkbox
                        id={`participant-${p.id}`}
                        checked={selectedParticipants.has(p.id)}
                        onCheckedChange={() => handleParticipantSelect(p.id)}
                        aria-label={`Select ${p.name}`}
                      />
                      <Label htmlFor={`participant-${p.id}`} className="flex items-center gap-3 cursor-pointer flex-grow">
                        <Avatar className="h-9 w-9">
                          <AvatarImage src={p.photoURL} alt={p.name} data-ai-hint="avatar user" />
                          <AvatarFallback>{p.name.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <span className="font-medium text-sm">{p.name} {p.id === auth.currentUser?.uid && "(You)"}</span>
                      </Label>
                    </div>
                  ))
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
