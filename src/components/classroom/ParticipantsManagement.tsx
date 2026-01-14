
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
    const [participants, setParticipants] = useState<UserProfile[]>([]);
    const [isProcessing, setIsProcessing] = useState<string | null>(null);

    useEffect(() => {
        if (!classroomId) return;
        const partUnsub = onSnapshot(query(collection(db, `classrooms/${classroomId}/participants`), orderBy('joinedAt', 'desc')), (snap) => {
            setParticipants(snap.docs.map(d => ({ id: d.id, ...d.data() } as UserProfile)));
        });
        return () => { partUnsub(); };
    }, [classroomId]);

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
        <DialogContent className="sm:max-w-md" data-dialog-id="participants">
            <DialogHeader><DialogTitle>Manage Participants</DialogTitle><DialogDescription>View all enrolled students and teachers.</DialogDescription></DialogHeader>
            <ScrollArea className="max-h-[60vh] -mx-6 px-6">
                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <h4 className="font-medium text-sm text-muted-foreground px-1">Enrolled ({participants.length})</h4>
                        {participants.length > 0 ? participants.map(p => (
                            <div key={p.id} className="flex items-center gap-3 p-2 bg-muted/50 rounded-lg">
                                <Avatar>
                                    <AvatarImage src={p.photoURL} data-ai-hint="avatar user"/>
                                    <AvatarFallback>{p.name.charAt(0)}</AvatarFallback>
                                </Avatar>
                                <span className="text-sm flex-grow">{p.name}</span>
                                <Badge variant={p.role === 'teacher' ? 'secondary' : 'default'} className="ml-2 capitalize">{p.role}</Badge>
                                {userRole==='creator' && p.uid !== user?.uid && (
                                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive/70" onClick={() => handleRemoveParticipant(p)} disabled={isProcessing === p.uid}>
                                        {isProcessing === p.uid ? <Loader2 className="h-4 w-4 animate-spin"/> : <UserX className="h-4 w-4" />}
                                    </Button>
                                )}
                            </div>
                        )) : (
                            <p className="text-sm text-muted-foreground text-center py-4">No one has joined this classroom yet.</p>
                        )}
                    </div>
                </div>
            </ScrollArea>
        </DialogContent>
    );
}
