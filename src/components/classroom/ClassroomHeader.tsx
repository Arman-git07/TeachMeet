'use client';

import { useState, useCallback, memo } from 'react';
import { useRouter } from 'next/navigation';
import { useClassroom } from '@/contexts/ClassroomContext';
import { canManage } from '@/lib/roles';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { ArrowLeft, MoreVertical, Users, Briefcase, CreditCard, UserPlus } from 'lucide-react';
import { ParticipantsManagement } from './ParticipantsManagement';
import { SubjectTeachers } from './SubjectTeachers';
import { FeesAndPayment } from './FeesAndPayment';
import type { DeletableItem } from '@/app/dashboard/classrooms/[classroomId]/page';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { deleteDoc, doc } from 'firebase/firestore';
import { db, storage } from '@/lib/firebase';
import { deleteObject, ref } from 'firebase/storage';
import Link from 'next/link';

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
    const [itemToDelete, setItemToDelete] = useState<DeletableItem | null>(null);
    
    const [isParticipantsOpen, setIsParticipantsOpen] = useState(false);
    const [isTeachersOpen, setIsTeachersOpen] = useState(false);
    const [isFeesOpen, setIsFeesOpen] = useState(false);


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
            <header className="mb-6 px-4 md:px-8 pt-4 flex items-center justify-between flex-shrink-0">
                <div>
                    <Button variant="link" onClick={() => router.push('/dashboard/classrooms')} className="p-0 mb-2 text-muted-foreground"><ArrowLeft className="mr-2 h-4 w-4" />Back to classrooms</Button>
                    <h1 className="text-4xl font-bold">{classroom.title}</h1>
                    <p className="text-lg text-muted-foreground">{classroom.description}</p>
                    <p className="text-sm text-muted-foreground">Taught by: {classroom.teacherName}</p>
                </div>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreVertical className="h-5 w-5" /></Button></DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
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
            </header>
            
            <ItemDeleteDialog itemToDelete={itemToDelete} setItemToDelete={setItemToDelete} onConfirmDelete={handleDeleteItem} />
            
            <Dialog open={isParticipantsOpen} onOpenChange={setIsParticipantsOpen}>
                <ParticipantsManagement />
            </Dialog>

            <Dialog open={isTeachersOpen} onOpenChange={setIsTeachersOpen}>
                <SubjectTeachers />
            </Dialog>
            
            <Dialog open={isFeesOpen} onOpenChange={setIsFeesOpen}>
                <FeesAndPayment />
            </Dialog>
        </>
    );
}
