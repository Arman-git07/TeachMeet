
// src/app/dashboard/exam/[examId]/page.tsx
'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ArrowLeft, FileText, UploadCloud, AlertTriangle, CalendarClock, Percent, Info, CheckCircle, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { db, storage } from '@/lib/firebase'; // Import db and storage
import { doc, getDoc, setDoc, serverTimestamp, Timestamp } from 'firebase/firestore'; // Firestore imports
import { ref as storageRef, uploadBytesResumable, getDownloadURL } from 'firebase/storage'; // Storage imports

interface ExamDetails {
  id: string;
  title: string;
  description: string; 
  teacherName: string;
  teacherId: string;
  scheduledDateTime: any; // Firestore Timestamp or Date
  dueDateTime: any; // Firestore Timestamp or Date
  totalMarks: number;
  questionPaperUrl?: string; 
  questionPaperFileName?: string; 
  directQuestions?: string; 
  classId?: string;
  className?: string;
}

interface ExamSubmission {
    userId: string;
    examId: string;
    answerSheetUrl?: string; // URL to the uploaded answer sheet in Storage
    answerSheetFileName?: string;
    submittedAt: any; // Firestore Timestamp
    // Could add grade, feedback later
}

const MAX_ANSWER_FILE_SIZE_MB = 20;
const MAX_ANSWER_FILE_SIZE_BYTES = MAX_ANSWER_FILE_SIZE_MB * 1024 * 1024;

export default function ExamTakingPage() {
  const params = useParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const examId = params.examId as string;

  const [examDetails, setExamDetails] = useState<ExamDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [answerFile, setAnswerFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionStatus, setSubmissionStatus] = useState<'idle' | 'submitted' | 'error'>('idle');
  const answerFileInputRef = useRef<HTMLInputElement>(null);
  
  const [timeLeft, setTimeLeft] = useState<string>("");

  useEffect(() => {
    if (!examId || !db) return;
    setLoading(true);
    const examDocRef = doc(db, "exams", examId);
    getDoc(examDocRef).then(docSnap => {
      if (docSnap.exists()) {
        const data = docSnap.data() as Omit<ExamDetails, 'id'>;
        setExamDetails({ 
            id: docSnap.id, ...data,
            scheduledDateTime: data.scheduledDateTime?.toDate ? data.scheduledDateTime.toDate() : new Date(data.scheduledDateTime),
            dueDateTime: data.dueDateTime?.toDate ? data.dueDateTime.toDate() : new Date(data.dueDateTime),
        });
      } else {
        toast({ variant: "destructive", title: "Error", description: "Exam not found." });
        router.push('/dashboard/exams');
      }
    }).catch(error => {
      console.error("Error fetching exam details:", error);
      toast({ variant: "destructive", title: "Error", description: "Could not load exam details." });
    }).finally(() => {
      setLoading(false);
    });
  }, [examId, router, toast]);

  // Check for existing submission
  useEffect(() => {
    if (!examId || !user || !db) return;
    const submissionDocRef = doc(db, "exams", examId, "submissions", user.uid);
    getDoc(submissionDocRef).then(docSnap => {
      if (docSnap.exists()) {
        setSubmissionStatus('submitted');
        // Optionally, load submitted file details if needed for display
      }
    }).catch(error => console.error("Error checking existing submission:", error));
  }, [examId, user]);


  useEffect(() => {
    if (examDetails?.dueDateTime) {
      const intervalId = setInterval(() => {
        const now = new Date().getTime();
        const dueTime = new Date(examDetails.dueDateTime).getTime();
        const distance = dueTime - now;

        if (distance < 0) { setTimeLeft("Time's up!"); clearInterval(intervalId); return; }
        const days = Math.floor(distance / (1000 * 60 * 60 * 24));
        const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((distance % (1000 * 60)) / 1000);
        
        let timeLeftString = "";
        if (days > 0) timeLeftString += `${days}d `;
        if (hours > 0 || days > 0) timeLeftString += `${hours}h `;
        timeLeftString += `${minutes}m ${seconds}s`;
        setTimeLeft(timeLeftString.trim());
      }, 1000);
      return () => clearInterval(intervalId);
    }
  }, [examDetails]);


  const handleAnswerFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > MAX_ANSWER_FILE_SIZE_BYTES) {
        toast({ variant: "destructive", title: "File Too Large", description: `Answer sheet must be smaller than ${MAX_ANSWER_FILE_SIZE_MB}MB.` });
        setAnswerFile(null);
        if(answerFileInputRef.current) answerFileInputRef.current.value = "";
        return;
      }
      setAnswerFile(file);
      setSubmissionStatus('idle'); 
    } else {
      setAnswerFile(null);
    }
  };

  const handleSubmitAnswer = async () => {
    if (!answerFile) { toast({ variant: "destructive", title: "No File Selected", description: "Please select your answer sheet." }); return; }
    if (!user || !examDetails || !db || !storage) { toast({variant: "destructive", title: "Error", description: "Cannot submit. User or exam details missing."}); return; }

    setIsSubmitting(true); setSubmissionStatus('idle');
    const toastId = `submit-answer-${Date.now()}`;
    toast({ id: toastId, title: "Submitting Answer...", description: <div className="flex items-center"><UploadCloud className="mr-2 h-4 w-4 animate-pulse" /><span>Uploading {answerFile.name}.</span></div>, duration: Infinity });

    try {
      const filePath = `exam_submissions/${examId}/${user.uid}/${answerFile.name}`;
      const fileUploadRef = storageRef(storage, filePath);
      const uploadTask = await uploadBytesResumable(fileUploadRef, answerFile);
      const downloadURL = await getDownloadURL(uploadTask.ref);

      const submissionData: ExamSubmission = {
        userId: user.uid,
        examId: examId,
        answerSheetUrl: downloadURL,
        answerSheetFileName: answerFile.name,
        submittedAt: serverTimestamp(),
      };
      
      const submissionDocRef = doc(db, "exams", examId, "submissions", user.uid);
      await setDoc(submissionDocRef, submissionData);

      toast.dismiss(toastId);
      toast({ title: "Submission Successful!", description: `${answerFile.name} submitted for "${examDetails.title}".` });
      setSubmissionStatus('submitted');
    } catch (error) {
      console.error("Error submitting answer:", error);
      toast.dismiss(toastId);
      toast({ variant: "destructive", title: "Submission Failed", description: (error as Error).message || "Could not submit answer." });
      setSubmissionStatus('error');
    } finally {
      setIsSubmitting(false);
    }
  };


  if (loading || authLoading) {
    return ( /* Skeleton Loader from original */ <div className="flex flex-col items-center justify-center h-full p-8"><Card className="w-full max-w-3xl p-8 rounded-xl shadow-xl border-border/50"><CardHeader><div className="h-8 bg-muted rounded w-3/4 mx-auto mb-2"></div><div className="h-4 bg-muted rounded w-1/2 mx-auto"></div></CardHeader><CardContent className="space-y-6 mt-6"><div className="h-40 bg-muted rounded-lg w-full"></div><div className="space-y-2"><div className="h-4 bg-muted rounded w-full"></div><div className="h-4 bg-muted rounded w-5/6"></div></div></CardContent></Card></div>);
  }
  if (!examDetails) {
    return ( /* Not Found message from original */ <div className="flex flex-col items-center justify-center h-full p-8 text-center"><AlertTriangle className="h-16 w-16 text-destructive mb-4" /><h1 className="text-2xl font-bold text-destructive mb-2">Exam Not Found</h1><p className="text-muted-foreground mb-6">The exam details for ID &quot;{examId}&quot; could not be loaded.</p><Button onClick={() => router.push('/dashboard/exams')} variant="outline" className="rounded-lg"><ArrowLeft className="mr-2 h-4 w-4" /> Back to All Exams</Button></div>);
  }
  
  const isExamActive = new Date() >= new Date(examDetails.scheduledDateTime) && new Date() < new Date(examDetails.dueDateTime);
  const isExamUpcoming = new Date() < new Date(examDetails.scheduledDateTime);
  const isExamEnded = new Date() >= new Date(examDetails.dueDateTime);

  return (
    <div className="space-y-8 p-4 md:p-8">
      <div className="flex items-center justify-between mb-6">
        <Button onClick={() => router.push(`/dashboard/exams${examDetails.classId ? `?classId=${examDetails.classId}&className=${encodeURIComponent(examDetails.className || '')}` : ''}`)} variant="outline" className="rounded-lg"><ArrowLeft className="mr-2 h-4 w-4" /> Back to Exams List</Button>
      </div>
      <Card className="rounded-xl shadow-xl border-border/50 overflow-hidden">
        <CardHeader className="bg-muted/30 p-6 border-b">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                <div><CardTitle className="text-2xl md:text-3xl font-bold text-foreground">{examDetails.title}</CardTitle><CardDescription className="text-sm text-muted-foreground mt-1">By {examDetails.teacherName} {examDetails.className && `(Class: ${examDetails.className})`}</CardDescription></div>
                {timeLeft && !isExamUpcoming && (<Badge variant={isExamEnded ? "destructive" : "secondary"} className="text-sm px-3 py-1.5 rounded-md self-start sm:self-center"><CalendarClock className="mr-2 h-4 w-4"/> {isExamEnded ? `Ended` : `Time Left: ${timeLeft}`}</Badge>)}
            </div>
        </CardHeader>
        <CardContent className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div className="flex items-center"><CalendarClock className="mr-2 h-5 w-5 text-primary flex-shrink-0" /><div><span className="font-medium text-foreground">Scheduled:</span><p className="text-muted-foreground">{format(new Date(examDetails.scheduledDateTime), "PPp")}</p></div></div>
            <div className="flex items-center"><CalendarClock className="mr-2 h-5 w-5 text-destructive flex-shrink-0" /><div><span className="font-medium text-foreground">Due:</span><p className="text-muted-foreground">{format(new Date(examDetails.dueDateTime), "PPp")}</p></div></div>
            <div className="flex items-center"><Percent className="mr-2 h-5 w-5 text-accent flex-shrink-0" /><div><span className="font-medium text-foreground">Total Marks:</span><p className="text-muted-foreground">{examDetails.totalMarks}</p></div></div>
          </div>
          <div><h3 className="text-lg font-semibold text-foreground mb-1.5 flex items-center"><Info className="mr-2 h-5 w-5 text-primary"/>Instructions</h3><p className="text-muted-foreground whitespace-pre-line text-sm">{examDetails.description}</p></div>
          {isExamUpcoming && (<Alert variant="default" className="border-primary/30 bg-primary/5"><CalendarClock className="h-4 w-4 !text-primary" /><AlertTitle className="text-primary">Exam Not Yet Started</AlertTitle><AlertDescription>This exam is scheduled to start on {format(new Date(examDetails.scheduledDateTime), "PPp")}. The question paper will be available then.</AlertDescription></Alert>)}
          {!isExamUpcoming && (<><div><h3 className="text-lg font-semibold text-foreground mb-2 flex items-center"><FileText className="mr-2 h-5 w-5 text-primary"/>Question Paper</h3>
          {examDetails.questionPaperUrl && examDetails.questionPaperFileName && !examDetails.directQuestions ? (<Button asChild variant="outline" className="rounded-lg"><a href={examDetails.questionPaperUrl} target="_blank" rel="noopener noreferrer" download={examDetails.questionPaperFileName}>Download: {examDetails.questionPaperFileName}</a></Button>) : 
           examDetails.directQuestions ? (<Card className="bg-muted/20 p-4 rounded-lg"><CardContent className="p-0"><pre className="whitespace-pre-wrap text-sm font-mono text-foreground">{examDetails.directQuestions}</pre></CardContent></Card>) : 
           (<p className="text-muted-foreground text-sm">Question paper not available for download or direct view.</p>)}
           {(!examDetails.questionPaperUrl && !examDetails.directQuestions) && (<div className="mt-4 p-4 border rounded-lg bg-muted/20 min-h-[200px] flex items-center justify-center"><p className="text-muted-foreground italic">{isExamEnded ? "The exam has ended." : "Question paper content would be displayed here or linked."}</p></div>)}</div>
            {!isExamEnded && submissionStatus !== 'submitted' && (<Card className="rounded-lg shadow-md border-border/30 mt-6"><CardHeader><CardTitle className="flex items-center text-lg"><UploadCloud className="mr-2 h-5 w-5 text-primary" />Submit Your Answer</CardTitle><CardDescription>Upload your completed answer sheet here before the deadline.</CardDescription></CardHeader><CardContent className="space-y-3"><Input ref={answerFileInputRef} id="answerSheetUpload" type="file" accept=".pdf,.doc,.docx,.txt,image/*" onChange={handleAnswerFileChange} className="rounded-lg file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20" disabled={isSubmitting || !isExamActive}/>{answerFile && <p className="text-xs text-muted-foreground">Selected: {answerFile.name} ({(answerFile.size / 1024 / 1024).toFixed(2)} MB)</p>}<p className="text-xs text-muted-foreground">Max file size: {MAX_ANSWER_FILE_SIZE_MB}MB.</p></CardContent><CardFooter><Button onClick={handleSubmitAnswer} className="w-full btn-gel rounded-lg text-sm" disabled={!answerFile || isSubmitting || isExamEnded || submissionStatus === 'submitted' || !isExamActive || !user}>{isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}{isSubmitting ? "Submitting..." : (!isExamActive && !isExamEnded ? "Exam Not Active" : "Submit Answer Sheet")}</Button></CardFooter></Card>)}
            {submissionStatus === 'submitted' && (<Alert variant="default" className="mt-6 border-green-500/50 bg-green-500/10"><CheckCircle className="h-5 w-5 text-green-600" /><AlertTitle className="text-green-700">Answer Submitted Successfully!</AlertTitle><AlertDescription className="text-green-600">Your answer sheet has been submitted. Good luck!</AlertDescription></Alert>)}
            {submissionStatus === 'error' && !isSubmitting && (<Alert variant="destructive" className="mt-6"><AlertTriangle className="h-5 w-5" /><AlertTitle>Submission Error</AlertTitle><AlertDescription>There was an issue submitting your answer sheet. Please try again. If the problem persists, contact your teacher.</AlertDescription></Alert>)}
            {isExamEnded && submissionStatus !== 'submitted' && (<Alert variant="destructive" className="mt-6"><AlertTriangle className="h-5 w-5" /><AlertTitle>Exam Has Ended</AlertTitle><AlertDescription>The deadline for this exam has passed. Submissions are no longer accepted.</AlertDescription></Alert>)}</>)}
        </CardContent>
      </Card>
    </div>
  );
}
