
'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { ArrowLeft, CalendarDays, Clock, Edit, FileText, MessageSquare, DollarSign, Users, AlertTriangle, Info } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';

// Mock data for a classroom - in a real app, this would be fetched based on classId
interface ClassroomDetails {
  id: string;
  name: string;
  description: string;
  teacherName: string;
  teacherAvatar?: string;
  memberCount: number;
  thumbnailUrl: string;
  updates?: { title: string; content: string; date: string }[];
  schedule?: { day: string; time: string }[];
  assignments?: { title: string; dueDate: string; status: 'Pending' | 'Submitted' | 'Graded' }[];
  feeDetails?: { totalFee: number; paidAmount: number; nextDueDate?: string };
}

// Placeholder classroom data, replace with actual data fetching
const getMockClassroomDetails = (id: string, nameQueryParam?: string | null): ClassroomDetails | null => {
  if (!id) return null;
  // In a real app, fetch from DB. For now, use classId and name from query.
  return {
    id: id,
    name: nameQueryParam || `Class ${id}`,
    description: `This is a detailed description for ${nameQueryParam || `Class ${id}`}. It covers various topics and learning objectives. Students will engage in interactive sessions and collaborative projects.`,
    teacherName: "Dr. Placeholder Teacher",
    teacherAvatar: `https://placehold.co/40x40.png?text=PT`,
    memberCount: Math.floor(Math.random() * 30) + 5, // Random member count
    thumbnailUrl: `https://placehold.co/800x400.png`,
    updates: [
      { title: "Welcome Message", content: "Welcome to the class! We're excited to have you.", date: "2024-08-01" },
      { title: "First Assignment Posted", content: "Please check the assignments section for your first task.", date: "2024-08-03" },
    ],
    schedule: [
      { day: "Monday", time: "10:00 AM - 11:30 AM" },
      { day: "Wednesday", time: "10:00 AM - 11:30 AM" },
    ],
    assignments: [
      { title: "Introduction Essay", dueDate: "2024-08-10", status: "Pending" },
      { title: "Chapter 1 Quiz", dueDate: "2024-08-15", status: "Pending" },
    ],
    feeDetails: {
      totalFee: 500,
      paidAmount: 250,
      nextDueDate: "2024-09-01",
    },
  };
};

export default function ClassDetailsPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const classId = params.classId as string;
  const classNameQuery = searchParams.get('name');

  const [classroom, setClassroom] = useState<ClassroomDetails | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (classId) {
      // Simulate fetching data
      setLoading(true);
      setTimeout(() => {
        const details = getMockClassroomDetails(classId, classNameQuery);
        setClassroom(details);
        setLoading(false);
      }, 500);
    } else {
      setLoading(false);
    }
  }, [classId, classNameQuery]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8">
        <Card className="w-full max-w-4xl p-8 rounded-xl shadow-xl border-border/50">
          <CardHeader>
            <div className="h-8 bg-muted rounded w-3/4 mx-auto mb-2"></div>
            <div className="h-4 bg-muted rounded w-1/2 mx-auto"></div>
          </CardHeader>
          <CardContent className="space-y-6 mt-6">
            <div className="h-40 bg-muted rounded-lg w-full"></div>
            <div className="space-y-2">
              <div className="h-4 bg-muted rounded w-full"></div>
              <div className="h-4 bg-muted rounded w-5/6"></div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-24 bg-muted rounded-lg"></div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!classroom) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center">
        <AlertTriangle className="h-16 w-16 text-destructive mb-4" />
        <h1 className="text-2xl font-bold text-destructive mb-2">Class Not Found</h1>
        <p className="text-muted-foreground mb-6">
          The class details for ID &quot;{classId}&quot; could not be loaded. It might not exist or there was an error.
        </p>
        <Button onClick={() => router.push('/dashboard/classes')} variant="outline" className="rounded-lg">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to All Classes
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-8 p-4 md:p-8">
      <div className="flex items-center justify-between mb-6">
        <Button onClick={() => router.push('/dashboard/classes')} variant="outline" className="rounded-lg">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to All Classes
        </Button>
        {/* Add an edit button if the current user is the teacher/host */}
      </div>

      <Card className="rounded-xl shadow-xl border-border/50 overflow-hidden">
        <div className="relative h-48 md:h-64 w-full">
          <Image
            src={classroom.thumbnailUrl}
            alt={`Thumbnail for ${classroom.name}`}
            layout="fill"
            objectFit="cover"
            className="opacity-80"
            data-ai-hint="classroom banner"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
          <div className="absolute bottom-0 left-0 p-6">
            <h1 className="text-3xl md:text-4xl font-bold text-white shadow-md">{classroom.name}</h1>
            <p className="text-sm text-slate-200 mt-1 shadow-sm">Taught by {classroom.teacherName}</p>
          </div>
        </div>

        <CardContent className="p-6 space-y-6">
          <div>
            <h2 className="text-xl font-semibold text-foreground mb-2">Class Description</h2>
            <p className="text-muted-foreground whitespace-pre-line">{classroom.description}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Section: Class Updates */}
            <Card className="rounded-lg shadow-md border-border/30">
              <CardHeader>
                <CardTitle className="flex items-center text-lg"><Info className="mr-2 h-5 w-5 text-primary" />Class Updates</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm max-h-60 overflow-y-auto">
                {classroom.updates?.length ? classroom.updates.map((update, index) => (
                  <div key={index} className="pb-2 border-b border-border/20 last:border-b-0">
                    <p className="font-semibold text-foreground">{update.title} <span className="text-xs text-muted-foreground">({update.date})</span></p>
                    <p className="text-muted-foreground">{update.content}</p>
                  </div>
                )) : <p className="text-muted-foreground">No updates posted yet.</p>}
              </CardContent>
            </Card>

            {/* Section: Schedule & Timings */}
            <Card className="rounded-lg shadow-md border-border/30">
              <CardHeader>
                <CardTitle className="flex items-center text-lg"><CalendarDays className="mr-2 h-5 w-5 text-primary" />Schedule & Timings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {classroom.schedule?.length ? classroom.schedule.map((item, index) => (
                  <div key={index} className="flex justify-between">
                    <span className="text-foreground">{item.day}:</span>
                    <span className="text-muted-foreground">{item.time}</span>
                  </div>
                )) : <p className="text-muted-foreground">Schedule not available.</p>}
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Section: Homework / Assignments */}
            <Card className="rounded-lg shadow-md border-border/30">
              <CardHeader>
                <CardTitle className="flex items-center text-lg"><FileText className="mr-2 h-5 w-5 text-primary" />Homework & Assignments</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm max-h-60 overflow-y-auto">
                {classroom.assignments?.length ? classroom.assignments.map((assignment, index) => (
                  <div key={index} className="pb-2 border-b border-border/20 last:border-b-0">
                    <p className="font-semibold text-foreground">{assignment.title}</p>
                    <p className="text-muted-foreground">Due: {assignment.dueDate} - Status: {assignment.status}</p>
                    <Button variant="link" size="sm" className="p-0 h-auto text-accent">View Details</Button>
                  </div>
                )) : <p className="text-muted-foreground">No assignments posted yet.</p>}
              </CardContent>
               <CardFooter>
                <Button variant="outline" className="w-full rounded-lg text-sm">Check All Assignments</Button>
              </CardFooter>
            </Card>

            {/* Section: Fees Payment */}
            <Card className="rounded-lg shadow-md border-border/30">
              <CardHeader>
                <CardTitle className="flex items-center text-lg"><DollarSign className="mr-2 h-5 w-5 text-primary" />Fees & Payment</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {classroom.feeDetails ? (
                  <>
                    <p>Total Fee: <span className="font-semibold text-foreground">${classroom.feeDetails.totalFee}</span></p>
                    <p>Amount Paid: <span className="font-semibold text-green-600">${classroom.feeDetails.paidAmount}</span></p>
                    <p>Remaining: <span className="font-semibold text-destructive">${classroom.feeDetails.totalFee - classroom.feeDetails.paidAmount}</span></p>
                    {classroom.feeDetails.nextDueDate && <p>Next Payment Due: {classroom.feeDetails.nextDueDate}</p>}
                  </>
                ) : <p className="text-muted-foreground">Fee details not available.</p>}
              </CardContent>
              <CardFooter>
                <Button className="w-full btn-gel rounded-lg text-sm" disabled={!classroom.feeDetails || classroom.feeDetails.paidAmount === classroom.feeDetails.totalFee}>
                  {classroom.feeDetails && classroom.feeDetails.paidAmount === classroom.feeDetails.totalFee ? "Fully Paid" : "Make Payment"}
                </Button>
              </CardFooter>
            </Card>
          </div>
          
          <div className="mt-6 text-center">
             <Button variant="default" size="lg" className="btn-gel rounded-lg">
                <MessageSquare className="mr-2 h-5 w-5"/> Join Class Discussion (Mock)
            </Button>
          </div>

        </CardContent>
      </Card>
    </div>
  );
}
    