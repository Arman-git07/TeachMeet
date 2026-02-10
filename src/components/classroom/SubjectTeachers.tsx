
'use client';

import { useState, useEffect } from 'react';
import { collection, query, onSnapshot, orderBy, doc, updateDoc, deleteDoc, arrayRemove, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useClassroom } from '@/contexts/ClassroomContext';
import { DialogContent, DialogHeader, DialogTitle, DialogDescription, Dialog, DialogFooter } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Clock, User, Pencil, Save, Loader2, Trash2, ShieldAlert } from 'lucide-react';
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
}

export function SubjectTeachers() {
    const { classroomId, userRole, classroom } = useClassroom();
    const { toast } = useToast();
    const [subjectTeachers, setSubjectTeachers] = useState<SubjectTeacher[]>([]);
    
    // Editing State
    const [editingTeacher, setEditingTeacher] = useState<SubjectTeacher | null>(null);
    const [editName, setEditName] = useState("");
    const [editSubject, setEditSubject] = useState("");
    const [editAvailability, setEditAvailability] = useState("");
    const [editRoleLabel, setEditRoleLabel] = useState("");
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
        setEditRoleLabel(t.roleLabel || "Teacher");
    };

    const handleUpdateTeacher = async () => {
        if (!editingTeacher || !classroomId) return;
        
        setIsSaving(true);
        try {
            const teacherRef = doc(db, 'classrooms', classroomId, 'teachers', editingTeacher.teacherId);
            const updateData = {
                name: editName,
                subject: editSubject,
                availability: editAvailability,
                roleLabel: editRoleLabel
            };
            
            await updateDoc(teacherRef, updateData);

            // Also update the teacher in the main classroom array if it exists there
            if (classroom?.teachers) {
                const updatedTeachers = classroom.teachers.map((t: any) => 
                    t.uid === editingTeacher.teacherId ? { ...t, name: editName } : t
                );
                await updateDoc(doc(db, 'classrooms', classroomId), { teachers: updatedTeachers });
            }

            toast({ title: "Teacher Details Updated" });
            setEditingTeacher(null);
        } catch (error) {
            console.error("Update failed:", error);
            toast({ variant: 'destructive', title: "Update Failed" });
        } finally {
            setIsSaving(false);
        }
    };

    const handleRemoveTeacher = async (t: SubjectTeacher) => {
        if (!classroomId) return;
        try {
            const teacherRef = doc(db, 'classrooms', classroomId, 'teachers', t.teacherId);
            const classroomRef = doc(db, 'classrooms', classroomId);
            const participantRef = doc(db, 'classrooms', classroomId, 'participants', t.teacherId);

            await deleteDoc(teacherRef);
            await deleteDoc(participantRef);
            
            // Remove from classroom array
            if (classroom?.teachers) {
                const teacherObj = classroom.teachers.find((item: any) => item.uid === t.teacherId);
                if (teacherObj) {
                    await updateDoc(classroomRef, { teachers: arrayRemove(teacherObj) });
                }
            }

            toast({ title: "Teacher Removed" });
        } catch (error) {
            console.error("Removal failed:", error);
            toast({ variant: 'destructive', title: "Removal Failed" });
        }
    };

    return (
        <>
            <DialogContent className="sm:max-w-md">
                <DialogHeader className="pb-4 border-b">
                    <DialogTitle className="text-xl font-bold">Subject Teachers</DialogTitle>
                    <DialogDescription className="text-xs font-bold text-primary">
                        {isCreator ? "Manage and edit teacher details below." : "View the expert teachers available in this classroom."}
                    </DialogDescription>
                </DialogHeader>
                <ScrollArea className="max-h-[60vh]">
                    <div className="p-4 space-y-4">
                        {subjectTeachers.length > 0 ? (
                            subjectTeachers.map(t => (
                                <Card key={t.teacherId} className="overflow-hidden border shadow-sm rounded-xl transition-all hover:shadow-md hover:border-primary/20 group">
                                    <div className="p-4 flex items-start gap-4">
                                        <Avatar className="h-12 w-12 border-2 border-primary/10">
                                            <AvatarImage src={t.photoURL} data-ai-hint="avatar user"/>
                                            <AvatarFallback className="bg-primary/5 text-primary">
                                                <User className="h-6 w-6" />
                                            </AvatarFallback>
                                        </Avatar>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between gap-2 mb-1">
                                                <h3 className="font-bold text-base truncate text-foreground">{t.name}</h3>
                                                <Badge variant="secondary" className="text-[10px] uppercase font-bold tracking-wider px-2 h-5">
                                                    {t.roleLabel || "Teacher"}
                                                </Badge>
                                            </div>
                                            <p className="text-sm font-semibold text-primary mb-3">
                                                {t.subject}
                                            </p>
                                            
                                            <div className="bg-muted/30 rounded-lg p-3 border border-border/50 relative">
                                                <div className="flex items-center gap-2 text-muted-foreground">
                                                    <Clock className="h-3.5 w-3.5 text-primary" />
                                                    <span className="text-[10px] font-black uppercase tracking-widest">Availability</span>
                                                </div>
                                                <p className="text-sm text-foreground/80 mt-1 italic leading-relaxed">
                                                    {t.availability}
                                                </p>
                                                
                                                {isCreator && (
                                                    <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <Button 
                                                            variant="ghost" 
                                                            size="icon" 
                                                            className="h-7 w-7 rounded-full bg-background/80 shadow-sm"
                                                            onClick={() => handleStartEdit(t)}
                                                            title="Edit details"
                                                        >
                                                            <Pencil className="h-3.5 w-3.5" />
                                                        </Button>
                                                        <AlertDialog>
                                                            <AlertDialogTrigger asChild>
                                                                <Button 
                                                                    variant="ghost" 
                                                                    size="icon" 
                                                                    className="h-7 w-7 rounded-full bg-background/80 shadow-sm text-destructive hover:text-destructive"
                                                                    title="Remove teacher"
                                                                >
                                                                    <Trash2 className="h-3.5 w-3.5" />
                                                                </Button>
                                                            </AlertDialogTrigger>
                                                            <AlertDialogContent>
                                                                <AlertDialogHeader>
                                                                    <AlertDialogTitle>Remove Teacher?</AlertDialogTitle>
                                                                    <AlertDialogDescription>
                                                                        This will remove <strong>{t.name}</strong> from the classroom teaching staff.
                                                                    </AlertDialogDescription>
                                                                </AlertDialogHeader>
                                                                <AlertDialogFooter>
                                                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                                    <AlertDialogAction onClick={() => handleRemoveTeacher(t)} className="bg-destructive text-white">Remove</AlertDialogAction>
                                                                </AlertDialogFooter>
                                                            </AlertDialogContent>
                                                        </AlertDialog>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </Card>
                            ))
                        ) : (
                            <div className="text-center py-12 px-4">
                                <div className="h-16 w-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4 opacity-50">
                                    <User className="h-8 w-8 text-muted-foreground" />
                                </div>
                                <p className="text-sm font-medium text-muted-foreground">No subject teachers listed.</p>
                                <p className="text-xs text-muted-foreground/60 mt-1">The classroom owner can add teachers here.</p>
                            </div>
                        )}
                    </div>
                </ScrollArea>
            </DialogContent>

            {/* Edit Details Dialog */}
            <Dialog open={!!editingTeacher} onOpenChange={(open) => !open && setEditingTeacher(null)}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Edit Teacher Details</DialogTitle>
                        <DialogDescription>Updating details for {editingTeacher?.name}</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="edit-name">Display Name</Label>
                            <Input 
                                id="edit-name" 
                                value={editName} 
                                onChange={(e) => setEditName(e.target.value)} 
                                placeholder="Teacher's Full Name"
                                disabled={isSaving}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="edit-role">Role Label (e.g. Teacher, Lecturer)</Label>
                            <Input 
                                id="edit-role" 
                                value={editRoleLabel} 
                                onChange={(e) => setEditRoleLabel(e.target.value)} 
                                placeholder="Teacher"
                                disabled={isSaving}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="edit-subject">Subject of Expertise</Label>
                            <Input 
                                id="edit-subject" 
                                value={editSubject} 
                                onChange={(e) => setEditSubject(e.target.value)} 
                                placeholder="e.g., Mathematics"
                                disabled={isSaving}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="edit-availability">Availability</Label>
                            <Textarea 
                                id="edit-availability" 
                                value={editAvailability} 
                                onChange={(e) => setEditAvailability(e.target.value)} 
                                placeholder="e.g., Weekdays 5-8 PM"
                                className="min-h-[100px] resize-none"
                                disabled={isSaving}
                            />
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
