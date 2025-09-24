
'use client';

import { useState, useEffect, useCallback, memo } from 'react';
import { collection, query, onSnapshot, orderBy, deleteDoc, doc } from 'firebase/firestore';
import { db, storage } from '@/lib/firebase';
import { deleteObject, ref } from 'firebase/storage';
import { useClassroom } from '@/contexts/ClassroomContext';
import { canPost } from '@/lib/roles';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Trash2 } from 'lucide-react';
import { AlertDialog, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { DeletableItem } from '@/app/dashboard/classrooms/[classroomId]/page';
import AnnouncementComposer from './AnnouncementComposer';
import type { Announcement } from '@/app/dashboard/classrooms/[classroomId]/page';

const AnnouncementItem = memo(({ announcement, canDelete, onDeleteClick }: { announcement: Announcement; canDelete: boolean; onDeleteClick: () => void }) => {
    return (
        <div className="p-3 bg-muted/50 rounded-lg group relative">
            {announcement.text && <p className="text-sm">{announcement.text}</p>}
            {announcement.audioUrl && <audio controls src={announcement.audioUrl} className="w-full mt-2" />}
            <p className="text-xs text-muted-foreground mt-2">
                Posted by {announcement.creatorName} on {new Date(announcement.createdAt?.toDate()).toLocaleString()}
                {announcement.vanishAt && ` | Vanishes on ${new Date(announcement.vanishAt?.toDate()).toLocaleString()}`}
            </p>
            {canDelete && (
                <AlertDialogTrigger asChild>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="absolute top-2 right-2 h-7 w-7 text-destructive/70 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={onDeleteClick}
                    >
                        <Trash2 className="h-4 w-4" />
                    </Button>
                </AlertDialogTrigger>
            )}
        </div>
    );
});
AnnouncementItem.displayName = 'AnnouncementItem';

export function Announcements() {
    const { classroomId, user, userRole } = useClassroom();
    const { toast } = useToast();
    const [announcements, setAnnouncements] = useState<Announcement[]>([]);
    const canUserPost = canPost(userRole);
    
    useEffect(() => {
        if (!classroomId) return;
        const q = query(collection(db, 'classrooms', classroomId, 'announcements'), orderBy('createdAt', 'desc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setAnnouncements(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Announcement)));
        }, (error) => {
            console.error("Error fetching announcements:", error);
            toast({ variant: 'destructive', title: "Error", description: "Could not fetch announcements." });
        });
        return unsubscribe;
    }, [classroomId, toast]);

    const handleDelete = useCallback(async (itemToDelete: DeletableItem | null) => {
        if (!itemToDelete || !classroomId) return;
        const { collectionName, item } = itemToDelete;
        try {
            if (item.storagePath) {
                const fileRef = ref(storage, item.storagePath);
                await deleteObject(fileRef).catch(err => {
                    if (err.code !== 'storage/object-not-found') throw err;
                });
            }
            await deleteDoc(doc(db, "classrooms", classroomId, collectionName, item.id));
            toast({ title: "Item Deleted", description: "The announcement has been removed." });
        } catch (error: any) {
            console.error("Error deleting announcement:", error);
            toast({ variant: 'destructive', title: "Deletion Failed", description: error.message });
        }
    }, [classroomId, toast]);

    return (
        <div className="space-y-4">
            {canUserPost && <AnnouncementComposer classId={classroomId} canPost={canUserPost} />}
            <div className="space-y-3">
                {announcements.length > 0 ? announcements.map(a => (
                    <AnnouncementItem
                        key={a.id}
                        announcement={a}
                        canDelete={userRole === 'creator' || a.creatorId === user?.uid}
                        onDeleteClick={() => handleDelete({ collectionName: 'announcements', item: a })}
                    />
                )) : (
                    <p className="text-muted-foreground text-center py-4">No announcements yet.</p>
                )}
            </div>
        </div>
    );
}
