'use client';

import { useRouter, useParams } from 'next/navigation';
import { useEffect } from 'react';
import { Loader2 } from "lucide-react";

export default function ClassroomChatPage() {
  const router = useRouter();
  const params = useParams();
  const classroomId = params?.classroomId;

  useEffect(() => {
    // Feature has been removed. Redirecting back to the classroom dashboard.
    if (classroomId) {
      router.replace(`/dashboard/classrooms/${classroomId}`);
    } else {
      router.replace('/dashboard/classrooms');
    }
  }, [router, classroomId]);

  return (
    <div className="flex items-center justify-center h-full">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}
