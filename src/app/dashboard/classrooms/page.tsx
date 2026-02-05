'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
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
  getDocs,
} from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import {
  PlusCircle,
  Edit,
  Trash2,
  Loader2,
  BookOpen,
  Eye,
  School,
  PanelLeftOpen,
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
        await addDoc(collection(db, 'classrooms'), classroomData);
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
          <Label htmlFor="title" className="text-right">Title</Label>
          <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} className="col-span-3" placeholder="e.g., Introduction to React" disabled={isLoading}/>
        </div>
        <div className="grid grid-cols-4 items-center gap-4">
          <Label htmlFor="description" className="text-right">Description</Label>
          <Input id="description" value={description} onChange={(e) => setDescription(e.target.value)} className="col-span-3" placeholder="A brief summary" disabled={isLoading}/>
        </div>
        <div className="flex items-center space-x-2 justify-end">
          <Label htmlFor="is-public">{isPublic ? 'Make Private' : 'Make Public'}</Label>
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
            
            // Broadcast event for activity feed
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
                            <FormControl><Input placeholder="e.g., Mathematics" {...field} disabled={isLoading} /></FormControl>
                            <FormMessage />
                        </FormItem>
                    )} />
                     <FormField control={form.control} name="mobile" render={({ field }) => (
                        <FormItem>
                            <FormLabel>Mobile Number (WhatsApp)</FormLabel>
                            <FormControl><Input type="tel" placeholder="Your contact number" {...field} disabled={isLoading} /></FormControl>
                            <FormMessage />
                        </FormItem>
                    )} />
                    <FormField control={form.control} name="qualification" render={({ field }) => (
                        <FormItem>
                            <FormLabel>Highest Qualification</FormLabel>
                            <FormControl><Textarea placeholder="e.g., B.S. in Computer Science" {...field} disabled={isLoading} /></FormControl>
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
                            <FormControl><SelectTrigger><SelectValue placeholder="Select years" /></SelectTrigger></FormControl>
                            <SelectContent>
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
                            <FormControl><Textarea placeholder="e.g., Weekdays 5-8 PM" {...field} disabled={isLoading} /></FormControl>
                            <FormMessage />
                        </FormItem>
                    )} />
                    <FormField control={form.control} name="message" render={({ field }) => (
                        <FormItem>
                            <FormLabel>Message (Optional)</FormLabel>
                            <FormControl><Textarea placeholder="Introduce yourself..." {...field} disabled={isLoading} /></FormControl>
                            <FormMessage />
                        </FormItem>
                    )} />
                     <FormField control={form.control} name="resume" render={({ field: { onChange, value, ...rest } }) => (
                        <FormItem>
                            <FormLabel>Resume/CV (Optional)</FormLabel>
                            <FormControl><Input type="file" onChange={(e) => onChange(e.target.files)} {...rest} disabled={isLoading} /></FormControl>
                            <FormMessage />
                        </FormItem>
                    )} />
                     <DialogFooter className="sticky bottom-0 bg-background pt-4">
                        <DialogClose asChild><Button variant="outline" type="button" disabled={isLoading}>Cancel</Button></DialogClose>
                        <Button type="submit" disabled={isLoading}>
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
    return onSnapshot(query(collection(db, 'classrooms'), where('isPublic', '==', true)), (snapshot) => {
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

  return (
    <div className="container mx-auto p-4 md:p-8 flex flex-col h-full">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 flex-shrink-0">
        <div className="flex items-center gap-4">
          <SidebarTrigger className="md:hidden"><PanelLeftOpen className="h-6 w-6" /></SidebarTrigger>
          <h1 className="text-3xl font-bold text-foreground">Classrooms</h1>
        </div>
        { user && (
            <div className="flex flex-shrink-0 gap-2 w-full sm:w-auto">
                <Button asChild variant="outline" className="flex-1 sm:flex-initial"><Link href="/dashboard/classrooms/join">Join a Class</Link></Button>
                <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                  <DialogTrigger asChild><Button onClick={handleCreateNew} className="flex-1 sm:flex-initial"><PlusCircle className="mr-2 h-4 w-4" /> Create New</Button></DialogTrigger>
                  <DialogContent><CreateClassroomForm onSuccess={() => setIsCreateDialogOpen(false)} classroomToEdit={classroomToEdit} /></DialogContent>
                </Dialog>
            </div>
        )}
      </div>

      <Dialog open={isTeacherAppDialogOpen} onOpenChange={setIsTeacherAppDialogOpen}>
        {selectedClassroomForApp && <TeacherApplicationDialog classroom={selectedClassroomForApp} onSubmitted={() => setIsTeacherAppDialogOpen(false)} />}
      </Dialog>

      <AlertDialog open={!!classroomToDelete} onOpenChange={(isOpen) => !isOpen && setClassroomToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle><AlertDialogDescription>This will permanently delete "{classroomToDelete?.title}".</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Tabs defaultValue="discover" className="w-full flex-1 flex flex-col overflow-hidden">
        <TabsList className="flex-shrink-0">
          <TabsTrigger value="discover"><Eye className="mr-2 h-4 w-4" /> Discover</TabsTrigger>
          <TabsTrigger value="my-classes"><School className="mr-2 h-4 w-4" /> My Classes</TabsTrigger>
          <TabsTrigger value="enrolled"><BookOpen className="mr-2 h-4 w-4" /> Enrolled</TabsTrigger>
        </TabsList>
        <div className="flex-1 overflow-y-auto mt-4">
          <TabsContent value="discover" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {discoverClasses.map(c => (
                <Card key={c.id} className="flex flex-col">
                    <CardHeader><CardTitle>{c.title}</CardTitle><CardDescription>By {c.teacherName}</CardDescription></CardHeader>
                    <CardFooter className="mt-auto">
                        {pendingRequestIds.has(c.id) ? (
                            <Button variant="destructive" className="w-full" onClick={() => handleCancelRequest(c.id)}>Cancel Request</Button>
                        ) : enrolledClasses.some(e => e.classroomId === c.id) || myClasses.some(m => m.id === c.id) ? (
                            <Button asChild className="w-full"><Link href={`/dashboard/classrooms/${c.id}`}>Enter</Link></Button>
                        ) : (
                            <div className="flex gap-2 w-full">
                                <Button variant="outline" className="flex-1" onClick={() => handleRequestToJoinStudent(c.id)}>Join as Student</Button>
                                <Button variant="outline" className="flex-1" onClick={() => handleOpenTeacherAppDialog(c)}>Join as Teacher</Button>
                            </div>
                        )}
                    </CardFooter>
                </Card>
            ))}
          </TabsContent>
          <TabsContent value="my-classes" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {myClasses.map(c => (
                <Card key={c.id}>
                    <CardHeader><CardTitle>{c.title}</CardTitle><CardDescription>{c.id}</CardDescription></CardHeader>
                    <CardFooter className="flex justify-between">
                        <Button asChild><Link href={`/dashboard/classrooms/${c.id}`}>Enter</Link></Button>
                        <div>
                            <Button variant="ghost" size="icon" onClick={() => handleEdit(c)}><Edit className="h-4 w-4"/></Button>
                            <Button variant="ghost" size="icon" onClick={() => setClassroomToDelete(c)}><Trash2 className="h-4 w-4"/></Button>
                        </div>
                    </CardFooter>
                </Card>
            ))}
          </TabsContent>
          <TabsContent value="enrolled" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {enrolledClasses.map(c => (
                <Card key={c.id}>
                    <CardHeader><CardTitle>{c.title}</CardTitle><CardDescription>By {c.teacherName}</CardDescription></CardHeader>
                    <CardFooter><Button asChild className="w-full"><Link href={`/dashboard/classrooms/${c.classroomId}`}>Enter</Link></Button></CardFooter>
                </Card>
            ))}
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
