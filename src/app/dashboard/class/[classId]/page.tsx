
'use client';

import { useEffect, useState, useRef, use } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import {
    ArrowLeft, CalendarDays, DollarSign, Users, AlertTriangle,
    Megaphone, ClipboardList, Link as LinkIconLucide, FileText as FileIcon, Video as VideoIconLucide, MessageSquare, Info, Video, PlusCircle,
    ClipboardCheck as ExamIcon, Eye, UploadCloud, ChevronsUpDown, CreditCard, Smartphone, Banknote, Edit2, Trash2, Link2, FileUp, Building, Hash, Landmark as LandmarkIcon, Undo2, Edit3, BookOpen
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
import { db, storage } from '@/lib/firebase'; 
import { doc, getDoc, updateDoc, addDoc, collection, query, orderBy, onSnapshot, deleteDoc, serverTimestamp, Timestamp, writeBatch, where } from 'firebase/firestore'; 
import { ref as storageRef, uploadBytesResumable, getDownloadURL, deleteObject as deleteStorageObject } from 'firebase/storage'; 
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";


interface Announcement {
  id: string;
  title: string;
  content: string;
  date: any; 
}

interface Assignment {
  id: string;
  title: string;
  dueDate: any; 
  status: 'Pending' | 'Submitted' | 'Graded' | 'Overdue'; 
  description?: string;
  filePath?: string; 
  fileName?: string; 
}

interface Material {
  id: string;
  title: string;
  type: 'link' | 'file' | 'video'; 
  url?: string; 
  filePath?: string; 
  fileName?: string; 
  description?: string;
}

interface ClassExam {
  id: string;
  title: string;
  dueDateTime: any; 
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

interface Subject {
  subjectName: string;
  teacherId: string;
  teacherName: string;
  teacherAvatar?: string;
}

interface ClassroomDetails {
  id: string;
  name: string;
  description: string;
  teacherId: string; // This is the class manager/owner
  teacherName: string;
  teacherAvatar?: string;
  memberCount: number;
  thumbnailUrl: string;
  announcements?: Announcement[];
  schedule?: ScheduleItem[];
  scheduleLastUpdated?: any; 
  feeDetails?: FeeDetails;
  teacherUpiId?: string;
  teacherBankAccount?: string;
  teacherBankIfsc?: string;
  teacherBankName?: string;
  createdAt?: any; 
  subjects?: Subject[];
}

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

  const [classroom, setClassroom] = useState<ClassroomDetails | null>(null);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [exams, setExams] = useState<ClassExam[]>([]); 

  const [loading, setLoading] = useState(true);
  const [isCreateExamDialogOpenForClass, setIsCreateExamDialogOpenForClass] = useState(false);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);

  const assignmentFileRef = useRef<HTMLInputElement>(null);
  const [selectedAssignmentTitleForUpload, setSelectedAssignmentTitleForUpload] = useState<string | null>(null);
  const [selectedAssignmentDescriptionForUpload, setSelectedAssignmentDescriptionForUpload] = useState<string>('');
  const [selectedAssignmentDueDateForUpload, setSelectedAssignmentDueDateForUpload] = useState<Date | undefined>(new Date());
  const [isAssignmentUploadDialogOpen, setIsAssignmentUploadDialogOpen] = useState(false);
  
  const [isEditingFeeDetails, setIsEditingFeeDetails] = useState(false);
  const [editableFeeDetails, setEditableFeeDetails] = useState<{
    totalFee: string; paidAmount: string; nextDueDate: string; currency: string;
  } | null>(null);

  const [isPostAnnouncementDialogOpen, setIsPostAnnouncementDialogOpen] = useState(false);
  const [postAnnouncementTitleInput, setPostAnnouncementTitleInput] = useState('');
  const [postAnnouncementContentInput, setPostAnnouncementContentInput] = useState('');

  const [isEditAnnouncementDialogOpen, setIsEditAnnouncementDialogOpen] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState<Announcement | null>(null);
  const [editAnnouncementTitleInput, setEditAnnouncementTitleInput] = useState('');
  const [editAnnouncementContentInput, setEditAnnouncementContentInput] = useState('');

  const [isDeleteConfirmDialogOpen, setIsDeleteConfirmDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{ id: string; type: 'announcement' | 'material' | 'assignment' } | null>(null);


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
  const [isProcessing, setIsProcessing] = useState(false);


  const [isEditingTeacherPaymentDetails, setIsEditingTeacherPaymentDetails] = useState(false);
  const [teacherUpiIdInput, setTeacherUpiIdInput] = useState('');
  const [teacherBankAccountInput, setTeacherBankAccountInput] = useState('');
  const [teacherBankIfscInput, setTeacherBankIfscInput] = useState('');
  const [teacherBankNameInput, setTeacherBankNameInput] = useState('');
  
  const [isRefundDialogOpen, setIsRefundDialogOpen] = useState(false);
  const [refundAmountInput, setRefundAmountInput] = useState('');

  const getCurrencySymbol = (currencyCode?: string): string => {
    if (!currencyCode) return '$';
    const symbols: { [key: string]: string } = { USD: '$', EUR: '€', INR: '₹', GBP: '£' };
    return symbols[currencyCode.toUpperCase()] || currencyCode + ' ';
  };


  useEffect(() => {
    if (authLoading) return; // Wait for auth state to be determined
    if (!classId || !db) return;
    setLoading(true);

    const classroomDocRef = doc(db, "classrooms", classId);
    const unsubClassroom = onSnapshot(classroomDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as Omit<ClassroomDetails, 'id' | 'announcements' | 'schedule' | 'assignments' | 'materials' | 'exams'>;
        const classData: ClassroomDetails = {
          ...data,
          id: docSnap.id,
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(),
          scheduleLastUpdated: data.scheduleLastUpdated?.toDate ? data.scheduleLastUpdated.toDate() : new Date(),
          feeDetails: data.feeDetails || { totalFee: 0, paidAmount: 0, currency: 'USD' },
          schedule: data.schedule || [],
          subjects: data.subjects || [],
        };
        setClassroom(classData);

        if (classData.feeDetails) {
            setEditableFeeDetails({
              totalFee: String(classData.feeDetails.totalFee),
              paidAmount: String(classData.feeDetails.paidAmount),
              nextDueDate: classData.feeDetails.nextDueDate || '',
              currency: classData.feeDetails.currency || 'USD',
            });
        }
        if (classData.teacherUpiId) setTeacherUpiIdInput(classData.teacherUpiId);
        if (classData.teacherBankAccount) setTeacherBankAccountInput(classData.teacherBankAccount);
        if (classData.teacherBankIfsc) setTeacherBankIfscInput(classData.teacherBankIfsc);
        if (classData.teacherBankName) setTeacherBankNameInput(classData.teacherBankName);

      } else {
        toast({ variant: "destructive", title: "Error", description: "Class not found." });
        router.push('/dashboard/classes');
      }
      setLoading(false);
    }, (error: any) => {
      console.error("Error fetching classroom details:", error);
      let desc = "Could not load class details.";
      if (error.code === 'permission-denied') {
        desc = "Permission denied fetching class details. Please check Firestore security rules.";
      }
      toast({ variant: "destructive", title: "Error", description: desc });
      setLoading(false);
    });

    const unsubFunctions: (() => void)[] = [unsubClassroom];

    const announcementsColRef = collection(db, "classrooms", classId, "announcements");
    const announcementsQuery = query(announcementsColRef, orderBy("date", "desc"));
    unsubFunctions.push(onSnapshot(announcementsQuery, (snapshot) => {
        setAnnouncements(snapshot.docs.map(d => ({ id: d.id, ...d.data(), date: d.data().date?.toDate() } as Announcement)));
    }));

    const assignmentsColRef = collection(db, "classrooms", classId, "assignments");
    const assignmentsQuery = query(assignmentsColRef, orderBy("dueDate", "desc"));
    unsubFunctions.push(onSnapshot(assignmentsQuery, (snapshot) => {
        setAssignments(snapshot.docs.map(d => ({ id: d.id, ...d.data(), dueDate: d.data().dueDate?.toDate() } as Assignment)));
    }));
    
    const materialsColRef = collection(db, "classrooms", classId, "materials");
    unsubFunctions.push(onSnapshot(materialsColRef, (snapshot) => {
        setMaterials(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Material)));
    }));

    const examsColRef = collection(db, "exams");
    const examsQuery = query(examsColRef, where("classId", "==", classId));
     unsubFunctions.push(onSnapshot(examsQuery, (snapshot) => {
        const fetchedExams = snapshot.docs.map(d => ({ id: d.id, ...d.data(), dueDateTime: d.data().dueDateTime?.toDate() } as ClassExam));
        fetchedExams.sort((a, b) => new Date(b.dueDateTime).getTime() - new Date(a.dueDateTime).getTime());
        setExams(fetchedExams);
    }));


    return () => unsubFunctions.forEach(unsub => unsub());
  }, [classId, router, toast, authLoading]);

  const handleJoinDiscussion = () => {
    if (classroom) {
      router.push(`/dashboard/class/${classroom.id}/chat?name=${encodeURIComponent(classroom.name)}`);
    }
  };

  const handleStartClassMeeting = () => {
    if (!user || !classroom) return;
    router.push(`/dashboard/meeting/${classroom.id}/wait?topic=${encodeURIComponent(classroom.name)}`);
  };
  
  const isCurrentUserTeacher = user?.uid === classroom?.teacherId;

  const handleDialogPostAnnouncement = async () => {
    if (!postAnnouncementTitleInput.trim() || !postAnnouncementContentInput.trim() || !classId || !isCurrentUserTeacher) return;
    try {
      await addDoc(collection(db, "classrooms", classId, "announcements"), {
        title: postAnnouncementTitleInput.trim(),
        content: postAnnouncementContentInput.trim(),
        date: serverTimestamp(),
        authorId: user?.uid,
        authorName: user?.displayName || "Teacher",
      });
      toast({ title: "Announcement Posted" });
      setIsPostAnnouncementDialogOpen(false);
      setPostAnnouncementTitleInput(''); setPostAnnouncementContentInput('');
    } catch (error: any) {
      let desc = "Could not post announcement.";
      if (error.code === 'permission-denied') {
        desc = "Permission denied to post announcement. Check Firestore rules for 'classrooms/{classId}/announcements'.";
      }
      toast({ variant: "destructive", title: "Error", description: desc });
    }
  };

  const handleOpenEditAnnouncementDialog = (announcement: Announcement) => {
    setEditingAnnouncement(announcement);
    setEditAnnouncementTitleInput(announcement.title);
    setEditAnnouncementContentInput(announcement.content);
    setIsEditAnnouncementDialogOpen(true);
  };

  const handleDialogUpdateAnnouncement = async () => {
    if (!editingAnnouncement || !editAnnouncementTitleInput.trim() || !editAnnouncementContentInput.trim() || !classId || !isCurrentUserTeacher) return;
    try {
      const announcementRef = doc(db, "classrooms", classId, "announcements", editingAnnouncement.id);
      await updateDoc(announcementRef, {
        title: editAnnouncementTitleInput.trim(),
        content: editAnnouncementContentInput.trim(),
        date: serverTimestamp(), 
      });
      toast({ title: "Announcement Updated" });
      setIsEditAnnouncementDialogOpen(false); setEditingAnnouncement(null);
    } catch (error: any) {
      let desc = "Could not update announcement.";
      if (error.code === 'permission-denied') {
        desc = "Permission denied to update announcement. Check Firestore rules.";
      }
      toast({ variant: "destructive", title: "Error", description: desc });
    }
  };

  const handleOpenDeleteConfirmDialog = (id: string, type: 'announcement' | 'material' | 'assignment') => {
    setItemToDelete({ id, type });
    setIsDeleteConfirmDialogOpen(true);
  };

  const handleConfirmDeleteItem = async () => {
    if (!itemToDelete || !classId || !isCurrentUserTeacher) return;
    let itemRef;
    let itemTypeDisplay = itemToDelete.type.charAt(0).toUpperCase() + itemToDelete.type.slice(1);
    
    try {
      if (itemToDelete.type === 'announcement') {
        itemRef = doc(db, "classrooms", classId, "announcements", itemToDelete.id);
      } else if (itemToDelete.type === 'material') {
        itemRef = doc(db, "classrooms", classId, "materials", itemToDelete.id);
        const materialDoc = materials.find(m => m.id === itemToDelete.id);
        if (materialDoc?.filePath) {
          try { await deleteStorageObject(storageRef(storage, materialDoc.filePath)); } 
          catch (e) { console.warn("Error deleting material file from storage:", e); }
        }
      } else if (itemToDelete.type === 'assignment') {
        itemRef = doc(db, "classrooms", classId, "assignments", itemToDelete.id);
        const assignmentDoc = assignments.find(a => a.id === itemToDelete.id);
         if (assignmentDoc?.filePath) {
          try { await deleteStorageObject(storageRef(storage, assignmentDoc.filePath)); }
          catch (e) { console.warn("Error deleting assignment file from storage:", e); }
        }
      } else { return; }

      await deleteDoc(itemRef);
      toast({ title: `${itemTypeDisplay} Deleted` });
    } catch (error: any) {
      let desc = `Could not delete ${itemToDelete.type}.`;
      if (error.code === 'permission-denied') {
        desc = `Permission denied to delete ${itemToDelete.type}. Check Firestore/Storage rules.`;
      }
      toast({ variant: "destructive", title: "Error", description: desc });
    }
    setIsDeleteConfirmDialogOpen(false); setItemToDelete(null);
  };

  const handleOpenEditScheduleDialog = () => {
    setEditingScheduleItems(classroom?.schedule ? [...classroom.schedule] : []);
    setNewScheduleDayInput(''); setNewScheduleTimeInput(''); setNewScheduleTopicInput('');
    setIsEditScheduleDialogOpen(true);
  };
  
  const handleAddScheduleItemInDialog = () => {
    if (!newScheduleDayInput.trim() || !newScheduleTimeInput.trim()) {
      toast({ variant: "destructive", title: "Missing Day/Time" }); return;
    }
    setEditingScheduleItems(prev => [...prev, { id: `sched_${Date.now()}`, day: newScheduleDayInput.trim(), time: newScheduleTimeInput.trim(), topic: newScheduleTopicInput.trim() || undefined }]);
    setNewScheduleDayInput(''); setNewScheduleTimeInput(''); setNewScheduleTopicInput('');
  };
  
  const handleRemoveScheduleItemInDialog = (itemId: string) => {
    setEditingScheduleItems(prev => prev.filter(item => item.id !== itemId));
  };

  const handleSaveChangesToSchedule = async () => {
    if (!classId || !isCurrentUserTeacher) return;
    try {
      const classroomRef = doc(db, "classrooms", classId);
      await updateDoc(classroomRef, {
        schedule: editingScheduleItems,
        scheduleLastUpdated: serverTimestamp(),
      });
      toast({ title: "Schedule Updated" });
      setIsEditScheduleDialogOpen(false);
    } catch (error: any) {
      let desc = "Could not update schedule.";
      if (error.code === 'permission-denied') {
        desc = "Permission denied to update schedule. Check Firestore rules.";
      }
      toast({ variant: "destructive", title: "Error", description: desc });
    }
  };

  const handleMaterialFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; if (file) setNewMaterialFile(file); else setNewMaterialFile(null);
  };

  const resetUploadMaterialDialog = () => {
    setNewMaterialTitle(''); setNewMaterialDescription(''); setNewMaterialType('link'); setNewMaterialUrl(''); setNewMaterialFile(null);
    if (materialFileRef.current) materialFileRef.current.value = ''; setIsUploadingMaterial(false);
  };

  const handleAddMaterial = async () => {
    if (!newMaterialTitle.trim() || !classId || !isCurrentUserTeacher || !user) return;
    if (newMaterialType === 'link' && !newMaterialUrl.trim()) { toast({ variant: 'destructive', title: 'Missing URL' }); return; }
    if (newMaterialType === 'file' && !newMaterialFile) { toast({ variant: 'destructive', title: 'No File Selected' }); return; }
    
    setIsUploadingMaterial(true);
    let materialData: Omit<Material, 'id'>;

    try {
      if (newMaterialType === 'file' && newMaterialFile) {
        const fileName = `${Date.now()}_${newMaterialFile.name.replace(/\s+/g, '_')}`;
        const filePath = `class_materials/${classId}/${user.uid}/${fileName}`;
        const fileUploadRef = storageRef(storage, filePath);
        await uploadBytesResumable(fileUploadRef, newMaterialFile);
        const downloadURL = await getDownloadURL(fileUploadRef);
        materialData = { title: newMaterialTitle.trim(), description: newMaterialDescription.trim() || undefined, type: 'file', fileName: newMaterialFile.name, filePath: filePath, url: downloadURL };
      } else if (newMaterialType === 'link') {
        materialData = { title: newMaterialTitle.trim(), description: newMaterialDescription.trim() || undefined, type: 'link', url: newMaterialUrl.trim() };
      } else if (newMaterialType === 'video') { 
         materialData = { title: newMaterialTitle.trim(), description: newMaterialDescription.trim() || undefined, type: 'video', url: newMaterialUrl.trim() };
      } else { setIsUploadingMaterial(false); return; }
      
      await addDoc(collection(db, "classrooms", classId, "materials"), materialData);
      toast({ title: "Material Added" });
      setIsUploadMaterialDialogOpen(false); resetUploadMaterialDialog();
    } catch (error: any) {
      let desc = "Could not add material.";
      if (error.code === 'permission-denied') {
        desc = "Permission denied to add material. Check Firestore/Storage rules for 'classrooms/{classId}/materials'.";
      } else if (error.code && error.code.includes('storage/unauthorized')) {
        desc = "Permission denied for material file upload. Check Firebase Storage rules for 'class_materials'.";
      }
      toast({ variant: "destructive", title: "Error", description: desc });
      setIsUploadingMaterial(false);
    }
  };

  const handleTriggerAssignmentUploadDialog = () => { 
    setSelectedAssignmentTitleForUpload(''); 
    setSelectedAssignmentDescriptionForUpload('');
    setSelectedAssignmentDueDateForUpload(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)); 
    setIsAssignmentUploadDialogOpen(true); 
  };

  const handleFileSelectedForAssignment = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; 
    if (event.target) event.target.value = ""; 

    if (!selectedAssignmentTitleForUpload || !selectedAssignmentDueDateForUpload || !classId || !isCurrentUserTeacher || !user) {
        toast({ variant: "destructive", title: "Internal Error", description: "Assignment context missing." });
        setIsAssignmentUploadDialogOpen(false);
        return;
    }

    setIsUploadingMaterial(true); 
    
    let assignmentData: Omit<Assignment, 'id' | 'status'> = {
        title: selectedAssignmentTitleForUpload.trim(),
        description: selectedAssignmentDescriptionForUpload.trim() || undefined,
        dueDate: Timestamp.fromDate(selectedAssignmentDueDateForUpload),
        teacherId: user.uid
    };
    
    try {
        if (file) {
            const fileName = `${Date.now()}_${file.name.replace(/\s+/g, '_')}`;
            const filePath = `class_assignments/${classId}/${user.uid}/${fileName}`;
            const fileUploadRef = storageRef(storage, filePath);
            await uploadBytesResumable(fileUploadRef, file);
            // const downloadURL = await getDownloadURL(fileUploadRef); // Not always needed by student.
            assignmentData.filePath = filePath;
            assignmentData.fileName = file.name;
        }
        
        await addDoc(collection(db, "classrooms", classId, "assignments"), assignmentData);
        toast({ title: "Assignment Added", description: `"${assignmentData.title}" with${file ? ` file ${file.name}` : ' no file'} added.` });
        setIsAssignmentUploadDialogOpen(false); 
        setSelectedAssignmentTitleForUpload(null); setSelectedAssignmentDescriptionForUpload(''); 
    } catch (error: any) {
      let desc = "Could not add assignment.";
      if (error.code === 'permission-denied') {
        desc = "Permission denied to add assignment. Check Firestore rules for 'classrooms/{classId}/assignments'.";
      } else if (error.code && error.code.includes('storage/unauthorized')) {
         desc = "Permission denied for assignment file upload. Check Firebase Storage rules for 'class_assignments'.";
      }
      toast({ variant: "destructive", title: "Error", description: desc });
    } finally {
        setIsUploadingMaterial(false);
    }
  };
  
  const makePaymentToast = (method: string, remainingFee: number, classroomName: string, currency: string) => {
    const developerCut = remainingFee * 0.02;
    const teacherReceives = remainingFee - developerCut;
    const currencySymbol = getCurrencySymbol(currency);
    return {
      title: `Processing with ${method}`,
      description: `Payment of ${currencySymbol}${remainingFee.toFixed(2)} for ${classroomName} is being processed. ${currencySymbol}${teacherReceives.toFixed(2)} to teacher, ${currencySymbol}${developerCut.toFixed(2)} to developer (UPI: 07arman2004-1@oksbi).`,
      duration: 8000,
    };
  };
  const handleCardPaymentSubmit = async () => {
    if (!cardNumber || !cardExpiry || !cardCvv || !cardName || !classroom?.feeDetails || !classId) {
        toast({ variant: "destructive", title: "Missing Card Information" }); return;
    }
    const amountForTheCurrentPayment = classroom.feeDetails.totalFee - classroom.feeDetails.paidAmount;
    if (amountForTheCurrentPayment <=0) { toast({ title: "Fully Paid" }); return; }

    setIsProcessing(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1500));
      const newPaidAmount = classroom.feeDetails.totalFee;
      const updatedFeeDetails: FeeDetails = { ...classroom.feeDetails, paidAmount: newPaidAmount };
      
      const classroomRef = doc(db, "classrooms", classId);
      await updateDoc(classroomRef, { feeDetails: updatedFeeDetails });

      toast({ title: "Card Payment Successful (Mock)", description: `Payment for ${classroom?.name} processed. Fee is now fully paid.`, duration: 10000 });
      setIsCardPaymentDialogOpen(false); setCardNumber(''); setCardExpiry(''); setCardCvv(''); setCardName('');
    } catch (error: any) {
      let desc = "Could not process card payment.";
      if (error.code === 'permission-denied') {
        desc = "Permission denied to update fee details after payment. Check Firestore rules.";
      }
      toast({ variant: "destructive", title: "Payment Error", description: desc });
    } finally {
        setIsProcessing(false);
    }
  };
  const handleMockPayment = (method: string) => {
    if (!classroom || !classroom.feeDetails) { toast({ variant: "destructive", title: "Error", description: "Fee details missing." }); setIsPaymentDialogOpen(false); return; }
    const remainingFee = classroom.feeDetails.totalFee - classroom.feeDetails.paidAmount;
    if (remainingFee <= 0) { toast({ title: "No Payment Due" }); setIsPaymentDialogOpen(false); return; }
    
    const currentCurrency = classroom.feeDetails.currency || 'USD';
    if (method === "Credit/Debit Card") { setIsPaymentDialogOpen(false); setIsCardPaymentDialogOpen(true); return; }

    toast(makePaymentToast(method, remainingFee, classroom.name, currentCurrency));
    if (method === "Google Pay / UPI" && classroom.teacherUpiId) { window.open(`upi://pay?pa=${encodeURIComponent(classroom.teacherUpiId)}&pn=${encodeURIComponent(classroom.teacherName)}&am=${(remainingFee * 0.98).toFixed(2)}&cu=${currentCurrency}&tn=ClassFee`, '_blank'); }
    else if (method === "PhonePe" && classroom.teacherUpiId) { window.open(`phonepe://pay?pa=${encodeURIComponent(classroom.teacherUpiId)}&pn=${encodeURIComponent(classroom.teacherName)}&am=${(remainingFee * 0.98).toFixed(2)}&cu=${currentCurrency}&tn=ClassFee`, '_blank'); }
    else if (method === "Net Banking") { 
        const htmlContent = `<!DOCTYPE html><body><h1>Mock Net Banking for ${classroom.name}</h1><p>Amount: ${getCurrencySymbol(currentCurrency)}${remainingFee.toFixed(2)}</p><p>Pay to: ${classroom.teacherBankName || 'N/A'} - Acc: ${classroom.teacherBankAccount || 'N/A'} (IFSC: ${classroom.teacherBankIfsc || 'N/A'})</p><p>2% to developer.</p><button onclick="window.close()">Close</button></body></html>`;
        const dataUri = `data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`;
        window.open(dataUri, '_blank');
    }
    setIsPaymentDialogOpen(false);
  };

  const handleExamCreated = (newExam: any) => { 
    toast({ title: "Exam Scheduled (From Class)", description: `${newExam.title} has been scheduled for this class.` });
  };
  
  const handleToggleEditFeeDetails = () => setIsEditingFeeDetails(!isEditingFeeDetails);
  const handleSaveFeeDetails = async () => {
    if (!editableFeeDetails || !classroom || !classId || !isCurrentUserTeacher) return;
    const newTotalFee = parseFloat(editableFeeDetails.totalFee); const newPaidAmount = parseFloat(editableFeeDetails.paidAmount);
    if (isNaN(newTotalFee) || newTotalFee < 0 || isNaN(newPaidAmount) || newPaidAmount < 0 || newPaidAmount > newTotalFee) {
      toast({ variant: "destructive", title: "Invalid Input", description: "Fee amounts invalid or paid > total." }); return;
    }
    const newFeeDetails: FeeDetails = { 
      totalFee: newTotalFee, paidAmount: newPaidAmount, 
      nextDueDate: editableFeeDetails.nextDueDate.trim() || undefined, 
      currency: editableFeeDetails.currency || 'USD' 
    };
    try {
      const classroomRef = doc(db, "classrooms", classId);
      await updateDoc(classroomRef, { feeDetails: newFeeDetails });
      toast({ title: "Fee Details Updated" });
      setIsEditingFeeDetails(false);
    } catch (error: any) {
      let desc = "Could not update fee details.";
      if (error.code === 'permission-denied') {
        desc = "Permission denied to update fee details. Check Firestore rules.";
      }
      toast({ variant: "destructive", title: "Error", description: desc });
    }
  };

  const handleToggleEditTeacherPaymentDetails = () => setIsEditingTeacherPaymentDetails(!isEditingTeacherPaymentDetails);
  const handleSaveTeacherPaymentDetails = async () => {
    if (!classroom || !classId || !isCurrentUserTeacher) return;
    if (teacherUpiIdInput && !/^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/.test(teacherUpiIdInput)) { toast({ variant: "destructive", title: "Invalid UPI ID" }); return; }
    if (teacherBankAccountInput && (teacherBankAccountInput.length < 5 || teacherBankAccountInput.length > 20 || !/^\d+$/.test(teacherBankAccountInput))) { toast({ variant: "destructive", title: "Invalid Bank Account" }); return; }
    if (teacherBankIfscInput && !/^[A-Za-z]{4}0[A-Z0-9]{6}$/.test(teacherBankIfscInput)) { toast({ variant: "destructive", title: "Invalid IFSC Code" }); return; }
    
    try {
      const classroomRef = doc(db, "classrooms", classId);
      await updateDoc(classroomRef, {
        teacherUpiId: teacherUpiIdInput.trim() || null,
        teacherBankAccount: teacherBankAccountInput.trim() || null,
        teacherBankIfsc: teacherBankIfscInput.trim().toUpperCase() || null,
        teacherBankName: teacherBankNameInput.trim() || null,
      });
      toast({ title: "Payment Details Updated" });
      setIsEditingTeacherPaymentDetails(false);
    } catch (error: any) {
      let desc = "Could not update payment details.";
       if (error.code === 'permission-denied') {
        desc = "Permission denied to update payment details. Check Firestore rules.";
      }
      toast({ variant: "destructive", title: "Error", description: desc });
    }
  };
  
  const handleConfirmRefund = async () => {
    if (!classroom || !classroom.feeDetails || !editableFeeDetails || !classId || !isCurrentUserTeacher) return;
    const amountToRefund = parseFloat(refundAmountInput);
    if (isNaN(amountToRefund) || amountToRefund <= 0 || amountToRefund > classroom.feeDetails.paidAmount) {
      toast({ variant: "destructive", title: "Invalid Refund Amount" }); return;
    }
    const newPaidAmount = classroom.feeDetails.paidAmount - amountToRefund;
    const updatedFeeDetails: FeeDetails = { ...classroom.feeDetails, paidAmount: newPaidAmount };
    try {
      const classroomRef = doc(db, "classrooms", classId);
      await updateDoc(classroomRef, { feeDetails: updatedFeeDetails });
      toast({ title: "Refund Processed (Mock)", description: `${getCurrencySymbol(classroom.feeDetails.currency)}${amountToRefund.toFixed(2)} conceptually refunded.` });
      setIsRefundDialogOpen(false); setRefundAmountInput('');
    } catch (error: any) {
      let desc = "Could not process refund.";
      if (error.code === 'permission-denied') {
        desc = "Permission denied to update fee details for refund. Check Firestore rules.";
      }
      toast({ variant: "destructive", title: "Refund Error", description: desc });
    }
  };


  if (loading || authLoading) {
    return ( <div className="flex flex-col items-center justify-center h-full p-8"><Card className="w-full max-w-4xl p-8 rounded-xl shadow-xl border-border/50"><CardHeader><div className="h-8 bg-muted rounded w-3/4 mx-auto mb-2"></div><div className="h-4 bg-muted rounded w-1/2 mx-auto"></div></CardHeader><CardContent className="space-y-6 mt-6"><div className="h-40 bg-muted rounded-lg w-full"></div><div className="space-y-2"><div className="h-4 bg-muted rounded w-full"></div><div className="h-4 bg-muted rounded w-5/6"></div></div><div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">{[...Array(6)].map((_, i) => (<div key={i} className="h-24 bg-muted rounded-lg"></div>))}</div></CardContent></Card></div>);
  }
  if (!classroom) {
    return ( <div className="flex flex-col items-center justify-center h-full p-8 text-center"><AlertTriangle className="h-16 w-16 text-destructive mb-4" /><h1 className="text-2xl font-bold text-destructive mb-2">Class Not Found</h1><p className="text-muted-foreground mb-6">Details for ID &quot;{classId}&quot; could not be loaded.</p><Button onClick={() => router.push('/dashboard/classes')} variant="outline" className="rounded-lg"><ArrowLeft className="mr-2 h-4 w-4" /> Back to All Classes</Button></div>);
  }
  
  const currentRemainingFee = editableFeeDetails && classroom?.feeDetails
    ? parseFloat(editableFeeDetails.totalFee || '0') - parseFloat(editableFeeDetails.paidAmount || '0')
    : classroom?.feeDetails
    ? classroom.feeDetails.totalFee - classroom.feeDetails.paidAmount
    : 0;
  const currentCurrencySymbol = getCurrencySymbol(classroom.feeDetails?.currency);

  return (
    <div className="space-y-8 p-4 md:p-8">
      <input type="file" ref={assignmentFileRef} onChange={handleFileSelectedForAssignment} accept=".pdf,.doc,.docx,.txt,image/*,video/*,audio/*" style={{ display: 'none' }} />
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
                <p className="text-sm text-slate-200 shadow-sm">Managed by {classroom.teacherName}</p>
            </div>
          </div>
          <div className="absolute top-4 right-4"><Badge variant="secondary" className="text-xs shadow-md rounded-md"><Users className="mr-1.5 h-3.5 w-3.5"/> {classroom.memberCount} Members</Badge></div>
        </div>

        <CardContent className="p-6 space-y-8">
          <div><h2 className="text-xl font-semibold text-foreground mb-2">About this Class</h2><p className="text-muted-foreground whitespace-pre-line">{classroom.description}</p></div>
          
          <Card className="rounded-lg shadow-md border-border/30">
            <CardHeader><CardTitle className="flex items-center text-lg"><BookOpen className="mr-2 h-5 w-5 text-primary" />Subjects &amp; Teachers</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm max-h-72 overflow-y-auto">
              {(classroom.subjects && classroom.subjects.length > 0) ? classroom.subjects.map((subject, index) => (
                <div key={index} className="flex items-center justify-between p-2 rounded-md hover:bg-muted/50">
                  <p className="font-semibold text-foreground">{subject.subjectName}</p>
                  <div className="flex items-center gap-2">
                    <Avatar className="h-6 w-6">
                      <AvatarImage src={subject.teacherAvatar} alt={subject.teacherName} data-ai-hint="teacher avatar" />
                      <AvatarFallback>{subject.teacherName.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <span className="text-muted-foreground">{subject.teacherName}</span>
                  </div>
                </div>
              )) : <p className="text-muted-foreground text-center py-2">No subjects or teachers assigned yet.</p>}
            </CardContent>
            {isCurrentUserTeacher && (<CardFooter><Button asChild variant="outline" className="w-full rounded-lg text-sm"><Link href={`/dashboard/class/${classId}/edit?name=${encodeURIComponent(classroom.name)}#subjects`}><Edit2 className="mr-2 h-4 w-4" /> Manage Subjects & Teachers</Link></Button></CardFooter>)}
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="rounded-lg shadow-md border-border/30">
              <CardHeader><CardTitle className="flex items-center text-lg"><Megaphone className="mr-2 h-5 w-5 text-primary" />Announcements</CardTitle></CardHeader>
              <CardContent className="space-y-3 text-sm max-h-72 overflow-y-auto">
                {announcements.length ? announcements.map((item) => (
                  <div key={item.id} className="pb-3 border-b border-border/20 last:border-b-0 group">
                    <div className="flex justify-between items-start">
                        <p className="font-semibold text-foreground flex-grow">{item.title} <span className="text-xs text-muted-foreground">({item.date ? format(item.date, "MMM d, yyyy") : 'N/A'})</span></p>
                        {isCurrentUserTeacher && (<div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity"><Button variant="ghost" size="icon" className="h-7 w-7 rounded-md" onClick={() => handleOpenEditAnnouncementDialog(item)}><Edit2 className="h-4 w-4 text-blue-500" /></Button><Button variant="ghost" size="icon" className="h-7 w-7 rounded-md" onClick={() => handleOpenDeleteConfirmDialog(item.id, 'announcement')}><Trash2 className="h-4 w-4 text-destructive" /></Button></div>)}
                    </div><p className="text-muted-foreground mt-0.5">{item.content}</p></div>)) : <p className="text-muted-foreground">No announcements.</p>}
              </CardContent>
              {isCurrentUserTeacher && (<CardFooter><Dialog open={isPostAnnouncementDialogOpen} onOpenChange={(isOpen) => { if (!isOpen) { setPostAnnouncementTitleInput(''); setPostAnnouncementContentInput(''); } setIsPostAnnouncementDialogOpen(isOpen); }}><DialogTrigger asChild><Button variant="outline" className="w-full rounded-lg text-sm"><PlusCircle className="mr-2 h-4 w-4" /> Post Announcement</Button></DialogTrigger>{isPostAnnouncementDialogOpen && (<DialogContent className="sm:max-w-lg rounded-xl"><DialogHeader><ShadDialogTitle>New Announcement</ShadDialogTitle><DialogDescription>Share updates with your class.</DialogDescription></DialogHeader><div className="grid gap-4 py-4"><div className="grid gap-2"><Label htmlFor="postAnnouncementTitle">Title</Label><Input id="postAnnouncementTitle" value={postAnnouncementTitleInput} onChange={(e) => setPostAnnouncementTitleInput(e.target.value)} placeholder="e.g., Important Update" className="rounded-lg"/></div><div className="grid gap-2"><Label htmlFor="postAnnouncementContent">Content</Label><Textarea id="postAnnouncementContent" value={postAnnouncementContentInput} onChange={(e) => setPostAnnouncementContentInput(e.target.value)} placeholder="Details of your announcement..." className="rounded-lg min-h-[100px]"/></div></div><DialogFooter><DialogClose asChild><Button type="button" variant="outline" className="rounded-lg">Cancel</Button></DialogClose><Button type="button" onClick={handleDialogPostAnnouncement} className="btn-gel rounded-lg">Post</Button></DialogFooter></DialogContent>)}</Dialog></CardFooter>)}
            </Card>
            <Card className="rounded-lg shadow-md border-border/30">
              <CardHeader><CardTitle className="flex items-center text-lg"><CalendarDays className="mr-2 h-5 w-5 text-primary" />Schedule &amp; Timings</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                {classroom.schedule?.length ? classroom.schedule.map((item) => (<div key={item.id} className="flex justify-between py-1 border-b border-border/10 last:border-b-0"><span className="text-foreground font-medium">{item.day}:</span><span className="text-muted-foreground">{item.time}{item.topic ? ` (${item.topic})` : ''}</span></div>)) : <p className="text-muted-foreground">Not available.</p>}
                {isCurrentUserTeacher && (<div className="mt-4"><Button variant="outline" className="w-full rounded-lg text-sm" onClick={handleOpenEditScheduleDialog}><Edit2 className="mr-2 h-4 w-4" /> Edit Schedule</Button></div>)}
              </CardContent>{classroom.scheduleLastUpdated && (<CardFooter className="border-t pt-3"><p className="text-xs text-muted-foreground">Last updated: {classroom.scheduleLastUpdated ? format(classroom.scheduleLastUpdated, "PP") : 'N/A'}</p></CardFooter>)}
            </Card>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="rounded-lg shadow-md border-border/30">
              <CardHeader><CardTitle className="flex items-center text-lg"><ClipboardList className="mr-2 h-5 w-5 text-primary" />Assignments</CardTitle></CardHeader>
              <CardContent className="space-y-3 text-sm max-h-72 overflow-y-auto">
                {assignments.length ? assignments.slice(0,3).map((item) => (<div key={item.id} className="pb-3 border-b border-border/20 last:border-b-0 group"><div className="flex justify-between items-start"><p className="font-semibold text-foreground">{item.title}</p><Badge variant="outline" className={`text-xs ml-2 ${getStatusColor(item.status)} rounded-md`}>{item.status}</Badge></div><p className="text-xs text-muted-foreground">Due: {item.dueDate ? format(item.dueDate, "PP") : 'N/A'}</p>{item.description && <p className="text-muted-foreground mt-0.5 text-xs">{item.description}</p>}<div className="flex items-center justify-between mt-1"><Button asChild variant="link" size="sm" className="p-0 h-auto text-accent text-xs"><Link href={`/dashboard/class/${classId}/assignments?name=${encodeURIComponent(classroom.name)}#${item.id}`}>View Details</Link></Button>{isCurrentUserTeacher && <Button variant="ghost" size="icon" className="h-6 w-6 rounded-md opacity-0 group-hover:opacity-100" onClick={() => handleOpenDeleteConfirmDialog(item.id, 'assignment')}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>}</div></div>)) : <p className="text-muted-foreground">No assignments.</p>}
              </CardContent>
               <CardFooter className="flex flex-col sm:flex-row gap-2">
                <Button asChild variant="outline" className="w-full rounded-lg text-sm"><Link href={`/dashboard/class/${classId}/assignments?name=${encodeURIComponent(classroom.name)}`}>Check All Assignments</Link></Button>
                {isCurrentUserTeacher && (<Dialog open={isAssignmentUploadDialogOpen} onOpenChange={setIsAssignmentUploadDialogOpen}><DialogTrigger asChild><Button variant="default" className="w-full rounded-lg text-sm btn-gel" onClick={handleTriggerAssignmentUploadDialog}><UploadCloud className="mr-2 h-4 w-4" /> Upload Assignment</Button></DialogTrigger>{isAssignmentUploadDialogOpen && (<DialogContent className="sm:max-w-md rounded-xl"><DialogHeader><ShadDialogTitle>Upload New Assignment</ShadDialogTitle><DialogDescription>Provide assignment details and optionally upload a file.</DialogDescription></DialogHeader><div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto px-1"><div className="grid gap-2"><Label htmlFor="dialogAssignmentTitle">Assignment Title*</Label><Input id="dialogAssignmentTitle" value={selectedAssignmentTitleForUpload || ''} onChange={(e) => setSelectedAssignmentTitleForUpload(e.target.value)} placeholder="e.g., Chapter 5 Quiz" className="rounded-lg"/></div><div className="grid gap-2"><Label htmlFor="dialogAssignmentDescription">Description (Optional)</Label><Textarea id="dialogAssignmentDescription" value={selectedAssignmentDescriptionForUpload} onChange={(e) => setSelectedAssignmentDescriptionForUpload(e.target.value)} placeholder="Instructions for students..." className="rounded-lg min-h-[80px]"/></div><div className="grid gap-2"><Label htmlFor="dialogAssignmentDueDate">Due Date*</Label><Input id="dialogAssignmentDueDate" type="date" value={selectedAssignmentDueDateForUpload ? format(selectedAssignmentDueDateForUpload, 'yyyy-MM-dd') : ''} onChange={(e) => setSelectedAssignmentDueDateForUpload(e.target.value ? parseISO(e.target.value) : undefined)} className="rounded-lg"/></div><div className="grid gap-2"><Label htmlFor="assignmentFileRef">Attach File (Optional)</Label><Input ref={assignmentFileRef} id="assignmentFileRefTrigger" type="file" onChange={handleFileSelectedForAssignment} accept=".pdf,.doc,.docx,.txt,image/*,video/*,audio/*" className="rounded-lg file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"/></div></div><DialogFooter><DialogClose asChild><Button type="button" variant="outline" className="rounded-lg">Cancel</Button></DialogClose><Button type="button" onClick={() => handleFileSelectedForAssignment({ target: { files: assignmentFileRef.current?.files } } as any)} className="btn-gel rounded-lg" disabled={!selectedAssignmentTitleForUpload?.trim() || !selectedAssignmentDueDateForUpload || isUploadingMaterial}>{isUploadingMaterial ? "Saving..." : "Save Assignment"}</Button></DialogFooter></DialogContent>)}</Dialog>)}
              </CardFooter>
            </Card>
            <Card className="rounded-lg shadow-md border-border/30">
              <CardHeader><CardTitle className="flex items-center text-lg"><FileIcon className="mr-2 h-5 w-5 text-primary" />Class Materials</CardTitle></CardHeader>
              <CardContent className="space-y-3 text-sm max-h-72 overflow-y-auto">
                {materials.length ? materials.map((item) => (<div key={item.id} className="pb-3 border-b border-border/20 last:border-b-0 group"><div className="flex items-center"><MaterialIcon type={item.type}/><p className="font-semibold text-foreground flex-grow truncate" title={item.title}>{item.title}</p>{isCurrentUserTeacher && <Button variant="ghost" size="icon" className="h-6 w-6 rounded-md opacity-0 group-hover:opacity-100" onClick={() => handleOpenDeleteConfirmDialog(item.id, 'material')}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>}</div>{item.description && <p className="text-muted-foreground mt-0.5 text-xs ml-7">{item.description}</p>}<Button asChild variant="link" size="sm" className="p-0 h-auto text-accent text-xs mt-1 ml-7">{item.url ? (<Link href={item.url} target={(item.type === 'link' || item.type === 'video') && !item.url.startsWith('/') ? '_blank' : '_self'} rel="noopener noreferrer">{item.type === 'file' && item.fileName ? 'Download File' : 'Open Link'}</Link>) : (<span>{item.type === 'file' && item.fileName ? 'Download File' : 'Open Link'}</span>)}</Button></div>)) : <p className="text-muted-foreground">No materials.</p>}
              </CardContent>
               <CardFooter className="flex flex-col sm:flex-row gap-2">
                {isCurrentUserTeacher && (<Dialog open={isUploadMaterialDialogOpen} onOpenChange={(isOpen) => { if (!isOpen) resetUploadMaterialDialog(); setIsUploadMaterialDialogOpen(isOpen); }}><DialogTrigger asChild><Button variant="default" className="w-full rounded-lg text-sm btn-gel"><UploadCloud className="mr-2 h-4 w-4" /> Upload Material</Button></DialogTrigger>{isUploadMaterialDialogOpen && (<DialogContent className="sm:max-w-lg rounded-xl"><DialogHeader><ShadDialogTitle>Upload New Material</ShadDialogTitle><DialogDescription>Add a link or upload a file for your class.</DialogDescription></DialogHeader><div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto px-1"><div className="grid gap-2"><Label htmlFor="newMaterialTitle">Title*</Label><Input id="newMaterialTitle" value={newMaterialTitle} onChange={(e) => setNewMaterialTitle(e.target.value)} placeholder="e.g., Week 1 Slides" className="rounded-lg" disabled={isUploadingMaterial}/></div><div className="grid gap-2"><Label htmlFor="newMaterialDescription">Description (Optional)</Label><Textarea id="newMaterialDescription" value={newMaterialDescription} onChange={(e) => setNewMaterialDescription(e.target.value)} placeholder="Briefly describe the material..." className="rounded-lg min-h-[70px]" disabled={isUploadingMaterial}/></div><div className="grid gap-2"><Label>Type*</Label><RadioGroup value={newMaterialType} onValueChange={(value: 'link' | 'file' | 'video') => setNewMaterialType(value as 'link' | 'file')} className="flex gap-4" disabled={isUploadingMaterial}><div className="flex items-center space-x-2"><RadioGroupItem value="link" id="type-link" /><Label htmlFor="type-link" className="font-normal flex items-center"><Link2 className="mr-1 h-4 w-4"/>Link</Label></div><div className="flex items-center space-x-2"><RadioGroupItem value="file" id="type-file" /><Label htmlFor="type-file" className="font-normal flex items-center"><FileUp className="mr-1 h-4 w-4"/>File</Label></div><div className="flex items-center space-x-2"><RadioGroupItem value="video" id="type-video" /><Label htmlFor="type-video" className="font-normal flex items-center"><VideoIconLucide className="mr-1 h-4 w-4"/>Video URL</Label></div></RadioGroup></div>{(newMaterialType === 'link' || newMaterialType === 'video') && (<div className="grid gap-2"><Label htmlFor="newMaterialUrl">URL*</Label><Input id="newMaterialUrl" type="url" value={newMaterialUrl} onChange={(e) => setNewMaterialUrl(e.target.value)} placeholder={newMaterialType === 'link' ? "https://example.com/resource" : "https://youtube.com/watch?v=..."} className="rounded-lg" disabled={isUploadingMaterial}/></div>)}{newMaterialType === 'file' && (<div className="grid gap-2"><Label htmlFor="newMaterialFile">File*</Label><Input ref={materialFileRef} id="newMaterialFile" type="file" onChange={handleMaterialFileChange} className="rounded-lg file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20" disabled={isUploadingMaterial}/>{newMaterialFile && <p className="text-xs text-muted-foreground">Selected: {newMaterialFile.name}</p>}</div>)}</div><DialogFooter><DialogClose asChild><Button type="button" variant="outline" className="rounded-lg" disabled={isUploadingMaterial}>Cancel</Button></DialogClose><Button type="button" onClick={handleAddMaterial} className="btn-gel rounded-lg" disabled={isUploadingMaterial || !newMaterialTitle.trim() || (newMaterialType === 'link' && !newMaterialUrl.trim()) || (newMaterialType === 'file' && !newMaterialFile)}>{isUploadingMaterial ? "Adding..." : "Add Material"}</Button></DialogFooter></DialogContent>)}</Dialog>)}
                <Button asChild variant="outline" className="w-full rounded-lg text-sm"><Link href={`/dashboard/class/${classId}/materials?name=${encodeURIComponent(classroom.name)}`}>Browse All Materials</Link></Button>
              </CardFooter>
            </Card>
          </div>
          <Card className="rounded-lg shadow-md border-border/30">
            <CardHeader><CardTitle className="flex items-center text-lg"><ExamIcon className="mr-2 h-5 w-5 text-primary" />Exams</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm max-h-72 overflow-y-auto">
              {exams.length ? exams.slice(0,3).map((exam) => (<div key={exam.id} className="pb-3 border-b border-border/20 last:border-b-0"><div className="flex justify-between items-start"><p className="font-semibold text-foreground">{exam.title}</p><Badge variant="outline" className={`text-xs ml-2 ${getStatusColor(exam.status)} rounded-md`}>{exam.status}</Badge></div><p className="text-xs text-muted-foreground">Due: {exam.dueDateTime ? format(exam.dueDateTime, "PPp") : 'N/A'}</p><Button asChild variant="link" size="sm" className="p-0 h-auto text-accent text-xs mt-1"><Link href={`/dashboard/exam/${exam.id}?title=${encodeURIComponent(exam.title)}`}>View Exam</Link></Button></div>)) : <p className="text-muted-foreground">No exams for this class.</p>}
            </CardContent>
            <CardFooter className="flex flex-col sm:flex-row gap-2">
            {isCurrentUserTeacher && (<CreateExamDialog onExamCreated={handleExamCreated} classContext={{ classId: classroom.id, className: classroom.name }} />)}
              <Button asChild variant="outline" className="w-full rounded-lg text-sm"><Link href={`/dashboard/exams?classId=${classId}&className=${encodeURIComponent(classroom.name)}`}><Eye className="mr-2 h-4 w-4" /> View All Exams</Link></Button>
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
                      <div><Label htmlFor="teacherUpiId" className="text-xs">UPI ID</Label><div className="relative mt-1"><Hash className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input id="teacherUpiId" value={teacherUpiIdInput} onChange={(e) => setTeacherUpiIdInput(e.target.value)} placeholder="your@upi" className="rounded-lg h-9 text-sm pl-10"/></div></div>
                      <div><Label htmlFor="teacherBankName" className="text-xs">Bank Name</Label><div className="relative mt-1"><Building className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input id="teacherBankName" value={teacherBankNameInput} onChange={(e) => setTeacherBankNameInput(e.target.value)} placeholder="e.g., SBI" className="rounded-lg h-9 text-sm pl-10"/></div></div>
                      <div><Label htmlFor="teacherBankAccount" className="text-xs">Bank Account Number</Label><div className="relative mt-1"><LandmarkIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input id="teacherBankAccount" value={teacherBankAccountInput} onChange={(e) => setTeacherBankAccountInput(e.target.value)} placeholder="e.g., 123456789012" className="rounded-lg h-9 text-sm pl-10"/></div></div>
                      <div><Label htmlFor="teacherBankIfsc" className="text-xs">IFSC Code</Label><div className="relative mt-1"><Input id="teacherBankIfsc" value={teacherBankIfscInput} onChange={(e) => setTeacherBankIfscInput(e.target.value)} placeholder="e.g., SBIN0001234" className="rounded-lg h-9 text-sm"/></div></div>
                      <div className="flex gap-2 mt-2"><Button onClick={handleSaveTeacherPaymentDetails} className="btn-gel rounded-lg text-xs flex-1">Save</Button><Button onClick={handleToggleEditTeacherPaymentDetails} variant="outline" className="rounded-lg text-xs flex-1">Cancel</Button></div>
                    </div>
                  ) : (
                    classroom.teacherUpiId || classroom.teacherBankAccount ? (
                      <div className="space-y-1">
                        {classroom.teacherUpiId && <p>UPI ID: <span className="font-medium text-foreground">{classroom.teacherUpiId}</span></p>}
                        {classroom.teacherBankAccount && <p>Bank: <span className="font-medium text-foreground">{classroom.teacherBankName || 'N/A'} - Acct: ...{classroom.teacherBankAccount.slice(-4)} (IFSC: {classroom.teacherBankIfsc || 'N/A'})</span></p>}
                        <Button onClick={handleToggleEditTeacherPaymentDetails} variant="link" size="sm" className="p-0 h-auto text-accent text-xs mt-1">Edit</Button>
                      </div>
                    ) : ( <Button onClick={handleToggleEditTeacherPaymentDetails} variant="outline" className="w-full rounded-lg text-sm"><PlusCircle className="mr-2 h-4 w-4" /> Add Details</Button>)
                  )}
                  <p className="text-xs text-muted-foreground mt-2">Note: Student payments made to these details will have a 2% platform fee deducted for the developer (UPI: 07arman2004-1@oksbi).</p><Separator className="my-4" />
                </div>
              )}
              {!classroom.feeDetails && !isEditingFeeDetails && !editableFeeDetails?.currency ? (
                <p className="text-muted-foreground">Fee details not available.</p>
              ) : isCurrentUserTeacher && isEditingFeeDetails ? (
                <><div className="space-y-1"><Label htmlFor="feeCurrency" className="text-xs">Currency</Label><Select value={editableFeeDetails?.currency} onValueChange={(value) => setEditableFeeDetails(prev => prev ? { ...prev, currency: value } : null)}><SelectTrigger id="feeCurrency" className="rounded-lg h-9 text-sm"><SelectValue placeholder="Select currency" /></SelectTrigger><SelectContent><SelectItem value="USD">USD ($)</SelectItem><SelectItem value="EUR">EUR (€)</SelectItem><SelectItem value="INR">INR (₹)</SelectItem></SelectContent></Select></div>
                  <div className="space-y-1"><Label htmlFor="totalFee" className="text-xs">Class Total Fee ({currentCurrencySymbol})</Label><Input id="totalFee" type="number" value={editableFeeDetails?.totalFee} onChange={(e) => setEditableFeeDetails(prev => prev ? { ...prev, totalFee: e.target.value } : null)} className="rounded-lg h-9 text-sm" placeholder="e.g., 500"/></div>
                  <div className="space-y-1"><Label htmlFor="paidAmount" className="text-xs">Default Amount Paid ({currentCurrencySymbol})</Label><Input id="paidAmount" type="number" value={editableFeeDetails?.paidAmount} onChange={(e) => setEditableFeeDetails(prev => prev ? { ...prev, paidAmount: e.target.value } : null)} className="rounded-lg h-9 text-sm" placeholder="e.g., 0"/></div>
                   <p>Default Remaining: <span className="font-semibold text-destructive">{currentCurrencySymbol}{isNaN(currentRemainingFee) ? 'N/A' : currentRemainingFee.toFixed(2)}</span></p>
                  <div className="space-y-1"><Label htmlFor="nextDueDate" className="text-xs">Default Next Payment Due</Label><Input id="nextDueDate" type="date" value={editableFeeDetails?.nextDueDate} onChange={(e) => setEditableFeeDetails(prev => prev ? { ...prev, nextDueDate: e.target.value } : null)} className="rounded-lg h-9 text-sm"/></div></>
              ) : classroom.feeDetails ? (
                <><p>Class Total Fee: <span className="font-semibold text-foreground">{currentCurrencySymbol} {classroom.feeDetails.totalFee.toFixed(2)}</span></p><p>Your Amount Paid: <span className="font-semibold text-green-600">{currentCurrencySymbol} {classroom.feeDetails.paidAmount.toFixed(2)}</span></p><p>Your Remaining Fee: <span className="font-semibold text-destructive">{currentCurrencySymbol} {(classroom.feeDetails.totalFee - classroom.feeDetails.paidAmount).toFixed(2)}</span></p>{classroom.feeDetails.nextDueDate && (<p>Next Payment Due: {format(parseISO(classroom.feeDetails.nextDueDate), "PP")}</p>)}</>
              ) : ( <p className="text-muted-foreground">Class fee details not set up yet.</p> )}
            </CardContent>
            <CardFooter className="flex flex-col sm:flex-row gap-2">
              {isCurrentUserTeacher && !isEditingTeacherPaymentDetails && (<div className="w-full flex flex-col sm:flex-row gap-2">{isEditingFeeDetails ? (<><Button onClick={handleSaveFeeDetails} className="flex-1 btn-gel rounded-lg text-sm">Save Fee Details</Button><Button onClick={handleToggleEditFeeDetails} variant="outline" className="flex-1 rounded-lg text-sm">Cancel</Button></>) : (<><Button onClick={handleToggleEditFeeDetails} variant="outline" className="flex-1 rounded-lg text-sm"><Edit2 className="mr-2 h-4 w-4" /> Edit Fee Structure</Button>{classroom?.feeDetails && classroom.feeDetails.paidAmount > 0 && (<Button variant="outline" className="flex-1 rounded-lg text-sm border-orange-500 text-orange-500 hover:bg-orange-500/10 hover:text-orange-600" onClick={() => { setRefundAmountInput(''); setIsRefundDialogOpen(true);}}><Undo2 className="mr-2 h-4 w-4" /> Issue Refund</Button>)}</>)}</div>)}
              {!isEditingFeeDetails && !isCurrentUserTeacher && (<Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}><DialogTrigger asChild><Button className="w-full btn-gel rounded-lg text-sm" disabled={!classroom.feeDetails || currentRemainingFee <= 0}>{classroom.feeDetails && currentRemainingFee <= 0 ? "Fully Paid" : "Make Payment"}</Button></DialogTrigger>{isPaymentDialogOpen && (<DialogContent className="sm:max-w-md rounded-xl"><DialogHeader><ShadDialogTitle>Choose Payment Method</ShadDialogTitle><DialogDescription>Select preferred option. (Mock Interface) Note: A 2% platform fee will be applied, directed to developer (UPI: 07arman2004-1@oksbi). Remainder to teacher.</DialogDescription></DialogHeader><div className="grid gap-3 py-4"><Button variant="outline" className="rounded-lg justify-start py-3 text-base" onClick={() => handleMockPayment("Google Pay / UPI")}><Smartphone className="mr-3 h-5 w-5 text-blue-500" /> Google Pay / UPI</Button><Button variant="outline" className="rounded-lg justify-start py-3 text-base" onClick={() => handleMockPayment("PhonePe")}><Smartphone className="mr-3 h-5 w-5 text-purple-600" /> PhonePe</Button><Button variant="outline" className="rounded-lg justify-start py-3 text-base" onClick={() => handleMockPayment("Net Banking")}><Banknote className="mr-3 h-5 w-5 text-green-600" /> Net Banking</Button><Button variant="outline" className="rounded-lg justify-start py-3 text-base" onClick={() => handleMockPayment("Credit/Debit Card")}><CreditCard className="mr-3 h-5 w-5 text-orange-500" /> Credit/Debit Card</Button></div><DialogFooter><DialogClose asChild><Button type="button" variant="outline" className="rounded-lg">Cancel</Button></DialogClose></DialogFooter></DialogContent>)}</Dialog>)}
            </CardFooter>
          </Card>
          <div className="mt-8 text-center"><Button variant="default" size="lg" className="btn-gel rounded-lg py-3 px-8 text-base" onClick={handleJoinDiscussion}><MessageSquare className="mr-2 h-5 w-5"/> Join Class Discussion</Button></div>
        </CardContent>
      </Card>
      <Dialog open={isEditAnnouncementDialogOpen} onOpenChange={(isOpen) => { if (!isOpen) setEditingAnnouncement(null); setIsEditAnnouncementDialogOpen(isOpen); }}>{isEditAnnouncementDialogOpen && (<DialogContent className="sm:max-w-lg rounded-xl"><DialogHeader><ShadDialogTitle>Edit Announcement</ShadDialogTitle><DialogDescription>Modify the title and content of the announcement.</DialogDescription></DialogHeader><div className="grid gap-4 py-4"><div className="grid gap-2"><Label htmlFor="editAnnouncementTitle">Title</Label><Input id="editAnnouncementTitle" value={editAnnouncementTitleInput} onChange={(e) => setEditAnnouncementTitleInput(e.target.value)} className="rounded-lg"/></div><div className="grid gap-2"><Label htmlFor="editAnnouncementContent">Content</Label><Textarea id="editAnnouncementContent" value={editAnnouncementContentInput} onChange={(e) => setEditAnnouncementContentInput(e.target.value)} className="rounded-lg min-h-[100px]"/></div></div><DialogFooter><DialogClose asChild><Button type="button" variant="outline" className="rounded-lg">Cancel</Button></DialogClose><Button type="button" onClick={handleDialogUpdateAnnouncement} className="btn-gel rounded-lg">Save Changes</Button></DialogFooter></DialogContent>)}</Dialog>
      <AlertDialog open={isDeleteConfirmDialogOpen} onOpenChange={setIsDeleteConfirmDialogOpen}><AlertDialogContent className="rounded-xl"><AlertDialogHeader><ShadDialogTitle>Confirm Deletion</ShadDialogTitle><AlertDialogDescription>Are you sure you want to delete this {itemToDelete?.type}? This action cannot be undone.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel className="rounded-lg" onClick={() => setItemToDelete(null)}>Cancel</AlertDialogCancel><AlertDialogAction onClick={handleConfirmDeleteItem} className={cn(buttonVariants({ variant: "destructive", className: "rounded-lg" }))}>Delete</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
      <Dialog open={isEditScheduleDialogOpen} onOpenChange={setIsEditScheduleDialogOpen}>{isEditScheduleDialogOpen && (<DialogContent className="sm:max-w-lg rounded-xl"><DialogHeader><ShadDialogTitle>Edit Class Schedule</ShadDialogTitle><DialogDescription>Add, remove, or modify class schedule entries.</DialogDescription></DialogHeader><div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto">{editingScheduleItems.length > 0 ? (editingScheduleItems.map((item, index) => (<div key={item.id || index} className="flex items-center justify-between gap-2 p-2 border rounded-lg"><div className="flex-grow"><p className="text-sm font-medium">{item.day} - {item.time}</p>{item.topic && <p className="text-xs text-muted-foreground">{item.topic}</p>}</div><Button variant="ghost" size="icon" onClick={() => handleRemoveScheduleItemInDialog(item.id)} className="text-destructive h-8 w-8 rounded-md"><Trash2 className="h-4 w-4" /></Button></div>))) : (<p className="text-sm text-muted-foreground text-center py-4">No schedule entries yet.</p>)}<div className="pt-4 border-t"><Label className="text-sm font-medium block mb-2">Add New Entry</Label><div className="grid grid-cols-1 sm:grid-cols-2 gap-3"><Input value={newScheduleDayInput} onChange={(e) => setNewScheduleDayInput(e.target.value)} placeholder="Day (e.g., Monday)" className="rounded-lg"/><Input value={newScheduleTimeInput} onChange={(e) => setNewScheduleTimeInput(e.target.value)} placeholder="Time (e.g., 10:00 AM)" className="rounded-lg"/></div><Input value={newScheduleTopicInput} onChange={(e) => setNewScheduleTopicInput(e.target.value)} placeholder="Topic (Optional)" className="rounded-lg mt-3"/><Button onClick={handleAddScheduleItemInDialog} className="w-full mt-3 btn-gel rounded-lg text-sm"><PlusCircle className="mr-2 h-4 w-4" /> Add Entry</Button></div></div><DialogFooter><DialogClose asChild><Button type="button" variant="outline" className="rounded-lg">Cancel</Button></DialogClose><Button type="button" onClick={handleSaveChangesToSchedule} className="btn-gel rounded-lg">Save Schedule</Button></DialogFooter></DialogContent>)}</Dialog>
      <Dialog open={isCardPaymentDialogOpen} onOpenChange={setIsCardPaymentDialogOpen}><DialogContent className="sm:max-w-md rounded-xl"><DialogHeader><ShadDialogTitle>Enter Card Details</ShadDialogTitle><DialogDescription>Enter your card information to complete the payment. (This is a mock interface).</DialogDescription></DialogHeader><div className="grid gap-4 py-4"><div className="grid gap-2"><Label htmlFor="cardNumber">Card Number</Label><Input id="cardNumber" value={cardNumber} onChange={(e) => setCardNumber(e.target.value)} placeholder="0000 0000 0000 0000" className="rounded-lg"/></div><div className="grid grid-cols-2 gap-4"><div className="grid gap-2"><Label htmlFor="cardExpiry">Expiry (MM/YY)</Label><Input id="cardExpiry" value={cardExpiry} onChange={(e) => setCardExpiry(e.target.value)} placeholder="MM/YY" className="rounded-lg"/></div><div className="grid gap-2"><Label htmlFor="cardCvv">CVV</Label><Input id="cardCvv" value={cardCvv} onChange={(e) => setCardCvv(e.target.value)} placeholder="123" className="rounded-lg"/></div></div><div className="grid gap-2"><Label htmlFor="cardName">Cardholder Name</Label><Input id="cardName" value={cardName} onChange={(e) => setCardName(e.target.value)} placeholder="Full Name as on Card" className="rounded-lg"/></div></div><DialogFooter><DialogClose asChild><Button type="button" variant="outline" className="rounded-lg" onClick={() => setIsCardPaymentDialogOpen(false)}>Cancel</Button></DialogClose><Button type="button" onClick={handleCardPaymentSubmit} className="btn-gel rounded-lg" disabled={isProcessing || !cardNumber || !cardExpiry || !cardCvv || !cardName}>{isProcessing ? "Processing..." : `Pay ${currentCurrencySymbol}${currentRemainingFee > 0 ? currentRemainingFee.toFixed(2) : "0.00"} (Mock)`}</Button></DialogFooter></DialogContent></Dialog>
      <Dialog open={isRefundDialogOpen} onOpenChange={setIsRefundDialogOpen}><DialogContent className="sm:max-w-md rounded-xl"><DialogHeader><ShadDialogTitle>Issue Refund</ShadDialogTitle><DialogDescription>Enter the amount to refund to the student. This is a mock operation.</DialogDescription></DialogHeader><div className="grid gap-4 py-4">{classroom?.feeDetails && (<div className="text-sm space-y-1"><p>Total Paid: <span className="font-medium">{currentCurrencySymbol}{classroom.feeDetails.paidAmount.toFixed(2)}</span></p><p>Total Fee: <span className="font-medium">{currentCurrencySymbol}{classroom.feeDetails.totalFee.toFixed(2)}</span></p></div>)}<div className="grid gap-2"><Label htmlFor="refundAmountInput">Refund Amount ({currentCurrencySymbol})</Label><Input id="refundAmountInput" type="number" value={refundAmountInput} onChange={(e) => setRefundAmountInput(e.target.value)} placeholder="e.g., 50.00" className="rounded-lg"/></div></div><DialogFooter><DialogClose asChild><Button type="button" variant="outline" className="rounded-lg">Cancel</Button></DialogClose><Button type="button" onClick={handleConfirmRefund} className="btn-gel rounded-lg bg-orange-500 hover:bg-orange-600 text-white">Confirm Refund</Button></DialogFooter></DialogContent></Dialog>
    </div>
  );
}
