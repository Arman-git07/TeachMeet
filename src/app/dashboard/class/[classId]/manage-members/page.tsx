
'use client';

import { use, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { UserPlus, Trash2, ShieldCheck, ArrowLeft, Mail, Search } from "lucide-react";
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

interface Member {
    id: string;
    name: string;
    email: string;
    role: 'Teacher' | 'Student';
    avatarUrl: string;
}

// Mock data
const mockMembers: Member[] = [
    { id: 'usr1', name: 'Dr. Alan Grant', email: 'alan.g@teachmeet.com', role: 'Teacher', avatarUrl: 'https://placehold.co/40x40/3498DB/FFFFFF.png?text=AG' },
    { id: 'usr2', name: 'Ellie Sattler', email: 'ellie.s@teachmeet.com', role: 'Student', avatarUrl: 'https://placehold.co/40x40/E74C3C/FFFFFF.png?text=ES' },
    { id: 'usr3', name: 'Ian Malcolm', email: 'ian.m@teachmeet.com', role: 'Student', avatarUrl: 'https://placehold.co/40x40/2ECC71/FFFFFF.png?text=IM' },
    { id: 'usr4', name: 'John Hammond', email: 'john.h@teachmeet.com', role: 'Student', avatarUrl: 'https://placehold.co/40x40/F1C40F/FFFFFF.png?text=JH' },
];

export default function ManageMembersPage({ params: paramsPromise }: { params: Promise<{ classId: string }> }) {
    const { classId } = use(paramsPromise);
    const [members, setMembers] = useState<Member[]>(mockMembers);
    const [searchQuery, setSearchQuery] = useState('');
    const { toast } = useToast();

    const filteredMembers = members.filter(member =>
        member.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        member.email.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const handleRemoveMember = (memberId: string) => {
        const memberToRemove = members.find(m => m.id === memberId);
        setMembers(prev => prev.filter(m => m.id !== memberId));
        toast({
            title: "Member Removed (Mock)",
            description: `${memberToRemove?.name} has been removed from the class.`,
        });
    };
    
    const handleAddMember = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        const email = formData.get('email') as string;
        if (email) {
            toast({
                title: 'Invite Sent (Mock)',
                description: `An invitation has been sent to ${email}.`,
            });
            event.currentTarget.reset();
        }
    };

    return (
         <div className="container mx-auto py-8">
            <Card className="max-w-4xl mx-auto shadow-lg rounded-xl border-border/50">
                <CardHeader>
                    <div className="flex justify-between items-center">
                        <div className="space-y-1">
                            <CardTitle className="text-2xl">Manage Class Members</CardTitle>
                            <CardDescription>Invite, remove, and manage roles for class members.</CardDescription>
                        </div>
                         <Button asChild variant="outline" size="sm" className="rounded-lg">
                           <Link href={`/dashboard/class/${classId}`}>
                               <ArrowLeft className="mr-2 h-4 w-4" />
                               Back to Class
                           </Link>
                        </Button>
                    </div>
                </CardHeader>
                <CardContent className="space-y-6">
                    {/* Add Member Form */}
                    <form onSubmit={handleAddMember}>
                         <fieldset className="border p-4 rounded-lg">
                            <legend className="text-lg font-semibold px-2">Invite New Member</legend>
                            <div className="flex flex-col sm:flex-row gap-2 items-end">
                                <div className="relative flex-grow w-full">
                                    <Mail className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                                    <Input name="email" type="email" placeholder="Enter email address to invite..." className="pl-10 rounded-lg w-full" required />
                                </div>
                                <Button type="submit" className="btn-gel rounded-lg w-full sm:w-auto">
                                    <UserPlus className="mr-2 h-4 w-4" /> Invite
                                </Button>
                            </div>
                        </fieldset>
                    </form>

                    {/* Members List */}
                    <div>
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-xl font-semibold">Current Members ({members.length})</h3>
                             <div className="relative w-full max-w-xs">
                                <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                                <Input 
                                    placeholder="Search members..." 
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="pl-10 rounded-lg"
                                />
                            </div>
                        </div>
                        <ScrollArea className="h-[400px] border rounded-lg">
                            <div className="divide-y">
                                {filteredMembers.map(member => (
                                    <div key={member.id} className="flex items-center justify-between p-4 hover:bg-muted/50">
                                        <div className="flex items-center gap-3">
                                            <Avatar className="h-10 w-10">
                                                <AvatarImage src={member.avatarUrl} alt={member.name} data-ai-hint="avatar user"/>
                                                <AvatarFallback>{member.name.charAt(0)}</AvatarFallback>
                                            </Avatar>
                                            <div>
                                                <p className="font-medium text-foreground">{member.name}</p>
                                                <p className="text-sm text-muted-foreground">{member.email}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Badge variant={member.role === 'Teacher' ? 'default' : 'secondary'}>
                                                {member.role === 'Teacher' && <ShieldCheck className="mr-1 h-3 w-3" />}
                                                {member.role}
                                            </Badge>
                                            {member.role !== 'Teacher' && (
                                                <Button 
                                                    variant="ghost" 
                                                    size="icon" 
                                                    className="text-destructive rounded-full h-8 w-8"
                                                    onClick={() => handleRemoveMember(member.id)}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                                {filteredMembers.length === 0 && (
                                    <p className="p-4 text-center text-muted-foreground">No members match your search.</p>
                                )}
                            </div>
                        </ScrollArea>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
