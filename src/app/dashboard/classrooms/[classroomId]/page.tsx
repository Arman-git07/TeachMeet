

'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { db, storage } from '@/lib/firebase';
import { doc, onSnapshot, updateDoc, collection, addDoc, serverTimestamp, query, getDocs, writeBatch, deleteDoc, arrayUnion, arrayRemove, orderBy, getDoc, where, setDoc } from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import Image from 'next/image';
import { Megaphone, BookUser, Users, CreditCard, Loader2, ArrowLeft, PlusCircle, Trash2, Edit, Check, X, FileUp, Upload, IndianRupee, DollarSign, Euro, PoundSterling, MessageSquare, Briefcase, FileText, ClipboardCheck, BrainCircuit, Star, Settings, MoreVertical, Mic, StopCircle, Calendar as CalendarIcon, AudioLines, Link as LinkIcon, AlertTriangle, Clock, Copy, Award, Book, Phone, UserPlus, UserX } from 'lucide-react';
import { EnrolledClassroomInfo } from '../page';
import { cn } from '@/lib/utils';
import { gradeAssignment } from '@/ai/flows/grade-assignment-flow';
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
    students: string[]; // Keep for legacy/quick reference, but participants subcollection is source of truth
    teachers: TeacherInfo[]; // This field seems unused now in favor of subcollection
    feeAmount?: number;
    feeCurrency?: string;
    paymentDetails?: { upiId: string; qrCodeUrl: string; };
}

interface UserProfile { id: string; name: string; photoURL?: string; role: 'student' | 'teacher'; uid: string; }
interface Announcement {
  id: string;
  type: 'text' | 'audio';
  text?: string;
  audioUrl?: string;
  createdAt: any;
  vanishAt?: any;
  creatorId: string;
  creatorName: string;
}
interface Assignment { id: string; title: string; description: string; dueDate: any; submissionFile?: File | null; }
interface Submission { id: string; studentId: string; studentName: string; fileUrl: string; submittedAt: any; grade?: number; feedback?: string; }
interface Material { id: string; name: string; url: string; uploadedAt: any; uploaderName: string; type: 'file' | 'link'; }

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
  content?: ExamQuestion[]; // Updated to structured content
  fileUrl?: string; 
  vanishAt?: any; 
}
interface JoinRequest { id: string; studentId: string; studentName: string; studentPhotoURL?: string; role: 'student' | 'teacher'; applicationData?: any; resumeURL?: string; requestedAt?: any; }
interface SubjectTeacher { teacherId: string; name: string; subject: string; availability: string; }

// --- Zod Schemas ---
const feeSchema = z.object({
  amount: z.coerce.number().positive({ message: "Amount must be a positive number." }),
  currency: z.string().min(1, { message: "Currency is required." }),
});

const paymentDetailsSchema = z.object({
  upiId: z.string().optional(),
  qrCode: z.any().optional(),
});

const assignmentSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  dueDate: z.date(),
  submissionFile: z.any().optional(),
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
                teacherId,
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
            batch.update(requestRef, { status: "accepted" });
            batch.delete(requestRef); 
            await batch.commit();
        } else if (action === "deny") {
            await updateDoc(requestRef, { status: "denied" });
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
        // This part is handled by handleTeacherRequest now.
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
    
    const userPendingRequestRef = doc(db, `users/${studentId}/pendingJoinRequests`, classroomId);
    batch.delete(userPendingRequestRef);

    await batch.commit();
    return { success: true };
  } catch (error: any) {
    console.error("Denial failed:", error);
    return { success: false, error: error.message };
  }
};


// --- Components ---

const VanishDateTimePicker = ({ date, setDate }: { date: Date | undefined, setDate: (date: Date | undefined) => void }) => {
    const [time, setTime] = useState({ hour: date?.getHours() ?? 0, minute: date?.getMinutes() ?? 0 });
    
    useEffect(() => {
      if (date) {
        setTime({ hour: date.getHours(), minute: date.getMinutes() });
      }
    }, [date]);

    const handleDateSelect = (selectedDate: Date | undefined) => {
        if (!selectedDate) {
            setDate(undefined);
            return;
        }
        const newDate = setHours(setMinutes(setSeconds(selectedDate, 0), time.minute), time.hour);
        setDate(newDate);
    };
    
    const handleTimeChange = (type: 'hour' | 'minute', value: string) => {
        const numericValue = parseInt(value, 10);
        if (isNaN(numericValue)) return;
        
        let newTime = { ...time };
        if (type === 'hour') newTime.hour = Math.max(0, Math.min(23, numericValue));
        if (type === 'minute') newTime.minute = Math.max(0, Math.min(59, numericValue));
        
        setTime(newTime);
        
        if (date) {
            const newDate = setHours(setMinutes(date, newTime.minute), newTime.hour);
            setDate(newDate);
        }
    };
    
    const displayValue = date ? `${format(date, 'PPP')} at ${format(date, 'p')}` : 'Set vanish date & time';

    return (
        <Popover>
            <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-[240px] justify-start text-left font-normal rounded-lg", !date && "text-muted-foreground")}>
                    <Clock className="mr-2 h-4 w-4" />
                    {displayValue}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0 rounded-xl" align="start">
                <Calendar mode="single" selected={date} onSelect={handleDateSelect} initialFocus />
                <div className="p-3 border-t">
                    <p className="text-sm font-medium mb-2">Vanish Time</p>
                    <div className="flex items-center gap-2">
                        <Input type="number" value={String(time.hour).padStart(2,'0')} onChange={e => handleTimeChange('hour', e.target.value)} className="w-16" min="0" max="23" /> :
                        <Input type="number" value={String(time.minute).padStart(2,'0')} onChange={e => handleTimeChange('minute', e.target.value)} className="w-16" min="0" max="59"/>
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    );
};

const AnnouncementForm = ({ classroomId, classroomTitle, currentUser }: { classroomId: string; classroomTitle: string; currentUser: any }) => {
    const [text, setText] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [vanishAt, setVanishAt] = useState<Date | undefined>();
    const { toast } = useToast();

    const [isRecording, setIsRecording] = useState(false);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);

    const handleToggleRecording = async () => {
        if (isRecording) {
            mediaRecorderRef.current?.stop();
            setIsRecording(false);
            return;
        }

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorderRef.current = new MediaRecorder(stream);
            audioChunksRef.current = [];

            mediaRecorderRef.current.ondataavailable = (event) => {
                audioChunksRef.current.push(event.data);
            };

            mediaRecorderRef.current.onstop = () => {
                stream.getTracks().forEach(track => track.stop());
                toast({ title: "Recording Stopped", description: "Your voice message is ready to be posted." });
            };

            mediaRecorderRef.current.start();
            setIsRecording(true);
            toast({ title: "Recording Started..." });
        } catch (error) {
            console.error("Mic access error:", error);
            toast({ variant: "destructive", title: "Microphone Access Denied" });
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const hasText = text.trim();
        const hasAudio = audioChunksRef.current.length > 0;

        if (!hasText && !hasAudio) {
            toast({ variant: 'destructive', title: 'Announcement cannot be empty.' });
            return;
        }
        setIsLoading(true);

        try {
            let audioUrl: string | undefined = undefined;
            if (hasAudio) {
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                const audioFileRef = storageRef(storage, `classrooms/${classroomId}/announcements/${Date.now()}.webm`);
                const snapshot = await uploadBytes(audioFileRef, audioBlob);
                audioUrl = await getDownloadURL(snapshot.ref);
            }
            
            const announcementData = {
                type: hasAudio ? 'audio' : 'text',
                text: hasText ? text : undefined,
                audioUrl: audioUrl,
                createdAt: serverTimestamp(),
                vanishAt: vanishAt || null,
                creatorId: currentUser.uid,
                creatorName: currentUser.displayName || "Teacher",
            };

            await addDoc(collection(db, 'classrooms', classroomId, 'announcements'), announcementData);
            
            try {
                const rawActivity = localStorage.getItem(LATEST_ACTIVITY_KEY);
                let activities = rawActivity ? JSON.parse(rawActivity) : [];
                if (!Array.isArray(activities)) activities = [];
                const newNotification = {
                  id: `announcement-${Date.now()}`,
                  type: 'announcement',
                  title: `New announcement in "${classroomTitle}"`,
                  timestamp: Date.now(),
                  classroomId,
                };
                activities.unshift(newNotification);
                localStorage.setItem(LATEST_ACTIVITY_KEY, JSON.stringify(activities.slice(0, 20)));
                window.dispatchEvent(new CustomEvent('teachmeet_activity_updated'));
            } catch (e) {
                console.error("Failed to update latest activity:", e);
            }

            setText('');
            setVanishAt(undefined);
            audioChunksRef.current = [];
            toast({ title: 'Announcement Posted!' });
        } catch (error) {
            console.error('Error posting announcement:', error);
            toast({ variant: 'destructive', title: 'Failed to post announcement.', description: 'Check Firestore rules and console for details.' });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-3 p-4 border rounded-lg bg-muted/30">
            <Textarea placeholder="Type your announcement here..." value={text} onChange={(e) => setText(e.target.value)} disabled={isLoading || isRecording} rows={3} />
            <div className="flex flex-wrap items-center gap-2">
                <Button type="button" variant="outline" size="icon" onClick={handleToggleRecording} disabled={isLoading || !!text.trim()} className={cn(isRecording && "bg-destructive text-destructive-foreground")}>
                    {isRecording ? <StopCircle className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
                </Button>
                {audioChunksRef.current.length > 0 && !isRecording && <span className="text-sm text-muted-foreground flex items-center gap-1"><AudioLines className="h-4 w-4"/> Audio recorded.</span>}
                <VanishDateTimePicker date={vanishAt} setDate={setVanishAt} />
                {vanishAt && <Button variant="ghost" size="sm" onClick={() => setVanishAt(undefined)}>Clear</Button>}
                <Button type="submit" disabled={isLoading} className="ml-auto">
                    {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Post Announcement
                </Button>
            </div>
        </form>
    );
};

export default function ClassroomPage() {
    const { classroomId } = useParams() as { classroomId: string };
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();
    const { toast } = useToast();

    // State Declarations
    const [classroom, setClassroom] = useState<Classroom | null>(null);
    const [participants, setParticipants] = useState<UserProfile[]>([]);
    const [subjectTeachers, setSubjectTeachers] = useState<SubjectTeacher[]>([]);
    const [announcements, setAnnouncements] = useState<Announcement[]>([]);
    const [assignments, setAssignments] = useState<Assignment[]>([]);
    const [materials, setMaterials] = useState<Material[]>([]);
    const [exams, setExams] = useState<Exam[]>([]);
    const [submissions, setSubmissions] = useState<Map<string, Submission[]>>(new Map());
    const [joinRequests, setJoinRequests] = useState<JoinRequest[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isAssignmentDialogOpen, setIsAssignmentDialogOpen] = useState(false);
    const [isExamDialogOpen, setIsExamDialogOpen] = useState(false);
    const [isGrading, setIsGrading] = useState<string | null>(null);
    const [materialFile, setMaterialFile] = useState<File | null>(null);
    const [materialLink, setMaterialLink] = useState('');
    const [materialName, setMaterialName] = useState('');
    const [isUploadingMaterial, setIsUploadingMaterial] = useState(false);
    const [isProcessingRequest, setIsProcessingRequest] = useState<string | null>(null);
    const [participantToRemove, setParticipantToRemove] = useState<UserProfile | null>(null);


    const isCreator = useMemo(() => {
        if (!user || !classroom) return false;
        return classroom.teacherId === user.uid;
    }, [user, classroom]);
    
    const canPostAnnouncements = useMemo(() => {
        if (!user || !participants.length || !classroom) return false;
        if (user.uid === classroom.teacherId) return true; // Creator can always post
        const self = participants.find(p => p.uid === user.uid);
        return self?.role === 'teacher';
    }, [user, participants, classroom]);

    // Forms
    const feeForm = useForm<z.infer<typeof feeSchema>>({ resolver: zodResolver(feeSchema), defaultValues: { amount: 0, currency: 'INR' } });
    const paymentDetailsForm = useForm<z.infer<typeof paymentDetailsSchema>>({ resolver: zodResolver(paymentDetailsSchema), defaultValues: { upiId: '', qrCode: null } });
    const assignmentForm = useForm<z.infer<typeof assignmentSchema>>({ resolver: zodResolver(assignmentSchema) });
    const examForm = useForm<z.infer<typeof examSchema>>({ resolver: zodResolver(examSchema) });
    const { fields, append, remove } = useFieldArray({ control: examForm.control, name: "questions" });

    // Fetch primary classroom data
    useEffect(() => {
        if (!classroomId) return;
        const unsub = onSnapshot(doc(db, 'classrooms', classroomId), (docSnap) => {
            if (docSnap.exists()) {
                const data = { id: docSnap.id, ...docSnap.data() } as Classroom;
                setClassroom(data);
                feeForm.reset({ amount: data.feeAmount || 0, currency: data.feeCurrency || 'INR' });
                paymentDetailsForm.reset({ upiId: data.paymentDetails?.upiId || '', qrCode: null });
            } else {
                toast({ variant: 'destructive', title: 'Classroom not found.' });
                router.push('/dashboard/classrooms');
            }
            setIsLoading(false);
        });
        return () => unsub();
    }, [classroomId, router, toast, feeForm, paymentDetailsForm]);

    // Fetch subcollections data
    useEffect(() => {
        if (!classroomId) return;
        const announcementsQuery = query(collection(db, 'classrooms', classroomId, 'announcements'), where('vanishAt', '>', new Date()), orderBy('vanishAt', 'desc'), orderBy('createdAt', 'desc'));
        const unsubAnnouncements = onSnapshot(announcementsQuery, snap => setAnnouncements(snap.docs.map(d => ({ id: d.id, ...d.data() } as Announcement))));
        
        const unsubAssignments = onSnapshot(query(collection(db, 'classrooms', classroomId, 'assignments'), orderBy('dueDate', 'desc')), async (snap) => {
            const assignmentsData = snap.docs.map(d => ({ id: d.id, ...d.data() } as Assignment));
            setAssignments(assignmentsData);
            const newSubmissions = new Map<string, Submission[]>();
            for (const assignment of assignmentsData) {
                const subSnap = await getDocs(query(collection(db, `classrooms/${classroomId}/assignments/${assignment.id}/submissions`), orderBy('submittedAt', 'desc')));
                newSubmissions.set(assignment.id, subSnap.docs.map(s => ({ id: s.id, ...s.data() } as Submission)));
            }
            setSubmissions(newSubmissions);
        });
        const unsubRequests = onSnapshot(query(collection(db, 'classrooms', classroomId, 'joinRequests'), orderBy('requestedAt', 'desc')), snap => setJoinRequests(snap.docs.map(d => ({ id: d.id, ...d.data() } as JoinRequest))));
        const unsubMaterials = onSnapshot(query(collection(db, 'classrooms', classroomId, 'materials'), orderBy('uploadedAt', 'desc')), snap => setMaterials(snap.docs.map(d => ({ id: d.id, ...d.data() } as Material))));
        const examsQuery = query(collection(db, 'classrooms', classroomId, 'exams'), where('vanishAt', '>', new Date()), orderBy('vanishAt', 'desc'), orderBy('date', 'desc'));
        const unsubExams = onSnapshot(examsQuery, snap => setExams(snap.docs.map(d => ({ id: d.id, ...d.data() } as Exam))));
        
        const unsubParticipants = onSnapshot(query(collection(db, 'classrooms', classroomId, 'participants'), orderBy('joinedAt', 'desc')), snap => setParticipants(snap.docs.map(d => ({ id: d.id, ...d.data() } as UserProfile))));
        
        const unsubTeachers = onSnapshot(query(collection(db, 'classrooms', classroomId, 'teachers'), orderBy('addedAt', 'desc')), snap => setSubjectTeachers(snap.docs.map(d => ({ ...d.data() } as SubjectTeacher))));

        return () => { unsubAnnouncements(); unsubAssignments(); unsubRequests(); unsubMaterials(); unsubExams(); unsubParticipants(); unsubTeachers(); };
    }, [classroomId]);


    const handleApproveRequest = async (request: JoinRequest) => {
        if (!isCreator || !user || !classroom) return;
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
        if (!isCreator || !user) return;
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
        if (!isCreator || !participantToRemove) return;
        const participant = participantToRemove;
        setParticipantToRemove(null); // Close dialog immediately
        
        const batch = writeBatch(db);
        
        // 1. Delete from participants subcollection
        const participantRef = doc(db, "classrooms", classroomId, "participants", participant.uid);
        batch.delete(participantRef);
        
        // 2. Remove from main classroom document array (if applicable)
        if (participant.role === 'student') {
            const classroomRef = doc(db, "classrooms", classroomId);
            batch.update(classroomRef, { students: arrayRemove(participant.uid) });
        } else if (participant.role === 'teacher') {
            // Also remove from the teachers subcollection
            const teacherRef = doc(db, "classrooms", classroomId, "teachers", participant.uid);
            batch.delete(teacherRef);
        }
        
        // 3. Delete from user's enrolled subcollection
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

    const onAssignmentSubmit = async (data: z.infer<typeof assignmentSchema>) => {
        if (!canPostAnnouncements) return;
        try {
            const { submissionFile, ...assignmentData } = data;
            await addDoc(collection(db, 'classrooms', classroomId, 'assignments'), { ...assignmentData, createdAt: serverTimestamp() });
            toast({ title: "Assignment Created!" });
            setIsAssignmentDialogOpen(false);
            assignmentForm.reset();
        } catch (error) {
            console.error("Error creating assignment:", error);
            toast({ variant: 'destructive', title: "Creation Failed" });
        }
    };

    const handleAssignmentSubmission = async (assignmentId: string, submissionFile: File | null) => {
        if (!submissionFile || !user) {
            toast({ variant: "destructive", title: "No file selected." });
            return;
        }

        const submissionToastId = toast({
            title: "Uploading Submission...",
            description: "Please wait.",
        });

        try {
            const filePath = `classrooms/${classroomId}/assignments/${assignmentId}/${user.uid}/${submissionFile.name}`;
            const fileRef = storageRef(storage, filePath);
            await uploadBytes(fileRef, submissionFile);
            const fileUrl = await getDownloadURL(fileRef);

            const submissionRef = doc(collection(db, `classrooms/${classroomId}/assignments/${assignmentId}/submissions`));
            await setDoc(submissionRef, {
                studentId: user.uid,
                studentName: user.displayName,
                fileUrl: fileUrl,
                submittedAt: serverTimestamp(),
            });

            toast({ id: submissionToastId.id, title: "Submission successful!", description: "Your assignment has been submitted." });
        } catch (error) {
            console.error("Error submitting assignment:", error);
            toast({ id: submissionToastId.id, variant: "destructive", title: "Submission Failed" });
        }
    };
    
    const handleGradeSubmission = async (assignmentId: string, submission: Submission, teacherFile: File) => {
        if (!user || !canPostAnnouncements) return;
        setIsGrading(submission.id);
        try {
            // Here we assume submission.fileUrl is a direct downloadable URL.
            // For AI, we need to fetch it and convert to data URI.
            const studentFileResponse = await fetch(submission.fileUrl);
            const studentFileBlob = await studentFileResponse.blob();
            const studentSubmissionDataUri = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onloadend = () => resolve(reader.result as string);
              reader.onerror = reject;
              reader.readAsDataURL(studentFileBlob);
            });

            const teacherAssignmentDataUri = await fileToDataUri(teacherFile);

            const result = await gradeAssignment({ studentSubmissionDataUri, teacherAssignmentDataUri });
            
            const submissionRef = doc(db, `classrooms/${classroomId}/assignments/${assignmentId}/submissions`, submission.id);
            await updateDoc(submissionRef, { grade: result.score, feedback: result.feedback });

            toast({ title: `Graded ${submission.studentName}'s Assignment`, description: `Score: ${result.score}` });
        } catch (error) {
            console.error("Error grading submission:", error);
            toast({ variant: 'destructive', title: "AI Grading Failed" });
        } finally {
            setIsGrading(null);
        }
    };

    const handleMaterialUpload = async () => {
        if (!materialFile || !user) return;
        setIsUploadingMaterial(true);
        try {
            const fileRef = storageRef(storage, `classrooms/${classroomId}/materials/${Date.now()}-${materialFile.name}`);
            const snapshot = await uploadBytes(fileRef, fileRef);
            const url = await getDownloadURL(snapshot.ref);
            await addDoc(collection(db, 'classrooms', classroomId, 'materials'), { 
                name: materialFile.name, 
                url, 
                uploadedAt: serverTimestamp(), 
                uploaderName: user.displayName || 'Anonymous',
                type: 'file',
            });
            toast({ title: "Material Uploaded!" });
            setMaterialFile(null);
        } catch(error) {
            console.error("Error uploading material:", error);
            toast({ variant: "destructive", title: "Upload Failed" });
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
                uploaderName: user.displayName || 'Anonymous',
                type: 'link',
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
        if (!canPostAnnouncements || !user) return;
        examForm.clearErrors();

        const examFile = data.examFile?.[0];

        if (!examFile && (!data.questions || data.questions.length === 0)) {
            examForm.setError("questions", { type: "manual", message: "You must add at least one question or upload an exam file." });
            return;
        }

        try {
            let examData: any = {
                title: data.title,
                date: data.date,
                vanishAt: data.vanishAt || null,
            };

            if (examFile) {
                examData.type = 'file';
                const fileRef = storageRef(storage, `classrooms/${classroomId}/exams/${Date.now()}-${examFile.name}`);
                const snapshot = await uploadBytes(fileRef, examFile);
                examData.fileUrl = await getDownloadURL(snapshot.ref);
            } else {
                examData.type = 'text';
                examData.content = data.questions;
            }

            await addDoc(collection(db, 'classrooms', classroomId, 'exams'), examData);
            toast({ title: "Exam Created!" });
            setIsExamDialogOpen(false);
            examForm.reset({ questions: [] });
        } catch (error) {
            console.error("Error creating exam:", error);
            toast({ variant: 'destructive', title: "Creation Failed" });
        }
    };

    if (isLoading || authLoading) return <div className="container mx-auto p-4"><Skeleton className="h-64 w-full" /></div>;
    if (!classroom) return <div className="container mx-auto p-4">Classroom not found.</div>;

    const currencySymbols: { [key: string]: React.ReactNode } = {
        INR: <IndianRupee className="h-6 w-6" />, USD: <DollarSign className="h-6 w-6" />,
        EUR: <Euro className="h-6 w-6" />, GBP: <PoundSterling className="h-6 w-6" />,
    };

    return (
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
                        {isCreator && (
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
                                                {isCreator && s.uid !== user?.uid && (
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
                        {canPostAnnouncements && (
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
                        )}
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
                                            {canPostAnnouncements && (
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
                            <TabsTrigger value="assignments"><BookUser className="mr-2 h-4 w-4" />Assignments</TabsTrigger>
                            <TabsTrigger value="materials"><FileText className="mr-2 h-4 w-4" />Materials</TabsTrigger>
                            <TabsTrigger value="exams"><ClipboardCheck className="mr-2 h-4 w-4" />Exams</TabsTrigger>
                        </TabsList>
                    </div>
                    
                    <div className="flex-grow overflow-y-auto pt-4">
                        <TabsContent value="announcements">
                            <Card><CardHeader><CardTitle>Announcements</CardTitle></CardHeader>
                                <CardContent className="space-y-4">
                                    {canPostAnnouncements && user && <AnnouncementForm classroomId={classroomId} classroomTitle={classroom.title} currentUser={user} />}
                                    <div className="space-y-3">
                                        {announcements.length > 0 ? announcements.map(a => (
                                            <div key={a.id} className="p-3 bg-muted/50 rounded-lg">
                                                {a.type === 'text' && <p className="text-sm">{a.text}</p>}
                                                {a.type === 'audio' && a.audioUrl && <audio controls src={a.audioUrl} className="w-full" />}
                                                <p className="text-xs text-muted-foreground mt-2">
                                                  Posted by {a.creatorName} on {new Date(a.createdAt?.toDate()).toLocaleString()}
                                                  {a.vanishAt && ` | Vanishes on ${new Date(a.vanishAt?.toDate()).toLocaleString()}`}
                                                </p>
                                            </div>
                                        )) : <p className="text-muted-foreground text-center py-4">No announcements yet.</p>}
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
                                     {canPostAnnouncements && (
                                         <Dialog open={isAssignmentDialogOpen} onOpenChange={setIsAssignmentDialogOpen}>
                                             <DialogTrigger asChild><Button><PlusCircle className="mr-2 h-4 w-4"/>Create Assignment</Button></DialogTrigger>
                                             <DialogContent>
                                                 <DialogHeader><DialogTitle>New Assignment</DialogTitle></DialogHeader>
                                                 <form onSubmit={assignmentForm.handleSubmit(onAssignmentSubmit)} className="space-y-4">
                                                     <div className="space-y-2">
                                                         <Label htmlFor="title">Title</Label>
                                                         <Input id="title" {...assignmentForm.register('title')} />
                                                         {assignmentForm.formState.errors.title && <p className="text-destructive text-sm">{assignmentForm.formState.errors.title.message}</p>}
                                                     </div>
                                                     <div className="space-y-2">
                                                         <Label htmlFor="description">Description</Label>
                                                         <Textarea id="description" {...assignmentForm.register('description')} />
                                                     </div>
                                                     <div className="space-y-2">
                                                         <Label>Due Date</Label>
                                                          <Controller name="dueDate" control={assignmentForm.control} render={({ field }) => (
                                                             <Popover>
                                                                 <PopoverTrigger asChild>
                                                                     <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !field.value && "text-muted-foreground")}>
                                                                         <CalendarIcon className="mr-2 h-4 w-4" />
                                                                         {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                                                                     </Button>
                                                                 </PopoverTrigger>
                                                                 <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus /></PopoverContent>
                                                             </Popover>
                                                          )} />
                                                          {assignmentForm.formState.errors.dueDate && <p className="text-destructive text-sm">{assignmentForm.formState.errors.dueDate.message}</p>}
                                                     </div>
                                                     <DialogFooter>
                                                        <DialogClose asChild><Button type="button" variant="secondary">Cancel</Button></DialogClose>
                                                        <Button type="submit">Create</Button>
                                                     </DialogFooter>
                                                 </form>
                                             </DialogContent>
                                         </Dialog>
                                     )}
                                 </CardHeader>
                                 <CardContent className="space-y-6">
                                     {assignments.length > 0 ? assignments.map(assignment => (
                                         <div key={assignment.id} className="p-4 border rounded-lg">
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <h4 className="font-semibold">{assignment.title}</h4>
                                                    <p className="text-sm text-muted-foreground">Due: {new Date(assignment.dueDate.toDate()).toLocaleDateString()}</p>
                                                    <p className="text-sm mt-1">{assignment.description}</p>
                                                </div>
                                                {!canPostAnnouncements && (
                                                    <div className="flex-shrink-0">
                                                        <Input type="file" id={`submission-upload-${assignment.id}`} className="hidden" onChange={(e) => handleAssignmentSubmission(assignment.id, e.target.files?.[0] || null)} />
                                                        <Label htmlFor={`submission-upload-${assignment.id}`} className={cn(buttonVariants(), "cursor-pointer")}>
                                                            <Upload className="mr-2 h-4 w-4"/> Submit Work
                                                        </Label>
                                                    </div>
                                                )}
                                            </div>
                                             <div className="mt-4 pt-4 border-t">
                                                 <h5 className="text-sm font-medium">Submissions ({submissions.get(assignment.id)?.length || 0})</h5>
                                                 <div className="space-y-2 mt-2">
                                                     {submissions.get(assignment.id)?.map(sub => (
                                                         <div key={sub.id} className="flex justify-between items-center p-2 bg-muted/50 rounded-lg">
                                                             <div className="flex items-center gap-2">
                                                                <a href={sub.fileUrl} target="_blank" className="text-primary hover:underline font-medium text-sm">{sub.studentName}'s Submission</a>
                                                                <span className="text-xs text-muted-foreground">({new Date(sub.submittedAt?.toDate()).toLocaleDateString()})</span>
                                                             </div>
                                                             {canPostAnnouncements ? (
                                                                sub.grade !== undefined ? (
                                                                    <div className="text-right">
                                                                        <p className="font-bold text-lg text-primary">{sub.grade}/100</p>
                                                                        <p className="text-xs text-muted-foreground">{sub.feedback}</p>
                                                                    </div>
                                                                ) : (
                                                                     <div className="flex items-center gap-2">
                                                                        <Input type="file" id={`teacher-key-${sub.id}`} className="hidden" onChange={(e) => handleGradeSubmission(assignment.id, sub, e.target.files![0])} />
                                                                        <Label htmlFor={`teacher-key-${sub.id}`} className={cn(buttonVariants({variant: 'outline', size: 'sm'}), "cursor-pointer")}>
                                                                            {isGrading === sub.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <BrainCircuit className="mr-2 h-4 w-4"/>} Grade with AI
                                                                        </Label>
                                                                     </div>
                                                                )
                                                             ) : (
                                                                sub.grade !== undefined ? (
                                                                     <p className="font-bold text-lg text-primary">{sub.grade}/100</p>
                                                                ) : (
                                                                     <p className="text-sm text-muted-foreground">Pending Grade</p>
                                                                )
                                                             )}
                                                         </div>
                                                     ))}
                                                 </div>
                                             </div>
                                         </div>
                                     )) : <p className="text-muted-foreground text-center py-4">No assignments created yet.</p>}
                                 </CardContent>
                             </Card>
                         </TabsContent>
                        
                        <TabsContent value="materials">
                            <Card>
                                <CardHeader><CardTitle>Class Materials</CardTitle></CardHeader>
                                <CardContent className="space-y-4">
                                    {canPostAnnouncements && user && (
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
                                            <a key={m.id} href={m.url} target="_blank" rel="noreferrer" className="flex items-center justify-between p-3 bg-muted/50 rounded-lg hover:bg-muted">
                                                <div>
                                                    <span className="font-medium flex items-center gap-2">{m.type === 'link' ? <LinkIcon className="h-4 w-4"/> : <FileText className="h-4 w-4"/>}{m.name}</span>
                                                    <span className="text-xs text-muted-foreground ml-6">Shared by {m.uploaderName} on {new Date(m.uploadedAt?.toDate()).toLocaleDateString()}</span>
                                                </div>
                                            </a>
                                        )) : <p className="text-muted-foreground text-center py-6">No materials shared yet. Be the first!</p>}
                                    </div>
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
                                    {canPostAnnouncements && (
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
                                                            <Controller control={examForm.control} name="date" render={({ field }) => <VanishDateTimePicker date={field.value} setDate={field.onChange} />} />
                                                            {examForm.formState.errors.date && <p className="text-destructive text-sm">{examForm.formState.errors.date.message}</p>}
                                                        </div>
                                                        <div className="space-y-2">
                                                            <Label>Vanish Time (Optional)</Label>
                                                            <Controller control={examForm.control} name="vanishAt" render={({ field }) => <VanishDateTimePicker date={field.value} setDate={field.onChange} />} />
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
                                            <div key={exam.id} className="p-4 border rounded-lg">
                                                <div className="flex justify-between items-start">
                                                    <div>
                                                        <h4 className="font-semibold">{exam.title}</h4>
                                                        <p className="text-sm text-muted-foreground">Scheduled for: {new Date(exam.date.toDate()).toLocaleString()}</p>
                                                    </div>
                                                    <Button size="sm" className="btn-gel">Take Exam</Button>
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
    );
}

