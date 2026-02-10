
'use client';

import { useState, useCallback, memo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useClassroom } from '@/contexts/ClassroomContext';
import { canManage } from '@/lib/roles';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { ArrowLeft, MoreVertical, Users, Briefcase, CreditCard, UserPlus, MessageSquare, Settings, Save, Loader2 } from 'lucide-react';
import { ParticipantsManagement } from './ParticipantsManagement';
import { SubjectTeachers } from './SubjectTeachers';
import { FeesAndPayment } from './FeesAndPayment';
import type { DeletableItem } from '@/app/dashboard/classrooms/[classroomId]/page';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogClose } from '@/components/ui/dialog';
import { deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db, storage } from '@/lib/firebase';
import { deleteObject, ref } from 'firebase/storage';
import Link from 'next/link';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

const ItemDeleteDialog = memo(({ itemToDelete, setItemToDelete, onConfirmDelete }: { itemToDelete: DeletableItem | null; setItemToDelete: (item: DeletableItem | null) => void; onConfirmDelete: () => void }) => {
    return (
        <AlertDialog open={!!itemToDelete} onOpenChange={(isOpen) => !isOpen && setItemToDelete(null)}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                    <AlertDialogDescription>This will permanently delete the item. This action cannot be undone.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel onClick={() => setItemToDelete(null)}>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={onConfirmDelete}>Delete</AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
});
ItemDeleteDialog.displayName = 'ItemDeleteDialog';

export function ClassroomHeader() {
    const { classroom } = useClassroom();
    const { classroomId, user, userRole } = useClassroom();
    const router = useRouter();
    const { toast } = useToast();
    const canUserManage = canManage(userRole);
    const isCreator = userRole === 'creator';

    const [itemToDelete, setItemToDelete] = useState<DeletableItem | null>(null);
    const [isParticipantsOpen, setIsParticipantsOpen] = useState(false);
    const [isTeachersOpen, setIsTeachersOpen] = useState(false);
    const [isFeesOpen, setIsFeesOpen] = useState(false);
    
    // Classroom Edit State
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [editTitle, setEditTitle] = useState("");
    const [editDescription, setEditDescription] = useState("");
    const [editTeacherName, setEditTeacherName] = useState("");
    const [isUpdating, setIsUpdating] = useState(false);

    useEffect(() => {
        if (classroom) {
            setEditTitle(classroom.title || "");
            setEditDescription(classroom.description || "");
            setEditTeacherName(classroom.teacherName || "");
        }
    }, [classroom]);

    const handleUpdateClassroom = async () => {
        if (!classroomId) return;
        setIsUpdating(true);
        try {
            await updateDoc(doc(db, 'classrooms', classroomId), {
                title: editTitle,
                description: editDescription,
                teacherName: editTeacherName
            });
            toast({ title: "Classroom Updated" });
            setIsSettingsOpen(false);
        } catch (error) {
            console.error("Update failed:", error);
            toast({ variant: 'destructive', title: "Update Failed" });
        } finally {
            setIsUpdating(false);
        }
    };

    const handleDeleteItem = useCallback(async () => {
        if (!itemToDelete || !classroomId) return;
        const { collectionName, item } = itemToDelete;
        
        try {
            if (item.storagePath) {
              const fileRef = ref(storage, item.storagePath);
              await deleteObject(fileRef).catch(err => { if(err.code !== 'storage/object-not-found') throw err; });
            }
            await deleteDoc(doc(db, "classrooms", classroomId, collectionName, item.id));
            toast({ title: "Item Deleted" });
        } catch (error: any) {
            toast({ variant: 'destructive', title: "Deletion Failed", description: error.message });
        } finally {
            setItemToDelete(null);
        }
    }, [classroomId, itemToDelete, toast]);

    if (!classroom) return null;

    return (
        <>
            <header className="sticky top-0 z-20 bg-background/90 backdrop-blur-sm p-4 border-b flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                    <Button variant="link" onClick={() => router.push('/dashboard/classrooms')} className="p-0 mb-1 text-muted-foreground h-auto">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back to classrooms
                    </Button>
                    <h1 className="text-2xl md:text-3xl font-bold truncate" title={classroom.title}>{classroom.title}</h1>
                    <p className="text-sm text-muted-foreground mt-1 truncate">Taught by: {classroom.teacherName}</p>
                </div>
                <div className="flex-shrink-0">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreVertical className="h-5 w-5" /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem asChild>
                                <Link href={`/dashboard/classrooms/${classroomId}/chat?topic=${encodeURIComponent(classroom.title)}`}>
                                    <MessageSquare className="mr-2 h-4 w-4" />Class Chat
                                </Link>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {isCreator && (
                                <DropdownMenuItem onSelect={() => setIsSettingsOpen(true)}>
                                    <Settings className="mr-2 h-4 w-4"/>Classroom Settings
                                </DropdownMenuItem>
                            )}
                            {canUserManage && (
                                <>
                                    <DropdownMenuItem asChild>
                                        <Link href={`/dashboard/classrooms/${classroomId}/requests`}>
                                            <UserPlus className="mr-2 h-4 w-4"/>Join Requests
                                        </Link>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onSelect={() => setIsParticipantsOpen(true)}>
                                        <Users className="mr-2 h-4 w-4"/>Manage Participants
                                    </DropdownMenuItem>
                                </>
                            )}
                            
                            <DropdownMenuItem onSelect={() => setIsTeachersOpen(true)}>
                                <Briefcase className="mr-2 h-4 w-4"/>Subject Teachers
                            </DropdownMenuItem>
                            
                            <DropdownMenuSeparator />

                            <DropdownMenuItem onSelect={() => setIsFeesOpen(true)}>
                                <CreditCard className="mr-2 h-4 w-4"/>Fees & Payment
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </header>
            
            <ItemDeleteDialog itemToDelete={itemToDelete} setItemToDelete={setItemToDelete} onConfirmDelete={handleDeleteItem} />
            
            {/* Manage Participants Dialog */}
            <Dialog open={isParticipantsOpen} onOpenChange={setIsParticipantsOpen}>
                <ParticipantsManagement />
            </Dialog>

            {/* Subject Teachers Dialog */}
            <Dialog open={isTeachersOpen} onOpenChange={setIsTeachersOpen}>
                <SubjectTeachers />
            </Dialog>
            
            {/* Fees Dialog */}
            <FeesAndPayment isOpen={isFeesOpen} onOpenChange={setIsFeesOpen} />

            {/* Classroom Settings Dialog */}
            <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Classroom Settings</DialogTitle>
                        <DialogDescription>Update the core details of your classroom.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="class-title">Class Title</Label>
                            <Input id="class-title" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} disabled={isUpdating} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="class-teacher">Main Teacher Name</Label>
                            <Input id="class-teacher" value={editTeacherName} onChange={(e) => setEditTeacherName(e.target.value)} disabled={isUpdating} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="class-desc">Description</Label>
                            <Textarea id="class-desc" value={editDescription} onChange={(e) => setEditDescription(e.target.value)} disabled={isUpdating} className="min-h-[100px] resize-none" />
                        </div>
                    </div>
                    <DialogFooter className="gap-2">
                        <Button variant="outline" onClick={() => setIsSettingsOpen(false)} disabled={isUpdating}>Cancel</Button>
                        <Button onClick={handleUpdateClassroom} disabled={isUpdating} className="btn-gel">
                            {isUpdating ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4" />}
                            Save Changes
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
