'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { db, storage } from '@/lib/firebase';
import { doc, onSnapshot, updateDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { resolveRoleForUser, type Role } from "@/lib/roles";
import { ClassroomProvider } from '@/contexts/ClassroomContext';
import type { Classroom } from '@/app/dashboard/classrooms/[classroomId]/page';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Lock, Wallet, ArrowLeft, Loader2, AlertCircle, CreditCard, ShieldCheck, RefreshCw, UploadCloud, Image as ImageIcon, Info } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { verifyPayment } from '@/ai/flows/verify-payment-flow';

const PLATFORM_FEE_AMOUNT = 10;
const GRACE_PERIOD_DAYS = 7;
const PLATFORM_UPI_ID = "07arman2004-1@oksbi";

export default function ClassroomDetailLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { classroomId } = useParams() as { classroomId: string };
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [classroom, setClassroom] = useState<Classroom | null>(null);
  const [userRole, setUserRole] = useState<Role>('none');
  const [isLoading, setIsLoading] = useState(true);
  const [isVerifying, setIsVerifying] = useState(false);
  const [paymentInitiated, setPaymentInitiated] = useState(false);
  const [verificationProgress, setVerificationProgress] = useState(0);

  useEffect(() => {
    if (authLoading) return;
    
    if (!user) {
      router.push('/auth/signin');
      return;
    }

    let cancelled = false;
    
    const unsubscribe = onSnapshot(doc(db, "classrooms", classroomId), async (docSnap) => {
        if (docSnap.exists()) {
            try {
                const { role } = await resolveRoleForUser(String(classroomId), user?.uid);
                
                if (!cancelled) {
                    setUserRole(role);
                    setClassroom({ id: docSnap.id, ...docSnap.data() } as Classroom);
                    setIsLoading(false);
                }
            } catch (error) {
                console.error("Role resolution failed:", error);
                if (!cancelled) setIsLoading(false);
            }
        } else {
            if (!cancelled) {
                toast({ variant: 'destructive', title: 'Classroom not found.' });
                router.push('/dashboard/classrooms');
                setIsLoading(false);
            }
        }
    }, (err) => {
        console.warn("Classroom detail sync error:", err);
        if (!cancelled) setIsLoading(false);
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [classroomId, user, authLoading, router, toast]);

  const handleRenew = useCallback(async () => {
      if (!user || !classroom) return;
      try {
          const now = new Date();
          const nextDue = new Date();
          nextDue.setMonth(now.getMonth() + 1);

          await updateDoc(doc(db, 'classrooms', classroomId), {
              subscriptionStatus: 'active',
              lastPaymentAt: serverTimestamp(),
              nextPaymentDue: Timestamp.fromDate(nextDue)
          });
          toast({ title: "Classroom Renewed!", description: "Subscription is now active for another month." });
      } catch (error) {
          toast({ variant: 'destructive', title: "Renewal Failed" });
      } finally {
          setIsVerifying(false);
          setPaymentInitiated(false);
      }
  }, [user, classroom, classroomId, toast]);

  const handleScreenshotUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !user || !classroom) return;

      setIsVerifying(true);
      setVerificationProgress(0);

      try {
          const reader = new FileReader();
          const dataUri = await new Promise<string>((resolve) => {
              reader.onload = () => resolve(reader.result as string);
              reader.readAsDataURL(file);
          });

          setVerificationProgress(20);
          const result = await verifyPayment({
              screenshotDataUri: dataUri,
              expectedAmount: PLATFORM_FEE_AMOUNT,
              expectedCurrency: classroom.billingCurrency || 'INR',
              expectedRecipientUpi: PLATFORM_UPI_ID
          });

          setVerificationProgress(80);
          await new Promise(r => setTimeout(r, 1000));
          setVerificationProgress(100);

          if (result.isValid) {
              toast({ title: "Payment Verified!", description: "Activating renewal..." });
              await handleRenew();
          } else {
              toast({ 
                  variant: 'destructive', 
                  title: "Verification Failed", 
                  description: result.reason || "The AI could not verify this payment. Ensure the recipient and amount are visible on the receipt." 
              });
              setIsVerifying(false);
              setVerificationProgress(0);
          }
      } catch (error) {
          console.error("Renewal verification error:", error);
          toast({ variant: 'destructive', title: "Error", description: "Verification process failed. Please ensure the image is a clear receipt." });
          setIsVerifying(false);
      }
  };

  useEffect(() => {
    if (paymentInitiated && !isVerifying) {
        const handleFocus = () => {
            toast({ title: "Return Detected", description: "Please upload your payment receipt to finalize renewal." });
        };
        window.addEventListener('focus', handleFocus);
        return () => window.removeEventListener('focus', handleFocus);
    }
  }, [paymentInitiated, isVerifying, toast]);

  const contextValue = useMemo(() => ({
      classroomId,
      classroom,
      user,
      userRole,
  }), [classroomId, classroom, user, userRole]);

  if (isLoading || authLoading) {
    return (
      <div className="container mx-auto p-4 flex flex-col items-center justify-center h-screen space-y-4">
        <Skeleton className="h-12 w-48 rounded-xl" />
        <Skeleton className="h-[60vh] w-full max-w-4xl rounded-3xl" />
      </div>
    );
  }

  if (!classroom) {
    return <div className="container mx-auto p-4 text-center py-20">Classroom not found or unavailable.</div>;
  }

  if (classroom.subscriptionStatus === 'blocked' && userRole !== 'creator') {
      return (
          <div className="flex flex-col items-center justify-center min-h-screen bg-muted/30 p-4">
              <Card className="w-full max-w-md shadow-2xl rounded-3xl border-none overflow-hidden">
                  <div className="h-2 bg-destructive" />
                  <CardHeader className="text-center pb-2">
                      <div className="mx-auto bg-destructive/10 w-20 h-20 rounded-full flex items-center justify-center mb-4">
                          <Lock className="h-10 w-10 text-destructive" />
                      </div>
                      <CardTitle className="text-2xl font-black">Classroom Suspended</CardTitle>
                      <CardDescription>This learning space is temporarily unavailable.</CardDescription>
                  </CardHeader>
                  <CardContent className="text-center space-y-4 pb-8">
                      <p className="text-sm text-muted-foreground leading-relaxed">
                          The creator's subscription has expired and the grace period has ended. Access will be restored once the maintenance fee is settled.
                      </p>
                      <Alert variant="destructive" className="bg-destructive/5 border-destructive/20 rounded-xl">
                          <AlertCircle className="h-4 w-4" />
                          <AlertDescription className="text-[10px] font-bold uppercase tracking-widest">Notification sent to Teacher</AlertDescription>
                      </Alert>
                  </CardContent>
                  <CardFooter className="bg-muted/50 border-t p-4">
                      <Button asChild variant="ghost" className="w-full rounded-xl">
                          <Link href="/dashboard/classrooms"><ArrowLeft className="mr-2 h-4 w-4" /> Return to Classrooms</Link>
                      </Button>
                  </CardFooter>
              </Card>
          </div>
      );
  }

  if (classroom.subscriptionStatus === 'blocked' && userRole === 'creator') {
      const upiUrl = `upi://pay?pa=${PLATFORM_UPI_ID}&pn=${encodeURIComponent("TeachMeet Maintenance")}&am=${PLATFORM_FEE_AMOUNT}&cu=${classroom.billingCurrency || 'INR'}&tn=Renewal_${classroom.id}`;
      return (
          <div className="flex flex-col items-center justify-center min-h-screen bg-muted/30 p-4">
              <Card className="w-full max-w-md shadow-2xl rounded-3xl border-none overflow-hidden">
                  <div className="h-2 bg-destructive" />
                  <CardHeader className="text-center">
                      <div className="mx-auto bg-destructive/10 w-20 h-20 rounded-full flex items-center justify-center mb-4">
                          <Wallet className="h-10 w-10 text-destructive" />
                      </div>
                      <CardTitle className="text-2xl font-black">Action Required</CardTitle>
                      <CardDescription>Your classroom "{classroom.title}" is blocked.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                      {isVerifying ? (
                          <div className="space-y-4 p-6 bg-primary/5 border-2 border-primary/20 rounded-3xl text-center">
                              <div className="relative mx-auto w-16 h-16">
                                <Loader2 className="h-16 w-16 text-primary animate-spin" />
                                <ShieldCheck className="h-8 w-8 text-primary absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                              </div>
                              <div className="space-y-1">
                                <p className="font-black text-primary uppercase tracking-widest">AI Auditing Transaction</p>
                                <p className="text-[10px] text-muted-foreground">Validating recipient ID and receipt authenticity...</p>
                              </div>
                              <Progress value={verificationProgress} className="h-2" />
                          </div>
                      ) : paymentInitiated ? (
                        <div className="space-y-4 p-6 bg-amber-50 border-2 border-amber-200 rounded-3xl text-center animate-in fade-in duration-300">
                            <div className="bg-amber-100 p-3 rounded-full inline-block mx-auto">
                                <UploadCloud className="h-8 w-8 text-amber-600" />
                            </div>
                            <div className="space-y-1">
                                <p className="font-black text-amber-800 uppercase tracking-widest">Upload Receipt</p>
                                <p className="text-[10px] text-amber-700/80 leading-relaxed px-4">
                                    Please complete the transaction, then upload the receipt image.
                                </p>
                            </div>
                            <div className="bg-white/50 p-3 rounded-xl border border-amber-200 text-left space-y-2">
                                <div className="flex items-start gap-2">
                                    <Info className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                                    <p className="text-[10px] text-amber-900 leading-tight">
                                        If your app blocks screenshots, use the <strong>"Share Receipt"</strong> or <strong>"Download"</strong> button in your payment app to save the image first.
                                    </p>
                                </div>
                            </div>
                            <div className="relative w-full">
                                <Input 
                                    type="file" 
                                    accept="image/*" 
                                    onChange={handleScreenshotUpload}
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                />
                                <Button variant="outline" className="w-full rounded-xl border-amber-300 text-amber-700">
                                    <ImageIcon className="mr-2 h-4 w-4" />
                                    Upload Receipt / Screenshot
                                </Button>
                            </div>
                        </div>
                      ) : (
                          <>
                            <div className="bg-muted p-4 rounded-2xl text-center border">
                                <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest mb-1">Renewal Amount</p>
                                <p className="text-3xl font-black">{PLATFORM_FEE_AMOUNT} {classroom.billingCurrency || 'INR'}</p>
                            </div>
                            <div className="space-y-3">
                                <Button asChild className="w-full btn-gel h-14 text-lg rounded-2xl shadow-xl" onClick={() => setPaymentInitiated(true)}>
                                    <a href={upiUrl}><CreditCard className="mr-2 h-5 w-5" /> Pay via UPI</a>
                                </Button>
                                <p className="text-[10px] text-center text-muted-foreground">After paying to <span className="font-bold">07arman2004-1@oksbi</span>, return here to upload your receipt.</p>
                            </div>
                          </>
                      )}
                  </CardContent>
                  <CardFooter className="bg-muted/50 border-t p-4 text-center">
                      <p className="text-[10px] text-muted-foreground w-full">Access will be restored once the transaction is verified by AI.</p>
                  </CardFooter>
              </Card>
          </div>
      );
  }

  return (
    <ClassroomProvider value={contextValue}>
      <div className="flex flex-1 flex-col h-full overflow-hidden">
        {classroom.subscriptionStatus === 'grace_period' && (
            <div className="bg-amber-500 text-white px-4 py-2 flex items-center justify-between text-xs font-bold animate-in slide-in-from-top duration-500">
                <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4" />
                    <span>SUBSCRIPTION EXPIRED: Classroom will be blocked in {GRACE_PERIOD_DAYS - Math.floor((Date.now() - classroom.nextPaymentDue.toDate().getTime()) / (1000 * 60 * 60 * 24))} days.</span>
                </div>
                {userRole === 'creator' && (
                    <Button size="sm" variant="secondary" className="h-7 rounded-full text-[10px] font-black" onClick={() => setPaymentInitiated(true)} disabled={isVerifying || paymentInitiated}>
                        {isVerifying ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                        RENEW NOW
                    </Button>
                )}
            </div>
        )}
        {children}
      </div>
    </ClassroomProvider>
  );
}
