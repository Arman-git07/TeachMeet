
'use client';

import React, { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input} from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from '@/hooks/useAuth';
import { storage, db } from '@/lib/firebase'; // Import db
import { ref as storageRef, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { collection, addDoc, serverTimestamp, Timestamp } from 'firebase/firestore'; // Firestore imports
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { CalendarClock, UploadCloud, Link as LinkIcon, Loader2, Edit2Icon, PlusCircle } from "lucide-react";

interface Exam {
  id: string; // Firestore will generate this
  title: string;
  description: string;
  teacherId: string;
  teacherName: string;
  scheduledDateTime: any; // Firestore Timestamp
  dueDateTime: any; // Firestore Timestamp
  totalMarks: number;
  questionPaperUrl?: string;
  questionPaperFileName?: string;
  directQuestions?: string;
  status: 'Upcoming' | 'Active' | 'Ended' | 'Graded';
  classId?: string;
  className?: string; // Denormalized for easier display if needed
}

const MAX_FILE_SIZE_MB = 10;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

interface CreateExamDialogProps {
    isOpen?: boolean;
    onOpenChange?: (isOpen: boolean) => void;
    onExamCreated?: (newExam: Exam) => void;
    classContext?: { classId: string; className?: string };
}

const CreateExamDialogComponent: React.FC<CreateExamDialogProps> = ({ isOpen: externalIsOpen, onOpenChange: externalOnOpenChange, onExamCreated, classContext }) => {
  const { toast } = useToast();
  const { user } = useAuth();

  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const isControlled = externalIsOpen !== undefined && externalOnOpenChange !== undefined;
  const isOpen = isControlled ? externalIsOpen : internalIsOpen;
  
  const setIsOpen = (open: boolean) => {
    if (isControlled) { externalOnOpenChange!(open); } else { setInternalIsOpen(open); }
  };

  const [newExamTitle, setNewExamTitle] = useState('');
  const [newExamDescription, setNewExamDescription] = useState('');
  const [newExamScheduledDate, setNewExamScheduledDate] = useState<Date | undefined>(new Date());
  const [newExamScheduledTime, setNewExamScheduledTime] = useState<string>("09:00");
  const [newExamDueDate, setNewExamDueDate] = useState<Date | undefined>(() => { const t = new Date(); t.setDate(t.getDate() + 1); return t; });
  const [newExamDueTime, setNewExamDueTime] = useState<string>("17:00");
  const [newExamTotalMarks, setNewExamTotalMarks] = useState<number | string>(100);
  const [newExamQuestionMode, setNewExamQuestionMode] = useState<'upload' | 'link' | 'editor'>('upload');
  const [newExamPaperFile, setNewExamPaperFile] = useState<File | null>(null);
  const [newExamQuestionLink, setNewExamQuestionLink] = useState<string>('');
  const [newExamDirectQuestions, setNewExamDirectQuestions] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const questionPaperInputRef = useRef<HTMLInputElement>(null);

  const combineDateAndTime = (date: Date, time: string): Date => {
    const [hours, minutes] = time.split(':').map(Number);
    const newDate = new Date(date); newDate.setHours(hours, minutes, 0, 0); return newDate;
  };
  
  const resetCreateExamDialog = React.useCallback(() => {
    setNewExamTitle(''); setNewExamDescription(''); setNewExamScheduledDate(new Date()); setNewExamScheduledTime("09:00");
    const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1); setNewExamDueDate(tomorrow);
    setNewExamDueTime("17:00"); setNewExamTotalMarks(100); setNewExamQuestionMode('upload');
    setNewExamPaperFile(null); setNewExamQuestionLink(''); setNewExamDirectQuestions('');
    if (questionPaperInputRef.current) questionPaperInputRef.current.value = ""; setIsProcessing(false);
  }, []);
  
  useEffect(() => { if (!isOpen) { resetCreateExamDialog(); } }, [isOpen, resetCreateExamDialog]);
  const handleOpenChange = (openState: boolean) => { setIsOpen(openState); if (!openState) { resetCreateExamDialog(); } };

  const handleQuestionPaperFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > MAX_FILE_SIZE_BYTES) {
        toast({ variant: "destructive", title: "File Too Large", description: `Max ${MAX_FILE_SIZE_MB}MB.` });
        setNewExamPaperFile(null); if (questionPaperInputRef.current) questionPaperInputRef.current.value = ""; return;
      }
      setNewExamPaperFile(file);
    } else { setNewExamPaperFile(null); }
  };

  const uploadQuestionPaperFileToStorage = async (paperFile: File, userId: string, examIdPlaceholder: string): Promise<{ url: string; fileName: string; filePath: string }> => {
    const fileName = `${Date.now()}_${paperFile.name.replace(/\s+/g, '_')}`;
    const filePath = `exam_papers/${userId}/${examIdPlaceholder}/${fileName}`; // Use placeholder for path construction
    const fileRef = storageRef(storage, filePath);
    const toastId = `upload-exam-paper-${Date.now()}`;
    toast({ id: toastId, title: "Uploading Paper...", description: <div className="flex items-center"><UploadCloud className="mr-2 h-4 w-4 animate-pulse" /><span>Starting...</span></div>, duration: Infinity });
    
    await uploadBytesResumable(fileRef, paperFile);
    const downloadURL = await getDownloadURL(fileRef);
    
    toast.dismiss(toastId);
    toast({ title: "Paper Uploaded!", description: `${paperFile.name} uploaded.` });
    return { url: downloadURL, fileName: paperFile.name, filePath };
  };

  const handleCreateExam = async () => {
    if (!newExamTitle.trim() || !newExamDescription.trim() || !newExamScheduledDate || !newExamDueDate || !user) {
      toast({ variant: "destructive", title: "Missing Info", description: "Fill all required fields & be logged in." }); return;
    }
    if (typeof newExamTotalMarks === 'string' && isNaN(parseInt(newExamTotalMarks))) { toast({ variant: "destructive", title: "Invalid Marks" }); return; }
    
    const scheduledDateTime = combineDateAndTime(newExamScheduledDate, newExamScheduledTime);
    const dueDateTime = combineDateAndTime(newExamDueDate, newExamDueTime);
    if (dueDateTime <= scheduledDateTime) { toast({ variant: "destructive", title: "Invalid Dates", description: "Due date must be after scheduled." }); return; }
    if (newExamQuestionMode === 'link' && !newExamQuestionLink.trim()) { toast({ variant: "destructive", title: "Missing Link" }); return; }
    if (newExamQuestionMode === 'editor' && !newExamDirectQuestions.trim()) { toast({ variant: "destructive", title: "Missing Questions" }); return; }

    setIsProcessing(true); 
    let paperDetails: { url?: string; fileName?: string; directQuestions?: string; filePath?: string } = {};
    // Firestore will generate ID, but we can make a placeholder for storage path if needed (not strictly required if ID is part of path later)
    const examIdPlaceholder = `exam_${Date.now()}`; 

    try {
      if (newExamQuestionMode === 'upload' && newExamPaperFile) {
        const uploadResult = await uploadQuestionPaperFileToStorage(newExamPaperFile, user.uid, examIdPlaceholder);
        paperDetails = { url: uploadResult.url, fileName: uploadResult.fileName, filePath: uploadResult.filePath };
      } else if (newExamQuestionMode === 'link') {
        paperDetails = { url: newExamQuestionLink.trim(), fileName: "Online Questions (External Link)" };
      } else if (newExamQuestionMode === 'editor') {
        paperDetails = { directQuestions: newExamDirectQuestions.trim(), fileName: "Directly Entered Questions" };
      }

      const examData: Omit<Exam, 'id'> = {
        title: newExamTitle.trim(), description: newExamDescription.trim(), teacherId: user.uid,
        teacherName: user.displayName || "Teacher", scheduledDateTime: Timestamp.fromDate(scheduledDateTime),
        dueDateTime: Timestamp.fromDate(dueDateTime), totalMarks: Number(newExamTotalMarks),
        questionPaperUrl: paperDetails.url, questionPaperFileName: paperDetails.fileName,
        directQuestions: paperDetails.directQuestions, filePath: paperDetails.filePath, // Storage path for uploaded file
        status: "Upcoming", classId: classContext?.classId, className: classContext?.className,
      };

      const docRef = await addDoc(collection(db, "exams"), examData);
      const createdExam: Exam = { ...examData, id: docRef.id };

      if (onExamCreated) { onExamCreated(createdExam); }
      toast({ title: "Exam Created!", description: `"${createdExam.title}" scheduled.` });
      setIsOpen(false); // This will trigger reset via useEffect
    } catch (error) {
      console.error("Error creating exam:", error);
      toast({ variant: "destructive", title: "Creation Failed", description: (error as Error).message });
    } finally { setIsProcessing(false); }
  };
  
  const handleDirectQuestionsChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => setNewExamDirectQuestions(event.target.value);
  const handleDirectQuestionsKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => { /* Logic from class details page */ 
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        const textarea = event.currentTarget; const currentFullText = textarea.value; const selectionStart = textarea.selectionStart;
        const textBeforeCursor = currentFullText.substring(0, selectionStart); const linesBeforeCursor = textBeforeCursor.split('\n');
        const currentLineText = linesBeforeCursor[linesBeforeCursor.length - 1] || '';
        let newTextSuffix = '\n';
        const questionPattern = /^Q(\d+)\.\s*/i; const optionPattern = /^([A-D])\.\s*/i;
        if (currentFullText.trim() === "") { newTextSuffix = "Q1. "; }
        else {
            const currentLineIsOption = optionPattern.test(currentLineText); const currentLineIsQuestion = questionPattern.test(currentLineText);
            const currentLineEndsWithQuestionMark = currentLineText.trim().endsWith('?');
            if (currentLineIsOption) {
                const optionMatch = currentLineText.match(optionPattern); const currentOptionLetter = optionMatch ? optionMatch[1].toUpperCase() : '';
                if (currentOptionLetter === 'A') newTextSuffix = '\nB. '; else if (currentOptionLetter === 'B') newTextSuffix = '\nC. ';
                else if (currentOptionLetter === 'C') newTextSuffix = '\nD. ';
                else if (currentOptionLetter === 'D') {
                    let lastQNum = 0; currentFullText.split('\n').forEach(line => { const qM = line.match(questionPattern); if (qM && qM[1]) { lastQNum = Math.max(lastQNum, parseInt(qM[1],10)); }});
                    newTextSuffix = `\n\nQ${lastQNum + 1}. `;
                }
            } else if (currentLineIsQuestion || currentLineEndsWithQuestionMark) { newTextSuffix = '\nA. '; }
            else if (currentLineText.trim() === "") {
                let prevMeaningful = ""; for (let i = linesBeforeCursor.length - 2; i >= 0; i--) { if(linesBeforeCursor[i].trim() !== ""){ prevMeaningful = linesBeforeCursor[i].trim(); break; }}
                const prevIsQ = questionPattern.test(prevMeaningful); const prevIsOptD = optionPattern.test(prevMeaningful) && prevMeaningful.match(optionPattern)![1].toUpperCase() === 'D';
                if (prevIsQ || prevIsOptD) {
                    let lastQNum = 0; currentFullText.split('\n').forEach(line => { const qM = line.match(questionPattern); if (qM && qM[1]) { lastQNum = Math.max(lastQNum, parseInt(qM[1],10)); }});
                    newTextSuffix = `\nQ${lastQNum + 1}. `;
                }
            }
        }
        const newFullTextValue = currentFullText.substring(0, selectionStart) + newTextSuffix + currentFullText.substring(textarea.selectionEnd);
        setNewExamDirectQuestions(newFullTextValue);
        setTimeout(() => { const newPos = selectionStart + newTextSuffix.length; textarea.focus(); textarea.selectionStart = newPos; textarea.selectionEnd = newPos;},0);
    }
  };

  const dialogContent = (
    <>
      <DialogHeader><DialogTitle className="text-xl">Create New Exam</DialogTitle><DialogDescription>Fill in the details for the new assessment. {classContext?.className && `For class: ${classContext.className}`}</DialogDescription></DialogHeader>
      <div className="grid gap-4 py-4 max-h-[70vh] overflow-y-auto px-1">
        <div className="grid gap-2"><Label htmlFor="examTitle">Exam Title</Label><Input id="examTitle" value={newExamTitle} onChange={(e) => setNewExamTitle(e.target.value)} placeholder="e.g., Final Physics Exam" className="rounded-lg" disabled={isProcessing}/></div>
        <div className="grid gap-2"><Label htmlFor="examDescription">Description / Instructions</Label><Textarea id="examDescription" value={newExamDescription} onChange={(e) => setNewExamDescription(e.target.value)} placeholder="Instructions for students..." className="rounded-lg min-h-[80px]" disabled={isProcessing}/></div>
        <div className="grid grid-cols-2 gap-4"><div className="grid gap-2"><Label htmlFor="scheduledDate">Scheduled Date</Label><Popover><PopoverTrigger asChild><Button variant={"outline"} className={cn("justify-start text-left font-normal rounded-lg", !newExamScheduledDate && "text-muted-foreground")} disabled={isProcessing}><CalendarClock className="mr-2 h-4 w-4" />{newExamScheduledDate ? format(newExamScheduledDate, "PPP") : <span>Pick a date</span>}</Button></PopoverTrigger><PopoverContent className="w-auto p-0 rounded-lg"><Calendar mode="single" selected={newExamScheduledDate} onSelect={setNewExamScheduledDate} initialFocus /></PopoverContent></Popover></div><div className="grid gap-2"><Label htmlFor="scheduledTime">Scheduled Time</Label><Input id="scheduledTime" type="time" value={newExamScheduledTime} onChange={e => setNewExamScheduledTime(e.target.value)} className="rounded-lg" disabled={isProcessing} /></div></div>
        <div className="grid grid-cols-2 gap-4"><div className="grid gap-2"><Label htmlFor="dueDate">Due Date</Label><Popover><PopoverTrigger asChild><Button variant={"outline"} className={cn("justify-start text-left font-normal rounded-lg", !newExamDueDate && "text-muted-foreground")} disabled={isProcessing}><CalendarClock className="mr-2 h-4 w-4" />{newExamDueDate ? format(newExamDueDate, "PPP") : <span>Pick a date</span>}</Button></PopoverTrigger><PopoverContent className="w-auto p-0 rounded-lg"><Calendar mode="single" selected={newExamDueDate} onSelect={setNewExamDueDate} initialFocus /></PopoverContent></Popover></div><div className="grid gap-2"><Label htmlFor="dueTime">Due Time</Label><Input id="dueTime" type="time" value={newExamDueTime} onChange={e => setNewExamDueTime(e.target.value)} className="rounded-lg" disabled={isProcessing} /></div></div>
        <div className="grid gap-2"><Label htmlFor="totalMarks">Total Marks</Label><Input id="totalMarks" type="number" value={newExamTotalMarks} onChange={(e) => setNewExamTotalMarks(e.target.value === '' ? '' : Number(e.target.value))} placeholder="e.g., 100" className="rounded-lg" disabled={isProcessing}/></div>
        <div className="grid gap-2"><Label>Question Paper Options</Label><RadioGroup value={newExamQuestionMode} onValueChange={(value: 'upload' | 'link' | 'editor') => { setNewExamQuestionMode(value); /* Reset other modes */ }} className="grid grid-cols-1 sm:grid-cols-3 gap-x-3 gap-y-2" disabled={isProcessing}>
            <div className="flex items-center space-x-2 p-3 border rounded-lg data-[state=checked]:border-primary data-[state=checked]:ring-1 data-[state=checked]:ring-primary cursor-pointer" onClick={() => !isProcessing && setNewExamQuestionMode('upload')}><RadioGroupItem value="upload" id="q-upload" /><Label htmlFor="q-upload" className="cursor-pointer text-sm font-normal flex items-center"><UploadCloud className="mr-2 h-4 w-4"/>Upload File</Label></div>
            <div className="flex items-center space-x-2 p-3 border rounded-lg data-[state=checked]:border-primary data-[state=checked]:ring-1 data-[state=checked]:ring-primary cursor-pointer" onClick={() => !isProcessing && setNewExamQuestionMode('link')}><RadioGroupItem value="link" id="q-link" /><Label htmlFor="q-link" className="cursor-pointer text-sm font-normal flex items-center"><LinkIcon className="mr-2 h-4 w-4"/>Link Online</Label></div>
            <div className="flex items-center space-x-2 p-3 border rounded-lg data-[state=checked]:border-primary data-[state=checked]:ring-1 data-[state=checked]:ring-primary cursor-pointer" onClick={() => !isProcessing && setNewExamQuestionMode('editor')}><RadioGroupItem value="editor" id="q-editor" /><Label htmlFor="q-editor" className="cursor-pointer text-sm font-normal flex items-center"><Edit2Icon className="mr-2 h-4 w-4"/>Write Directly</Label></div>
        </RadioGroup></div>
        {newExamQuestionMode === 'upload' && (<div className="grid gap-2"><Label htmlFor="questionPaperFile">Upload File (Max {MAX_FILE_SIZE_MB}MB)</Label><Input ref={questionPaperInputRef} id="questionPaperFile" type="file" accept=".pdf,.doc,.docx,.txt,image/*" onChange={handleQuestionPaperFileChange} className="rounded-lg file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20" disabled={isProcessing}/>{newExamPaperFile && <p className="text-xs text-muted-foreground">Selected: {newExamPaperFile.name}</p>}</div>)}
        {newExamQuestionMode === 'link' && (<div className="grid gap-2"><Label htmlFor="questionPaperLink">Link to Online Questions</Label><div className="relative"><LinkIcon className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" /><Input id="questionPaperLink" type="url" value={newExamQuestionLink} onChange={(e) => setNewExamQuestionLink(e.target.value)} placeholder="https://docs.google.com/..." className="rounded-lg pl-10" disabled={isProcessing}/></div></div>)}
        {newExamQuestionMode === 'editor' && (<div className="grid gap-2"><Label htmlFor="directQuestions">Write or Paste Questions</Label><Textarea id="directQuestions" value={newExamDirectQuestions} onChange={handleDirectQuestionsChange} onKeyDown={handleDirectQuestionsKeyDown} placeholder="Q1., A., B., etc." className="rounded-lg min-h-[150px] text-sm font-mono" disabled={isProcessing}/></div>)}
      </div>
      <DialogFooter><DialogClose asChild><Button type="button" variant="outline" className="rounded-lg" disabled={isProcessing}>Cancel</Button></DialogClose><Button type="button" onClick={handleCreateExam} className="btn-gel rounded-lg" disabled={isProcessing || !newExamTitle.trim() || !newExamScheduledDate || !newExamDueDate}>{isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}{isProcessing ? (newExamQuestionMode === 'upload' && newExamPaperFile ? 'Uploading...' : 'Processing...') : 'Create Exam'}</Button></DialogFooter>
    </>
  );

  if (!isControlled) { // If not controlled, render Dialog with Trigger
    return (<Dialog open={isOpen} onOpenChange={handleOpenChange}><DialogTrigger asChild><Button variant="default" className="btn-gel rounded-lg"><PlusCircle className="mr-2 h-5 w-5" /> Create New Exam {classContext?.className ? `for ${classContext.className}` : ''}</Button></DialogTrigger>{isOpen && (<DialogContent className="sm:max-w-2xl rounded-xl">{dialogContent}</DialogContent>)}</Dialog>);
  }
  return dialogContent; // If controlled, parent manages Dialog/Trigger, just return content
};

CreateExamDialogComponent.displayName = 'CreateExamDialog';
const MemoizedCreateExamDialog = React.memo(CreateExamDialogComponent);
export default MemoizedCreateExamDialog;
