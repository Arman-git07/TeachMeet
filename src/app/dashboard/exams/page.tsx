
// src/app/dashboard/exams/page.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { PlusCircle, Edit, Eye, FileText, CalendarClock, ClipboardCheck, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from '@/hooks/useAuth';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';

// Dynamically import CreateExamDialog to avoid hydration issues with the dialog state
const CreateExamDialog = dynamic(() => import('@/components/exam/CreateExamDialog'), { ssr: false });

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
  classId?: string; // Optional: to associate exam with a class
}

const initialMockExams: Exam[] = [
  { id: "exam1", title: "Midterm Mathematics Test", description: "Covering chapters 1-5. Ensure you show all your work.", teacherId: "teacher1_mock_uid", teacherName: "Dr. Elara Vance", scheduledDateTime: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), dueDateTime: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000), totalMarks: 100, status: "Upcoming", questionPaperFileName: "math_midterm.pdf" },
  { id: "exam2", title: "History Essay Submission", description: "A 1500-word essay on the impact of the Silk Road.", teacherId: "teacher2_mock_uid", teacherName: "Prof. Kenji Ito", scheduledDateTime: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), dueDateTime: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000), totalMarks: 50, status: "Graded", questionPaperFileName: "history_essay_prompt.pdf" },
  { id: "exam3", title: "Physics Practical Exam", description: "Online practical simulation. Ensure your software is up to date.", teacherId: "teacher1_mock_uid", teacherName: "Dr. Elara Vance", scheduledDateTime: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), dueDateTime: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000 + 3 * 60 * 60 * 1000), totalMarks: 75, status: "Ended", questionPaperFileName: "physics_practical_guide.pdf" },
];


export default function ExamsPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const router = useRouter(); 
  const isTeacher = user?.role === 'teacher'; // Assuming user object has a 'role' property
  const [exams, setExams] = useState<Exam[]>(initialMockExams);  const [isLoading, setIsLoading] = useState(true);


  useEffect(() => {
    // Simulate fetching exams
    setTimeout(() => {
      // In a real app, fetch exams from Firestore here
      // For now, we use initialMockExams and update their status dynamically
      const updatedExams = exams.map(exam => {
        const now = new Date();
        let currentStatus = exam.status;
        if (exam.status !== "Graded") { // Don't change status if already graded
            if (now >= exam.dueDateTime) {
                currentStatus = "Ended";
            } else if (now >= exam.scheduledDateTime && now < exam.dueDateTime) {
                currentStatus = "Active";
            } else {
                currentStatus = "Upcoming";
            }
        }
        return { ...exam, status: currentStatus };
      });
      setExams(updatedExams);
      setIsLoading(false);
    }, 750); // Simulate network delay
  }, []); // Empty dependency array to run once on mount

  const handleExamCreated = (newExam: Exam) => {
    setExams(prevExams => [newExam, ...prevExams]);
    // Optionally: Save to Firestore here if CreateExamDialog doesn't do it.
  };
  
  const getStatusVariant = (status: Exam['status']): "default" | "secondary" | "destructive" | "outline" => {
    switch(status) {
        case "Upcoming": return "default"; 
        case "Active": return "secondary"; 
        case "Ended": return "outline"; 
        case "Graded": return "default"; 
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

  if (isLoading) {
    return (
      <div className="space-y-8 p-4 md:p-8 h-full flex flex-col">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="h-9 w-64 bg-muted rounded-md mb-1"></div>
            <div className="h-5 w-80 bg-muted rounded-md"></div>
          </div>
          <div className="h-11 w-48 bg-muted rounded-lg"></div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 flex-grow overflow-y-auto pb-4">
          {[...Array(3)].map((_, i) => (
            <Card key={i} className="flex flex-col rounded-xl shadow-lg border-border/50">
              <CardHeader className="pb-3">
                <div className="h-6 w-3/4 bg-muted rounded-md mb-1"></div>
                <div className="h-4 w-1/2 bg-muted rounded-md"></div>
              </CardHeader>
              <CardContent className="flex-grow space-y-1.5">
                <div className="h-4 w-full bg-muted rounded-md"></div>
                <div className="h-4 w-5/6 bg-muted rounded-md"></div>
                <div className="h-4 w-4/6 bg-muted rounded-md"></div>
              </CardContent>
              <CardFooter className="border-t pt-3 flex flex-col items-stretch gap-2">
                 <div className="h-9 w-full bg-muted rounded-lg"></div>
              </CardFooter>
            </Card>
          ))}
        </div>
      </div>
    );
  }


  return (
    <div className="space-y-8 p-4 md:p-8 h-full flex flex-col">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Exams & Tests</h1>
          <p className="text-muted-foreground">Manage upcoming and past assessments.</p>
        </div>
        {isTeacher && (
          <CreateExamDialog onExamCreated={handleExamCreated} />
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
              {isTeacher && <CreateExamDialog onExamCreated={handleExamCreated} />}
            </CardContent>
           
          )}
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 flex-grow overflow-y-auto pb-4">
          {exams.map(exam => {
            const isTeacher = user?.uid === exam.teacherId;
            // Status should now be correctly set from useEffect or initial data
            const now = new Date(); // For enabling/disabling the "View Paper" button

            return (
            <Card key={exam.id} className="flex flex-col rounded-xl shadow-lg hover:shadow-primary/20 transition-shadow duration-300 border-border/50">
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                    <CardTitle className="text-lg truncate flex-grow mr-2" title={exam.title}>{exam.title}</CardTitle>
                    <Badge variant={getStatusVariant(exam.status)} className="text-xs rounded-md flex-shrink-0">{exam.status}</Badge>
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
                    disabled={exam.status === "Upcoming" && now < exam.scheduledDateTime}
                  >
                    {exam.status === "Upcoming" && now < exam.scheduledDateTime 
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
      />
    </div>
  );
}
    