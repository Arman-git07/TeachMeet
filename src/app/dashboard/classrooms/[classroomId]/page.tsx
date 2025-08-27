

'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { db, storage } from '@/lib/firebase';
import { doc, onSnapshot, updateDoc, collection, addDoc, serverTimestamp, query, getDocs, writeBatch, deleteDoc, arrayUnion, arrayRemove, orderBy, getDoc, where, setDoc, Timestamp } from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { useToast } from '@/hooks/use-toast';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import Image from 'next/image';
import { Megaphone, Users, CreditCard, Loader2, ArrowLeft, PlusCircle, Trash2, Edit, Check, X, Upload, IndianRupee, DollarSign, Euro, PoundSterling, MessageSquare, Briefcase, FileText, ClipboardCheck, BrainCircuit, Star, Settings, MoreVertical, Mic, StopCircle, Calendar as CalendarIcon, AudioLines, Link as LinkIcon, AlertTriangle, Clock, Copy, Award, Book, Phone, UserPlus, UserX } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useForm, Controller, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { ScrollArea } from '@/components/ui/scroll-area';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import Link from 'next/link';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format, setHours, setMinutes, setSeconds } from 'date-fns';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Calendar } from '@/components/ui/calendar';
import AnnouncementComposer from '@/components/classroom/AnnouncementComposer';
import { gradeAssignment, GradeAssignmentInput } from '@/ai/flows/grade-assignment-flow';
import { resolveRoleForUser, canPost, canManage, type Role } from "@/lib/roles";
import MaterialItemDebug from '@/components/classroom/MaterialItemDebug';


// --- Interfaces ---
interface TeacherInfo {
    uid: string;
    name: string;
    photoURL?: string;
    subject: string;
    qualification: string;
    experience: string;
    availability: string;
    resumeURL?: string;
}

interface Classroom {
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

interface UserProfile { id: string; name: string; photoURL?: string; role: Role; uid: string; }
interface Announcement {
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
interface Material { id: string; name: string; url: string; uploadedAt: any; uploaderName: string; type: 'file' | 'link'; uploaderId: string; storagePath: string; }

// --- Exam Interfaces & Schemas ---
interface QAQuestion { type: 'qa'; question: string; answer: string; }
interface MCQOption { text: string; }
interface MCQQuestion { type: 'mcq'; question: string; options: MCQOption[]; correctOptionIndex: number; }
type ExamQuestion = QAQuestion | MCQQuestion;

interface Exam { 
  id: string; 
  title: string; 
  date: any; 
  type: 'file' | 'text'; 
  content?: ExamQuestion[];
  fileUrl?: string; 
  vanishAt?: any;
  creatorId: string;
  storagePath?: string;
  uploaderId?: string;
}
interface JoinRequest { id: string; studentId: string; studentName: string; studentPhotoURL?: string; role: 'student' | 'teacher'; applicationData?: any; resumeURL?: string; requestedAt?: any; }
interface SubjectTeacher { teacherId: string; name: string; subject: string; availability: string; }

interface Assignment {
  id: string;
  title: string;
  dueDate: any;
  answerKeyUrl: string;
  creatorId: string;
  storagePath?: string;
  uploaderId?: string;
}

interface Submission {
    id: string;
    studentId: string;
    studentName: string;
    submittedAt: any;
    submissionUrl: string;
    grade?: number;
    feedback?: string;
    isGrading?: boolean;
}

type DeletableItem = {
    collectionName: "materials" | "assignments" | "exams" | "announcements";
    item: { id: string; storagePath?: string };
}

// --- Zod Schemas ---
const feeSchema = z.object({
  amount: z.coerce.number().positive({ message: "Amount must be a positive number." }),
  currency: z.string().min(1, { message: "Currency is required." }),
});

const paymentDetailsSchema = z.object({
  upiId: z.string().optional(),
  qrCode: z.any().optional(),
});

const examQuestionSchema = z.object({
    type: z.enum(['qa', 'mcq']),
    question: z.string().min(1, 'Question text is required.'),
    answer: z.string().optional(),
    options: z.array(z.object({ text: z.string().min(1, 'Option text cannot be empty.') })).optional(),
    correctOptionIndex: z.coerce.number().optional(),
});

const examSchema = z.object({
    title: z.string().min(1, "Exam title is required"),
    date: z.date({ required_error: "Exam date is required" }),
    vanishAt: z.date().optional(),
    examFile: z.any().optional(),
    questions: z.array(examQuestionSchema).optional(),
}).refine(data => !data.vanishAt || data.vanishAt > data.date, {
    message: "Vanish time must be after the exam time.",
    path: ["vanishAt"],
});

const assignmentSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters long."),
  dueDate: z.date({ required_error: "A due date is required." }),
  answerKey: z.any().refine(files => files?.length == 1, "Answer key file is required."),
});


// --- Utility Functions ---
const fileToDataUri = (file: File): Promise<string> => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
});
const LATEST_ACTIVITY_KEY = 'teachmeet-latest-activity';

// --- Approval/Denial Functions ---
export const handleTeacherRequest = async (classroomId: string, teacherId: string, action: 'accept' | 'deny', teacherData: any) => {
    try {
        const requestRef = doc(db, "classrooms", classroomId, "joinRequests", teacherId);
        
        if (action === "accept") {
            const batch = writeBatch(db);
            const teacherRef = doc(db, "classrooms", classroomId, "teachers", teacherId);
            batch.set(teacherRef, {
                uid: teacherId, // ensure uid is set
                name: teacherData.studentName,
                subject: teacherData.applicationData.subject,
                availability: teacherData.applicationData.availability,
                addedAt: serverTimestamp(),
            });
            const participantRef = doc(db, "classrooms", classroomId, "participants", teacherId);
            batch.set(participantRef, {
                uid: teacherId,
                name: teacherData.studentName,
                photoURL: teacherData.studentPhotoURL || "",
                role: "teacher",
                joinedAt: serverTimestamp(),
            });

            // also update top-level teachers array
            const classroomRef = doc(db, 'classrooms', classroomId);
            batch.update(classroomRef, {
                teachers: arrayUnion({
                    uid: teacherId,
                    name: teacherData.studentName,
                    photoURL: teacherData.studentPhotoURL || "",
                })
            });

            batch.delete(requestRef); 
            await batch.commit();
        } else if (action === "deny") {
            await deleteDoc(requestRef);
        }
        return { success: true };
    } catch (error: any) {
        console.error("Error handling teacher request:", error);
        return { success: false, error: error.message };
    }
};

export const approveRequest = async (classroomId: string, request: any) => {
  try {
    const batch = writeBatch(db);

    const participantRef = doc(db, "classrooms", classroomId, "participants", request.studentId);
    batch.set(participantRef, {
      uid: request.studentId,
      name: request.studentName,
      photoURL: request.studentPhotoURL || "",
      role: request.role,
      joinedAt: serverTimestamp(),
    });
    
    const classroomRef = doc(db, "classrooms", classroomId);
     if (request.role === 'teacher') {
         // Teacher logic is now separate
     } else {
        batch.update(classroomRef, { students: arrayUnion(request.studentId) });
    }
    
    const userEnrolledRef = doc(db, `users/${request.studentId}/enrolled`, classroomId);
    const classroomSnap = await getDoc(classroomRef);
    if(classroomSnap.exists()) {
      const classroomData = classroomSnap.data();
      batch.set(userEnrolledRef, {
        classroomId: classroomId,
        title: classroomData.title,
        description: classroomData.description,
        teacherName: classroomData.teacherName,
        enrolledAt: serverTimestamp()
      });
    }

    const requestRef = doc(db, "classrooms", classroomId, "joinRequests", request.studentId);
    batch.delete(requestRef);
    const userPendingRequestRef = doc(db, `users/${request.studentId}/pendingJoinRequests`, classroomId);
    batch.delete(userPendingRequestRef);

    await batch.commit();

    return { success: true };
  } catch (error: any) {
    console.error("Approval failed:", error);
    return { success: false, error: error.message };
  }
};

export const denyRequest = async (classroomId: string, studentId: string) => {
  try {
    const batch = writeBatch(db);
    const requestRef = doc(db, "classrooms", classroomId, "joinRequests", studentId);
    batch.delete(requestRef);
    
    const userPendingRequestRef = doc(db, `users/${studentId}/pendingJoinRequests`, studentId);
    batch.delete(userPendingRequestRef);

    await batch.commit();
    return { success: true };
  } catch (error: any) {
    console.error("Denial failed:", error);
    return { success: false, error: error.message };
  }
};


// --- Components ---

const VanishDateTimePicker = ({ date, setDate, disabled }: { date: string | null, setDate: (date: string | null) => void, disabled?: boolean }) => {
    return (
        <Input
            type="datetime-local"
            value={date || ""}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-lg bg-background/50 p-2"
            disabled={disabled}
        />
    );
};

export default function ClassroomPage() {
    const { classroomId } = useParams() as { classroomId: string };
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();
    const { toast } = useToast();

    // State Declarations
    const [classroom, setClassroom] = useState<Classroom | null>(null);
    const [userRole, setUserRole] = useState<Role>('none');
    
    const [participants, setParticipants] = useState<UserProfile[]>([]);
    const [subjectTeachers, setSubjectTeachers] = useState<SubjectTeacher[]>([]);
    const [announcements, setAnnouncements] = useState<Announcement[]>([]);
    const [materials, setMaterials] = useState<Material[]>([]);
    const [exams, setExams] = useState<Exam[]>([]);
    const [joinRequests, setJoinRequests] = useState<JoinRequest[]>([]);
    const [assignments, setAssignments] = useState<Assignment[]>([]);
    const [submissions, setSubmissions] = useState<Submission[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isExamDialogOpen, setIsExamDialogOpen] = useState(false);
    const [isAssignmentDialogOpen, setIsAssignmentDialogOpen] = useState(false);
    const [materialFile, setMaterialFile] = useState<File | null>(null);
    const [materialLink, setMaterialLink] = useState('');
    const [materialName, setMaterialName] = useState('');
    const [isUploadingMaterial, setIsUploadingMaterial] = useState(false);
    const [isProcessingRequest, setIsProcessingRequest] = useState<string | null>(null);
    const [participantToRemove, setParticipantToRemove] = useState<UserProfile | null>(null);
    const [itemToDelete, setItemToDelete] = useState<DeletableItem | null>(null);
    
    const [assignmentToGrade, setAssignmentToGrade] = useState<Assignment | null>(null);
    
    const [isGrading, setIsGrading] = useState(false);
    const submissionFormRef = useRef<HTMLFormElement>(null);

    // New role resolution effect
    useEffect(() => {
        if (authLoading) return;
        let cancelled = false;
        (async () => {
          if (!classroomId) return;
          const { role, classroom: fetchedClassroom } = await resolveRoleForUser(String(classroomId), user?.uid);
          if (!cancelled) {
            setUserRole(role);
            setClassroom(fetchedClassroom);
            if (fetchedClassroom) {
              feeForm.reset({ amount: fetchedClassroom.feeAmount || 0, currency: fetchedClassroom.feeCurrency || 'INR' });
              paymentDetailsForm.reset({ upiId: fetchedClassroom.paymentDetails?.upiId || '', qrCode: null });
            } else {
              toast({ variant: 'destructive', title: 'Classroom not found.' });
              router.push('/dashboard/classrooms');
            }
            setIsLoading(false);
          }
        })();
        return () => {
          cancelled = true;
        };
    }, [classroomId, user?.uid, authLoading]);


    const canUserManage = canManage(userRole);

    // Forms
    const feeForm = useForm<z.infer<typeof feeSchema>>({ resolver: zodResolver(feeSchema), defaultValues: { amount: 0, currency: 'INR' } });
    const paymentDetailsForm = useForm<z.infer<typeof paymentDetailsSchema>>({ resolver: zodResolver(paymentDetailsSchema), defaultValues: { upiId: '', qrCode: null } });
    const examForm = useForm<z.infer<typeof examSchema>>({ resolver: zodResolver(examSchema) });
    const assignmentForm = useForm<z.infer<typeof assignmentSchema>>({ resolver: zodResolver(assignmentSchema), });

    const { fields, append, remove } = useFieldArray({ control: examForm.control, name: "questions" });

    // Fetch all subcollections data in a consolidated effect
    useEffect(() => {
        if (!classroomId || !classroom) return;

        const subcollectionMappings = [
            { path: 'announcements', setter: setAnnouncements, orderByField: 'createdAt' },
            { path: 'joinRequests', setter: setJoinRequests, orderByField: 'requestedAt' },
            { path: 'materials', setter: setMaterials, orderByField: 'uploadedAt' },
            { path: 'exams', setter: setExams, orderByField: 'date' },
            { path: 'participants', setter: setParticipants, orderByField: 'joinedAt' },
            { path: 'teachers', setter: setSubjectTeachers, orderByField: 'addedAt' },
            { path: 'assignments', setter: setAssignments, orderByField: 'dueDate' },
        ];

        const unsubscribers = subcollectionMappings.map(({ path, setter, orderByField }) => {
            const q = query(collection(db, 'classrooms', classroomId, path), orderBy(orderByField, 'desc'));
            return onSnapshot(q,
                (snap) => setter(snap.docs.map(d => ({ id: d.id, ...d.data() } as any))),
                (error) => console.error(`Error fetching ${path}:`, error)
            );
        });
    
        // Fetch submissions for all assignments
        const fetchSubmissions = async () => {
            if (assignments.length > 0) {
                const allSubmissions: Submission[] = [];
                for (const assignment of assignments) {
                    const submissionsQuery = query(collection(db, 'classrooms', classroomId, 'assignments', assignment.id, 'submissions'));
                    const submissionsSnapshot = await getDocs(submissionsQuery);
                    submissionsSnapshot.forEach(doc => {
                        allSubmissions.push({ assignmentId: assignment.id, ...doc.data(), id: doc.id } as Submission & { assignmentId: string });
                    });
                }
                setSubmissions(allSubmissions);
            }
        };

        if (assignments.length > 0) {
            fetchSubmissions();
        }

        return () => {
            unsubscribers.forEach(unsub => unsub());
        };
    }, [classroomId, classroom, assignments]);

    async function handleDeleteItem() {
        if (!itemToDelete) return;
        const { collectionName, item } = itemToDelete;
        
        try {
            if (!item.id) {
                toast({ variant: 'destructive', title: "Deletion Failed", description: "Item is missing an ID. Cannot delete."});
                return;
            }
            const ref = doc(db, "classrooms", classroomId, collectionName, item.id);

            // Delete file from storage if path exists
            if (item.storagePath) {
              const fileRef = storageRef(storage, item.storagePath);
              await deleteObject(fileRef).catch(err => {
                if (err.code !== 'storage/object-not-found') {
                    console.error("Storage deletion error, but proceeding to delete doc:", err);
                }
              });
            }
            await deleteDoc(ref);
            toast({ title: "Item Deleted", description: "The item has been successfully removed."});
        } catch (error: any) {
            console.error("❌ Error deleting item:", error);
            toast({ variant: 'destructive', title: "Deletion Failed", description: error.message });
        } finally {
            setItemToDelete(null);
        }
    }


    const handleApproveRequest = async (request: JoinRequest) => {
        if (!canUserManage) return;
        setIsProcessingRequest(request.id);
        
        let result;
        if (request.role === 'teacher') {
            result = await handleTeacherRequest(classroomId, request.studentId, 'accept', request);
        } else {
            result = await approveRequest(classroomId, request);
        }
        
        if (result.success) {
            toast({ title: 'Request Approved!', description: `${request.studentName} has been added to the classroom.` });
        } else {
            toast({ variant: 'destructive', title: 'Approval Failed', description: result.error || 'An error occurred. Check Firestore rules and console for details.' });
        }
        
        setIsProcessingRequest(null);
    };
    
    const handleDenyRequest = async (request: JoinRequest) => {
        if (!canUserManage) return;
        setIsProcessingRequest(request.id);
        
        let result;
        if (request.role === 'teacher') {
            result = await handleTeacherRequest(classroomId, request.studentId, 'deny', request);
        } else {
            result = await denyRequest(classroomId, request.studentId);
        }

        if (result.success) {
            toast({ title: 'Request Denied' });
        } else {
            toast({ variant: 'destructive', title: 'Action Failed', description: result.error || 'An error occurred.' });
        }
        setIsProcessingRequest(null);
    };
    
     const handleRemoveParticipant = async () => {
        if (!canUserManage || !participantToRemove) return;
        
        const participant = participantToRemove;
        setParticipantToRemove(null);
        
        const batch = writeBatch(db);
        
        const participantRef = doc(db, "classrooms", classroomId, "participants", participant.uid);
        batch.delete(participantRef);
        
        if (participant.role === 'student') {
            const classroomRef = doc(db, "classrooms", classroomId);
            batch.update(classroomRef, { students: arrayRemove(participant.uid) });
        } else if (participant.role === 'teacher') {
            const classroomRef = doc(db, "classrooms", classroomId);
            const teacherRef = doc(db, "classrooms", classroomId, "teachers", participant.uid);
            // Also remove from top-level teachers array
            batch.update(classroomRef, { teachers: arrayRemove({ uid: participant.uid, name: participant.name, photoURL: participant.photoURL || ""}) });
            batch.delete(teacherRef);
        }
        
        const userEnrolledRef = doc(db, `users/${participant.uid}/enrolled`, classroomId);
        batch.delete(userEnrolledRef);
        
        try {
            await batch.commit();
            toast({ title: 'Participant Removed', description: `${participant.name} has been removed from the classroom.` });
        } catch (error) {
            console.error("Failed to remove participant:", error);
            toast({ variant: 'destructive', title: 'Removal Failed', description: 'Could not remove the participant. Check Firestore rules and console for details.' });
        }
    };

    const onFeeSubmit = async (data: z.infer<typeof feeSchema>) => {
        try {
            await updateDoc(doc(db, 'classrooms', classroomId), {
                feeAmount: data.amount,
                feeCurrency: data.currency,
            });
            toast({ title: 'Fee Details Updated!' });
        } catch (error) {
            console.error('Error updating fee:', error);
            toast({ variant: 'destructive', title: 'Update Failed' });
        }
    };

    const onPaymentDetailsSubmit = async (data: z.infer<typeof paymentDetailsSchema>) => {
        try {
            let qrCodeUrl = classroom?.paymentDetails?.qrCodeUrl;
            if (data.qrCode && data.qrCode[0]) {
                const file = data.qrCode[0];
                const qrRef = storageRef(storage, `classrooms/${classroomId}/paymentQR.png`);
                await uploadBytes(qrRef, file);
                qrCodeUrl = await getDownloadURL(qrRef);
            }
            await updateDoc(doc(db, 'classrooms', classroomId), {
                paymentDetails: {
                    upiId: data.upiId,
                    qrCodeUrl: qrCodeUrl,
                }
            });
            toast({ title: 'Payment Details Updated!' });
        } catch (error) {
            console.error('Error updating payment details:', error);
            toast({ variant: 'destructive', title: 'Update Failed' });
        }
    };
    
    const handleMaterialUpload = async () => {
        if (!materialFile || !user) return;
        setIsUploadingMaterial(true);
        const toastId = `upload-${Date.now()}`;
        toast({ id: toastId, title: "Uploading...", description: "Please wait while your file is uploaded." });

        try {
            const path = `classrooms/${classroomId}/materials/${Date.now()}-${materialFile.name}`;
            const fileRef = storageRef(storage, path);
            const snapshot = await uploadBytes(fileRef, materialFile);
            const url = await getDownloadURL(snapshot.ref);
            await addDoc(collection(db, 'classrooms', classroomId, 'materials'), {
                name: materialFile.name,
                url,
                uploadedAt: serverTimestamp(),
                uploaderId: user.uid,
                uploaderName: user.displayName || 'Anonymous',
                type: 'file',
                storagePath: path,
            });
            toast.update(toastId, { title: "Material Uploaded!" });
            setMaterialFile(null);
        } catch (error) {
            console.error("Error uploading material:", error);
            toast.update(toastId, { variant: "destructive", title: "Upload Failed" });
        } finally {
            setIsUploadingMaterial(false);
        }
    };

    const handleLinkShare = async () => {
        if (!materialLink.trim() || !materialName.trim() || !user) {
            toast({ variant: "destructive", title: "Invalid Input", description: "Please provide both a name and a valid URL for the link." });
            return;
        }
        setIsUploadingMaterial(true);
        try {
             await addDoc(collection(db, 'classrooms', classroomId, 'materials'), { 
                name: materialName.trim(), 
                url: materialLink.trim(), 
                uploadedAt: serverTimestamp(),
                uploaderId: user.uid,
                uploaderName: user.displayName || 'Anonymous',
                type: 'link',
                storagePath: '',
            });
            toast({ title: "Link Shared!" });
            setMaterialLink('');
            setMaterialName('');
        } catch (error) {
             console.error("Error sharing link:", error);
            toast({ variant: "destructive", title: "Sharing Failed" });
        } finally {
            setIsUploadingMaterial(false);
        }
    };

    const onExamSubmit = async (data: z.infer<typeof examSchema>) => {
        if (!canUserManage || !user) return;
        examForm.clearErrors();

        const examFile = data.examFile?.[0];

        if (!examFile && (!data.questions || data.questions.length === 0)) {
            examForm.setError("questions", { type: "manual", message: "You must add at least one question or upload an exam file." });
            return;
        }

        const toastId = `exam-upload-${Date.now()}`;
        toast({ id: toastId, title: 'Creating Exam...', description: 'Please wait...' });

        try {
            let examData: any = {
                title: data.title,
                date: data.date,
                vanishAt: data.vanishAt || null,
                creatorId: user.uid,
                uploaderId: user.uid,
            };

            if (examFile) {
                const path = `classrooms/${classroomId}/exams/${Date.now()}-${examFile.name}`;
                const fileRef = storageRef(storage, path);
                const snapshot = await uploadBytes(fileRef, examFile);
                examData.type = 'file';
                examData.fileUrl = await getDownloadURL(snapshot.ref);
                examData.storagePath = path;
            } else {
                examData.type = 'text';
                examData.content = data.questions;
            }

            await addDoc(collection(db, 'classrooms', classroomId, 'exams'), examData);
            toast.update(toastId, { title: "Exam Created!" });
            setIsExamDialogOpen(false);
            examForm.reset({ questions: [] });
        } catch (error) {
            console.error("Error creating exam:", error);
            toast.update(toastId, { variant: 'destructive', title: "Creation Failed" });
        }
    };
    
    const onAssignmentSubmit = async (data: z.infer<typeof assignmentSchema>) => {
        if (!canUserManage || !user) return;
        const answerKeyFile = data.answerKey?.[0];
        if (!answerKeyFile) {
            toast({ variant: "destructive", title: "File Required", description: "Please upload an answer key file." });
            return;
        }

        const toastId = `assignment-upload-${Date.now()}`;
        toast({ id: toastId, title: "Creating Assignment...", description: "Uploading answer key, please wait." });

        try {
            const path = `classrooms/${classroomId}/assignments/${Date.now()}-${answerKeyFile.name}`;
            const fileRef = storageRef(storage, path);
            const snapshot = await uploadBytes(fileRef, answerKeyFile);
            const answerKeyUrl = await getDownloadURL(snapshot.ref);

            await addDoc(collection(db, 'classrooms', classroomId, 'assignments'), {
                title: data.title,
                dueDate: Timestamp.fromDate(data.dueDate),
                answerKeyUrl,
                creatorId: user.uid,
                uploaderId: user.uid,
                createdAt: serverTimestamp(),
                storagePath: path,
            });

            toast.update(toastId, { title: "Assignment Created!", description: `"${data.title}" is now available for students.` });
            setIsAssignmentDialogOpen(false);
            assignmentForm.reset();
        } catch (error) {
            console.error("Error creating assignment:", error);
            toast.update(toastId, { variant: 'destructive', title: "Creation Failed", description: "Could not create the assignment." });
        }
    };

    const handleStudentSubmission = async (e: React.FormEvent<HTMLFormElement>, assignmentId: string, studentId: string, studentName: string) => {
        e.preventDefault();
        const form = e.currentTarget;
        const fileInput = form.querySelector('input[type="file"]') as HTMLInputElement;
        const submissionFile = fileInput?.files?.[0];

        if (!submissionFile) {
            toast({ variant: 'destructive', title: "No file selected", description: "Please choose a file to submit." });
            return;
        }

        const submissionToastId = `submission-upload-${Date.now()}`;
        toast({ id: submissionToastId, title: "Submitting Assignment...", description: "Please wait..." });
        
        try {
            const fileRef = storageRef(storage, `classrooms/${classroomId}/assignments/${assignmentId}/submissions/${studentId}-${submissionFile.name}`);
            const snapshot = await uploadBytes(fileRef, submissionFile);
            const submissionUrl = await getDownloadURL(snapshot.ref);
            
            const submissionRef = doc(db, "classrooms", classroomId, "assignments", assignmentId, "submissions", studentId);

            await setDoc(submissionRef, {
                studentId: studentId,
                studentName: studentName,
                submittedAt: serverTimestamp(),
                submissionUrl,
                grade: null,
                feedback: null
            });
            
            toast.update(submissionToastId, { title: "Submission Successful!", description: "Your assignment has been submitted for grading." });

        } catch (error) {
            console.error("Error submitting assignment:", error);
            toast.update(submissionToastId, { variant: 'destructive', title: "Submission Failed", description: "Could not submit your assignment." });
        }
    };

    const handleGradeAssignment = async (assignment: Assignment, submission: Submission) => {
        if (!canUserManage || !assignment.answerKeyUrl || !submission.submissionUrl) return;

        const submissionRef = doc(db, "classrooms", classroomId, "assignments", assignment.id, "submissions", submission.studentId);
        
        try {
            await updateDoc(submissionRef, { isGrading: true });

            const [answerKeyRes, submissionRes] = await Promise.all([
                fetch(assignment.answerKeyUrl),
                fetch(submission.submissionUrl)
            ]);

            const [answerKeyBlob, submissionBlob] = await Promise.all([
                answerKeyRes.blob(),
                submissionRes.blob()
            ]);
            
            const teacherAssignmentDataUri = await fileToDataUri(new File([answerKeyBlob], "answerkey"));
            const studentSubmissionDataUri = await fileToDataUri(new File([submissionBlob], "submission"));

            const input: GradeAssignmentInput = { teacherAssignmentDataUri, studentSubmissionDataUri };
            const result = await gradeAssignment(input);

            await updateDoc(submissionRef, {
                grade: result.score,
                feedback: result.feedback,
                isGrading: false,
            });

            toast({ title: "Grading Complete!", description: `Scored ${result.score}/100 for ${submission.studentName}.` });
        } catch (error) {
            console.error("Error grading assignment:", error);
            toast({ variant: "destructive", title: "Grading Failed", description: "The AI grader encountered an error." });
            await updateDoc(submissionRef, { isGrading: false });
        }
    };


    if (isLoading) return <div className="container mx-auto p-4"><Skeleton className="h-64 w-full" /></div>;
    if (!classroom) return <div className="container mx-auto p-4">Classroom not found.</div>;

    const currencySymbols: { [key: string]: React.ReactNode } = {
        INR: <IndianRupee className="h-6 w-6" />, USD: <DollarSign className="h-6 w-6" />,
        EUR: <Euro className="h-6 w-6" />, GBP: <PoundSterling className="h-6 w-6" />,
    };

    return (
    <AlertDialog open={!!itemToDelete} onOpenChange={(isOpen) => !isOpen && setItemToDelete(null)}>
        <div className="flex flex-1 flex-col overflow-hidden">
             <header className="mb-6 px-4 md:px-8 flex items-center justify-between flex-shrink-0">
                <div>
                    <Button variant="link" onClick={() => router.back()} className="p-0 mb-2 text-muted-foreground"><ArrowLeft className="mr-2 h-4 w-4" />Back to classrooms</Button>
                    <h1 className="text-4xl font-bold">{classroom.title}</h1>
                    <p className="text-lg text-muted-foreground">{classroom.description}</p>
                    <p className="text-sm text-muted-foreground">Taught by: {classroom.teacherName}</p>
                </div>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreVertical className="h-5 w-5" /></Button></DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        {canUserManage && (
                        <Dialog>
                            <DialogTrigger asChild><DropdownMenuItem onSelect={(e) => e.preventDefault()}><Users className="mr-2 h-4 w-4"/>Manage Participants</DropdownMenuItem></DialogTrigger>
                             <DialogContent className="sm:max-w-2xl">
                                <DialogHeader>
                                <DialogTitle>Manage Participants</DialogTitle>
                                <DialogDescription>Approve requests and view enrolled participants.</DialogDescription>
                                </DialogHeader>
                                <ScrollArea className="max-h-[60vh] -mx-6 px-6">
                                    <div className="space-y-4 py-4">
                                    {joinRequests.length > 0 && (
                                        <div className="space-y-2">
                                            <h4 className="font-medium text-sm text-muted-foreground px-1">Pending Requests ({joinRequests.length})</h4>
                                            {joinRequests.map(req => (
                                                <Card key={req.id} className="p-3 bg-muted/30">
                                                    <div className="flex items-start gap-4">
                                                        <Avatar className="mt-1">
                                                            <AvatarImage src={req.studentPhotoURL} data-ai-hint="avatar user"/>
                                                            <AvatarFallback>{req.studentName.charAt(0)}</AvatarFallback>
                                                        </Avatar>
                                                        <div className="flex-grow">
                                                            <div className="flex justify-between items-start">
                                                                <div>
                                                                    <p className="font-medium text-sm">{req.studentName}</p>
                                                                    <p className="text-xs capitalize text-muted-foreground">{req.role}</p>
                                                                </div>
                                                                 <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                                                                    <Button size="icon" variant="ghost" className="h-8 w-8 text-green-600 hover:bg-green-100 dark:hover:bg-green-900/50" onClick={() => handleApproveRequest(req)} disabled={isProcessingRequest === req.id}>
                                                                        {isProcessingRequest === req.id ? <Loader2 className="h-4 w-4 animate-spin"/> : <Check className="h-4 w-4" />}
                                                                    </Button>
                                                                    <Button size="icon" variant="ghost" className="h-8 w-8 text-red-600 hover:bg-red-100 dark:hover:bg-red-900/50" onClick={() => handleDenyRequest(req)} disabled={isProcessingRequest === req.id}>
                                                                        {isProcessingRequest === req.id ? <Loader2 className="h-4 w-4 animate-spin"/> : <X className="h-4 w-4" />}
                                                                    </Button>
                                                                </div>
                                                            </div>
                                                            {req.role === 'teacher' && req.applicationData && (
                                                                <div className="mt-2 text-xs space-y-1 text-muted-foreground border-t pt-2">
                                                                    <p><strong className="text-foreground/80">Subject:</strong> {req.applicationData.subject}</p>
                                                                    <p><strong className="text-foreground/80">Qualification:</strong> {req.applicationData.qualification}</p>
                                                                    <p><strong className="text-foreground/80">Experience:</strong> {req.applicationData.experience}</p>
                                                                    <p><strong className="text-foreground/80">Availability:</strong> {req.applicationData.availability}</p>
                                                                    {req.resumeURL && <Button asChild size="sm" variant="link" className="p-0 h-auto mt-1"><Link href={req.resumeURL} target="_blank">View Resume</Link></Button>}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </Card>
                                            ))}
                                        </div>
                                    )}
                                    <div className="space-y-2">
                                        <h4 className="font-medium text-sm text-muted-foreground px-1">Enrolled Participants ({participants.length})</h4>
                                        {participants.length > 0 ? participants.map(s => (
                                            <div key={s.id} className="flex items-center gap-3 p-2 bg-muted/50 rounded-lg">
                                                <Avatar><AvatarImage src={s.photoURL} data-ai-hint="avatar user"/><AvatarFallback>{s.name.charAt(0)}</AvatarFallback></Avatar>
                                                <span className="text-sm flex-grow">{s.name}</span>
                                                <Badge variant={s.role === 'teacher' ? 'secondary' : 'default'} className="ml-2 capitalize">{s.role}</Badge>
                                                {canUserManage && s.uid !== user?.uid && (
                                                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive/70 hover:text-destructive hover:bg-destructive/10 rounded-full" onClick={() => setParticipantToRemove(s)}>
                                                        <UserX className="h-4 w-4" />
                                                    </Button>
                                                )}
                                            </div>
                                        )) : <p className="text-muted-foreground text-sm text-center pt-4">No participants enrolled yet.</p>}
                                    </div>
                                    </div>
                                </ScrollArea>
                            </DialogContent>
                        </Dialog>
                        )}
                        <Dialog>
                           <DialogTrigger asChild><DropdownMenuItem onSelect={(e) => e.preventDefault()}><Briefcase className="mr-2 h-4 w-4"/>Subject Teachers</DropdownMenuItem></DialogTrigger>
                            <DialogContent className="sm:max-w-lg">
                                <DialogHeader>
                                    <DialogTitle>Subject Teachers</DialogTitle>
                                    <DialogDescription>Manage subject teachers for this classroom ({subjectTeachers.length}).</DialogDescription>
                                </DialogHeader>
                                <ScrollArea className="max-h-[60vh] p-4">
                                    <div className="space-y-4">
                                    {subjectTeachers.length > 0 ? subjectTeachers.map(t => (
                                        <Card key={t.teacherId} className="p-4">
                                            <div className="flex items-start gap-4">
                                                <div className="flex-grow">
                                                    <CardTitle className="text-lg">{t.name}</CardTitle>
                                                    <CardDescription>{t.subject}</CardDescription>
                                                    <div className="mt-2 text-xs space-y-1 text-muted-foreground">
                                                        <p><Clock className="inline-block h-3 w-3 mr-1.5"/>{t.availability}</p>
                                                    </div>
                                                </div>
                                                <div className="flex flex-col gap-2">
                                                     <Button size="sm"><Phone className="mr-2 h-4 w-4"/>Contact</Button>
                                                </div>
                                            </div>
                                        </Card>
                                    )) : <p className="text-muted-foreground text-sm text-center py-4">No subject teachers have been added.</p>}
                                    </div>
                                </ScrollArea>
                            </DialogContent>
                        </Dialog>
                        <DropdownMenuSeparator />
                        <Dialog>
                            <DialogTrigger asChild><DropdownMenuItem onSelect={(e) => e.preventDefault()}><CreditCard className="mr-2 h-4 w-4"/>Fees & Payment</DropdownMenuItem></DialogTrigger>
                             <DialogContent className="sm:max-w-md">
                                <DialogHeader>
                                    <DialogTitle>Fees & Payment</DialogTitle>
                                    <DialogDescription>Manage classroom fees and view payment information.</DialogDescription>
                                </DialogHeader>
                                <Card className="border-0 shadow-none">
                                    <CardHeader>
                                        <div className="flex justify-between items-center">
                                            <CardTitle>Fees & Payment</CardTitle>
                                            {canUserManage && (
                                                <Dialog>
                                                    <DialogTrigger asChild><Button variant="ghost" size="icon"><Settings className="h-4 w-4" /></Button></DialogTrigger>
                                                    <DialogContent>
                                                        <DialogHeader>
                                                            <DialogTitle>Update Payment Settings</DialogTitle>
                                                            <DialogDescription>Set the fee amount and your payment receiving details.</DialogDescription>
                                                        </DialogHeader>
                                                        <div className="space-y-6 py-4">
                                                            <form id="fee-form" onSubmit={feeForm.handleSubmit(onFeeSubmit)} className="space-y-4 p-4 border rounded-lg">
                                                                <h4 className="font-medium">Fee Details</h4>
                                                                <div className="space-y-2"><Label htmlFor="amount">Fee Amount</Label><Input id="amount" type="number" {...feeForm.register('amount')} />
                                                                    {feeForm.formState.errors.amount && <p className="text-destructive text-sm">{feeForm.formState.errors.amount.message}</p>}
                                                                </div>
                                                                <div className="space-y-2"><Label htmlFor="currency">Currency</Label>
                                                                    <Controller name="currency" control={feeForm.control} render={({ field }) => (
                                                                        <Select onValueChange={field.onChange} defaultValue={field.value}><SelectTrigger><SelectValue placeholder="Select currency" /></SelectTrigger>
                                                                            <SelectContent><SelectItem value="INR">INR (₹)</SelectItem><SelectItem value="USD">USD ($)</SelectItem><SelectItem value="EUR">EUR (€)</SelectItem><SelectItem value="GBP">GBP (£)</SelectItem></SelectContent>
                                                                        </Select>
                                                                    )} />
                                                                    {feeForm.formState.errors.currency && <p className="text-destructive text-sm">{feeForm.formState.errors.currency.message}</p>}
                                                                </div>
                                                                <Button type="submit" size="sm">Save Fee</Button>
                                                            </form>
                                                            <form id="payment-details-form" onSubmit={paymentDetailsForm.handleSubmit(onPaymentDetailsSubmit)} className="space-y-4 p-4 border rounded-lg">
                                                                <h4 className="font-medium">Payment Details</h4>
                                                                <div className="space-y-2"><Label htmlFor="upiId">UPI ID</Label><Input id="upiId" {...paymentDetailsForm.register('upiId')} placeholder="yourname@bank"/></div>
                                                                <div className="space-y-2"><Label htmlFor="qrCode">QR Code Image</Label><Input id="qrCode" type="file" accept="image/*" {...paymentDetailsForm.register('qrCode')} /></div>
                                                                {classroom?.paymentDetails?.qrCodeUrl && (
                                                                    <div className="text-center"><p className="text-sm text-muted-foreground mb-2">Current QR Code:</p><Image src={classroom.paymentDetails.qrCodeUrl} alt="Current QR Code" width={128} height={128} className="mx-auto rounded-lg" data-ai-hint="qr code"/></div>
                                                                )}
                                                                <Button type="submit" size="sm">Save Payment Details</Button>
                                                            </form>
                                                        </div>
                                                    </DialogContent>
                                                </Dialog>
                                            )}
                                        </div>
                                    </CardHeader>
                                    <CardContent className="text-center">
                                        <p className="text-muted-foreground">Total Amount Due</p>
                                        <div className="flex justify-center items-center gap-2">{currencySymbols[classroom.feeCurrency || 'INR']}<p className="font-bold text-3xl">{classroom.feeAmount?.toLocaleString('en-IN', { minimumFractionDigits: 2 }) || '0.00'}</p><Badge>{classroom.feeCurrency || 'INR'}</Badge></div>
                                         <Dialog>
                                            <DialogTrigger asChild>
                                                <Button className="w-full btn-gel mt-4" disabled={!classroom.paymentDetails?.upiId && !classroom.paymentDetails?.qrCodeUrl}>Pay Now</Button>
                                            </DialogTrigger>
                                            <DialogContent className="sm:max-w-xs">
                                                <DialogHeader>
                                                <DialogTitle>Payment Information</DialogTitle>
                                                <DialogDescription>
                                                    Use the details below to complete your payment.
                                                </DialogDescription>
                                                </DialogHeader>
                                                <div className="py-4 space-y-4">
                                                {classroom.paymentDetails?.upiId && (
                                                    <div className="space-y-1">
                                                    <Label>UPI ID</Label>
                                                    <div className="flex items-center gap-2">
                                                        <Input readOnly value={classroom.paymentDetails.upiId} className="font-mono text-sm" />
                                                        <Button size="icon" variant="ghost" onClick={() => {
                                                            navigator.clipboard.writeText(classroom.paymentDetails!.upiId!);
                                                            toast({ title: 'UPI ID Copied!' });
                                                            }}>
                                                        <Copy className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                    </div>
                                                )}
                                                {classroom.paymentDetails?.qrCodeUrl && (
                                                    <div className="space-y-2 text-center">
                                                    <Label>Scan QR Code</Label>
                                                    <div className="p-2 border rounded-lg inline-block bg-white">
                                                        <Image src={classroom.paymentDetails.qrCodeUrl} alt="Payment QR Code" width={200} height={200} data-ai-hint="qr code"/>
                                                    </div>
                                                    </div>
                                                )}
                                                { !classroom.paymentDetails?.upiId && !classroom.paymentDetails?.qrCodeUrl && (
                                                    <p className="text-sm text-muted-foreground text-center">The teacher has not provided payment details yet.</p>
                                                )}
                                                </div>
                                                <DialogFooter>
                                                <DialogClose asChild>
                                                    <Button type="button" variant="secondary">Close</Button>
                                                </DialogClose>
                                                </DialogFooter>
                                            </DialogContent>
                                        </Dialog>
                                    </CardContent>
                                </Card>
                            </DialogContent>
                        </Dialog>
                    </DropdownMenuContent>
                </DropdownMenu>
            </header>
            
            <AlertDialog open={!!participantToRemove} onOpenChange={(isOpen) => !isOpen && setParticipantToRemove(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Remove Participant?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to remove {participantToRemove?.name} from this classroom? This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleRemoveParticipant}>Remove</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
            
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
                            <Card>
                                <CardHeader>
                                    <CardTitle>Announcements</CardTitle>
                                    <CardDescription>Stay updated with the latest news from your teacher.</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    {user && <AnnouncementComposer classId={classroomId} canPost={canPost(userRole)} />}
                                    <div className="space-y-3">
                                        {announcements.length > 0 ? announcements.map(a => (
                                            <div key={a.id} className="p-3 bg-muted/50 rounded-lg group relative">
                                                {a.text && <p className="text-sm">{a.text}</p>}
                                                {a.audioUrl && <audio controls src={a.audioUrl} className="w-full mt-2" />}
                                                <p className="text-xs text-muted-foreground mt-2">
                                                  Posted by {a.creatorName} on {new Date(a.createdAt?.toDate()).toLocaleString()}
                                                  {a.vanishAt && ` | Vanishes on ${new Date(a.vanishAt?.toDate()).toLocaleString()}`}
                                                </p>
                                                {(canUserManage || user?.uid === a.creatorId) && (
                                                    <AlertDialogTrigger asChild>
                                                        <Button 
                                                            variant="ghost" 
                                                            size="icon" 
                                                            className="absolute top-2 right-2 h-7 w-7 text-destructive/70 opacity-0 group-hover:opacity-100 transition-opacity"
                                                            onClick={() => setItemToDelete({ collectionName: 'announcements', item: a})}
                                                        >
                                                            <Trash2 className="h-4 w-4"/>
                                                        </Button>
                                                    </AlertDialogTrigger>
                                                )}
                                            </div>
                                        )) : (
                                            <p className="text-muted-foreground text-center py-4">No announcements yet.</p>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        </TabsContent>
                        
                        <TabsContent value="materials">
                            <Card>
                                <CardHeader><CardTitle>Class Materials</CardTitle></CardHeader>
                                <CardContent className="space-y-4">
                                    {canUserManage && user && (
                                        <Card className="p-4">
                                            <Tabs defaultValue="file">
                                                <TabsList className="grid w-full grid-cols-2">
                                                    <TabsTrigger value="file">Upload File</TabsTrigger>
                                                    <TabsTrigger value="link">Share Link</TabsTrigger>
                                                </TabsList>
                                                <TabsContent value="file" className="pt-4">
                                                    <div className="space-y-2">
                                                        <Label htmlFor="material-upload">Upload a File (PDF, Image, etc.)</Label>
                                                        <div className="flex gap-2">
                                                            <Input id="material-upload" type="file" onChange={(e) => setMaterialFile(e.target.files ? e.target.files[0] : null)} disabled={isUploadingMaterial} />
                                                            <Button onClick={handleMaterialUpload} disabled={!materialFile || isUploadingMaterial}>
                                                                {isUploadingMaterial ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Upload className="mr-2 h-4 w-4"/>}
                                                                Upload
                                                            </Button>
                                                        </div>
                                                    </div>
                                                </TabsContent>
                                                <TabsContent value="link" className="pt-4">
                                                    <div className="space-y-2">
                                                        <Label htmlFor="material-name">Link Name</Label>
                                                        <Input id="material-name" placeholder="e.g., 'React Docs', 'Helpful Article'" value={materialName} onChange={(e) => setMaterialName(e.target.value)} disabled={isUploadingMaterial}/>
                                                    </div>
                                                     <div className="space-y-2 mt-4">
                                                        <Label htmlFor="material-link">URL</Label>
                                                        <Input id="material-link" placeholder="https://example.com" value={materialLink} onChange={(e) => setMaterialLink(e.target.value)} disabled={isUploadingMaterial}/>
                                                    </div>
                                                    <Button onClick={handleLinkShare} disabled={!materialLink || !materialName || isUploadingMaterial} className="mt-4">
                                                        {isUploadingMaterial ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <LinkIcon className="mr-2 h-4 w-4"/>}
                                                        Share Link
                                                    </Button>
                                                </TabsContent>
                                            </Tabs>
                                        </Card>
                                    )}
                                    <div className="space-y-2">
                                        {materials.length > 0 ? materials.map(m => (
                                             <MaterialItemDebug
                                                key={m.id}
                                                classroomId={classroomId}
                                                m={m}
                                                canUserManage={canUserManage}
                                                user={user}
                                            />
                                        )) : <p className="text-muted-foreground text-center py-6">No materials shared yet. Be the first!</p>}
                                    </div>
                                </CardContent>
                            </Card>
                        </TabsContent>

                        <TabsContent value="assignments">
                             <Card>
                                <CardHeader className="flex flex-row items-center justify-between">
                                    <div>
                                        <CardTitle>Assignments</CardTitle>
                                        <CardDescription>Manage and grade assignments here.</CardDescription>
                                    </div>
                                    {canUserManage && (
                                        <Dialog open={isAssignmentDialogOpen} onOpenChange={setIsAssignmentDialogOpen}>
                                            <DialogTrigger asChild><Button><PlusCircle className="mr-2 h-4 w-4"/>Create Assignment</Button></DialogTrigger>
                                            <DialogContent>
                                                <DialogHeader>
                                                    <DialogTitle>Create New Assignment</DialogTitle>
                                                </DialogHeader>
                                                <form onSubmit={assignmentForm.handleSubmit(onAssignmentSubmit)} className="space-y-4 py-2">
                                                    <div className="space-y-1">
                                                        <Label htmlFor="assignment-title">Title</Label>
                                                        <Input id="assignment-title" {...assignmentForm.register('title')} />
                                                        {assignmentForm.formState.errors.title && <p className="text-destructive text-sm">{assignmentForm.formState.errors.title.message}</p>}
                                                    </div>
                                                     <div className="space-y-1">
                                                        <Label htmlFor="assignment-due-date">Due Date</Label>
                                                        <Controller control={assignmentForm.control} name="dueDate" render={({ field }) => (
                                                            <Input type="datetime-local" onChange={(e) => field.onChange(new Date(e.target.value))} value={field.value ? format(field.value, "yyyy-MM-dd'T'HH:mm") : ""} />
                                                        )} />
                                                        {assignmentForm.formState.errors.dueDate && <p className="text-destructive text-sm">{assignmentForm.formState.errors.dueDate.message}</p>}
                                                    </div>
                                                    <div className="space-y-1">
                                                        <Label htmlFor="assignment-answer-key">Answer Key File</Label>
                                                        <Input id="assignment-answer-key" type="file" {...assignmentForm.register('answerKey')} />
                                                        {assignmentForm.formState.errors.answerKey && <p className="text-destructive text-sm">{assignmentForm.formState.errors.answerKey.message?.toString()}</p>}
                                                    </div>
                                                    <DialogFooter>
                                                        <DialogClose asChild><Button type="button" variant="secondary">Cancel</Button></DialogClose>
                                                        <Button type="submit">Post Assignment</Button>
                                                    </DialogFooter>
                                                </form>
                                            </DialogContent>
                                        </Dialog>
                                    )}
                                </CardHeader>
                                <CardContent>
                                    {assignments.length > 0 ? (
                                        <div className="space-y-4">
                                            {assignments.map(assignment => (
                                                <Card key={assignment.id} className="p-4 group">
                                                    <div className="flex justify-between items-start">
                                                        <div>
                                                            <h3 className="font-semibold">{assignment.title}</h3>
                                                            <p className="text-sm text-muted-foreground">Due: {new Date(assignment.dueDate.toDate()).toLocaleString()}</p>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            {canUserManage ? (
                                                                <Dialog>
                                                                    <DialogTrigger asChild><Button>View Submissions</Button></DialogTrigger>
                                                                    <DialogContent className="max-w-2xl">
                                                                        <DialogHeader>
                                                                            <DialogTitle>Submissions for: {assignment.title}</DialogTitle>
                                                                        </DialogHeader>
                                                                        <ScrollArea className="max-h-[60vh] -mx-6 px-6">
                                                                            <div className="py-4 space-y-2">
                                                                                {submissions.filter(s => s.assignmentId === assignment.id).length > 0 ? submissions.filter(s => s.assignmentId === assignment.id).map(sub => (
                                                                                    <Card key={sub.id} className="p-3">
                                                                                        <div className="flex justify-between items-center">
                                                                                            <div>
                                                                                                <p className="font-medium">{sub.studentName}</p>
                                                                                                <a href={sub.submissionUrl} target="_blank" rel="noreferrer" className={cn(buttonVariants({ variant: "link" }), "p-0 h-auto text-xs")}>View Submission</a>
                                                                                            </div>
                                                                                            <div className="text-right">
                                                                                                {sub.grade !== undefined && sub.grade !== null ? (
                                                                                                    <Badge className="text-lg">{sub.grade}/100</Badge>
                                                                                                ) : (
                                                                                                    <Button size="sm" onClick={() => handleGradeAssignment(assignment, sub)} disabled={sub.isGrading}>
                                                                                                        {sub.isGrading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin"/> Grading...</> : <><BrainCircuit className="mr-2 h-4 w-4"/> Grade with AI</>}
                                                                                                    </Button>
                                                                                                )}
                                                                                            </div>
                                                                                        </div>
                                                                                        {sub.feedback && <p className="text-sm text-muted-foreground mt-2 border-t pt-2"><b>Feedback:</b> {sub.feedback}</p>}
                                                                                    </Card>
                                                                                )) : <p className="text-center text-muted-foreground">No submissions yet.</p>}
                                                                            </div>
                                                                        </ScrollArea>
                                                                    </DialogContent>
                                                                </Dialog>
                                                            ) : (
                                                                userRole === 'student' && user && (
                                                                    <form ref={submissionFormRef} onSubmit={(e) => handleStudentSubmission(e, assignment.id, user.uid, user.displayName || 'Student')}>
                                                                        <Input type="file" required />
                                                                        <Button type="submit" size="sm" className="mt-2">Submit</Button>
                                                                    </form>
                                                                )
                                                            )}
                                                            {(canUserManage || user?.uid === assignment.creatorId) && (
                                                                <AlertDialogTrigger asChild>
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="icon"
                                                                        className="h-8 w-8 text-destructive/70 opacity-0 group-hover:opacity-100 transition-opacity"
                                                                        onClick={() => setItemToDelete({ collectionName: 'assignments', item: assignment })}
                                                                    >
                                                                        <Trash2 className="h-4 w-4" />
                                                                    </Button>
                                                                </AlertDialogTrigger>
                                                            )}
                                                        </div>
                                                    </div>
                                                </Card>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-muted-foreground text-center py-4">No assignments posted yet.</p>
                                    )}
                                </CardContent>
                            </Card>
                        </TabsContent>

                        <TabsContent value="exams">
                            <Card>
                                <CardHeader className="flex flex-row items-center justify-between">
                                    <div>
                                        <CardTitle>Exams & Tests</CardTitle>
                                        <CardDescription>Manage and view scheduled exams.</CardDescription>
                                    </div>
                                    {canUserManage && (
                                        <Dialog open={isExamDialogOpen} onOpenChange={setIsExamDialogOpen}>
                                            <DialogTrigger asChild>
                                                <Button><PlusCircle className="mr-2 h-4 w-4" /> Add New Exam</Button>
                                            </DialogTrigger>
                                            <DialogContent className="sm:max-w-3xl">
                                                <DialogHeader>
                                                    <DialogTitle>Create New Exam</DialogTitle>
                                                    <DialogDescription>Fill out the details for the new exam.</DialogDescription>
                                                </DialogHeader>
                                                 <form onSubmit={examForm.handleSubmit(onExamSubmit)} className="space-y-4 py-4">
                                                    <div className="space-y-2">
                                                        <Label htmlFor="exam-title">Exam Title</Label>
                                                        <Input id="exam-title" {...examForm.register('title')} />
                                                        {examForm.formState.errors.title && <p className="text-destructive text-sm">{examForm.formState.errors.title.message}</p>}
                                                    </div>
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                        <div className="space-y-2">
                                                            <Label>Exam Date & Time</Label>
                                                            <Controller control={examForm.control} name="date" render={({ field }) => (
                                                               <Input type="datetime-local" onChange={(e) => field.onChange(new Date(e.target.value))} onBlur={field.onBlur} value={field.value ? format(field.value, "yyyy-MM-dd'T'HH:mm") : ""} />
                                                            )} />
                                                            {examForm.formState.errors.date && <p className="text-destructive text-sm">{examForm.formState.errors.date.message}</p>}
                                                        </div>
                                                        <div className="space-y-2">
                                                            <Label>Vanish Time (Optional)</Label>
                                                             <Controller control={examForm.control} name="vanishAt" render={({ field }) => (
                                                               <Input type="datetime-local" onChange={(e) => field.onChange(new Date(e.target.value))} onBlur={field.onBlur} value={field.value ? format(field.value, "yyyy-MM-dd'T'HH:mm") : ""} />
                                                             )} />
                                                             {examForm.formState.errors.vanishAt && <p className="text-destructive text-sm">{examForm.formState.errors.vanishAt.message}</p>}
                                                        </div>
                                                    </div>
                                                     <div className="relative flex items-center my-4">
                                                        <div className="flex-grow border-t border-muted-foreground"></div><span className="flex-shrink mx-4 text-muted-foreground text-xs">UPLOAD FILE OR CREATE QUESTIONS</span><div className="flex-grow border-t border-muted-foreground"></div>
                                                    </div>
                                                     <div className="space-y-2">
                                                        <Label htmlFor="exam-file">Upload Exam Paper (optional)</Label>
                                                        <Input id="exam-file" type="file" {...examForm.register('examFile')} />
                                                    </div>
                                                    <div className="space-y-4">
                                                        <Label>Questions</Label>
                                                         <ScrollArea className="h-72 w-full rounded-md border p-4">
                                                        {fields.map((field, index) => (
                                                            <Card key={field.id} className="mb-4 p-4 space-y-3 relative">
                                                                <Button type="button" variant="ghost" size="icon" className="absolute top-2 right-2 h-6 w-6" onClick={() => remove(index)}><X className="h-4 w-4 text-destructive" /></Button>
                                                                <h4 className="font-medium text-sm">Question {index + 1} ({field.type.toUpperCase()})</h4>
                                                                <Input {...examForm.register(`questions.${index}.question`)} placeholder="Question Text" />
                                                                {examForm.formState.errors.questions?.[index]?.question && <p className="text-sm text-destructive">{examForm.formState.errors.questions?.[index]?.question?.message}</p>}
                                                                {field.type === 'qa' && (
                                                                    <Textarea {...examForm.register(`questions.${index}.answer`)} placeholder="Answer" />
                                                                )}
                                                                {field.type === 'mcq' && (
                                                                    <div className="space-y-2 pl-4">
                                                                        {field.options?.map((opt, optIndex) => (
                                                                            <div key={optIndex} className="flex items-center gap-2">
                                                                                 <Input {...examForm.register(`questions.${index}.options.${optIndex}.text`)} placeholder={`Option ${optIndex + 1}`} />
                                                                                <RadioGroup onValueChange={(val) => examForm.setValue(`questions.${index}.correctOptionIndex`, parseInt(val))} value={String(examForm.watch(`questions.${index}.correctOptionIndex`))}>
                                                                                    <RadioGroupItem value={String(optIndex)} id={`q${index}-opt${optIndex}`} />
                                                                                </RadioGroup>
                                                                                <Label htmlFor={`q${index}-opt${optIndex}`} className="text-xs">Correct</Label>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                )}
                                                            </Card>
                                                        ))}
                                                        </ScrollArea>
                                                         {examForm.formState.errors.questions && <p className="text-destructive text-sm">{examForm.formState.errors.questions.message}</p>}
                                                        <div className="flex gap-2">
                                                             <Button type="button" variant="outline" onClick={() => append({ type: 'qa', question: '', answer: '' })}><PlusCircle className="mr-2 h-4 w-4"/>Add Q/A</Button>
                                                             <Button type="button" variant="outline" onClick={() => append({ type: 'mcq', question: '', options: [{text:''},{text:''},{text:''},{text:''}], correctOptionIndex: 0 })}><PlusCircle className="mr-2 h-4 w-4"/>Add MCQ</Button>
                                                        </div>
                                                    </div>
                                                    <DialogFooter>
                                                        <DialogClose asChild><Button type="button" variant="secondary">Cancel</Button></DialogClose>
                                                        <Button type="submit">Create Exam</Button>
                                                    </DialogFooter>
                                                </form>
                                            </DialogContent>
                                        </Dialog>
                                    )}
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-3">
                                        {exams.length > 0 ? exams.map(exam => (
                                            <div key={exam.id} className="p-4 border rounded-lg group">
                                                <div className="flex justify-between items-start">
                                                    <div>
                                                        <h4 className="font-semibold">{exam.title}</h4>
                                                        <p className="text-sm text-muted-foreground">Scheduled for: {new Date(exam.date.toDate()).toLocaleString()}</p>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <Button size="sm" className="btn-gel">Take Exam</Button>
                                                        {(canUserManage || user?.uid === exam.uploaderId) && (
                                                             <AlertDialogTrigger asChild>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="h-8 w-8 text-destructive/70 opacity-0 group-hover:opacity-100 transition-opacity"
                                                                    onClick={() => setItemToDelete({ collectionName: 'exams', item: exam })}
                                                                >
                                                                    <Trash2 className="h-4 w-4" />
                                                                </Button>
                                                            </AlertDialogTrigger>
                                                        )}
                                                    </div>
                                                </div>
                                                {exam.vanishAt && <p className="text-xs text-destructive mt-1">Vanishes on: {new Date(exam.vanishAt.toDate()).toLocaleString()}</p>}
                                            </div>
                                        )) : (
                                            <p className="text-muted-foreground text-center py-4">No exams scheduled yet.</p>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        </TabsContent>
                    </div>
                </Tabs>
            </main>
            <Button
                asChild
                variant="default"
                className="fixed bottom-6 left-6 h-14 w-14 rounded-full shadow-lg btn-gel"
                aria-label="Open class chat"
            >
                <Link href={`/dashboard/classrooms/${classroomId}/chat?topic=${encodeURIComponent(classroom.title)}`}>
                    <MessageSquare className="h-7 w-7" />
                </Link>
            </Button>
        </div>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                <AlertDialogDescription>
                    This will permanently delete the item. This action cannot be undone.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setItemToDelete(null)}>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDeleteItem}>Delete</AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
    </AlertDialog>
    );
}

