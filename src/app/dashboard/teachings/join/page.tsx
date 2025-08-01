
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { doc, setDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Search, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

interface FoundTeaching {
    id: string;
    title: string;
    teacherName: string;
}

export default function JoinTeachingPage() {
    const [teachingCode, setTeachingCode] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [foundTeaching, setFoundTeaching] = useState<FoundTeaching | null>(null);
    const [isJoining, setIsJoining] = useState(false);

    const { user } = useAuth();
    const { toast } = useToast();
    const router = useRouter();
    
    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!teachingCode.trim()) {
            toast({ variant: 'destructive', title: 'Please enter a teaching code.' });
            return;
        }
        setIsLoading(true);
        setFoundTeaching(null);
        
        try {
            const teachingRef = doc(db, 'teachings', teachingCode.trim());
            const docSnap = await getDoc(teachingRef);

            if (docSnap.exists()) {
                const data = docSnap.data();
                if (data.teacherId === user?.uid) {
                    toast({ title: "You are the teacher of this teaching." });
                    router.push(`/dashboard/teachings/${docSnap.id}`);
                    return;
                }
                setFoundTeaching({
                    id: docSnap.id,
                    title: data.title,
                    teacherName: data.teacherName
                });
            } else {
                toast({ variant: 'destructive', title: 'Not Found', description: 'No public teaching found with that code.' });
            }
        } catch (error) {
            console.error("Error searching for teaching:", error);
            toast({ variant: 'destructive', title: 'Search Error', description: 'An error occurred while searching.' });
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleJoinRequest = async () => {
        if (!user || !foundTeaching) return;
        setIsJoining(true);
        
        try {
            const requestRef = doc(db, `teachings/${foundTeaching.id}/joinRequests`, user.uid);
            
            await setDoc(requestRef, {
                studentId: user.uid,
                studentName: user.displayName || 'Anonymous Student',
                studentPhotoURL: user.photoURL || '',
                status: 'pending',
                requestedAt: serverTimestamp()
            });
            
            toast({ title: 'Request Sent!', description: 'Your request to join has been sent to the teacher.' });
            router.push('/dashboard/teachings');
        } catch (error) {
            console.error("Error sending join request:", error);
            toast({ variant: 'destructive', title: 'Request Failed', description: 'Could not send join request. Check console for permissions errors.' });
        } finally {
            setIsJoining(false);
        }
    };

    return (
        <div className="container mx-auto flex flex-1 flex-col items-center justify-center p-4">
            <Card className="w-full max-w-md shadow-xl rounded-xl border-border/50">
                <CardHeader>
                    <CardTitle>Join a Teaching</CardTitle>
                    <CardDescription>Enter the code provided by your teacher to find and join a teaching.</CardDescription>
                </CardHeader>
                <form onSubmit={handleSearch}>
                    <CardContent className="space-y-4">
                        <div>
                            <Label htmlFor="teaching-code">Teaching Code</Label>
                            <div className="flex gap-2">
                                <Input 
                                    id="teaching-code" 
                                    placeholder="Enter code..."
                                    value={teachingCode}
                                    onChange={(e) => setTeachingCode(e.target.value)}
                                    disabled={isLoading}
                                />
                                <Button type="submit" disabled={isLoading}>
                                    {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                                </Button>
                            </div>
                        </div>

                        {foundTeaching && (
                             <Card className="bg-muted/50 p-4">
                                <CardTitle className="text-lg">{foundTeaching.title}</CardTitle>
                                <CardDescription>Taught by {foundTeaching.teacherName}</CardDescription>
                                <Button className="w-full mt-4" onClick={handleJoinRequest} disabled={isJoining}>
                                    {isJoining ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null}
                                    Request to Join
                                </Button>
                            </Card>
                        )}
                    </CardContent>
                </form>
                <CardFooter>
                    <Button variant="link" asChild className="text-muted-foreground">
                        <Link href="/dashboard/teachings"><ArrowLeft className="mr-2 h-4 w-4"/> Cancel</Link>
                    </Button>
                </CardFooter>
            </Card>
        </div>
    );
}
