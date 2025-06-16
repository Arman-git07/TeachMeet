
// src/app/dashboard/class/[classId]/manage-members/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link'; // Added missing import
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ArrowLeft, Users, UserCheck, UserX, ShieldCheck, Loader2, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from '@/hooks/useAuth';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { cn } from '@/lib/utils';

interface Member {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  role: 'student' | 'teacher';
  status: 'member' | 'requested';
}

const getMockMembersForClass = (classId: string, teacherId?: string, teacherName?: string, teacherAvatar?: string): Member[] => {
  const baseMembers: Member[] = [
    { id: "student1", name: "Alice Wonderland", email: "alice@example.com", role: "student", status: "member", avatarUrl: `https://placehold.co/40x40.png?text=AW` },
    { id: "student2", name: "Bob The Builder", email: "bob@example.com", role: "student", status: "member", avatarUrl: `https://placehold.co/40x40.png?text=BB` },
    { id: "student3", name: "Charlie Brown", email: "charlie@example.com", role: "student", status: "member", avatarUrl: `https://placehold.co/40x40.png?text=CB` },
    { id: "request1", name: "Diana Prince", email: "diana@example.com", role: "student", status: "requested", avatarUrl: `https://placehold.co/40x40.png?text=DP` },
    { id: "request2", name: "Edward Scissorhands", email: "edward@example.com", role: "student", status: "requested", avatarUrl: `https://placehold.co/40x40.png?text=ES` },
  ];
  if (teacherId && teacherName) {
    baseMembers.unshift({
      id: teacherId,
      name: teacherName,
      email: "teacher@example.com", // Mock email for teacher
      role: "teacher",
      status: "member",
      avatarUrl: teacherAvatar || `https://placehold.co/40x40.png?text=${teacherName.charAt(0)}`,
    });
  }
  return baseMembers.map(m => ({ ...m, id: `${m.id}-${classId}`})); // Ensure unique IDs for demo
};

export default function ManageMembersPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();

  const classId = params.classId as string;
  const className = searchParams.get('name') || "Class";

  const [allMembers, setAllMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
  const [actionToConfirm, setActionToConfirm] = useState<{ type: 'remove' | 'accept' | 'reject'; member: Member } | null>(null);

  useEffect(() => {
    if (classId && user && !authLoading) {
      setLoading(true);
      setTimeout(() => {
        // Simulate fetching members based on classId
        // In a real app, this would be a Firestore query
        const fetchedMembers = getMockMembersForClass(classId, user.uid, user.displayName || "Teacher", user.photoURL || undefined);
        setAllMembers(fetchedMembers);
        setLoading(false);
      }, 500);
    }
  }, [classId, user, authLoading]);

  const openConfirmationDialog = (type: 'remove' | 'accept' | 'reject', member: Member) => {
    setActionToConfirm({ type, member });
    setIsConfirmDialogOpen(true);
  };

  const handleConfirmAction = () => {
    if (!actionToConfirm) return;

    const { type, member } = actionToConfirm;

    if (type === 'remove') {
      setAllMembers(prev => prev.filter(m => m.id !== member.id));
      toast({ title: "Member Removed", description: `${member.name} has been removed from the class.` });
    } else if (type === 'accept') {
      setAllMembers(prev => prev.map(m => m.id === member.id ? { ...m, status: 'member' } : m));
      toast({ title: "Request Accepted", description: `${member.name}'s request to join has been accepted.` });
    } else if (type === 'reject') {
      setAllMembers(prev => prev.filter(m => m.id !== member.id)); // Remove from pending list
      toast({ title: "Request Rejected", description: `${member.name}'s request to join has been rejected.` });
    }

    setIsConfirmDialogOpen(false);
    setActionToConfirm(null);
  };

  const currentMembers = allMembers.filter(m => m.status === 'member');
  const pendingRequests = allMembers.filter(m => m.status === 'requested');

  if (loading || authLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground">Loading members for {className}...</p>
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

      {/* Current Members Section */}
      <Card className="rounded-xl shadow-lg border-border/50 flex-grow flex flex-col">
        <CardHeader>
          <CardTitle className="flex items-center text-lg"><ShieldCheck className="mr-2 h-5 w-5 text-primary" />Current Members ({currentMembers.length})</CardTitle>
          <CardDescription>Students and teachers currently in this class.</CardDescription>
        </CardHeader>
        <CardContent className="flex-grow space-y-2 overflow-y-auto p-3">
          {currentMembers.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">No active members in this class yet.</p>
          ) : (
            currentMembers.map(member => (
              <div key={member.id} className="flex items-center justify-between p-2.5 hover:bg-muted/50 rounded-lg transition-colors">
                <div className="flex items-center gap-3">
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={member.avatarUrl} alt={member.name} data-ai-hint="user avatar"/>
                    <AvatarFallback>{member.name.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-medium text-foreground">{member.name} {member.role === 'teacher' && <span className="text-xs text-primary ml-1">(Host)</span>}</p>
                    <p className="text-xs text-muted-foreground">{member.email}</p>
                  </div>
                </div>
                {member.role === 'student' && user?.uid !== member.id && (
                  <Button variant="ghost" size="sm" className="rounded-lg text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => openConfirmationDialog('remove', member)}>
                    <UserX className="mr-1.5 h-4 w-4" /> Remove
                  </Button>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Pending Requests Section */}
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
                    <p className="text-xs text-muted-foreground">{request.email}</p>
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
