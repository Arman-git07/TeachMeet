
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { db } from '@/lib/firebase';
import { doc, onSnapshot, collection, query, updateDoc, writeBatch, where, arrayUnion, serverTimestamp, deleteDoc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Megaphone, BookCopy, FileQuestion, MessageSquare, Loader2, Check, UserPlus, X, ClipboardList, FileText, CreditCard, Wallet, Receipt } from 'lucide-react';
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

        const classroomRef = doc(db, 'classrooms', classroomId);
        batch.update(classroomRef, {
            students: arrayUnion(studentId)
        });

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
    <div className="flex-1 bg-muted/30">
        <div className="bg-card shadow-sm pb-8">
            <div className="container mx-auto px-4 md:px-8 pt-6">
                <Button asChild variant="ghost" className="mb-4 -ml-4 text-muted-foreground">
                    <Link href="/dashboard/classrooms">
                        <ArrowLeft className="mr-2 h-4 w-4" /> Back to Classrooms
                    </Link>
                </Button>
                <div className="flex flex-col md:flex-row justify-between items-start gap-6">
                    <div>
                        <h1 className="text-4xl font-bold tracking-tight text-foreground">{classroom.title}</h1>
                        <p className="text-lg text-muted-foreground mt-1">{classroom.description}</p>
                        <p className="text-sm text-muted-foreground mt-2">Taught by: {classroom.teacherName}</p>
                    </div>
                     {isTeacher && joinRequests.length > 0 && (
                        <Card className="p-3 bg-background border-primary/20 w-full max-w-sm shrink-0">
                        <h3 className="text-sm font-semibold mb-2 text-primary flex items-center gap-2"><UserPlus className="h-4 w-4"/> Join Requests ({joinRequests.length})</h3>
                        <ScrollArea className="max-h-40" viewportRef={joinRequestsScrollAreaRef}>
                            <div className="space-y-2">
                            {joinRequests.map(req => (
                                <div key={req.id} className="flex items-center justify-between p-2 rounded-md bg-muted/50">
                                <div className="flex items-center gap-2">
                                    <Avatar className="h-8 w-8">
                                    <AvatarImage src={req.studentPhotoURL} alt={req.studentName} data-ai-hint="avatar user"/>
                                    <AvatarFallback>{req.studentName?.charAt(0) || '?'}</AvatarFallback>
                                    </Avatar>
                                    <span className="text-sm font-medium">{req.studentName || 'A new student'}</span>
                                </div>
                                <div className="flex gap-1">
                                    <Button size="icon" variant="ghost" className="h-7 w-7 text-green-600 hover:text-green-700 hover:bg-green-500/10" onClick={() => handleApproveRequest(req)}><Check/></Button>
                                    <Button size="icon" variant="ghost" className="h-7 w-7 text-red-600 hover:text-red-700 hover:bg-red-500/10" onClick={() => handleDenyRequest(req.id)}><X/></Button>
                                </div>
                                </div>
                            ))}
                            </div>
                        </ScrollArea>
                        </Card>
                    )}
                </div>
            </div>
        </div>
      <div className="container mx-auto p-4 md:p-8">
      <Tabs defaultValue="announcements" className="w-full">
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7">
          <TabsTrigger value="announcements"><Megaphone className="mr-2 h-4 w-4"/>Announcements</TabsTrigger>
          <TabsTrigger value="materials"><BookCopy className="mr-2 h-4 w-4"/>Materials</TabsTrigger>
          <TabsTrigger value="assignments"><FileQuestion className="mr-2 h-4 w-4"/>Assignments</TabsTrigger>
          <TabsTrigger value="subjects"><ClipboardList className="mr-2 h-4 w-4"/>Subjects</TabsTrigger>
          <TabsTrigger value="exams"><FileText className="mr-2 h-4 w-4"/>Exams</TabsTrigger>
          <TabsTrigger value="fees"><CreditCard className="mr-2 h-4 w-4"/>Fees</TabsTrigger>
          <TabsTrigger value="chat"><MessageSquare className="mr-2 h-4 w-4"/>Chat</TabsTrigger>
        </TabsList>
        <div className="mt-6">
                <TabsContent value="announcements">
                    <Card className="shadow-lg rounded-xl">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2"><Megaphone className="text-primary"/>Announcements</CardTitle>
                            <CardDescription>Latest updates and announcements from the teacher.</CardDescription>
                        </CardHeader>
                        <CardContent className="min-h-[400px] flex items-center justify-center">
                             <div className="text-center text-muted-foreground py-16">
                                <Megaphone className="h-16 w-16 mx-auto mb-4 opacity-50" />
                                <p className="font-semibold">No announcements yet</p>
                                <p className="text-sm">Check back later for updates.</p>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
                <TabsContent value="materials">
                     <Card className="shadow-lg rounded-xl">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2"><BookCopy className="text-primary"/>Class Materials</CardTitle>
                            <CardDescription>Find lecture notes, presentations, and other resources here.</CardDescription>
                        </CardHeader>
                        <CardContent className="min-h-[400px] flex items-center justify-center">
                            <div className="text-center text-muted-foreground py-16">
                                <BookCopy className="h-16 w-16 mx-auto mb-4 opacity-50" />
                                <p className="font-semibold">No materials uploaded</p>
                                <p className="text-sm">Your teacher hasn't uploaded any materials yet.</p>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
                <TabsContent value="assignments">
                    <Card className="shadow-lg rounded-xl">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2"><FileQuestion className="text-primary"/>Assignments & Tests</CardTitle>
                            <CardDescription>View upcoming and past assignments, quizzes, and exams.</CardDescription>
                        </CardHeader>
                        <CardContent className="min-h-[400px] flex items-center justify-center">
                             <div className="text-center text-muted-foreground py-16">
                                <FileQuestion className="h-16 w-16 mx-auto mb-4 opacity-50" />
                                <p className="font-semibold">No assignments posted</p>
                                 <p className="text-sm">Keep an eye out for upcoming assignments.</p>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
                 <TabsContent value="subjects">
                    <Card className="shadow-lg rounded-xl">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2"><ClipboardList className="text-primary"/>Subjects & Teachers</CardTitle>
                            <CardDescription>Manage subjects and assigned teachers for this classroom.</CardDescription>
                        </CardHeader>
                        <CardContent className="min-h-[400px] flex items-center justify-center">
                            <div className="text-center text-muted-foreground py-16">
                                <ClipboardList className="h-16 w-16 mx-auto mb-4 opacity-50" />
                                <p className="font-semibold">No subjects assigned</p>
                                 <p className="text-sm">Your teacher will assign subjects soon.</p>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
                 <TabsContent value="exams">
                     <Card className="shadow-lg rounded-xl">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2"><FileText className="text-primary"/>Exam Papers</CardTitle>
                            <CardDescription>Upload and view exam papers and related materials.</CardDescription>
                        </CardHeader>
                        <CardContent className="min-h-[400px] flex items-center justify-center">
                            <div className="text-center text-muted-foreground py-16">
                                <FileText className="h-16 w-16 mx-auto mb-4 opacity-50" />
                                <p className="font-semibold">No exam papers found</p>
                                <p className="text-sm">Exam materials will appear here.</p>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
                <TabsContent value="fees">
                     <Card className="shadow-lg rounded-xl">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2"><CreditCard className="text-primary"/>Fee Payments</CardTitle>
                            <CardDescription>Manage tuition fees and payments for this classroom.</CardDescription>
                        </CardHeader>
                        <CardContent className="min-h-[400px] grid grid-cols-1 md:grid-cols-2 gap-8 items-start pt-6">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Next Payment</CardTitle>
                                    <CardDescription>Your upcoming fee payment details.</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                     <div className="border bg-primary/5 p-6 rounded-lg text-center">
                                        <p className="text-muted-foreground">Amount Due</p>
                                        <p className="text-4xl font-bold text-primary">$150.00</p>
                                        <p className="text-muted-foreground text-sm">Due by: August 31, 2024</p>
                                    </div>
                                </CardContent>
                                <CardFooter>
                                    <Button className="w-full btn-gel">
                                        <Wallet className="mr-2 h-4 w-4"/>
                                        Pay with Card
                                    </Button>
                                </CardFooter>
                            </Card>
                            <Card>
                                <CardHeader>
                                    <CardTitle>Payment History</CardTitle>
                                    <CardDescription>A record of your past payments.</CardDescription>
                                </CardHeader>
                                <CardContent className="flex items-center justify-center h-full">
                                    <div className="text-center text-muted-foreground py-10">
                                        <Receipt className="h-12 w-12 mx-auto mb-4 opacity-50" />
                                        <p className="font-semibold">No payment history</p>
                                        <p className="text-sm">Your past payments will appear here.</p>
                                    </div>
                                </CardContent>
                            </Card>
                        </CardContent>
                    </Card>
                </TabsContent>
                <TabsContent value="chat">
                    <Card className="shadow-lg rounded-xl">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2"><MessageSquare className="text-primary"/>Class Chat</CardTitle>
                            <CardDescription>Discuss topics with your teacher and classmates.</CardDescription>
                        </CardHeader>
                        <CardContent className="min-h-[400px] flex items-center justify-center">
                            <div className="text-center text-muted-foreground py-16">
                                <MessageSquare className="h-16 w-16 mx-auto mb-4 opacity-50" />
                                <p className="font-semibold">Chat feature coming soon!</p>
                                <p className="text-sm">Get ready to collaborate with your class.</p>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
        </div>
      </Tabs>
    </div>
    </div>
  );
}
