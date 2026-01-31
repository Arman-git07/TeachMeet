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
import { IndianRupee, DollarSign, Euro, PoundSterling, Settings, Copy } from 'lucide-react';
import Image from 'next/image';

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
    
    const feeForm = useForm<z.infer<typeof feeSchema>>({ resolver: zodResolver(feeSchema), defaultValues: { amount: classroom?.feeAmount || 0, currency: classroom?.feeCurrency || 'INR' } });
    const paymentDetailsForm = useForm<z.infer<typeof paymentDetailsSchema>>({ resolver: zodResolver(paymentDetailsSchema), defaultValues: { upiId: classroom?.paymentDetails?.upiId || '', qrCode: null } });

    const currencySymbols = useMemo(() => ({
        INR: <IndianRupee className="h-6 w-6" />, USD: <DollarSign className="h-6 w-6" />, EUR: <Euro className="h-6 w-6" />, GBP: <PoundSterling className="h-6 w-6" />,
    }), []);

    const onFeeSubmit = useCallback(async (data: z.infer<typeof feeSchema>) => {
        await updateDoc(doc(db, 'classrooms', classroomId), { feeAmount: data.amount, feeCurrency: data.currency });
        toast({ title: 'Fee Details Updated!' });
        setIsSettingsOpen(false);
    }, [classroomId, toast]);

    const onPaymentDetailsSubmit = useCallback(async (data: z.infer<typeof paymentDetailsSchema>) => {
        let qrCodeUrl = classroom?.paymentDetails?.qrCodeUrl;
        if (data.qrCode && data.qrCode[0]) {
            const file = data.qrCode[0];
            const qrRef = storageRef(storage, `classrooms/${classroomId}/paymentQR.png`);
            await uploadBytes(qrRef, file);
            qrCodeUrl = await getDownloadURL(qrRef);
        }
        await updateDoc(doc(db, 'classrooms', classroomId), { paymentDetails: { upiId: data.upiId, qrCodeUrl } });
        toast({ title: 'Payment Details Updated!' });
        setIsSettingsOpen(false);
    }, [classroomId, classroom?.paymentDetails?.qrCodeUrl, toast]);

    if (!classroom) return null;

    return (
        <>
            {/* Main Dialog */}
            <Dialog open={isOpen} onOpenChange={onOpenChange}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Fees & Payment</DialogTitle>
                        <DialogDescription>Manage classroom fees and view payment information.</DialogDescription>
                    </DialogHeader>
                    <Card className="border-0 shadow-none">
                        <CardHeader>
                            <div className="flex justify-between items-center">
                                <CardTitle>Fees & Payment</CardTitle>
                                {canUserManage && (
                                    <Button variant="ghost" size="icon" onClick={() => setIsSettingsOpen(true)}>
                                        <Settings className="h-4 w-4" />
                                    </Button>
                                )}
                            </div>
                        </CardHeader>
                        <CardContent className="text-center">
                            <p className="text-muted-foreground">Total Amount Due</p>
                            <div className="flex justify-center items-center gap-2">{currencySymbols[classroom.feeCurrency as keyof typeof currencySymbols] || 'INR'}<p className="font-bold text-3xl">{classroom.feeAmount?.toLocaleString() || '0.00'}</p><Badge>{classroom.feeCurrency || 'INR'}</Badge></div>
                            <Button 
                                className="w-full btn-gel mt-4" 
                                disabled={!classroom.paymentDetails?.upiId && !classroom.paymentDetails?.qrCodeUrl}
                                onClick={() => setIsPayNowOpen(true)}
                            >
                                Pay Now
                            </Button>
                        </CardContent>
                    </Card>
                </DialogContent>
            </Dialog>

            {/* Nested Dialog 1: Settings */}
            <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
                <DialogContent>
                    <DialogHeader><DialogTitle>Update Payment Settings</DialogTitle></DialogHeader>
                    <div className="space-y-6 py-4">
                        <form onSubmit={feeForm.handleSubmit(onFeeSubmit)} className="space-y-4 p-4 border rounded-lg">
                            <h4 className="font-medium">Fee Details</h4>
                            <div className="space-y-2"><Label>Fee Amount</Label><Input type="number" {...feeForm.register('amount')} /></div>
                            <div className="space-y-2"><Label>Currency</Label>
                                <Controller name="currency" control={feeForm.control} render={({ field }) => (
                                    <Select onValueChange={field.onChange} defaultValue={field.value}><SelectTrigger><SelectValue/></SelectTrigger>
                                        <SelectContent><SelectItem value="INR">INR (₹)</SelectItem><SelectItem value="USD">USD ($)</SelectItem><SelectItem value="EUR">EUR (€)</SelectItem><SelectItem value="GBP">GBP (£)</SelectItem></SelectContent>
                                    </Select>
                                )} />
                            </div>
                            <Button type="submit" size="sm">Save Fee</Button>
                        </form>
                        <form onSubmit={paymentDetailsForm.handleSubmit(onPaymentDetailsSubmit)} className="space-y-4 p-4 border rounded-lg">
                            <h4 className="font-medium">Payment Details</h4>
                            <div><Label>UPI ID</Label><Input {...paymentDetailsForm.register('upiId')} /></div>
                            <div><Label>QR Code Image</Label><Input type="file" accept="image/*" {...paymentDetailsForm.register('qrCode')} /></div>
                            {classroom.paymentDetails?.qrCodeUrl && <Image src={classroom.paymentDetails.qrCodeUrl} alt="Current QR Code" width={128} height={128} className="mx-auto rounded-lg" data-ai-hint="qr code"/>}
                            <Button type="submit" size="sm">Save Payment Details</Button>
                        </form>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Nested Dialog 2: Pay Now */}
            <Dialog open={isPayNowOpen} onOpenChange={setIsPayNowOpen}>
                <DialogContent className="sm:max-w-xs">
                    <DialogHeader><DialogTitle>Payment Information</DialogTitle></DialogHeader>
                    <div className="py-4 space-y-4">
                        {classroom.paymentDetails?.upiId && <div className="space-y-1"><Label>UPI ID</Label><div className="flex items-center gap-2"><Input readOnly value={classroom.paymentDetails.upiId} /><Button size="icon" variant="ghost" onClick={() => { navigator.clipboard.writeText(classroom.paymentDetails!.upiId!); toast({ title: 'UPI ID Copied!' }); }}><Copy className="h-4 w-4" /></Button></div></div>}
                        {classroom.paymentDetails?.qrCodeUrl && <div className="space-y-2 text-center"><Label>Scan QR Code</Label><div className="p-2 border rounded-lg inline-block bg-white"><Image src={classroom.paymentDetails.qrCodeUrl} alt="Payment QR Code" width={200} height={200} data-ai-hint="qr code"/></div></div>}
                    </div>
                    <DialogClose asChild><Button type="button" variant="secondary">Close</Button></DialogClose>
                </DialogContent>
            </Dialog>
        </>
    );
}
