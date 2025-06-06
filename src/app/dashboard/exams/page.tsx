
// src/app/dashboard/exams/page.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { PlusCircle, Edit, ArrowRight, UploadCloud, Loader2, ClipboardCheck, CalendarClock, Percent, Eye, FileText, Send } from "lucide-react";
import Image from "next/image";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from '@/hooks/useAuth';
import { storage } from '@/lib/firebase';
import { ref as storageRef, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface Exam {
  id: string;
  title: string;
  description: string;
  teacherId: string; // UID of the teacher who created it
  teacherName: string;
  scheduledDateTime: Date;
  dueDateTime: Date;
  totalMarks: number;
  questionPaperUrl?: string; // URL to the uploaded question paper
  questionPaperFileName?: string;
  status: 'Upcoming' | 'Active' | 'Ended' | 'Graded';
}

// Mock initial exams
const initialMockExams: Exam[] = [
  { id: "exam1", title: "Midterm Mathematics Test", description: "Covering chapters 1-5. Ensure you show all your work.", teacherId: "teacher1_mock_uid", teacherName: "Dr. Elara Vance", scheduledDateTime: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), dueDateTime: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000), totalMarks: 100, status: "Upcoming", questionPaperFileName: "math_midterm.pdf" },
  { id: "exam2", title: "History Essay Submission", description: "A 1500-word essay on the impact of the Silk Road.", teacherId: "teacher2_mock_uid", teacherName: "Prof. Kenji Ito", scheduledDateTime: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), dueDateTime: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000), totalMarks: 50, status: "Graded", questionPaperFileName: "history_essay_prompt.pdf" },
  { id: "exam3", title: "Physics Practical Exam", description: "Online practical simulation. Ensure your software is up to date.", teacherId: "teacher1_mock_uid", teacherName: "Dr. Elara Vance", scheduledDateTime: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), dueDateTime: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000 + 3 * 60 * 60 * 1000), totalMarks: 75, status: "Ended", questionPaperFileName: "physics_practical_guide.pdf" },
];

const MAX_FILE_SIZE_MB = 10;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

export default function ExamsPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const router = useRouter();
  const [exams, setExams] = useState<Exam[]>(initialMockExams);

  // Create Exam Dialog State
  const [isCreateExamDialogOpen, setIsCreateExamDialogOpen] = useState(false);
  const [newExamTitle, setNewExamTitle] = useState('');
  const [newExamDescription, setNewExamDescription] = useState('');
  const [newExamScheduledDate, setNewExamScheduledDate] = useState<Date | undefined>(new Date());
  const [newExamScheduledTime, setNewExamScheduledTime] = useState<string>("09:00");
  const [newExamDueDate, setNewExamDueDate] = useState<Date | undefined>(new Date(Date.now() + 24 * 60 * 60 * 1000)); // Default to next day
  const [newExamDueTime, setNewExamDueTime] = useState<string>("17:00");
  const [newExamTotalMarks, setNewExamTotalMarks] = useState<number | string>(100);
  const [newExamPaperFile, setNewExamPaperFile] = useState<File | null>(null);
  const [isUploadingPaper, setIsUploadingPaper] = useState(false);
  const questionPaperInputRef = useRef<HTMLInputElement>(null);


  useEffect(() => {
    // In a real app, fetch exams from Firestore here
  }, []);

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
    setNewExamDueDate(new Date(Date.now() + 24 * 60 * 60 * 1000));
    setNewExamDueTime("17:00");
    setNewExamTotalMarks(100);
    setNewExamPaperFile(null);
    if (questionPaperInputRef.current) questionPaperInputRef.current.value = "";
    setIsUploadingPaper(false);
    setIsCreateExamDialogOpen(false);
  };

  const uploadQuestionPaper = async (paperFile: File, userId: string, examId: string): Promise<{ url: string; fileName: string }> => {
    setIsUploadingPaper(true);
    const fileName = `${Date.now()}_${paperFile.name.replace(/\s+/g, '_')}`;
    const filePath = `exam_papers/${userId}/${examId}/${fileName}`;
    const fileRef = storageRef(storage, filePath);

    // Mock upload for now
    return new Promise((resolve, reject) => {
        const toastId = `upload-exam-paper-${Date.now()}`;
        toast({
            id: toastId,
            title: "Uploading Question Paper...",
            description: <div className="flex items-center"><UploadCloud className="mr-2 h-4 w-4 animate-pulse" /><span>Starting upload of {paperFile.name}.</span></div>,
            duration: Infinity,
        });

        // Simulate upload delay
        setTimeout(async () => {
            try {
                 // In a real scenario, use uploadBytesResumable and getDownloadURL
                // const uploadTask = uploadBytesResumable(fileRef, paperFile);
                // await uploadTask;
                // const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                const mockDownloadURL = `https://mockstorage.example.com/${filePath}`; // Mock URL
                
                toast.dismiss(toastId);
                toast({ title: "Question Paper Uploaded!", description: `${paperFile.name} mock-uploaded.` });
                resolve({ url: mockDownloadURL, fileName: paperFile.name });
            } catch (error) {
                console.error("Paper Upload Error (Mock):", error);
                toast.dismiss(toastId);
                toast({ variant: "destructive", title: "Upload Failed", description: "Could not upload paper." });
                reject(error);
            } finally {
                setIsUploadingPaper(false);
            }
        }, 2000); // 2 second delay
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

    setIsUploadingPaper(true); // Indicate process has started
    
    let paperDetails: { url?: string; fileName?: string } = {};
    const examId = `exam${Date.now()}`;

    if (newExamPaperFile) {
      try {
        const uploadedPaper = await uploadQuestionPaper(newExamPaperFile, user.uid, examId);
        paperDetails = { url: uploadedPaper.url, fileName: uploadedPaper.fileName };
      } catch (error) {
        setIsUploadingPaper(false);
        // Error is already toasted by uploadQuestionPaper
        return; 
      }
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
      status: "Upcoming", // Default status for new exams
    };

    // In a real app, save to Firestore: await setDoc(doc(db, "exams", newExam.id), newExam);
    setExams(prev => [newExam, ...prev]);
    toast({
      title: "Exam Created!",
      description: `"${newExam.title}" has been scheduled.`,
    });

    resetCreateExamDialog(); 
  };
  
  const getStatusVariant = (status: Exam['status']): "default" | "secondary" | "destructive" | "outline" => {
    switch(status) {
        case "Upcoming": return "default"; // Blueish (Primary by default)
        case "Active": return "secondary"; // Greenish (Secondary by default)
        case "Ended": return "outline"; // Greyish
        case "Graded": return "default"; // Could use a different success color if available
        default: return "default";
    }
  };

  const handleViewExam = (exam: Exam) => {
     router.push(`/dashboard/exam/${exam.id}?title=${encodeURIComponent(exam.title)}`);
  };

  const handleViewSubmissions = (exam: Exam) => {
    toast({ title: "View Submissions (Mock)", description: `Navigating to submissions for "${exam.title}".`});
    // router.push(`/dashboard/exam/${exam.id}/submissions`);
  };

  const handleEditExam = (exam: Exam) => {
    toast({ title: "Edit Exam (Mock)", description: `Editing functionality for "${exam.title}" is not yet implemented.`});
  };

  return (
    <div className="space-y-8 p-4 md:p-8 h-full flex flex-col">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Exams & Tests</h1>
          <p className="text-muted-foreground">Manage upcoming and past assessments.</p>
        </div>
        {user && ( // Only show Create button if user is logged in (mock teacher)
          <Dialog open={isCreateExamDialogOpen} onOpenChange={(isOpen) => {
              if (!isOpen) resetCreateExamDialog();
              setIsCreateExamDialogOpen(isOpen);
          }}>
            <DialogTrigger asChild>
              <Button className="btn-gel rounded-lg">
                <PlusCircle className="mr-2 h-5 w-5" /> Create New Exam
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg rounded-xl">
              <DialogHeader>
                <DialogTitle className="text-xl">Create New Exam</DialogTitle>
                <DialogDescription>
                  Fill in the details for the new assessment.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4 max-h-[70vh] overflow-y-auto px-1">
                <div className="grid gap-2">
                  <Label htmlFor="examTitle">Exam Title</Label>
                  <Input id="examTitle" value={newExamTitle} onChange={(e) => setNewExamTitle(e.target.value)} placeholder="e.g., Final Physics Exam" className="rounded-lg" disabled={isUploadingPaper}/>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="examDescription">Description / Instructions</Label>
                  <Textarea id="examDescription" value={newExamDescription} onChange={(e) => setNewExamDescription(e.target.value)} placeholder="Instructions for students..." className="rounded-lg min-h-[100px]" disabled={isUploadingPaper}/>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                        <Label htmlFor="scheduledDate">Scheduled Date</Label>
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button
                                variant={"outline"}
                                className={cn("justify-start text-left font-normal rounded-lg", !newExamScheduledDate && "text-muted-foreground")}
                                disabled={isUploadingPaper}
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
                        <Input id="scheduledTime" type="time" value={newExamScheduledTime} onChange={e => setNewExamScheduledTime(e.target.value)} className="rounded-lg" disabled={isUploadingPaper} />
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
                                disabled={isUploadingPaper}
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
                        <Input id="dueTime" type="time" value={newExamDueTime} onChange={e => setNewExamDueTime(e.target.value)} className="rounded-lg" disabled={isUploadingPaper} />
                    </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="totalMarks">Total Marks</Label>
                  <Input id="totalMarks" type="number" value={newExamTotalMarks} onChange={(e) => setNewExamTotalMarks(e.target.value === '' ? '' : Number(e.target.value))} placeholder="e.g., 100" className="rounded-lg" disabled={isUploadingPaper}/>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="questionPaper">Question Paper (Optional, Max {MAX_FILE_SIZE_MB}MB)</Label>
                  <Input ref={questionPaperInputRef} id="questionPaper" type="file" accept=".pdf,.doc,.docx,.txt,image/*" onChange={handleQuestionPaperFileChange} className="rounded-lg file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20" disabled={isUploadingPaper}/>
                  {newExamPaperFile && <p className="text-xs text-muted-foreground">Selected: {newExamPaperFile.name}</p>}
                </div>
              </div>
              <DialogFooter>
                <DialogClose asChild>
                  <Button type="button" variant="outline" className="rounded-lg" disabled={isUploadingPaper}>Cancel</Button>
                </DialogClose>
                <Button type="button" onClick={handleCreateExam} className="btn-gel rounded-lg" disabled={isUploadingPaper || !newExamTitle.trim() || !newExamScheduledDate || !newExamDueDate}>
                  {isUploadingPaper ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  {isUploadingPaper ? (newExamPaperFile ? 'Uploading Paper...' : 'Creating...') : 'Create Exam'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {exams.length === 0 ? (
        <Card className="text-center py-12 rounded-xl shadow-lg border-border/50 flex-grow flex flex-col justify-center items-center">
          <CardHeader>
            <ClipboardCheck className="mx-auto h-16 w-16 text-muted-foreground mb-4" />
            <CardTitle className="text-2xl">No Exams Scheduled</CardTitle>
            <CardDescription>There are no exams listed yet. {user ? "Create one to get started!" : "Check back later."}</CardDescription>
          </CardHeader>
          {user && (
            <CardContent>
                <Button onClick={() => setIsCreateExamDialogOpen(true)} size="lg" className="btn-gel rounded-lg">
                Create First Exam
                </Button>
            </CardContent>
          )}
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 flex-grow overflow-y-auto pb-4">
          {exams.map(exam => {
            const isTeacher = user?.uid === exam.teacherId;
            const now = new Date();
            let currentStatus = exam.status;
            if (exam.status === "Upcoming" && now >= exam.scheduledDateTime && now < exam.dueDateTime) {
                currentStatus = "Active";
            } else if ((exam.status === "Upcoming" || exam.status === "Active") && now >= exam.dueDateTime) {
                currentStatus = "Ended";
            }

            return (
            <Card key={exam.id} className="flex flex-col rounded-xl shadow-lg hover:shadow-primary/20 transition-shadow duration-300 border-border/50">
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                    <CardTitle className="text-lg truncate flex-grow mr-2" title={exam.title}>{exam.title}</CardTitle>
                    <Badge variant={getStatusVariant(currentStatus)} className="text-xs rounded-md flex-shrink-0">{currentStatus}</Badge>
                </div>
                <CardDescription className="text-xs text-muted-foreground">By {exam.teacherName}</CardDescription>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground flex-grow space-y-1.5">
                <p className="line-clamp-2 text-xs">{exam.description}</p>
                <div className="text-xs">
                    <span className="font-medium">Scheduled:</span> {format(exam.scheduledDateTime, "PPp")}
                </div>
                <div className="text-xs">
                    <span className="font-medium">Due:</span> {format(exam.dueDateTime, "PPp")}
                </div>
                <div className="text-xs">
                    <span className="font-medium">Marks:</span> {exam.totalMarks}
                </div>
                {exam.questionPaperFileName && <p className="text-xs truncate"><span className="font-medium">Paper:</span> {exam.questionPaperFileName}</p>}
              </CardContent>
              <CardFooter className="border-t pt-3 flex flex-col items-stretch gap-2">
                {isTeacher ? (
                  <>
                    <Button onClick={() => handleViewSubmissions(exam)} variant="outline" className="w-full rounded-lg text-sm">
                        <Eye className="mr-2 h-4 w-4" /> View Submissions (Mock)
                    </Button>
                    <Button onClick={() => handleEditExam(exam)} className="w-full btn-gel rounded-lg text-sm">
                        <Edit className="mr-2 h-4 w-4" /> Edit Exam (Mock)
                    </Button>
                  </>
                ) : (
                  <Button 
                    onClick={() => handleViewExam(exam)} 
                    className="w-full btn-gel rounded-lg text-sm"
                    disabled={currentStatus === "Upcoming" && now < exam.scheduledDateTime}
                  >
                    {currentStatus === "Upcoming" && now < exam.scheduledDateTime 
                        ? <><CalendarClock className="mr-2 h-4 w-4" /> Not Yet Active</>
                        : <><FileText className="mr-2 h-4 w-4" /> View Paper & Submit</>
                    }
                  </Button>
                )}
              </CardFooter>
            </Card>
          );
        })}
        </div>
      )}
    </div>
  );
}
