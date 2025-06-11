
'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { 
    ArrowLeft, CalendarDays, DollarSign, Users, AlertTriangle, 
    Megaphone, ClipboardList, Link as LinkIconLucide, FileText as FileIcon, Video as VideoIconLucide, MessageSquare, Info, Video, PlusCircle,
    ClipboardCheck as ExamIcon, Eye, UploadCloud, ChevronsUpDown, CreditCard, Smartphone, Banknote, Edit2, Trash2
} from 'lucide-react'; // Renamed LinkIcon to LinkIconLucide to avoid conflict with NextLink
import Link from 'next/link';
import Image from 'next/image';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth'; 
import { useToast } from '@/hooks/use-toast'; 
import { format, parseISO } from 'date-fns';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle as ShadDialogTitle, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle as ShadAlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CreateExamDialog } from '@/components/exam/CreateExamDialog';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

interface Announcement {
  id: string;
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

interface ClassExam {
  id: string;
  title: string;
  dueDate: string; 
  status: 'Upcoming' | 'Active' | 'Ended' | 'Graded';
}

interface FeeDetails {
  totalFee: number;
  paidAmount: number;
  nextDueDate?: string;
}

interface ScheduleItem {
  id: string;
  day: string;
  time: string;
  topic?: string; 
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
  schedule?: ScheduleItem[];
  scheduleLastUpdated?: string; 
  assignments?: Assignment[];
  materials?: Material[];
  exams?: ClassExam[];
  feeDetails?: FeeDetails;
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
      { id: "anno1", title: "Welcome to the Course!", content: "We're excited to start this journey together. Please familiarize yourself with the syllabus and course materials.", date: "2024-08-01" },
      { id: "anno2", title: "Reminder: Office Hours Changed", content: "Office hours for this week are moved to Thursday, 3-4 PM.", date: "2024-08-05" },
      { id: "anno3", title: "Mid-term Project Guidelines", content: "The guidelines for the mid-term project have been uploaded to the materials section.", date: "2024-08-10" },
    ],
    schedule: [
      { id: "sched_mon", day: "Monday", time: "10:00 AM - 11:30 AM", topic: "Lecture" },
      { id: "sched_wed", day: "Wednesday", time: "10:00 AM - 11:00 AM", topic: "Lab Session" },
      { id: "sched_fri", day: "Friday", time: "01:00 PM - 02:00 PM", topic: "Discussion Group" },
    ],
    scheduleLastUpdated: "2024-07-28",
    assignments: [
      { id: "assign1", title: "Introduction Essay", dueDate: "2024-08-10", status: "Graded", description: "A 500-word essay about your motivations for taking this course." },
      { id: "assign2", title: "Chapter 1 Problem Set", dueDate: "2024-08-17", status: "Pending", description: "Complete all odd-numbered problems from Chapter 1." },
      { id: "assign3", title: "Research Proposal", dueDate: "2024-08-24", status: "Pending", description: "Submit a one-page proposal for your mid-term project." },
      { id: "assign0", title: "Pre-course Survey", dueDate: "2024-07-30", status: "Overdue", description: "Complete this survey before the first class." },
    ],
    materials: [
      { id: "mat_meeting_link", title: "Join Live Class Session Now!", type: "link", url: `/dashboard/meeting/${id}/wait?topic=${encodeURIComponent(className)}`, description: "Click here to join the ongoing class meeting." },
      { id: "mat1", title: "Course Syllabus", type: "file", fileName: "syllabus_fall2024.pdf", description: "Detailed course outline, grading policy, and schedule." },
      { id: "mat2", title: "Recommended Reading List", type: "link", url: "#", description: "A list of external articles and books." },
      { id: "mat3", title: "Introductory Video Lecture", type: "video", url: "#", description: "A pre-recorded lecture covering the basics." },
      { id: "mat4", title: "Python Setup Guide", type: "file", fileName: "python_setup.md", description: "Instructions for setting up your Python environment." },
    ],
    exams: [ 
      { id: "exam_class_101", title: "Quiz 1: Basic Concepts", dueDate: format(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), "yyyy-MM-dd"), status: "Upcoming" },
      { id: "exam_class_102", title: "Mid-Term Practical", dueDate: format(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), "yyyy-MM-dd"), status: "Upcoming" },
      { id: "exam_class_100", title: "Diagnostic Test", dueDate: format(new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), "yyyy-MM-dd"), status: "Graded" },
    ],
    feeDetails: {
      totalFee: 500,
      paidAmount: 250,
      nextDueDate: "2024-09-01",
    },
  };
};

const getStatusColor = (status: Assignment['status'] | ClassExam['status']) => {
  switch (status) {
    case 'Graded': return 'bg-green-500/20 text-green-700 border-green-500/50';
    case 'Submitted': return 'bg-blue-500/20 text-blue-700 border-blue-500/50';
    case 'Pending': return 'bg-yellow-500/20 text-yellow-700 border-yellow-500/50';
    case 'Overdue': return 'bg-red-500/20 text-red-700 border-red-500/50';
    case 'Upcoming': return 'bg-blue-500/20 text-blue-700 border-blue-500/50'; 
    case 'Active': return 'bg-green-500/20 text-green-700 border-green-500/50'; 
    case 'Ended': return 'bg-gray-500/20 text-gray-700 border-gray-500/50'; 
    default: return 'bg-muted text-muted-foreground border-border';
  }
};

const MaterialIcon = ({ type }: { type: Material['type'] }) => {
  if (type === 'link') return <LinkIconLucide className="mr-2 h-5 w-5 text-primary" />;
  if (type === 'file') return <FileIcon className="mr-2 h-5 w-5 text-primary" />;
  if (type === 'video') return <VideoIconLucide className="mr-2 h-5 w-5 text-primary" />;
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
  const [isCreateExamDialogOpenForClass, setIsCreateExamDialogOpenForClass] = useState(false);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);

  const assignmentFileRef = useRef<HTMLInputElement>(null);
  const [selectedAssignmentTitleForUpload, setSelectedAssignmentTitleForUpload] = useState<string | null>(null);
  const [isAssignmentUploadDialogOpen, setIsAssignmentUploadDialogOpen] = useState(false);
  const [dialogAssignmentName, setDialogAssignmentName] = useState('');

  const [isEditingFeeDetails, setIsEditingFeeDetails] = useState(false);
  const [editableFeeDetails, setEditableFeeDetails] = useState<{
    totalFee: string;
    paidAmount: string;
    nextDueDate: string;
  } | null>(null);
  
  const [isPostAnnouncementDialogOpen, setIsPostAnnouncementDialogOpen] = useState(false);
  const [postAnnouncementTitleInput, setPostAnnouncementTitleInput] = useState('');
  const [postAnnouncementContentInput, setPostAnnouncementContentInput] = useState('');

  const [isEditAnnouncementDialogOpen, setIsEditAnnouncementDialogOpen] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState<Announcement | null>(null);
  const [editAnnouncementTitleInput, setEditAnnouncementTitleInput] = useState('');
  const [editAnnouncementContentInput, setEditAnnouncementContentInput] = useState('');

  const [isDeleteConfirmDialogOpen, setIsDeleteConfirmDialogOpen] = useState(false);
  const [announcementIdToDelete, setAnnouncementIdToDelete] = useState<string | null>(null);

  // Schedule Edit State
  const [isEditScheduleDialogOpen, setIsEditScheduleDialogOpen] = useState(false);
  const [editingScheduleItems, setEditingScheduleItems] = useState<ScheduleItem[]>([]);
  const [newScheduleDayInput, setNewScheduleDayInput] = useState('');
  const [newScheduleTimeInput, setNewScheduleTimeInput] = useState('');
  const [newScheduleTopicInput, setNewScheduleTopicInput] = useState('');


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
        if (details?.feeDetails) {
          setEditableFeeDetails({
            totalFee: String(details.feeDetails.totalFee),
            paidAmount: String(details.feeDetails.paidAmount),
            nextDueDate: details.feeDetails.nextDueDate || '',
          });
        } else {
          setEditableFeeDetails(null);
        }
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
  
  const handleDialogPostAnnouncement = () => {
    if (!postAnnouncementTitleInput.trim() || !postAnnouncementContentInput.trim()) {
      toast({ variant: "destructive", title: "Missing Information", description: "Both title and content are required for an announcement." });
      return;
    }

    const newAnnouncement: Announcement = {
      id: `anno_${Date.now()}`, 
      title: postAnnouncementTitleInput.trim(),
      content: postAnnouncementContentInput.trim(),
      date: new Date().toISOString().split('T')[0],
    };

    setClassroom(prev => {
      if (!prev) return null;
      return {
        ...prev,
        announcements: [newAnnouncement, ...(prev.announcements || [])],
      };
    });

    toast({ title: "Announcement Posted", description: `"${newAnnouncement.title}" has been posted.` });
    setIsPostAnnouncementDialogOpen(false);
    setPostAnnouncementTitleInput('');
    setPostAnnouncementContentInput('');
  };

  const handleOpenEditAnnouncementDialog = (announcement: Announcement) => {
    setEditingAnnouncement(announcement);
    setEditAnnouncementTitleInput(announcement.title);
    setEditAnnouncementContentInput(announcement.content);
    setIsEditAnnouncementDialogOpen(true);
  };

  const handleDialogUpdateAnnouncement = () => {
    if (!editingAnnouncement || !editAnnouncementTitleInput.trim() || !editAnnouncementContentInput.trim()) {
      toast({ variant: "destructive", title: "Missing Information", description: "Both title and content are required." });
      return;
    }
    setClassroom(prev => {
      if (!prev || !prev.announcements) return prev;
      const updatedAnnouncements = prev.announcements.map(anno => 
        anno.id === editingAnnouncement.id 
        ? { ...anno, title: editAnnouncementTitleInput.trim(), content: editAnnouncementContentInput.trim(), date: new Date().toISOString().split('T')[0] } 
        : anno
      );
      return { ...prev, announcements: updatedAnnouncements };
    });
    toast({ title: "Announcement Updated", description: `"${editAnnouncementTitleInput.trim()}" has been updated.` });
    setIsEditAnnouncementDialogOpen(false);
    setEditingAnnouncement(null);
  };

  const handleOpenDeleteConfirmDialog = (announcementId: string) => {
    setAnnouncementIdToDelete(announcementId);
    setIsDeleteConfirmDialogOpen(true);
  };

  const handleConfirmDeleteAnnouncement = () => {
    if (!announcementIdToDelete) return;
    setClassroom(prev => {
      if (!prev || !prev.announcements) return prev;
      return { ...prev, announcements: prev.announcements.filter(anno => anno.id !== announcementIdToDelete) };
    });
    toast({ title: "Announcement Deleted" });
    setIsDeleteConfirmDialogOpen(false);
    setAnnouncementIdToDelete(null);
  };

  const handleOpenEditScheduleDialog = () => {
    setEditingScheduleItems(classroom?.schedule ? [...classroom.schedule] : []);
    setNewScheduleDayInput('');
    setNewScheduleTimeInput('');
    setNewScheduleTopicInput('');
    setIsEditScheduleDialogOpen(true);
  };

  const handleAddScheduleItemInDialog = () => {
    if (!newScheduleDayInput.trim() || !newScheduleTimeInput.trim()) {
      toast({ variant: "destructive", title: "Missing Day/Time", description: "Please enter both day and time for the new schedule entry." });
      return;
    }
    const newItem: ScheduleItem = {
      id: `sched_${Date.now()}`,
      day: newScheduleDayInput.trim(),
      time: newScheduleTimeInput.trim(),
      topic: newScheduleTopicInput.trim() || undefined,
    };
    setEditingScheduleItems(prev => [...prev, newItem]);
    setNewScheduleDayInput('');
    setNewScheduleTimeInput('');
    setNewScheduleTopicInput('');
  };

  const handleRemoveScheduleItemInDialog = (itemId: string) => {
    setEditingScheduleItems(prev => prev.filter(item => item.id !== itemId));
  };

  const handleSaveChangesToSchedule = () => {
    setClassroom(prev => {
      if (!prev) return null;
      return {
        ...prev,
        schedule: editingScheduleItems,
        scheduleLastUpdated: format(new Date(), "yyyy-MM-dd"),
      };
    });
    toast({ title: "Schedule Updated", description: "The class schedule has been successfully updated." });
    setIsEditScheduleDialogOpen(false);
  };


  const handleUploadMaterial = () => {
    toast({
      title: "Upload Material (Mock)",
      description: "Feature to upload class materials is planned for implementation.",
      duration: 3000,
    });
  };

  const handleTriggerAssignmentUploadDialog = () => {
    if (!classroom?.assignments || classroom.assignments.length === 0) {
        toast({ variant: "info", title: "No Assignments", description: "There are no assignments listed for this class to submit against." });
        return;
    }
    setDialogAssignmentName('');
    setIsAssignmentUploadDialogOpen(true);
  };

  const handleDialogSubmitAndChooseFile = () => {
    if (!dialogAssignmentName.trim()) {
        toast({ variant: "destructive", title: "Assignment Name Required", description: "Please enter the name of the assignment you are submitting for." });
        return;
    }
    setSelectedAssignmentTitleForUpload(dialogAssignmentName.trim());
    assignmentFileRef.current?.click();
  };


  const handleFileSelectedForAssignment = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (event.target) { 
        event.target.value = ""; 
    }

    if (!file) {
        toast({ variant: "info", title: "File Selection Cancelled", description: "No file was selected for upload." });
        setSelectedAssignmentTitleForUpload(null);
        setIsAssignmentUploadDialogOpen(false); 
        return;
    }

    if (file.type !== "text/plain") {
        toast({ variant: "destructive", title: "Invalid File Type", description: "Please upload a .txt file for this mock submission." });
        return;
    }
    
    if (!selectedAssignmentTitleForUpload) {
        console.error("No assignment title was selected prior to file upload. This shouldn't happen if dialog logic is correct.");
        toast({ variant: "destructive", title: "Internal Error", description: "Assignment title was missing. Please try again." });
        setIsAssignmentUploadDialogOpen(false);
        return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
        const studentAssignmentText = e.target?.result as string;

        if (!studentAssignmentText || !studentAssignmentText.trim()) {
            toast({ variant: "destructive", title: "Empty File", description: "The selected file is empty or could not be read." });
            setSelectedAssignmentTitleForUpload(null);
            setIsAssignmentUploadDialogOpen(false);
            return;
        }
        
        toast({ title: "Uploading Assignment...", description: `Simulating upload for "${selectedAssignmentTitleForUpload}".` });
        setIsAssignmentUploadDialogOpen(false); 

        await new Promise(resolve => setTimeout(resolve, 1500));
        
        toast({
            title: "Assignment Uploaded (Mock)",
            description: `"${selectedAssignmentTitleForUpload}" has been uploaded. File content: ${studentAssignmentText.substring(0,50)}...`,
            duration: 5000, 
        });

        setSelectedAssignmentTitleForUpload(null);
    };
    reader.onerror = () => {
        toast({ variant: "destructive", title: "File Read Error", description: "Could not read the selected file." });
        setSelectedAssignmentTitleForUpload(null);
        setIsAssignmentUploadDialogOpen(false);
    };
    reader.readAsText(file);
  };
  
  const handleMockPayment = (method: string) => {
    toast({
      title: `Processing with ${method} (Mock)`,
      description: "Payment integration is a planned feature. No actual transaction will occur.",
      duration: 4000,
    });
    setIsPaymentDialogOpen(false);
  };

  const handleExamCreated = (newExam: any) => { 
    console.log("New exam created via dialog on class page:", newExam);
     toast({
      title: "Exam Scheduled (Class Context)",
      description: `${newExam.title} has been scheduled for this class.`
    });
  };

  const handleToggleEditFeeDetails = () => {
    if (isEditingFeeDetails) { 
      if (classroom?.feeDetails) {
        setEditableFeeDetails({
          totalFee: String(classroom.feeDetails.totalFee),
          paidAmount: String(classroom.feeDetails.paidAmount),
          nextDueDate: classroom.feeDetails.nextDueDate || '',
        });
      }
    }
    setIsEditingFeeDetails(!isEditingFeeDetails);
  };

  const handleSaveFeeDetails = () => {
    if (!editableFeeDetails || !classroom) return;

    const newTotalFee = parseFloat(editableFeeDetails.totalFee);
    const newPaidAmount = parseFloat(editableFeeDetails.paidAmount);

    if (isNaN(newTotalFee) || newTotalFee < 0 || isNaN(newPaidAmount) || newPaidAmount < 0) {
      toast({ variant: "destructive", title: "Invalid Input", description: "Fee amounts must be valid numbers." });
      return;
    }
    if (newPaidAmount > newTotalFee) {
      toast({ variant: "destructive", title: "Invalid Input", description: "Paid amount cannot exceed total fee." });
      return;
    }

    const newFeeDetails: FeeDetails = {
      totalFee: newTotalFee,
      paidAmount: newPaidAmount,
      nextDueDate: editableFeeDetails.nextDueDate.trim() ? editableFeeDetails.nextDueDate.trim() : undefined,
    };

    setClassroom(prev => prev ? { ...prev, feeDetails: newFeeDetails } : null);
    toast({ title: "Fee Details Updated (Mock)", description: "Class fee information has been saved locally." });
    setIsEditingFeeDetails(false);
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
              {[...Array(6)].map((_, i) => (
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
  
  const currentRemainingFee = editableFeeDetails
    ? parseFloat(editableFeeDetails.totalFee || '0') - parseFloat(editableFeeDetails.paidAmount || '0')
    : classroom?.feeDetails
    ? classroom.feeDetails.totalFee - classroom.feeDetails.paidAmount
    : 0;


  return (
    <div className="space-y-8 p-4 md:p-8">
      <input type="file" ref={assignmentFileRef} onChange={handleFileSelectedForAssignment} accept=".txt" style={{ display: 'none' }} />
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
            <Card className="rounded-lg shadow-md border-border/30">
              <CardHeader>
                <CardTitle className="flex items-center text-lg"><Megaphone className="mr-2 h-5 w-5 text-primary" />Announcements</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm max-h-72 overflow-y-auto">
                {classroom.announcements?.length ? classroom.announcements.map((item) => (
                  <div key={item.id} className="pb-3 border-b border-border/20 last:border-b-0 group">
                    <div className="flex justify-between items-start">
                        <p className="font-semibold text-foreground flex-grow">{item.title} <span className="text-xs text-muted-foreground">({format(parseISO(item.date), "MMM d, yyyy")})</span></p>
                        {isCurrentUserTeacher && (
                            <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button variant="ghost" size="icon" className="h-7 w-7 rounded-md" onClick={() => handleOpenEditAnnouncementDialog(item)}>
                                    <Edit2 className="h-4 w-4 text-blue-500" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-7 w-7 rounded-md" onClick={() => handleOpenDeleteConfirmDialog(item.id)}>
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                            </div>
                        )}
                    </div>
                    <p className="text-muted-foreground mt-0.5">{item.content}</p>
                  </div>
                )) : <p className="text-muted-foreground">No announcements posted yet.</p>}
              </CardContent>
              {isCurrentUserTeacher && (
                <CardFooter>
                  <Dialog open={isPostAnnouncementDialogOpen} onOpenChange={(isOpen) => {
                      if (!isOpen) { 
                          setPostAnnouncementTitleInput('');
                          setPostAnnouncementContentInput('');
                      }
                      setIsPostAnnouncementDialogOpen(isOpen);
                  }}>
                    <DialogTrigger asChild>
                      <Button variant="outline" className="w-full rounded-lg text-sm">
                        <PlusCircle className="mr-2 h-4 w-4" /> Post New Announcement
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-lg rounded-xl">
                      <DialogHeader>
                        <ShadDialogTitle>Create New Announcement</ShadDialogTitle>
                        <DialogDescription>
                          Share important updates with your class.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                          <Label htmlFor="postAnnouncementTitle">Title</Label>
                          <Input
                            id="postAnnouncementTitle"
                            value={postAnnouncementTitleInput}
                            onChange={(e) => setPostAnnouncementTitleInput(e.target.value)}
                            placeholder="e.g., Upcoming Test"
                            className="rounded-lg"
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="postAnnouncementContent">Content</Label>
                          <Textarea
                            id="postAnnouncementContent"
                            value={postAnnouncementContentInput}
                            onChange={(e) => setPostAnnouncementContentInput(e.target.value)}
                            placeholder="Enter the details of your announcement here..."
                            className="rounded-lg min-h-[100px]"
                          />
                        </div>
                      </div>
                      <DialogFooter>
                        <DialogClose asChild>
                          <Button type="button" variant="outline" className="rounded-lg">
                            Cancel
                          </Button>
                        </DialogClose>
                        <Button type="button" onClick={handleDialogPostAnnouncement} className="btn-gel rounded-lg">
                          Post Announcement
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </CardFooter>
              )}
            </Card>

            <Card className="rounded-lg shadow-md border-border/30">
              <CardHeader>
                <CardTitle className="flex items-center text-lg"><CalendarDays className="mr-2 h-5 w-5 text-primary" />Schedule &amp; Timings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {classroom.schedule?.length ? classroom.schedule.map((item) => (
                  <div key={item.id} className="flex justify-between py-1 border-b border-border/10 last:border-b-0">
                    <span className="text-foreground font-medium">{item.day}:</span>
                    <span className="text-muted-foreground">{item.time}{item.topic ? ` (${item.topic})` : ''}</span>
                  </div>
                )) : <p className="text-muted-foreground">Schedule not available.</p>}
                {isCurrentUserTeacher && (
                    <div className="mt-4">
                        <Button variant="outline" className="w-full rounded-lg text-sm" onClick={handleOpenEditScheduleDialog}>
                            <Edit2 className="mr-2 h-4 w-4" /> Edit Schedule
                        </Button>
                    </div>
                )}
              </CardContent>
              {classroom.scheduleLastUpdated && (
                <CardFooter className="border-t pt-3">
                  <p className="text-xs text-muted-foreground">
                    Schedule last updated: {format(parseISO(classroom.scheduleLastUpdated), "PP")}
                  </p>
                </CardFooter>
              )}
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="rounded-lg shadow-md border-border/30">
              <CardHeader>
                <CardTitle className="flex items-center text-lg"><ClipboardList className="mr-2 h-5 w-5 text-primary" />Assignments</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm max-h-72 overflow-y-auto">
                {classroom.assignments?.length ? classroom.assignments.slice(0, 3).map((item) => ( 
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
               <CardFooter className="flex flex-col sm:flex-row gap-2">
                <Button asChild variant="outline" className="w-full rounded-lg text-sm">
                   <Link href={`/dashboard/class/${classId}/assignments?name=${encodeURIComponent(classroom.name)}`}>
                    Check All Assignments
                  </Link>
                </Button>
                <Dialog open={isAssignmentUploadDialogOpen} onOpenChange={setIsAssignmentUploadDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="default" className="w-full rounded-lg text-sm btn-gel" onClick={handleTriggerAssignmentUploadDialog}>
                        <UploadCloud className="mr-2 h-4 w-4" /> Upload Assignment
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-md rounded-xl">
                    <DialogHeader>
                      <ShadDialogTitle>Submit Assignment</ShadDialogTitle>
                      <DialogDescription>
                        Enter the assignment name and upload your .txt file.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      <div className="grid gap-2">
                        <Label htmlFor="dialogAssignmentName">Assignment Name (you are submitting for)</Label>
                        <Input
                          id="dialogAssignmentName"
                          value={dialogAssignmentName}
                          onChange={(e) => setDialogAssignmentName(e.target.value)}
                          placeholder="e.g., Introduction Essay"
                          className="rounded-lg"
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <DialogClose asChild>
                        <Button type="button" variant="outline" className="rounded-lg">
                          Cancel
                        </Button>
                      </DialogClose>
                      <Button type="button" onClick={handleDialogSubmitAndChooseFile} className="btn-gel rounded-lg">
                        Choose File &amp; Submit
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </CardFooter>
            </Card>

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
                    <Button asChild variant="link" size="sm" className="p-0 h-auto text-accent text-xs mt-1 ml-7">
                        {item.url ? (
                          <Link href={item.url} target={item.url.startsWith('/') ? '_self' : '_blank'} rel="noopener noreferrer">
                            {item.type === 'link' || item.type === 'video' ? 'Open Link' : 'Download File'}
                          </Link>
                        ) : (
                           <span>{item.type === 'link' || item.type === 'video' ? 'Open Link' : 'Download File'}</span>
                        )}
                    </Button>
                  </div>
                )) : <p className="text-muted-foreground">No materials uploaded yet.</p>}
              </CardContent>
               <CardFooter className="flex flex-col sm:flex-row gap-2">
                <Button onClick={handleUploadMaterial} variant="outline" className="w-full rounded-lg text-sm">
                    <UploadCloud className="mr-2 h-4 w-4" /> Upload New Material (Mock)
                </Button>
                <Button variant="outline" className="w-full rounded-lg text-sm">Browse All Materials</Button>
              </CardFooter>
            </Card>
          </div>
          
          <Card className="rounded-lg shadow-md border-border/30">
            <CardHeader>
              <CardTitle className="flex items-center text-lg"><ExamIcon className="mr-2 h-5 w-5 text-primary" />Exams</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm max-h-72 overflow-y-auto">
              {classroom.exams?.length ? classroom.exams.slice(0, 3).map((exam) => (
                <div key={exam.id} className="pb-3 border-b border-border/20 last:border-b-0">
                  <div className="flex justify-between items-start">
                    <p className="font-semibold text-foreground">{exam.title}</p>
                    <Badge variant="outline" className={`text-xs ml-2 ${getStatusColor(exam.status)} rounded-md`}>{exam.status}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">Due: {format(new Date(exam.dueDate), "PP")}</p>
                  <Button asChild variant="link" size="sm" className="p-0 h-auto text-accent text-xs mt-1">
                    <Link href={`/dashboard/exam/${exam.id}?title=${encodeURIComponent(exam.title)}`}>View Exam</Link>
                  </Button>
                </div>
              )) : <p className="text-muted-foreground">No exams scheduled for this class yet.</p>}
            </CardContent>
            <CardFooter className="flex flex-col sm:flex-row gap-2">
              {isCurrentUserTeacher && (
                 <Dialog open={isCreateExamDialogOpenForClass} onOpenChange={setIsCreateExamDialogOpenForClass}>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="w-full rounded-lg text-sm">
                      <PlusCircle className="mr-2 h-4 w-4" /> Create New Exam for this Class
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-lg rounded-xl">
                    <CreateExamDialog 
                      isOpen={isCreateExamDialogOpenForClass} 
                      onOpenChange={setIsCreateExamDialogOpenForClass}
                      onExamCreated={handleExamCreated}
                      classContext={classroom ? { classId: classroom.id, className: classroom.name } : undefined}
                    />
                  </DialogContent>
                </Dialog>
              )}
              <Button asChild variant="outline" className="w-full rounded-lg text-sm">
                 <Link href={`/dashboard/exams?classId=${classId}`}> 
                    <Eye className="mr-2 h-4 w-4" /> View All Exams for this Class
                 </Link>
              </Button>
            </CardFooter>
          </Card>

          <Card className="rounded-lg shadow-md border-border/30">
            <CardHeader>
              <CardTitle className="flex items-center text-lg"><DollarSign className="mr-2 h-5 w-5 text-primary" />Fees &amp; Payment</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {!classroom.feeDetails && !isEditingFeeDetails ? (
                <p className="text-muted-foreground">Fee details not available.</p>
              ) : isCurrentUserTeacher && isEditingFeeDetails && editableFeeDetails ? (
                <>
                  <div className="space-y-1">
                    <Label htmlFor="totalFee" className="text-xs">Total Fee ($)</Label>
                    <Input
                      id="totalFee"
                      type="number"
                      value={editableFeeDetails.totalFee}
                      onChange={(e) => setEditableFeeDetails(prev => prev ? { ...prev, totalFee: e.target.value } : null)}
                      className="rounded-lg h-9 text-sm"
                      placeholder="e.g., 500"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="paidAmount" className="text-xs">Amount Paid ($)</Label>
                    <Input
                      id="paidAmount"
                      type="number"
                      value={editableFeeDetails.paidAmount}
                      onChange={(e) => setEditableFeeDetails(prev => prev ? { ...prev, paidAmount: e.target.value } : null)}
                      className="rounded-lg h-9 text-sm"
                      placeholder="e.g., 250"
                    />
                  </div>
                   <p>Remaining: <span className="font-semibold text-destructive">${isNaN(currentRemainingFee) ? 'N/A' : currentRemainingFee.toFixed(2)}</span></p>
                  <div className="space-y-1">
                    <Label htmlFor="nextDueDate" className="text-xs">Next Payment Due</Label>
                    <Input
                      id="nextDueDate"
                      type="date"
                      value={editableFeeDetails.nextDueDate}
                      onChange={(e) => setEditableFeeDetails(prev => prev ? { ...prev, nextDueDate: e.target.value } : null)}
                      className="rounded-lg h-9 text-sm"
                    />
                  </div>
                </>
              ) : classroom.feeDetails ? (
                <>
                  <p>Total Fee: <span className="font-semibold text-foreground">${classroom.feeDetails.totalFee.toFixed(2)}</span></p>
                  <p>Amount Paid: <span className="font-semibold text-green-600">${classroom.feeDetails.paidAmount.toFixed(2)}</span></p>
                  <p>Remaining: <span className="font-semibold text-destructive">${(classroom.feeDetails.totalFee - classroom.feeDetails.paidAmount).toFixed(2)}</span></p>
                  {classroom.feeDetails.nextDueDate && (
                    <p>Next Payment Due: {format(parseISO(classroom.feeDetails.nextDueDate), "PP")}</p>
                  )}
                </>
              ) : (
                 <p className="text-muted-foreground">Fee details not set up yet.</p>
              )}
            </CardContent>
            <CardFooter className="flex flex-col sm:flex-row gap-2">
              {isCurrentUserTeacher && (
                isEditingFeeDetails ? (
                  <>
                    <Button onClick={handleSaveFeeDetails} className="w-full btn-gel rounded-lg text-sm">Save Details</Button>
                    <Button onClick={handleToggleEditFeeDetails} variant="outline" className="w-full rounded-lg text-sm">Cancel</Button>
                  </>
                ) : (
                  <Button onClick={handleToggleEditFeeDetails} variant="outline" className="w-full rounded-lg text-sm">
                    <Edit2 className="mr-2 h-4 w-4" /> Edit Fee Details
                  </Button>
                )
              )}
              {!isEditingFeeDetails && (
                <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
                  <DialogTrigger asChild>
                    <Button 
                      className="w-full btn-gel rounded-lg text-sm" 
                      disabled={!classroom.feeDetails || currentRemainingFee <= 0}
                    >
                      {classroom.feeDetails && currentRemainingFee <= 0 ? "Fully Paid" : "Make Payment"}
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-md rounded-xl">
                    <DialogHeader>
                      <ShadDialogTitle>Choose Payment Method</ShadDialogTitle>
                      <DialogDescription>
                        Select your preferred payment option. (Mock Interface)
                      </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-3 py-4">
                      <Button variant="outline" className="rounded-lg justify-start py-3 text-base" onClick={() => handleMockPayment("Google Pay / UPI")}>
                        <Smartphone className="mr-3 h-5 w-5 text-blue-500" /> Google Pay / UPI
                      </Button>
                      <Button variant="outline" className="rounded-lg justify-start py-3 text-base" onClick={() => handleMockPayment("PhonePe")}>
                        <Smartphone className="mr-3 h-5 w-5 text-purple-600" /> PhonePe
                      </Button>
                       <Button variant="outline" className="rounded-lg justify-start py-3 text-base" onClick={() => handleMockPayment("Net Banking")}>
                        <Banknote className="mr-3 h-5 w-5 text-green-600" /> Net Banking
                      </Button>
                      <Button variant="outline" className="rounded-lg justify-start py-3 text-base" onClick={() => handleMockPayment("Credit/Debit Card")}>
                        <CreditCard className="mr-3 h-5 w-5 text-orange-500" /> Credit/Debit Card
                      </Button>
                    </div>
                    <DialogFooter>
                      <DialogClose asChild>
                        <Button type="button" variant="outline" className="rounded-lg">
                          Cancel
                        </Button>
                      </DialogClose>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              )}
            </CardFooter>
          </Card>
          
          <div className="mt-8 text-center">
             <Button variant="default" size="lg" className="btn-gel rounded-lg py-3 px-8 text-base" onClick={handleJoinDiscussion}>
                <MessageSquare className="mr-2 h-5 w-5"/> Join Class Discussion
            </Button>
          </div>

        </CardContent>
      </Card>

      {/* Edit Announcement Dialog */}
      <Dialog open={isEditAnnouncementDialogOpen} onOpenChange={(isOpen) => {
          if (!isOpen) setEditingAnnouncement(null); 
          setIsEditAnnouncementDialogOpen(isOpen);
      }}>
        <DialogContent className="sm:max-w-lg rounded-xl">
          <DialogHeader>
            <ShadDialogTitle>Edit Announcement</ShadDialogTitle>
            <DialogDescription>
              Modify the title and content of your announcement.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="editAnnouncementTitle">Title</Label>
              <Input
                id="editAnnouncementTitle"
                value={editAnnouncementTitleInput}
                onChange={(e) => setEditAnnouncementTitleInput(e.target.value)}
                className="rounded-lg"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="editAnnouncementContent">Content</Label>
              <Textarea
                id="editAnnouncementContent"
                value={editAnnouncementContentInput}
                onChange={(e) => setEditAnnouncementContentInput(e.target.value)}
                className="rounded-lg min-h-[100px]"
              />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" className="rounded-lg">
                Cancel
              </Button>
            </DialogClose>
            <Button type="button" onClick={handleDialogUpdateAnnouncement} className="btn-gel rounded-lg">
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Announcement Confirmation Dialog */}
      <AlertDialog open={isDeleteConfirmDialogOpen} onOpenChange={setIsDeleteConfirmDialogOpen}>
        <AlertDialogContent className="rounded-xl">
          <AlertDialogHeader>
            <ShadAlertDialogTitle>Confirm Deletion</ShadAlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this announcement? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-lg" onClick={() => setAnnouncementIdToDelete(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDeleteAnnouncement} className={cn(buttonVariants({ variant: "destructive", className: "rounded-lg" }))}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Schedule Dialog */}
      <Dialog open={isEditScheduleDialogOpen} onOpenChange={setIsEditScheduleDialogOpen}>
        <DialogContent className="sm:max-w-lg rounded-xl">
          <DialogHeader>
            <ShadDialogTitle>Edit Class Schedule</ShadDialogTitle>
            <DialogDescription>
              Add, remove, or modify schedule entries for this class.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto">
            {editingScheduleItems.length > 0 ? (
              editingScheduleItems.map((item, index) => (
                <div key={item.id || index} className="flex items-center justify-between gap-2 p-2 border rounded-lg">
                  <div className="flex-grow">
                    <p className="text-sm font-medium">{item.day} - {item.time}</p>
                    {item.topic && <p className="text-xs text-muted-foreground">{item.topic}</p>}
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => handleRemoveScheduleItemInDialog(item.id)} className="text-destructive h-8 w-8 rounded-md">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">No schedule entries yet.</p>
            )}
            <div className="pt-4 border-t">
              <Label className="text-sm font-medium block mb-2">Add New Entry</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input
                  value={newScheduleDayInput}
                  onChange={(e) => setNewScheduleDayInput(e.target.value)}
                  placeholder="Day (e.g., Monday)"
                  className="rounded-lg"
                />
                <Input
                  value={newScheduleTimeInput}
                  onChange={(e) => setNewScheduleTimeInput(e.target.value)}
                  placeholder="Time (e.g., 2 PM - 3 PM)"
                  className="rounded-lg"
                />
              </div>
              <Input
                  value={newScheduleTopicInput}
                  onChange={(e) => setNewScheduleTopicInput(e.target.value)}
                  placeholder="Topic (e.g., Lecture, Lab)"
                  className="rounded-lg mt-3"
              />
              <Button onClick={handleAddScheduleItemInDialog} className="w-full mt-3 btn-gel rounded-lg text-sm">
                <PlusCircle className="mr-2 h-4 w-4" /> Add Schedule Entry
              </Button>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" className="rounded-lg">
                Cancel
              </Button>
            </DialogClose>
            <Button type="button" onClick={handleSaveChangesToSchedule} className="btn-gel rounded-lg">
              Save Schedule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

    