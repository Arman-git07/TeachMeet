'use client';

import { useState, useEffect, useMemo } from 'react';
import { collection, query, onSnapshot, orderBy, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useClassroom } from '@/contexts/ClassroomContext';
import { DialogContent, DialogHeader, DialogTitle, DialogDescription, Dialog, DialogFooter } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Clock, User, Pencil, Save, Loader2, Trash2, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
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

export interface SubjectTeacher {
    teacherId: string;
    name: string;
    subject: string;
    availability: string;
    roleLabel?: string;
    photoURL?: string;
    upiId?: string;
    qrCodeUrl?: string;
}

export function SubjectTeachers() {
    const { classroomId, user, userRole, classroom } = useClassroom();
    const { toast } = useToast();
    const [subjectTeachers, setSubjectTeachers] = useState<SubjectTeacher[]>([]);
    
    // Editing State (for creator managing teachers)
    const [editingTeacher, setEditingTeacher] = useState<SubjectTeacher | null>(null);
    const [editName, setEditName] = useState("");
    const [editSubject, setEditSubject] = useState("");
    const [editAvailability, setEditAvailability] = useState("");
    const [isSaving, setIsSaving] = useState(false);

    const isCreator = userRole === 'creator';

    useEffect(() => {
        if (!classroomId) return;
        const q = query(collection(db, `classrooms/${classroomId}/teachers`), orderBy('addedAt', 'desc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setSubjectTeachers(snapshot.docs.map(d => ({ 
                teacherId: d.id, 
                ...d.data() 
            } as SubjectTeacher)));
        });
        return unsubscribe;
    }, [classroomId]);

    const handleStartEdit = (t: SubjectTeacher) => {
        setEditingTeacher(t);
        setEditName(t.name || "");
        setEditSubject(t.subject || "");
        setEditAvailability(t.availability || "");
    };

    const handleUpdateTeacher = async () => {
        if (!editingTeacher || !classroomId) return;
        setIsSaving(true);
        try {
            const teacherRef = doc(db, 'classrooms', classroomId, 'teachers', editingTeacher.teacherId);
            await updateDoc(teacherRef, { name: editName, subject: editSubject, availability: editAvailability });
            toast({ title: "Teacher Details Updated" });
            setEditingTeacher(null);
        } catch (error) {
            toast({ variant: 'destructive', title: "Update Failed" });
        } finally {
            setIsSaving(false);
        }
    };

    const handleRemoveTeacher = async (t: SubjectTeacher) => {
        if (!classroomId) return;
        try {
            await deleteDoc(doc(db, 'classrooms', classroomId, 'teachers', t.teacherId));
            await deleteDoc(doc(db, 'classrooms', classroomId, 'participants', t.teacherId));
            toast({ title: "Teacher Removed" });
        } catch (error) {
            toast({ variant: 'destructive', title: "Removal Failed" });
        }
    };

    return (
        <>
            <DialogContent className="sm:max-w-md">
                <DialogHeader className="pb-4 border-b">
                    <DialogTitle className="text-xl font-bold">Subject Teachers</DialogTitle>
                    <DialogDescription className="text-xs font-bold text-primary">
                        {isCreator ? "Manage teaching staff and settle payments." : "Meet your expert subject teachers."}
                    </DialogDescription>
                </DialogHeader>
                <ScrollArea className="max-h-[60vh]">
                    <div className="p-4 space-y-4">
                        {subjectTeachers.length > 0 ? (
                            subjectTeachers.map(t => (
                                <Card key={t.teacherId} className="overflow-hidden border shadow-sm rounded-xl transition-all hover:shadow-md group">
                                    <div className="p-4 flex items-start gap-4">
                                        <Avatar className="h-12 w-12 border-2 border-primary/10">
                                            <AvatarImage src={t.photoURL} data-ai-hint="avatar user"/>
                                            <AvatarFallback><User className="h-6 w-6" /></AvatarFallback>
                                        </Avatar>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex justify-between items-start gap-2">
                                                <div className="min-w-0">
                                                    <h3 className="font-bold text-base truncate text-foreground">{t.name}</h3>
                                                    <div className="flex items-center gap-1.5 text-muted-foreground mt-0.5">
                                                        <Clock className="h-3 w-3 text-primary/70 shrink-0" />
                                                        <p className="text-xs italic truncate" title={t.availability}>{t.availability}</p>
                                                    </div>
                                                </div>
                                                <Badge variant="secondary" className="text-[10px] uppercase font-bold tracking-wider px-2 h-5 max-w-[100px] truncate">
                                                    {t.subject}
                                                </Badge>
                                            </div>
                                            
                                            {isCreator && (
                                                <div className="mt-3 flex items-center justify-end gap-1">
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => handleStartEdit(t)} title="Edit details"><Pencil className="h-3.5 w-3.5" /></Button>
                                                    <AlertDialog>
                                                        <AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-destructive" title="Remove teacher"><Trash2 className="h-3.5 w-3.5" /></Button></AlertDialogTrigger>
                                                        <AlertDialogContent>
                                                            <AlertDialogHeader><AlertDialogTitle>Remove Teacher?</AlertDialogTitle><AlertDialogDescription>This will remove <strong>{t.name}</strong> from the classroom staff.</AlertDialogDescription></AlertDialogHeader>
                                                            <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => handleRemoveTeacher(t)} className="bg-destructive text-white">Remove</AlertDialogAction></AlertDialogFooter>
                                                        </AlertDialogContent>
                                                    </AlertDialog>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </Card>
                            ))
                        ) : (
                            <p className="text-sm text-muted-foreground text-center py-12">No subject teachers listed.</p>
                        )}
                    </div>
                </ScrollArea>
            </DialogContent>

            {/* Edit Teacher Details Dialog (Creator only) */}
            <Dialog open={!!editingTeacher} onOpenChange={(open) => !open && setEditingTeacher(null)}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Edit Teacher Details</DialogTitle>
                        <DialogDescription>Updating details for {editingTeacher?.name}</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="edit-name">Display Name</Label>
                            <Input id="edit-name" value={editName} onChange={(e) => setEditName(e.target.value)} disabled={isSaving} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="edit-subject">Subject of Expertise</Label>
                            <Input id="edit-subject" value={editSubject} onChange={(e) => setEditSubject(e.target.value)} disabled={isSaving} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="edit-availability">Availability</Label>
                            <Textarea id="edit-availability" value={editAvailability} onChange={(e) => setEditAvailability(e.target.value)} className="min-h-[100px] resize-none" disabled={isSaving} />
                        </div>
                    </div>
                    <DialogFooter className="gap-2">
                        <Button variant="outline" onClick={() => setEditingTeacher(null)} disabled={isSaving}>Cancel</Button>
                        <Button onClick={handleUpdateTeacher} disabled={isSaving} className="btn-gel">
                            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4" />}
                            Save Details
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
