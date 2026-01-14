
'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
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
    let cancelled = false;
    
    const fetchRoleAndClassroom = async () => {
      if (!classroomId) return;
      if (!user) {
        router.push('/auth/signin');
        return;
      }
      const { role, classroom: fetchedClassroom } = await resolveRoleForUser(String(classroomId), user?.uid);
      if (!cancelled) {
        setUserRole(role);
        if (fetchedClassroom) {
          setClassroom(fetchedClassroom as Classroom);
        } else {
          toast({ variant: 'destructive', title: 'Classroom not found.' });
          router.push('/dashboard/classrooms');
        }
        setIsLoading(false);
      }
    };

    fetchRoleAndClassroom();

    const unsubscribe = onSnapshot(doc(db, "classrooms", classroomId), (doc) => {
        if (doc.exists()) {
            if (!cancelled) {
                setClassroom({ id: doc.id, ...doc.data() } as Classroom);
            }
        }
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
    return <div className="container mx-auto p-4"><Skeleton className="h-screen w-full" /></div>;
  }
  if (!classroom) {
    return <div className="container mx-auto p-4">Classroom not found.</div>;
  }

  return (
    <ClassroomProvider value={contextValue}>
      <div className="flex flex-1 flex-col h-full overflow-hidden">
        {children}
      </div>
    </ClassroomProvider>
  );
}
