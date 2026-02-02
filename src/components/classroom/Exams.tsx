
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { PlusCircle, Trash2, X } from 'lucide-react';
import type { Exam, DeletableItem, ExamQuestion } from '@/app/dashboard/classrooms/[classroomId]/page';

const examQuestionSchema = z.object({
    type: z.enum(['qa', 'mcq']),
    question: z.string().min(1, 'Question text is required.'),
    answer: z.string().optional(),
    options: z.array(z.object({ text: z.string().min(1, 'Option text cannot be empty.') })).optional(),
    correctOptionIndex: z.coerce.number().optional(),
});

const examSchema = z.object({
    title: z.string().min(1, "Exam title is required"),
    date: z.date({ required_error: "Exam date is required" }),
    vanishAt: z.date().optional(),
    examFile: z.any().optional(),
    questions: z.array(examQuestionSchema).optional(),
}).refine(data => !data.vanishAt || data.vanishAt > data.date, {
    message: "Vanish time must be after the exam time.",
    path: ["vanishAt"],
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
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const now = new Date();
            const validExams = snapshot.docs
                .map(d => ({ id: d.id, ...d.data() } as Exam))
                .filter(exam => !exam.vanishAt || exam.vanishAt.toDate() > now);
            setExams(validExams);
        }, (error) => {
            toast({ variant: 'destructive', title: "Error", description: "Could not fetch exams." });
        });
        return unsubscribe;
    }, [classroomId, toast]);

    const onExamSubmit = useCallback(async (data: z.infer<typeof examSchema>) => {
        if (!canUserManage || !user) return;
        const examFile = data.examFile?.[0];
        if (!examFile && (!data.questions || data.questions.length === 0)) {
            examForm.setError("questions", { type: "manual", message: "Add at least one question or upload an exam file." });
            return;
        }

        const toastId = `exam-upload-${Date.now()}`;
        toast({ id: toastId, title: 'Creating Exam...', description: 'Please wait...' });
        try {
            let examData: any = { title: data.title, date: data.date, vanishAt: data.vanishAt || null, authorId: user.uid };
            if (examFile) {
                const path = `classrooms/${classroomId}/exams/${Date.now()}-${examFile.name}`;
                const fileRef = storageRef(storage, path);
                const snapshot = await uploadBytes(fileRef, examFile);
                examData.type = 'file';
                examData.fileUrl = await getDownloadURL(snapshot.ref);
                examData.storagePath = path;
            } else {
                examData.type = 'text';
                examData.content = data.questions;
            }
            await addDoc(collection(db, 'classrooms', classroomId, 'exams'), examData);
            toast.update(toastId, { title: "Exam Created!" });
            setIsDialogOpen(false);
            examForm.reset({ questions: [] });
        } catch (error) {
            toast.update(toastId, { variant: 'destructive', title: "Creation Failed" });
        }
    }, [canUserManage, user, classroomId, toast, examForm]);
    
    const handleDelete = useCallback(async (itemToDelete: DeletableItem | null) => {
        if (!itemToDelete || !classroomId) return;
        const { collectionName, item } = itemToDelete;
        try {
            if (item.storagePath) {
                await deleteObject(storageRef(storage, item.storagePath)).catch(err => { if (err.code !== 'storage/object-not-found') throw err; });
            }
            await deleteDoc(doc(db, "classrooms", classroomId, collectionName, item.id));
            toast({ title: "Item Deleted" });
        } catch (error: any) {
            toast({ variant: 'destructive', title: "Deletion Failed", description: error.message });
        }
    }, [classroomId, toast]);

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle>Exams & Tests</CardTitle>
                    <CardDescription>Manage and view scheduled exams.</CardDescription>
                </div>
                {canUserManage && (
                    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                        <DialogTrigger asChild><Button><PlusCircle className="mr-2 h-4 w-4" /> Add New Exam</Button></DialogTrigger>
                        <DialogContent className="sm:max-w-3xl flex flex-col max-h-[90dvh] p-0">
                            <DialogHeader className="p-6 pb-4 border-b">
                                <DialogTitle>Create New Exam</DialogTitle>
                            </DialogHeader>
                            <form id="exam-form" onSubmit={examForm.handleSubmit(onExamSubmit)} className="flex-grow overflow-y-auto space-y-4 p-6">
                                <div className="space-y-2"><Label>Exam Title</Label><Input {...examForm.register('title')} />{examForm.formState.errors.title && <p className="text-destructive text-sm">{examForm.formState.errors.title.message}</p>}</div>
                                <div className="grid md:grid-cols-2 gap-4">
                                    <div><Label>Exam Date & Time</Label><Controller control={examForm.control} name="date" render={({ field }) => (<Input type="datetime-local" onChange={(e) => field.onChange(new Date(e.target.value))} onBlur={field.onBlur} value={field.value ? format(field.value, "yyyy-MM-dd'T'HH:mm") : ""} />)} />{examForm.formState.errors.date && <p className="text-destructive text-sm">{examForm.formState.errors.date.message}</p>}</div>
                                    <div><Label>Vanish Time (Optional)</Label><Controller control={examForm.control} name="vanishAt" render={({ field }) => (<Input type="datetime-local" onChange={(e) => field.onChange(new Date(e.target.value))} onBlur={field.onBlur} value={field.value ? format(field.value, "yyyy-MM-dd'T'HH:mm") : ""} />)} />{examForm.formState.errors.vanishAt && <p className="text-destructive text-sm">{examForm.formState.errors.vanishAt.message}</p>}</div>
                                </div>
                                <div className="relative flex items-center my-4"><div className="flex-grow border-t"></div><span className="flex-shrink mx-4 text-xs text-muted-foreground">UPLOAD OR CREATE QUESTIONS</span><div className="flex-grow border-t"></div></div>
                                <div><Label>Upload Exam Paper (optional)</Label><Input type="file" {...examForm.register('examFile')} /></div>
                                <div className="space-y-2"><Label>Questions</Label>
                                    <ScrollArea className="h-72 w-full rounded-md border p-4">
                                        {fields.map((field, index) => (
                                            <Card key={field.id} className="mb-4 p-4 space-y-3 relative">
                                                <Button type="button" variant="ghost" size="icon" className="absolute top-2 right-2 h-6 w-6" onClick={() => remove(index)}><X className="h-4 w-4 text-destructive" /></Button>
                                                <h4 className="font-medium text-sm">Q{index + 1} ({field.type.toUpperCase()})</h4>
                                                <Input {...examForm.register(`questions.${index}.question`)} placeholder="Question Text" />
                                                {field.type === 'qa' && <Textarea {...examForm.register(`questions.${index}.answer`)} placeholder="Answer" />}
                                                {field.type === 'mcq' && (
                                                    <div className="space-y-2 pl-4">
                                                        {field.options?.map((_, optIndex) => (<div key={optIndex} className="flex items-center gap-2"><Input {...examForm.register(`questions.${index}.options.${optIndex}.text`)} placeholder={`Option ${optIndex + 1}`} /><RadioGroup onValueChange={(v) => examForm.setValue(`questions.${index}.correctOptionIndex`, parseInt(v))} value={String(examForm.watch(`questions.${index}.correctOptionIndex`))}><RadioGroupItem value={String(optIndex)} id={`q${index}-opt${optIndex}`} /></RadioGroup><Label htmlFor={`q${index}-opt${optIndex}`} className="text-xs">Correct</Label></div>))}
                                                    </div>
                                                )}
                                            </Card>
                                        ))}
                                    </ScrollArea>
                                    {examForm.formState.errors.questions && <p className="text-destructive text-sm">{examForm.formState.errors.questions.message}</p>}
                                    <div className="flex gap-2"><Button type="button" variant="outline" onClick={() => append({ type: 'qa', question: '', answer: '' })}>Add Q/A</Button><Button type="button" variant="outline" onClick={() => append({ type: 'mcq', question: '', options: [{ text: '' }, { text: '' }, { text: '' }, { text: '' }], correctOptionIndex: 0 })}>Add MCQ</Button></div>
                                </div>
                            </form>
                            <DialogFooter className="p-6 pt-4 border-t flex-shrink-0"><DialogClose asChild><Button type="button" variant="secondary">Cancel</Button></DialogClose><Button type="submit" form="exam-form">Create Exam</Button></DialogFooter>
                        </DialogContent>
                    </Dialog>
                )}
            </CardHeader>
            <CardContent>
                <div className="space-y-3">
                    {exams.length > 0 ? exams.map(exam => (
                        <div key={exam.id} className="p-4 border rounded-lg group flex justify-between items-start">
                            <div>
                                <h4 className="font-semibold">{exam.title}</h4>
                                <p className="text-sm text-muted-foreground">Scheduled: {new Date(exam.date.toDate()).toLocaleString()}</p>
                                {exam.vanishAt && <p className="text-xs text-destructive mt-1">Vanishes: {new Date(exam.vanishAt.toDate()).toLocaleString()}</p>}
                            </div>
                            <div className="flex items-center gap-2">
                                <Button size="sm" className="btn-gel">Take Exam</Button>
                                {(canUserManage || user?.uid === exam.authorId) && (
                                    <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive/70 opacity-0 group-hover:opacity-100"><Trash2 className="h-4 w-4" /></Button>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent>
                                            <AlertDialogHeader>
                                                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                                <AlertDialogDescription>This will permanently delete this exam. This action cannot be undone.</AlertDialogDescription>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter>
                                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                <AlertDialogAction onClick={() => handleDelete({ collectionName: 'exams', item: exam })}>Delete</AlertDialogAction>
                                            </AlertDialogFooter>
                                        </AlertDialogContent>
                                    </AlertDialog>
                                )}
                            </div>
                        </div>
                    )) : <p className="text-muted-foreground text-center py-4">No exams scheduled.</p>}
                </div>
            </CardContent>
        </Card>
    );
}
