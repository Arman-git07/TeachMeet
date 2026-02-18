'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { collection, query, onSnapshot, orderBy, doc, writeBatch, arrayUnion, serverTimestamp, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useClassroom } from '@/contexts/ClassroomContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Loader2, Check, X, ArrowLeft, MessageCircle, UserPlus } from 'lucide-react';
import type { JoinRequest } from '@/app/dashboard/classrooms/[classroomId]/page';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
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
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export default function JoinRequestsPage() {
    const { classroomId, classroom, user, userRole } = useClassroom();
    const router = useRouter();
    const { toast } = useToast();
    const [joinRequests, setJoinRequests] = useState<JoinRequest[]>([]);
    const [isProcessing, setIsProcessing] = useState<string | null>(null);

    const [selectedRequest, setSelectedRequest] = useState<JoinRequest | null>(null);
    const [isInterviewDialogOpen, setIsInterviewDialogOpen] = useState(false);
    const [interviewDate, setInterviewDate] = useState('');

    const isCreator = userRole === 'creator';

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
        if (!classroomId || !request.requesterId || !user) return;

        setIsProcessing(request.id);
        const batch = writeBatch(db);

        try {
            if (action === 'deny') {
                batch.delete(doc(db, `classrooms/${classroomId}/joinRequests`, request.id));
                batch.delete(doc(db, `users/${request.requesterId}/pendingJoinRequests`, classroomId));
            } else {
                // 1. Add user to the main participants list (Critical for Chat & Permission Rules)
                // Use the requester's UID as the document ID for 'exists' rule checks.
                batch.set(doc(db, `classrooms/${classroomId}/participants`, request.requesterId), {
                    uid: request.requesterId, 
                    name: request.studentName, 
                    photoURL: request.studentPhotoURL || '', 
                    role: request.role, 
                    joinedAt: serverTimestamp(),
                });

                const classroomRef = doc(db, 'classrooms', classroomId);
                
                // 2. Add to role-specific classroom structures
                if (request.role === 'teacher') {
                     batch.update(classroomRef, { 
                        teachers: arrayUnion({ 
                            uid: request.requesterId, 
                            name: request.studentName, 
                            photoURL: request.studentPhotoURL || "" 
                        }) 
                     });
                     batch.set(doc(db, `classrooms/${classroomId}/teachers`, request.requesterId), { 
                        uid: request.requesterId, 
                        name: request.studentName, 
                        ...request.applicationData, 
                        addedAt: serverTimestamp() 
                     });
                } else {
                    batch.update(classroomRef, { students: arrayUnion(request.requesterId) });
                }

                // 3. Update enrollment status on the User's profile
                if (classroom) {
                    batch.set(doc(db, `users/${request.requesterId}/enrolled`, classroomId), {
                        classroomId, 
                        title: classroom.title, 
                        description: classroom.description, 
                        teacherName: classroom.teacherName, 
                        enrolledAt: serverTimestamp()
                    });
                }
                
                // 4. Delete the original request document
                batch.delete(doc(db, `classrooms/${classroomId}/joinRequests`, request.id));
            }
            
            await batch.commit();

            // 5. Cleanup user's side (not in batch to avoid complexity)
            if (request.requesterId) {
                deleteDoc(doc(db, `users/${request.requesterId}/pendingJoinRequests`, classroomId))
                    .catch(err => console.warn("Enrollment cleanup warning:", err));
            }

            if (action === 'deny') {
                toast({ title: 'Request Denied' });
            } else {
                toast({ title: 'Request Approved!', description: `${request.studentName} is now in the class.` });
            }
        } catch (error: any) {
            console.error("Action failed:", error);
            toast({ 
                variant: 'destructive', 
                title: 'Action Failed', 
                description: error.message || "An unexpected error occurred. Please check security rules." 
            });
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
        const phone = selectedRequest?.applicationData?.mobile;
        if (!phone || !interviewDate) {
            toast({ variant: 'destructive', title: "Missing Information", description: "Teacher's phone number or interview date is missing." });
            return;
        }
        
        const phoneNumber = phone.replace(/\D/g, '');
        const formattedDate = new Date(interviewDate).toLocaleString();
        const message = `Hi ${selectedRequest.studentName}, I would like to schedule an interview for the teaching position in "${classroom?.title}" on TeachMeet.\n\nProposed Time: ${formattedDate}\n\nPlease let me know if this works for you.`;
        
        const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`;
        window.open(whatsappUrl, '_blank');
        
        setIsInterviewDialogOpen(false);
        toast({ title: "Interview Invitation Sent", description: "WhatsApp has been opened with your invitation message." });
    };

    const renderRequestList = (requests: JoinRequest[]) => {
        if (requests.length === 0) return <div className="flex flex-col items-center justify-center py-12 text-muted-foreground"><p className="text-sm">No pending requests.</p></div>;

        return (
            <div className="space-y-4">
                {requests.map(req => (
                    <Card key={req.id} className="p-4 border shadow-sm rounded-xl">
                        <div className="flex items-start gap-4">
                            <Avatar className="h-12 w-12 border-2 border-primary/10">
                                <AvatarImage src={req.studentPhotoURL} data-ai-hint="avatar user"/>
                                <AvatarFallback>{req.studentName.charAt(0)}</AvatarFallback>
                            </Avatar>
                            <div className="flex-grow">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <p className="font-semibold text-base">{req.studentName}</p>
                                        <Badge variant={req.role === 'teacher' ? 'secondary' : 'default'} className="mt-1 capitalize text-[10px] h-5">
                                            {req.role}
                                        </Badge>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Button 
                                            size="sm" 
                                            variant="outline" 
                                            className="h-9 w-9 p-0 text-green-600 hover:text-green-700 hover:bg-green-50 rounded-full border-green-200" 
                                            onClick={() => onApproveClick(req)} 
                                            disabled={isProcessing === req.id}
                                        >
                                            {isProcessing === req.id ? <Loader2 className="h-4 w-4 animate-spin"/> : <Check className="h-5 w-5" />}
                                        </Button>
                                        <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <Button 
                                                    variant="outline" 
                                                    size="sm" 
                                                    className="h-9 w-9 p-0 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-full border-red-200" 
                                                    disabled={isProcessing === req.id}
                                                >
                                                    <X className="h-5 w-5" />
                                                </Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent className="rounded-xl">
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle>Deny Request?</AlertDialogTitle>
                                                    <AlertDialogDescription>This will decline {req.studentName}'s request to join.</AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel className="rounded-lg">Cancel</AlertDialogCancel>
                                                    <AlertDialogAction onClick={() => handleRequest(req, 'deny')} className="bg-destructive hover:bg-destructive/90 rounded-lg">Deny</AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                    </div>
                                </div>
                                {req.role === 'teacher' && req.applicationData && (
                                    <div className="mt-3 text-xs space-y-2 text-muted-foreground bg-muted/30 p-3 rounded-lg border">
                                        <div className="grid grid-cols-2 gap-2">
                                            <p><strong>Subject:</strong> {req.applicationData.subject}</p>
                                            <p><strong>Mobile:</strong> {req.applicationData.mobile}</p>
                                            <p><strong>Experience:</strong> {req.applicationData.experience}</p>
                                            <p><strong>Availability:</strong> {req.applicationData.availability}</p>
                                        </div>
                                        {req.applicationData.message && <p className="border-t pt-2 italic">"{req.applicationData.message}"</p>}
                                    </div>
                                )}
                            </div>
                        </div>
                    </Card>
                ))}
            </div>
        );
    };

    return (
        <main className="flex-1 p-4 md:px-8 md:pb-8 flex flex-col h-full overflow-hidden bg-muted/30">
             <header className="mb-6">
                <Button variant="link" onClick={() => router.back()} className="p-0 text-muted-foreground hover:text-primary">
                    <ArrowLeft className="mr-2 h-4 w-4" /> Back to Classroom
                </Button>
            </header>
            <Card className="flex-1 flex flex-col shadow-xl rounded-2xl border-border/50 overflow-hidden">
                <CardHeader className="bg-card border-b">
                    <CardTitle className="text-2xl font-bold flex items-center gap-3">
                        <UserPlus className="h-7 w-7 text-primary" />
                        Pending Join Requests
                    </CardTitle>
                    <CardDescription>Review and approve users who want to join your classroom.</CardDescription>
                </CardHeader>
                <CardContent className="flex-grow flex flex-col p-0">
                    <Tabs defaultValue="students" className="flex-1 flex flex-col">
                        <TabsList className={cn("grid w-full rounded-none bg-muted/50", isCreator ? "grid-cols-2" : "grid-cols-1")}>
                            <TabsTrigger value="students" className="data-[state=active]:bg-background data-[state=active]:shadow-none border-b-2 data-[state=active]:border-primary rounded-none">
                                Students <Badge className="ml-2 bg-primary/20 text-primary hover:bg-primary/20 border-none">{studentRequests.length}</Badge>
                            </TabsTrigger>
                            {isCreator && (
                                <TabsTrigger value="teachers" className="data-[state=active]:bg-background data-[state=active]:shadow-none border-b-2 data-[state=active]:border-primary rounded-none">
                                    Teachers <Badge className="ml-2 bg-secondary/20 text-secondary hover:bg-secondary/20 border-none">{teacherRequests.length}</Badge>
                                </TabsTrigger>
                            )}
                        </TabsList>
                        <ScrollArea className="flex-1">
                            <div className="p-4 md:p-6">
                                <TabsContent value="students" className="mt-0">{renderRequestList(studentRequests)}</TabsContent>
                                {isCreator && (
                                    <TabsContent value="teachers" className="mt-0">{renderRequestList(teacherRequests)}</TabsContent>
                                )}
                            </div>
                        </ScrollArea>
                    </Tabs>
                </CardContent>
            </Card>

            <Dialog open={isInterviewDialogOpen} onOpenChange={setIsInterviewDialogOpen}>
                <DialogContent className="rounded-xl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-xl">
                            <MessageCircle className="h-6 w-6 text-primary" />
                            Interview Selection
                        </DialogTitle>
                        <DialogDescription>Do you want to interview {selectedRequest?.studentName} before adding them to the classroom?</DialogDescription>
                    </DialogHeader>
                    <div className="py-6 space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="interview-date">Proposed Date & Time</Label>
                            <Input 
                                id="interview-date" 
                                type="datetime-local" 
                                value={interviewDate} 
                                onChange={(e) => setInterviewDate(e.target.value)} 
                                className="rounded-lg h-11"
                            />
                        </div>
                        <p className="text-xs text-muted-foreground italic">Scheduling an interview will open WhatsApp with a pre-written invitation to the teacher's mobile number.</p>
                    </div>
                    <DialogFooter className="flex gap-2">
                        <Button variant="outline" className="flex-1 rounded-lg" onClick={() => { if(selectedRequest) handleRequest(selectedRequest, 'approve'); setIsInterviewDialogOpen(false); }}>Add Directly</Button>
                        <Button disabled={!interviewDate} onClick={handleScheduleInterview} className="flex-1 btn-gel rounded-lg">Schedule (WhatsApp)</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </main>
    );
}
