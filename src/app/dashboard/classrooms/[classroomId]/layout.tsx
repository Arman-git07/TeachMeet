
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { db } from '@/lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { resolveRoleForUser, type Role } from "@/lib/roles";
import { ClassroomProvider } from '@/contexts/ClassroomContext';
import type { Classroom } from '@/app/dashboard/classrooms/[classroomId]/page';

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

  useEffect(() => {
    if (authLoading) return;
    
    if (!user) {
      router.push('/auth/signin');
      return;
    }

    let cancelled = false;
    
    // We listen to the role and classroom details in real-time.
    // If a student is approved while they have the dashboard open,
    // this listener will trigger and grant them access instantly.
    const unsubscribe = onSnapshot(doc(db, "classrooms", classroomId), async (docSnap) => {
        if (docSnap.exists()) {
            try {
                // Re-resolve role whenever the classroom doc or membership changes
                const { role, classroom: fetchedClassroom } = await resolveRoleForUser(String(classroomId), user?.uid);
                
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
    return <div className="container mx-auto p-4">Classroom not found or unavailable.</div>;
  }

  return (
    <ClassroomProvider value={contextValue}>
      <div className="flex flex-1 flex-col h-full overflow-hidden">
        {children}
      </div>
    </ClassroomProvider>
  );
}
