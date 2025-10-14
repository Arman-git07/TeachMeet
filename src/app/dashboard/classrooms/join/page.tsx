
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { doc, setDoc, serverTimestamp, getDoc, writeBatch } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Search, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

interface FoundClassroom {
    id: string;
    title: string;
    teacherName: string;
}

export default function JoinClassroomPage() {
    const [classCode, setClassCode] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [foundClassroom, setFoundClassroom] = useState<FoundClassroom | null>(null);
    const [isJoining, setIsJoining] = useState(false);

    const { user } = useAuth();
    const { toast } = useToast();
    const router = useRouter();
    
    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!classCode.trim()) {
            toast({ variant: 'destructive', title: 'Please enter a class code.' });
            return;
        }
        setIsLoading(true);
        setFoundClassroom(null);
        
        try {
            const classroomRef = doc(db, 'classrooms', classCode.trim());
            const docSnap = await getDoc(classroomRef);

            if (docSnap.exists()) {
                const data = docSnap.data();
                if (data.teacherId === user?.uid) {
                    toast({ title: "You are the teacher of this class." });
                    router.push(`/dashboard/classrooms/${docSnap.id}`);
                    return;
                }
                setFoundClassroom({
                    id: docSnap.id,
                    title: data.title,
                    teacherName: data.teacherName
                });
            } else {
                toast({ variant: 'destructive', title: 'Not Found', description: 'No public classroom found with that code.' });
            }
        } catch (error) {
            console.error("Error searching for classroom:", error);
            toast({ variant: 'destructive', title: 'Search Error', description: 'An error occurred while searching.' });
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleJoinRequest = async () => {
        if (!user || !foundClassroom) return;
        setIsJoining(true);
        
        try {
            const batch = writeBatch(db);
            const requestRef = doc(db, `classrooms/${foundClassroom.id}/joinRequests`, user.uid);
            batch.set(requestRef, {
                studentId: user.uid, // Use studentId to match security rules
                studentName: user.displayName || 'Anonymous Student',
                studentPhotoURL: user.photoURL || '',
                role: 'student', // Assuming student role for this join page
                status: 'pending',
                requestedAt: serverTimestamp()
            });

            // Also create a document in the user's subcollection to track their pending requests
            const userPendingRequestRef = doc(db, `users/${user.uid}/pendingJoinRequests`, foundClassroom.id);
            batch.set(userPendingRequestRef, { 
                classroomId: foundClassroom.id, 
                classroomTitle: foundClassroom.title,
                requestedAt: serverTimestamp() 
            });
            
            await batch.commit();
            
            toast({ title: 'Request Sent!', description: 'Your request to join has been sent to the teacher.' });
            router.push('/dashboard/classrooms');
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
                    <CardTitle>Join a Classroom</CardTitle>
                    <CardDescription>Enter the code provided by your teacher to find and join a class.</CardDescription>
                </CardHeader>
                <form onSubmit={handleSearch}>
                    <CardContent className="space-y-4">
                        <div>
                            <Label htmlFor="class-code">Class Code</Label>
                            <div className="flex gap-2">
                                <Input 
                                    id="class-code" 
                                    placeholder="Enter code..."
                                    value={classCode}
                                    onChange={(e) => setClassCode(e.target.value)}
                                    disabled={isLoading}
                                />
                                <Button type="submit" disabled={isLoading}>
                                    {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                                </Button>
                            </div>
                        </div>

                        {foundClassroom && (
                             <Card className="bg-muted/50 p-4">
                                <CardTitle className="text-lg">{foundClassroom.title}</CardTitle>
                                <CardDescription>Taught by {foundClassroom.teacherName}</CardDescription>
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
                        <Link href="/dashboard/classrooms"><ArrowLeft className="mr-2 h-4 w-4"/> Cancel</Link>
                    </Button>
                </CardFooter>
            </Card>
        </div>
    );
}
