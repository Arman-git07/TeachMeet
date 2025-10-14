

'use client';

import { useState, useEffect, useCallback, memo } from 'react';
import { collection, query, onSnapshot, orderBy, doc, writeBatch, deleteDoc, arrayUnion, getDoc, setDoc, serverTimestamp, arrayRemove } from 'firebase/firestore';
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
    const { classroomId, user, userRole, classroom } = useClassroom();
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
        setIsProcessing(request.id);
        const batch = writeBatch(db);
        const classroomRef = doc(db, 'classrooms', classroomId);

        try {
            if (action === 'deny') {
                batch.delete(doc(db, `classrooms/${classroomId}/joinRequests`, request.id));
                batch.delete(doc(db, `users/${request.requesterId}/pendingJoinRequests`, classroomId));
                toast({ title: 'Request Denied' });
            } else { // Approve
                batch.set(doc(db, `classrooms/${classroomId}/participants`, request.requesterId), {
                    uid: request.requesterId, name: request.studentName, photoURL: request.studentPhotoURL || '', role: request.role, joinedAt: serverTimestamp(),
                });

                if (request.role === 'teacher') {
                     batch.update(classroomRef, { teachers: arrayUnion({ uid: request.requesterId, name: request.studentName, photoURL: request.studentPhotoURL || "" }) });
                     batch.set(doc(db, `classrooms/${classroomId}/teachers`, request.requesterId), { uid: request.requesterId, name: request.studentName, ...request.applicationData, addedAt: serverTimestamp() });
                } else {
                    batch.update(classroomRef, { students: arrayUnion(request.requesterId) });
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
    }, [classroomId, toast, classroom]);

    const handleRemoveParticipant = useCallback(async (participant: UserProfile) => {
        setIsProcessing(participant.uid);
        const batch = writeBatch(db);
        const classroomRef = doc(db, 'classrooms', classroomId);

        try {
            batch.delete(doc(db, `classrooms/${classroomId}/participants`, participant.uid));
            batch.delete(doc(db, `users/${participant.uid}/enrolled`, classroomId));

            if (participant.role === 'teacher') {
                batch.update(classroomRef, { teachers: arrayRemove({ uid: participant.uid, name: participant.name, photoURL: participant.photoURL || "" }) });
                batch.delete(doc(db, `classrooms/${classroomId}/teachers`, participant.uid));
            } else {
                batch.update(classroomRef, { students: arrayRemove(participant.uid) });
            }

            await batch.commit();
            toast({ title: 'Participant Removed', description: `${participant.name} has been removed from the classroom.` });
        } catch (error: any) {
             toast({ variant: 'destructive', title: 'Removal Failed', description: error.message });
             console.error("Error removing participant:", error);
        } finally {
            setIsProcessing(null);
        }
    }, [classroomId, toast]);

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
                        {participants.map(p => (<div key={p.id} className="flex items-center gap-3 p-2 bg-muted/50 rounded-lg"><Avatar><AvatarImage src={p.photoURL} data-ai-hint="avatar user"/><AvatarFallback>{p.name.charAt(0)}</AvatarFallback></Avatar><span className="text-sm flex-grow">{p.name}</span><Badge variant={p.role === 'teacher' ? 'secondary' : 'default'} className="ml-2 capitalize">{p.role}</Badge>{userRole==='creator' && p.uid !== user?.uid && (<Button variant="ghost" size="icon" className="h-7 w-7 text-destructive/70" onClick={() => handleRemoveParticipant(p)} disabled={isProcessing === p.uid}>{isProcessing === p.uid ? <Loader2 className="h-4 w-4 animate-spin"/> : <UserX className="h-4 w-4" />}</Button>)}</div>))}
                    </div>
                </div>
            </ScrollArea>
        </DialogContent>
    );
}
