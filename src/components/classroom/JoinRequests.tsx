
'use client';

import { useState, useEffect, useCallback } from 'react';
import { collection, query, onSnapshot, orderBy, doc, writeBatch, deleteDoc, arrayUnion, getDoc, setDoc, serverTimestamp, arrayRemove } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useClassroom } from '@/contexts/ClassroomContext';
import { useToast } from '@/hooks/use-toast';
import { DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Loader2, Check, X } from 'lucide-react';
import Link from 'next/link';
import type { JoinRequest } from '@/app/dashboard/classrooms/[classroomId]/page';

export function JoinRequests() {
    const { classroomId, classroom } = useClassroom();
    const { toast } = useToast();
    const [joinRequests, setJoinRequests] = useState<JoinRequest[]>([]);
    const [isProcessing, setIsProcessing] = useState<string | null>(null);

    useEffect(() => {
        if (!classroomId) return;
        const q = query(collection(db, `classrooms/${classroomId}/joinRequests`), orderBy('requestedAt', 'desc'));
        const unsubscribe = onSnapshot(q, (snap) => {
            setJoinRequests(snap.docs.map(d => ({ id: d.id, ...d.data() } as JoinRequest)));
        });
        return unsubscribe;
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

    return (
        <DialogContent className="sm:max-w-md" data-dialog-id="join-requests">
            <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                    Join Requests 
                    {joinRequests.length > 0 && (
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
                            {joinRequests.length}
                        </span>
                    )}
                </DialogTitle>
                <DialogDescription>Approve or deny requests to join this classroom.</DialogDescription>
            </DialogHeader>
             <ScrollArea className="max-h-[60vh] -mx-6 px-6">
                <div className="space-y-4 py-4">
                    {joinRequests.length > 0 ? (
                        joinRequests.map(req => (
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
                                        {req.role === 'teacher' && req.applicationData && (
                                            <div className="mt-2 text-xs space-y-1 text-muted-foreground border-t pt-2">
                                                <p><strong>Subject:</strong> {req.applicationData.subject}</p>
                                                <p><strong>Availability:</strong> {req.applicationData.availability}</p>
                                                {req.resumeURL && <Button asChild size="sm" variant="link" className="p-0 h-auto mt-1"><Link href={req.resumeURL} target="_blank">View Resume</Link></Button>}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </Card>
                        ))
                    ) : (
                        <p className="text-sm text-muted-foreground text-center py-8">There are no pending join requests.</p>
                    )}
                </div>
            </ScrollArea>
        </DialogContent>
    )
}
