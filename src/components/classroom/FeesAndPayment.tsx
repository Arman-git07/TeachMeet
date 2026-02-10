
'use client';

import { useState, useMemo, useCallback } from 'react';
import { useClassroom } from '@/contexts/ClassroomContext';
import { canManage } from '@/lib/roles';
import { useToast } from '@/hooks/use-toast';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { doc, updateDoc } from 'firebase/firestore';
import { db, storage } from '@/lib/firebase';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogClose } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { IndianRupee, DollarSign, Euro, PoundSterling, Settings, Copy, Info, AlertCircle, Loader2 } from 'lucide-react';
import Image from 'next/image';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';

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
    const { classroom, classroomId, userRole } = useClassroom();
    const canUserManage = canManage(userRole);
    const { toast } = useToast();

    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isPayNowOpen, setIsPayNowOpen] = useState(false);
    const [isUpdating, setIsUpdating] = useState(false);
    
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

    const currencySymbols = useMemo(() => ({
        INR: <IndianRupee className="h-6 w-6" />, 
        USD: <DollarSign className="h-6 w-6" />, 
        EUR: <Euro className="h-6 w-6" />, 
        GBP: <PoundSterling className="h-6 w-6" />,
    }), []);

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

        // Requirement: At least one payment method (UPI ID or QR Code) must be provided
        if (!data.upiId?.trim() && !qrCodeUrl && !hasNewFile) {
            toast({ 
                variant: 'destructive', 
                title: "Setup Required", 
                description: "Please add a UPI ID or upload a QR Code so students can pay their fees." 
            });
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
                paymentDetails: { 
                    upiId: data.upiId?.trim() || "", 
                    qrCodeUrl 
                } 
            });
            toast({ title: 'Payment Details Updated!' });
            setIsSettingsOpen(false);
        } catch (error: any) {
             console.error("Failed to update payment details:", error);
             toast({
                variant: 'destructive',
                title: "Update Failed",
                description: "Could not save payment details. Please check your connection."
             });
        } finally {
            setIsUpdating(false);
        }
    }, [classroomId, classroom?.paymentDetails?.qrCodeUrl, toast]);

    if (!classroom) return null;

    return (
        <>
            <Dialog open={isOpen} onOpenChange={onOpenChange}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Fees & Payment</DialogTitle>
                        <DialogDescription>View classroom fees and settle your payments.</DialogDescription>
                    </DialogHeader>
                    <Card className="border-0 shadow-none bg-transparent">
                        <CardHeader className="px-0">
                            <div className="flex justify-between items-center">
                                <CardTitle className="text-xl">Fee Summary</CardTitle>
                                {canUserManage && (
                                    <Button variant="ghost" size="icon" onClick={() => setIsSettingsOpen(true)} className="rounded-full">
                                        <Settings className="h-5 w-5 text-muted-foreground" />
                                    </Button>
                                )}
                            </div>
                        </CardHeader>
                        <CardContent className="text-center px-0">
                            <p className="text-muted-foreground mb-3 text-sm">Amount Outstanding</p>
                            <div className="flex justify-center items-center gap-3">
                                <div className="text-primary p-2 bg-primary/10 rounded-full">
                                    {currencySymbols[classroom.feeCurrency as keyof typeof currencySymbols] || <IndianRupee className="h-6 w-6" />}
                                </div>
                                <p className="font-black text-4xl tracking-tighter">{classroom.feeAmount?.toLocaleString() || '0.00'}</p>
                                <Badge variant="secondary" className="font-bold px-3 py-1">{classroom.feeCurrency || 'INR'}</Badge>
                            </div>
                            
                            {(!classroom.paymentDetails?.upiId && !classroom.paymentDetails?.qrCodeUrl) ? (
                                <Alert className="mt-8 border-amber-200 bg-amber-50/50 text-amber-800 rounded-xl">
                                    <AlertCircle className="h-4 w-4 text-amber-600" />
                                    <AlertDescription className="text-xs font-medium">
                                        The teacher has not yet configured a payment method for this class.
                                    </AlertDescription>
                                </Alert>
                            ) : (
                                <Button 
                                    className="w-full btn-gel mt-8 h-14 text-xl rounded-2xl shadow-xl hover:shadow-primary/20 transition-all" 
                                    onClick={() => setIsPayNowOpen(true)}
                                >
                                    Pay Now
                                </Button>
                            )}
                        </CardContent>
                    </Card>
                </DialogContent>
            </Dialog>

            <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Teacher Control Panel</DialogTitle>
                        <DialogDescription>Configure how students settle their classroom fees.</DialogDescription>
                    </DialogHeader>
                    <ScrollArea className="max-h-[75vh] -mx-6 px-6">
                        <div className="space-y-8 py-6">
                            <form onSubmit={feeForm.handleSubmit(onFeeSubmit)} className="space-y-4 p-5 border rounded-2xl bg-muted/20">
                                <h4 className="font-black text-xs uppercase tracking-widest flex items-center gap-2 text-muted-foreground">
                                    <IndianRupee className="h-4 w-4 text-primary" /> 1. Fee Configuration
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
                                    <Copy className="h-4 w-4" /> 2. Payment Methods
                                </h4>
                                
                                <div className="flex gap-3 p-3 bg-background rounded-xl border border-primary/10 shadow-sm">
                                    <Info className="h-5 w-5 text-primary shrink-0" />
                                    <p className="text-[11px] leading-relaxed text-muted-foreground font-medium">
                                        You <b>must</b> provide either a UPI ID or a QR Code. This allows students to pay you directly via their preferred banking app.
                                    </p>
                                </div>

                                <div className="space-y-2">
                                    <Label className="text-xs font-bold">UPI ID</Label>
                                    <Input {...paymentDetailsForm.register('upiId')} placeholder="e.g. name@bank" className="rounded-xl h-11 bg-background" />
                                </div>
                                
                                <div className="space-y-2">
                                    <Label className="text-xs font-bold">Update QR Code</Label>
                                    <Input type="file" accept="image/*" {...paymentDetailsForm.register('qrCode')} className="rounded-xl h-11 bg-background file:mr-4 file:py-1 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20 cursor-pointer" />
                                </div>

                                {classroom.paymentDetails?.qrCodeUrl && (
                                    <div className="pt-2 text-center">
                                        <p className="text-[10px] text-muted-foreground mb-3 font-black uppercase tracking-tighter">Live QR Code</p>
                                        <div className="relative w-36 h-32 mx-auto border-2 border-dashed rounded-2xl overflow-hidden bg-white p-2">
                                            <Image src={classroom.paymentDetails.qrCodeUrl} alt="Payment QR" layout="fill" objectFit="contain" data-ai-hint="qr code"/>
                                        </div>
                                    </div>
                                )}
                                
                                <Button type="submit" className="w-full btn-gel h-12 text-base rounded-xl" disabled={isUpdating}>
                                    {isUpdating ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : null}
                                    Update Payment Gateway
                                </Button>
                            </form>
                        </div>
                    </ScrollArea>
                </DialogContent>
            </Dialog>

            <Dialog open={isPayNowOpen} onOpenChange={setIsPayNowOpen}>
                <DialogContent className="sm:max-w-xs rounded-3xl p-6">
                    <DialogHeader className="mb-4">
                        <DialogTitle className="text-center text-2xl font-black text-primary">Settle Payment</DialogTitle>
                        <DialogDescription className="text-center font-medium">Pay directly to the classroom account.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-8">
                        {classroom.paymentDetails?.upiId && (
                            <div className="space-y-3">
                                <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-[0.2em] block text-center">Direct UPI Transfer</Label>
                                <div className="flex items-center gap-2 p-1.5 bg-muted/50 rounded-2xl border border-border/50">
                                    <Input readOnly value={classroom.paymentDetails.upiId} className="bg-transparent border-none font-mono text-xs focus-visible:ring-0 shadow-none h-10 px-3" />
                                    <Button size="icon" variant="secondary" className="rounded-xl h-10 w-10 shrink-0 shadow-sm" onClick={() => { navigator.clipboard.writeText(classroom.paymentDetails!.upiId!); toast({ title: 'UPI ID Copied!' }); }}>
                                        <Copy className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        )}
                        
                        {classroom.paymentDetails?.qrCodeUrl && (
                            <div className="space-y-4 text-center">
                                <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-[0.2em] block">Scan via Payment App</Label>
                                <div className="p-4 border-2 border-primary/10 rounded-3xl inline-block bg-white shadow-xl relative group">
                                    <div className="absolute inset-0 bg-primary/5 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                                    <Image src={classroom.paymentDetails.qrCodeUrl} alt="Payment QR Code" width={220} height={220} className="rounded-xl relative z-10" data-ai-hint="qr code"/>
                                </div>
                                <p className="text-[10px] text-muted-foreground font-bold italic opacity-60">Screenshots are saved automatically.</p>
                            </div>
                        )}
                    </div>
                    <div className="mt-8">
                        <DialogClose asChild>
                            <Button type="button" variant="outline" className="w-full rounded-2xl h-12 font-bold text-muted-foreground hover:bg-muted/50">Close Portal</Button>
                        </DialogClose>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}
