
'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { 
    ArrowLeft, CalendarDays, DollarSign, Users, AlertTriangle, 
    Megaphone, ClipboardList, Link as LinkIcon, FileText as FileIcon, Video as VideoIcon, MessageSquare, Info, Video, PlusCircle
} from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth'; // Import useAuth
import { useToast } from '@/hooks/use-toast'; // Import useToast

interface Announcement {
  title: string;
  content: string;
  date: string;
}

interface Assignment {
  id: string;
  title: string;
  dueDate: string;
  status: 'Pending' | 'Submitted' | 'Graded' | 'Overdue';
  description?: string;
}

interface Material {
  id: string;
  title: string;
  type: 'link' | 'file' | 'video';
  url?: string;
  fileName?: string;
  description?: string;
}

interface ClassroomDetails {
  id: string;
  name: string;
  description: string;
  teacherId?: string; 
  teacherName: string;
  teacherAvatar?: string;
  memberCount: number;
  thumbnailUrl: string;
  announcements?: Announcement[];
  schedule?: { day: string; time: string }[];
  scheduleLastUpdated?: string; // Added for schedule update date
  assignments?: Assignment[];
  materials?: Material[];
  feeDetails?: { totalFee: number; paidAmount: number; nextDueDate?: string };
}

const getMockClassroomDetails = (id: string, nameQueryParam?: string | null): ClassroomDetails | null => {
  if (!id) return null;
  const className = nameQueryParam || `Class ${id}`;
  let baseTeacherId = `teacher_mock_uid_for_${id}`;
  if (id === "cl1") baseTeacherId = "dr_ada_lovelace_uid"; 

  return {
    id: id,
    name: className,
    description: `This is a detailed description for ${className}. It covers various topics and learning objectives. Students will engage in interactive sessions, collaborative projects, and access shared materials.`,
    teacherId: baseTeacherId, 
    teacherName: "Dr. Ada Lovelace",
    teacherAvatar: `https://placehold.co/40x40.png?text=AL`,
    memberCount: Math.floor(Math.random() * 25) + 10,
    thumbnailUrl: `https://placehold.co/800x400.png`,
    announcements: [
      { title: "Welcome to the Course!", content: "We're excited to start this journey together. Please familiarize yourself with the syllabus and course materials.", date: "2024-08-01" },
      { title: "Reminder: Office Hours Changed", content: "Office hours for this week are moved to Thursday, 3-4 PM.", date: "2024-08-05" },
      { title: "Mid-term Project Guidelines", content: "The guidelines for the mid-term project have been uploaded to the materials section.", date: "2024-08-10" },
    ],
    schedule: [
      { day: "Monday", time: "10:00 AM - 11:30 AM (Lecture)" },
      { day: "Wednesday", time: "10:00 AM - 11:00 AM (Lab)" },
      { day: "Friday", time: "01:00 PM - 02:00 PM (Discussion)" },
    ],
    scheduleLastUpdated: "2024-07-28", // Mock date for schedule update
    assignments: [
      { id: "assign1", title: "Introduction Essay", dueDate: "2024-08-10", status: "Graded", description: "A 500-word essay about your motivations for taking this course." },
      { id: "assign2", title: "Chapter 1 Problem Set", dueDate: "2024-08-17", status: "Pending", description: "Complete all odd-numbered problems from Chapter 1." },
      { id: "assign3", title: "Research Proposal", dueDate: "2024-08-24", status: "Pending", description: "Submit a one-page proposal for your mid-term project." },
      { id: "assign0", title: "Pre-course Survey", dueDate: "2024-07-30", status: "Overdue", description: "Complete this survey before the first class." },
    ],
    materials: [
      { id: "mat1", title: "Course Syllabus", type: "file", fileName: "syllabus_fall2024.pdf", description: "Detailed course outline, grading policy, and schedule." },
      { id: "mat2", title: "Recommended Reading List", type: "link", url: "#", description: "A list of external articles and books." },
      { id: "mat3", title: "Introductory Video Lecture", type: "video", url: "#", description: "A pre-recorded lecture covering the basics." },
      { id: "mat4", title: "Python Setup Guide", type: "file", fileName: "python_setup.md", description: "Instructions for setting up your Python environment." },
    ],
    feeDetails: {
      totalFee: 500,
      paidAmount: 250,
      nextDueDate: "2024-09-01",
    },
  };
};

const getStatusColor = (status: Assignment['status']) => {
  switch (status) {
    case 'Graded': return 'bg-green-500/20 text-green-700 border-green-500/50';
    case 'Submitted': return 'bg-blue-500/20 text-blue-700 border-blue-500/50';
    case 'Pending': return 'bg-yellow-500/20 text-yellow-700 border-yellow-500/50';
    case 'Overdue': return 'bg-red-500/20 text-red-700 border-red-500/50';
    default: return 'bg-muted text-muted-foreground border-border';
  }
};

const MaterialIcon = ({ type }: { type: Material['type'] }) => {
  if (type === 'link') return <LinkIcon className="mr-2 h-5 w-5 text-primary" />;
  if (type === 'file') return <FileIcon className="mr-2 h-5 w-5 text-primary" />;
  if (type === 'video') return <VideoIcon className="mr-2 h-5 w-5 text-primary" />;
  return <Info className="mr-2 h-5 w-5 text-primary" />;
};

export default function ClassDetailsPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth(); 
  const { toast } = useToast(); 
  const classId = params.classId as string;
  const classNameQuery = searchParams.get('name');

  const [classroom, setClassroom] = useState<ClassroomDetails | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (classId && !authLoading) { 
      setLoading(true);
      setTimeout(() => {
        const details = getMockClassroomDetails(classId, classNameQuery);
        if (details && user) {
          if (details.id === 'cl1') {
            details.teacherId = user.uid;
            details.teacherName = user.displayName || "Current User (Teacher)";
            const initials = (user.displayName || "CU").split(' ').map(n => n[0]).join('').substring(0,2).toUpperCase();
            details.teacherAvatar = user.photoURL || `https://placehold.co/40x40.png?text=${initials}`;
          }
        }
        setClassroom(details);
        setLoading(false);
      }, 500);
    } else if (!classId) {
      setLoading(false);
    }
  }, [classId, classNameQuery, user, authLoading]);

  const handleJoinDiscussion = () => {
    if (classroom) {
      router.push(`/dashboard/class/${classroom.id}/chat?name=${encodeURIComponent(classroom.name)}`);
    }
  };

  const handleStartClassMeeting = () => {
    if (!user) {
      toast({
        variant: "destructive",
        title: "Authentication Required",
        description: "You need to be signed in to start or join a meeting.",
      });
      return;
    }
    if (classroom) {
      if (user.uid === classroom.teacherId) {
        router.push(`/dashboard/meeting/${classroom.id}/wait?topic=${encodeURIComponent(classroom.name)}`);
      } else {
        toast({
          variant: "destructive",
          title: "Access Denied",
          description: "Only the class teacher or registered members can start/join this meeting directly. Please wait for the teacher to start the meeting or provide a join link.",
        });
      }
    }
  };
  
  const handlePostAnnouncement = () => {
    if (!classroom || user?.uid !== classroom.teacherId) return;

    const title = window.prompt("Enter announcement title:");
    if (!title || title.trim() === "") {
      toast({ variant: "destructive", title: "Title Required", description: "Announcement title cannot be empty." });
      return;
    }

    const content = window.prompt("Enter announcement content:");
    if (!content || content.trim() === "") {
      toast({ variant: "destructive", title: "Content Required", description: "Announcement content cannot be empty." });
      return;
    }

    const newAnnouncement: Announcement = {
      title: title.trim(),
      content: content.trim(),
      date: new Date().toISOString().split('T')[0], // Format as YYYY-MM-DD
    };

    setClassroom(prev => {
      if (!prev) return null;
      return {
        ...prev,
        announcements: [newAnnouncement, ...(prev.announcements || [])],
      };
    });

    toast({ title: "Announcement Posted", description: `"${newAnnouncement.title}" has been posted.` });
  };

  const isCurrentUserTeacher = user?.uid === classroom?.teacherId;

  if (loading || authLoading) { 
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
        <Button onClick={handleStartClassMeeting} variant="default" size="lg" className="btn-gel rounded-lg">
          <Video className="mr-2 h-5 w-5" /> Start/Join Class Meeting
        </Button>
      </div>

      <Card className="rounded-xl shadow-xl border-border/50 overflow-hidden">
        <div className="relative h-48 md:h-64 w-full">
          <Image
            src={classroom.thumbnailUrl}
            alt={`Thumbnail for ${classroom.name}`}
            layout="fill"
            objectFit="cover"
            className="opacity-80"
            data-ai-hint="classroom education"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
          <div className="absolute bottom-0 left-0 p-6">
            <h1 className="text-3xl md:text-4xl font-bold text-white shadow-md">{classroom.name}</h1>
            <div className="flex items-center mt-2">
                {classroom.teacherAvatar && (
                     <Image src={classroom.teacherAvatar} alt={classroom.teacherName} width={32} height={32} className="rounded-full border-2 border-white/50 mr-2" data-ai-hint="teacher avatar"/>
                )}
                <p className="text-sm text-slate-200 shadow-sm">Taught by {classroom.teacherName}</p>
            </div>
          </div>
          <div className="absolute top-4 right-4">
            <Badge variant="secondary" className="text-xs shadow-md rounded-md">
                <Users className="mr-1.5 h-3.5 w-3.5"/> {classroom.memberCount} Members
            </Badge>
          </div>
        </div>

        <CardContent className="p-6 space-y-8">
          <div>
            <h2 className="text-xl font-semibold text-foreground mb-2">About this Class</h2>
            <p className="text-muted-foreground whitespace-pre-line">{classroom.description}</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Section: Announcements */}
            <Card className="rounded-lg shadow-md border-border/30">
              <CardHeader>
                <CardTitle className="flex items-center text-lg"><Megaphone className="mr-2 h-5 w-5 text-primary" />Announcements</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm max-h-72 overflow-y-auto">
                {classroom.announcements?.length ? classroom.announcements.map((item, index) => (
                  <div key={index} className="pb-3 border-b border-border/20 last:border-b-0">
                    <p className="font-semibold text-foreground">{item.title} <span className="text-xs text-muted-foreground">({item.date})</span></p>
                    <p className="text-muted-foreground mt-0.5">{item.content}</p>
                  </div>
                )) : <p className="text-muted-foreground">No announcements posted yet.</p>}
              </CardContent>
              {isCurrentUserTeacher && (
                <CardFooter>
                  <Button onClick={handlePostAnnouncement} variant="outline" className="w-full rounded-lg text-sm">
                    <PlusCircle className="mr-2 h-4 w-4" /> Post New Announcement
                  </Button>
                </CardFooter>
              )}
            </Card>

            {/* Section: Schedule & Timings */}
            <Card className="rounded-lg shadow-md border-border/30">
              <CardHeader>
                <CardTitle className="flex items-center text-lg"><CalendarDays className="mr-2 h-5 w-5 text-primary" />Schedule & Timings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {classroom.schedule?.length ? classroom.schedule.map((item, index) => (
                  <div key={index} className="flex justify-between py-1 border-b border-border/10 last:border-b-0">
                    <span className="text-foreground font-medium">{item.day}:</span>
                    <span className="text-muted-foreground">{item.time}</span>
                  </div>
                )) : <p className="text-muted-foreground">Schedule not available.</p>}
              </CardContent>
              {classroom.scheduleLastUpdated && (
                <CardFooter className="border-t pt-3">
                  <p className="text-xs text-muted-foreground">
                    Schedule last updated: {new Date(classroom.scheduleLastUpdated).toLocaleDateString()}
                  </p>
                </CardFooter>
              )}
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Section: Assignments */}
            <Card className="rounded-lg shadow-md border-border/30">
              <CardHeader>
                <CardTitle className="flex items-center text-lg"><ClipboardList className="mr-2 h-5 w-5 text-primary" />Assignments</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm max-h-72 overflow-y-auto">
                {classroom.assignments?.length ? classroom.assignments.slice(0, 3).map((item) => ( // Show first 3
                  <div key={item.id} className="pb-3 border-b border-border/20 last:border-b-0">
                    <div className="flex justify-between items-start">
                        <p className="font-semibold text-foreground">{item.title}</p>
                        <Badge variant="outline" className={`text-xs ml-2 ${getStatusColor(item.status)} rounded-md`}>{item.status}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">Due: {item.dueDate}</p>
                    {item.description && <p className="text-muted-foreground mt-0.5 text-xs">{item.description}</p>}
                    <Button variant="link" size="sm" className="p-0 h-auto text-accent text-xs mt-1">View Details</Button>
                  </div>
                )) : <p className="text-muted-foreground">No assignments posted yet.</p>}
              </CardContent>
               <CardFooter>
                <Button variant="outline" className="w-full rounded-lg text-sm">Check All Assignments</Button>
              </CardFooter>
            </Card>

            {/* Section: Class Materials */}
            <Card className="rounded-lg shadow-md border-border/30">
              <CardHeader>
                <CardTitle className="flex items-center text-lg"><FileIcon className="mr-2 h-5 w-5 text-primary" />Class Materials</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm max-h-72 overflow-y-auto">
                {classroom.materials?.length ? classroom.materials.map((item) => (
                  <div key={item.id} className="pb-3 border-b border-border/20 last:border-b-0">
                    <div className="flex items-center">
                        <MaterialIcon type={item.type}/>
                        <p className="font-semibold text-foreground flex-grow truncate" title={item.title}>{item.title}</p>
                    </div>
                    {item.description && <p className="text-muted-foreground mt-0.5 text-xs ml-7">{item.description}</p>}
                    <Button variant="link" size="sm" className="p-0 h-auto text-accent text-xs mt-1 ml-7">
                        {item.type === 'link' || item.type === 'video' ? 'Open Link' : 'Download File'}
                    </Button>
                  </div>
                )) : <p className="text-muted-foreground">No materials uploaded yet.</p>}
              </CardContent>
               <CardFooter>
                <Button variant="outline" className="w-full rounded-lg text-sm">Browse All Materials</Button>
              </CardFooter>
            </Card>
          </div>
          
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
          
          <div className="mt-8 text-center">
             <Button variant="default" size="lg" className="btn-gel rounded-lg py-3 px-8 text-base" onClick={handleJoinDiscussion}>
                <MessageSquare className="mr-2 h-5 w-5"/> Join Class Discussion
            </Button>
          </div>

        </CardContent>
      </Card>
    </div>
  );
}
    
