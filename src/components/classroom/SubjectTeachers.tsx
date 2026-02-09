'use client';

import { useState, useEffect } from 'react';
import { collection, query, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useClassroom } from '@/contexts/ClassroomContext';
import { DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Clock } from 'lucide-react';
import type { SubjectTeacher } from '@/app/dashboard/classrooms/[classroomId]/page';

export function SubjectTeachers() {
    const { classroomId } = useClassroom();
    const [subjectTeachers, setSubjectTeachers] = useState<SubjectTeacher[]>([]);

    useEffect(() => {
        if (!classroomId) return;
        const q = query(collection(db, `classrooms/${classroomId}/teachers`), orderBy('addedAt', 'desc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setSubjectTeachers(snapshot.docs.map(d => ({ teacherId: d.id, ...d.data() } as SubjectTeacher)));
        });
        return unsubscribe;
    }, [classroomId]);

    return (
        <DialogContent className="sm:max-w-lg">
            <DialogHeader>
                <DialogTitle>Subject Teachers</DialogTitle>
                <DialogDescription>Contact information for teachers in this classroom.</DialogDescription>
            </DialogHeader>
            <ScrollArea className="max-h-[60vh] p-4">
                <div className="space-y-4">
                    {subjectTeachers.length > 0 ? subjectTeachers.map(t => (
                        <Card key={t.teacherId} className="p-4">
                            <div className="flex items-start gap-4">
                                <div className="flex-grow">
                                    <CardTitle className="text-lg">{t.name}</CardTitle>
                                    <CardDescription>{t.subject}</CardDescription>
                                    <div className="mt-2 text-xs space-y-1 text-muted-foreground">
                                        <p><Clock className="inline-block h-3 w-3 mr-1.5"/>{t.availability}</p>
                                    </div>
                                </div>
                            </div>
                        </Card>
                    )) : <p className="text-muted-foreground text-sm text-center py-4">No subject teachers have been added.</p>}
                </div>
            </ScrollArea>
        </DialogContent>
    );
}
