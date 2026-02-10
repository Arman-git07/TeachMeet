'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { useClassroom } from '@/contexts/ClassroomContext';
import { useToast } from '@/hooks/use-toast';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { doc, updateDoc, collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db, storage } from '@/lib/firebase';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogClose } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { IndianRupee, DollarSign, Euro, PoundSterling, Settings, Copy, Info, AlertCircle, Loader2, Wallet, CheckCircle, Briefcase, Save, Upload } from 'lucide-react';
import Image from 'next/image';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import type { SubjectTeacher } from './SubjectTeachers';

const feeSchema = z.object({
  amount: z.coerce.number().positive({ message: "Amount must be positive." }),
  currency: z.string().min(1, { message: "Currency is required." }),
});

const paymentDetailsSchema = z.object({
  upiId: z.string().optional(),
  qrCode: z.any().optional(),
});

interface FeesAndPaymentProps {
    isOpen: boolean;
    onOpenChange: (isOpen: boolean) => void;
}

export function FeesAndPayment({ isOpen, onOpenChange }: FeesAndPaymentProps) {
    const { classroom, classroomId, user, userRole } = useClassroom();
    const { toast } = useToast();

    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isPayNowOpen, setIsPayNowOpen] = useState(false);
    const [isUpdating, setIsUpdating] = useState(false);
    
    // Teacher States
    const [teachers, setTeachers] = useState<SubjectTeacher[]>([]);
    const [payTeacherOpen, setPayTeacherOpen] = useState<SubjectTeacher | null>(null);
    const [teacherUpiId, setTeacherUpiId] = useState("");
    const [teacherQrFile, setTeacherQrFile] = useState<File | null>(null);

    const isTeacher = userRole === 'teacher';
    const isCreator = userRole === 'creator';

    const feeForm = useForm<z.infer<typeof feeSchema>>({ 
        resolver: zodResolver(feeSchema), 
        defaultValues: { 
            amount: classroom?.feeAmount || 0, 
            currency: classroom?.feeCurrency || 'INR' 
        } 
    });
    
    const paymentDetailsForm = useForm<z.infer<typeof paymentDetailsSchema>>({ 
        resolver: zodResolver(paymentDetailsSchema), 
        defaultValues: { 
            upiId: classroom?.paymentDetails?.upiId || '', 
            qrCode: null 
        } 
    });

    // Fetch teachers for payroll (Creator only)
    useEffect(() => {
        if (!classroomId || !isCreator) return;
        const q = query(collection(db, `classrooms/${classroomId}/teachers`), orderBy('addedAt', 'desc'));
        return onSnapshot(q, (snap) => {
            setTeachers(snap.docs.map(d => ({ teacherId: d.id, ...d.data() } as SubjectTeacher)));
        });
    }, [classroomId, isCreator]);

    // Fetch personal profile for assistant teachers to populate UPI
    useEffect(() => {
        if (!classroomId || !user || !isTeacher) return;
        const teacherRef = doc(db, 'classrooms', classroomId, 'teachers', user.uid);
        return onSnapshot(teacherRef, (snap) => {
            if (snap.exists()) {
                setTeacherUpiId(snap.data().upiId || "");
            }
        });
    }, [classroomId, user, isTeacher]);

    const currencySymbols = useMemo(() => ({
        INR: <IndianRupee className="h-6 w-6" />, 
        USD: <DollarSign className="h-6 w-6" />, 
        EUR: <Euro className="h-6 w-6" />, 
        GBP: <PoundSterling className="h-6 w-6" />,
    }), []);

    const upiUrl = useMemo(() => {
        if (!classroom?.paymentDetails?.upiId) return null;
        const vpa = classroom.paymentDetails.upiId;
        const name = encodeURIComponent(classroom.title || "TeachMeet Classroom");
        const amount = classroom.feeAmount || 0;
        const currency = classroom.feeCurrency || "INR";
        return `upi://pay?pa=${vpa}&pn=${name}&am=${amount}&cu=${currency}&tn=${name}`;
    }, [classroom]);

    const getTeacherUpiUrl = (teacher: SubjectTeacher) => {
        if (!teacher?.upiId) return null;
        const name = encodeURIComponent(teacher.name || "Teacher");
        const memo = encodeURIComponent(`TeachMeet: ${classroom?.title || "Classroom"}`);
        return `upi://pay?pa=${teacher.upiId}&pn=${name}&tn=${memo}&cu=INR`;
    };

    const onFeeSubmit = useCallback(async (data: z.infer<typeof feeSchema>) => {
        setIsUpdating(true);
        try {
            await updateDoc(doc(db, 'classrooms', classroomId), { 
                feeAmount: data.amount, 
                feeCurrency: data.currency 
            });
            toast({ title: 'Fee Details Updated!' });
            setIsSettingsOpen(false);
        } catch (error) {
            toast({ variant: 'destructive', title: 'Update Failed' });
        } finally {
            setIsUpdating(false);
        }
    }, [classroomId, toast]);

    const onPaymentDetailsSubmit = useCallback(async (data: z.infer<typeof paymentDetailsSchema>) => {
        let qrCodeUrl = classroom?.paymentDetails?.qrCodeUrl || "";
        const hasNewFile = data.qrCode && data.qrCode.length > 0;

        if (!data.upiId?.trim() && !qrCodeUrl && !hasNewFile) {
            toast({ variant: 'destructive', title: "Setup Required", description: "Provide a UPI ID or upload a QR Code." });
            return;
        }

        setIsUpdating(true);
        try {
            if (hasNewFile) {
                const file = data.qrCode[0];
                const qrRef = storageRef(storage, `classrooms/${classroomId}/paymentQR.png`);
                await uploadBytes(qrRef, file);
                qrCodeUrl = await getDownloadURL(qrRef);
            }
            await updateDoc(doc(db, 'classrooms', classroomId), { 
                paymentDetails: { upiId: data.upiId?.trim() || "", qrCodeUrl } 
            });
            toast({ title: 'Payment Details Updated!' });
            setIsSettingsOpen(false);
        } catch (error: any) {
             toast({ variant: 'destructive', title: "Update Failed" });
        } finally {
            setIsUpdating(false);
        }
    }, [classroomId, classroom?.paymentDetails?.qrCodeUrl, toast]);

    const handleSaveTeacherPaymentInfo = async () => {
        if (!user || !classroomId || !isTeacher) return;
        setIsUpdating(true);
        try {
            let qrCodeUrl = "";
            if (teacherQrFile) {
                const qrRef = storageRef(storage, `classrooms/${classroomId}/teacherPayments/${user.uid}/qr.png`);
                await uploadBytes(qrRef, teacherQrFile);
                qrCodeUrl = await getDownloadURL(qrRef);
            }

            const teacherRef = doc(db, 'classrooms', classroomId, 'teachers', user.uid);
            const updateData: any = { upiId: teacherUpiId };
            if (qrCodeUrl) updateData.qrCodeUrl = qrCodeUrl;
            
            await updateDoc(teacherRef, updateData);
            toast({ title: "Details Saved", description: "The Classroom Creator can now pay you directly." });
        } catch (error) {
            toast({ variant: 'destructive', title: "Save Failed" });
        } finally {
            setIsUpdating(false);
        }
    };

    if (!classroom) return null;

    return (
        <>
            <Dialog open={isOpen} onOpenChange={onOpenChange}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Classroom Finances</DialogTitle>
                        <DialogDescription>View fees and manage payments for this classroom.</DialogDescription>
                    </DialogHeader>
                    <ScrollArea className="max-h-[70vh] -mx-6 px-6">
                        <div className="space-y-6 py-4">
                            {/* Card 1: Student Fee Summary - Hidden for Subject Teachers */}
                            {!isTeacher && (
                                <Card className="border shadow-sm rounded-xl">
                                    <CardHeader className="pb-3">
                                        <div className="flex justify-between items-center">
                                            <CardTitle className="text-xl">Fee Summary</CardTitle>
                                            {isCreator && (
                                                <Button variant="ghost" size="icon" onClick={() => setIsSettingsOpen(true)} className="rounded-full">
                                                    <Settings className="h-5 w-5 text-muted-foreground" />
                                                </Button>
                                            )}
                                        </div>
                                    </CardHeader>
                                    <CardContent className="text-center">
                                        <p className="text-muted-foreground mb-3 text-sm">Student Fee Amount</p>
                                        <div className="flex justify-center items-center gap-3">
                                            <div className="text-primary p-2 bg-primary/10 rounded-full">
                                                {currencySymbols[classroom.feeCurrency as keyof typeof currencySymbols] || <IndianRupee className="h-6 w-6" />}
                                            </div>
                                            <p className="font-black text-4xl tracking-tighter">{classroom.feeAmount?.toLocaleString() || '0.00'}</p>
                                            <Badge variant="secondary" className="font-bold px-3 py-1">{classroom.feeCurrency || 'INR'}</Badge>
                                        </div>
                                        
                                        {(!classroom.paymentDetails?.upiId && !classroom.paymentDetails?.qrCodeUrl) ? (
                                            <Alert className="mt-6 border-amber-200 bg-amber-50/50 text-amber-800 rounded-xl">
                                                <AlertCircle className="h-4 w-4 text-amber-600" />
                                                <AlertDescription className="text-xs font-medium">The teacher has not yet configured a payment method.</AlertDescription>
                                            </Alert>
                                        ) : !isCreator && (
                                            <Button 
                                                className="w-full btn-gel mt-6 h-12 text-lg rounded-2xl shadow-lg hover:shadow-primary/20 transition-all" 
                                                onClick={() => setIsPayNowOpen(true)}
                                            >
                                                Settle Payment
                                            </Button>
                                        )}
                                    </CardContent>
                                </Card>
                            )}

                            {/* Card 2: Assistant Teacher's own Payment Setup */}
                            {isTeacher && (
                                <Card className="border-2 border-accent/20 bg-accent/5 rounded-2xl shadow-sm">
                                    <CardHeader className="pb-3">
                                        <CardTitle className="text-lg flex items-center gap-2">
                                            <Wallet className="h-5 w-5 text-accent" /> My Receiving Details
                                        </CardTitle>
                                        <CardDescription className="text-xs">Provide details for the creator to pay you.</CardDescription>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        <div className="space-y-2">
                                            <Label className="text-xs font-bold">My UPI ID</Label>
                                            <Input 
                                                value={teacherUpiId} 
                                                onChange={(e) => setTeacherUpiId(e.target.value)} 
                                                placeholder="name@bank" 
                                                className="rounded-xl h-10 bg-background" 
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-xs font-bold">My QR Code (Optional)</Label>
                                            <Input 
                                                type="file" 
                                                accept="image/*" 
                                                onChange={(e) => setTeacherQrFile(e.target.files?.[0] || null)}
                                                className="rounded-xl h-10 bg-background file:rounded-full file:border-0 file:text-xs file:bg-accent/10 file:text-accent cursor-pointer" 
                                            />
                                        </div>
                                        <Button 
                                            onClick={handleSaveTeacherPaymentInfo} 
                                            className="w-full bg-accent hover:bg-accent/90 text-accent-foreground rounded-xl"
                                            disabled={isUpdating}
                                        >
                                            {isUpdating ? <Loader2 className="h-4 w-4 animate-spin mr-2"/> : <Save className="h-4 w-4 mr-2"/>}
                                            Save My Details
                                        </Button>
                                    </CardContent>
                                </Card>
                            )}

                            {/* Card 3: Creator's Payroll View */}
                            {isCreator && (
                                <Card className="border-2 border-primary/10 bg-primary/5 rounded-2xl shadow-sm">
                                    <CardHeader className="pb-3">
                                        <CardTitle className="text-lg flex items-center gap-2">
                                            <Briefcase className="h-5 w-5 text-primary" /> Teacher Payroll
                                        </CardTitle>
                                        <CardDescription className="text-xs">Settle payments to your teaching staff.</CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="space-y-3">
                                            {teachers.filter(t => t.teacherId !== user?.uid).length > 0 ? (
                                                teachers.filter(t => t.teacherId !== user?.uid).map(t => (
                                                    <div key={t.teacherId} className="flex items-center justify-between p-3 bg-background rounded-xl border shadow-sm">
                                                        <div className="flex items-center gap-3 min-w-0">
                                                            <Avatar className="h-8 w-8 shrink-0">
                                                                <AvatarImage src={t.photoURL} data-ai-hint="avatar user"/>
                                                                <AvatarFallback>{t.name.charAt(0)}</AvatarFallback>
                                                            </Avatar>
                                                            <div className="min-w-0">
                                                                <p className="text-sm font-bold truncate">{t.name}</p>
                                                                <p className="text-[10px] text-muted-foreground uppercase truncate">{t.subject}</p>
                                                            </div>
                                                        </div>
                                                        <Button size="sm" variant="outline" className="h-8 text-xs rounded-lg flex-shrink-0" onClick={() => setPayTeacherOpen(t)}>
                                                            Pay
                                                        </Button>
                                                    </div>
                                                ))
                                            ) : (
                                                <div className="text-center py-6">
                                                    <Briefcase className="mx-auto h-8 w-8 text-muted-foreground opacity-20 mb-2" />
                                                    <p className="text-xs text-muted-foreground italic">No other teachers to pay yet.</p>
                                                </div>
                                            )}
                                        </div>
                                    </CardContent>
                                </Card>
                            )}
                        </div>
                    </ScrollArea>
                </DialogContent>
            </Dialog>

            {/* Creator Control Panel Dialog */}
            {isCreator && (
                <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
                    <DialogContent className="sm:max-w-lg">
                        <DialogHeader>
                            <DialogTitle>Creator Control Panel</DialogTitle>
                            <DialogDescription>Configure fees for students.</DialogDescription>
                        </DialogHeader>
                        <ScrollArea className="max-h-[75vh] -mx-6 px-6">
                            <div className="space-y-8 py-6">
                                <form onSubmit={feeForm.handleSubmit(onFeeSubmit)} className="space-y-4 p-5 border rounded-2xl bg-muted/20">
                                    <h4 className="font-black text-xs uppercase tracking-widest flex items-center gap-2 text-muted-foreground">
                                        <IndianRupee className="h-4 w-4 text-primary" /> 1. Student Fee
                                    </h4>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label className="text-xs font-bold">Total Amount</Label>
                                            <Input type="number" {...feeForm.register('amount')} className="rounded-xl h-11" placeholder="0.00" />
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-xs font-bold">Currency</Label>
                                            <Controller name="currency" control={feeForm.control} render={({ field }) => (
                                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                    <SelectTrigger className="rounded-xl h-11"><SelectValue/></SelectTrigger>
                                                    <SelectContent className="rounded-xl">
                                                        <SelectItem value="INR">INR (₹)</SelectItem>
                                                        <SelectItem value="USD">USD ($)</SelectItem>
                                                        <SelectItem value="EUR">EUR (€)</SelectItem>
                                                        <SelectItem value="GBP">GBP (£)</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            )} />
                                        </div>
                                    </div>
                                    <Button type="submit" size="sm" className="w-full rounded-xl" disabled={isUpdating}>Save Amount</Button>
                                </form>

                                <form onSubmit={paymentDetailsForm.handleSubmit(onPaymentDetailsSubmit)} className="space-y-5 p-5 border-2 border-primary/20 rounded-2xl bg-primary/5">
                                    <h4 className="font-black text-xs uppercase tracking-widest flex items-center gap-2 text-primary">
                                        <Copy className="h-4 w-4" /> 2. Creator Payment Details
                                    </h4>
                                    <p className="text-[11px] leading-relaxed text-muted-foreground font-medium">Add your UPI or QR so students can pay the classroom fee.</p>
                                    <div className="space-y-2">
                                        <Label className="text-xs font-bold">Your UPI ID</Label>
                                        <Input {...paymentDetailsForm.register('upiId')} placeholder="e.g. name@bank" className="rounded-xl h-11 bg-background" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-xs font-bold">Your QR Code</Label>
                                        <Input type="file" accept="image/*" {...paymentDetailsForm.register('qrCode')} className="rounded-xl h-11 bg-background file:rounded-full file:border-0 file:text-xs file:bg-primary/10 file:text-primary cursor-pointer" />
                                    </div>
                                    <Button type="submit" className="w-full btn-gel h-12 text-base rounded-xl" disabled={isUpdating}>
                                        {isUpdating ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : null}
                                        Update Creator Gateway
                                    </Button>
                                </form>
                            </div>
                        </ScrollArea>
                    </DialogContent>
                </Dialog>
            )}

            {/* Pay Teacher Dialog (For Creator paying a Teacher) */}
            <Dialog open={!!payTeacherOpen} onOpenChange={(open) => !open && setPayTeacherOpen(null)}>
                <DialogContent className="sm:max-w-xs rounded-3xl p-6">
                    <DialogHeader className="mb-4">
                        <DialogTitle className="text-center text-2xl font-black text-primary">Pay Teacher</DialogTitle>
                        <DialogDescription className="text-center">Settling payment to {payTeacherOpen?.name}</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-6 pt-4">
                        {payTeacherOpen && getTeacherUpiUrl(payTeacherOpen) && (
                            <Button asChild className="w-full btn-gel h-14 text-lg rounded-2xl shadow-xl hover:shadow-primary/20 transition-all flex items-center justify-center gap-2">
                                <a href={getTeacherUpiUrl(payTeacherOpen)!}>
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
                                        <Image src={payTeacherOpen.qrCodeUrl} alt="Teacher QR" fill style={{ objectFit: 'contain' }} data-ai-hint="payment qr" />
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

            {/* Student Payment Dialog */}
            <Dialog open={isPayNowOpen} onOpenChange={setIsPayNowOpen}>
                <DialogContent className="sm:max-w-xs rounded-3xl p-6">
                    <DialogHeader className="mb-4">
                        <DialogTitle className="text-center text-2xl font-black text-primary">Settle Payment</DialogTitle>
                        <DialogDescription className="text-center font-medium">Pay to the classroom account.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-6">
                        {upiUrl && (
                            <Button asChild className="w-full btn-gel h-14 text-lg rounded-2xl shadow-xl hover:shadow-primary/20 transition-all flex items-center justify-center gap-2">
                                <a href={upiUrl}><Wallet className="h-5 w-5" /> Open Payment App</a>
                            </Button>
                        )}
                        <div className="relative py-2">
                            <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
                            <div className="relative flex justify-center text-[10px] uppercase tracking-widest"><span className="bg-background px-2 text-muted-foreground font-bold">Or Manual Settle</span></div>
                        </div>
                        {classroom.paymentDetails?.upiId && (
                            <div className="space-y-3">
                                <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-[0.2em] block text-center">Copy UPI ID</Label>
                                <div className="flex items-center gap-2 p-1.5 bg-muted/50 rounded-2xl border border-border/50">
                                    <Input readOnly value={classroom.paymentDetails.upiId} className="bg-transparent border-none text-xs focus-visible:ring-0 shadow-none h-10 px-3" />
                                    <Button size="icon" variant="secondary" className="rounded-xl h-10 w-10 shrink-0 shadow-sm" onClick={() => { navigator.clipboard.writeText(classroom.paymentDetails!.upiId!); toast({ title: 'UPI ID Copied!' }); }}>
                                        <Copy className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        )}
                        {classroom.paymentDetails?.qrCodeUrl && (
                            <div className="space-y-4 text-center">
                                <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-[0.2em] block">Scan QR Code</Label>
                                <div className="p-4 border-2 border-primary/10 rounded-3xl inline-block bg-white shadow-xl relative">
                                    <div className="relative w-[200px] h-[200px]">
                                        <Image src={classroom.paymentDetails.qrCodeUrl} alt="Payment QR" fill style={{ objectFit: 'contain' }} data-ai-hint="payment qr"/>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                    <div className="mt-8">
                        <DialogClose asChild><Button variant="outline" className="w-full rounded-2xl h-12 font-bold text-muted-foreground">Close Portal</Button></DialogClose>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}
