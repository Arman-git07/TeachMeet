
'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Megaphone, BookCopy, FileQuestion, MessageSquare, Loader2 } from 'lucide-react';
import Link from 'next/link';
import type { Teaching } from '../page';

export default function ClassroomPage() {
  const params = useParams();
  const teachingId = params.teachingId as string;
  const router = useRouter();

  const [teaching, setTeaching] = useState<Teaching | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (teachingId) {
      const fetchTeaching = async () => {
        setLoading(true);
        const teachingRef = doc(db, 'teachings', teachingId);
        const teachingSnap = await getDoc(teachingRef);
        if (teachingSnap.exists()) {
          setTeaching({ id: teachingSnap.id, ...teachingSnap.data() } as Teaching);
        } else {
          // Handle case where teaching is not found
          console.error('No such teaching!');
        }
        setLoading(false);
      };
      fetchTeaching();
    }
  }, [teachingId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!teaching) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center">
        <CardTitle>Teaching Not Found</CardTitle>
        <p className="text-muted-foreground mt-2">The class you are looking for does not exist.</p>
        <Button asChild className="mt-4">
          <Link href="/dashboard/teachings">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Teachings
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-8">
      <div className="flex justify-between items-center mb-6">
        <div>
            <h1 className="text-3xl font-bold">{teaching.title}</h1>
            <p className="text-muted-foreground">{teaching.description}</p>
        </div>
        <Button asChild variant="outline">
          <Link href="/dashboard/teachings">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Teachings
          </Link>
        </Button>
      </div>

      <Tabs defaultValue="announcements" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="announcements"><Megaphone className="mr-2 h-4 w-4"/>Announcements</TabsTrigger>
          <TabsTrigger value="materials"><BookCopy className="mr-2 h-4 w-4"/>Materials</TabsTrigger>
          <TabsTrigger value="assignments"><FileQuestion className="mr-2 h-4 w-4"/>Assignments</TabsTrigger>
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
