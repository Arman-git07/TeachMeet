
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
import { collection, query, getDocs, doc, deleteDoc, setDoc, getDoc, serverTimestamp, onSnapshot, writeBatch } from 'firebase/firestore';

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
  const [classroomTeacherId, setClassroomTeacherId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
  const [actionToConfirm, setActionToConfirm] = useState<{ type: 'remove' | 'accept' | 'reject'; member: Member } | null>(null);


  const fetchClassroomTeacher = useCallback(async () => {
    if (!classId) return;
    try {
      const classroomDocRef = doc(db, "classrooms", classId);
      const classroomSnap = await getDoc(classroomDocRef);
      if (classroomSnap.exists()) {
        const teacherId = classroomSnap.data().teacherId;
        setClassroomTeacherId(teacherId);
        // Security check: if user is loaded and is not the teacher, redirect them.
        if (user && user.uid !== teacherId) {
            toast({ variant: "destructive", title: "Access Denied", description: "You are not authorized to manage members for this class." });
            router.push(`/dashboard/class/${classId}?name=${encodeURIComponent(className)}`);
        }
      } else {
        toast({ variant: "destructive", title: "Error", description: "Class not found."});
        router.push("/dashboard/classes");
      }
    } catch (error) {
      console.error("Error fetching classroom teacherId:", error);
      toast({ variant: "destructive", title: "Error", description: "Could not verify class ownership."});
    }
  }, [classId, router, toast, user, className]);


  useEffect(() => {
    if (classId && user && !authLoading) {
        fetchClassroomTeacher();
    }
  }, [classId, user, authLoading, fetchClassroomTeacher]);

  useEffect(() => {
    if (!classId || !user || !classroomTeacherId) {
      setLoading(false);
      return; 
    }

    if (user.uid !== classroomTeacherId) {
        return; // Non-teachers should not set up listeners
    }
    
    setLoading(true);

    const membersUnsub = onSnapshot(
      query(collection(db, "classrooms", classId, "members")),
      (snapshot) => {
        const fetchedMembers: Member[] = [];
        snapshot.forEach(docSnap => {
          const data = docSnap.data();
          fetchedMembers.push({ 
            id: docSnap.id, 
            name: data.name, 
            avatarUrl: data.avatarUrl, 
            role: data.role,
            joinedAt: data.joinedAt?.toDate ? data.joinedAt.toDate() : new Date(data.joinedAt),
            email: data.email,
          });
        });
        setMembers(fetchedMembers.sort((a, b) => (a.role === 'teacher' ? -1 : b.role === 'teacher' ? 1 : 0) || a.name.localeCompare(b.name)));
        setLoading(false);
      }, (error) => {
        console.error("Error fetching members:", error);
        toast({ variant: "destructive", title: "Error", description: "Could not load members." });
        setLoading(false);
      }
    );
    
    // FIX: This listener will now only be set up if the current user is the teacher.
    const requestsUnsub = onSnapshot(
      query(collection(db, "classrooms", classId, "joinRequests")),
      (snapshot) => {
        const fetchedRequests: Member[] = [];
        snapshot.forEach(docSnap => {
          const data = docSnap.data();
          fetchedRequests.push({ 
            id: docSnap.id, 
            name: data.userName,
            avatarUrl: data.userAvatar, 
            role: 'student',
            requestedAt: data.requestedAt?.toDate ? data.requestedAt.toDate() : new Date(data.requestedAt),
            status: 'requested',
          });
        });
        setPendingRequests(fetchedRequests.sort((a,b) => (b.requestedAt?.getTime() || 0) - (a.requestedAt?.getTime() || 0) ));
      }, (error) => {
        console.error("Error fetching join requests:", error);
        toast({ variant: "destructive", title: "Error", description: "Could not load join requests." });
      }
    );

    return () => { membersUnsub(); requestsUnsub(); };
  }, [classId, classroomTeacherId, user, toast]);


  const openConfirmationDialog = (type: 'remove' | 'accept' | 'reject', member: Member) => {
    setActionToConfirm({ type, member });
    setIsConfirmDialogOpen(true);
  };

  const handleConfirmAction = async () => {
    if (!actionToConfirm || !classId || !user || user.uid !== classroomTeacherId) return;
    const { type, member } = actionToConfirm;
    
    const batch = writeBatch(db);

    try {
      if (type === 'remove') {
        if (member.role === 'teacher') {
          toast({ variant: "destructive", title: "Action Not Allowed", description: "Teachers cannot be removed this way." }); return;
        }
        const memberRef = doc(db, "classrooms", classId, "members", member.id);
        batch.delete(memberRef);
        await batch.commit();
        toast({ title: "Member Removed", description: `${member.name} has been removed from the class.` });
      } else if (type === 'accept') {
        const requestRef = doc(db, "classrooms", classId, "joinRequests", member.id);
        const memberRef = doc(db, "classrooms", classId, "members", member.id);
        
        batch.delete(requestRef);
        batch.set(memberRef, {
          userId: member.id,
          name: member.name,
          avatarUrl: member.avatarUrl,
          role: 'student',
          joinedAt: serverTimestamp(),
        });
        await batch.commit();
        toast({ title: "Request Accepted", description: `${member.name}'s request to join has been accepted.` });
      } else if (type === 'reject') {
        const requestRef = doc(db, "classrooms", classId, "joinRequests", member.id);
        batch.delete(requestRef);
        await batch.commit();
        toast({ title: "Request Rejected", description: `${member.name}'s request to join has been rejected.` });
      }
    } catch (error) {
      console.error(`Error performing action ${type}:`, error);
      toast({ variant: "destructive", title: "Action Failed", description: (error as Error).message });
    }

    setIsConfirmDialogOpen(false);
    setActionToConfirm(null);
  };


  if (loading || authLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground">Loading members for {className}...</p>
      </div>
    );
  }
  
  if (user && classroomTeacherId && user.uid !== classroomTeacherId) {
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
          <Link href={`/dashboard/class/${classId}?name=${encodeURIComponent(className)}`}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Class Details
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
                {member.role === 'student' && user?.uid === classroomTeacherId && (
                  <Button variant="ghost" size="sm" className="rounded-lg text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => openConfirmationDialog('remove', member)}>
                    <UserX className="mr-1.5 h-4 w-4" /> Remove
                  </Button>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {user?.uid === classroomTeacherId && (
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
      )}

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
