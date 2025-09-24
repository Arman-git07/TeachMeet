
'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { db } from '@/lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Megaphone, FileText, Book, ClipboardCheck } from 'lucide-react';
import { resolveRoleForUser, type Role } from "@/lib/roles";
import { ClassroomHeader } from '@/components/classroom/ClassroomHeader';
import { Announcements } from '@/components/classroom/Announcements';
import { ClassMaterials } from '@/components/classroom/ClassMaterials';
import { Assignments } from '@/components/classroom/Assignments';
import { Exams } from '@/components/classroom/Exams';
import { ClassroomProvider } from '@/contexts/ClassroomContext';

// --- Interfaces ---
export interface TeacherInfo {
    uid: string;
    name: string;
    photoURL?: string;
    subject: string;
    qualification: string;
    experience: string;
    availability: string;
    resumeURL?: string;
}

export interface Classroom {
    id: string;
    title: string;
    description: string;
    teacherId: string;
    teacherName: string;
    students: string[]; 
    teachers: TeacherInfo[]; 
    feeAmount?: number;
    feeCurrency?: string;
    paymentDetails?: { upiId: string; qrCodeUrl: string; };
    createdBy: string;
}

export interface UserProfile { id: string; name: string; photoURL?: string; role: Role; uid: string; }
export interface Announcement {
  id: string;
  type: 'text' | 'audio';
  text?: string;
  audioUrl?: string;
  createdAt: any;
  vanishAt?: any;
  creatorId: string;
  creatorName: string;
  authorId: string;
  storagePath?: string; 
  uploaderId?: string;
}
export interface Material { id: string; name: string; url: string; uploadedAt: any; uploaderName: string; type: 'file' | 'link'; uploaderId: string; storagePath: string; }

// --- Exam Interfaces ---
export interface QAQuestion { type: 'qa'; question: string; answer: string; }
export interface MCQOption { text: string; }
export interface MCQQuestion { type: 'mcq'; question: string; options: MCQOption[]; correctOptionIndex: number; }
export type ExamQuestion = QAQuestion | MCQQuestion;

export interface Exam { 
  id: string; 
  title: string; 
  date: any; 
  type: 'file' | 'text'; 
  content?: ExamQuestion[];
  fileUrl?: string; 
  vanishAt?: any;
  authorId: string;
  storagePath?: string;
}
export interface JoinRequest { id: string; studentId: string; studentName: string; studentPhotoURL?: string; role: 'student' | 'teacher'; applicationData?: any; resumeURL?: string; requestedAt?: any; }
export interface SubjectTeacher { teacherId: string; name: string; subject: string; availability: string; }

export interface Assignment {
  id: string;
  title: string;
  dueDate: any;
  answerKeyUrl: string;
  creatorId: string;
  storagePath?: string;
  uploaderId?: string;
}

export interface Submission {
    id: string;
    studentId: string;
    studentName: string;
    submittedAt: any;
    submissionUrl: string;
    grade?: number;
    feedback?: string;
    isGrading?: boolean;
    assignmentId: string;
}

export type DeletableItem = {
    collectionName: "materials" | "assignments" | "exams" | "announcements";
    item: { id: string; storagePath?: string };
}

export default function ClassroomPage() {
    const { classroomId } = useParams() as { classroomId: string };
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();
    const { toast } = useToast();

    const [classroom, setClassroom] = useState<Classroom | null>(null);
    const [userRole, setUserRole] = useState<Role>('none');
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (authLoading) return;
        let cancelled = false;
        
        const fetchRoleAndClassroom = async () => {
          if (!classroomId) return;
          const { role, classroom: fetchedClassroom } = await resolveRoleForUser(String(classroomId), user?.uid);
          if (!cancelled) {
            setUserRole(role);
            if (fetchedClassroom) {
              setClassroom(fetchedClassroom as Classroom);
            } else {
              toast({ variant: 'destructive', title: 'Classroom not found.' });
              router.push('/dashboard/classrooms');
            }
            setIsLoading(false);
          }
        };

        fetchRoleAndClassroom();

        return () => {
          cancelled = true;
        };
    }, [classroomId, user?.uid, authLoading, router, toast]);

    const contextValue = useMemo(() => ({
        classroomId,
        classroom,
        user,
        userRole,
    }), [classroomId, classroom, user, userRole]);


    if (isLoading || authLoading) return <div className="container mx-auto p-4"><Skeleton className="h-screen w-full" /></div>;
    if (!classroom) return <div className="container mx-auto p-4">Classroom not found.</div>;

    return (
        <ClassroomProvider value={contextValue}>
            <div className="flex flex-1 flex-col overflow-hidden">
                <ClassroomHeader />
                
                <main className="flex-1 flex flex-col px-4 md:px-8 overflow-hidden">
                    <Tabs defaultValue="announcements" className="w-full flex flex-col flex-1 overflow-hidden">
                        <div className="w-full whitespace-nowrap rounded-lg border-b flex-shrink-0">
                            <TabsList className="inline-flex h-auto">
                                <TabsTrigger value="announcements"><Megaphone className="mr-2 h-4 w-4" />Announcements</TabsTrigger>
                                <TabsTrigger value="materials"><FileText className="mr-2 h-4 w-4" />Materials</TabsTrigger>
                                <TabsTrigger value="assignments"><Book className="mr-2 h-4 w-4" />Assignments</TabsTrigger>
                                <TabsTrigger value="exams"><ClipboardCheck className="mr-2 h-4 w-4" />Exams</TabsTrigger>
                            </TabsList>
                        </div>
                        
                        <div className="flex-grow overflow-y-auto pt-4">
                            <TabsContent value="announcements">
                                <Announcements />
                            </TabsContent>
                            <TabsContent value="materials">
                                <ClassMaterials />
                            </TabsContent>
                            <TabsContent value="assignments">
                                <Assignments />
                            </TabsContent>
                            <TabsContent value="exams">
                                <Exams />
                            </TabsContent>
                        </div>
                    </Tabs>
                </main>
            </div>
        </ClassroomProvider>
    );
}
