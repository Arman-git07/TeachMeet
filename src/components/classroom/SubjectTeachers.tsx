'use client';

import { useState, useEffect, useMemo } from 'react';
import { collection, query, onSnapshot, orderBy, doc, updateDoc, deleteDoc, arrayRemove } from 'firebase/firestore';
import { db, storage } from '@/lib/firebase';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useClassroom } from '@/contexts/ClassroomContext';
import { DialogContent, DialogHeader, DialogTitle, DialogDescription, Dialog, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Clock, User, Pencil, Save, Loader2, Trash2, Wallet, Copy, Info, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import Image from 'next/image';
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
import { Alert, AlertDescription } from '@/components/ui/alert';

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

    // Payment States
    const [myPaymentSettingsOpen, setMyPaymentSettingsOpen] = useState(false);
    const [payTeacherOpen, setPayTeacherOpen] = useState<SubjectTeacher | null>(null);
    const [teacherUpiId, setTeacherUpiId] = useState("");
    const [isUpdatingPayment, setIsUpdatingPayment] = useState(false);

    const isCreator = userRole === 'creator';
    const myTeacherProfile = useMemo(() => subjectTeachers.find(t => t.teacherId === user?.uid), [subjectTeachers, user]);

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

    const handleSaveMyPaymentInfo = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!user || !classroomId || !myTeacherProfile) return;
        
        setIsUpdatingPayment(true);
        const form = e.currentTarget;
        const qrInput = form.querySelector('input[type="file"]') as HTMLInputElement;
        const qrFile = qrInput?.files?.[0];

        try {
            let qrCodeUrl = myTeacherProfile.qrCodeUrl || "";
            if (qrFile) {
                const qrRef = storageRef(storage, `classrooms/${classroomId}/teacherPayments/${user.uid}/qr.png`);
                await uploadBytes(qrRef, qrFile);
                qrCodeUrl = await getDownloadURL(qrRef);
            }

            const teacherRef = doc(db, 'classrooms', classroomId, 'teachers', user.uid);
            await updateDoc(teacherRef, { upiId: teacherUpiId, qrCodeUrl });
            
            toast({ title: "Payment Info Saved", description: "The creator can now settle payments to you." });
            setMyPaymentSettingsOpen(false);
        } catch (error) {
            console.error("Save payment info failed:", error);
            toast({ variant: 'destructive', title: "Failed to save payment info" });
        } finally {
            setIsUpdatingPayment(false);
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

    const getUpiUrl = (teacher: SubjectTeacher) => {
        if (!teacher?.upiId) return null;
        const name = encodeURIComponent(teacher.name || "Teacher");
        const memo = encodeURIComponent(`TeachMeet: ${classroom?.title || "Classroom"}`);
        return `upi://pay?pa=${teacher.upiId}&pn=${name}&tn=${memo}&cu=INR`;
    };

    return (
        <>
            <DialogContent className="sm:max-w-md">
                <DialogHeader className="pb-4 border-b">
                    <div className="flex justify-between items-center">
                        <div>
                            <DialogTitle className="text-xl font-bold">Subject Teachers</DialogTitle>
                            <DialogDescription className="text-xs font-bold text-primary">
                                {isCreator ? "Manage teaching staff and settle payments." : "Meet your expert subject teachers."}
                            </DialogDescription>
                        </div>
                        {myTeacherProfile && (
                            <Button size="sm" variant="outline" className="rounded-lg h-8" onClick={() => { setTeacherUpiId(myTeacherProfile.upiId || ""); setMyPaymentSettingsOpen(true); }}>
                                <Wallet className="mr-2 h-3.5 w-3.5" /> My Payment Settings
                            </Button>
                        )}
                    </div>
                </DialogHeader>
                <ScrollArea className="max-h-[60vh]">
                    <div className="p-4 space-y-4">
                        {subjectTeachers.length > 0 ? (
                            subjectTeachers.map(t => {
                                const upiUrl = getUpiUrl(t);
                                return (
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
                                                
                                                <div className="mt-3 flex items-center justify-between gap-2">
                                                    {isCreator && t.teacherId !== user?.uid && (
                                                        <Button size="sm" className="h-8 rounded-lg btn-gel flex-1" onClick={() => setPayTeacherOpen(t)}>
                                                            <Wallet className="mr-2 h-3.5 w-3.5" /> Pay Teacher
                                                        </Button>
                                                    )}
                                                    {isCreator && (
                                                        <div className="flex gap-1">
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
                                        </div>
                                    </Card>
                                );
                            })
                        ) : (
                            <p className="text-sm text-muted-foreground text-center py-12">No subject teachers listed.</p>
                        )}
                    </div>
                </ScrollArea>
            </DialogContent>

            {/* My Payment Settings Dialog (For Teachers) */}
            <Dialog open={myPaymentSettingsOpen} onOpenChange={setMyPaymentSettingsOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>My Payment Settings</DialogTitle>
                        <DialogDescription>Add your details so the Classroom Creator can pay you.</DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleSaveMyPaymentInfo} className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="my-upi">My UPI ID</Label>
                            <Input id="my-upi" value={teacherUpiId} onChange={(e) => setTeacherUpiId(e.target.value)} placeholder="e.g. name@bank" className="rounded-xl" />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="my-qr">Payment QR Code</Label>
                            <Input id="my-qr" type="file" accept="image/*" className="rounded-xl cursor-pointer" />
                        </div>
                        <Alert className="bg-primary/5 border-primary/20 rounded-xl">
                            <Info className="h-4 w-4 text-primary" />
                            <AlertDescription className="text-[10px] font-medium leading-relaxed">Providing a UPI ID or QR code allows the classroom creator to pay you directly via standard banking apps.</AlertDescription>
                        </Alert>
                        <Button type="submit" className="w-full btn-gel rounded-xl h-11" disabled={isUpdatingPayment}>
                            {isUpdatingPayment ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4" />}
                            Save Payment Info
                        </Button>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Settle Payment Dialog (For Creator paying a Teacher) */}
            <Dialog open={!!payTeacherOpen} onOpenChange={(open) => !open && setPayTeacherOpen(null)}>
                <DialogContent className="sm:max-w-xs rounded-3xl p-6">
                    <DialogHeader>
                        <DialogTitle className="text-center text-2xl font-black text-primary">Pay Teacher</DialogTitle>
                        <DialogDescription className="text-center">Settling payment to {payTeacherOpen?.name}</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-6 pt-4">
                        {payTeacherOpen && getUpiUrl(payTeacherOpen) && (
                            <Button asChild className="w-full btn-gel h-14 text-lg rounded-2xl shadow-xl hover:shadow-primary/20 transition-all flex items-center justify-center gap-2">
                                <a href={getUpiUrl(payTeacherOpen)!}>
                                    <Wallet className="h-5 w-5" />
                                    Open Payment App
                                </a>
                            </Button>
                        )}

                        <div className="relative py-2">
                            <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
                            <div className="relative flex justify-center text-[10px] uppercase tracking-widest"><span className="bg-background px-2 text-muted-foreground font-bold">Or Manual Pay</span></div>
                        </div>

                        {payTeacherOpen?.upiId && (
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest block text-center">Teacher UPI ID</Label>
                                <div className="flex items-center gap-2 p-1.5 bg-muted/50 rounded-2xl border">
                                    <Input readOnly value={payTeacherOpen.upiId} className="bg-transparent border-none text-xs focus-visible:ring-0 shadow-none h-10" />
                                    <Button size="icon" variant="secondary" className="rounded-xl h-10 w-10 shrink-0" onClick={() => { navigator.clipboard.writeText(payTeacherOpen.upiId!); toast({ title: 'UPI ID Copied!' }); }}>
                                        <Copy className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        )}
                        
                        {payTeacherOpen?.qrCodeUrl ? (
                            <div className="space-y-4 text-center">
                                <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest block">Scan Teacher's QR</Label>
                                <div className="p-4 border-2 border-primary/10 rounded-3xl inline-block bg-white shadow-xl relative overflow-hidden">
                                    <div className="relative w-[180px] h-[180px]">
                                        <Image src={payTeacherOpen.qrCodeUrl} alt="Teacher QR" fill style={{ objectFit: 'contain' }} data-ai-hint="payment qr"/>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            !payTeacherOpen?.upiId && (
                                <Alert className="border-amber-200 bg-amber-50/50 text-amber-800 rounded-xl">
                                    <AlertCircle className="h-4 w-4 text-amber-600" />
                                    <AlertDescription className="text-xs font-medium">This teacher has not set their payment details yet.</AlertDescription>
                                </Alert>
                            )
                        )}
                    </div>
                    <div className="mt-8">
                        <DialogClose asChild><Button variant="outline" className="w-full rounded-2xl h-12 font-bold text-muted-foreground">Close Portal</Button></DialogClose>
                    </div>
                </DialogContent>
            </Dialog>

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
