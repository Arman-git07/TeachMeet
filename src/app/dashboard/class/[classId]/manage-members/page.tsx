
'use client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Trash2, Copy, Share2, Link as LinkIcon, Check, X, Users, Loader2 } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { ShareOptionsPanel } from "@/components/common/ShareOptionsPanel";
import { useAuth } from "@/hooks/useAuth";
import { db } from "@/lib/firebase";
import { collection, doc, onSnapshot, writeBatch, getDoc, deleteDoc } from "firebase/firestore";
import { Skeleton } from "@/components/ui/skeleton";

interface Member {
    id: string;
    name: string;
    email: string;
    role: 'Student' | 'Host';
}

interface JoinRequest {
    id: string;
    name: string;
    email: string;
}

export default function ManageMembersPage() {
    const params = useParams();
    const router = useRouter();
    const classId = params.classId as string;
    const { user: currentUser } = useAuth();
    const { toast } = useToast();

    const [isSharePanelOpen, setIsSharePanelOpen] = useState(false);
    const [joinRequests, setJoinRequests] = useState<JoinRequest[]>([]);
    const [members, setMembers] = useState<Member[]>([]);
    const [className, setClassName] = useState('');
    const [isHost, setIsHost] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!classId || !currentUser) return;
        
        const classDocRef = doc(db, "classes", classId);
        const unsubs: (() => void)[] = [];

        unsubs.push(onSnapshot(classDocRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                setClassName(data.name || '');
                setIsHost(data.creatorId === currentUser.uid);
            } else {
                toast({ variant: 'destructive', title: 'Error', description: 'Class not found.'});
                router.push('/dashboard/classes');
            }
        }));

        unsubs.push(onSnapshot(collection(db, "classes", classId, "members"), (snapshot) => {
            const fetchedMembers: Member[] = [];
            snapshot.forEach(doc => fetchedMembers.push({ id: doc.id, ...doc.data() } as Member));
            setMembers(fetchedMembers);
            setIsLoading(false);
        }));

        if (isHost) {
            unsubs.push(onSnapshot(collection(db, "classes", classId, "joinRequests"), (snapshot) => {
                const fetchedRequests: JoinRequest[] = [];
                snapshot.forEach(doc => fetchedRequests.push({ id: doc.id, ...doc.data() } as JoinRequest));
                setJoinRequests(fetchedRequests);
            }));
        }

        return () => unsubs.forEach(unsub => unsub());

    }, [classId, currentUser, isHost, router, toast]);

    const inviteLink = typeof window !== 'undefined' ? `${window.location.origin}/dashboard/class/${classId}/join` : '';

    const handleCopyLink = () => {
        if (!inviteLink) return;
        navigator.clipboard.writeText(inviteLink).then(() => {
            toast({ title: "Link Copied!", description: "Class invite link copied to clipboard." });
        }).catch(err => {
            console.error('Failed to copy link: ', err);
            toast({ variant: "destructive", title: "Copy Failed", description: "Could not copy the link." });
        });
    };

    const handleRequestAction = async (request: JoinRequest, approved: boolean) => {
        const { id: userId, name: studentName } = request;
        const batch = writeBatch(db);
        
        const requestRef = doc(db, "classes", classId, "joinRequests", userId);
        batch.delete(requestRef);

        if (approved) {
            const memberRef = doc(db, "classes", classId, "members", userId);
            batch.set(memberRef, {
                name: request.name,
                email: request.email,
                role: 'Student'
            });
        }
        
        try {
            await batch.commit();
            toast({
                title: `Request ${approved ? 'Approved' : 'Denied'}`,
                description: `${studentName} has been ${approved ? 'added to' : 'denied access to'} the class.`,
            });
        } catch (error) {
            console.error("Error processing join request:", error);
            toast({ variant: "destructive", title: "Error", description: "Could not process the request." });
        }
    };
    
    const handleRemoveMember = async (memberId: string, memberName: string) => {
        const memberDocRef = doc(db, "classes", classId, "members", memberId);
        try {
            await deleteDoc(memberDocRef);
            toast({ title: "Member Removed", description: `${memberName} has been removed from the class.` });
        } catch (error) {
            console.error("Error removing member:", error);
            toast({ variant: "destructive", title: "Error", description: `Could not remove ${memberName}.` });
        }
    };

    if (isLoading) {
        return (
            <div className="space-y-8">
                <Skeleton className="h-12 w-1/2" />
                <Skeleton className="h-32 w-full" />
                <Skeleton className="h-48 w-full" />
                <Skeleton className="h-64 w-full" />
            </div>
        )
    }

    return (
        <>
            <div className="space-y-8">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-foreground">Manage Members</h1>
                        <p className="text-muted-foreground">Invite new members and manage existing ones.</p>
                    </div>
                     <Button asChild variant="outline" className="rounded-lg">
                        <Link href={`/dashboard/class/${classId}`}><ArrowLeft className="mr-2 h-4 w-4" /> Back to Class</Link>
                    </Button>
                </div>
                
                <Card className="rounded-xl shadow-lg border-border/50">
                    <CardHeader><CardTitle>Invite New Members</CardTitle><CardDescription>Share this link to invite students to join the class.</CardDescription></CardHeader>
                    <CardContent className="space-y-4">
                         <div className="flex items-center space-x-2">
                            <div className="relative flex-grow">
                                <LinkIcon className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                                <Input id="inviteLink" type="text" readOnly value={inviteLink || "Generating link..."} className="pl-10 rounded-lg bg-muted" aria-label="Class Invite Link" />
                            </div>
                            <Button variant="outline" size="icon" onClick={handleCopyLink} aria-label="Copy link" className="rounded-lg flex-shrink-0"><Copy className="h-5 w-5" /></Button>
                        </div>
                        <Button onClick={() => setIsSharePanelOpen(true)} className="w-full btn-gel rounded-lg"><Share2 className="mr-2 h-4 w-4" /> Share Invite</Button>
                    </CardContent>
                </Card>

                {isHost && (
                    <Card className="rounded-xl shadow-lg border-primary/30">
                        <CardHeader><CardTitle>Pending Join Requests ({joinRequests.length})</CardTitle><CardDescription>Approve or deny requests from students to join this class.</CardDescription></CardHeader>
                        <CardContent>
                            {joinRequests.length > 0 ? (
                                <div className="space-y-4">
                                    {joinRequests.map(request => (
                                        <div key={request.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50">
                                            <div className="flex items-center gap-3">
                                                <Avatar className="h-10 w-10"><AvatarImage src={`https://placehold.co/40x40.png?text=${request.name.charAt(0)}`} alt={request.name} data-ai-hint="avatar student"/><AvatarFallback>{request.name.charAt(0)}</AvatarFallback></Avatar>
                                                <div><p className="font-semibold">{request.name}</p><p className="text-sm text-muted-foreground">{request.email}</p></div>
                                            </div>
                                            <div className="flex gap-2">
                                                <Button variant="outline" size="sm" className="rounded-lg border-green-500/50 text-green-600 hover:bg-green-500/10 hover:text-green-700" onClick={() => handleRequestAction(request, true)}><Check className="mr-2 h-4 w-4" /> Approve</Button>
                                                <Button variant="destructive" size="sm" className="rounded-lg" onClick={() => handleRequestAction(request, false)}><X className="mr-2 h-4 w-4" /> Deny</Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-8 text-muted-foreground flex flex-col items-center gap-2">
                                    <Users className="h-12 w-12" /><p>There are no pending join requests.</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                )}

                <Card className="rounded-xl shadow-lg border-border/50">
                    <CardHeader><CardTitle>Current Members ({members.length})</CardTitle><CardDescription>List of all students currently enrolled in this class.</CardDescription></CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {members.map(member => (
                                <div key={member.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50">
                                    <div className="flex items-center gap-3">
                                        <Avatar className="h-10 w-10"><AvatarImage src={`https://placehold.co/40x40.png?text=${member.name.charAt(0)}`} alt={member.name} data-ai-hint="avatar student"/><AvatarFallback>{member.name.charAt(0)}</AvatarFallback></Avatar>
                                        <div>
                                            <p className="font-semibold">{member.name}</p>
                                            <p className="text-sm text-muted-foreground">{member.email}</p>
                                        </div>
                                    </div>
                                    {isHost && member.id !== currentUser?.uid && (
                                        <Button variant="ghost" size="icon" className="text-destructive rounded-lg" onClick={() => handleRemoveMember(member.id, member.name)}>
                                            <Trash2 className="h-4 w-4"/>
                                        </Button>
                                    )}
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>
            <ShareOptionsPanel isOpen={isSharePanelOpen} onClose={() => setIsSharePanelOpen(false)} meetingLink={inviteLink} meetingTitle={`Invitation to join class: ${className}`} />
        </>
    );
}
