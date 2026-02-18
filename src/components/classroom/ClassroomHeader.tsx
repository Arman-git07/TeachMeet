'use client';

import { useState, useCallback, memo } from 'react';
import { useRouter } from 'next/navigation';
import { useClassroom } from '@/contexts/ClassroomContext';
import { canManage } from '@/lib/roles';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { ArrowLeft, MoreVertical, Users, Briefcase, CreditCard, UserPlus, MessageSquare, Star, Settings } from 'lucide-react';
import { ParticipantsManagement } from './ParticipantsManagement';
import { SubjectTeachers } from './SubjectTeachers';
import { FeesAndPayment } from './FeesAndPayment';
import type { DeletableItem } from '@/app/dashboard/classrooms/[classroomId]/page';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
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
    const { classroomId, userRole } = useClassroom();
    const router = useRouter();
    const { toast } = useToast();
    const canUserManage = canManage(userRole);

    const [itemToDelete, setItemToDelete] = useState<DeletableItem | null>(null);
    const [isParticipantsOpen, setIsParticipantsOpen] = useState(false);
    const [isTeachersOpen, setIsTeachersOpen] = useState(false);
    const [isFeesOpen, setIsFeesOpen] = useState(false);
    const [isReviewDialogOpen, setIsReviewDialogOpen] = useState(false);

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

    const handleClassChatClick = () => {
        toast({
            title: "Feature Under Development",
            description: "The Class Chat feature is coming soon! Thank you for your support.",
        });
        setIsReviewDialogOpen(true);
    };

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
                            {userRole === 'creator' && (
                                <>
                                    <DropdownMenuItem asChild>
                                        <Link href={`/dashboard/classrooms/${classroomId}/requests`}>
                                            <UserPlus className="mr-2 h-4 w-4"/>Join Requests
                                        </Link>
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                </>
                            )}

                            {canUserManage && (
                                <DropdownMenuItem onSelect={() => setIsParticipantsOpen(true)}>
                                    <Users className="mr-2 h-4 w-4"/>Manage Participants
                                </DropdownMenuItem>
                            )}
                            
                            <DropdownMenuItem onSelect={handleClassChatClick}>
                                <MessageSquare className="mr-2 h-4 w-4"/>Class Chat
                            </DropdownMenuItem>

                            <DropdownMenuItem onSelect={() => setIsTeachersOpen(true)}>
                                <Briefcase className="mr-2 h-4 w-4"/>Subject Teachers
                            </DropdownMenuItem>
                            
                            <DropdownMenuSeparator />

                            <DropdownMenuItem onSelect={() => setIsFeesOpen(true)}>
                                <CreditCard className="mr-2 h-4 w-4"/>Fees & Payment
                            </DropdownMenuItem>

                            {userRole === 'creator' && (
                                <DropdownMenuItem asChild>
                                    <Link href="/dashboard/settings">
                                        <Settings className="mr-2 h-4 w-4"/>Class Settings
                                    </Link>
                                </DropdownMenuItem>
                            )}
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

            {/* Review Dialog */}
            <Dialog open={isReviewDialogOpen} onOpenChange={setIsReviewDialogOpen}>
                <DialogContent className="sm:max-w-md rounded-2xl p-6 overflow-hidden border-none shadow-2xl">
                    <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-primary via-accent to-primary" />
                    <DialogHeader className="space-y-3 pt-4">
                        <div className="mx-auto bg-primary/10 w-20 h-20 rounded-full flex items-center justify-center mb-2 shadow-inner">
                            <Star className="h-10 w-10 text-primary fill-primary animate-pulse" />
                        </div>
                        <DialogTitle className="text-2xl font-bold text-center">Enjoying TeachMeet?</DialogTitle>
                        <DialogDescription className="text-center text-base leading-relaxed">
                            The <span className="font-bold text-primary">Class Chat</span> feature is currently under construction. 🏗️
                            <br /><br />
                            While we work on it, would you mind taking a moment to support us with a review on the Play Store?
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex flex-col sm:flex-row gap-3 mt-8">
                        <Button variant="outline" onClick={() => setIsReviewDialogOpen(false)} className="flex-1 rounded-xl h-12 text-muted-foreground font-semibold border-muted-foreground/20 hover:bg-muted/50">
                            Maybe Later
                        </Button>
                        <Button 
                            onClick={() => {
                                window.open('https://play.google.com/store/apps/details?id=com.teachmeet.3d', '_blank');
                                setIsReviewDialogOpen(false);
                            }} 
                            className="flex-1 btn-gel rounded-xl h-12 text-lg font-bold shadow-lg hover:shadow-primary/30"
                        >
                            Yes, I'll Review!
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}