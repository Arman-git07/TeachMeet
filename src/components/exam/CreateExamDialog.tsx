
'use client';

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from '@/hooks/useAuth';
import { storage } from '@/lib/firebase'; // Assuming db is also exported if needed for Firestore operations
import { ref as storageRef, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { useRouter } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { CalendarClock, UploadCloud, Link as LinkIcon, Loader2, Edit2Icon } from "lucide-react";

// This interface should ideally be in a shared types file
interface Exam {
  id: string;
  title: string;
  description: string;
  teacherId: string;
  teacherName: string;
  scheduledDateTime: Date;
  dueDateTime: Date;
  totalMarks: number;
  questionPaperUrl?: string;
  questionPaperFileName?: string;
  directQuestions?: string; // Added for directly written questions
  status: 'Upcoming' | 'Active' | 'Ended' | 'Graded';
  // Add classId if exams are to be associated with specific classes
  classId?: string;
}

const MAX_FILE_SIZE_MB = 10;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

interface CreateExamDialogProps {
    isOpen: boolean;
    onOpenChange: (isOpen: boolean) => void;
    onExamCreated?: (newExam: Exam) => void; // Callback after exam creation
    classContext?: { classId: string; className?: string }; // Optional context
}

export function CreateExamDialog({ isOpen, onOpenChange, onExamCreated, classContext }: CreateExamDialogProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const router = useRouter();

  const [newExamTitle, setNewExamTitle] = useState('');
  const [newExamDescription, setNewExamDescription] = useState('');
  const [newExamScheduledDate, setNewExamScheduledDate] = useState<Date | undefined>(new Date());
  const [newExamScheduledTime, setNewExamScheduledTime] = useState<string>("09:00");
  const [newExamDueDate, setNewExamDueDate] = useState<Date | undefined>(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow;
  });
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
    const newDate = new Date(date);
    newDate.setHours(hours, minutes, 0, 0);
    return newDate;
  };

  const resetCreateExamDialog = () => {
    setNewExamTitle('');
    setNewExamDescription('');
    setNewExamScheduledDate(new Date());
    setNewExamScheduledTime("09:00");
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    setNewExamDueDate(tomorrow);
    setNewExamDueTime("17:00");
    setNewExamTotalMarks(100);
    setNewExamQuestionMode('upload');
    setNewExamPaperFile(null);
    setNewExamQuestionLink('');
    setNewExamDirectQuestions('');
    if (questionPaperInputRef.current) questionPaperInputRef.current.value = "";
    setIsProcessing(false);
  };
  
  useEffect(() => {
    if (!isOpen) {
      resetCreateExamDialog();
    }
  }, [isOpen]);

  const handleQuestionPaperFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > MAX_FILE_SIZE_BYTES) {
        toast({ variant: "destructive", title: "File Too Large", description: `Please select a file smaller than ${MAX_FILE_SIZE_MB}MB.` });
        setNewExamPaperFile(null);
        if (questionPaperInputRef.current) questionPaperInputRef.current.value = "";
        return;
      }
      setNewExamPaperFile(file);
    } else {
      setNewExamPaperFile(null);
    }
  };

  const uploadQuestionPaperFile = async (paperFile: File, userId: string, examId: string): Promise<{ url: string; fileName: string }> => {
    const fileName = `${Date.now()}_${paperFile.name.replace(/\s+/g, '_')}`;
    const filePath = `exam_papers/${userId}/${examId}/${fileName}`;
    const fileRef = storageRef(storage, filePath);

    return new Promise((resolve, reject) => {
        const toastId = `upload-exam-paper-${Date.now()}`;
        toast({
            id: toastId,
            title: "Uploading Question Paper...",
            description: <div className="flex items-center"><UploadCloud className="mr-2 h-4 w-4 animate-pulse" /><span>Starting upload of {paperFile.name}.</span></div>,
            duration: Infinity,
        });

        // Simulate upload for now, replace with actual Firebase upload if needed
        setTimeout(async () => {
            try {
                // const uploadTask = await uploadBytesResumable(fileRef, paperFile); // Real upload
                // const downloadURL = await getDownloadURL(uploadTask.ref); // Real URL
                const mockDownloadURL = `https://mockstorage.example.com/${filePath}`; // Mock URL
                console.log("Mock upload complete, URL:", mockDownloadURL);
                toast.dismiss(toastId);
                toast({ title: "Question Paper Uploaded!", description: `${paperFile.name} (mock) uploaded.` });
                resolve({ url: mockDownloadURL, fileName: paperFile.name });
            } catch (error) {
                console.error("Paper Upload Error:", error);
                toast.dismiss(toastId);
                toast({ variant: "destructive", title: "Upload Failed", description: "Could not upload paper." });
                reject(error);
            }
        }, 1500); // Simulate 1.5s upload
    });
  };

  const handleCreateExam = async () => {
    if (!newExamTitle.trim() || !newExamDescription.trim() || !newExamScheduledDate || !newExamDueDate) {
      toast({ variant: "destructive", title: "Missing Information", description: "Please fill all required fields." });
      return;
    }
    if (!user) {
      toast({ variant: "destructive", title: "Authentication Error", description: "You must be logged in to create an exam." });
      return;
    }
    if (typeof newExamTotalMarks === 'string' && isNaN(parseInt(newExamTotalMarks))) {
      toast({ variant: "destructive", title: "Invalid Marks", description: "Total marks must be a number." });
      return;
    }
    
    const scheduledDateTime = combineDateAndTime(newExamScheduledDate, newExamScheduledTime);
    const dueDateTime = combineDateAndTime(newExamDueDate, newExamDueTime);

    if (dueDateTime <= scheduledDateTime) {
      toast({ variant: "destructive", title: "Invalid Dates", description: "Due date and time must be after the scheduled date and time." });
      return;
    }

    if (newExamQuestionMode === 'link') {
        if (!newExamQuestionLink.trim()) {
            toast({ variant: "destructive", title: "Missing Link", description: "Please provide a link for the online questions."});
            return;
        }
        try {
            new URL(newExamQuestionLink.trim());
        } catch (_) {
            toast({ variant: "destructive", title: "Invalid Link", description: "The provided link for online questions is not a valid URL."});
            return;
        }
    } else if (newExamQuestionMode === 'editor' && !newExamDirectQuestions.trim()) {
        toast({ variant: "destructive", title: "Missing Questions", description: "Please write or paste the questions in the editor."});
        return;
    }


    setIsProcessing(true); 
    
    let paperDetails: { url?: string; fileName?: string; directQuestions?: string } = {};
    const examId = `exam_${Date.now()}_${classContext?.classId || 'global'}`;

    try {
      if (newExamQuestionMode === 'upload' && newExamPaperFile) {
        const { url, fileName } = await uploadQuestionPaperFile(newExamPaperFile, user.uid, examId);
        paperDetails = { url, fileName };
      } else if (newExamQuestionMode === 'link' && newExamQuestionLink.trim()) {
        paperDetails = {
          url: newExamQuestionLink.trim(),
          fileName: "Online Questions (External Link)"
        };
        await new Promise(resolve => setTimeout(resolve, 500)); // Simulate link processing
        toast({ title: "Question Link Processed", description: "Link to online questions has been saved." });
      } else if (newExamQuestionMode === 'editor' && newExamDirectQuestions.trim()) {
        paperDetails = {
          directQuestions: newExamDirectQuestions.trim(),
          fileName: "Directly Entered Questions"
        };
         await new Promise(resolve => setTimeout(resolve, 500)); // Simulate processing
        toast({ title: "Questions Processed", description: "Directly entered questions have been saved." });
      } else if (newExamQuestionMode === 'upload' && !newExamPaperFile) {
        // Optional paper upload, proceed without if no file
        paperDetails = { fileName: "No paper file attached" };
      }

      const newExam: Exam = {
        id: examId,
        title: newExamTitle.trim(),
        description: newExamDescription.trim(),
        teacherId: user.uid,
        teacherName: user.displayName || "Teacher",
        scheduledDateTime: scheduledDateTime,
        dueDateTime: dueDateTime,
        totalMarks: Number(newExamTotalMarks),
        questionPaperUrl: paperDetails.url,
        questionPaperFileName: paperDetails.fileName,
        directQuestions: paperDetails.directQuestions,
        status: "Upcoming",
        classId: classContext?.classId,
      };

      // Here you would typically save newExam to Firestore
      // For now, we'll use the onExamCreated callback for parent components
      if (onExamCreated) {
        onExamCreated(newExam);
      } else {
        // Fallback if no callback (e.g., if used in a context where direct state update is not feasible)
        // This might involve router.push or other side effects if this dialog is standalone
        console.warn("CreateExamDialog: onExamCreated callback not provided. Exam object:", newExam);
      }

      toast({
        title: "Exam Created!",
        description: `"${newExam.title}" has been scheduled.`,
      });
      
      onOpenChange(false); // Close the dialog
      // resetCreateExamDialog() is called by useEffect when isOpen changes to false
    } catch (error) {
      console.error("Error during exam creation:", error);
      // Error is usually toasted by uploadQuestionPaperFile or initial checks
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle className="text-xl">Create New Exam</DialogTitle>
        <DialogDescription>
          Fill in the details for the new assessment. {classContext?.className && `For class: ${classContext.className}`}
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-4 py-4 max-h-[70vh] overflow-y-auto px-1">
        <div className="grid gap-2">
          <Label htmlFor="examTitle">Exam Title</Label>
          <Input id="examTitle" value={newExamTitle} onChange={(e) => setNewExamTitle(e.target.value)} placeholder="e.g., Final Physics Exam" className="rounded-lg" disabled={isProcessing}/>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="examDescription">Description / Instructions</Label>
          <Textarea id="examDescription" value={newExamDescription} onChange={(e) => setNewExamDescription(e.target.value)} placeholder="Instructions for students..." className="rounded-lg min-h-[80px]" disabled={isProcessing}/>
        </div>
        <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
                <Label htmlFor="scheduledDate">Scheduled Date</Label>
                <Popover>
                    <PopoverTrigger asChild>
                        <Button
                        variant={"outline"}
                        className={cn("justify-start text-left font-normal rounded-lg", !newExamScheduledDate && "text-muted-foreground")}
                        disabled={isProcessing}
                        >
                        <CalendarClock className="mr-2 h-4 w-4" />
                        {newExamScheduledDate ? format(newExamScheduledDate, "PPP") : <span>Pick a date</span>}
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 rounded-lg">
                        <Calendar mode="single" selected={newExamScheduledDate} onSelect={setNewExamScheduledDate} initialFocus />
                    </PopoverContent>
                </Popover>
            </div>
            <div className="grid gap-2">
                <Label htmlFor="scheduledTime">Scheduled Time</Label>
                <Input id="scheduledTime" type="time" value={newExamScheduledTime} onChange={e => setNewExamScheduledTime(e.target.value)} className="rounded-lg" disabled={isProcessing} />
            </div>
        </div>
            <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
                <Label htmlFor="dueDate">Due Date</Label>
                    <Popover>
                    <PopoverTrigger asChild>
                        <Button
                        variant={"outline"}
                        className={cn("justify-start text-left font-normal rounded-lg", !newExamDueDate && "text-muted-foreground")}
                        disabled={isProcessing}
                        >
                        <CalendarClock className="mr-2 h-4 w-4" />
                        {newExamDueDate ? format(newExamDueDate, "PPP") : <span>Pick a date</span>}
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 rounded-lg">
                        <Calendar mode="single" selected={newExamDueDate} onSelect={setNewExamDueDate} initialFocus />
                    </PopoverContent>
                </Popover>
            </div>
            <div className="grid gap-2">
                <Label htmlFor="dueTime">Due Time</Label>
                <Input id="dueTime" type="time" value={newExamDueTime} onChange={e => setNewExamDueTime(e.target.value)} className="rounded-lg" disabled={isProcessing} />
            </div>
        </div>
        <div className="grid gap-2">
            <Label htmlFor="totalMarks">Total Marks</Label>
            <Input id="totalMarks" type="number" value={newExamTotalMarks} onChange={(e) => setNewExamTotalMarks(e.target.value === '' ? '' : Number(e.target.value))} placeholder="e.g., 100" className="rounded-lg" disabled={isProcessing}/>
        </div>
        
        <div className="grid gap-2">
            <Label>Question Paper Options</Label>
            <RadioGroup 
            value={newExamQuestionMode} 
            onValueChange={(value: 'upload' | 'link' | 'editor') => {
                setNewExamQuestionMode(value);
                if (value === 'upload') {
                    setNewExamQuestionLink('');
                    setNewExamDirectQuestions('');
                } else if (value === 'link') {
                    setNewExamPaperFile(null);
                    setNewExamDirectQuestions('');
                } else { // editor
                    setNewExamPaperFile(null);
                    setNewExamQuestionLink('');
                }
            }} 
            className="grid grid-cols-1 sm:grid-cols-3 gap-x-3 gap-y-2"
            disabled={isProcessing}
            >
            <div className="flex items-center space-x-2 p-3 border rounded-lg data-[state=checked]:border-primary data-[state=checked]:ring-1 data-[state=checked]:ring-primary cursor-pointer" 
                    onClick={() => !isProcessing && setNewExamQuestionMode('upload')}>
                <RadioGroupItem value="upload" id="q-upload" />
                <Label htmlFor="q-upload" className="cursor-pointer text-sm font-normal flex items-center"><UploadCloud className="mr-2 h-4 w-4"/>Upload File</Label>
            </div>
            <div className="flex items-center space-x-2 p-3 border rounded-lg data-[state=checked]:border-primary data-[state=checked]:ring-1 data-[state=checked]:ring-primary cursor-pointer" 
                    onClick={() => !isProcessing && setNewExamQuestionMode('link')}>
                <RadioGroupItem value="link" id="q-link" />
                <Label htmlFor="q-link" className="cursor-pointer text-sm font-normal flex items-center"><LinkIcon className="mr-2 h-4 w-4"/>Link Online</Label>
            </div>
            <div className="flex items-center space-x-2 p-3 border rounded-lg data-[state=checked]:border-primary data-[state=checked]:ring-1 data-[state=checked]:ring-primary cursor-pointer" 
                    onClick={() => !isProcessing && setNewExamQuestionMode('editor')}>
                <RadioGroupItem value="editor" id="q-editor" />
                <Label htmlFor="q-editor" className="cursor-pointer text-sm font-normal flex items-center"><Edit2Icon className="mr-2 h-4 w-4"/>Write Directly</Label>
            </div>
            </RadioGroup>
        </div>

        {newExamQuestionMode === 'upload' && (
            <div className="grid gap-2">
            <Label htmlFor="questionPaperFile">Upload File (Optional, Max {MAX_FILE_SIZE_MB}MB)</Label>
            <Input ref={questionPaperInputRef} id="questionPaperFile" type="file" accept=".pdf,.doc,.docx,.txt,image/*" onChange={handleQuestionPaperFileChange} className="rounded-lg file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20" disabled={isProcessing}/>
            {newExamPaperFile && <p className="text-xs text-muted-foreground">Selected: {newExamPaperFile.name}</p>}
            </div>
        )}

        {newExamQuestionMode === 'link' && (
            <div className="grid gap-2">
            <Label htmlFor="questionPaperLink">Link to Online Questions (e.g., Google Doc, Quiz URL)</Label>
            <div className="relative">
                <LinkIcon className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                <Input 
                    id="questionPaperLink" 
                    type="url" 
                    value={newExamQuestionLink} 
                    onChange={(e) => setNewExamQuestionLink(e.target.value)} 
                    placeholder="https://docs.google.com/..." 
                    className="rounded-lg pl-10" 
                    disabled={isProcessing}
                />
            </div>
            </div>
        )}

        {newExamQuestionMode === 'editor' && (
          <div className="grid gap-2">
            <Label htmlFor="directQuestions">Write or Paste Questions Here</Label>
            <Textarea
              id="directQuestions"
              value={newExamDirectQuestions}
              onChange={(e) => setNewExamDirectQuestions(e.target.value)}
              placeholder="Enter your exam questions here. You can use Markdown for basic formatting if your display supports it."
              className="rounded-lg min-h-[150px] text-sm"
              disabled={isProcessing}
            />
          </div>
        )}

      </div>
      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="outline" className="rounded-lg" disabled={isProcessing}>Cancel</Button>
        </DialogClose>
        <Button type="button" onClick={handleCreateExam} className="btn-gel rounded-lg" disabled={isProcessing || !newExamTitle.trim() || !newExamScheduledDate || !newExamDueDate}>
          {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          {isProcessing ? (newExamQuestionMode === 'upload' && newExamPaperFile ? 'Uploading...' : 'Processing...') : 'Create Exam'}
        </Button>
      </DialogFooter>
    </>
  );
}
