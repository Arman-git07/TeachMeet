
'use client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Trash2, Copy, Share2, Link as LinkIcon, Check, X } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { ShareOptionsPanel } from "@/components/common/ShareOptionsPanel";
import { useAuth } from "@/hooks/useAuth";


const mockMembers = [
    { id: 'user1', name: 'Alex Johnson', email: 'alex@example.com', role: 'Student' },
    { id: 'user2', name: 'Bethany Smith', email: 'bethany@example.com', role: 'Student' },
    { id: 'user3', name: 'Carlos Gomez', email: 'carlos@example.com', role: 'Student' },
];

const initialMockJoinRequests = [
    { id: 'user4', name: 'Diana Prince', email: 'diana@example.com' },
    { id: 'user5', name: 'Bruce Wayne', email: 'bruce@example.com' },
];

// Mock class name for the share panel. In a real app, this would be fetched.
const mockClassName = "Algebra 101";

// In a real app, this ID would come from the class data.
const mockTeacherId = "teacher-evelyn-reed-uid";

export default function ManageMembersPage() {
    const params = useParams();
    const classId = params.classId as string;
    const [isSharePanelOpen, setIsSharePanelOpen] = useState(false);
    const [joinRequests, setJoinRequests] = useState(initialMockJoinRequests);
    const { toast } = useToast();
    const { user: currentUser } = useAuth();

    // Check if the current user is the host/teacher.
    const isHost = currentUser?.uid === mockTeacherId;
    
    // Construct a mock invite link. In a real app, this might be a specific invite route.
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

    const handleRequestAction = (requestId: string, approved: boolean, studentName: string) => {
        setJoinRequests(currentRequests => currentRequests.filter(req => req.id !== requestId));
        toast({
            title: `Request ${approved ? 'Approved' : 'Denied'}`,
            description: `${studentName} has been ${approved ? 'added to' : 'denied access to'} the class.`,
        });
        // In a real app, you would also update the members list if approved.
    };

    return (
        <>
            <div className="space-y-8">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-foreground">Manage Members</h1>
                        <p className="text-muted-foreground">Invite new members and manage existing ones.</p>
                    </div>
                     <Button asChild variant="outline" className="rounded-lg">
                        <Link href={`/dashboard/class/${classId}`}>
                            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Class
                        </Link>
                    </Button>
                </div>
                
                <Card className="rounded-xl shadow-lg border-border/50">
                    <CardHeader>
                        <CardTitle>Invite New Members</CardTitle>
                        <CardDescription>Share this link to invite students to join the class.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                         <div className="flex items-center space-x-2">
                            <div className="relative flex-grow">
                                <LinkIcon className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                                <Input
                                    id="inviteLink"
                                    type="text"
                                    readOnly
                                    value={inviteLink || "Generating link..."}
                                    className="pl-10 rounded-lg bg-muted"
                                    aria-label="Class Invite Link"
                                />
                            </div>
                            <Button variant="outline" size="icon" onClick={handleCopyLink} aria-label="Copy link" className="rounded-lg flex-shrink-0">
                                <Copy className="h-5 w-5" />
                            </Button>
                        </div>
                        <Button onClick={() => setIsSharePanelOpen(true)} className="w-full btn-gel rounded-lg">
                            <Share2 className="mr-2 h-4 w-4" /> Share Invite
                        </Button>
                    </CardContent>
                </Card>

                {isHost && joinRequests.length > 0 && (
                    <Card className="rounded-xl shadow-lg border-primary/30">
                        <CardHeader>
                            <CardTitle>Pending Join Requests ({joinRequests.length})</CardTitle>
                            <CardDescription>Approve or deny requests from students to join this class.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                {joinRequests.map(request => (
                                    <div key={request.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50">
                                        <div className="flex items-center gap-3">
                                            <Avatar className="h-10 w-10">
                                                <AvatarImage src={`https://placehold.co/40x40.png?text=${request.name.charAt(0)}`} alt={request.name} data-ai-hint="avatar student"/>
                                                <AvatarFallback>{request.name.charAt(0)}</AvatarFallback>
                                            </Avatar>
                                            <div>
                                                <p className="font-semibold">{request.name}</p>
                                                <p className="text-sm text-muted-foreground">{request.email}</p>
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            <Button variant="outline" size="sm" className="rounded-lg border-green-500/50 text-green-600 hover:bg-green-500/10 hover:text-green-700" onClick={() => handleRequestAction(request.id, true, request.name)}>
                                                <Check className="mr-2 h-4 w-4" /> Approve
                                            </Button>
                                            <Button variant="destructive" size="sm" className="rounded-lg" onClick={() => handleRequestAction(request.id, false, request.name)}>
                                                <X className="mr-2 h-4 w-4" /> Deny
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                )}

                <Card className="rounded-xl shadow-lg border-border/50">
                    <CardHeader>
                        <CardTitle>Current Members ({mockMembers.length})</CardTitle>
                        <CardDescription>List of all students currently enrolled in this class.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {mockMembers.map(member => (
                                <div key={member.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50">
                                    <div className="flex items-center gap-3">
                                        <Avatar className="h-10 w-10">
                                            <AvatarImage src={`https://placehold.co/40x40.png?text=${member.name.charAt(0)}`} alt={member.name} data-ai-hint="avatar student"/>
                                            <AvatarFallback>{member.name.charAt(0)}</AvatarFallback>
                                        </Avatar>
                                        <div>
                                            <p className="font-semibold">{member.name}</p>
                                            <p className="text-sm text-muted-foreground">{member.email}</p>
                                        </div>
                                    </div>
                                    {isHost && (
                                        <Button variant="ghost" size="icon" className="text-destructive rounded-lg">
                                            <Trash2 className="h-4 w-4"/>
                                        </Button>
                                    )}
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>
            <ShareOptionsPanel
                isOpen={isSharePanelOpen}
                onClose={() => setIsSharePanelOpen(false)}
                meetingLink={inviteLink}
                meetingTitle={`Invitation to join class: ${mockClassName}`}
            />
        </>
    );
}
