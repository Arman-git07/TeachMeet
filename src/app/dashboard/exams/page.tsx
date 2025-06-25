
// src/app/dashboard/exams/page.tsx
'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useRouter, useSearchParams } from 'next/navigation'; // Added useSearchParams
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { PlusCircle, Edit, Eye, FileText, CalendarClock, ClipboardCheck, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from '@/hooks/useAuth';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { db } from '@/lib/firebase'; // Import db
import { collection, query, where, orderBy, onSnapshot, Timestamp } from 'firebase/firestore'; // Firestore imports

const CreateExamDialog = dynamic(() =>
  import('@/components/exam/CreateExamDialog').then(mod => mod.default),
  {
    ssr: false,
    loading: () => ( <Button variant="default" className="btn-gel rounded-lg" disabled><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading Create Exam...</Button> )
  }
);

interface Exam {
  id: string;
  title: string;
  description: string;
  teacherId: string;
  teacherName: string;
  scheduledDateTime: any; // Firestore Timestamp or Date
  dueDateTime: any; // Firestore Timestamp or Date
  totalMarks: number;
  questionPaperUrl?: string;
  questionPaperFileName?: string;
  directQuestions?: string;
  status: 'Upcoming' | 'Active' | 'Ended' | 'Graded';
  classId?: string;
  className?: string; // Denormalized for display
}

export default function ExamsPage() {
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams(); // For potential classId filter from URL
  const filterClassId = searchParams.get('classId');
  const filterClassName = searchParams.get('className');

  const [exams, setExams] = useState<Exam[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return; // Wait for auth state to be determined
    if (!db) return;
    
    // If not authenticated and no specific class is being filtered, there's nothing to show.
    if (!user && !filterClassId) {
        setExams([]);
        setIsLoading(false);
        return;
    }

    setIsLoading(true);
    let examsQuery;

    if (filterClassId) {
      // Fetch all exams for a specific class (publicly viewable list)
      examsQuery = query(collection(db, "exams"), where("classId", "==", filterClassId));
    } else if (user) {
      // Fetch all exams created by the current user if no class filter is applied
      examsQuery = query(collection(db, "exams"), where("teacherId", "==", user.uid));
    } else {
      // This case should be handled by the guard above, but as a fallback, don't query.
      setExams([]);
      setIsLoading(false);
      return;
    }

    const unsubscribe = onSnapshot(examsQuery, (snapshot) => {
      const fetchedExams: Exam[] = [];
      const now = new Date();
      snapshot.forEach(doc => {
        const data = doc.data();
        let status = data.status as Exam['status'];
        const scheduled = data.scheduledDateTime?.toDate ? data.scheduledDateTime.toDate() : new Date(data.scheduledDateTime);
        const due = data.dueDateTime?.toDate ? data.dueDateTime.toDate() : new Date(data.dueDateTime);

        if (status !== "Graded") {
          if (now >= due) status = "Ended";
          else if (now >= scheduled && now < due) status = "Active";
          else status = "Upcoming";
        }
        
        fetchedExams.push({ 
            id: doc.id, ...data, 
            scheduledDateTime: scheduled, 
            dueDateTime: due,
            status: status 
        } as Exam);
      });
      
      fetchedExams.sort((a, b) => new Date(b.scheduledDateTime).getTime() - new Date(a.scheduledDateTime).getTime());
      
      setExams(fetchedExams);
      setIsLoading(false);
    }, (error) => {
      console.error("Error fetching exams:", error);
      toast({ variant: "destructive", title: "Error", description: "Could not load exams." });
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [user, authLoading, filterClassId, toast]);

  const handleExamCreated = (newExam: Exam) => {
    // If CreateExamDialog saves to Firestore, this might just be a toast or UI refresh trigger
    // For now, let's assume it adds to local state optimistically or relies on onSnapshot
    toast({ title: "Exam Scheduled", description: `${newExam.title} has been scheduled.` });
    // No local state update needed if onSnapshot is working correctly and new exam matches query
  };
  
  const getStatusVariant = (status: Exam['status']): "default" | "secondary" | "destructive" | "outline" => {
    switch(status) {
        case "Upcoming": return "default";
        case "Active": return "secondary"; // Greenish/active color
        case "Ended": return "outline";
        case "Graded": return "default"; // Could be a success color too
        default: return "default";
    }
  };

  const handleViewExam = (exam: Exam) => {
     router.push(`/dashboard/exam/${exam.id}?title=${encodeURIComponent(exam.title)}`);
  };

  const handleViewSubmissions = (exam: Exam) => {
    toast({ title: "View Submissions (Not Implemented)", description: `Functionality to view submissions for "${exam.title}" is planned.`});
    // router.push(`/dashboard/exam/${exam.id}/submissions`);
  };

  const handleEditExam = (exam: Exam) => {
    toast({ title: "Edit Exam (Not Implemented)", description: `Editing functionality for "${exam.title}" is planned.`});
  };

  if (isLoading || authLoading) {
    return ( /* Skeleton loader from original */ <div className="space-y-8 p-4 md:p-8 h-full flex flex-col"><div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4"><div><div className="h-9 w-64 bg-muted rounded-md mb-1"></div><div className="h-5 w-80 bg-muted rounded-md"></div></div><div className="h-11 w-48 bg-muted rounded-lg"></div></div><div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 flex-grow overflow-y-auto pb-4">{[...Array(3)].map((_, i) => (<Card key={i} className="flex flex-col rounded-xl shadow-lg border-border/50"><CardHeader className="pb-3"><div className="h-6 w-3/4 bg-muted rounded-md mb-1"></div><div className="h-4 w-1/2 bg-muted rounded-md"></div></CardHeader><CardContent className="flex-grow space-y-1.5"><div className="h-4 w-full bg-muted rounded-md"></div><div className="h-4 w-5/6 bg-muted rounded-md"></div><div className="h-4 w-4/6 bg-muted rounded-md"></div></CardContent><CardFooter className="border-t pt-3 flex flex-col items-stretch gap-2"><div className="h-9 w-full bg-muted rounded-lg"></div></CardFooter></Card>))}</div></div>);
  }

  const pageTitle = filterClassId && filterClassName 
    ? `Exams for ${filterClassName}` 
    : "Exams & Tests";
  const pageDescription = filterClassId 
    ? `Manage assessments for this specific class.`
    : `Manage all upcoming and past assessments.`;

  return (
    <div className="space-y-8 p-4 md:p-8 h-full flex flex-col">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">{pageTitle}</h1>
          <p className="text-muted-foreground">{pageDescription}</p>
        </div>
        {user && ( // Only show create button if user is logged in (teacher role check can be inside dialog or backend)
          <CreateExamDialog onExamCreated={handleExamCreated} classContext={filterClassId && filterClassName ? { classId: filterClassId, className: filterClassName} : undefined} />
        )}
      </div>

      {exams.length === 0 ? (
        <Card className="text-center py-12 rounded-xl shadow-lg border-border/50 flex-grow flex flex-col justify-center items-center">
          <CardHeader><ClipboardCheck className="mx-auto h-16 w-16 text-muted-foreground mb-4" /><CardTitle className="text-2xl">No Exams Found</CardTitle><CardDescription>{filterClassId ? "No exams scheduled for this class yet." : "There are no exams listed. Create one to get started!"}</CardDescription></CardHeader>
          {user && !filterClassId && (<CardContent><CreateExamDialog onExamCreated={handleExamCreated} /></CardContent>)}
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 flex-grow overflow-y-auto pb-4">
          {exams.map(exam => {
            const isTeacherForThisExam = user?.uid === exam.teacherId;
            const now = new Date();

            return (
            <Card key={exam.id} className="flex flex-col rounded-xl shadow-lg hover:shadow-primary/20 transition-shadow duration-300 border-border/50">
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start"><CardTitle className="text-lg truncate flex-grow mr-2" title={exam.title}>{exam.title}</CardTitle><Badge variant={getStatusVariant(exam.status)} className="text-xs rounded-md flex-shrink-0">{exam.status}</Badge></div>
                <CardDescription className="text-xs text-muted-foreground">By {exam.teacherName} {exam.className && `(Class: ${exam.className})`}</CardDescription>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground flex-grow space-y-1.5">
                <p className="line-clamp-2 text-xs">{exam.description}</p>
                <div className="text-xs"><span className="font-medium">Scheduled:</span> {format(new Date(exam.scheduledDateTime), "PPp")}</div>
                <div className="text-xs"><span className="font-medium">Due:</span> {format(new Date(exam.dueDateTime), "PPp")}</div>
                <div className="text-xs"><span className="font-medium">Marks:</span> {exam.totalMarks}</div>
                {exam.questionPaperFileName && <p className="text-xs truncate"><span className="font-medium">Paper:</span> {exam.questionPaperFileName}</p>}
              </CardContent>
              <CardFooter className="border-t pt-3 flex flex-col items-stretch gap-2">
                {isTeacherForThisExam ? (
                  <>
                    <Button onClick={() => handleViewSubmissions(exam)} variant="outline" className="w-full rounded-lg text-sm"><Eye className="mr-2 h-4 w-4" /> View Submissions</Button>
                    <Button onClick={() => handleEditExam(exam)} className="w-full btn-gel rounded-lg text-sm"><Edit className="mr-2 h-4 w-4" /> Edit Exam</Button>
                  </>
                ) : (
                  <Button onClick={() => handleViewExam(exam)} className="w-full btn-gel rounded-lg text-sm" disabled={exam.status === "Upcoming" && now < new Date(exam.scheduledDateTime)}>
                    {exam.status === "Upcoming" && now < new Date(exam.scheduledDateTime) ? <><CalendarClock className="mr-2 h-4 w-4" /> Not Yet Active</> : <><FileText className="mr-2 h-4 w-4" /> View Paper & Submit</>}
                  </Button>
                )}
              </CardFooter>
            </Card>
          );})}
        </div>
      )}
    </div>
  );
}
