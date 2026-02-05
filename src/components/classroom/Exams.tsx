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
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogClose, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription as AlertDescription,
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

const MCQQuestionEditor = ({ nestIndex, control, register, setValue, watch }: { nestIndex: number; control: any, register: any, setValue: any, watch: any }) => {
    const { fields, remove, append } = useFieldArray({
        control,
        name: `questions.${nestIndex}.options`
    });
    
    const correctIndex = watch(`questions.${nestIndex}.correctOptionIndex`);

    const handleRemoveOption = (indexToRemove: number) => {
        const selectedIndex = watch(`questions.${nestIndex}.correctOptionIndex`);
        
        if (selectedIndex === indexToRemove) {
            setValue(`questions.${nestIndex}.correctOptionIndex`, 0, { shouldDirty: true });
        } else if (selectedIndex > indexToRemove) {
            setValue(`questions.${nestIndex}.correctOptionIndex`, selectedIndex - 1, { shouldDirty: true });
        }
        
        remove(indexToRemove);
    };

    return (
        <div className="space-y-2 pl-4">
            <Label className="text-xs text-muted-foreground">Options (select the correct one)</Label>
            <RadioGroup 
                onValueChange={(v) => setValue(`questions.${nestIndex}.correctOptionIndex`, parseInt(v))} 
                value={correctIndex !== undefined ? String(correctIndex) : undefined}
                className="space-y-2"
            >
                {fields.map((item, k) => (
                    <div key={item.id} className="flex items-center gap-2">
                        <RadioGroupItem value={String(k)} id={`q${nestIndex}-opt${k}`} />
                        <Label htmlFor={`q${nestIndex}-opt${k}`} className="sr-only">Option {k + 1}</Label>
                        <Input {...register(`questions.${nestIndex}.options.${k}.text`)} placeholder={`Option ${k + 1}`} />
                        <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive/70 shrink-0" onClick={() => handleRemoveOption(k)} disabled={fields.length <= 2}>
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    </div>
                ))}
            </RadioGroup>
            <Button type="button" size="sm" variant="outline" onClick={() => append({ text: '' })} disabled={fields.length >= 6}>
                Add Option
            </Button>
        </div>
    );
};

const ExamViewDialog = ({ exam, isOpen, onOpenChange, toast }: { exam: Exam | null; isOpen: boolean; onOpenChange: (open: boolean) => void; toast: any }) => {
    if (!exam) return null;

    const handleSubmit = () => {
        toast({ title: "Exam Submitted (Simulated)", description: "In a real application, your answers would be saved to the database." });
        onOpenChange(false);
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-4xl flex flex-col max-h-[90dvh]">
                <DialogHeader>
                    <DialogTitle>{exam.title}</DialogTitle>
                    <DialogDescription>
                        Due: {new Date(exam.date.toDate()).toLocaleString()}
                    </DialogDescription>
                </DialogHeader>
                <ScrollArea className="flex-grow pr-6">
                    <div className="py-4 space-y-6">
                        {exam.type === 'file' && exam.fileUrl && (
                            <div className="aspect-video w-full">
                                <iframe src={exam.fileUrl} className="w-full h-full border rounded-lg" title={exam.title} />
                            </div>
                        )}
                        {exam.type === 'text' && exam.content && (
                            <form className="space-y-6">
                                {exam.content.map((q, index) => (
                                    <Card key={index} className="p-4">
                                        <Label className="font-semibold mb-2 block">Q{index + 1}: {q.question}</Label>
                                        {q.type === 'qa' && (
                                            <Textarea placeholder="Your answer..." />
                                        )}
                                        {q.type === 'mcq' && q.options && (
                                            <RadioGroup>
                                                {q.options.map((opt, optIndex) => (
                                                    <div key={optIndex} className="flex items-center space-x-2">
                                                        <RadioGroupItem value={opt.text} id={`q${index}-opt${optIndex}`} />
                                                        <Label htmlFor={`q${index}-opt${optIndex}`}>{opt.text}</Label>
                                                    </div>
                                                ))}
                                            </RadioGroup>
                                        )}
                                    </Card>
                                ))}
                            </form>
                        )}
                    </div>
                </ScrollArea>
                <DialogFooter>
                    <DialogClose asChild>
                        <Button variant="outline">Cancel</Button>
                    </DialogClose>
                    <Button onClick={handleSubmit}>Submit Exam</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export function Exams() {
    const { classroomId, user, userRole } = useClassroom();
    const { toast } = useToast();
    const [exams, setExams] = useState<Exam[]>([]);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [viewingExam, setViewingExam] = useState<Exam | null>(null);
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

        const toastId = `exam-create-${Date.now()}`;
        const toastHandle = toast({ id: toastId, title: 'Creating Exam...', description: 'Please wait...', duration: Infinity });
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
            toastHandle.update({ id: toastHandle.id, title: "Exam Created!", description: "" });
            setIsDialogOpen(false);
            examForm.reset({ questions: [] });
        } catch (error) {
            toastHandle.update({ id: toastHandle.id, variant: 'destructive', title: "Creation Failed", description: "Could not create the exam." });
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
        <>
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
                                    
                                    <div className="space-y-2 mt-6">
                                        <div className="flex items-center justify-between mb-2">
                                            <Label className="text-sm font-semibold">Questions</Label>
                                            <div className="flex gap-2">
                                                <Button 
                                                    type="button" 
                                                    variant="outline" 
                                                    size="sm" 
                                                    className="h-8 px-2 text-[10px] font-bold uppercase tracking-wider"
                                                    onClick={() => append({ type: 'qa', question: '', answer: '' })}
                                                >
                                                    <PlusCircle className="mr-1 h-3 w-3" /> Add Q/A
                                                </Button>
                                                <Button 
                                                    type="button" 
                                                    variant="outline" 
                                                    size="sm" 
                                                    className="h-8 px-2 text-[10px] font-bold uppercase tracking-wider"
                                                    onClick={() => append({ type: 'mcq', question: '', options: [{ text: '' }, { text: '' }], correctOptionIndex: 0 })}
                                                >
                                                    <PlusCircle className="mr-1 h-3 w-3" /> Add MCQ
                                                </Button>
                                            </div>
                                        </div>
                                        <ScrollArea className="h-72 w-full rounded-md border p-4 bg-muted/5">
                                            {fields.map((field, index) => (
                                                <Card key={field.id} className="mb-4 p-4 space-y-3 relative shadow-sm border-border/50">
                                                    <Button type="button" variant="ghost" size="icon" className="absolute top-2 right-2 h-6 w-6" onClick={() => remove(index)}><X className="h-4 w-4 text-destructive" /></Button>
                                                    <h4 className="font-medium text-xs text-primary uppercase tracking-tight">Q{index + 1} ({field.type.toUpperCase()})</h4>
                                                    <Input {...examForm.register(`questions.${index}.question`)} placeholder="Question Text" className="bg-background" />
                                                    {field.type === 'qa' && <Textarea {...examForm.register(`questions.${index}.answer`)} placeholder="Correct Answer (for reference)" className="bg-background text-sm" />}
                                                    {field.type === 'mcq' && (
                                                        <MCQQuestionEditor
                                                            nestIndex={index}
                                                            control={examForm.control}
                                                            register={examForm.register}
                                                            setValue={examForm.setValue}
                                                            watch={examForm.watch}
                                                        />
                                                    )}
                                                </Card>
                                            ))}
                                            {fields.length === 0 && (
                                                <div className="h-full flex flex-col items-center justify-center text-muted-foreground py-12">
                                                    <PlusCircle className="h-8 w-8 mb-2 opacity-20" />
                                                    <p className="text-sm">Click "Add" above to start building your exam.</p>
                                                </div>
                                            )}
                                        </ScrollArea>
                                        {examForm.formState.errors.questions && <p className="text-destructive text-sm">{examForm.formState.errors.questions.message}</p>}
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
                            <div key={exam.id} className="p-4 border rounded-lg group flex justify-between items-start hover:bg-muted/30 transition-colors">
                                <div>
                                    <h4 className="font-semibold">{exam.title}</h4>
                                    <p className="text-sm text-muted-foreground">Scheduled: {new Date(exam.date.toDate()).toLocaleString()}</p>
                                    {exam.vanishAt && <p className="text-xs text-destructive mt-1">Vanishes: {new Date(exam.vanishAt.toDate()).toLocaleString()}</p>}
                                </div>
                                <div className="flex items-center gap-2">
                                     {userRole === 'student' ? (
                                        <Button size="sm" className="btn-gel" onClick={() => setViewingExam(exam)}>
                                            Start Exam
                                        </Button>
                                    ) : (canUserManage || user?.uid === exam.authorId) ? (
                                        <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive/70 opacity-0 group-hover:opacity-100"><Trash2 className="h-4 w-4" /></Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent>
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                                    <AlertDescription>This will permanently delete this exam. This action cannot be undone.</AlertDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                    <AlertDialogAction onClick={() => handleDelete({ collectionName: 'exams', item: exam })}>Delete</AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                    ) : null}
                                </div>
                            </div>
                        )) : <p className="text-muted-foreground text-center py-4">No exams scheduled.</p>}
                    </div>
                </CardContent>
            </Card>

            <ExamViewDialog
                exam={viewingExam}
                isOpen={!!viewingExam}
                onOpenChange={(isOpen) => {
                    if (!isOpen) setViewingExam(null);
                }}
                toast={toast}
            />
        </>
    );
}
