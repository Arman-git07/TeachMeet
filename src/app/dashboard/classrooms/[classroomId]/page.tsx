
'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { doc, getDoc, onSnapshot, collection, query, writeBatch } from 'firebase/firestore';
import { useDynamicHeader } from '@/contexts/DynamicHeaderContext';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ArrowLeft,
  Bell,
  Book,
  ClipboardList,
  GraduationCap,
  CreditCard,
  MessageSquare,
  Users,
  AlertTriangle,
  Check,
  X,
  FileText,
  BadgeDollarSign
} from 'lucide-react';
import Link from 'next/link';

interface Classroom {
  id: string;
  title: string;
  description: string;
  teacherId: string;
  teacherName: string;
}

interface JoinRequest {
  id: string;
  studentName: string;
  studentPhotoURL?: string;
}

const ClassroomFeatureCard = ({ icon: Icon, title, description, actionText, onAction }: { icon: React.ElementType, title: string, description: string, actionText: string, onAction?: () => void }) => (
    <Card className="hover:shadow-lg transition-shadow">
        <CardHeader className="flex flex-row items-center gap-4 space-y-0 pb-2">
            <div className="bg-primary/10 p-3 rounded-full">
                <Icon className="h-6 w-6 text-primary" />
            </div>
            <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent>
            <p className="text-sm text-muted-foreground">{description}</p>
        </CardContent>
        {onAction && (
            <CardFooter>
                <Button onClick={onAction} variant="outline" className="w-full">{actionText}</Button>
            </CardFooter>
        )}
    </Card>
);

export default function ClassroomPage() {
  const params = useParams();
  const classroomId = params.classroomId as string;
  const router = useRouter();
  const { user } = useAuth();
  const { toast } = useToast();
  const { setHeaderContent, setHeaderAction } = useDynamicHeader();

  const [classroom, setClassroom] = useState<Classroom | null>(null);
  const [joinRequests, setJoinRequests] = useState<JoinRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const isTeacher = user?.uid === classroom?.teacherId;

  useEffect(() => {
    if (!classroom) {
      setHeaderContent(null);
      setHeaderAction(null);
      return;
    }

    setHeaderContent(
      <div className="min-w-0 flex-1">
        <h2 className="text-xl font-bold leading-7 text-foreground sm:truncate sm:text-2xl sm:tracking-tight">
          {classroom.title}
        </h2>
        <p className="text-sm text-muted-foreground mt-1 truncate">Taught by: {classroom.teacherName}</p>
      </div>
    );
    setHeaderAction(
      <Button asChild variant="outline" className="rounded-lg">
        <Link href="/dashboard/classrooms">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Classrooms
        </Link>
      </Button>
    );

    return () => {
      setHeaderContent(null);
      setHeaderAction(null);
    };
  }, [classroom, setHeaderContent, setHeaderAction]);

  useEffect(() => {
    if (!classroomId) return;
    
    const docRef = doc(db, 'classrooms', classroomId);
    const unsubClassroom = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        setClassroom({ id: docSnap.id, ...docSnap.data() } as Classroom);
      } else {
        toast({ variant: 'destructive', title: 'Error', description: 'Classroom not found.' });
        router.push('/dashboard/classrooms');
      }
      setIsLoading(false);
    });

    return () => unsubClassroom();
  }, [classroomId, router, toast]);
  
  useEffect(() => {
    if (isTeacher && classroomId) {
      const requestsRef = collection(db, 'classrooms', classroomId, 'joinRequests');
      const unsubRequests = onSnapshot(query(requestsRef), (snapshot) => {
        setJoinRequests(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as JoinRequest)));
      });
      return () => unsubRequests();
    }
  }, [isTeacher, classroomId]);
  
  const handleRequestAction = async (requestId: string, approve: boolean) => {
    if (!isTeacher || !classroomId) return;
    
    try {
        const batch = writeBatch(db);
        const requestRef = doc(db, 'classrooms', classroomId, 'joinRequests', requestId);
        
        if (approve) {
            const studentData = (await getDoc(requestRef)).data();
            const enrollmentRef = doc(db, 'users', requestId, 'enrolled', classroomId);
            batch.set(enrollmentRef, {
                classroomId: classroomId,
                title: classroom?.title,
                description: classroom?.description,
                teacherName: classroom?.teacherName,
                enrolledAt: new Date(),
            });
        }
        
        batch.delete(requestRef);
        await batch.commit();

        toast({ title: `Request ${approve ? 'Approved' : 'Denied'}`, description: `The student has been ${approve ? 'added to the class' : 'denied entry'}.` });
    } catch (error) {
        console.error("Error handling join request:", error);
        toast({ variant: 'destructive', title: 'Error', description: 'Could not process the request.' });
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-1/4 mb-4" />
        <Skeleton className="h-6 w-1/2 mb-8" />
        <div className="space-y-4">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
        </div>
      </div>
    );
  }

  if (!classroom) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center">
        <AlertTriangle className="h-16 w-16 text-destructive mb-4" />
        <h2 className="text-2xl font-bold">Classroom Not Found</h2>
        <p className="text-muted-foreground">The classroom you are looking for does not exist or has been deleted.</p>
        <Button asChild className="mt-6">
          <Link href="/dashboard/classrooms">Go Back to Classrooms</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-muted/30 p-4 md:p-8">
      {isTeacher && joinRequests.length > 0 && (
          <div className="container mx-auto px-0 pb-4">
              <Card className="bg-primary/10 border-primary/20">
                  <CardHeader>
                      <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5"/>Join Requests ({joinRequests.length})</CardTitle>
                  </CardHeader>
                  <CardContent>
                      <div className="space-y-2">
                      {joinRequests.map(req => (
                          <div key={req.id} className="flex items-center justify-between bg-background p-2 rounded-lg">
                              <div className="flex items-center gap-2">
                                  <Avatar className="h-8 w-8">
                                      <AvatarImage src={req.studentPhotoURL} data-ai-hint="avatar user"/>
                                      <AvatarFallback>{req.studentName?.charAt(0) || '?'}</AvatarFallback>
                                  </Avatar>
                                  <span className="text-sm font-medium">{req.studentName}</span>
                              </div>
                              <div className="flex gap-2">
                                  <Button size="icon" variant="outline" className="h-8 w-8 bg-green-500/10 text-green-700 hover:bg-green-500/20" onClick={() => handleRequestAction(req.id, true)}><Check className="h-4 w-4"/></Button>
                                  <Button size="icon" variant="outline" className="h-8 w-8 bg-red-500/10 text-red-700 hover:bg-red-500/20" onClick={() => handleRequestAction(req.id, false)}><X className="h-4 w-4"/></Button>
                              </div>
                          </div>
                      ))}
                      </div>
                  </CardContent>
              </Card>
          </div>
      )}

      <main className="container mx-auto px-0">
        <Tabs defaultValue="announcements" className="w-full">
          <TabsList className="grid w-full grid-cols-3 md:grid-cols-7 mb-6">
            <TabsTrigger value="announcements"><Bell className="h-4 w-4 mr-2"/>Announcements</TabsTrigger>
            <TabsTrigger value="materials"><Book className="h-4 w-4 mr-2"/>Materials</TabsTrigger>
            <TabsTrigger value="assignments"><ClipboardList className="h-4 w-4 mr-2"/>Assignments</TabsTrigger>
            <TabsTrigger value="subjects"><GraduationCap className="h-4 w-4 mr-2"/>Subjects</TabsTrigger>
            <TabsTrigger value="exams"><FileText className="h-4 w-4 mr-2"/>Exams</TabsTrigger>
            <TabsTrigger value="fees"><CreditCard className="h-4 w-4 mr-2"/>Fees</TabsTrigger>
            <TabsTrigger value="chat"><MessageSquare className="h-4 w-4 mr-2"/>Chat</TabsTrigger>
          </TabsList>
          
          <TabsContent value="announcements" className="mt-6">
            <Card>
                <CardHeader>
                    <CardTitle>Announcements</CardTitle>
                    <CardDescription>Latest updates and announcements from the teacher.</CardDescription>
                </CardHeader>
                <CardContent className="text-center text-muted-foreground py-12">
                    <Bell className="h-12 w-12 mx-auto mb-2" />
                    <p>No announcements yet</p>
                    <p className="text-sm">Check back later for updates.</p>
                </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="materials" className="mt-6">
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                <ClassroomFeatureCard icon={Book} title="Course Syllabus" description="The complete overview of the course structure, schedule, and grading." actionText="Download Syllabus" />
                <ClassroomFeatureCard icon={FileText} title="Lecture Notes" description="All notes and slides from the lectures are available here." actionText="View Notes" />
                <ClassroomFeatureCard icon={GraduationCap} title="Reading List" description="List of required and recommended readings for the course." actionText="Open Reading List" />
            </div>
          </TabsContent>

          <TabsContent value="assignments" className="mt-6">
             <Card>
                <CardHeader>
                    <CardTitle>Assignments</CardTitle>
                    <CardDescription>View upcoming and past assignments.</CardDescription>
                </CardHeader>
                <CardContent className="text-center text-muted-foreground py-12">
                    <ClipboardList className="h-12 w-12 mx-auto mb-2" />
                    <p>No assignments posted yet.</p>
                </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="subjects" className="mt-6">
            <Card>
                <CardHeader>
                    <CardTitle>Subjects</CardTitle>
                    <CardDescription>Overview of subjects covered in this classroom.</CardDescription>
                </CardHeader>
                <CardContent className="text-center text-muted-foreground py-12">
                    <GraduationCap className="h-12 w-12 mx-auto mb-2" />
                    <p>No subjects listed yet.</p>
                </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="exams" className="mt-6">
            <Card>
                <CardHeader>
                    <CardTitle>Exams</CardTitle>
                    <CardDescription>Schedule and details for upcoming exams.</CardDescription>
                </CardHeader>
                <CardContent className="text-center text-muted-foreground py-12">
                    <FileText className="h-12 w-12 mx-auto mb-2" />
                    <p>No exams scheduled yet.</p>
                </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="fees" className="mt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><CreditCard className="h-5 w-5"/>Make a Payment</CardTitle>
                        <CardDescription>Pay your tuition and other fees securely.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div>
                            <p className="font-bold text-3xl">$500.00</p>
                            <p className="text-sm text-muted-foreground">Due by: Dec 31, 2024</p>
                        </div>
                        <Button className="w-full btn-gel">Pay Now</Button>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><BadgeDollarSign className="h-5 w-5"/>Payment History</CardTitle>
                        <CardDescription>View your past transactions.</CardDescription>
                    </CardHeader>
                    <CardContent className="text-center text-muted-foreground py-8">
                         <p>No transaction history found.</p>
                    </CardContent>
                </Card>
            </div>
          </TabsContent>

           <TabsContent value="chat" className="mt-6">
            <Card className="h-[400px] flex flex-col">
                <CardHeader>
                    <CardTitle>Class Chat</CardTitle>
                    <CardDescription>Discuss topics with your classmates and teacher.</CardDescription>
                </CardHeader>
                <CardContent className="flex-grow flex items-center justify-center text-center text-muted-foreground">
                     <div>
                        <MessageSquare className="h-12 w-12 mx-auto mb-2" />
                        <p>Chat feature is coming soon!</p>
                     </div>
                </CardContent>
                <CardFooter>
                    <Button className="w-full" disabled>Open Chat (Unavailable)</Button>
                </CardFooter>
            </Card>
          </TabsContent>

        </Tabs>
      </main>
    </div>
  );
}
