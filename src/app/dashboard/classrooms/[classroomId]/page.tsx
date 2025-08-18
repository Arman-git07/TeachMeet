
'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { db, storage } from '@/lib/firebase';
import { doc, onSnapshot, updateDoc, collection, addDoc, serverTimestamp, query, where, getDocs, writeBatch, deleteDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import Image from 'next/image';
import { Megaphone, BookUser, Users, CreditCard, Loader2, ArrowLeft, PlusCircle, Trash2, Edit, Check, X, FileUp, Upload, IndianRupee, DollarSign, Euro, PoundSterling } from 'lucide-react';
import { EnrolledClassroomInfo } from '../page';
import { cn } from '@/lib/utils';
import { gradeAssignment } from '@/ai/flows/grade-assignment-flow';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

interface Classroom {
    id: string;
    title: string;
    description: string;
    teacherId: string;
    teacherName: string;
    students: string[];
    feeAmount?: number;
    feeCurrency?: string;
    paymentDetails?: {
        upiId: string;
        qrCodeUrl: string;
    };
}

interface Student {
    id: string;
    name: string;
    photoURL?: string;
}

interface Announcement {
    id: string;
    text: string;
    createdAt: any;
}

interface Assignment {
    id: string;
    title: string;
    description: string;
    dueDate: any;
}

interface JoinRequest {
    id: string;
    studentName: string;
    studentPhotoURL?: string;
    role: 'student' | 'teacher';
}

const feeSchema = z.object({
  amount: z.coerce.number().positive({ message: "Amount must be a positive number." }),
  currency: z.string().min(1, { message: "Currency is required." }),
});

const paymentDetailsSchema = z.object({
  upiId: z.string().optional(),
  qrCode: z.any().optional(),
});

const AnnouncementForm = ({ classroomId, onAnnouncementPosted }: { classroomId: string; onAnnouncementPosted: () => void }) => {
    const [text, setText] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const { toast } = useToast();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!text.trim()) {
            toast({ variant: 'destructive', title: 'Announcement cannot be empty.' });
            return;
        }
        setIsLoading(true);
        try {
            await addDoc(collection(db, 'classrooms', classroomId, 'announcements'), {
                text,
                createdAt: serverTimestamp(),
            });
            setText('');
            toast({ title: 'Announcement Posted!' });
            onAnnouncementPosted();
        } catch (error) {
            console.error('Error posting announcement:', error);
            toast({ variant: 'destructive', title: 'Failed to post announcement.' });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-3">
            <Textarea
                placeholder="Type your announcement here..."
                value={text}
                onChange={(e) => setText(e.target.value)}
                disabled={isLoading}
                rows={3}
            />
            <Button type="submit" disabled={isLoading}>
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Post Announcement
            </Button>
        </form>
    );
};

export default function ClassroomPage() {
    const { classroomId } = useParams() as { classroomId: string };
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();
    const { toast } = useToast();

    const [classroom, setClassroom] = useState<Classroom | null>(null);
    const [students, setStudents] = useState<Student[]>([]);
    const [announcements, setAnnouncements] = useState<Announcement[]>([]);
    const [assignments, setAssignments] = useState<Assignment[]>([]);
    const [joinRequests, setJoinRequests] = useState<JoinRequest[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isFeeDialogOpen, setIsFeeDialogOpen] = useState(false);
    const [isPaymentDetailsDialogOpen, setIsPaymentDetailsDialogOpen] = useState(false);

    const isTeacher = user?.uid === classroom?.teacherId;

    const feeForm = useForm<z.infer<typeof feeSchema>>({
        resolver: zodResolver(feeSchema),
        defaultValues: { amount: 0, currency: 'INR' },
    });

    const paymentDetailsForm = useForm<z.infer<typeof paymentDetailsSchema>>({
        resolver: zodResolver(paymentDetailsSchema),
        defaultValues: { upiId: '', qrCode: null },
    });

    useEffect(() => {
        if (!classroomId) return;
        const unsub = onSnapshot(doc(db, 'classrooms', classroomId), (docSnap) => {
            if (docSnap.exists()) {
                const data = { id: docSnap.id, ...docSnap.data() } as Classroom;
                setClassroom(data);
                feeForm.reset({ amount: data.feeAmount || 0, currency: data.feeCurrency || 'INR' });
                paymentDetailsForm.reset({ upiId: data.paymentDetails?.upiId || '', qrCode: null });
            } else {
                toast({ variant: 'destructive', title: 'Classroom not found.' });
                router.push('/dashboard/classrooms');
            }
            setIsLoading(false);
        });
        return () => unsub();
    }, [classroomId, router, toast, feeForm, paymentDetailsForm]);

    // Fetch subcollections data
    useEffect(() => {
        if (!classroomId) return;
        const unsubAnnouncements = onSnapshot(query(collection(db, 'classrooms', classroomId, 'announcements'), orderBy('createdAt', 'desc')), (snap) => setAnnouncements(snap.docs.map(d => ({ id: d.id, ...d.data() } as Announcement))));
        const unsubAssignments = onSnapshot(query(collection(db, 'classrooms', classroomId, 'assignments'), orderBy('dueDate', 'desc')), (snap) => setAssignments(snap.docs.map(d => ({ id: d.id, ...d.data() } as Assignment))));
        const unsubRequests = onSnapshot(collection(db, 'classrooms', classroomId, 'joinRequests'), (snap) => setJoinRequests(snap.docs.map(d => ({ id: d.id, ...d.data() } as JoinRequest))));
        
        return () => {
            unsubAnnouncements();
            unsubAssignments();
            unsubRequests();
        };
    }, [classroomId]);

    const handleApproveRequest = async (request: JoinRequest) => {
        if (!isTeacher) return;
        const studentId = request.id;
        try {
            const batch = writeBatch(db);
            const classRef = doc(db, 'classrooms', classroomId);
            batch.update(classRef, { students: arrayUnion(studentId) });

            const userEnrolledRef = doc(db, `users/${studentId}/enrolled`, classroomId);
            batch.set(userEnrolledRef, { classroomId: classroomId, role: request.role, ...classroom });

            const requestRef = doc(db, 'classrooms', classroomId, 'joinRequests', studentId);
            batch.delete(requestRef);

            const userPendingRequestRef = doc(db, `users/${studentId}/pendingJoinRequests`, classroomId);
            batch.delete(userPendingRequestRef);

            await batch.commit();
            toast({ title: "Member Approved!" });
        } catch (error) {
            console.error("Error approving request:", error);
            toast({ variant: 'destructive', title: "Approval Failed" });
        }
    };
    
    const handleDenyRequest = async (request: JoinRequest) => {
        if (!isTeacher) return;
        try {
            const batch = writeBatch(db);
            const requestRef = doc(db, `classrooms/${classroomId}/joinRequests`, request.id);
            batch.delete(requestRef);

            const userPendingRequestRef = doc(db, `users/${request.id}/pendingJoinRequests`, classroomId);
            batch.delete(userPendingRequestRef);

            await batch.commit();
            toast({ title: "Request Denied" });
        } catch (error) {
            console.error("Error denying request:", error);
            toast({ variant: 'destructive', title: "Action Failed" });
        }
    };
    
    const onFeeSubmit = async (data: z.infer<typeof feeSchema>) => {
        try {
            await updateDoc(doc(db, 'classrooms', classroomId), {
                feeAmount: data.amount,
                feeCurrency: data.currency
            });
            toast({ title: 'Fee details updated successfully!' });
            setIsFeeDialogOpen(false);
        } catch (error) {
            console.error("Error updating fee:", error);
            toast({ variant: 'destructive', title: 'Update Failed' });
        }
    };

    const onPaymentDetailsSubmit = async (data: z.infer<typeof paymentDetailsSchema>) => {
        if (!user) return;
        let qrCodeUrl = classroom?.paymentDetails?.qrCodeUrl || '';

        try {
            if (data.qrCode && data.qrCode.length > 0) {
                const file = data.qrCode[0];
                const qrRef = storageRef(storage, `classrooms/${classroomId}/payment/qr_code`);
                const snapshot = await uploadBytes(qrRef, file);
                qrCodeUrl = await getDownloadURL(snapshot.ref);
            }
            await updateDoc(doc(db, 'classrooms', classroomId), {
                'paymentDetails.upiId': data.upiId || '',
                'paymentDetails.qrCodeUrl': qrCodeUrl,
            });
            toast({ title: "Payment details updated successfully!" });
            setIsPaymentDetailsDialogOpen(false);
        } catch (error) {
            console.error("Error updating payment details:", error);
            toast({ variant: 'destructive', title: 'Update Failed' });
        }
    };

    if (isLoading || authLoading) {
        return <div className="container mx-auto p-4"><Skeleton className="h-64 w-full" /></div>;
    }

    if (!classroom) {
        return <div className="container mx-auto p-4">Classroom not found.</div>;
    }

    const currencySymbols: { [key: string]: React.ReactNode } = {
        INR: <IndianRupee className="h-6 w-6" />,
        USD: <DollarSign className="h-6 w-6" />,
        EUR: <Euro className="h-6 w-6" />,
        GBP: <PoundSterling className="h-6 w-6" />,
    };

    return (
        <div className="container mx-auto p-4 md:p-8">
            <header className="mb-6">
                <Button variant="link" onClick={() => router.back()} className="p-0 mb-2 text-muted-foreground"><ArrowLeft className="mr-2 h-4 w-4" />Back to classrooms</Button>
                <h1 className="text-4xl font-bold">{classroom.title}</h1>
                <p className="text-lg text-muted-foreground">{classroom.description}</p>
                <p className="text-sm text-muted-foreground">Taught by: {classroom.teacherName}</p>
            </header>

            {isTeacher && joinRequests.length > 0 && (
                <Card className="mb-6 bg-primary/10 border-primary/20">
                    <CardHeader>
                        <CardTitle>{joinRequests.length} New Join Request{joinRequests.length > 1 ? 's' : ''}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {joinRequests.map(req => (
                            <div key={req.id} className="flex items-center justify-between p-2 bg-background rounded-lg">
                                <div className="flex items-center gap-2">
                                    <Avatar>
                                        <AvatarImage src={req.studentPhotoURL} />
                                        <AvatarFallback>{req.studentName.charAt(0)}</AvatarFallback>
                                    </Avatar>
                                    <div>
                                        <p className="font-medium">{req.studentName}</p>
                                        <Badge variant="secondary">{req.role}</Badge>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <Button size="icon" variant="outline" className="h-8 w-8 bg-green-100 text-green-700" onClick={() => handleApproveRequest(req)}><Check className="h-4 w-4" /></Button>
                                    <Button size="icon" variant="destructive" className="h-8 w-8" onClick={() => handleDenyRequest(req)}><X className="h-4 w-4" /></Button>
                                </div>
                            </div>
                        ))}
                    </CardContent>
                </Card>
            )}

            <Tabs defaultValue="announcements" className="w-full">
                <TabsList className="mb-4">
                    <TabsTrigger value="announcements"><Megaphone className="mr-2 h-4 w-4" />Announcements</TabsTrigger>
                    <TabsTrigger value="assignments"><BookUser className="mr-2 h-4 w-4" />Assignments</TabsTrigger>
                    <TabsTrigger value="students"><Users className="mr-2 h-4 w-4" />Students</TabsTrigger>
                    <TabsTrigger value="fees"><CreditCard className="mr-2 h-4 w-4" />Fees</TabsTrigger>
                </TabsList>

                <TabsContent value="announcements">
                    <Card>
                        <CardHeader>
                            <CardTitle>Announcements</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {isTeacher && <AnnouncementForm classroomId={classroomId} onAnnouncementPosted={() => {}} />}
                            <div className="space-y-3">
                                {announcements.length > 0 ? announcements.map(a => (
                                    <div key={a.id} className="p-3 bg-muted/50 rounded-lg">
                                        <p className="text-sm">{a.text}</p>
                                        <p className="text-xs text-muted-foreground mt-1">{new Date(a.createdAt?.toDate()).toLocaleString()}</p>
                                    </div>
                                )) : <p className="text-muted-foreground">No announcements yet.</p>}
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
                <TabsContent value="assignments">
                    <Card>
                        <CardHeader><CardTitle>Assignments</CardTitle></CardHeader>
                        <CardContent><p className="text-muted-foreground">Assignments feature coming soon.</p></CardContent>
                    </Card>
                </TabsContent>
                <TabsContent value="students">
                    <Card>
                        <CardHeader><CardTitle>Students</CardTitle></CardHeader>
                        <CardContent><p className="text-muted-foreground">Student list coming soon.</p></CardContent>
                    </Card>
                </TabsContent>
                <TabsContent value="fees">
                    <Card>
                        <CardHeader>
                            <div className="flex justify-between items-center">
                                <CardTitle className="flex items-center gap-2">Make a Payment</CardTitle>
                                {isTeacher && (
                                    <div className="flex gap-2">
                                        <Dialog open={isFeeDialogOpen} onOpenChange={setIsFeeDialogOpen}>
                                            <DialogTrigger asChild><Button variant="ghost" size="icon"><Edit className="h-4 w-4" /></Button></DialogTrigger>
                                            <DialogContent>
                                                <DialogHeader><DialogTitle>Set Class Fee</DialogTitle></DialogHeader>
                                                <form onSubmit={feeForm.handleSubmit(onFeeSubmit)} className="space-y-4">
                                                    <div className="space-y-2">
                                                        <Label htmlFor="amount">Fee Amount</Label>
                                                        <Input id="amount" type="number" {...feeForm.register('amount')} />
                                                        {feeForm.formState.errors.amount && <p className="text-destructive text-sm">{feeForm.formState.errors.amount.message}</p>}
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label htmlFor="currency">Currency</Label>
                                                        <Controller name="currency" control={feeForm.control} render={({ field }) => (
                                                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                                <SelectTrigger><SelectValue placeholder="Select currency" /></SelectTrigger>
                                                                <SelectContent>
                                                                    <SelectItem value="INR">INR (₹)</SelectItem>
                                                                    <SelectItem value="USD">USD ($)</SelectItem>
                                                                    <SelectItem value="EUR">EUR (€)</SelectItem>
                                                                    <SelectItem value="GBP">GBP (£)</SelectItem>
                                                                </SelectContent>
                                                            </Select>
                                                        )} />
                                                        {feeForm.formState.errors.currency && <p className="text-destructive text-sm">{feeForm.formState.errors.currency.message}</p>}
                                                    </div>
                                                    <DialogFooter>
                                                        <DialogClose asChild><Button type="button" variant="secondary">Cancel</Button></DialogClose>
                                                        <Button type="submit">Save Fee</Button>
                                                    </DialogFooter>
                                                </form>
                                            </DialogContent>
                                        </Dialog>
                                        <Dialog open={isPaymentDetailsDialogOpen} onOpenChange={setIsPaymentDetailsDialogOpen}>
                                            <DialogTrigger asChild><Button variant="outline" size="sm">Payment Details</Button></DialogTrigger>
                                            <DialogContent>
                                                <DialogHeader><DialogTitle>Update Payment Details</DialogTitle></DialogHeader>
                                                <form onSubmit={paymentDetailsForm.handleSubmit(onPaymentDetailsSubmit)} className="space-y-4">
                                                    <div className="space-y-2">
                                                        <Label htmlFor="upiId">UPI ID</Label>
                                                        <Input id="upiId" {...paymentDetailsForm.register('upiId')} placeholder="yourname@bank"/>
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label htmlFor="qrCode">QR Code Image</Label>
                                                        <Input id="qrCode" type="file" accept="image/*" {...paymentDetailsForm.register('qrCode')} />
                                                    </div>
                                                    {classroom?.paymentDetails?.qrCodeUrl && (
                                                        <div className="text-center">
                                                            <p className="text-sm text-muted-foreground mb-2">Current QR Code:</p>
                                                            <Image src={classroom.paymentDetails.qrCodeUrl} alt="Current QR Code" width={128} height={128} className="mx-auto rounded-lg" data-ai-hint="qr code"/>
                                                        </div>
                                                    )}
                                                    <DialogFooter>
                                                        <DialogClose asChild><Button type="button" variant="secondary">Cancel</Button></DialogClose>
                                                        <Button type="submit">Save Details</Button>
                                                    </DialogFooter>
                                                </form>
                                            </DialogContent>
                                        </Dialog>
                                    </div>
                                )}
                            </div>
                        </CardHeader>
                        <CardContent className="text-center">
                            <p className="text-muted-foreground">Total Amount Due</p>
                            <div className="flex justify-center items-center gap-2">
                                {currencySymbols[classroom.feeCurrency || 'INR']}
                                <p className="font-bold text-3xl">{classroom.feeAmount?.toLocaleString('en-IN', { minimumFractionDigits: 2 }) || '0.00'}</p>
                                <Badge>{classroom.feeCurrency || 'INR'}</Badge>
                            </div>
                            <Dialog>
                                <DialogTrigger asChild>
                                  <Button className="w-full btn-gel mt-4">Pay Now</Button>
                                </DialogTrigger>
                                <DialogContent>
                                    <DialogHeader>
                                        <DialogTitle>Make a Payment</DialogTitle>
                                        <DialogDescription>
                                            { classroom?.paymentDetails?.upiId || classroom?.paymentDetails?.qrCodeUrl 
                                              ? "Use the details below to complete your payment. This is a simulation." 
                                              : "The teacher has not provided payment details yet."
                                            }
                                        </DialogDescription>
                                    </DialogHeader>
                                    <div className="py-4 space-y-4">
                                      {classroom?.paymentDetails?.upiId && (
                                        <div>
                                          <p className="font-semibold">UPI ID:</p>
                                          <p className="font-mono bg-muted p-2 rounded-md">{classroom.paymentDetails.upiId}</p>
                                        </div>
                                      )}
                                      {classroom?.paymentDetails?.qrCodeUrl && (
                                        <div className="text-center">
                                          <p className="font-semibold mb-2">Scan QR Code:</p>
                                          <Image src={classroom.paymentDetails.qrCodeUrl} alt="Payment QR Code" width={200} height={200} className="mx-auto rounded-lg" data-ai-hint="qr code"/>
                                        </div>
                                      )}
                                      {!(classroom?.paymentDetails?.upiId || classroom?.paymentDetails?.qrCodeUrl) && (
                                        <p className="text-center text-muted-foreground">Please check back later or contact your teacher.</p>
                                      )}
                                    </div>
                                </DialogContent>
                            </Dialog>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
