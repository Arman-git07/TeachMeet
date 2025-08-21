

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { db, storage } from '@/lib/firebase';
import {
  collection,
  addDoc,
  serverTimestamp,
  doc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  writeBatch,
  setDoc,
  getDocs,
  collectionGroup,
} from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import {
  PlusCircle,
  Edit,
  Trash2,
  Users,
  LogIn,
  Loader2,
  BookOpen,
  Eye,
  School,
  ArrowRight,
  Clipboard,
  ClipboardCheck,
  UserPlus,
  GraduationCap,
  Briefcase,
  FileUp,
  XCircle,
  Book,
  Phone,
  Clock,
  Award,
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Textarea } from '@/components/ui/textarea';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';


export interface Classroom {
  id: string;
  title: string;
  description: string;
  teacherId: string;
  teacherName: string;
  isPublic: boolean;
  students: string[];
  createdAt?: any;
}

export interface EnrolledClassroomInfo {
    id: string;
    title: string;
    description: string;
    teacherName: string;
    classroomId: string;
}


const CreateClassroomDialogContent = ({
  onSuccess,
  classroomToEdit,
}: {
  onSuccess: () => void;
  classroomToEdit?: Classroom | null;
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (classroomToEdit) {
      setTitle(classroomToEdit.title);
      setDescription(classroomToEdit.description);
      setIsPublic(classroomToEdit.isPublic);
    } else {
      setTitle('');
      setDescription('');
      setIsPublic(true);
    }
  }, [classroomToEdit]);

  const handleSubmit = async () => {
    if (!user) {
      toast({ variant: 'destructive', title: 'Not Authenticated' });
      return;
    }
    if (!title.trim()) {
      toast({ variant: 'destructive', title: 'Title is required' });
      return;
    }
    setIsLoading(true);

    try {
      if (classroomToEdit) {
        // --- UPDATE EXISTING CLASSROOM ---
        const classroomRef = doc(db, 'classrooms', classroomToEdit.id);
        await updateDoc(classroomRef, { title, description, isPublic });
        toast({ title: 'Classroom Updated', description: `"${title}" has been successfully updated.` });
      } else {
        // --- CREATE NEW CLASSROOM ---
        const classroomData = {
          title: title.trim(),
          description: description.trim(),
          teacherId: user.uid,
          teacherName: user.displayName || 'Anonymous Teacher',
          isPublic,
          students: [], 
          teachers: [],
          createdAt: serverTimestamp(),
        };
        await addDoc(collection(db, 'classrooms'), classroomData);
        toast({ title: 'Classroom Created', description: `"${title}" has been successfully created.` });
      }
      
      onSuccess();

    } catch (error) {
      console.error('Error saving classroom:', error);
      toast({ variant: 'destructive', title: 'Save Failed', description: 'Could not save the classroom. Check Firestore rules and console for errors.' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>{classroomToEdit ? 'Edit Classroom' : 'Create New Classroom'}</DialogTitle>
        <DialogDescription>{classroomToEdit ? 'Update the details.' : 'Fill out the details for your new class.'}</DialogDescription>
      </DialogHeader>
      <div className="grid gap-4 py-4">
        <div className="grid grid-cols-4 items-center gap-4">
          <Label htmlFor="title" className="text-right">Title</Label>
          <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} className="col-span-3" placeholder="e.g., Introduction to React" disabled={isLoading}/>
        </div>
        <div className="grid grid-cols-4 items-center gap-4">
          <Label htmlFor="description" className="text-right">Description</Label>
          <Input id="description" value={description} onChange={(e) => setDescription(e.target.value)} className="col-span-3" placeholder="A brief summary" disabled={isLoading}/>
        </div>
        <div className="flex items-center space-x-2 justify-end">
          <Label htmlFor="is-public">Make Public</Label>
          <Switch id="is-public" checked={isPublic} onCheckedChange={setIsPublic} disabled={isLoading}/>
        </div>
      </div>
      <DialogFooter>
        <DialogClose asChild><Button type="button" variant="secondary" disabled={isLoading}>Cancel</Button></DialogClose>
        <Button onClick={handleSubmit} disabled={isLoading}>
          {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          {classroomToEdit ? 'Save Changes' : 'Create Classroom'}
        </Button>
      </DialogFooter>
    </>
  );
};


const teacherApplicationSchema = z.object({
    fullName: z.string().min(1, 'Full name is required'),
    subject: z.string().min(1, 'Subject is required'),
    mobile: z.string().regex(/^\+?[0-9\s-()]+$/, 'Please enter a valid mobile number').min(1, 'Mobile number is required'),
    qualification: z.string().min(1, 'Qualification is required'),
    experience: z.string().min(1, 'Experience is required'),
    availability: z.string().min(1, 'Availability is required'),
    message: z.string().optional(),
    resume: z.any().optional(),
});

const TeacherApplicationDialog = ({ classroom, onSubmitted }: { classroom: Classroom; onSubmitted: () => void; }) => {
    const { user } = useAuth();
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(false);

    const form = useForm<z.infer<typeof teacherApplicationSchema>>({
        resolver: zodResolver(teacherApplicationSchema),
        defaultValues: {
            fullName: user?.displayName || '',
            subject: '',
            mobile: '',
            qualification: '',
            experience: '',
            availability: '',
            message: '',
            resume: null,
        },
    });

    const onSubmit = async (data: z.infer<typeof teacherApplicationSchema>) => {
        if (!user) {
            toast({ variant: 'destructive', title: 'Not Authenticated' });
            return;
        }

        setIsLoading(true);

        try {
            let resumeURL: string | undefined = undefined;
            if (data.resume && data.resume.length > 0) {
                const resumeFile = data.resume[0];
                const resumeRef = storageRef(storage, `classrooms/${classroom.id}/teacher_applications/${user.uid}/${resumeFile.name}`);
                const snapshot = await uploadBytes(resumeRef, resumeFile);
                resumeURL = await getDownloadURL(snapshot.ref);
            }

            // Use the user's UID as the document ID for the join request
            const requestRef = doc(db, `classrooms/${classroom.id}/joinRequests`, user.uid);
            
            await setDoc(requestRef, {
                studentId: user.uid, // Crucial for security rules
                studentName: data.fullName,
                studentPhotoURL: user.photoURL || '',
                role: 'teacher',
                status: 'pending',
                applicationData: {
                    subject: data.subject,
                    mobile: data.mobile,
                    qualification: data.qualification,
                    experience: data.experience,
                    availability: data.availability,
                    message: data.message,
                },
                resumeURL: resumeURL,
                requestedAt: serverTimestamp()
            });

            toast({ title: 'Application Sent!', description: 'Your request to join as a teacher has been sent.' });
            onSubmitted();
        } catch (error) {
            console.error("Error sending teacher application:", error);
            toast({ variant: 'destructive', title: 'Application Failed', description: "Could not send your application. Check Firestore rules and console for details." });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <DialogContent className="sm:max-w-lg">
            <DialogHeader>
                <DialogTitle>Apply to Teach: {classroom.title}</DialogTitle>
                <DialogDescription>
                    Fill out the form below. The classroom owner will review your application.
                </DialogDescription>
            </DialogHeader>
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4 max-h-[70vh] overflow-y-auto px-1">
                    <FormField control={form.control} name="fullName" render={({ field }) => (
                        <FormItem>
                            <FormLabel>Full Name</FormLabel>
                            <FormControl><Input placeholder="Your full name" {...field} disabled={isLoading} /></FormControl>
                            <FormMessage />
                        </FormItem>
                    )} />
                     <FormField control={form.control} name="subject" render={({ field }) => (
                        <FormItem>
                            <FormLabel>Subject of Expertise</FormLabel>
                            <FormControl><Input placeholder="e.g., Mathematics, React Development" {...field} disabled={isLoading} /></FormControl>
                            <FormMessage />
                        </FormItem>
                    )} />
                     <FormField control={form.control} name="mobile" render={({ field }) => (
                        <FormItem>
                            <FormLabel>Mobile Number</FormLabel>
                            <FormControl><Input type="tel" placeholder="Your contact number" {...field} disabled={isLoading} /></FormControl>
                            <FormMessage />
                        </FormItem>
                    )} />
                    <FormField control={form.control} name="qualification" render={({ field }) => (
                        <FormItem>
                            <FormLabel>Highest Qualification</FormLabel>
                            <FormControl><Textarea placeholder="e.g., Ph.D. in Physics, B.S. in Computer Science" {...field} disabled={isLoading} /></FormControl>
                            <FormMessage />
                        </FormItem>
                    )} />
                    <FormField
                      control={form.control}
                      name="experience"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Teaching Experience</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value} disabled={isLoading}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select years of experience" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="Less than 1 year">Less than 1 year</SelectItem>
                              <SelectItem value="1 year">1 year</SelectItem>
                              <SelectItem value="2 years">2 years</SelectItem>
                              <SelectItem value="3 years">3 years</SelectItem>
                              <SelectItem value="4 years">4 years</SelectItem>
                              <SelectItem value="5+ years">5+ years</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                     <FormField control={form.control} name="availability" render={({ field }) => (
                        <FormItem>
                            <FormLabel>Time / Availability</FormLabel>
                            <FormControl><Textarea placeholder="e.g., Weekdays 5-8 PM, Weekends all day" {...field} disabled={isLoading} /></FormControl>
                            <FormMessage />
                        </FormItem>
                    )} />
                    <FormField control={form.control} name="message" render={({ field }) => (
                        <FormItem>
                            <FormLabel>Message to Owner (Optional)</FormLabel>
                            <FormControl><Textarea placeholder="Introduce yourself..." {...field} disabled={isLoading} /></FormControl>
                            <FormMessage />
                        </FormItem>
                    )} />
                     <FormField control={form.control} name="resume" render={({ field: { onChange, value, ...rest } }) => (
                        <FormItem>
                            <FormLabel>Resume/CV (Optional)</FormLabel>
                            <FormControl>
                                <Input 
                                    type="file"
                                    onChange={(e) => onChange(e.target.files)}
                                    {...rest}
                                    disabled={isLoading}
                                 />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )} />

                     <DialogFooter className="sticky bottom-0 bg-background pt-4">
                        <DialogClose asChild><Button variant="outline" disabled={isLoading}>Cancel</Button></DialogClose>
                        <Button type="submit" disabled={isLoading}>
                            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null}
                            Submit Application
                        </Button>
                    </DialogFooter>
                </form>
            </Form>
        </DialogContent>
    );
};


export default function ClassroomsPage() {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  
  const [myClasses, setMyClasses] = useState<Classroom[]>([]);
  const [enrolledClasses, setEnrolledClasses] = useState<EnrolledClassroomInfo[]>([]);
  const [discoverClasses, setDiscoverClasses] = useState<Classroom[]>([]);
  const [pendingRequestIds, setPendingRequestIds] = useState<Set<string>>(new Set());
  
  const [isLoadingMy, setIsLoadingMy] = useState(true);
  const [isLoadingEnrolled, setIsLoadingEnrolled] = useState(true);
  const [isLoadingDiscover, setIsLoadingDiscover] = useState(true);
  const [isLoadingRequests, setIsLoadingRequests] = useState(true);

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isTeacherAppDialogOpen, setIsTeacherAppDialogOpen] = useState(false);
  const [selectedClassroomForApp, setSelectedClassroomForApp] = useState<Classroom | null>(null);
  const [classroomToEdit, setClassroomToEdit] = useState<Classroom | null>(null);
  const [classroomToDelete, setClassroomToDelete] = useState<Classroom | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [requestingToJoin, setRequestingToJoin] = useState<string | null>(null);


  // Fetch My Classes
  useEffect(() => {
    if (!user) { setIsLoadingMy(false); setMyClasses([]); return; }
    setIsLoadingMy(true);
    const q = query(collection(db, 'classrooms'), where('teacherId', '==', user.uid));
    const unsub = onSnapshot(q, (snapshot) => {
        setMyClasses(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Classroom)));
        setIsLoadingMy(false);
    }, (error) => { console.error("My Classes fetch error:", error); setIsLoadingMy(false); });
    return () => unsub();
  }, [user]);

  // Fetch Enrolled Classes
  useEffect(() => {
    if (!user) { setIsLoadingEnrolled(false); setEnrolledClasses([]); return; }
    setIsLoadingEnrolled(true);
    const q = query(collection(db, 'users', user.uid, 'enrolled'));
    const unsub = onSnapshot(q, (snapshot) => {
        setEnrolledClasses(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as EnrolledClassroomInfo)));
        setIsLoadingEnrolled(false);
    }, (error) => { console.error("Enrolled Classes fetch error:", error); setIsLoadingEnrolled(false); });
    return () => unsub();
  }, [user]);

  // Fetch public classes for discovery
  useEffect(() => {
    setIsLoadingDiscover(true);
    const q = query(collection(db, 'classrooms'), where('isPublic', '==', true));
    const unsub = onSnapshot(q, (snapshot) => {
        setDiscoverClasses(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Classroom)));
        setIsLoadingDiscover(false);
    }, (error) => { 
        console.error('Discover fetch error:', error); 
        toast({ variant: 'destructive', title: 'Error', description: "Could not fetch public classes. Check Firestore rules."});
        setIsLoadingDiscover(false); 
    });
    return () => unsub();
  }, [toast]);
  
  // Fetch pending requests for the current user
  useEffect(() => {
    if (!user) {
      setPendingRequestIds(new Set());
      setIsLoadingRequests(false);
      return;
    }
    setIsLoadingRequests(true);
    // This query is simplified. A more robust solution might involve a separate top-level collection for requests
    // or querying all classrooms, which isn't scalable. This implementation is for demonstration.
    const q = query(collectionGroup(db, 'joinRequests'), where('studentId', '==', user.uid));

    const unsubscribe = onSnapshot(q, (snapshot) => {
        const newPendingIds = new Set<string>();
        snapshot.forEach((doc) => {
            // The classroom ID is the parent document's ID
            newPendingIds.add(doc.ref.parent.parent!.id);
        });
        setPendingRequestIds(newPendingIds);
        setIsLoadingRequests(false);
    }, (error) => {
        console.error("Error fetching pending requests:", error);
        toast({ variant: 'destructive', title: 'Fetch Error', description: 'Could not get your pending join requests.' });
        setIsLoadingRequests(false);
    });

    return () => unsubscribe();
  }, [user, toast]);


  const handleEdit = (classroom: Classroom) => {
    setClassroomToEdit(classroom);
    setIsCreateDialogOpen(true);
  };

  const handleCreateNew = () => {
    setClassroomToEdit(null);
    setIsCreateDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!classroomToDelete || !user) return;
    if (user.uid !== classroomToDelete.teacherId) {
        toast({ variant: 'destructive', title: 'Permission Denied', description: 'You can only delete your own classrooms.' });
        return;
    }
    try {
        const classroomRef = doc(db, 'classrooms', classroomToDelete.id);
        await deleteDoc(classroomRef);
        toast({ title: 'Success', description: `Classroom "${classroomToDelete.title}" deleted.` });
    } catch (error) {
      console.error('Error deleting classroom:', error);
      toast({ variant: 'destructive', title: 'Error', description: 'Could not delete the classroom. Check Firestore rules and permissions.' });
    } finally {
      setClassroomToDelete(null);
    }
  };
  
  const handleRequestToJoinStudent = useCallback(async (classroomId: string) => {
    if (!user) {
        toast({ variant: 'destructive', title: "Authentication required", description: "You must be signed in to join a class." });
        return;
    }
    setRequestingToJoin(classroomId);
    try {
        const requestRef = doc(db, `classrooms/${classroomId}/joinRequests`, user.uid);
        
        await setDoc(requestRef, {
            studentId: user.uid,
            studentName: user.displayName || 'Anonymous User',
            studentPhotoURL: user.photoURL || '',
            status: 'pending',
            role: 'student',
            requestedAt: serverTimestamp()
        });

        toast({ title: 'Request Sent!', description: `Your request to join as a student has been sent.` });
    } catch (error) {
        console.error("Error sending join request:", error);
        toast({ variant: 'destructive', title: 'Request Failed', description: 'Could not send join request. Check Firestore Rules for write permissions.' });
    } finally {
        setRequestingToJoin(null);
    }
  }, [user, toast]);
  
   const handleCancelRequest = useCallback(async (classroomId: string) => {
    if (!user) return;
    setRequestingToJoin(classroomId);
    try {
      const joinRequestRef = doc(db, `classrooms/${classroomId}/joinRequests`, user.uid);
      await deleteDoc(joinRequestRef);

      toast({ title: 'Request Canceled', description: 'Your join request has been withdrawn.' });
    } catch (error) {
        console.error("Error canceling join request:", error);
        toast({ variant: 'destructive', title: 'Cancel Failed', description: 'Could not cancel your join request.' });
    } finally {
        setRequestingToJoin(null);
    }
  }, [user, toast]);

  const handleOpenTeacherAppDialog = (classroom: Classroom) => {
    setSelectedClassroomForApp(classroom);
    setIsTeacherAppDialogOpen(true);
  };

  const copyClassId = (id: string) => {
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
    toast({ title: 'Class code copied!' });
  };

  const renderMyClassroomCard = useCallback((classroom: Classroom) => (
    <Card key={classroom.id}>
        <CardHeader>
            <CardTitle>{classroom.title}</CardTitle>
            <CardDescription>{classroom.description || "No description."}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
            <p className="text-sm text-muted-foreground">Visibility: {classroom.isPublic ? 'Public' : 'Private'}</p>
            <div className="flex items-center gap-2">
                <Input value={classroom.id} readOnly className="text-xs font-mono"/>
                <Button size="icon" variant="ghost" onClick={() => copyClassId(classroom.id)}>
                    {copiedId === classroom.id ? <ClipboardCheck className="h-4 w-4 text-green-500" /> : <Clipboard className="h-4 w-4" />}
                </Button>
            </div>
        </CardContent>
        <CardFooter className="flex justify-between items-center">
            <Button asChild><Link href={`/dashboard/classrooms/${classroom.id}`}>Enter Class <ArrowRight className="ml-2 h-4 w-4" /></Link></Button>
            <div className="flex items-center">
                <Button variant="ghost" size="icon" onClick={() => handleEdit(classroom)}><Edit className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" onClick={() => setClassroomToDelete(classroom)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
            </div>
        </CardFooter>
    </Card>
  ), [copiedId]);
  
  const renderEnrolledClassroomCard = useCallback((classroomInfo: EnrolledClassroomInfo) => (
    <Card key={classroomInfo.id}>
      <CardHeader>
        <CardTitle>{classroomInfo.title}</CardTitle>
        <CardDescription>{classroomInfo.description || "No description."}</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">Taught by: {classroomInfo.teacherName}</p>
      </CardContent>
      <CardFooter>
        <Button asChild className="w-full"><Link href={`/dashboard/classrooms/${classroomInfo.classroomId}`}>Enter Class <ArrowRight className="ml-2 h-4 w-4" /></Link></Button>
      </CardFooter>
    </Card>
  ), []);

  const renderDiscoverClassroomCard = useCallback((classroom: Classroom) => {
    const isRequesting = requestingToJoin === classroom.id;
    const isMyClass = user?.uid === classroom.teacherId;
    const hasPendingRequest = pendingRequestIds.has(classroom.id);

    return (
      <Card key={classroom.id} className="flex flex-col">
          <CardHeader>
              <CardTitle>{classroom.title}</CardTitle>
              <CardDescription>{classroom.description || "No description."}</CardDescription>
          </CardHeader>
          <CardContent className="flex-grow">
              <p className="text-sm text-muted-foreground">Taught by: {classroom.teacherName}</p>
          </CardContent>
          <CardFooter className="flex-col items-stretch gap-2 pt-4">
            {isMyClass ? (
              <Button asChild className="w-full"><Link href={`/dashboard/classrooms/${classroom.id}`}>Enter Class <ArrowRight className="ml-2 h-4 w-4" /></Link></Button>
            ) : user ? (
                 isRequesting ? (
                    <Button className="w-full" disabled>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin"/>Working...
                    </Button>
                ) : hasPendingRequest ? (
                    <Button variant="destructive" className="w-full" onClick={() => handleCancelRequest(classroom.id)}>
                        <XCircle className="mr-2 h-4 w-4"/>
                        Cancel Request
                    </Button>
                ) : (
                    <div className="grid grid-cols-2 gap-2">
                        <Button variant="outline" onClick={() => handleRequestToJoinStudent(classroom.id)}>
                            <GraduationCap className="mr-2 h-4 w-4"/>
                            Join as Student
                        </Button>
                        <Button variant="outline" onClick={() => handleOpenTeacherAppDialog(classroom)}>
                            <Briefcase className="mr-2 h-4 w-4"/>
                             Join as Teacher
                        </Button>
                    </div>
                )
            ) : (
                 <Button asChild className="w-full"><Link href="/auth/signin">Sign In to Join</Link></Button>
            )}
          </CardFooter>
    </Card>
    );
  }, [user, requestingToJoin, handleRequestToJoinStudent, handleCancelRequest, pendingRequestIds]);

  const renderSkeleton = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {[...Array(3)].map((_, i) => (
        <Card key={i}><CardHeader><Skeleton className="h-6 w-3/4" /><Skeleton className="h-4 w-full mt-2" /></CardHeader><CardContent><Skeleton className="h-4 w-1/2" /></CardContent><CardFooter><Skeleton className="h-10 w-24" /></CardFooter></Card>
      ))}
    </div>
  );

  const MyClassesTab = () => {
    if (isLoadingMy || authLoading) return renderSkeleton();
    if (!user) return <p className="text-muted-foreground text-center py-10">Please sign in to see your classes.</p>;
    if (myClasses.length === 0) return <p className="text-muted-foreground text-center py-10">You haven't created any classrooms yet.</p>;
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {myClasses.map(renderMyClassroomCard)}
      </div>
    );
  };
  
  const EnrolledClassesTab = () => {
    if (isLoadingEnrolled || authLoading) return renderSkeleton();
    if (!user) return <p className="text-muted-foreground text-center py-10">Please sign in to see your enrolled classes.</p>;
    if (enrolledClasses.length === 0) {
       return (
        <div className="text-center py-10">
          <p className="text-muted-foreground">You are not enrolled in any classrooms.</p>
          <p className="text-muted-foreground mt-2">Find one in the "Discover" tab or join one with a code!</p>
        </div>
      );
    }
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {enrolledClasses.map(renderEnrolledClassroomCard)}
      </div>
    );
  };

  const DiscoverClassesTab = () => {
    if (isLoadingDiscover || isLoadingRequests) return renderSkeleton();

    // Filter out classes the user is already enrolled in
    const discoverableClasses = discoverClasses.filter(publicClass => {
      if (!user) return true; // Show all public classes if not logged in
      
      const isEnrolled = enrolledClasses.some(enrolled => enrolled.classroomId === publicClass.id);
      
      return !isEnrolled;
    });

    if (discoverableClasses.length === 0) {
        return <p className="text-muted-foreground text-center py-10">No new public classrooms to discover right now.</p>;
    }

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {discoverableClasses.map(renderDiscoverClassroomCard)}
      </div>
    );
  };

  return (
    <div className="container mx-auto p-4 md:p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Classrooms</h1>
        { user && (
            <div>
                <Button asChild variant="outline" className="mr-2">
                    <Link href="/dashboard/classrooms/join">Join a Class</Link>
                </Button>
                <Dialog open={isCreateDialogOpen} onOpenChange={(isOpen) => { if (!isOpen) setClassroomToEdit(null); setIsCreateDialogOpen(isOpen); }}>
                  <DialogTrigger asChild><Button onClick={handleCreateNew}><PlusCircle className="mr-2 h-4 w-4" /> Create New</Button></DialogTrigger>
                  <DialogContent><CreateClassroomDialogContent onSuccess={() => setIsCreateDialogOpen(false)} classroomToEdit={classroomToEdit} /></DialogContent>
                </Dialog>
            </div>
        )}
      </div>

      <Dialog open={isTeacherAppDialogOpen} onOpenChange={setIsTeacherAppDialogOpen}>
        {selectedClassroomForApp && (
            <TeacherApplicationDialog 
                classroom={selectedClassroomForApp} 
                onSubmitted={() => {
                    setIsTeacherAppDialogOpen(false);
                    // The onSnapshot listener will handle updating the UI, no need to manually set pending IDs here.
                }} 
            />
        )}
      </Dialog>

      <AlertDialog open={!!classroomToDelete} onOpenChange={(isOpen) => !isOpen && setClassroomToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle><AlertDialogDescription>This will permanently delete the classroom &quot;{classroomToDelete?.title}&quot;. This action cannot be undone.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Tabs defaultValue="discover" className="w-full">
        <TabsList><TabsTrigger value="discover"><Eye className="mr-2 h-4 w-4" /> Discover</TabsTrigger><TabsTrigger value="my-classes"><School className="mr-2 h-4 w-4" /> My Classes</TabsTrigger><TabsTrigger value="enrolled"><BookOpen className="mr-2 h-4 w-4" /> Enrolled</TabsTrigger></TabsList>
        <TabsContent value="discover" className="mt-4"><DiscoverClassesTab /></TabsContent>
        <TabsContent value="my-classes" className="mt-4"><MyClassesTab /></TabsContent>
        <TabsContent value="enrolled" className="mt-4"><EnrolledClassesTab /></TabsContent>
      </Tabs>
    </div>
  );
}
