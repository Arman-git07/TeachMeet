
'use client';

import { useState, useEffect, useCallback, memo } from 'react';
import { collection, query, onSnapshot, orderBy, doc, writeBatch, deleteDoc, arrayUnion, getDoc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useClassroom } from '@/contexts/ClassroomContext';
import { useToast } from '@/hooks/use-toast';
import { DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Check, X, UserX } from 'lucide-react';
import Link from 'next/link';
import type { JoinRequest, UserProfile } from '@/app/dashboard/classrooms/[classroomId]/page';

export function ParticipantsManagement() {
    const { classroomId, user, userRole } = useClassroom();
    const { toast } = useToast();
    const [joinRequests, setJoinRequests] = useState<JoinRequest[]>([]);
    const [participants, setParticipants] = useState<UserProfile[]>([]);
    const [isProcessing, setIsProcessing] = useState<string | null>(null);

    useEffect(() => {
        if (!classroomId) return;
        const reqUnsub = onSnapshot(query(collection(db, `classrooms/${classroomId}/joinRequests`), orderBy('requestedAt', 'desc')), (snap) => {
            setJoinRequests(snap.docs.map(d => ({ id: d.id, ...d.data() } as JoinRequest)));
        });
        const partUnsub = onSnapshot(query(collection(db, `classrooms/${classroomId}/participants`), orderBy('joinedAt', 'desc')), (snap) => {
            setParticipants(snap.docs.map(d => ({ id: d.id, ...d.data() } as UserProfile)));
        });
        return () => { reqUnsub(); partUnsub(); };
    }, [classroomId]);

    const handleRequest = useCallback(async (request: JoinRequest, action: 'approve' | 'deny') => {
        if (action === 'deny') {
            setIsProcessing(request.id);
            try {
                const batch = writeBatch(db);
                batch.delete(doc(db, `classrooms/${classroomId}/joinRequests`, request.studentId));
                batch.delete(doc(db, `users/${request.studentId}/pendingJoinRequests`, classroomId));
                await batch.commit();
                toast({ title: 'Request Denied' });
            } catch (error: any) {
                toast({ variant: 'destructive', title: 'Action Failed', description: error.message });
            } finally {
                setIsProcessing(null);
            }
            return;
        }

        // Approve
        setIsProcessing(request.id);
        try {
            const batch = writeBatch(db);
            const classroomRef = doc(db, 'classrooms', classroomId);
            batch.set(doc(db, `classrooms/${classroomId}/participants`, request.studentId), {
                uid: request.studentId, name: request.studentName, photoURL: request.studentPhotoURL || '', role: request.role, joinedAt: serverTimestamp(),
            });
            if (request.role === 'teacher') {
                batch.set(doc(db, `classrooms/${classroomId}/teachers`, request.studentId), {
                    uid: request.studentId, name: request.studentName, ...request.applicationData, addedAt: serverTimestamp(),
                });
                batch.update(classroomRef, { teachers: arrayUnion({ uid: request.studentId, name: request.studentName, photoURL: request.studentPhotoURL || "" }) });
            } else {
                batch.update(classroomRef, { students: arrayUnion(request.studentId) });
            }
            const classroomSnap = await getDoc(classroomRef);
            if (classroomSnap.exists()) {
                batch.set(doc(db, `users/${request.studentId}/enrolled`, classroomId), {
                    classroomId, title: classroomSnap.data().title, description: classroomSnap.data().description, teacherName: classroomSnap.data().teacherName, enrolledAt: serverTimestamp()
                });
            }
            batch.delete(doc(db, `classrooms/${classroomId}/joinRequests`, request.studentId));
            batch.delete(doc(db, `users/${request.studentId}/pendingJoinRequests`, classroomId));
            await batch.commit();
            toast({ title: 'Request Approved!', description: `${request.studentName} has been added.` });
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Approval Failed', description: error.message });
        } finally {
            setIsProcessing(null);
        }
    }, [classroomId, toast]);

    const handleRemoveParticipant = useCallback(async (participant: UserProfile) => {
        // Implement remove logic here
    }, []);

    return (
        <DialogContent className="sm:max-w-2xl">
            <DialogHeader><DialogTitle>Manage Participants</DialogTitle><DialogDescription>Approve requests and view enrolled participants.</DialogDescription></DialogHeader>
            <ScrollArea className="max-h-[60vh] -mx-6 px-6">
                <div className="space-y-4 py-4">
                    {joinRequests.length > 0 && (
                        <div className="space-y-2">
                            <h4 className="font-medium text-sm text-muted-foreground px-1">Pending Requests ({joinRequests.length})</h4>
                            {joinRequests.map(req => (
                                <Card key={req.id} className="p-3 bg-muted/30">
                                    <div className="flex items-start gap-4">
                                        <Avatar className="mt-1"><AvatarImage src={req.studentPhotoURL} data-ai-hint="avatar user" /><AvatarFallback>{req.studentName.charAt(0)}</AvatarFallback></Avatar>
                                        <div className="flex-grow">
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <p className="font-medium text-sm">{req.studentName}</p>
                                                    <p className="text-xs capitalize text-muted-foreground">{req.role}</p>
                                                </div>
                                                <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                                                    <Button size="icon" variant="ghost" className="h-8 w-8 text-green-600" onClick={() => handleRequest(req, 'approve')} disabled={isProcessing === req.id}>{isProcessing === req.id ? <Loader2 className="h-4 w-4 animate-spin"/> : <Check className="h-4 w-4" />}</Button>
                                                    <Button size="icon" variant="ghost" className="h-8 w-8 text-red-600" onClick={() => handleRequest(req, 'deny')} disabled={isProcessing === req.id}>{isProcessing === req.id ? <Loader2 className="h-4 w-4 animate-spin"/> : <X className="h-4 w-4" />}</Button>
                                                </div>
                                            </div>
                                            {req.role === 'teacher' && req.applicationData && (<div className="mt-2 text-xs space-y-1 text-muted-foreground border-t pt-2"><p><strong>Subject:</strong> {req.applicationData.subject}</p><p><strong>Availability:</strong> {req.applicationData.availability}</p>{req.resumeURL && <Button asChild size="sm" variant="link" className="p-0 h-auto mt-1"><Link href={req.resumeURL} target="_blank">View Resume</Link></Button>}</div>)}
                                        </div>
                                    </div>
                                </Card>
                            ))}
                        </div>
                    )}
                    <div className="space-y-2">
                        <h4 className="font-medium text-sm text-muted-foreground px-1">Enrolled ({participants.length})</h4>
                        {participants.map(p => (<div key={p.id} className="flex items-center gap-3 p-2 bg-muted/50 rounded-lg"><Avatar><AvatarImage src={p.photoURL} data-ai-hint="avatar user"/><AvatarFallback>{p.name.charAt(0)}</AvatarFallback></Avatar><span className="text-sm flex-grow">{p.name}</span><Badge variant={p.role === 'teacher' ? 'secondary' : 'default'} className="ml-2 capitalize">{p.role}</Badge>{userRole==='creator' && p.uid !== user?.uid && (<Button variant="ghost" size="icon" className="h-7 w-7 text-destructive/70" onClick={() => handleRemoveParticipant(p)}><UserX className="h-4 w-4" /></Button>)}</div>))}
                    </div>
                </div>
            </ScrollArea>
        </DialogContent>
    );
}
