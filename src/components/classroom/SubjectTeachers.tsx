'use client';

import { useState, useEffect } from 'react';
import { collection, query, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useClassroom } from '@/contexts/ClassroomContext';
import { DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Clock, User } from 'lucide-react';
import type { SubjectTeacher } from '@/app/dashboard/classrooms/[classroomId]/page';

export function SubjectTeachers() {
    const { classroomId } = useClassroom();
    const [subjectTeachers, setSubjectTeachers] = useState<SubjectTeacher[]>([]);

    useEffect(() => {
        if (!classroomId) return;
        const q = query(collection(db, `classrooms/${classroomId}/teachers`), orderBy('addedAt', 'desc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setSubjectTeachers(snapshot.docs.map(d => ({ 
                teacherId: d.id, 
                ...d.data() 
            } as SubjectTeacher)));
        });
        return unsubscribe;
    }, [classroomId]);

    return (
        <DialogContent className="sm:max-w-md">
            <DialogHeader className="pb-4 border-b">
                <DialogTitle className="text-xl font-bold">Subject Teachers</DialogTitle>
                <DialogDescription>
                    List of educators specializing in different subjects for this classroom.
                </DialogDescription>
            </DialogHeader>
            <ScrollArea className="max-h-[60vh]">
                <div className="p-4 space-y-4">
                    {subjectTeachers.length > 0 ? (
                        subjectTeachers.map(t => (
                            <Card key={t.teacherId} className="overflow-hidden border shadow-sm rounded-xl transition-all hover:shadow-md hover:border-primary/20">
                                <div className="p-4 flex items-start gap-4">
                                    <Avatar className="h-12 w-12 border-2 border-primary/10">
                                        <AvatarFallback className="bg-primary/5 text-primary">
                                            <User className="h-6 w-6" />
                                        </AvatarFallback>
                                    </Avatar>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between gap-2 mb-1">
                                            <h3 className="font-bold text-base truncate text-foreground">{t.name}</h3>
                                            <Badge variant="secondary" className="text-[10px] uppercase font-bold tracking-wider px-2 h-5">
                                                Expert
                                            </Badge>
                                        </div>
                                        <p className="text-sm font-semibold text-primary mb-3">
                                            {t.subject}
                                        </p>
                                        
                                        <div className="bg-muted/30 rounded-lg p-3 border border-border/50">
                                            <div className="flex items-center gap-2 text-muted-foreground">
                                                <Clock className="h-3.5 w-3.5 text-primary" />
                                                <span className="text-[10px] font-black uppercase tracking-widest">Availability</span>
                                            </div>
                                            <p className="text-sm text-foreground/80 mt-1 italic leading-relaxed">
                                                {t.availability}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </Card>
                        ))
                    ) : (
                        <div className="text-center py-12 px-4">
                            <div className="h-16 w-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4 opacity-50">
                                <User className="h-8 w-8 text-muted-foreground" />
                            </div>
                            <p className="text-sm font-medium text-muted-foreground">No subject teachers listed.</p>
                            <p className="text-xs text-muted-foreground/60 mt-1">The classroom owner can add teachers here.</p>
                        </div>
                    )}
                </div>
            </ScrollArea>
        </DialogContent>
    );
}