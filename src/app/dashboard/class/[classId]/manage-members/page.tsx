
'use client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Trash2, Copy, Share2, Link as LinkIcon } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { ShareOptionsPanel } from "@/components/common/ShareOptionsPanel";


const mockMembers = [
    { id: 'user1', name: 'Alex Johnson', email: 'alex@example.com', role: 'Student' },
    { id: 'user2', name: 'Bethany Smith', email: 'bethany@example.com', role: 'Student' },
    { id: 'user3', name: 'Carlos Gomez', email: 'carlos@example.com', role: 'Student' },
];

// Mock class name for the share panel. In a real app, this would be fetched.
const mockClassName = "Algebra 101";

export default function ManageMembersPage() {
    const params = useParams();
    const classId = params.classId as string;
    const [isSharePanelOpen, setIsSharePanelOpen] = useState(false);
    const { toast } = useToast();
    
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
                            <Share2 className="mr-2 h-4 w-4" /> Share Invite Options
                        </Button>
                    </CardContent>
                </Card>

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
                                    <Button variant="ghost" size="icon" className="text-destructive rounded-lg">
                                        <Trash2 className="h-4 w-4"/>
                                    </Button>
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
