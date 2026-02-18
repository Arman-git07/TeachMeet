
'use client';

import { useState, useEffect, useMemo } from 'react';
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
import { Lock, Wallet, ArrowLeft, Loader2, AlertCircle, CreditCard } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import Link from 'next/link';
import { cn } from '@/lib/utils';

const PLATFORM_FEE_AMOUNT = 10;
const GRACE_PERIOD_DAYS = 7;

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
  const [isRenewing, setIsRenewing] = useState(false);

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

  const handleRenew = async () => {
      if (!user || !classroom) return;
      setIsRenewing(true);
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
          setIsRenewing(false);
      }
  };

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

  // Blocking logic for non-creators
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

  // Billing interface for creator
  if (classroom.subscriptionStatus === 'blocked' && userRole === 'creator') {
      const upiUrl = `upi://pay?pa=07arman2004-1@oksbi&pn=${encodeURIComponent("TeachMeet Maintenance")}&am=${PLATFORM_FEE_AMOUNT}&cu=${classroom.billingCurrency || 'INR'}&tn=Renewal_${classroom.id}`;
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
                      <div className="bg-muted p-4 rounded-2xl text-center border">
                          <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest mb-1">Renewal Amount</p>
                          <p className="text-3xl font-black">{PLATFORM_FEE_AMOUNT} {classroom.billingCurrency || 'INR'}</p>
                      </div>
                      <div className="space-y-3">
                          <Button asChild className="w-full btn-gel h-14 text-lg rounded-2xl shadow-xl">
                              <a href={upiUrl}><CreditCard className="mr-2 h-5 w-5" /> Pay via UPI</a>
                          </Button>
                          <Button onClick={handleRenew} disabled={isRenewing} className="w-full h-12 rounded-xl">
                              {isRenewing ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : null}
                              Confirm Payment & Unblock
                          </Button>
                      </div>
                  </CardContent>
                  <CardFooter className="bg-muted/50 border-t p-4 text-center">
                      <p className="text-[10px] text-muted-foreground w-full">Your students and subject teachers cannot access this class until unblocked.</p>
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
                    <Button size="sm" variant="secondary" className="h-7 rounded-full text-[10px] font-black" onClick={handleRenew} disabled={isRenewing}>
                        {isRenewing ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
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
