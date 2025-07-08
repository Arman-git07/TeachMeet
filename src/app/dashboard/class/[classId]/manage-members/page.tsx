
'use client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { UserPlus, ArrowLeft, Trash2, Mail } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";

const mockMembers = [
    { id: 'user1', name: 'Alex Johnson', email: 'alex@example.com', role: 'Student' },
    { id: 'user2', name: 'Bethany Smith', email: 'bethany@example.com', role: 'Student' },
    { id: 'user3', name: 'Carlos Gomez', email: 'carlos@example.com', role: 'Student' },
];

export default function ManageMembersPage() {
    const params = useParams();
    const classId = params.classId as string;

    return (
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
                    <CardDescription>Enter email addresses to invite new students to this class.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex gap-2">
                        <Input type="email" placeholder="student@example.com" className="rounded-lg" />
                        <Button className="btn-gel rounded-lg">
                            <UserPlus className="mr-2 h-4 w-4"/> Invite
                        </Button>
                    </div>
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
    );
}
