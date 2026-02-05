'use client';

import { useState, useEffect, useCallback, memo } from 'react';
import { collection, query, onSnapshot, orderBy, deleteDoc, doc } from 'firebase/firestore';
import { db, storage } from '@/lib/firebase';
import { deleteObject, ref } from 'firebase/storage';
import { useClassroom } from '@/contexts/ClassroomContext';
import { canPost } from '@/lib/roles';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Trash2, Loader2 } from 'lucide-react';
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
import { DeletableItem } from '@/app/dashboard/classrooms/[classroomId]/page';
import AnnouncementComposer from './AnnouncementComposer';
import type { Announcement } from '@/app/dashboard/classrooms/[classroomId]/page';

const AnnouncementItem = memo(({ announcement, canDelete, onDeleteClick, isDeleting }: { announcement: Announcement; canDelete: boolean; onDeleteClick: () => void; isDeleting: boolean }) => {
    return (
        <div className="p-3 bg-muted/50 rounded-lg group relative">
            {announcement.text && <p className="text-sm">{announcement.text}</p>}
            {announcement.audioUrl && <audio controls src={announcement.audioUrl} className="w-full mt-2" />}
            <p className="text-xs text-muted-foreground mt-2">
                Posted by {announcement.creatorName} on {new Date(announcement.createdAt?.toDate()).toLocaleString()}
                {announcement.vanishAt && ` | Vanishes on ${new Date(announcement.vanishAt?.toDate()).toLocaleString()}`}
            </p>
            {canDelete && (
                <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <Button
                            variant="ghost"
                            size="icon"
                            disabled={isDeleting}
                            className="absolute top-2 right-2 h-7 w-7 text-destructive/70 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                            {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                        </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                            <AlertDialogDescription>This will permanently delete this announcement. This action cannot be undone.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={onDeleteClick}>Delete</AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            )}
        </div>
    );
});
AnnouncementItem.displayName = 'AnnouncementItem';

export function Announcements() {
    const { classroomId, user, userRole } = useClassroom();
    const { toast } = useToast();
    const [announcements, setAnnouncements] = useState<Announcement[]>([]);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [currentTime, setCurrentTime] = useState(new Date()); 
    const canUserPost = canPost(userRole);
    
    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentTime(new Date());
        }, 60000); 
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        if (!classroomId) return;
        const q = query(collection(db, 'classrooms', classroomId, 'announcements'), orderBy('createdAt', 'desc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const fetchedAnnouncements = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Announcement));
            setAnnouncements(fetchedAnnouncements);
        }, (error) => {
            console.error("Error fetching announcements:", error);
            toast({ variant: 'destructive', title: "Error", description: "Could not fetch announcements." });
        });
        return unsubscribe;
    }, [classroomId, toast]);

    const handleDelete = useCallback(async (itemToDelete: DeletableItem | null) => {
        if (!itemToDelete || !classroomId) return;
        const { collectionName, item } = itemToDelete;
        setDeletingId(item.id);
        
        try {
            if (item.storagePath) {
                const fileRef = ref(storage, item.storagePath);
                await deleteObject(fileRef).catch(err => {
                    if (err.code !== 'storage/object-not-found') throw err;
                });
            }
            await deleteDoc(doc(db, "classrooms", classroomId, collectionName, item.id));
            toast({ title: "Announcement Deleted" });
        } catch (error: any) {
            console.error("Error deleting announcement:", error);
            toast({ variant: 'destructive', title: "Deletion Failed", description: error.message });
        } finally {
            setDeletingId(null);
        }
    }, [classroomId, toast]);
    
    const visibleAnnouncements = announcements.filter(a => !a.vanishAt || a.vanishAt.toDate() > currentTime);

    return (
        <div className="space-y-4">
            {canUserPost && classroomId && <AnnouncementComposer classId={classroomId} canPost={canUserPost} />}
            <div className="space-y-3">
                {visibleAnnouncements.length > 0 ? visibleAnnouncements.map(a => (
                    <AnnouncementItem
                        key={a.id}
                        announcement={a}
                        isDeleting={deletingId === a.id}
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
