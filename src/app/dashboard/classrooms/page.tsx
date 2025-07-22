
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
  DialogTrigger,
  DialogClose,
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
import { db } from '@/lib/firebase';
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
} from 'firebase/firestore';
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
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

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
          students: [], // No one is enrolled initially except the teacher conceptually
          createdAt: serverTimestamp(),
        };
        // The rules now handle the teacherId check
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
          <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} className="col-span-3" placeholder="e.g., Introduction to React" />
        </div>
        <div className="grid grid-cols-4 items-center gap-4">
          <Label htmlFor="description" className="text-right">Description</Label>
          <Input id="description" value={description} onChange={(e) => setDescription(e.target.value)} className="col-span-3" placeholder="A brief summary" />
        </div>
        <div className="flex items-center space-x-2 justify-end">
          <Label htmlFor="is-public">Make Public</Label>
          <Switch id="is-public" checked={isPublic} onCheckedChange={setIsPublic} />
        </div>
      </div>
      <DialogFooter>
        <DialogClose asChild><Button type="button" variant="secondary">Cancel</Button></DialogClose>
        <Button onClick={handleSubmit} disabled={isLoading}>
          {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          {classroomToEdit ? 'Save Changes' : 'Create Classroom'}
        </Button>
      </DialogFooter>
    </>
  );
};

export default function ClassroomsPage() {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  
  const [myClasses, setMyClasses] = useState<Classroom[]>([]);
  const [enrolledClasses, setEnrolledClasses] = useState<EnrolledClassroomInfo[]>([]);
  const [discoverClasses, setDiscoverClasses] = useState<Classroom[]>([]);
  
  const [isLoadingMy, setIsLoadingMy] = useState(true);
  const [isLoadingEnrolled, setIsLoadingEnrolled] = useState(true);
  const [isLoadingDiscover, setIsLoadingDiscover] = useState(true);

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [classroomToEdit, setClassroomToEdit] = useState<Classroom | null>(null);
  const [classroomToDelete, setClassroomToDelete] = useState<Classroom | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [requestingToJoin, setRequestingToJoin] = useState<string | null>(null);


  // Fetch My Classes
  useEffect(() => {
    if (!user) { setIsLoadingMy(false); setMyClasses([]); return; }
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
    const q = query(collection(db, 'users', user.uid, 'enrolled'));
    const unsub = onSnapshot(q, (snapshot) => {
        setEnrolledClasses(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as EnrolledClassroomInfo)));
        setIsLoadingEnrolled(false);
    }, (error) => { console.error("Enrolled Classes fetch error:", error); setIsLoadingEnrolled(false); });
    return () => unsub();
  }, [user]);

  // Fetch public classes for discovery
  useEffect(() => {
    const q = query(collection(db, 'classrooms'), where('isPublic', '==', true));
    const unsub = onSnapshot(q, (snapshot) => {
        setDiscoverClasses(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Classroom)));
        setIsLoadingDiscover(false);
    }, (error) => { console.error('Discover fetch error:', error); setIsLoadingDiscover(false); });
    return () => unsub();
  }, []);

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
  
  const handleRequestToJoin = async (classroomId: string) => {
    if (!user) {
        toast({ variant: 'destructive', title: "Authentication required" });
        return;
    }
    setRequestingToJoin(classroomId);
    try {
        const requestRef = doc(db, `classrooms/${classroomId}/joinRequests`, user.uid);
        await setDoc(requestRef, {
            studentId: user.uid,
            studentName: user.displayName || 'Anonymous Student',
            studentPhotoURL: user.photoURL || '',
            status: 'pending',
            requestedAt: serverTimestamp()
        });
        toast({ title: 'Request Sent!', description: 'Your request to join has been sent to the teacher.' });
    } catch (error) {
        console.error("Error sending join request:", error);
        toast({ variant: 'destructive', title: 'Request Failed', description: 'Could not send join request.' });
    } finally {
        // We don't reset requestingToJoin state here, so the button remains "Pending"
    }
};

  const copyClassId = (id: string) => {
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
    toast({ title: 'Class code copied!' });
  };

  const renderMyClassroomCard = (classroom: Classroom) => (
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
  );
  
  const renderEnrolledClassroomCard = (classroomInfo: EnrolledClassroomInfo) => (
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
  );

  const renderDiscoverClassroomCard = (classroom: Classroom) => {
    const isRequesting = requestingToJoin === classroom.id;
    return (
      <Card key={classroom.id}>
          <CardHeader>
              <CardTitle>{classroom.title}</CardTitle>
              <CardDescription>{classroom.description || "No description."}</CardDescription>
          </CardHeader>
          <CardContent>
              <p className="text-sm text-muted-foreground">Taught by: {classroom.teacherName}</p>
          </CardContent>
          <CardFooter>
            <Button className="w-full" onClick={() => handleRequestToJoin(classroom.id)} disabled={isRequesting}>
                {isRequesting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin"/>Pending...</> : <><UserPlus className="mr-2 h-4 w-4" />Request to Join</>}
            </Button>
          </CardFooter>
    </Card>
    );
  };

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
          <p className="text-muted-foreground mt-2">Find one in the "Discover" tab to join!</p>
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
    if (isLoadingDiscover || authLoading) return renderSkeleton();

    // Create sets of IDs for efficient lookup
    const myClassIds = new Set(myClasses.map(c => c.id));
    const enrolledClassIds = new Set(enrolledClasses.map(c => c.classroomId));

    // Filter discoverable classes: must be public, not created by user, and not enrolled in by user
    const discoverable = discoverClasses.filter(c => 
        c.isPublic &&
        !myClassIds.has(c.id) &&
        !enrolledClassIds.has(c.id) &&
        c.teacherId !== user?.uid // Explicitly exclude own classes again
    );

    if (discoverable.length === 0) {
        return <p className="text-muted-foreground text-center py-10">No public classrooms to discover right now.</p>;
    }

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {discoverable.map(renderDiscoverClassroomCard)}
      </div>
    );
  };

  return (
    <div className="container mx-auto p-4 md:p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Classrooms</h1>
        <div>
            <Button asChild variant="outline" className="mr-2">
                <Link href="/dashboard/classrooms/join">Join a Class</Link>
            </Button>
            <Dialog open={isCreateDialogOpen} onOpenChange={(isOpen) => { if (!isOpen) setClassroomToEdit(null); setIsCreateDialogOpen(isOpen); }}>
              <DialogTrigger asChild><Button onClick={handleCreateNew}><PlusCircle className="mr-2 h-4 w-4" /> Create New</Button></DialogTrigger>
              <DialogContent><CreateClassroomDialogContent onSuccess={() => setIsCreateDialogOpen(false)} classroomToEdit={classroomToEdit} /></DialogContent>
            </Dialog>
        </div>
      </div>

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
