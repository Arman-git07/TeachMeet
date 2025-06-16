
'use client';

import { useEffect, useState, useRef, use } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import {
    ArrowLeft, CalendarDays, DollarSign, Users, AlertTriangle,
    Megaphone, ClipboardList, Link as LinkIconLucide, FileText as FileIcon, Video as VideoIconLucide, MessageSquare, Info, Video, PlusCircle,
    ClipboardCheck as ExamIcon, Eye, UploadCloud, ChevronsUpDown, CreditCard, Smartphone, Banknote, Edit2, Trash2, Link2, FileUp, Building, Hash, Landmark as LandmarkIcon, Undo2
} from 'lucide-react';
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
import CreateExamDialog from '@/components/exam/CreateExamDialog';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';


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
  currency: string;
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
  teacherUpiId?: string;
  teacherBankAccount?: string;
  teacherBankIfsc?: string;
  teacherBankName?: string;
}

const getMockClassroomDetails = (id: string, nameQueryParam?: string | null): ClassroomDetails | null => {
  if (!id) return null;
  const className = nameQueryParam || `Class ${id}`;
  let baseTeacherId = `teacher_mock_uid_for_${id}`;
  let mockTeacherPaymentDetails: Partial<ClassroomDetails> = {};

  if (id === "cl1") {
    baseTeacherId = "dr_ada_lovelace_uid";
    mockTeacherPaymentDetails = {
      teacherUpiId: "teacher-cl1@exampleupi",
      teacherBankAccount: "123456789012",
      teacherBankIfsc: "EXMPL0001234",
      teacherBankName: "Example Bank of TeachMeet"
    };
  }


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
      currency: "USD",
    },
    ...mockTeacherPaymentDetails,
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
    currency: string;
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

  const [isEditScheduleDialogOpen, setIsEditScheduleDialogOpen] = useState(false);
  const [editingScheduleItems, setEditingScheduleItems] = useState<ScheduleItem[]>([]);
  const [newScheduleDayInput, setNewScheduleDayInput] = useState('');
  const [newScheduleTimeInput, setNewScheduleTimeInput] = useState('');
  const [newScheduleTopicInput, setNewScheduleTopicInput] = useState('');

  const [isUploadMaterialDialogOpen, setIsUploadMaterialDialogOpen] = useState(false);
  const [newMaterialTitle, setNewMaterialTitle] = useState('');
  const [newMaterialDescription, setNewMaterialDescription] = useState('');
  const [newMaterialType, setNewMaterialType] = useState<'link' | 'file'>('link');
  const [newMaterialUrl, setNewMaterialUrl] = useState('');
  const [newMaterialFile, setNewMaterialFile] = useState<File | null>(null);
  const materialFileRef = useRef<HTMLInputElement>(null);
  const [isUploadingMaterial, setIsUploadingMaterial] = useState(false);

  const [isCardPaymentDialogOpen, setIsCardPaymentDialogOpen] = useState(false);
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [cardName, setCardName] = useState('');

  const [isEditingTeacherPaymentDetails, setIsEditingTeacherPaymentDetails] = useState(false);
  const [teacherUpiIdInput, setTeacherUpiIdInput] = useState('');
  const [teacherBankAccountInput, setTeacherBankAccountInput] = useState('');
  const [teacherBankIfscInput, setTeacherBankIfscInput] = useState('');
  const [teacherBankNameInput, setTeacherBankNameInput] = useState('');

  const [isRefundDialogOpen, setIsRefundDialogOpen] = useState(false);
  const [refundAmountInput, setRefundAmountInput] = useState('');

  const getCurrencySymbol = (currencyCode?: string): string => {
    if (!currencyCode) return '$';
    switch (currencyCode.toUpperCase()) {
      case 'USD': return '$';
      case 'EUR': return '€';
      case 'INR': return '₹';
      case 'GBP': return '£';
      case 'CAD': return 'CA$';
      case 'AUD': return 'A$';
      case 'JPY': return '¥';
      case 'CNY': return 'CN¥';
      case 'CHF': return 'CHF';
      case 'RUB': return '₽';
      case 'BRL': return 'R$';
      case 'ZAR': return 'R';
      case 'AED': return 'د.إ';
      case 'SGD': return 'S$';
      default: return currencyCode + ' ';
    }
  };


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
            if (details.teacherUpiId) setTeacherUpiIdInput(details.teacherUpiId);
            if (details.teacherBankAccount) setTeacherBankAccountInput(details.teacherBankAccount);
            if (details.teacherBankIfsc) setTeacherBankIfscInput(details.teacherBankIfsc);
            if (details.teacherBankName) setTeacherBankNameInput(details.teacherBankName);
          }
        }
        setClassroom(details);
        if (details?.feeDetails) {
          setEditableFeeDetails({
            totalFee: String(details.feeDetails.totalFee),
            paidAmount: String(details.feeDetails.paidAmount),
            nextDueDate: details.feeDetails.nextDueDate || '',
            currency: details.feeDetails.currency || 'USD',
          });
        } else {
          setEditableFeeDetails({
            totalFee: '0',
            paidAmount: '0',
            nextDueDate: '',
            currency: 'USD',
          });
        }
        if (!(details?.id === 'cl1' && user?.uid === details.teacherId)) {
            if (details?.teacherUpiId) setTeacherUpiIdInput(details.teacherUpiId);
            if (details?.teacherBankAccount) setTeacherBankAccountInput(details.teacherBankAccount);
            if (details?.teacherBankIfsc) setTeacherBankIfscInput(details.teacherBankIfsc);
            if (details?.teacherBankName) setTeacherBankNameInput(details.teacherBankName);
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
    setClassroom(prev => prev ? { ...prev, announcements: [newAnnouncement, ...(prev.announcements || [])] } : null);
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
    setClassroom(prev => prev ? { ...prev, announcements: prev.announcements?.filter(anno => anno.id !== announcementIdToDelete) } : null);
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
    setClassroom(prev => prev ? { ...prev, schedule: editingScheduleItems, scheduleLastUpdated: format(new Date(), "yyyy-MM-dd") } : null);
    toast({ title: "Schedule Updated", description: "The class schedule has been successfully updated." });
    setIsEditScheduleDialogOpen(false);
  };

  const handleMaterialFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) setNewMaterialFile(file); else setNewMaterialFile(null);
  };

  const resetUploadMaterialDialog = () => {
    setNewMaterialTitle(''); setNewMaterialDescription(''); setNewMaterialType('link'); setNewMaterialUrl(''); setNewMaterialFile(null);
    if (materialFileRef.current) materialFileRef.current.value = '';
    setIsUploadingMaterial(false);
  };

  const handleAddMaterial = async () => {
    if (!newMaterialTitle.trim()) { toast({ variant: 'destructive', title: 'Missing Title', description: 'Please provide a title for the material.' }); return; }
    if (newMaterialType === 'link' && !newMaterialUrl.trim()) { toast({ variant: 'destructive', title: 'Missing URL', description: 'Please provide a URL for the link material.' }); return; }
    if (newMaterialType === 'file' && !newMaterialFile) { toast({ variant: 'destructive', title: 'No File Selected', description: 'Please select a file to upload.' }); return; }
    setIsUploadingMaterial(true);
    let newMaterial: Material;
    if (newMaterialType === 'file' && newMaterialFile) {
      await new Promise(resolve => setTimeout(resolve, 1500));
      newMaterial = { id: `mat_${Date.now()}`, title: newMaterialTitle.trim(), description: newMaterialDescription.trim() || undefined, type: 'file', fileName: newMaterialFile.name };
      toast({ title: "File Material Added (Mock)", description: `"${newMaterial.title}" has been added.` });
    } else if (newMaterialType === 'link') {
      newMaterial = { id: `mat_${Date.now()}`, title: newMaterialTitle.trim(), description: newMaterialDescription.trim() || undefined, type: 'link', url: newMaterialUrl.trim() };
      toast({ title: "Link Material Added", description: `"${newMaterial.title}" has been added.` });
    } else { setIsUploadingMaterial(false); return; }
    setClassroom(prev => prev ? { ...prev, materials: [...(prev.materials || []), newMaterial] } : null);
    setIsUploadMaterialDialogOpen(false); resetUploadMaterialDialog();
  };

  const handleTriggerAssignmentUploadDialog = () => { setDialogAssignmentName(''); setIsAssignmentUploadDialogOpen(true); };

  const handleDialogSubmitAndChooseFile = () => {
    if (!dialogAssignmentName.trim()) { toast({ variant: "destructive", title: "Assignment Title Required", description: "Please enter a title for the assignment materials you are uploading." }); return; }
    setSelectedAssignmentTitleForUpload(dialogAssignmentName.trim()); assignmentFileRef.current?.click();
  };

  const handleFileSelectedForAssignment = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; if (event.target) event.target.value = "";
    if (!file) { toast({ variant: "info", title: "File Selection Cancelled", description: "No file was selected for upload." }); setSelectedAssignmentTitleForUpload(null); setIsAssignmentUploadDialogOpen(false); return; }
    if (!selectedAssignmentTitleForUpload) { console.error("No assignment title selected."); toast({ variant: "destructive", title: "Internal Error", description: "Assignment title missing." }); setIsAssignmentUploadDialogOpen(false); return; }
    toast({ title: "Uploading Assignment Materials...", description: `Simulating upload for "${selectedAssignmentTitleForUpload}".` }); setIsAssignmentUploadDialogOpen(false);
    await new Promise(resolve => setTimeout(resolve, 1500));
    const newAssignmentEntry: Assignment = { id: `assign_teacher_${Date.now()}`, title: selectedAssignmentTitleForUpload, dueDate: format(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'), status: "Pending", description: `Materials for "${selectedAssignmentTitleForUpload}". File: ${file.name}` };
    setClassroom(prev => prev ? { ...prev, assignments: [newAssignmentEntry, ...(prev.assignments || [])] } : null);
    toast({ title: "Assignment Materials Uploaded (Mock)", description: `"${selectedAssignmentTitleForUpload}" (file: ${file.name}) added.`, duration: 5000 });
    setSelectedAssignmentTitleForUpload(null); setDialogAssignmentName('');
  };

  const makePaymentToast = (method: string, remainingFee: number, classroomName: string, currency: string) => {
    const developerCut = remainingFee * 0.02;
    const teacherReceives = remainingFee - developerCut;
    const currencySymbol = getCurrencySymbol(currency);
    return {
      title: `Processing with ${method} (Mock)`,
      description: `Your mock payment of ${currencySymbol}${remainingFee.toFixed(2)} for ${classroomName} is being processed. ${currencySymbol}${teacherReceives.toFixed(2)} (conceptual) to teacher, ${currencySymbol}${developerCut.toFixed(2)} to developer (UPI: 07arman2004-1@oksbi).`,
      duration: 8000,
    };
  };

  const handleCardPaymentSubmit = () => {
    if (!cardNumber || !cardExpiry || !cardCvv || !cardName) { toast({ variant: "destructive", title: "Missing Card Information", description: "Please fill in all card details." }); return; }
    let amountForTheCurrentPayment = 0;
    const currentCurrency = classroom?.feeDetails?.currency || 'USD';
    if (classroom?.feeDetails) {
        const total = editableFeeDetails ? parseFloat(editableFeeDetails.totalFee || '0') : classroom.feeDetails.totalFee;
        const paid = editableFeeDetails ? parseFloat(editableFeeDetails.paidAmount || '0') : classroom.feeDetails.paidAmount;
        amountForTheCurrentPayment = total - paid; if (amountForTheCurrentPayment < 0) amountForTheCurrentPayment = 0;
    }
    const currencySymbol = getCurrencySymbol(currentCurrency);
    const successToastMessage = `Mock card payment of ${currencySymbol}${amountForTheCurrentPayment.toFixed(2)} for ${classroom?.name || 'the class'} processed. The class fee is now considered fully paid. ${currencySymbol}${(amountForTheCurrentPayment * 0.98).toFixed(2)} (conceptual) to teacher, ${currencySymbol}${(amountForTheCurrentPayment * 0.02).toFixed(2)} to developer (UPI: 07arman2004-1@oksbi).`;
    setTimeout(() => {
      if (classroom?.feeDetails && editableFeeDetails) {
        const newPaidAmount = parseFloat(editableFeeDetails.totalFee);
        const newFeeDetailsData: FeeDetails = { ...classroom.feeDetails, paidAmount: newPaidAmount, currency: editableFeeDetails.currency };
        setClassroom(prev => prev ? { ...prev, feeDetails: newFeeDetailsData } : null);
        setEditableFeeDetails(prev => prev ? { ...prev, paidAmount: String(newPaidAmount) } : null);
        toast({ title: "Card Payment Successful (Mock)", description: successToastMessage, duration: 10000 });
      } else { toast({ title: "Card Payment Processed (Mock)", description: `Mock card payment for ${classroom?.name} completed.` }); }
      setIsCardPaymentDialogOpen(false); setCardNumber(''); setCardExpiry(''); setCardCvv(''); setCardName('');
    }, 1500);
  };

  const handleMockPayment = (method: string) => {
    if (!classroom || !classroom.feeDetails) { toast({ variant: "destructive", title: "Error", description: "Fee details missing." }); setIsPaymentDialogOpen(false); return; }
    const currentCurrency = classroom.feeDetails.currency || 'USD';
    const remainingFee = editableFeeDetails ? parseFloat(editableFeeDetails.totalFee || '0') - parseFloat(editableFeeDetails.paidAmount || '0') : classroom.feeDetails.totalFee - classroom.feeDetails.paidAmount;
    if (remainingFee <= 0) { toast({ title: "No Payment Due", description: "This class fee is already fully paid." }); setIsPaymentDialogOpen(false); return; }

    if (method === "Google Pay / UPI") {
      const mockVpa = classroom.teacherUpiId || "teachmeet-default-teacher@exampleupi"; const payeeName = classroom.teacherName || "TeachMeet Teacher";
      const transactionNote = `Class Fee for ${classroom.name}`; const upiUrl = `upi://pay?pa=${encodeURIComponent(mockVpa)}&pn=${encodeURIComponent(payeeName)}&am=${(remainingFee * 0.98).toFixed(2)}&cu=${currentCurrency}&tn=${encodeURIComponent(transactionNote)}`;
      toast(makePaymentToast(method, remainingFee, classroom.name, currentCurrency)); window.open(upiUrl, '_blank'); setIsPaymentDialogOpen(false);
    } else if (method === "PhonePe") {
        const mockPhonePeVpa = classroom.teacherUpiId || "teachmeet-default-teacher-phonepe@exampleybl"; const payeeName = classroom.teacherName || "TeachMeet Teacher";
        const transactionNote = `Class Fee for ${classroom.name}`; const phonePeUpiUrl = `phonepe://pay?pa=${encodeURIComponent(mockPhonePeVpa)}&pn=${encodeURIComponent(payeeName)}&am=${(remainingFee * 0.98).toFixed(2)}&cu=${currentCurrency}&tn=${encodeURIComponent(transactionNote)}`;
        toast(makePaymentToast(method, remainingFee, classroom.name, currentCurrency)); window.open(phonePeUpiUrl, '_blank'); setIsPaymentDialogOpen(false);
    } else if (method === "Net Banking") {
        const currentCurrencySymbol = getCurrencySymbol(currentCurrency);
        const htmlContent = `
          <!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Mock Net Banking</title>
          <style>body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background-color: #f4f7f9; color: #333; text-align: center; padding: 20px; box-sizing: border-box; }
          .container { background-color: white; padding: 30px 40px; border-radius: 12px; box-shadow: 0 6px 12px rgba(0,0,0,0.1); max-width: 600px; border: 1px solid #e0e0e0; } h1 { color: #223D4A; font-size: 1.8em; margin-bottom: 15px; } p { line-height: 1.6; margin-bottom: 12px; font-size: 0.95em; } strong { color: #32CD32; }
          .button-placeholder { margin-top: 25px; padding: 12px 25px; background-color: #007bff; color: white; border: none; border-radius: 8px; font-size: 1em; cursor: pointer; } .button-placeholder:hover { background-color: #0056b3; } .footer { margin-top: 30px; font-size: 0.85em; color: #777; }
          .details { margin-top: 20px; padding: 15px; background-color: #e9ecef; border-radius: 8px; text-align: left; } .details p { margin-bottom: 5px; font-size: 0.9em; }</style></head><body>
          <div class="container"><h1>TeachMeet - Mock Net Banking Portal</h1><p>Select your bank to pay for <strong>${classroom.name}</strong>.</p>
          <div class="details"><p><strong>Teacher's Bank (Mock):</strong> ${classroom.teacherBankName || 'N/A'}</p><p><strong>Account (Mock):</strong> ${classroom.teacherBankAccount || 'N/A'}</p><p><strong>IFSC (Mock):</strong> ${classroom.teacherBankIfsc || 'N/A'}</p>
          <p><strong>Amount to Transfer to Teacher:</strong> ${currentCurrencySymbol}${(remainingFee * 0.98).toFixed(2)}</p></div>
          <p>The remaining 2% (${currentCurrencySymbol}${(remainingFee * 0.02).toFixed(2)}) is for the developer (UPI: 07arman2004-1@oksbi).</p><p>This is a simulated page.</p><button class="button-placeholder" onclick="window.close()">Close</button></div>
          <div class="footer">Mock interface. No real payment.</div></body></html>`;
        const dataUri = `data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`;
        const newTab = window.open(dataUri, '_blank');
        if (newTab) {
            toast(makePaymentToast(method, remainingFee, classroom.name, currentCurrency));
        } else {
            toast({ variant: "destructive", title: "Popup Blocked", description: "Could not open Net Banking page. Please check your browser's popup blocker settings and try again.", duration: 10000 });
        }
        setIsPaymentDialogOpen(false);
    } else if (method === "Credit/Debit Card") { setIsPaymentDialogOpen(false); setIsCardPaymentDialogOpen(true);
    } else { toast(makePaymentToast(method, remainingFee, classroom.name, currentCurrency)); setIsPaymentDialogOpen(false); }
  };

  const handleExamCreated = (newExam: any) => {
    console.log("New exam created via dialog on class page:", newExam);
    toast({ title: "Exam Scheduled (Class Context)", description: `${newExam.title} has been scheduled for this class.` });
  };

  const handleToggleEditFeeDetails = () => {
    if (isEditingFeeDetails && classroom?.feeDetails) {
      setEditableFeeDetails({
        totalFee: String(classroom.feeDetails.totalFee),
        paidAmount: String(classroom.feeDetails.paidAmount),
        nextDueDate: classroom.feeDetails.nextDueDate || '',
        currency: classroom.feeDetails.currency || 'USD',
      });
    } else if (!isEditingFeeDetails && !editableFeeDetails && classroom?.feeDetails) {
       setEditableFeeDetails({
        totalFee: String(classroom.feeDetails.totalFee),
        paidAmount: String(classroom.feeDetails.paidAmount),
        nextDueDate: classroom.feeDetails.nextDueDate || '',
        currency: classroom.feeDetails.currency || 'USD',
      });
    } else if (!isEditingFeeDetails && !editableFeeDetails && !classroom?.feeDetails) {
      setEditableFeeDetails({ totalFee: '0', paidAmount: '0', nextDueDate: '', currency: 'USD' });
    }
    setIsEditingFeeDetails(!isEditingFeeDetails);
  };

  const handleSaveFeeDetails = () => {
    if (!editableFeeDetails || !classroom) return;
    const newTotalFee = parseFloat(editableFeeDetails.totalFee); const newPaidAmount = parseFloat(editableFeeDetails.paidAmount);
    if (isNaN(newTotalFee) || newTotalFee < 0 || isNaN(newPaidAmount) || newPaidAmount < 0) { toast({ variant: "destructive", title: "Invalid Input", description: "Fee amounts must be valid numbers." }); return; }
    if (newPaidAmount > newTotalFee) { toast({ variant: "destructive", title: "Invalid Input", description: "Paid amount cannot exceed total fee." }); return; }
    const newFeeDetails: FeeDetails = { totalFee: newTotalFee, paidAmount: newPaidAmount, nextDueDate: editableFeeDetails.nextDueDate.trim() ? editableFeeDetails.nextDueDate.trim() : undefined, currency: editableFeeDetails.currency || 'USD' };
    setClassroom(prev => prev ? { ...prev, feeDetails: newFeeDetails } : null);
    toast({ title: "Fee Details Updated (Mock)", description: "Class fee information has been saved locally." });
    setIsEditingFeeDetails(false);
  };

  const handleToggleEditTeacherPaymentDetails = () => {
    if (!isEditingTeacherPaymentDetails && classroom) {
      setTeacherUpiIdInput(classroom.teacherUpiId || ''); setTeacherBankAccountInput(classroom.teacherBankAccount || '');
      setTeacherBankIfscInput(classroom.teacherBankIfsc || ''); setTeacherBankNameInput(classroom.teacherBankName || '');
    } setIsEditingTeacherPaymentDetails(!isEditingTeacherPaymentDetails);
  };

  const handleSaveTeacherPaymentDetails = () => {
    if (!classroom) return;
    if (teacherUpiIdInput && !/^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/.test(teacherUpiIdInput)) { toast({ variant: "destructive", title: "Invalid UPI ID", description: "Format: user@bankupi." }); return; }
    if (teacherBankAccountInput && (teacherBankAccountInput.length < 5 || teacherBankAccountInput.length > 20 || !/^\d+$/.test(teacherBankAccountInput))) { toast({ variant: "destructive", title: "Invalid Bank Account" }); return; }
    if (teacherBankIfscInput && !/^[A-Za-z]{4}0[A-Z0-9]{6}$/.test(teacherBankIfscInput)) { toast({ variant: "destructive", title: "Invalid IFSC Code" }); return; }
    const updatedClassroom = { ...classroom, teacherUpiId: teacherUpiIdInput.trim() || undefined, teacherBankAccount: teacherBankAccountInput.trim() || undefined, teacherBankIfsc: teacherBankIfscInput.trim().toUpperCase() || undefined, teacherBankName: teacherBankNameInput.trim() || undefined };
    setClassroom(updatedClassroom); toast({ title: "Payment Details Updated" }); setIsEditingTeacherPaymentDetails(false);
  };

  const handleConfirmRefund = () => {
    if (!classroom || !classroom.feeDetails || !editableFeeDetails) return;
    const amountToRefund = parseFloat(refundAmountInput);

    if (isNaN(amountToRefund) || amountToRefund <= 0) {
      toast({ variant: "destructive", title: "Invalid Amount", description: "Please enter a valid positive amount to refund." });
      return;
    }
    if (amountToRefund > classroom.feeDetails.paidAmount) {
      toast({ variant: "destructive", title: "Refund Exceeds Paid", description: `Cannot refund more than the paid amount of ${getCurrencySymbol(classroom.feeDetails.currency)}${classroom.feeDetails.paidAmount.toFixed(2)}.` });
      return;
    }

    const newPaidAmount = classroom.feeDetails.paidAmount - amountToRefund;
    const updatedFeeDetails: FeeDetails = { ...classroom.feeDetails, paidAmount: newPaidAmount };

    setClassroom(prev => prev ? { ...prev, feeDetails: updatedFeeDetails } : null);
    setEditableFeeDetails(prev => prev ? { ...prev, paidAmount: String(newPaidAmount) } : null);

    toast({ title: "Refund Processed (Mock)", description: `${getCurrencySymbol(classroom.feeDetails.currency)}${amountToRefund.toFixed(2)} has been refunded to the student (conceptually).` });
    setIsRefundDialogOpen(false);
    setRefundAmountInput('');
  };

  const isCurrentUserTeacher = user?.uid === classroom?.teacherId;

  if (loading || authLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8">
        <Card className="w-full max-w-4xl p-8 rounded-xl shadow-xl border-border/50">
          <CardHeader><div className="h-8 bg-muted rounded w-3/4 mx-auto mb-2"></div><div className="h-4 bg-muted rounded w-1/2 mx-auto"></div></CardHeader>
          <CardContent className="space-y-6 mt-6"><div className="h-40 bg-muted rounded-lg w-full"></div><div className="space-y-2"><div className="h-4 bg-muted rounded w-full"></div><div className="h-4 bg-muted rounded w-5/6"></div></div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">{[...Array(6)].map((_, i) => (<div key={i} className="h-24 bg-muted rounded-lg"></div>))}</div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!classroom) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center">
        <AlertTriangle className="h-16 w-16 text-destructive mb-4" /><h1 className="text-2xl font-bold text-destructive mb-2">Class Not Found</h1>
        <p className="text-muted-foreground mb-6">Details for ID &quot;{classId}&quot; could not be loaded.</p>
        <Button onClick={() => router.push('/dashboard/classes')} variant="outline" className="rounded-lg"><ArrowLeft className="mr-2 h-4 w-4" /> Back to All Classes</Button>
      </div>
    );
  }

  const currentRemainingFee = editableFeeDetails && classroom?.feeDetails
    ? parseFloat(editableFeeDetails.totalFee || '0') - parseFloat(editableFeeDetails.paidAmount || '0')
    : classroom?.feeDetails
    ? classroom.feeDetails.totalFee - classroom.feeDetails.paidAmount
    : 0;

  return (
    <div className="space-y-8 p-4 md:p-8">
      <input type="file" ref={assignmentFileRef} onChange={handleFileSelectedForAssignment} accept=".txt,.pdf,.doc,.docx,image/*,video/*,audio/*" style={{ display: 'none' }} />
      <div className="flex items-center justify-between mb-6">
        <Button onClick={() => router.push('/dashboard/classes')} variant="outline" className="rounded-lg"><ArrowLeft className="mr-2 h-4 w-4" /> Back to All Classes</Button>
        <Button onClick={handleStartClassMeeting} variant="default" size="lg" className="btn-gel rounded-lg"><Video className="mr-2 h-5 w-5" /> Start/Join Class Meeting</Button>
      </div>

      <Card className="rounded-xl shadow-xl border-border/50 overflow-hidden">
        <div className="relative h-48 md:h-64 w-full">
          <Image src={classroom.thumbnailUrl} alt={`Thumbnail for ${classroom.name}`} layout="fill" objectFit="cover" className="opacity-80" data-ai-hint="classroom education"/>
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
          <div className="absolute bottom-0 left-0 p-6">
            <h1 className="text-3xl md:text-4xl font-bold text-white shadow-md">{classroom.name}</h1>
            <div className="flex items-center mt-2">
                {classroom.teacherAvatar && <Image src={classroom.teacherAvatar} alt={classroom.teacherName} width={32} height={32} className="rounded-full border-2 border-white/50 mr-2" data-ai-hint="teacher avatar"/>}
                <p className="text-sm text-slate-200 shadow-sm">Taught by {classroom.teacherName}</p>
            </div>
          </div>
          <div className="absolute top-4 right-4"><Badge variant="secondary" className="text-xs shadow-md rounded-md"><Users className="mr-1.5 h-3.5 w-3.5"/> {classroom.memberCount} Members</Badge></div>
        </div>

        <CardContent className="p-6 space-y-8">
          <div><h2 className="text-xl font-semibold text-foreground mb-2">About this Class</h2><p className="text-muted-foreground whitespace-pre-line">{classroom.description}</p></div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="rounded-lg shadow-md border-border/30">
              <CardHeader><CardTitle className="flex items-center text-lg"><Megaphone className="mr-2 h-5 w-5 text-primary" />Announcements</CardTitle></CardHeader>
              <CardContent className="space-y-3 text-sm max-h-72 overflow-y-auto">
                {classroom.announcements?.length ? classroom.announcements.map((item) => (
                  <div key={item.id} className="pb-3 border-b border-border/20 last:border-b-0 group">
                    <div className="flex justify-between items-start">
                        <p className="font-semibold text-foreground flex-grow">{item.title} <span className="text-xs text-muted-foreground">({format(parseISO(item.date), "MMM d, yyyy")})</span></p>
                        {isCurrentUserTeacher && (<div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity"><Button variant="ghost" size="icon" className="h-7 w-7 rounded-md" onClick={() => handleOpenEditAnnouncementDialog(item)}><Edit2 className="h-4 w-4 text-blue-500" /></Button><Button variant="ghost" size="icon" className="h-7 w-7 rounded-md" onClick={() => handleOpenDeleteConfirmDialog(item.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button></div>)}
                    </div><p className="text-muted-foreground mt-0.5">{item.content}</p></div>)) : <p className="text-muted-foreground">No announcements.</p>}
              </CardContent>
              {isCurrentUserTeacher && (<CardFooter><Dialog open={isPostAnnouncementDialogOpen} onOpenChange={(isOpen) => { if (!isOpen) { setPostAnnouncementTitleInput(''); setPostAnnouncementContentInput(''); } setIsPostAnnouncementDialogOpen(isOpen); }}>
                    <DialogTrigger asChild><Button variant="outline" className="w-full rounded-lg text-sm"><PlusCircle className="mr-2 h-4 w-4" /> Post Announcement</Button></DialogTrigger>
                    {isPostAnnouncementDialogOpen && (<DialogContent className="sm:max-w-lg rounded-xl"><DialogHeader><ShadDialogTitle>New Announcement</ShadDialogTitle><DialogDescription>Share updates.</DialogDescription></DialogHeader><div className="grid gap-4 py-4"><div className="grid gap-2"><Label htmlFor="postAnnouncementTitle">Title</Label><Input id="postAnnouncementTitle" value={postAnnouncementTitleInput} onChange={(e) => setPostAnnouncementTitleInput(e.target.value)} placeholder="e.g., Test" className="rounded-lg"/></div><div className="grid gap-2"><Label htmlFor="postAnnouncementContent">Content</Label><Textarea id="postAnnouncementContent" value={postAnnouncementContentInput} onChange={(e) => setPostAnnouncementContentInput(e.target.value)} placeholder="Details..." className="rounded-lg min-h-[100px]"/></div></div><DialogFooter><DialogClose asChild><Button type="button" variant="outline" className="rounded-lg">Cancel</Button></DialogClose><Button type="button" onClick={handleDialogPostAnnouncement} className="btn-gel rounded-lg">Post</Button></DialogFooter></DialogContent>)}</Dialog></CardFooter>)}
            </Card>
            <Card className="rounded-lg shadow-md border-border/30">
              <CardHeader><CardTitle className="flex items-center text-lg"><CalendarDays className="mr-2 h-5 w-5 text-primary" />Schedule &amp; Timings</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                {classroom.schedule?.length ? classroom.schedule.map((item) => (<div key={item.id} className="flex justify-between py-1 border-b border-border/10 last:border-b-0"><span className="text-foreground font-medium">{item.day}:</span><span className="text-muted-foreground">{item.time}{item.topic ? ` (${item.topic})` : ''}</span></div>)) : <p className="text-muted-foreground">Not available.</p>}
                {isCurrentUserTeacher && (<div className="mt-4"><Button variant="outline" className="w-full rounded-lg text-sm" onClick={handleOpenEditScheduleDialog}><Edit2 className="mr-2 h-4 w-4" /> Edit Schedule</Button></div>)}
              </CardContent>{classroom.scheduleLastUpdated && (<CardFooter className="border-t pt-3"><p className="text-xs text-muted-foreground">Last updated: {format(parseISO(classroom.scheduleLastUpdated), "PP")}</p></CardFooter>)}
            </Card>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="rounded-lg shadow-md border-border/30">
              <CardHeader><CardTitle className="flex items-center text-lg"><ClipboardList className="mr-2 h-5 w-5 text-primary" />Assignments</CardTitle></CardHeader>
              <CardContent className="space-y-3 text-sm max-h-72 overflow-y-auto">
                {classroom.assignments?.length ? classroom.assignments.slice(0, 3).map((item) => (<div key={item.id} className="pb-3 border-b border-border/20 last:border-b-0"><div className="flex justify-between items-start"><p className="font-semibold text-foreground">{item.title}</p><Badge variant="outline" className={`text-xs ml-2 ${getStatusColor(item.status)} rounded-md`}>{item.status}</Badge></div><p className="text-xs text-muted-foreground">Due: {item.dueDate}</p>{item.description && <p className="text-muted-foreground mt-0.5 text-xs">{item.description}</p>}<Button variant="link" size="sm" className="p-0 h-auto text-accent text-xs mt-1">View Details</Button></div>)) : <p className="text-muted-foreground">No assignments.</p>}
              </CardContent>
               <CardFooter className="flex flex-col sm:flex-row gap-2">
                <Button asChild variant="outline" className="w-full rounded-lg text-sm"><Link href={`/dashboard/class/${classId}/assignments?name=${encodeURIComponent(classroom.name)}`}>Check All Assignments</Link></Button>
                {isCurrentUserTeacher && (<Dialog open={isAssignmentUploadDialogOpen} onOpenChange={setIsAssignmentUploadDialogOpen}><DialogTrigger asChild><Button variant="default" className="w-full rounded-lg text-sm btn-gel" onClick={handleTriggerAssignmentUploadDialog}><UploadCloud className="mr-2 h-4 w-4" /> Upload Assignment</Button></DialogTrigger>
                    {isAssignmentUploadDialogOpen && (<DialogContent className="sm:max-w-md rounded-xl"><DialogHeader><ShadDialogTitle>Upload Materials</ShadDialogTitle><DialogDescription>Enter title & upload file.</DialogDescription></DialogHeader><div className="grid gap-4 py-4"><div className="grid gap-2"><Label htmlFor="dialogAssignmentName">Title</Label><Input id="dialogAssignmentName" value={dialogAssignmentName} onChange={(e) => setDialogAssignmentName(e.target.value)} placeholder="e.g., Guidelines" className="rounded-lg"/></div></div><DialogFooter><DialogClose asChild><Button type="button" variant="outline" className="rounded-lg">Cancel</Button></DialogClose><Button type="button" onClick={handleDialogSubmitAndChooseFile} className="btn-gel rounded-lg">Choose File &amp; Upload</Button></DialogFooter></DialogContent>)}</Dialog>)}
              </CardFooter>
            </Card>
            <Card className="rounded-lg shadow-md border-border/30">
              <CardHeader><CardTitle className="flex items-center text-lg"><FileIcon className="mr-2 h-5 w-5 text-primary" />Class Materials</CardTitle></CardHeader>
              <CardContent className="space-y-3 text-sm max-h-72 overflow-y-auto">
                {classroom.materials?.length ? classroom.materials.map((item) => (<div key={item.id} className="pb-3 border-b border-border/20 last:border-b-0"><div className="flex items-center"><MaterialIcon type={item.type}/><p className="font-semibold text-foreground flex-grow truncate" title={item.title}>{item.title}</p></div>{item.description && <p className="text-muted-foreground mt-0.5 text-xs ml-7">{item.description}</p>}<Button asChild variant="link" size="sm" className="p-0 h-auto text-accent text-xs mt-1 ml-7">{item.url ? (<Link href={item.url} target={item.url.startsWith('/') ? '_self' : '_blank'} rel="noopener noreferrer">{item.type === 'link' || item.type === 'video' ? 'Open Link' : 'Download File'}</Link>) : (<span>{item.type === 'link' || item.type === 'video' ? 'Open Link' : 'Download File'}</span>)}</Button></div>)) : <p className="text-muted-foreground">No materials.</p>}
              </CardContent>
               <CardFooter className="flex flex-col sm:flex-row gap-2">
                {isCurrentUserTeacher && (<Dialog open={isUploadMaterialDialogOpen} onOpenChange={(isOpen) => { if (!isOpen) resetUploadMaterialDialog(); setIsUploadMaterialDialogOpen(isOpen); }}><DialogTrigger asChild><Button variant="default" className="w-full rounded-lg text-sm btn-gel"><UploadCloud className="mr-2 h-4 w-4" /> Upload Material</Button></DialogTrigger>
                    {isUploadMaterialDialogOpen && (<DialogContent className="sm:max-w-lg rounded-xl"><DialogHeader><ShadDialogTitle>Upload Material</ShadDialogTitle><DialogDescription>Add link or file.</DialogDescription></DialogHeader><div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto px-1"><div className="grid gap-2"><Label htmlFor="newMaterialTitle">Title*</Label><Input id="newMaterialTitle" value={newMaterialTitle} onChange={(e) => setNewMaterialTitle(e.target.value)} placeholder="e.g., Slides Wk1" className="rounded-lg" disabled={isUploadingMaterial}/></div><div className="grid gap-2"><Label htmlFor="newMaterialDescription">Desc (Optional)</Label><Textarea id="newMaterialDescription" value={newMaterialDescription} onChange={(e) => setNewMaterialDescription(e.target.value)} placeholder="Briefly describe..." className="rounded-lg min-h-[70px]" disabled={isUploadingMaterial}/></div><div className="grid gap-2"><Label>Type*</Label><RadioGroup value={newMaterialType} onValueChange={(value: 'link' | 'file') => setNewMaterialType(value)} className="flex gap-4" disabled={isUploadingMaterial}><div className="flex items-center space-x-2"><RadioGroupItem value="link" id="type-link" /><Label htmlFor="type-link" className="font-normal flex items-center"><Link2 className="mr-1 h-4 w-4"/>Link</Label></div><div className="flex items-center space-x-2"><RadioGroupItem value="file" id="type-file" /><Label htmlFor="type-file" className="font-normal flex items-center"><FileUp className="mr-1 h-4 w-4"/>File</Label></div></RadioGroup></div>{newMaterialType === 'link' && (<div className="grid gap-2"><Label htmlFor="newMaterialUrl">URL*</Label><Input id="newMaterialUrl" type="url" value={newMaterialUrl} onChange={(e) => setNewMaterialUrl(e.target.value)} placeholder="https://example.com" className="rounded-lg" disabled={isUploadingMaterial}/></div>)}{newMaterialType === 'file' && (<div className="grid gap-2"><Label htmlFor="newMaterialFile">File*</Label><Input ref={materialFileRef} id="newMaterialFile" type="file" onChange={handleMaterialFileChange} className="rounded-lg file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20" disabled={isUploadingMaterial}/>{newMaterialFile && <p className="text-xs text-muted-foreground">Selected: {newMaterialFile.name}</p>}</div>)}</div><DialogFooter><DialogClose asChild><Button type="button" variant="outline" className="rounded-lg" disabled={isUploadingMaterial}>Cancel</Button></DialogClose><Button type="button" onClick={handleAddMaterial} className="btn-gel rounded-lg" disabled={isUploadingMaterial}>{isUploadingMaterial ? "Adding..." : "Add Material"}</Button></DialogFooter></DialogContent>)}</Dialog>)}
                <Button asChild variant="outline" className="w-full rounded-lg text-sm"><Link href={`/dashboard/class/${classId}/materials?name=${encodeURIComponent(classroom.name)}`}>Browse All Materials</Link></Button>
              </CardFooter>
            </Card>
          </div>
          <Card className="rounded-lg shadow-md border-border/30">
            <CardHeader><CardTitle className="flex items-center text-lg"><ExamIcon className="mr-2 h-5 w-5 text-primary" />Exams</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm max-h-72 overflow-y-auto">
              {classroom.exams?.length ? classroom.exams.slice(0, 3).map((exam) => (<div key={exam.id} className="pb-3 border-b border-border/20 last:border-b-0"><div className="flex justify-between items-start"><p className="font-semibold text-foreground">{exam.title}</p><Badge variant="outline" className={`text-xs ml-2 ${getStatusColor(exam.status)} rounded-md`}>{exam.status}</Badge></div><p className="text-xs text-muted-foreground">Due: {format(new Date(exam.dueDate), "PP")}</p><Button asChild variant="link" size="sm" className="p-0 h-auto text-accent text-xs mt-1"><Link href={`/dashboard/exam/${exam.id}?title=${encodeURIComponent(exam.title)}`}>View Exam</Link></Button></div>)) : <p className="text-muted-foreground">No exams.</p>}
            </CardContent>
            <CardFooter className="flex flex-col sm:flex-row gap-2">
            {isCurrentUserTeacher && (<Dialog open={isCreateExamDialogOpenForClass} onOpenChange={setIsCreateExamDialogOpenForClass}><DialogTrigger asChild><Button variant="outline" className="w-full rounded-lg text-sm"><PlusCircle className="mr-2 h-4 w-4" /> Create Exam</Button></DialogTrigger>{isCreateExamDialogOpenForClass && (<DialogContent className="sm:max-w-2xl rounded-xl"><CreateExamDialog isOpen={isCreateExamDialogOpenForClass} onOpenChange={setIsCreateExamDialogOpenForClass} onExamCreated={handleExamCreated} classContext={classroom ? { classId: classroom.id, className: classroom.name } : undefined}/></DialogContent>)}</Dialog>)}
              <Button asChild variant="outline" className="w-full rounded-lg text-sm"><Link href={`/dashboard/exams?classId=${classId}`}><Eye className="mr-2 h-4 w-4" /> View All Exams</Link></Button>
            </CardFooter>
          </Card>
          <Card className="rounded-lg shadow-md border-border/30">
            <CardHeader><CardTitle className="flex items-center text-lg"><DollarSign className="mr-2 h-5 w-5 text-primary" />Fees &amp; Payment</CardTitle></CardHeader>
            <CardContent className="space-y-4 text-sm">
             {isCurrentUserTeacher && (
                <div className="border-b border-border/30 pb-4 mb-4">
                  <h3 className="text-md font-semibold text-foreground mb-2">Your Payment Receiving Details</h3>
                  {isEditingTeacherPaymentDetails ? (
                    <div className="space-y-3">
                      <div>
                        <Label htmlFor="teacherUpiId" className="text-xs">UPI ID</Label>
                         <div className="relative mt-1">
                            <Hash className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <Input id="teacherUpiId" value={teacherUpiIdInput} onChange={(e) => setTeacherUpiIdInput(e.target.value)} placeholder="your@upi" className="rounded-lg h-9 text-sm pl-10"/>
                        </div>
                      </div>
                      <div>
                        <Label htmlFor="teacherBankName" className="text-xs">Bank Name</Label>
                         <div className="relative mt-1">
                            <Building className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <Input id="teacherBankName" value={teacherBankNameInput} onChange={(e) => setTeacherBankNameInput(e.target.value)} placeholder="e.g., SBI" className="rounded-lg h-9 text-sm pl-10"/>
                        </div>
                      </div>
                      <div>
                        <Label htmlFor="teacherBankAccount" className="text-xs">Bank Account Number</Label>
                         <div className="relative mt-1">
                            <LandmarkIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <Input id="teacherBankAccount" value={teacherBankAccountInput} onChange={(e) => setTeacherBankAccountInput(e.target.value)} placeholder="e.g., 123456789012" className="rounded-lg h-9 text-sm pl-10"/>
                        </div>
                      </div>
                      <div>
                        <Label htmlFor="teacherBankIfsc" className="text-xs">IFSC Code</Label>
                        <div className="relative mt-1">
                            <Input id="teacherBankIfsc" value={teacherBankIfscInput} onChange={(e) => setTeacherBankIfscInput(e.target.value)} placeholder="e.g., SBIN0001234" className="rounded-lg h-9 text-sm"/>
                        </div>
                      </div>
                      <div className="flex gap-2 mt-2">
                        <Button onClick={handleSaveTeacherPaymentDetails} className="btn-gel rounded-lg text-xs flex-1">Save</Button>
                        <Button onClick={handleToggleEditTeacherPaymentDetails} variant="outline" className="rounded-lg text-xs flex-1">Cancel</Button>
                      </div>
                    </div>
                  ) : (
                    classroom.teacherUpiId || classroom.teacherBankAccount ? (
                      <div className="space-y-1">
                        {classroom.teacherUpiId && <p>UPI ID: <span className="font-medium text-foreground">{classroom.teacherUpiId}</span></p>}
                        {classroom.teacherBankAccount && <p>Bank: <span className="font-medium text-foreground">{classroom.teacherBankName || 'N/A'} - Acct: ...{classroom.teacherBankAccount.slice(-4)} (IFSC: {classroom.teacherBankIfsc || 'N/A'})</span></p>}
                        <Button onClick={handleToggleEditTeacherPaymentDetails} variant="link" size="sm" className="p-0 h-auto text-accent text-xs mt-1">Edit</Button>
                      </div>
                    ) : (
                       <Button onClick={handleToggleEditTeacherPaymentDetails} variant="outline" className="w-full rounded-lg text-sm"><PlusCircle className="mr-2 h-4 w-4" /> Add Details</Button>
                    )
                  )}
                  <p className="text-xs text-muted-foreground mt-2">
                    Note: Student payments made to these details will have a 2% platform fee deducted for the developer (UPI: 07arman2004-1@oksbi).
                  </p>
                  <Separator className="my-4" />
                </div>
              )}
              {!classroom.feeDetails && !isEditingFeeDetails && !editableFeeDetails?.currency ? (
                <p className="text-muted-foreground">Fee details not available.</p>
              ) : isCurrentUserTeacher && isEditingFeeDetails ? (
                <>
                  <div className="space-y-1">
                    <Label htmlFor="feeCurrency" className="text-xs">Currency</Label>
                    <Select value={editableFeeDetails?.currency} onValueChange={(value) => setEditableFeeDetails(prev => prev ? { ...prev, currency: value } : null)} disabled={!isEditingFeeDetails}>
                        <SelectTrigger id="feeCurrency" className="rounded-lg h-9 text-sm"><SelectValue placeholder="Select currency" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="USD">USD ($) - US Dollar</SelectItem>
                            <SelectItem value="EUR">EUR (€) - Euro</SelectItem>
                            <SelectItem value="INR">INR (₹) - Indian Rupee</SelectItem>
                            <SelectItem value="GBP">GBP (£) - British Pound</SelectItem>
                            <SelectItem value="CAD">CAD (CA$) - Canadian Dollar</SelectItem>
                            <SelectItem value="AUD">AUD (A$) - Australian Dollar</SelectItem>
                            <SelectItem value="JPY">JPY (¥) - Japanese Yen</SelectItem>
                            <SelectItem value="CNY">CNY (CN¥) - Chinese Yuan</SelectItem>
                            <SelectItem value="CHF">CHF (CHF) - Swiss Franc</SelectItem>
                            <SelectItem value="RUB">RUB (₽) - Russian Ruble</SelectItem>
                            <SelectItem value="BRL">BRL (R$) - Brazilian Real</SelectItem>
                            <SelectItem value="ZAR">ZAR (R) - South African Rand</SelectItem>
                            <SelectItem value="AED">AED (د.إ) - UAE Dirham</SelectItem>
                            <SelectItem value="SGD">SGD (S$) - Singapore Dollar</SelectItem>
                        </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1"><Label htmlFor="totalFee" className="text-xs">Class Total Fee ({getCurrencySymbol(editableFeeDetails?.currency)})</Label><Input id="totalFee" type="number" value={editableFeeDetails?.totalFee} onChange={(e) => setEditableFeeDetails(prev => prev ? { ...prev, totalFee: e.target.value } : null)} className="rounded-lg h-9 text-sm" placeholder="e.g., 500"/></div>
                  <div className="space-y-1"><Label htmlFor="paidAmount" className="text-xs">Default Amount Paid ({getCurrencySymbol(editableFeeDetails?.currency)})</Label><Input id="paidAmount" type="number" value={editableFeeDetails?.paidAmount} onChange={(e) => setEditableFeeDetails(prev => prev ? { ...prev, paidAmount: e.target.value } : null)} className="rounded-lg h-9 text-sm" placeholder="e.g., 0"/></div>
                   <p>Default Remaining: <span className="font-semibold text-destructive">{getCurrencySymbol(editableFeeDetails?.currency)}{isNaN(currentRemainingFee) ? 'N/A' : currentRemainingFee.toFixed(2)}</span></p>
                  <div className="space-y-1"><Label htmlFor="nextDueDate" className="text-xs">Default Next Payment Due</Label><Input id="nextDueDate" type="date" value={editableFeeDetails?.nextDueDate} onChange={(e) => setEditableFeeDetails(prev => prev ? { ...prev, nextDueDate: e.target.value } : null)} className="rounded-lg h-9 text-sm"/></div></>
              ) : classroom.feeDetails ? (
                <>
                  <p>Class Total Fee: <span className="font-semibold text-foreground">{getCurrencySymbol(classroom.feeDetails.currency)} {classroom.feeDetails.totalFee.toFixed(2)}</span></p>
                  <p>Your Amount Paid: <span className="font-semibold text-green-600">{getCurrencySymbol(classroom.feeDetails.currency)} {classroom.feeDetails.paidAmount.toFixed(2)}</span></p>
                  <p>Your Remaining Fee: <span className="font-semibold text-destructive">{getCurrencySymbol(classroom.feeDetails.currency)} {(classroom.feeDetails.totalFee - classroom.feeDetails.paidAmount).toFixed(2)}</span></p>
                  {classroom.feeDetails.nextDueDate && (<p>Next Payment Due: {format(parseISO(classroom.feeDetails.nextDueDate), "PP")}</p>)}</>
              ) : ( <p className="text-muted-foreground">Class fee details not set up yet.</p> )}
            </CardContent>
            <CardFooter className="flex flex-col sm:flex-row gap-2">
              {isCurrentUserTeacher && !isEditingTeacherPaymentDetails && (
                <div className="w-full flex flex-col sm:flex-row gap-2">
                  {isEditingFeeDetails ? (
                    <>
                      <Button onClick={handleSaveFeeDetails} className="flex-1 btn-gel rounded-lg text-sm">Save Fee Details</Button>
                      <Button onClick={handleToggleEditFeeDetails} variant="outline" className="flex-1 rounded-lg text-sm">Cancel</Button>
                    </>
                  ) : (
                    <>
                      <Button onClick={handleToggleEditFeeDetails} variant="outline" className="flex-1 rounded-lg text-sm">
                        <Edit2 className="mr-2 h-4 w-4" /> Edit Fee Structure
                      </Button>
                      {classroom?.feeDetails && classroom.feeDetails.paidAmount > 0 && (
                        <Button
                          variant="outline"
                          className="flex-1 rounded-lg text-sm border-orange-500 text-orange-500 hover:bg-orange-500/10 hover:text-orange-600"
                          onClick={() => {
                            setRefundAmountInput('');
                            setIsRefundDialogOpen(true);
                          }}
                        >
                          <Undo2 className="mr-2 h-4 w-4" /> Issue Refund
                        </Button>
                      )}
                    </>
                  )}
                </div>
              )}
              {!isEditingFeeDetails && !isCurrentUserTeacher && (<Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}><DialogTrigger asChild><Button className="w-full btn-gel rounded-lg text-sm" disabled={!classroom.feeDetails || currentRemainingFee <= 0}>{classroom.feeDetails && currentRemainingFee <= 0 ? "Fully Paid" : "Make Payment"}</Button></DialogTrigger>
                  {isPaymentDialogOpen && (<DialogContent className="sm:max-w-md rounded-xl"><DialogHeader><ShadDialogTitle>Choose Payment Method</ShadDialogTitle><DialogDescription>Select preferred option. (Mock Interface) Note: A 2% platform fee will be applied, directed to developer (UPI: 07arman2004-1@oksbi). Remainder to teacher.</DialogDescription></DialogHeader><div className="grid gap-3 py-4"><Button variant="outline" className="rounded-lg justify-start py-3 text-base" onClick={() => handleMockPayment("Google Pay / UPI")}><Smartphone className="mr-3 h-5 w-5 text-blue-500" /> Google Pay / UPI</Button><Button variant="outline" className="rounded-lg justify-start py-3 text-base" onClick={() => handleMockPayment("PhonePe")}><Smartphone className="mr-3 h-5 w-5 text-purple-600" /> PhonePe</Button><Button variant="outline" className="rounded-lg justify-start py-3 text-base" onClick={() => handleMockPayment("Net Banking")}><Banknote className="mr-3 h-5 w-5 text-green-600" /> Net Banking</Button><Button variant="outline" className="rounded-lg justify-start py-3 text-base" onClick={() => handleMockPayment("Credit/Debit Card")}><CreditCard className="mr-3 h-5 w-5 text-orange-500" /> Credit/Debit Card</Button></div><DialogFooter><DialogClose asChild><Button type="button" variant="outline" className="rounded-lg">Cancel</Button></DialogClose></DialogFooter></DialogContent>)}</Dialog>)}
            </CardFooter>
          </Card>
          <div className="mt-8 text-center"><Button variant="default" size="lg" className="btn-gel rounded-lg py-3 px-8 text-base" onClick={handleJoinDiscussion}><MessageSquare className="mr-2 h-5 w-5"/> Join Class Discussion</Button></div>
        </CardContent>
      </Card>
      <Dialog open={isEditAnnouncementDialogOpen} onOpenChange={(isOpen) => { if (!isOpen) setEditingAnnouncement(null); setIsEditAnnouncementDialogOpen(isOpen); }}>
        {isEditAnnouncementDialogOpen && (<DialogContent className="sm:max-w-lg rounded-xl"><DialogHeader><ShadDialogTitle>Edit Announcement</ShadDialogTitle><DialogDescription>Modify title and content.</DialogDescription></DialogHeader><div className="grid gap-4 py-4"><div className="grid gap-2"><Label htmlFor="editAnnouncementTitle">Title</Label><Input id="editAnnouncementTitle" value={editAnnouncementTitleInput} onChange={(e) => setEditAnnouncementTitleInput(e.target.value)} className="rounded-lg"/></div><div className="grid gap-2"><Label htmlFor="editAnnouncementContent">Content</Label><Textarea id="editAnnouncementContent" value={editAnnouncementContentInput} onChange={(e) => setEditAnnouncementContentInput(e.target.value)} className="rounded-lg min-h-[100px]"/></div></div><DialogFooter><DialogClose asChild><Button type="button" variant="outline" className="rounded-lg">Cancel</Button></DialogClose><Button type="button" onClick={handleDialogUpdateAnnouncement} className="btn-gel rounded-lg">Save</Button></DialogFooter></DialogContent>)}</Dialog>
      <AlertDialog open={isDeleteConfirmDialogOpen} onOpenChange={setIsDeleteConfirmDialogOpen}><AlertDialogContent className="rounded-xl"><AlertDialogHeader><ShadAlertDialogTitle>Confirm Deletion</ShadAlertDialogTitle><AlertDialogDescription>Sure to delete? Cannot be undone.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel className="rounded-lg" onClick={() => setAnnouncementIdToDelete(null)}>Cancel</AlertDialogCancel><AlertDialogAction onClick={handleConfirmDeleteAnnouncement} className={cn(buttonVariants({ variant: "destructive", className: "rounded-lg" }))}>Delete</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
      <Dialog open={isEditScheduleDialogOpen} onOpenChange={setIsEditScheduleDialogOpen}>
        {isEditScheduleDialogOpen && (<DialogContent className="sm:max-w-lg rounded-xl"><DialogHeader><ShadDialogTitle>Edit Schedule</ShadDialogTitle><DialogDescription>Add, remove, or modify entries.</DialogDescription></DialogHeader><div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto">{editingScheduleItems.length > 0 ? (editingScheduleItems.map((item, index) => (<div key={item.id || index} className="flex items-center justify-between gap-2 p-2 border rounded-lg"><div className="flex-grow"><p className="text-sm font-medium">{item.day} - {item.time}</p>{item.topic && <p className="text-xs text-muted-foreground">{item.topic}</p>}</div><Button variant="ghost" size="icon" onClick={() => handleRemoveScheduleItemInDialog(item.id)} className="text-destructive h-8 w-8 rounded-md"><Trash2 className="h-4 w-4" /></Button></div>))) : (<p className="text-sm text-muted-foreground text-center py-4">No entries.</p>)}<div className="pt-4 border-t"><Label className="text-sm font-medium block mb-2">Add New</Label><div className="grid grid-cols-1 sm:grid-cols-2 gap-3"><Input value={newScheduleDayInput} onChange={(e) => setNewScheduleDayInput(e.target.value)} placeholder="Day" className="rounded-lg"/><Input value={newScheduleTimeInput} onChange={(e) => setNewScheduleTimeInput(e.target.value)} placeholder="Time" className="rounded-lg"/></div><Input value={newScheduleTopicInput} onChange={(e) => setNewScheduleTopicInput(e.target.value)} placeholder="Topic" className="rounded-lg mt-3"/><Button onClick={handleAddScheduleItemInDialog} className="w-full mt-3 btn-gel rounded-lg text-sm"><PlusCircle className="mr-2 h-4 w-4" /> Add</Button></div></div><DialogFooter><DialogClose asChild><Button type="button" variant="outline" className="rounded-lg">Cancel</Button></DialogClose><Button type="button" onClick={handleSaveChangesToSchedule} className="btn-gel rounded-lg">Save Schedule</Button></DialogFooter></DialogContent>)}</Dialog>
      <Dialog open={isCardPaymentDialogOpen} onOpenChange={setIsCardPaymentDialogOpen}><DialogContent className="sm:max-w-md rounded-xl"><DialogHeader><ShadDialogTitle>Enter Card Details</ShadDialogTitle><DialogDescription>Enter card info to complete payment. (Mock)</DialogDescription></DialogHeader><div className="grid gap-4 py-4"><div className="grid gap-2"><Label htmlFor="cardNumber">Card Number</Label><Input id="cardNumber" value={cardNumber} onChange={(e) => setCardNumber(e.target.value)} placeholder="0000 0000 0000 0000" className="rounded-lg"/></div><div className="grid grid-cols-2 gap-4"><div className="grid gap-2"><Label htmlFor="cardExpiry">Expiry (MM/YY)</Label><Input id="cardExpiry" value={cardExpiry} onChange={(e) => setCardExpiry(e.target.value)} placeholder="MM/YY" className="rounded-lg"/></div><div className="grid gap-2"><Label htmlFor="cardCvv">CVV</Label><Input id="cardCvv" value={cardCvv} onChange={(e) => setCardCvv(e.target.value)} placeholder="123" className="rounded-lg"/></div></div><div className="grid gap-2"><Label htmlFor="cardName">Cardholder Name</Label><Input id="cardName" value={cardName} onChange={(e) => setCardName(e.target.value)} placeholder="Full Name" className="rounded-lg"/></div></div><DialogFooter><DialogClose asChild><Button type="button" variant="outline" className="rounded-lg" onClick={() => setIsCardPaymentDialogOpen(false)}>Cancel</Button></DialogClose><Button type="button" onClick={handleCardPaymentSubmit} className="btn-gel rounded-lg">Pay {getCurrencySymbol(classroom?.feeDetails?.currency || 'USD')}{currentRemainingFee > 0 ? currentRemainingFee.toFixed(2) : "0.00"} (Mock)</Button></DialogFooter></DialogContent></Dialog>

      <Dialog open={isRefundDialogOpen} onOpenChange={setIsRefundDialogOpen}>
        <DialogContent className="sm:max-w-md rounded-xl">
          <DialogHeader>
            <ShadDialogTitle>Issue Refund</ShadDialogTitle>
            <DialogDescription>
              Enter the amount to refund to the student. This is a mock operation.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {classroom?.feeDetails && (
              <div className="text-sm space-y-1">
                <p>Total Paid: <span className="font-medium">{getCurrencySymbol(classroom.feeDetails.currency)}{classroom.feeDetails.paidAmount.toFixed(2)}</span></p>
                <p>Total Fee: <span className="font-medium">{getCurrencySymbol(classroom.feeDetails.currency)}{classroom.feeDetails.totalFee.toFixed(2)}</span></p>
              </div>
            )}
            <div className="grid gap-2">
              <Label htmlFor="refundAmountInput">Refund Amount ({getCurrencySymbol(classroom?.feeDetails?.currency)})</Label>
              <Input
                id="refundAmountInput"
                type="number"
                value={refundAmountInput}
                onChange={(e) => setRefundAmountInput(e.target.value)}
                placeholder="e.g., 50.00"
                className="rounded-lg"
              />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" className="rounded-lg">Cancel</Button>
            </DialogClose>
            <Button type="button" onClick={handleConfirmRefund} className="btn-gel rounded-lg bg-orange-500 hover:bg-orange-600 text-white">
              Confirm Refund
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

