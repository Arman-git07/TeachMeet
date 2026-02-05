'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { collection, query, onSnapshot, orderBy, doc, writeBatch, arrayUnion, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useClassroom } from '@/contexts/ClassroomContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Loader2, Check, X, ArrowLeft } from 'lucide-react';
import type { JoinRequest } from '@/app/dashboard/classrooms/[classroomId]/page';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
  DialogClose,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

export default function JoinRequestsPage() {
    const { classroomId, classroom, user } = useClassroom();
    const router = useRouter();
    const { toast } = useToast();
    const [joinRequests, setJoinRequests] = useState<JoinRequest[]>([]);
    const [isProcessing, setIsProcessing] = useState<string | null>(null);

    // Interview workflow states
    const [selectedRequest, setSelectedRequest] = useState<JoinRequest | null>(null);
    const [isInterviewDialogOpen, setIsInterviewDialogOpen] = useState(false);
    const [interviewDate, setInterviewDate] = useState('');

    useEffect(() => {
        if (!classroomId) return;
        const q = query(collection(db, `classrooms/${classroomId}/joinRequests`), orderBy('requestedAt', 'desc'));
        const unsubscribe = onSnapshot(q, (snap) => {
            setJoinRequests(snap.docs.map(d => ({ id: d.id, ...d.data() } as JoinRequest)));
        });
        return unsubscribe;
    }, [classroomId]);

    const studentRequests = useMemo(() => joinRequests.filter(req => req.role === 'student'), [joinRequests]);
    const teacherRequests = useMemo(() => joinRequests.filter(req => req.role === 'teacher'), [joinRequests]);

    const handleRequest = useCallback(async (request: JoinRequest, action: 'approve' | 'deny') => {
        if (!classroomId || !request.requesterId || !user) {
            toast({ variant: 'destructive', title: 'Error', description: 'Missing required data or not authenticated.' });
            return;
        }

        setIsProcessing(request.id);
        const batch = writeBatch(db);

        try {
            if (action === 'deny') {
                batch.delete(doc(db, `classrooms/${classroomId}/joinRequests`, request.id));
                batch.delete(doc(db, `users/${request.requesterId}/pendingJoinRequests`, classroomId));
                toast({ title: 'Request Denied' });
            } else { // Approve
                batch.set(doc(db, `classrooms/${classroomId}/participants`, request.requesterId), {
                    uid: request.requesterId, name: request.studentName, photoURL: request.studentPhotoURL || '', role: request.role, joinedAt: serverTimestamp(),
                });

                const classroomRef = doc(db, 'classrooms', classroomId);
                if (request.role === 'teacher') {
                     batch.update(classroomRef, { teachers: arrayUnion({ uid: request.requesterId, name: request.studentName, photoURL: request.studentPhotoURL || "" }) });
                     batch.set(doc(db, `classrooms/${classroomId}/teachers`, request.requesterId), { uid: request.requesterId, name: request.studentName, ...request.applicationData, addedAt: serverTimestamp() });
                } else { // Is a student
                    batch.update(classroomRef, { students: arrayUnion(request.requesterId) });
                    
                    // Add automatic welcome announcement for students
                    if (classroom) {
                        const announcementRef = doc(collection(db, `classrooms/${classroomId}/announcements`));
                        const vanishAt = new Date();
                        vanishAt.setHours(vanishAt.getHours() + 1);

                        batch.set(announcementRef, {
                            text: `Hi ${request.studentName}, welcome to "${classroom.title}"!`,
                            type: 'text',
                            creatorName: 'System',
                            creatorId: user.uid, // The user performing the action
                            authorId: user.uid,  // The user performing the action, for security rules
                            createdAt: serverTimestamp(),
                            vanishAt: vanishAt,
                        });
                    }
                }

                if (classroom) {
                    batch.set(doc(db, `users/${request.requesterId}/enrolled`, classroomId), {
                        classroomId, title: classroom.title, description: classroom.description, teacherName: classroom.teacherName, enrolledAt: serverTimestamp()
                    });
                }
                
                batch.delete(doc(db, `classrooms/${classroomId}/joinRequests`, request.id));
                batch.delete(doc(db, `users/${request.requesterId}/pendingJoinRequests`, classroomId));
                toast({ title: 'Request Approved!', description: `${request.studentName} has been added.` });
            }
            await batch.commit();
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Action Failed', description: error.message });
            console.error("Error handling request:", error);
        } finally {
            setIsProcessing(null);
        }
    }, [classroomId, toast, classroom, user]);

    const onApproveClick = (req: JoinRequest) => {
        if (req.role === 'teacher') {
            setSelectedRequest(req);
            setIsInterviewDialogOpen(true);
        } else {
            handleRequest(req, 'approve');
        }
    };

    const handleScheduleInterview = () => {
        if (!selectedRequest?.applicationData?.mobile) {
            toast({ variant: 'destructive', title: "Mobile Number Missing", description: "This applicant did not provide a mobile number." });
            return;
        }
        if (!interviewDate) {
            toast({ variant: 'destructive', title: "Date Missing", description: "Please select a date and time for the interview." });
            return;
        }
        
        const phoneNumber = selectedRequest.applicationData.mobile.replace(/\D/g, '');
        const formattedDate = new Date(interviewDate).toLocaleString();
        const classroomTitle = classroom?.title || "our classroom";
        const message = `Hi ${selectedRequest.studentName}, I would like to schedule an interview for the teaching position in "${classroomTitle}" on TeachMeet.\n\nProposed Time: ${formattedDate}\n\nPlease let me know if this works for you.`;
        
        const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`;
        window.open(whatsappUrl, '_blank');
        
        setIsInterviewDialogOpen(false);
        toast({ title: "Interview Invitation Sent", description: "WhatsApp has been opened with your invitation message." });
    };

    const renderRequestList = (requests: JoinRequest[]) => {
        if (requests.length === 0) {
            return <p className="text-sm text-muted-foreground text-center py-8">There are no pending requests in this category.</p>;
        }

        return (
            <div className="space-y-4">
                {requests.map(req => (
                    <Card key={req.id} className="p-3 bg-muted/30">
                        <div className="flex items-start gap-4">
                            <Avatar className="mt-1"><AvatarImage src={req.studentPhotoURL} data-ai-hint="avatar user"/><AvatarFallback>{req.studentName.charAt(0)}</AvatarFallback></Avatar>
                            <div className="flex-grow">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <p className="font-medium text-sm">{req.studentName}</p>
                                        <p className="text-xs capitalize text-muted-foreground">{req.role}</p>
                                    </div>
                                    <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                                        <Button size="icon" variant="ghost" className="h-8 w-8 text-green-600" onClick={() => onApproveClick(req)} disabled={isProcessing === req.id}>
                                            {isProcessing === req.id ? <Loader2 className="h-4 w-4 animate-spin"/> : <Check className="h-4 w-4" />}
                                        </Button>
                                        <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600" disabled={isProcessing === req.id}>
                                                    <X className="h-4 w-4" />
                                                </Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent>
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                                    <AlertDialogDescription>
                                                        This will deny {req.studentName}'s request to join the classroom.
                                                    </AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                    <AlertDialogAction
                                                        onClick={() => handleRequest(req, 'deny')}
                                                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                                    >
                                                        Deny
                                                    </AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                    </div>
                                </div>
                                {req.role === 'teacher' && req.applicationData && (
                                    <Dialog>
                                        <DialogTrigger asChild>
                                            <div className="mt-2 text-xs space-y-1 text-muted-foreground border-t pt-2 cursor-pointer hover:bg-muted/50 p-2 rounded-md">
                                                <p><strong>Subject:</strong> {req.applicationData.subject}</p>
                                                <p><strong>Availability:</strong> {req.applicationData.availability}</p>
                                                <p className="text-accent font-medium mt-1">Click to view full application</p>
                                            </div>
                                        </DialogTrigger>
                                        <DialogContent>
                                            <DialogHeader>
                                                <DialogTitle>Teacher Application: {req.studentName}</DialogTitle>
                                                <DialogDescription>
                                                    Review the full application details below.
                                                </DialogDescription>
                                            </DialogHeader>
                                            <div className="py-4 space-y-3 text-sm">
                                                <p><strong>Subject:</strong> {req.applicationData.subject}</p>
                                                <p><strong>Mobile:</strong> {req.applicationData.mobile}</p>
                                                <p><strong>Qualification:</strong> {req.applicationData.qualification}</p>
                                                <p><strong>Experience:</strong> {req.applicationData.experience}</p>
                                                <p><strong>Availability:</strong> {req.applicationData.availability}</p>
                                                {req.applicationData.message && <p className="border-t pt-3 mt-3"><strong>Message:</strong> {req.applicationData.message}</p>}
                                                {req.resumeURL && (
                                                    <Button asChild size="sm" variant="outline" className="mt-2">
                                                        <a href={req.resumeURL} target="_blank" rel="noopener noreferrer">View Resume</a>
                                                    </Button>
                                                )}
                                            </div>
                                            <DialogClose asChild>
                                                <Button type="button" variant="secondary">Close</Button>
                                            </DialogClose>
                                        </DialogContent>
                                    </Dialog>
                                )}
                            </div>
                        </div>
                    </Card>
                ))}
            </div>
        );
    };

    return (
        <main className="flex-1 p-4 md:px-8 md:pb-8 flex flex-col h-full overflow-y-auto">
             <header className="mb-6 flex items-center justify-between flex-shrink-0">
                <Button variant="link" onClick={() => router.back()} className="p-0 text-muted-foreground">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to Classroom
                </Button>
            </header>
            <Card className="flex-1 flex flex-col">
                <CardHeader>
                    <CardTitle>Pending Join Requests</CardTitle>
                    <CardDescription>Review users who want to join your classroom.</CardDescription>
                </CardHeader>
                <CardContent className="flex-grow flex flex-col">
                    <Tabs defaultValue="students" className="flex-1 flex flex-col">
                        <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="students">Students <Badge variant={studentRequests.length > 0 ? "default" : "secondary"} className="ml-2">{studentRequests.length}</Badge></TabsTrigger>
                            <TabsTrigger value="teachers">Teachers <Badge variant={teacherRequests.length > 0 ? "default" : "secondary"} className="ml-2">{teacherRequests.length}</Badge></TabsTrigger>
                        </TabsList>
                        <div className="flex-grow mt-4 overflow-hidden">
                            <ScrollArea className="h-full">
                                <TabsContent value="students">
                                    {renderRequestList(studentRequests)}
                                </TabsContent>
                                <TabsContent value="teachers">
                                    {renderRequestList(teacherRequests)}
                                </TabsContent>
                            </ScrollArea>
                        </div>
                    </Tabs>
                </CardContent>
            </Card>

            <Dialog open={isInterviewDialogOpen} onOpenChange={setIsInterviewDialogOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Interview Selection</DialogTitle>
                        <DialogDescription>
                            Do you want to interview {selectedRequest?.studentName} before adding them to the classroom?
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4 space-y-4">
                        <div className="flex flex-col gap-2">
                            <Label htmlFor="interview-date">Proposed Date & Time</Label>
                            <Input 
                                id="interview-date" 
                                type="datetime-local" 
                                value={interviewDate} 
                                onChange={(e) => setInterviewDate(e.target.value)}
                            />
                        </div>
                    </div>
                    <DialogFooter className="flex flex-col sm:flex-row gap-2">
                        <Button 
                            variant="outline" 
                            onClick={() => { if(selectedRequest) handleRequest(selectedRequest, 'approve'); setIsInterviewDialogOpen(false); }}
                            className="w-full sm:w-auto"
                        >
                            No, Add Directly
                        </Button>
                        <Button 
                            disabled={!interviewDate} 
                            onClick={handleScheduleInterview}
                            className="w-full sm:w-auto btn-gel"
                        >
                            Yes, Schedule (WhatsApp)
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </main>
    );
}
