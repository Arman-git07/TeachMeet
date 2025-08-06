
'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { db, storage } from '@/lib/firebase';
import { doc, getDoc, onSnapshot, collection, query, writeBatch, addDoc, serverTimestamp, orderBy, deleteDoc, updateDoc } from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL, deleteObject as deleteFile } from 'firebase/storage';
import { useDynamicHeader } from '@/contexts/DynamicHeaderContext';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
  DialogFooter
} from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  BadgeDollarSign,
  Send,
  Mic,
  StopCircle,
  Play,
  Trash2,
  Loader2,
  UploadCloud,
  Link as LinkIcon,
  Download,
  PlusCircle,
  ExternalLink,
  Calendar as CalendarIcon,
  Edit,
  FileUp,
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { format, formatDistanceToNow } from 'date-fns';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Switch } from '@/components/ui/switch';


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
  studentId: string;
}

interface Announcement {
    id: string;
    content: string;
    authorName: string;
    createdAt: {
        seconds: number;
        nanoseconds: number;
    };
    audioURL?: string;
}

interface Material {
  id: string;
  type: 'link' | 'file';
  title: string;
  url: string;
  fileName?: string;
  fileSize?: string;
  createdAt: { seconds: number };
}

interface Assignment {
  id: string;
  title: string;
  description: string;
  dueDate: { seconds: number };
  status: 'draft' | 'published';
  fileURL?: string;
  fileName?: string;
  createdAt: { seconds: number };
}


const AudioRecordingDialog = React.memo(({ onAudioRecorded }: { onAudioRecorded: (blob: Blob) => void }) => {
    const [isRecording, setIsRecording] = useState(false);
    const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
    const [audioUrl, setAudioUrl] = useState<string | null>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const { toast } = useToast();

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorderRef.current = new MediaRecorder(stream);
            mediaRecorderRef.current.ondataavailable = (event) => {
                chunksRef.current.push(event.data);
            };
            mediaRecorderRef.current.onstop = () => {
                const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
                setAudioBlob(blob);
                setAudioUrl(URL.createObjectURL(blob));
                chunksRef.current = [];
                stream.getTracks().forEach(track => track.stop());
            };
            chunksRef.current = [];
            mediaRecorderRef.current.start();
            setIsRecording(true);
            setAudioBlob(null);
            setAudioUrl(null);
        } catch (error) {
            console.error("Error starting recording:", error);
            toast({ variant: 'destructive', title: 'Recording Failed', description: 'Could not access microphone. Please grant permission.' });
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
        }
    };
    
    const handleAttach = () => {
      if (audioBlob) {
        onAudioRecorded(audioBlob);
      }
    };

    const handleReset = () => {
      setAudioBlob(null);
      if(audioUrl) {
          URL.revokeObjectURL(audioUrl);
          setAudioUrl(null);
      }
    }

    return (
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Record Audio Announcement</DialogTitle>
                <DialogDescription>Record a short audio message to attach to your announcement.</DialogDescription>
            </DialogHeader>
            <div className="flex flex-col items-center justify-center space-y-4 py-6">
                {!isRecording && !audioUrl && (
                    <Button onClick={startRecording} size="lg" className="rounded-full h-16 w-16 p-0">
                        <Mic className="h-8 w-8" />
                    </Button>
                )}
                {isRecording && (
                    <Button onClick={stopRecording} variant="destructive" size="lg" className="rounded-full h-16 w-16 p-0">
                        <StopCircle className="h-8 w-8" />
                    </Button>
                )}
                {audioUrl && (
                    <div className="w-full space-y-3">
                      <audio src={audioUrl} controls className="w-full rounded-lg" />
                      <Button onClick={handleReset} variant="outline" size="sm" className="w-full">
                        <Trash2 className="mr-2 h-4 w-4" /> Record Again
                      </Button>
                    </div>
                )}
                <p className="text-sm text-muted-foreground">
                    {isRecording ? "Recording..." : audioUrl ? "Preview your recording." : "Click to start recording."}
                </p>
            </div>
            <DialogFooter>
                <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                <DialogClose asChild>
                  <Button onClick={handleAttach} disabled={!audioBlob}>
                    Attach Recording
                  </Button>
                </DialogClose>
            </DialogFooter>
        </DialogContent>
    );
});
AudioRecordingDialog.displayName = 'AudioRecordingDialog';


const AddMaterialDialog = React.memo(({ teachingId, onMaterialAdded }: { teachingId: string; onMaterialAdded: () => void }) => {
    const [materialType, setMaterialType] = useState<'file' | 'link'>('file');
    const [title, setTitle] = useState('');
    const [url, setUrl] = useState('');
    const [file, setFile] = useState<File | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const { toast } = useToast();

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
            setTitle(e.target.files[0].name);
        }
    };
    
    const handleSubmit = async () => {
        if (!title.trim()) {
            toast({ variant: 'destructive', title: 'Title is required' });
            return;
        }

        setIsUploading(true);
        try {
            if (materialType === 'file') {
                if (!file) {
                    toast({ variant: 'destructive', title: 'File is required' });
                    setIsUploading(false);
                    return;
                }
                const fileRef = storageRef(storage, `classrooms/${teachingId}/materials/${Date.now()}-${file.name}`);
                const snapshot = await uploadBytes(fileRef, file);
                const downloadURL = await getDownloadURL(snapshot.ref);

                await addDoc(collection(db, `classrooms/${teachingId}/materials`), {
                    type: 'file',
                    title: title.trim(),
                    url: downloadURL,
                    fileName: file.name,
                    fileSize: `${(file.size / (1024*1024)).toFixed(2)} MB`,
                    createdAt: serverTimestamp(),
                });
            } else {
                if (!url.trim()) {
                    toast({ variant: 'destructive', title: 'URL is required' });
                    setIsUploading(false);
                    return;
                }
                await addDoc(collection(db, `classrooms/${teachingId}/materials`), {
                    type: 'link',
                    title: title.trim(),
                    url: url.trim(),
                    createdAt: serverTimestamp(),
                });
            }
            toast({ title: 'Material Added!', description: `"${title.trim()}" has been added.` });
            onMaterialAdded();
        } catch (error) {
            console.error('Error adding material:', error);
            toast({ variant: 'destructive', title: 'Error', description: 'Could not add material.' });
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Add New Material</DialogTitle>
                <DialogDescription>Upload a file or add a web link for your students.</DialogDescription>
            </DialogHeader>
            <Tabs value={materialType} onValueChange={(value) => setMaterialType(value as 'file' | 'link')} className="pt-4">
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="file"><UploadCloud className="mr-2 h-4 w-4"/>Upload File</TabsTrigger>
                    <TabsTrigger value="link"><LinkIcon className="mr-2 h-4 w-4"/>Add Link</TabsTrigger>
                </TabsList>
                <TabsContent value="file" className="space-y-4 pt-4">
                    <div className="space-y-2">
                        <Label htmlFor="file-title">Title</Label>
                        <Input id="file-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g., Lecture 1 Slides" />
                    </div>
                     <div className="space-y-2">
                        <Label htmlFor="file-upload">File</Label>
                        <Input id="file-upload" type="file" onChange={handleFileChange} />
                    </div>
                </TabsContent>
                <TabsContent value="link" className="space-y-4 pt-4">
                     <div className="space-y-2">
                        <Label htmlFor="link-title">Title</Label>
                        <Input id="link-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g., Required Reading Article" />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="link-url">URL</Label>
                        <Input id="link-url" type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com" />
                    </div>
                </TabsContent>
            </Tabs>
            <DialogFooter>
                <DialogClose asChild><Button variant="outline" disabled={isUploading}>Cancel</Button></DialogClose>
                <Button onClick={handleSubmit} disabled={isUploading}>
                    {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null}
                    {isUploading ? 'Adding...' : 'Add Material'}
                </Button>
            </DialogFooter>
        </DialogContent>
    );
});
AddMaterialDialog.displayName = 'AddMaterialDialog';

const AssignmentDialog = React.memo(({ classroomId, onAssignmentAction, assignmentToEdit }: { classroomId: string; onAssignmentAction: () => void, assignmentToEdit: Assignment | null }) => {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [dueDate, setDueDate] = useState<Date | undefined>(undefined);
    const [file, setFile] = useState<File | null>(null);
    const [isPublished, setIsPublished] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const { toast } = useToast();

    useEffect(() => {
        if (assignmentToEdit) {
            setTitle(assignmentToEdit.title);
            setDescription(assignmentToEdit.description);
            setDueDate(new Date(assignmentToEdit.dueDate.seconds * 1000));
            setIsPublished(assignmentToEdit.status === 'published');
        } else {
            setTitle('');
            setDescription('');
            setDueDate(undefined);
            setIsPublished(false);
        }
    }, [assignmentToEdit]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
        }
    };

    const handleSubmit = async () => {
        if (!title.trim() || !dueDate) {
            toast({ variant: 'destructive', title: 'Missing Fields', description: 'Title and due date are required.' });
            return;
        }

        setIsLoading(true);
        try {
            let fileURL: string | undefined = assignmentToEdit?.fileURL;
            let fileName: string | undefined = assignmentToEdit?.fileName;

            if (file) {
                const fileRef = storageRef(storage, `classrooms/${classroomId}/assignments/${Date.now()}-${file.name}`);
                const snapshot = await uploadBytes(fileRef, file);
                fileURL = await getDownloadURL(snapshot.ref);
                fileName = file.name;
            }

            const assignmentData = {
                title: title.trim(),
                description: description.trim(),
                dueDate,
                status: isPublished ? 'published' : 'draft',
                fileURL,
                fileName,
            };

            if (assignmentToEdit) {
                const assignmentRef = doc(db, 'classrooms', classroomId, 'assignments', assignmentToEdit.id);
                await updateDoc(assignmentRef, assignmentData);
                toast({ title: 'Assignment Updated', description: `"${title.trim()}" has been updated.` });
            } else {
                await addDoc(collection(db, 'classrooms', classroomId, 'assignments'), {
                    ...assignmentData,
                    createdAt: serverTimestamp(),
                });
                toast({ title: 'Assignment Created', description: `"${title.trim()}" has been created as a ${isPublished ? 'published' : 'draft'} assignment.` });
            }
            onAssignmentAction();

        } catch (error) {
            console.error('Error saving assignment:', error);
            toast({ variant: 'destructive', title: 'Save Failed', description: 'Could not save the assignment.' });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
                <DialogTitle>{assignmentToEdit ? 'Edit Assignment' : 'Create New Assignment'}</DialogTitle>
                <DialogDescription>{assignmentToEdit ? 'Update details for this assignment.' : 'Fill out the details for the new assignment.'}</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="title" className="text-right">Title</Label>
                    <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} className="col-span-3" placeholder="e.g., Essay on Photosynthesis"/>
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="description" className="text-right">Description</Label>
                    <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} className="col-span-3" placeholder="(Optional) Instructions or details"/>
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label className="text-right">Due Date</Label>
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button variant="outline" className={cn("col-span-3 justify-start text-left font-normal", !dueDate && "text-muted-foreground")}>
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {dueDate ? format(dueDate, "PPP") : <span>Pick a date</span>}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={dueDate} onSelect={setDueDate} initialFocus /></PopoverContent>
                    </Popover>
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="file" className="text-right">File</Label>
                    <Input id="file" type="file" onChange={handleFileChange} className="col-span-3"/>
                </div>
                 {file && <p className="col-span-4 text-sm text-muted-foreground text-center">Attaching: {file.name}</p>}
                {assignmentToEdit && assignmentToEdit.fileName && !file && <p className="col-span-4 text-sm text-muted-foreground text-center">Current file: {assignmentToEdit.fileName}</p>}
                <div className="flex items-center justify-end space-x-2 pt-4 border-t">
                    <Label htmlFor="publish-switch">Publish to Students</Label>
                    <Switch id="publish-switch" checked={isPublished} onCheckedChange={setIsPublished}/>
                </div>
            </div>
            <DialogFooter>
                <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
                <Button onClick={handleSubmit} disabled={isLoading}>
                    {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : assignmentToEdit ? "Save Changes" : "Create"}
                </Button>
            </DialogFooter>
        </DialogContent>
    );
});
AssignmentDialog.displayName = 'AssignmentDialog';


export default function ClassroomPage() {
  const params = useParams();
  const classroomId = params.classroomId as string;
  const router = useRouter();
  const { user } = useAuth();
  const { toast } = useToast();
  const { setHeaderContent, setHeaderAction } = useDynamicHeader();

  const [classroom, setClassroom] = useState<Classroom | null>(null);
  const [joinRequests, setJoinRequests] = useState<JoinRequest[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [newAnnouncement, setNewAnnouncement] = useState('');
  const [audioAttachment, setAudioAttachment] = useState<Blob | null>(null);
  const [isPosting, setIsPosting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddMaterialOpen, setIsAddMaterialOpen] = useState(false);
  const [isAssignmentDialogOpen, setIsAssignmentDialogOpen] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState<Assignment | null>(null);
  const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null);
  
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
    
    const unsubClassroom = onSnapshot(doc(db, 'classrooms', classroomId), (docSnap) => {
      if (docSnap.exists()) {
        setClassroom({ id: docSnap.id, ...docSnap.data() } as Classroom);
      } else {
        toast({ variant: 'destructive', title: 'Error', description: 'Classroom not found.' });
        router.push('/dashboard/classrooms');
      }
      setIsLoading(false);
    });

    const unsubAnnouncements = onSnapshot(query(collection(db, 'classrooms', classroomId, 'announcements'), orderBy('createdAt', 'desc')), (snapshot) => {
        setAnnouncements(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Announcement)));
    });
    
    const unsubMaterials = onSnapshot(query(collection(db, 'classrooms', classroomId, 'materials'), orderBy('createdAt', 'desc')), (snapshot) => {
        setMaterials(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Material)));
    });

    const unsubAssignments = onSnapshot(query(collection(db, 'classrooms', classroomId, 'assignments'), orderBy('createdAt', 'desc')), (snapshot) => {
        setAssignments(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Assignment)));
    });

    return () => { 
        unsubClassroom();
        unsubAnnouncements();
        unsubMaterials();
        unsubAssignments();
     };
  }, [classroomId, router, toast]);
  
  useEffect(() => {
    if (isTeacher && classroomId) {
      const unsubRequests = onSnapshot(query(collection(db, 'classrooms', classroomId, 'joinRequests')), (snapshot) => {
        setJoinRequests(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as JoinRequest)));
      });
      return () => unsubRequests();
    }
  }, [isTeacher, classroomId]);

  const handleRequestAction = useCallback(async (requestId: string, approve: boolean) => {
    if (!isTeacher || !classroomId) return;
    
    try {
        const requestRef = doc(db, 'classrooms', classroomId, 'joinRequests', requestId);
        
        if (approve) {
            const studentRequestSnap = await getDoc(requestRef);
            if (!studentRequestSnap.exists()) {
                throw new Error("Join request not found.");
            }
            const studentData = studentRequestSnap.data() as JoinRequest;

            const batch = writeBatch(db);
            const enrollmentRef = doc(db, 'users', studentData.studentId, 'enrolled', classroomId);
            batch.set(enrollmentRef, {
                classroomId: classroomId,
                title: classroom?.title,
                description: classroom?.description,
                teacherName: classroom?.teacherName,
                enrolledAt: serverTimestamp(),
            });
            batch.delete(requestRef);
            await batch.commit();

        } else {
            await deleteDoc(requestRef);
        }
        
        toast({ title: `Request ${approve ? 'Approved' : 'Denied'}`, description: `The student has been ${approve ? 'added to the class' : 'denied entry'}.` });
    } catch (error) {
        console.error("Error handling join request:", error);
        toast({ variant: 'destructive', title: 'Error', description: 'Could not process the request. Check Firestore rules.' });
    }
  }, [isTeacher, classroomId, classroom?.title, classroom?.description, classroom?.teacherName, toast]);
  
  const handlePostAnnouncement = async () => {
    if ((!newAnnouncement.trim() && !audioAttachment) || !user || !isTeacher) return;
    setIsPosting(true);

    try {
      let audioURL: string | undefined = undefined;
      if (audioAttachment) {
        const audioRef = storageRef(storage, `classrooms/${classroomId}/announcements/${Date.now()}.webm`);
        const snapshot = await uploadBytes(audioRef, audioAttachment);
        audioURL = await getDownloadURL(snapshot.ref);
      }

      await addDoc(collection(db, `classrooms/${classroomId}/announcements`), {
        content: newAnnouncement.trim(),
        authorName: user.displayName || 'Teacher',
        authorId: user.uid,
        createdAt: serverTimestamp(),
        audioURL: audioURL,
      });

      setNewAnnouncement('');
      setAudioAttachment(null);
      toast({ title: "Announcement Posted!" });
    } catch (error) {
      console.error("Error posting announcement:", error);
      toast({ variant: "destructive", title: "Error", description: "Could not post announcement." });
    } finally {
      setIsPosting(false);
    }
  };

  const handleAudioRecorded = useCallback((blob: Blob) => {
      setAudioAttachment(blob);
      toast({ title: "Audio Attached", description: "Your recording is ready to be posted with the announcement." });
  }, [toast]);
  
  const handleDeleteMaterial = async (material: Material) => {
    if (!isTeacher) return;
    try {
        await deleteDoc(doc(db, 'classrooms', classroomId, 'materials', material.id));
        if (material.type === 'file') {
            const fileStorageRef = storageRef(storage, material.url);
            await deleteFile(fileStorageRef);
        }
        toast({title: 'Material Deleted', description: `"${material.title}" has been removed.`});
    } catch (error) {
        console.error("Error deleting material:", error);
        toast({variant: 'destructive', title: 'Error', description: 'Could not delete the material.'});
    }
  };

  const handleOpenAssignmentDialog = (assignment: Assignment | null) => {
    setEditingAssignment(assignment);
    setIsAssignmentDialogOpen(true);
  };
  
  const handleDeleteAssignment = async (assignment: Assignment) => {
    if (!isTeacher) return;
    try {
      await deleteDoc(doc(db, 'classrooms', classroomId, 'assignments', assignment.id));
      if (assignment.fileURL) {
        const fileRef = storageRef(storage, assignment.fileURL);
        await deleteFile(fileRef).catch(err => console.warn("Could not delete assignment file, it might not exist:", err));
      }
      toast({ title: 'Assignment Deleted', description: `"${assignment.title}" has been removed.` });
    } catch (error) {
      console.error("Error deleting assignment:", error);
      toast({ variant: 'destructive', title: 'Error', description: 'Could not delete the assignment.' });
    }
  };


  if (isLoading) {
    return (
      <div className="space-y-4 p-4 md:p-8">
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
      <div className="flex flex-col items-center justify-center h-full text-center p-4 md:p-8">
        <AlertTriangle className="h-16 w-16 text-destructive mb-4" />
        <h2 className="text-2xl font-bold">Classroom Not Found</h2>
        <p className="text-muted-foreground">The classroom you are looking for does not exist or has been deleted.</p>
        <Button asChild className="mt-6">
          <Link href="/dashboard/classrooms">Go Back to Classrooms</Link>
        </Button>
      </div>
    );
  }

  const tabItems = [
    { value: "announcements", label: "Announcements", icon: Bell },
    { value: "materials", label: "Materials", icon: Book },
    { value: "assignments", label: "Assignments", icon: ClipboardList },
    { value: "subjects", label: "Subjects", icon: GraduationCap },
    { value: "exams", label: "Exams", icon: FileText },
    { value: "fees", label: "Fees", icon: CreditCard },
    { value: "chat", label: "Chat", icon: MessageSquare },
  ];
  
  const displayedAssignments = isTeacher ? assignments : assignments.filter(a => a.status === 'published');


  return (
    <div className="flex flex-col gap-4 pb-24 px-4 md:px-8">
      {isTeacher && joinRequests.length > 0 && (
          <div className="pt-4">
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
        
        <Tabs defaultValue="announcements" className="grid grid-cols-1 md:grid-cols-[250px_1fr] gap-6 mt-4">
          <div className="w-full">
             <div className="flex-col h-auto items-start gap-2 bg-transparent p-0 w-full">
              {tabItems.map(({ value, label, icon: Icon }) => (
                  <TabsTrigger 
                    key={value}
                    value={value} 
                    className={cn(
                      "w-full justify-start text-base py-3 px-4 rounded-lg",
                      "data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg",
                      "hover:bg-muted"
                    )}
                  >
                    <Icon className="mr-3 h-5 w-5" />
                    {label}
                  </TabsTrigger>
              ))}
            </div>
          </div>
          
          <div className="md:col-start-2">
              <TabsContent value="announcements" className="mt-0">
                 <Card>
                    <CardHeader>
                      <CardTitle>Announcements</CardTitle>
                      <CardDescription>Latest updates and announcements from the teacher.</CardDescription>
                    </CardHeader>
                     <CardContent className="space-y-4 pt-6">
                        {isTeacher && (
                          <Dialog>
                            <div className="flex gap-2 items-start">
                                <Avatar className="mt-1">
                                    <AvatarImage src={user?.photoURL ?? ''} data-ai-hint="avatar user"/>
                                    <AvatarFallback>{user?.displayName?.charAt(0) || 'T'}</AvatarFallback>
                                </Avatar>
                                <div className="flex-grow space-y-2">
                                    <Textarea
                                        placeholder="Write an announcement..."
                                        value={newAnnouncement}
                                        onChange={(e) => setNewAnnouncement(e.target.value)}
                                        className="rounded-lg"
                                        disabled={isPosting}
                                    />
                                    {audioAttachment && (
                                        <div className="p-2 border rounded-lg flex items-center gap-2">
                                            <audio src={URL.createObjectURL(audioAttachment)} controls className="w-full h-8"/>
                                            <Button variant="ghost" size="icon" onClick={() => setAudioAttachment(null)}><Trash2 className="h-4 w-4"/></Button>
                                        </div>
                                    )}
                                    <div className="flex justify-end items-center gap-2">
                                      <DialogTrigger asChild>
                                        <Button variant="outline" size="icon" className="rounded-lg" disabled={isPosting}>
                                            <Mic className="h-4 w-4" />
                                        </Button>
                                      </DialogTrigger>
                                      <Button onClick={handlePostAnnouncement} disabled={(!newAnnouncement.trim() && !audioAttachment) || isPosting} size="sm" className="rounded-lg">
                                        {isPosting ? <Loader2 className="h-4 w-4 animate-spin mr-2"/> : <Send className="mr-2 h-4 w-4"/>}
                                        {isPosting ? 'Posting...' : 'Post'}
                                      </Button>
                                    </div>
                                </div>
                            </div>
                            <AudioRecordingDialog onAudioRecorded={handleAudioRecorded} />
                          </Dialog>
                        )}
                        {announcements.length > 0 ? (
                           <div className="space-y-4">
                                {announcements.map(ann => (
                                    <div key={ann.id} className="p-4 bg-muted/50 rounded-lg">
                                        {ann.content && <p className="text-sm text-foreground whitespace-pre-wrap">{ann.content}</p>}
                                        {ann.audioURL && (
                                            <div className="mt-2">
                                                <audio src={ann.audioURL} controls className="w-full rounded-lg" />
                                            </div>
                                        )}
                                        <p className="text-xs text-muted-foreground mt-2">
                                            Posted by {ann.authorName} - {ann.createdAt ? formatDistanceToNow(new Date(ann.createdAt.seconds * 1000), { addSuffix: true }) : 'just now'}
                                        </p>
                                    </div>
                                ))}
                           </div>
                        ) : (
                           <div className="text-center text-muted-foreground py-10">
                                <Bell className="h-12 w-12 mx-auto mb-2" />
                                <p>No announcements yet.</p>
                                <p className="text-xs">Check back later for updates.</p>
                           </div>
                        )}
                    </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="materials" className="mt-0">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between">
                        <div>
                            <CardTitle>Course Materials</CardTitle>
                            <CardDescription>All shared files and links for this classroom.</CardDescription>
                        </div>
                        {isTeacher && (
                          <Dialog open={isAddMaterialOpen} onOpenChange={setIsAddMaterialOpen}>
                            <DialogTrigger asChild>
                                <Button><PlusCircle className="mr-2 h-4 w-4"/>Add Material</Button>
                            </DialogTrigger>
                            <AddMaterialDialog teachingId={classroomId} onMaterialAdded={() => setIsAddMaterialOpen(false)} />
                          </Dialog>
                        )}
                    </CardHeader>
                    <CardContent>
                        {materials.length > 0 ? (
                            <div className="space-y-2">
                                {materials.map(material => (
                                    <div key={material.id} className="flex items-center justify-between p-3 rounded-lg hover:bg-muted group">
                                        <div className="flex items-center gap-3">
                                            {material.type === 'file' ? <FileText className="h-5 w-5 text-primary"/> : <LinkIcon className="h-5 w-5 text-accent"/>}
                                            <div>
                                                <p className="font-medium text-foreground">{material.title}</p>
                                                <p className="text-xs text-muted-foreground">
                                                  Added on {format(new Date(material.createdAt.seconds * 1000), 'MMM d, yyyy')}
                                                  {material.fileSize && ` - ${material.fileSize}`}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Button asChild variant="outline" size="sm">
                                                <a href={material.url} target="_blank" rel="noopener noreferrer">
                                                    {material.type === 'file' ? <Download className="mr-2 h-4 w-4"/> : <ExternalLink className="mr-2 h-4 w-4"/>}
                                                    {material.type === 'file' ? 'Download' : 'Open Link'}
                                                </a>
                                            </Button>
                                            {isTeacher && (
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive opacity-0 group-hover:opacity-100" onClick={() => handleDeleteMaterial(material)}>
                                                    <Trash2 className="h-4 w-4"/>
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                             <div className="text-center text-muted-foreground py-12">
                                <Book className="h-12 w-12 mx-auto mb-2" />
                                <p>No materials have been added yet.</p>
                             </div>
                        )}
                    </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="assignments" className="mt-0">
                {selectedAssignment ? (
                    <Card>
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <div>
                                    <Button variant="ghost" size="sm" onClick={() => setSelectedAssignment(null)} className="-ml-2"><ArrowLeft className="mr-2 h-4 w-4"/> Back to list</Button>
                                    <CardTitle className="mt-2">{selectedAssignment.title}</CardTitle>
                                    <CardDescription>Due: {format(new Date(selectedAssignment.dueDate.seconds * 1000), "PPP")}</CardDescription>
                                </div>
                                {isTeacher && (
                                    <Button variant="outline" size="sm" onClick={() => handleOpenAssignmentDialog(selectedAssignment)}><Edit className="mr-2 h-4 w-4"/> Edit</Button>
                                )}
                            </div>
                        </CardHeader>
                        <CardContent>
                            {selectedAssignment.description && <p className="mb-4 text-sm whitespace-pre-wrap">{selectedAssignment.description}</p>}
                             {selectedAssignment.fileURL && (
                                <Button asChild variant="secondary" className="mb-6"><a href={selectedAssignment.fileURL} target="_blank" rel="noopener noreferrer"><Download className="mr-2 h-4 w-4"/>Download Assignment File</a></Button>
                             )}

                            <div className="border-t pt-4">
                                <h3 className="font-semibold text-lg mb-2">{isTeacher ? "Student Submissions" : "Your Submission"}</h3>
                                 <Card className="bg-muted/50 p-6 text-center">
                                    {isTeacher ? (
                                        <p>Submissions will appear here.</p>
                                    ) : (
                                        <div>
                                            <p className="mb-4">You have not submitted this assignment yet.</p>
                                            <Button><FileUp className="mr-2 h-4 w-4"/> Upload Your Work</Button>
                                        </div>
                                    )}
                                 </Card>
                            </div>
                        </CardContent>
                    </Card>
                ) : (
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <div>
                                <CardTitle>Assignments</CardTitle>
                                <CardDescription>View upcoming and past assignments.</CardDescription>
                            </div>
                            {isTeacher && (
                                <Dialog open={isAssignmentDialogOpen} onOpenChange={setIsAssignmentDialogOpen}>
                                    <DialogTrigger asChild>
                                        <Button onClick={() => handleOpenAssignmentDialog(null)}><PlusCircle className="mr-2 h-4 w-4"/>New Assignment</Button>
                                    </DialogTrigger>
                                    <AssignmentDialog classroomId={classroomId} onAssignmentAction={() => setIsAssignmentDialogOpen(false)} assignmentToEdit={editingAssignment} />
                                </Dialog>
                            )}
                        </CardHeader>
                        <CardContent>
                            {displayedAssignments.length > 0 ? (
                                <div className="space-y-2">
                                    {displayedAssignments.map(assignment => (
                                        <div key={assignment.id} className="flex items-center justify-between p-3 rounded-lg hover:bg-muted group">
                                            <div className="flex items-center gap-3">
                                                <ClipboardList className="h-5 w-5 text-primary" />
                                                <div>
                                                    <a onClick={() => setSelectedAssignment(assignment)} className="font-medium text-foreground cursor-pointer hover:underline">{assignment.title}</a>
                                                    <p className="text-xs text-muted-foreground">
                                                        Due on {format(new Date(assignment.dueDate.seconds * 1000), 'MMM d, yyyy')}
                                                        {isTeacher && <span className={cn("ml-2 px-2 py-0.5 rounded-full text-xs", assignment.status === 'published' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800')}>{assignment.status}</span>}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                 <Button variant="secondary" size="sm" onClick={() => setSelectedAssignment(assignment)}>View</Button>
                                                {isTeacher && (
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive opacity-0 group-hover:opacity-100" onClick={() => handleDeleteAssignment(assignment)}>
                                                        <Trash2 className="h-4 w-4"/>
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center text-muted-foreground py-12">
                                    <ClipboardList className="h-12 w-12 mx-auto mb-2" />
                                    <p>No assignments posted yet.</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                )}
              </TabsContent>

              <TabsContent value="subjects" className="mt-0">
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
              
              <TabsContent value="exams" className="mt-0">
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

              <TabsContent value="fees" className="mt-0">
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

               <TabsContent value="chat" className="mt-0">
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
          </div>
        </Tabs>
    </div>
  );
}
