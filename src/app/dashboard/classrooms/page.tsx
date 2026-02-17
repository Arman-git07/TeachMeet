'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  CardContent,
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { db, storage } from '@/lib/firebase';
import {
  collection,
  serverTimestamp,
  doc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  writeBatch,
  getDocs,
  limit,
} from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import {
  PlusCircle,
  Edit,
  Trash2,
  Loader2,
  BookOpen,
  School,
  PanelLeftOpen,
  Search,
  Globe,
  Briefcase,
  User,
  Phone,
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import Link from 'next/link';
import { Textarea } from '@/components/ui/textarea';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { ScrollArea } from '@/components/ui/scroll-area';

export interface Classroom {
  id: string;
  title: string;
  description: string;
  teacherId: string;
  creatorId: string;
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

type TeacherApplicationValues = z.infer<typeof teacherApplicationSchema>;

function CreateClassroomForm({ onSuccess, classroomToEdit }: { onSuccess: () => void; classroomToEdit?: Classroom | null; }) {
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
    if (!user) return;
    if (!title.trim()) {
      toast({ variant: 'destructive', title: 'Title is required' });
      return;
    }
    setIsLoading(true);

    try {
      if (classroomToEdit) {
        const classroomRef = doc(db, 'classrooms', classroomToEdit.id);
        await updateDoc(classroomRef, { title, description, isPublic });
        toast({ title: 'Classroom Updated' });
      } else {
        const batch = writeBatch(db);
        const classroomRef = doc(collection(db, 'classrooms'));
        
        const classroomData = {
          title: title.trim(),
          description: description.trim(),
          teacherId: user.uid,
          creatorId: user.uid,
          teacherName: user.displayName || 'Anonymous Teacher',
          isPublic,
          students: [], 
          teachers: [{ uid: user.uid, name: user.displayName || 'Creator' }],
          createdAt: serverTimestamp(),
        };
        
        batch.set(classroomRef, classroomData);

        batch.set(doc(db, 'classrooms', classroomRef.id, 'participants', user.uid), {
            uid: user.uid,
            name: user.displayName || 'Creator',
            photoURL: user.photoURL || '',
            role: 'creator',
            joinedAt: serverTimestamp(),
        });

        batch.set(doc(db, 'classrooms', classroomRef.id, 'teachers', user.uid), {
            uid: user.uid,
            name: user.displayName || 'Creator',
            subject: 'Class Owner',
            availability: 'Always',
            addedAt: serverTimestamp(),
        });

        await batch.commit();
        toast({ title: 'Classroom Created' });
      }
      onSuccess();
    } catch (error) {
      console.error('Error saving classroom:', error);
      toast({ variant: 'destructive', title: 'Save Failed' });
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
          <Label htmlFor="title" className="text-right font-bold text-xs uppercase tracking-widest text-muted-foreground">Title</Label>
          <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} className="col-span-3 rounded-xl" placeholder="e.g., Introduction to React" disabled={isLoading}/>
        </div>
        <div className="grid grid-cols-4 items-center gap-4">
          <Label htmlFor="description" className="text-right font-bold text-xs uppercase tracking-widest text-muted-foreground">Description</Label>
          <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} className="col-span-3 rounded-xl resize-none h-24" placeholder="A brief summary" disabled={isLoading}/>
        </div>
        <div className="flex items-center space-x-3 justify-end pt-2">
          <Label htmlFor="is-public" className="font-bold text-xs uppercase tracking-widest text-muted-foreground">
            {isPublic ? 'Public' : 'Private'}
          </Label>
          <Switch id="is-public" checked={isPublic} onCheckedChange={setIsPublic} disabled={isLoading}/>
        </div>
      </div>
      <DialogFooter>
        <DialogClose asChild><Button type="button" variant="secondary" className="rounded-xl" disabled={isLoading}>Cancel</Button></DialogClose>
        <Button onClick={handleSubmit} disabled={isLoading} className="btn-gel rounded-xl">
          {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          {classroomToEdit ? 'Save Changes' : 'Create Classroom'}
        </Button>
      </DialogFooter>
    </>
  );
}

function TeacherApplicationDialog({ classroom, onSubmitted }: { classroom: Classroom; onSubmitted: () => void; }) {
    const { user } = useAuth();
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(false);

    const form = useForm<TeacherApplicationValues>({
        resolver: zodResolver(teacherApplicationSchema),
        defaultValues: {
            fullName: user?.displayName || '',
            subject: '',
            mobile: '',
            qualification: '',
            experience: 'Less than 1 year',
            availability: '',
            message: '',
            resume: null,
        },
    });

    const onSubmit = async (data: TeacherApplicationValues) => {
        if (!user) return;
        setIsLoading(true);
        try {
            let resumeURL: string | undefined = undefined;
            if (data.resume && data.resume.length > 0) {
                const resumeFile = data.resume[0];
                const resumeRef = storageRef(storage, `classrooms/${classroom.id}/teacher_applications/${user.uid}/${resumeFile.name}`);
                const snapshot = await uploadBytes(resumeRef, resumeFile);
                resumeURL = await getDownloadURL(snapshot.ref);
            }

            const batch = writeBatch(db);
            const classroomJoinReqRef = doc(db, "classrooms", classroom.id, "joinRequests", user.uid);

            batch.set(classroomJoinReqRef, {
                requesterId: user.uid,
                studentName: data.fullName,
                studentPhotoURL: user.photoURL || "",
                role: "teacher",
                status: "pending",
                requestedAt: serverTimestamp(),
                resumeURL: resumeURL || "",
                applicationData: {
                    subject: data.subject,
                    qualification: data.qualification,
                    experience: data.experience,
                    availability: data.availability,
                    mobile: data.mobile,
                    message: data.message || ""
                }
            }, { merge: true });

            const userPendingRequestRef = doc(db, `users/${user.uid}/pendingJoinRequests`, classroom.id);
            batch.set(userPendingRequestRef, { 
                classroomId: classroom.id, 
                requestedAt: serverTimestamp(),
                role: 'teacher'
            });

            await batch.commit();
            
            window.dispatchEvent(new CustomEvent('teachmeet_activity_updated'));
            
            toast({ title: 'Application Sent!', description: 'Your request to join as a teacher has been sent.' });
            onSubmitted();
        } catch (error) {
            console.error("Teacher application failed:", error);
            toast({ variant: 'destructive', title: 'Application Failed', description: "Could not send your application." });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <DialogContent className="sm:max-w-lg rounded-2xl">
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
                            <FormControl><Input placeholder="Your full name" {...field} className="rounded-xl" disabled={isLoading} /></FormControl>
                            <FormMessage />
                        </FormItem>
                    )} />
                     <FormField control={form.control} name="subject" render={({ field }) => (
                        <FormItem>
                            <FormLabel>Subject of Expertise</FormLabel>
                            <FormControl><Input placeholder="e.g., Mathematics" {...field} className="rounded-xl" disabled={isLoading} /></FormControl>
                            <FormMessage />
                        </FormItem>
                    )} />
                     <FormField control={form.control} name="mobile" render={({ field }) => (
                        <FormItem>
                            <FormLabel>Mobile Number (WhatsApp)</FormLabel>
                            <FormControl><div className="relative"><Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input type="tel" placeholder="Your contact number" {...field} className="pl-10 rounded-xl" disabled={isLoading} /></div></FormControl>
                            <FormMessage />
                        </FormItem>
                    )} />
                    <FormField control={form.control} name="qualification" render={({ field }) => (
                        <FormItem>
                            <FormLabel>Highest Qualification</FormLabel>
                            <FormControl><Textarea placeholder="e.g., B.S. in Computer Science" {...field} className="rounded-xl resize-none" disabled={isLoading} /></FormControl>
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
                            <FormControl><SelectTrigger className="rounded-xl"><SelectValue placeholder="Select years" /></SelectTrigger></FormControl>
                            <SelectContent className="rounded-xl">
                              <SelectItem value="Less than 1 year">Less than 1 year</SelectItem>
                              <SelectItem value="1-3 years">1-3 years</SelectItem>
                              <SelectItem value="3-5 years">3-5 years</SelectItem>
                              <SelectItem value="5+ years">5+ years</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                     <FormField control={form.control} name="availability" render={({ field }) => (
                        <FormItem>
                            <FormLabel>Availability</FormLabel>
                            <FormControl><Textarea placeholder="e.g., Weekdays 5-8 PM" {...field} className="rounded-xl resize-none" disabled={isLoading} /></FormControl>
                            <FormMessage />
                        </FormItem>
                    )} />
                    <FormField control={form.control} name="message" render={({ field }) => (
                        <FormItem>
                            <FormLabel>Message (Optional)</FormLabel>
                            <FormControl><Textarea placeholder="Introduce yourself..." {...field} className="rounded-xl resize-none" disabled={isLoading} /></FormControl>
                            <FormMessage />
                        </FormItem>
                    )} />
                     <FormField control={form.control} name="resume" render={({ field: { onChange, value, ...rest } }) => (
                        <FormItem>
                            <FormLabel>Resume/CV (Optional)</FormLabel>
                            <FormControl><Input type="file" onChange={(e) => onChange(e.target.files)} {...rest} className="rounded-xl" disabled={isLoading} /></FormControl>
                            <FormMessage />
                        </FormItem>
                    )} />
                     <DialogFooter className="sticky bottom-0 bg-background pt-4 border-t">
                        <DialogClose asChild><Button variant="outline" type="button" className="rounded-xl" disabled={isLoading}>Cancel</Button></DialogClose>
                        <Button type="submit" disabled={isLoading} className="btn-gel rounded-xl">
                            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null}
                            Submit Application
                        </Button>
                    </DialogFooter>
                </form>
            </Form>
        </DialogContent>
    );
}

export default function ClassroomsPage() {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  
  const [myClasses, setMyClasses] = useState<Classroom[]>([]);
  const [enrolledClasses, setEnrolledClasses] = useState<EnrolledClassroomInfo[]>([]);
  const [discoverClasses, setDiscoverClasses] = useState<Classroom[]>([]);
  const [pendingRequestIds, setPendingRequestIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isTeacherAppDialogOpen, setIsTeacherAppDialogOpen] = useState(false);
  const [selectedClassroomForApp, setSelectedClassroomForApp] = useState<Classroom | null>(null);
  const [classroomToEdit, setClassroomToEdit] = useState<Classroom | null>(null);
  const [classroomToDelete, setClassroomToDelete] = useState<Classroom | null>(null);

  useEffect(() => {
    if (!user) { setMyClasses([]); return; }
    return onSnapshot(query(collection(db, 'classrooms'), where('teacherId', '==', user.uid)), (snapshot) => {
        setMyClasses(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Classroom)));
    });
  }, [user]);

  useEffect(() => {
    if (!user) { setEnrolledClasses([]); return; }
    return onSnapshot(query(collection(db, 'users', user.uid, 'enrolled')), (snapshot) => {
        setEnrolledClasses(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as EnrolledClassroomInfo)));
    });
  }, [user]);

  useEffect(() => {
    return onSnapshot(query(collection(db, 'classrooms'), where('isPublic', '==', true), limit(50)), (snapshot) => {
        setDiscoverClasses(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Classroom)));
    });
  }, []);
  
  useEffect(() => {
    if (!user) { setPendingRequestIds(new Set()); return; }
    return onSnapshot(query(collection(db, `users/${user.uid}/pendingJoinRequests`)), (snapshot) => {
        const newPendingIds = new Set<string>();
        snapshot.forEach((doc) => newPendingIds.add(doc.id));
        setPendingRequestIds(newPendingIds);
    });
  }, [user]);

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
    try {
        const classroomRef = doc(db, 'classrooms', classroomToDelete.id);
        const subs = ['announcements', 'assignments', 'exams', 'materials', 'participants', 'joinRequests', 'teachers'];
        for (const sub of subs) {
            const snap = await getDocs(collection(db, classroomRef.path, sub));
            const batch = writeBatch(db);
            snap.docs.forEach(d => batch.delete(d.ref));
            await batch.commit();
        }
        await deleteDoc(classroomRef);
        toast({ title: 'Classroom Deleted' });
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'Could not delete.' });
    } finally {
      setClassroomToDelete(null);
    }
  };
  
  const handleRequestToJoinStudent = useCallback(async (classroomId: string) => {
    if (!user) return;
    try {
        const batch = writeBatch(db);
        batch.set(doc(db, `classrooms/${classroomId}/joinRequests`, user.uid), {
            requesterId: user.uid,
            studentName: user.displayName || 'Guest',
            studentPhotoURL: user.photoURL || '',
            status: 'pending',
            role: 'student',
            requestedAt: serverTimestamp()
        });
        batch.set(doc(db, `users/${user.uid}/pendingJoinRequests`, classroomId), { 
            classroomId, 
            requestedAt: serverTimestamp(),
            role: 'student'
        });
        await batch.commit();
        window.dispatchEvent(new CustomEvent('teachmeet_activity_updated'));
        toast({ title: 'Request Sent!' });
    } catch (error) {
        toast({ variant: 'destructive', title: 'Failed' });
    }
  }, [user, toast]);
  
  const handleCancelRequest = useCallback(async (classroomId: string) => {
    if (!user) return;
    try {
        const batch = writeBatch(db);
        batch.delete(doc(db, `classrooms/${classroomId}/joinRequests/${user.uid}`));
        batch.delete(doc(db, `users/${user.uid}/pendingJoinRequests/${classroomId}`));
        await batch.commit();
        window.dispatchEvent(new CustomEvent('teachmeet_activity_updated'));
        toast({ title: "Request Canceled" });
    } catch (error) {
        toast({ variant: 'destructive', title: 'Failed' });
    }
  }, [user, toast]);

  const handleOpenTeacherAppDialog = (classroom: Classroom) => {
    setSelectedClassroomForApp(classroom);
    setIsTeacherAppDialogOpen(true);
  };

  const filteredDiscover = useMemo(() => {
    const filtered = discoverClasses.filter(c => c.title.toLowerCase().includes(searchQuery.toLowerCase()));
    
    return [...filtered].sort((a, b) => {
      const aIsOwned = a.teacherId === user?.uid;
      const bIsOwned = b.teacherId === user?.uid;
      if (aIsOwned && !bIsOwned) return -1;
      if (!aIsOwned && bIsOwned) return 1;

      const aIsEnrolled = enrolledClasses.some(e => e.classroomId === a.id);
      const bIsEnrolled = enrolledClasses.some(e => e.classroomId === b.id);
      if (aIsEnrolled && !bIsEnrolled) return -1;
      if (!aIsEnrolled && bIsEnrolled) return 1;

      return 0;
    });
  }, [discoverClasses, searchQuery, user, enrolledClasses]);

  const filteredMyClasses = useMemo(() => myClasses.filter(c => c.title.toLowerCase().includes(searchQuery.toLowerCase())), [myClasses, searchQuery]);
  const filteredEnrolled = useMemo(() => enrolledClasses.filter(c => c.title.toLowerCase().includes(searchQuery.toLowerCase())), [enrolledClasses, searchQuery]);

  return (
    <div className="container mx-auto p-4 md:p-8 flex flex-col h-full bg-background/50">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-2 flex-shrink-0">
        <div className="flex items-center gap-4">
          <SidebarTrigger className="md:hidden"><PanelLeftOpen className="h-6 w-6" /></SidebarTrigger>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
                <School className="h-8 w-8 text-primary" />
                Classrooms
            </h1>
            <p className="text-sm text-muted-foreground mt-1">Discover, manage, and join learning spaces.</p>
          </div>
        </div>
        { user && (
            <div className="flex flex-shrink-0 gap-3 w-full sm:w-auto">
                <Button asChild variant="outline" className="flex-1 sm:flex-initial rounded-xl h-11"><Link href="/dashboard/classrooms/join">Join a Class</Link></Button>
                <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                  <DialogTrigger asChild><Button onClick={handleCreateNew} className="flex-1 sm:flex-initial btn-gel rounded-xl h-11"><PlusCircle className="mr-2 h-4 w-4" /> Create New</Button></DialogTrigger>
                  <DialogContent className="rounded-2xl"><CreateClassroomForm onSuccess={() => setIsCreateDialogOpen(false)} classroomToEdit={classroomToEdit} /></DialogContent>
                </Dialog>
            </div>
        )}
      </div>

      <Dialog open={isTeacherAppDialogOpen} onOpenChange={setIsTeacherAppDialogOpen}>
        {selectedClassroomForApp && <TeacherApplicationDialog classroom={selectedClassroomForApp} onSubmitted={() => setIsTeacherAppDialogOpen(false)} />}
      </Dialog>

      <AlertDialog open={!!classroomToDelete} onOpenChange={(isOpen) => !isOpen && setClassroomToDelete(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle><AlertDialogDescription>This will permanently delete "{classroomToDelete?.title}".</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel><AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90 rounded-xl">Delete</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Tabs defaultValue="discover" className="w-full flex-1 flex flex-col overflow-hidden">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-0 flex-shrink-0">
          <TabsList className="bg-muted/50 p-1 rounded-xl">
            <TabsTrigger value="discover" className="rounded-lg px-6">Discover</TabsTrigger>
            <TabsTrigger value="my-classes" className="rounded-lg px-6">My Classes</TabsTrigger>
            <TabsTrigger value="enrolled" className="rounded-lg px-6">Enrolled</TabsTrigger>
          </TabsList>
          
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input 
              placeholder="Search classrooms..." 
              className="pl-10 h-11 rounded-xl bg-background border-border shadow-sm focus:ring-primary transition-all"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <ScrollArea className="flex-1 pr-1">
          <TabsContent value="discover" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-0 pt-0 pb-12">
            {filteredDiscover.map(c => (
                <Card key={c.id} className="flex flex-col shadow-lg border-border/50 hover:border-primary/30 transition-all rounded-2xl overflow-hidden group">
                    <div className="h-2 bg-primary/10 group-hover:bg-primary/30 transition-colors" />
                    <CardHeader className="pb-4">
                        <CardTitle className="text-xl group-hover:text-primary transition-colors truncate">{c.title}</CardTitle>
                        <CardDescription className="flex items-center gap-1.5 font-medium">
                            <User className="h-3.5 w-3.5" /> {c.teacherName}
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="flex-grow">
                        <p className="text-sm text-muted-foreground line-clamp-3 leading-relaxed">{c.description || "No description provided."}</p>
                    </CardContent>
                    <CardFooter className="mt-auto pt-4 border-t bg-muted/5">
                        {pendingRequestIds.has(c.id) ? (
                            <Button variant="destructive" className="w-full rounded-xl h-10 font-bold" onClick={() => handleCancelRequest(c.id)}>Cancel Request</Button>
                        ) : enrolledClasses.some(e => e.classroomId === c.id) || myClasses.some(m => m.id === c.id) ? (
                            <Button asChild className="w-full btn-gel rounded-xl h-10 font-bold"><Link href={`/dashboard/classrooms/${c.id}`}>Enter Classroom</Link></Button>
                        ) : (
                            <div className="flex gap-2 w-full">
                                <Button variant="outline" className="flex-1 rounded-xl h-10 font-semibold" onClick={() => handleRequestToJoinStudent(c.id)}>Join Student</Button>
                                <Button variant="secondary" className="flex-1 rounded-xl h-10 font-semibold" onClick={() => handleOpenTeacherAppDialog(c)}>Join Teacher</Button>
                            </div>
                        )}
                    </CardFooter>
                </Card>
            ))}
            {filteredDiscover.length === 0 && (
              <div className="col-span-full py-20 text-center flex flex-col items-center justify-center">
                <Globe className="h-12 w-12 text-muted-foreground opacity-20 mb-4" />
                <p className="text-lg font-medium text-muted-foreground">No classrooms found matching "{searchQuery}"</p>
              </div>
            )}
          </TabsContent>
          <TabsContent value="my-classes" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-0 pt-0 pb-12">
            {filteredMyClasses.map(c => (
                <Card key={c.id} className="shadow-lg border-border/50 rounded-2xl overflow-hidden">
                    <div className="h-2 bg-accent/20" />
                    <CardHeader>
                        <CardTitle className="truncate">{c.title}</CardTitle>
                        <CardDescription className="font-mono text-[10px] uppercase tracking-tighter opacity-50">ID: {c.id}</CardDescription>
                    </CardHeader>
                    <CardFooter className="flex justify-between gap-2 border-t pt-4 bg-muted/5">
                        <Button asChild className="flex-1 btn-gel rounded-xl"><Link href={`/dashboard/classrooms/${c.id}`}>Enter</Link></Button>
                        <Button variant="ghost" size="icon" className="rounded-xl h-10 w-10 hover:bg-primary/10 hover:text-primary" onClick={() => handleEdit(c)}><Edit className="h-4 w-4"/></Button>
                        <Button variant="ghost" size="icon" className="rounded-xl h-10 w-10 hover:bg-destructive/10 hover:text-destructive" onClick={() => setClassroomToDelete(c)}><Trash2 className="h-4 w-4"/></Button>
                    </CardFooter>
                </Card>
            ))}
            {filteredMyClasses.length === 0 && (
              <div className="col-span-full py-20 text-center flex flex-col items-center justify-center">
                <Briefcase className="h-12 w-12 text-muted-foreground opacity-20 mb-4" />
                <p className="text-lg font-medium text-muted-foreground">You haven't created any classrooms yet.</p>
                <Button className="mt-4 rounded-xl btn-gel" onClick={handleCreateNew}>Start a Classroom</Button>
              </div>
            )}
          </TabsContent>
          <TabsContent value="enrolled" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-0 pt-0 pb-12">
            {filteredEnrolled.map(c => (
                <Card key={c.id} className="shadow-lg border-border/50 rounded-2xl overflow-hidden group">
                    <div className="h-2 bg-secondary/20 group-hover:bg-secondary/40 transition-colors" />
                    <CardHeader>
                        <CardTitle className="truncate">{c.title}</CardTitle>
                        <CardDescription className="font-medium text-primary">By {c.teacherName}</CardDescription>
                    </CardHeader>
                    <CardFooter className="border-t pt-4 bg-muted/5">
                        <Button asChild className="w-full btn-gel rounded-xl h-10 font-bold"><Link href={`/dashboard/classrooms/${c.classroomId}`}>Enter Classroom</Link></Button>
                    </CardFooter>
                </Card>
            ))}
            {filteredEnrolled.length === 0 && (
              <div className="col-span-full py-20 text-center flex flex-col items-center justify-center">
                <BookOpen className="h-12 w-12 text-muted-foreground opacity-20 mb-4" />
                <p className="text-lg font-medium text-muted-foreground">You aren't enrolled in any classrooms.</p>
                <Button variant="outline" className="mt-4 rounded-xl" onClick={() => (document.querySelector('[value="discover"]') as HTMLElement)?.click()}>Discover Classes</Button>
              </div>
            )}
          </TabsContent>
        </ScrollArea>
      </Tabs>
    </div>
  );
}
