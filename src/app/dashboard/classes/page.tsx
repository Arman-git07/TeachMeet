
'use client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, PlusCircle, ArrowRight, BookOpen, User, Send, Check, Loader2, AlertTriangle } from "lucide-react";
import Link from "next/link";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { CreateClassDialogContent } from "@/components/class/CreateClassDialog";
import Image from "next/image";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, doc, updateDoc, arrayUnion, setDoc } from "firebase/firestore";
import { Skeleton } from "@/components/ui/skeleton";

type JoinStatus = 'joined' | 'not-joined' | 'requested';

interface Class {
  id: string;
  name: string;
  description: string;
  subject: string;
  creatorId: string;
  members: string[]; // Array of user UIDs
  joinRequests: string[]; // Array of user UIDs
}

interface EnrichedClass extends Class {
    memberCount: number;
    joinStatus: JoinStatus;
}

export default function ClassesPage() {
  const [classes, setClasses] = useState<EnrichedClass[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user: currentUser, loading: authLoading } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (authLoading) return; // Wait for user auth state to be resolved
    
    const classesCollectionRef = collection(db, "classes");
    const unsubscribe = onSnapshot(classesCollectionRef, (snapshot) => {
        const fetchedClasses: EnrichedClass[] = snapshot.docs.map(doc => {
            const data = doc.data() as Class;
            let joinStatus: JoinStatus = 'not-joined';
            if (currentUser) {
                if (data.members?.includes(currentUser.uid)) {
                    joinStatus = 'joined';
                } else if (data.joinRequests?.includes(currentUser.uid)) {
                    joinStatus = 'requested';
                }
            }
            return {
                id: doc.id,
                ...data,
                memberCount: data.members?.length || 0,
                joinStatus
            };
        });
        setClasses(fetchedClasses);
        setIsLoading(false);
        setError(null);
    }, (err) => {
        console.error("Error fetching classes:", err);
        setError("Could not load classes. Please check your connection and Firestore security rules.");
        setIsLoading(false);
    });

    return () => unsubscribe();
  }, [currentUser, authLoading]);

  const handleRequestToJoin = async (classId: string) => {
    if (!currentUser) {
        toast({ variant: "destructive", title: "Not Authenticated", description: "You must be signed in to join a class."});
        return;
    }
    const classDocRef = doc(db, "classes", classId);
    try {
        await updateDoc(classDocRef, {
            joinRequests: arrayUnion(currentUser.uid)
        });
        
        // Also create a document in the subcollection for the host to view details
        const requestRef = doc(db, "classes", classId, "joinRequests", currentUser.uid);
        await setDoc(requestRef, {
            name: currentUser.displayName || "Anonymous",
            email: currentUser.email,
            requestedAt: new Date()
        });
        
        toast({ title: "Request Sent", description: "Your request to join the class has been sent to the instructor."});
    } catch (error) {
        console.error("Error requesting to join class:", error);
        toast({ variant: "destructive", title: "Error", description: "Could not send join request." });
    }
  };

  if (isLoading || authLoading) {
    return (
        <div className="space-y-8">
            <div className="flex justify-between items-center"><Skeleton className="h-12 w-64" /><Skeleton className="h-12 w-48" /></div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <Skeleton className="h-80 w-full" />
                <Skeleton className="h-80 w-full" />
                <Skeleton className="h-80 w-full" />
            </div>
        </div>
    );
  }

  if (error) {
      return (
        <div className="text-center py-10 text-destructive bg-destructive/10 rounded-lg">
            <AlertTriangle className="mx-auto h-12 w-12 mb-2" />
            <p className="font-semibold">Error Loading Data</p>
            <p className="text-sm">{error}</p>
        </div>
      );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">My Classes</h1>
          <p className="text-muted-foreground">Manage your virtual classrooms.</p>
        </div>
        <Dialog>
          <DialogTrigger asChild><Button className="btn-gel rounded-lg"><PlusCircle className="mr-2 h-5 w-5" /> Create New Class</Button></DialogTrigger>
          <DialogContent className="sm:max-w-lg rounded-xl"><CreateClassDialogContent /></DialogContent>
        </Dialog>
      </div>

      {classes.length === 0 ? (
        <Card className="text-center py-12 rounded-xl shadow-lg border-border/50">
          <CardHeader>
            <Users className="mx-auto h-16 w-16 text-muted-foreground mb-4" />
            <CardTitle className="text-2xl">No Classes Yet</CardTitle>
            <CardDescription>Get started by creating your first class.</CardDescription>
          </CardHeader>
          <CardContent>
             <Dialog><DialogTrigger asChild><Button size="lg" className="btn-gel rounded-lg"><PlusCircle className="mr-2 h-5 w-5" /> Create New Class</Button></DialogTrigger><DialogContent className="sm:max-w-lg rounded-xl"><CreateClassDialogContent /></DialogContent></Dialog>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {classes.map(cls => (
            <Card key={cls.id} className="flex flex-col rounded-xl shadow-lg hover:shadow-xl transition-shadow duration-300 border-border/50">
              <div className="relative h-32 w-full">
                 <Image src={`https://placehold.co/400x200.png?text=${cls.subject || 'Class'}`} alt={cls.name} layout="fill" objectFit="cover" className="rounded-t-xl opacity-70" data-ai-hint="classroom study" />
              </div>
              <CardHeader className="pb-3"><CardTitle className="text-xl truncate" title={cls.name}>{cls.name}</CardTitle><CardDescription className="text-sm h-10 overflow-hidden">{cls.description}</CardDescription></CardHeader>
              <CardContent className="space-y-2 text-sm flex-grow">
                 <div className="flex items-center text-muted-foreground"><BookOpen className="mr-2 h-4 w-4" /> {cls.subject || 'General'}</div>
                <div className="flex items-center text-muted-foreground"><User className="mr-2 h-4 w-4" /> {cls.memberCount} Members</div>
              </CardContent>
              <CardFooter className="border-t pt-4">
                {cls.joinStatus === 'joined' && <Button asChild variant="default" className="w-full btn-gel rounded-lg"><Link href={`/dashboard/class/${cls.id}`}>Enter Class <ArrowRight className="ml-2 h-4 w-4" /></Link></Button>}
                {cls.joinStatus === 'not-joined' && <Button variant="outline" className="w-full rounded-lg" onClick={() => handleRequestToJoin(cls.id)}><Send className="mr-2 h-4 w-4" /> Request to Join</Button>}
                {cls.joinStatus === 'requested' && <Button variant="secondary" className="w-full rounded-lg" disabled><Check className="mr-2 h-4 w-4" /> Request Sent</Button>}
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
