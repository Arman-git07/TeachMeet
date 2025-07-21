
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { db } from '@/lib/firebase';
import { doc, getDoc, onSnapshot, collection, query, updateDoc, writeBatch, where, arrayUnion, serverTimestamp, deleteDoc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Megaphone, BookCopy, FileQuestion, MessageSquare, Loader2, Check, UserPlus, X, ClipboardList, FileText } from 'lucide-react';
import Link from 'next/link';
import type { Classroom } from '../page';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';

interface JoinRequest {
  id: string; // studentId
  studentId: string;
  studentName?: string;
  studentPhotoURL?: string;
  status: 'pending' | 'accepted' | 'denied';
  requestedAt: any;
}

export default function ClassroomPage() {
  const params = useParams();
  const classroomId = params.classroomId as string;
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const [classroom, setClassroom] = useState<Classroom | null>(null);
  const [joinRequests, setJoinRequests] = useState<JoinRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const isTeacher = user?.uid === classroom?.teacherId;
  const joinRequestsScrollAreaRef = useRef<HTMLDivElement>(null);


  // Fetch classroom details
  useEffect(() => {
    if (classroomId) {
      const classroomRef = doc(db, 'classrooms', classroomId);
      const unsubscribe = onSnapshot(classroomRef, (docSnap) => {
        if (docSnap.exists()) {
          setClassroom({ id: docSnap.id, ...docSnap.data() } as Classroom);
        } else {
          console.error('No such classroom!');
          toast({ variant: 'destructive', title: 'Error', description: 'Classroom not found.' });
          router.push('/dashboard/classrooms');
        }
        setLoading(false);
      });
      return () => unsubscribe();
    }
  }, [classroomId, router, toast]);

  // Listen for join requests if user is the teacher
  useEffect(() => {
    if (isTeacher && classroomId) {
      const requestsRef = collection(db, `classrooms/${classroomId}/joinRequests`);
      const q = query(requestsRef, where('status', '==', 'pending'));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const requests = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as JoinRequest));
        setJoinRequests(requests);
      });
      return () => unsubscribe();
    }
  }, [isTeacher, classroomId]);
  
  const handleApproveRequest = useCallback(async (request: JoinRequest) => {
      if (!isTeacher || !classroomId) return;
      
      const studentId = request.studentId;

      try {
        const batch = writeBatch(db);

        // Delete the request
        const requestRef = doc(db, `classrooms/${classroomId}/joinRequests`, studentId);
        batch.delete(requestRef);

        // Add student to the classroom's student list (optional, can be inferred)
        const classroomRef = doc(db, 'classrooms', classroomId);
        batch.update(classroomRef, {
            students: arrayUnion(studentId)
        });

        // Add the classroom to the student's enrolled list
        const enrolledRef = doc(db, `users/${studentId}/enrolled`, classroomId);
        batch.set(enrolledRef, {
            classroomId: classroomId,
            title: classroom?.title,
            description: classroom?.description,
            teacherId: classroom?.teacherId,
            teacherName: classroom?.teacherName,
            enrolledAt: serverTimestamp(),
        });
        
        await batch.commit();
        
        toast({ title: 'Success', description: 'Student has been enrolled.' });

      } catch (error) {
          console.error("Error approving request:", error);
          toast({ variant: 'destructive', title: 'Error', description: 'Could not approve the request.' });
      }

  }, [isTeacher, classroomId, classroom, toast]);
  
  const handleDenyRequest = useCallback(async (studentId: string) => {
      if (!isTeacher || !classroomId) return;
       try {
        const requestRef = doc(db, `classrooms/${classroomId}/joinRequests`, studentId);
        await deleteDoc(requestRef);
        toast({ title: 'Request Denied' });
      } catch (error) {
        console.error("Error denying request:", error);
        toast({ variant: 'destructive', title: 'Error', description: 'Could not deny the request.' });
      }
  }, [isTeacher, classroomId, toast]);


  if (loading || authLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!classroom) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center">
        <CardTitle>Classroom Not Found</CardTitle>
        <p className="text-muted-foreground mt-2">The class you are looking for does not exist.</p>
        <Button asChild className="mt-4">
          <Link href="/dashboard/classrooms">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Classrooms
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-8">
      <div className="flex justify-between items-start mb-6 gap-4">
        <div>
            <h1 className="text-3xl font-bold">{classroom.title}</h1>
            <p className="text-muted-foreground">{classroom.description}</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 items-end flex-shrink-0">
          {isTeacher && joinRequests.length > 0 && (
            <Card className="p-2 bg-primary/10 border-primary/20">
              <h3 className="text-sm font-semibold mb-2 text-primary flex items-center gap-2"><UserPlus className="h-4 w-4"/> Join Requests ({joinRequests.length})</h3>
              <ScrollArea className="max-h-40" viewportRef={joinRequestsScrollAreaRef}>
                <div className="space-y-2">
                  {joinRequests.map(req => (
                    <div key={req.id} className="flex items-center justify-between p-2 rounded-md bg-background">
                      <div className="flex items-center gap-2">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={req.studentPhotoURL} alt={req.studentName} data-ai-hint="avatar user"/>
                          <AvatarFallback>{req.studentName?.charAt(0) || '?'}</AvatarFallback>
                        </Avatar>
                        <span className="text-sm font-medium">{req.studentName || 'A new student'}</span>
                      </div>
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-green-600 hover:text-green-700" onClick={() => handleApproveRequest(req)}><Check/></Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-red-600 hover:text-red-700" onClick={() => handleDenyRequest(req.id)}><X/></Button>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </Card>
          )}
          <Button asChild variant="outline">
            <Link href="/dashboard/classrooms">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back
            </Link>
          </Button>
        </div>
      </div>

      <Tabs defaultValue="announcements" className="w-full">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="announcements"><Megaphone className="mr-2 h-4 w-4"/>Announcements</TabsTrigger>
          <TabsTrigger value="materials"><BookCopy className="mr-2 h-4 w-4"/>Materials</TabsTrigger>
          <TabsTrigger value="assignments"><FileQuestion className="mr-2 h-4 w-4"/>Assignments</TabsTrigger>
          <TabsTrigger value="subjects"><ClipboardList className="mr-2 h-4 w-4"/>Subjects</TabsTrigger>
          <TabsTrigger value="exams"><FileText className="mr-2 h-4 w-4"/>Exams</TabsTrigger>
          <TabsTrigger value="chat"><MessageSquare className="mr-2 h-4 w-4"/>Chat</TabsTrigger>
        </TabsList>
        <Card className="mt-4 rounded-xl">
            <CardContent className="p-6 min-h-[400px]">
                <TabsContent value="announcements">
                    <CardHeader>
                        <CardTitle>Announcements</CardTitle>
                        <CardDescription>Latest updates and announcements from the teacher.</CardDescription>
                    </CardHeader>
                    <div className="text-center text-muted-foreground py-16">
                        <Megaphone className="h-12 w-12 mx-auto mb-4" />
                        <p>No announcements yet.</p>
                    </div>
                </TabsContent>
                <TabsContent value="materials">
                    <CardHeader>
                        <CardTitle>Class Materials</CardTitle>
                        <CardDescription>Find lecture notes, presentations, and other resources here.</CardDescription>
                    </CardHeader>
                     <div className="text-center text-muted-foreground py-16">
                        <BookCopy className="h-12 w-12 mx-auto mb-4" />
                        <p>No materials uploaded yet.</p>
                    </div>
                </TabsContent>
                <TabsContent value="assignments">
                    <CardHeader>
                        <CardTitle>Assignments & Tests</CardTitle>
                        <CardDescription>View upcoming and past assignments, quizzes, and exams.</CardDescription>
                    </CardHeader>
                     <div className="text-center text-muted-foreground py-16">
                        <FileQuestion className="h-12 w-12 mx-auto mb-4" />
                        <p>No assignments posted yet.</p>
                    </div>
                </TabsContent>
                 <TabsContent value="subjects">
                    <CardHeader>
                        <CardTitle>Subjects & Teachers</CardTitle>
                        <CardDescription>Manage subjects and assigned teachers for this classroom.</CardDescription>
                    </CardHeader>
                     <div className="text-center text-muted-foreground py-16">
                        <ClipboardList className="h-12 w-12 mx-auto mb-4" />
                        <p>No subjects assigned yet.</p>
                    </div>
                </TabsContent>
                 <TabsContent value="exams">
                    <CardHeader>
                        <CardTitle>Exam Papers</CardTitle>
                        <CardDescription>Upload and view exam papers and related materials.</CardDescription>
                    </CardHeader>
                     <div className="text-center text-muted-foreground py-16">
                        <FileText className="h-12 w-12 mx-auto mb-4" />
                        <p>No exam papers uploaded yet.</p>
                    </div>
                </TabsContent>
                <TabsContent value="chat">
                    <CardHeader>
                        <CardTitle>Class Chat</CardTitle>
                        <CardDescription>Discuss topics with your teacher and classmates.</CardDescription>
                    </CardHeader>
                    <div className="text-center text-muted-foreground py-16">
                        <MessageSquare className="h-12 w-12 mx-auto mb-4" />
                        <p>Chat feature coming soon!</p>
                    </div>
                </TabsContent>
            </CardContent>
        </Card>
      </Tabs>
    </div>
  );
}
