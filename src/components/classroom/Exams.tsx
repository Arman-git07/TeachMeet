
'use client';

import { useState, useEffect, useCallback, memo } from 'react';
import { collection, query, onSnapshot, orderBy, addDoc, serverTimestamp, deleteDoc, doc } from 'firebase/firestore';
import { db, storage } from '@/lib/firebase';
import { ref as storageRef, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { useClassroom } from '@/contexts/ClassroomContext';
import { canManage } from '@/lib/roles';
import { useToast } from '@/hooks/use-toast';
import { useForm, Controller, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogClose, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { PlusCircle, Trash2, X } from 'lucide-react';
import type { Exam } from '@/app/dashboard/classrooms/[classroomId]/page';

const examSchema = z.object({
    title: z.string().min(1, "Exam title is required"),
    date: z.date({ required_error: "Exam date is required" }),
    questions: z.array(z.object({
        type: z.enum(['qa', 'mcq']),
        question: z.string().min(1, 'Required'),
        answer: z.string().optional(),
    })).optional(),
});

export function Exams() {
    const { classroomId, user, userRole } = useClassroom();
    const { toast } = useToast();
    const [exams, setExams] = useState<Exam[]>([]);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const canUserManage = canManage(userRole);
    const examForm = useForm<z.infer<typeof examSchema>>({ resolver: zodResolver(examSchema) });
    const { fields, append, remove } = useFieldArray({ control: examForm.control, name: "questions" });

    useEffect(() => {
        if (!classroomId) return;
        const q = query(collection(db, 'classrooms', classroomId, 'exams'), orderBy('date', 'desc'));
        return onSnapshot(q, (snapshot) => {
            setExams(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Exam)));
        });
    }, [classroomId]);

    const onExamSubmit = useCallback(async (data: z.infer<typeof examSchema>) => {
        if (!canUserManage || !user) return;
        try {
            await addDoc(collection(db, 'classrooms', classroomId, 'exams'), { 
                title: data.title, date: data.date, authorId: user.uid, questions: data.questions || [], type: 'text', createdAt: serverTimestamp() 
            });
            toast({ title: "Exam Created!" });
            setIsDialogOpen(false);
            examForm.reset({ questions: [] });
        } catch (error) {
            toast({ variant: 'destructive', title: "Failed" });
        }
    }, [canUserManage, user, classroomId, toast, examForm]);

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <div><CardTitle>Exams</CardTitle><CardDescription>Scheduled tests and assessments.</CardDescription></div>
                {canUserManage && (
                    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                        <DialogTrigger asChild><Button><PlusCircle className="mr-2 h-4 w-4" /> New Exam</Button></DialogTrigger>
                        <DialogContent className="sm:max-w-3xl max-h-[90dvh] flex flex-col p-0">
                            <DialogHeader className="p-6 pb-4 border-b"><DialogTitle>Create Exam</DialogTitle></DialogHeader>
                            <form id="exam-form" onSubmit={examForm.handleSubmit(onExamSubmit)} className="flex-1 overflow-y-auto p-6 space-y-4">
                                <div><Label>Title</Label><Input {...examForm.register('title')} /></div>
                                <div><Label>Date</Label><Controller control={examForm.control} name="date" render={({ field }) => (<Input type="datetime-local" onChange={(e) => field.onChange(new Date(e.target.value))} value={field.value ? format(field.value, "yyyy-MM-dd'T'HH:mm") : ""} />)} /></div>
                                <div className="pt-4 space-y-2">
                                    <div className="flex items-center justify-between mb-2">
                                        <Label className="font-semibold">Questions</Label>
                                        <div className="flex gap-2">
                                            <Button type="button" variant="outline" size="sm" onClick={() => append({ type: 'qa', question: '', answer: '' })}><PlusCircle className="mr-1 h-3 w-3" /> Add Q/A</Button>
                                            <Button type="button" variant="outline" size="sm" onClick={() => append({ type: 'mcq', question: '', answer: '' })}><PlusCircle className="mr-1 h-3 w-3" /> Add MCQ</Button>
                                        </div>
                                    </div>
                                    <ScrollArea className="h-64 border rounded-md p-4">
                                        {fields.map((field, index) => (
                                            <Card key={field.id} className="mb-4 p-4 relative">
                                                <Button type="button" variant="ghost" size="icon" className="absolute top-2 right-2" onClick={() => remove(index)}><X className="h-4 w-4"/></Button>
                                                <Label className="text-xs text-primary mb-2 block uppercase">Question {index + 1}</Label>
                                                <Input {...examForm.register(`questions.${index}.question` as const)} placeholder="Enter question..." />
                                            </Card>
                                        ))}
                                    </ScrollArea>
                                </div>
                            </form>
                            <DialogFooter className="p-6 border-t"><Button type="submit" form="exam-form">Create Exam</Button></DialogFooter>
                        </DialogContent>
                    </Dialog>
                )}
            </CardHeader>
            <CardContent className="space-y-3">
                {exams.length > 0 ? exams.map(exam => (
                    <div key={exam.id} className="p-4 border rounded-lg flex justify-between items-center group">
                        <div><h4 className="font-semibold">{exam.title}</h4><p className="text-sm text-muted-foreground">{new Date(exam.date.toDate()).toLocaleString()}</p></div>
                        {canUserManage && <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100" onClick={async () => { await deleteDoc(doc(db, "classrooms", classroomId!, "exams", exam.id)); toast({ title: "Deleted" }); }}><Trash2 className="h-4 w-4"/></Button>}
                    </div>
                )) : <div className="text-center py-8 text-muted-foreground">No exams scheduled.</div>}
            </CardContent>
        </Card>
    );
}
