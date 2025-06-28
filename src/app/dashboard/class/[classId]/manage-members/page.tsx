
// src/app/dashboard/class/[classId]/manage-members/page.tsx
'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ArrowLeft, Users, UserCheck, UserX, ShieldCheck, Loader2, Trash2, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from '@/hooks/useAuth';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { cn } from '@/lib/utils';
import { db } from '@/lib/firebase';
import { collection, query, getDocs, doc, deleteDoc, setDoc, getDoc, serverTimestamp, onSnapshot, writeBatch, updateDoc } from 'firebase/firestore';

interface Member {
  id: string; // userId
  name: string;
  email?: string; // Optional, might not be in join request
  avatarUrl?: string;
  role: 'student' | 'teacher';
  status?: 'member' | 'requested'; // Status is implicit for members, explicit for requests
  joinedAt?: any; // Firestore timestamp for members
  requestedAt?: any; // Firestore timestamp for requests
}

export default function ManageMembersPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();

  const classId = params.classId as string;
  const className = searchParams.get('name') || "Class";

  const [members, setMembers] = useState<Member[]>([]);
  const [pendingRequests, setPendingRequests] = useState<Member[]>([]);
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null); // null: checking, false: denied, true: allowed
  const [loadingData, setLoadingData] = useState(true);
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
  const [actionToConfirm, setActionToConfirm] = useState<{ type: 'remove' | 'accept' | 'reject'; member: Member } | null>(null);

  // This combined effect handles auth check and all data fetching via snapshots
  useEffect(() => {
    if (authLoading || !user || !classId) {
      if (!authLoading) setLoadingData(false);
      return;
    }

    const classroomDocRef = doc(db, "classrooms", classId);

    const unsubscribe = onSnapshot(classroomDocRef, (classroomSnap) => {
      setLoadingData(true);
      if (!classroomSnap.exists()) {
        toast({ variant: "destructive", title: "Error", description: "Class not found." });
        router.push("/dashboard/classes");
        return;
      }

      const classroomData = classroomSnap.data();
      const teacherId = classroomData.teacherId;
      const isTeacher = user.uid === teacherId;
      
      if (isAuthorized === null && !isTeacher) { // Check only on first run
        toast({ variant: "destructive", title: "Access Denied", description: "You are not authorized to manage members for this class." });
        router.push(`/dashboard/class/${classId}?name=${encodeURIComponent(className)}`);
      }
      setIsAuthorized(isTeacher);
      
      if (isTeacher) {
        // Fetch pending requests from the classroom document array
        const requests = classroomData.joinRequests || [];
        const fetchedRequests: Member[] = requests.map((req: any) => ({
            id: req.userId,
            name: req.userName,
            avatarUrl: req.userAvatar,
            role: 'student',
            requestedAt: req.requestedAt?.toDate ? req.requestedAt.toDate() : new Date(), // Handle different timestamp types
            status: 'requested',
        }));
        setPendingRequests(fetchedRequests.sort((a,b) => (b.requestedAt?.getTime() || 0) - (a.requestedAt?.getTime() || 0) ));
      }
      
      // Fetch members from subcollection (this part remains the same)
      const membersColRef = collection(db, "classrooms", classId, "members");
      getDocs(query(membersColRef)).then(membersSnapshot => {
         const fetchedMembers: Member[] = [];
          membersSnapshot.forEach(docSnap => {
            const data = docSnap.data();
            fetchedMembers.push({ 
              id: docSnap.id, name: data.name, avatarUrl: data.avatarUrl, role: data.role,
              joinedAt: data.joinedAt?.toDate ? data.joinedAt.toDate() : new Date(data.joinedAt), email: data.email,
            });
          });
        setMembers(fetchedMembers.sort((a, b) => (a.role === 'teacher' ? -1 : b.role === 'teacher' ? 1 : 0) || a.name.localeCompare(b.name)));
        setLoadingData(false);
      }).catch(error => {
        console.error("Error fetching members subcollection:", error);
        toast({ variant: "destructive", title: "Error", description: "Could not load members list." });
        setLoadingData(false);
      });

    }, (error) => {
      console.error("Error with classroom snapshot listener:", error);
      toast({ variant: "destructive", title: "Real-time Error", description: "Could not listen for classroom updates." });
      setIsAuthorized(false);
      setLoadingData(false);
    });

    return () => unsubscribe();
  }, [classId, user, authLoading, router, toast, className, isAuthorized]);


  const openConfirmationDialog = (type: 'remove' | 'accept' | 'reject', member: Member) => {
    setActionToConfirm({ type, member });
    setIsConfirmDialogOpen(true);
  };

  const handleConfirmAction = async () => {
    if (!actionToConfirm || !classId || !isAuthorized) return;
    const { type, member } = actionToConfirm;
    
    const classroomRef = doc(db, "classrooms", classId);
    
    try {
        if (type === 'remove') {
            if (member.role === 'teacher') {
                toast({ variant: "destructive", title: "Action Not Allowed", description: "Teachers cannot be removed this way." }); return;
            }
            const memberRef = doc(db, "classrooms", classId, "members", member.id);
            await deleteDoc(memberRef);
            // Also decrement member count
            const classroomSnap = await getDoc(classroomRef);
            const currentCount = classroomSnap.data()?.memberCount || 1;
            await updateDoc(classroomRef, { memberCount: Math.max(1, currentCount - 1) });
            toast({ title: "Member Removed", description: `${member.name} has been removed from the class.` });
        } else if (type === 'accept' || type === 'reject') {
            const classroomSnap = await getDoc(classroomRef);
            if (!classroomSnap.exists()) throw new Error("Classroom not found");
            const currentRequests = classroomSnap.data().joinRequests || [];
            const newRequests = currentRequests.filter((req: any) => req.userId !== member.id);
            
            const batch = writeBatch(db);
            
            if (type === 'accept') {
                const memberRef = doc(db, "classrooms", classId, "members", member.id);
                batch.update(classroomRef, { 
                    joinRequests: newRequests,
                    memberCount: (classroomSnap.data()?.memberCount || 0) + 1,
                });
                batch.set(memberRef, {
                    userId: member.id,
                    name: member.name,
                    avatarUrl: member.avatarUrl,
                    role: 'student',
                    joinedAt: serverTimestamp(),
                });
                await batch.commit();
                toast({ title: "Request Accepted", description: `${member.name}'s request to join has been accepted.` });
            } else { // Reject
                await updateDoc(classroomRef, { joinRequests: newRequests });
                toast({ title: "Request Rejected", description: `${member.name}'s request to join has been rejected.` });
            }
        }
    } catch (error) {
      console.error(`Error performing action ${type}:`, error);
      toast({ variant: "destructive", title: "Action Failed", description: (error as Error).message });
    }

    setIsConfirmDialogOpen(false);
    setActionToConfirm(null);
  };


  if (authLoading || loadingData || isAuthorized === null) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground">Verifying access and loading members for {className}...</p>
      </div>
    );
  }
  
  if (isAuthorized === false) {
     return (
        <div className="flex flex-col items-center justify-center h-full p-8 text-center">
            <AlertTriangle className="h-16 w-16 text-destructive mb-4" />
            <h1 className="text-2xl font-bold text-destructive mb-2">Access Denied</h1>
            <p className="text-muted-foreground mb-6">You are not authorized to manage members for this class.</p>
            <Link href={`/dashboard/class/${classId}?name=${encodeURIComponent(className)}`} passHref legacyBehavior>
             <Button variant="outline" className="rounded-lg"><ArrowLeft className="mr-2 h-4 w-4" /> Back to Class Details</Button>
            </Link>
        </div>
    );
  }


  return (
    <div className="space-y-6 p-4 md:p-8 h-full flex flex-col">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Users className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold text-foreground">Manage Members: {className}</h1>
            <p className="text-sm text-muted-foreground">Class ID: {classId}</p>
          </div>
        </div>
        <Button asChild variant="outline" className="rounded-lg">
          <Link href={`/dashboard/class/${classId}/edit?name=${encodeURIComponent(className)}`}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Edit Class
          </Link>
        </Button>
      </div>

      <Card className="rounded-xl shadow-lg border-border/50 flex-grow flex flex-col">
        <CardHeader>
          <CardTitle className="flex items-center text-lg"><ShieldCheck className="mr-2 h-5 w-5 text-primary" />Current Members ({members.length})</CardTitle>
          <CardDescription>Students and teachers currently in this class.</CardDescription>
        </CardHeader>
        <CardContent className="flex-grow space-y-2 overflow-y-auto p-3">
          {members.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">No active members in this class yet.</p>
          ) : (
            members.map(member => (
              <div key={member.id} className="flex items-center justify-between p-2.5 hover:bg-muted/50 rounded-lg transition-colors">
                <div className="flex items-center gap-3">
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={member.avatarUrl} alt={member.name} data-ai-hint="user avatar"/>
                    <AvatarFallback>{member.name.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-medium text-foreground">{member.name} {member.role === 'teacher' && <span className="text-xs text-primary ml-1">(Host)</span>}</p>
                    {member.email && <p className="text-xs text-muted-foreground">{member.email}</p>}
                  </div>
                </div>
                {member.role === 'student' && user?.uid === members.find(m => m.role === 'teacher')?.id && (
                  <Button variant="ghost" size="sm" className="rounded-lg text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => openConfirmationDialog('remove', member)}>
                    <UserX className="mr-1.5 h-4 w-4" /> Remove
                  </Button>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card className="rounded-xl shadow-lg border-border/50 mt-6 flex-grow flex flex-col">
          <CardHeader>
          <CardTitle className="flex items-center text-lg"><UserCheck className="mr-2 h-5 w-5 text-accent" />Pending Requests ({pendingRequests.length})</CardTitle>
          <CardDescription>Students waiting for approval to join this class.</CardDescription>
          </CardHeader>
          <CardContent className="flex-grow space-y-2 overflow-y-auto p-3">
          {pendingRequests.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">No pending join requests.</p>
          ) : (
              pendingRequests.map(request => (
              <div key={request.id} className="flex items-center justify-between p-2.5 hover:bg-muted/50 rounded-lg transition-colors">
                  <div className="flex items-center gap-3">
                  <Avatar className="h-9 w-9">
                      <AvatarImage src={request.avatarUrl} alt={request.name} data-ai-hint="user avatar"/>
                      <AvatarFallback>{request.name.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div>
                      <p className="text-sm font-medium text-foreground">{request.name}</p>
                      {request.email && <p className="text-xs text-muted-foreground">{request.email}</p>}
                  </div>
                  </div>
                  <div className="flex gap-2">
                  <Button variant="default" size="sm" className="rounded-lg btn-gel text-xs" onClick={() => openConfirmationDialog('accept', request)}>
                      Accept
                  </Button>
                  <Button variant="destructive" size="sm" className="rounded-lg text-xs" onClick={() => openConfirmationDialog('reject', request)}>
                      Reject
                  </Button>
                  </div>
              </div>
              ))
          )}
          </CardContent>
      </Card>
      
      <footer className="flex-none py-2 text-center text-xs text-muted-foreground border-t bg-background mt-auto">
        Manage class participants and their access.
      </footer>

      <AlertDialog open={isConfirmDialogOpen} onOpenChange={setIsConfirmDialogOpen}>
        <AlertDialogContent className="rounded-xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Action</AlertDialogTitle>
            <AlertDialogDescription>
              {actionToConfirm?.type === 'remove' && `Are you sure you want to remove ${actionToConfirm.member.name} from the class?`}
              {actionToConfirm?.type === 'accept' && `Are you sure you want to accept ${actionToConfirm.member.name}'s request to join?`}
              {actionToConfirm?.type === 'reject' && `Are you sure you want to reject ${actionToConfirm.member.name}'s request to join?`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-lg" onClick={() => setIsConfirmDialogOpen(false)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmAction}
              className={cn(
                "rounded-lg",
                actionToConfirm?.type === 'remove' || actionToConfirm?.type === 'reject' ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : "btn-gel"
              )}
            >
              Confirm {actionToConfirm?.type.charAt(0).toUpperCase() + actionToConfirm?.type.slice(1)}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
