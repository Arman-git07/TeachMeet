
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
  GraduationCap,
  Briefcase,
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export interface Teaching {
  id: string;
  title: string;
  description: string;
  teacherId: string;
  teacherName: string;
  isPublic: boolean;
  students: string[];
  createdAt?: any;
}

export interface EnrolledTeachingInfo {
    id: string;
    title: string;
    description: string;
    teacherName: string;
    teachingId: string;
}


const CreateTeachingDialogContent = ({
  onSuccess,
  teachingToEdit,
}: {
  onSuccess: () => void;
  teachingToEdit?: Teaching | null;
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (teachingToEdit) {
      setTitle(teachingToEdit.title);
      setDescription(teachingToEdit.description);
      setIsPublic(teachingToEdit.isPublic);
    } else {
      setTitle('');
      setDescription('');
      setIsPublic(true);
    }
  }, [teachingToEdit]);

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
      if (teachingToEdit) {
        // --- UPDATE EXISTING TEACHING ---
        const teachingRef = doc(db, 'teachings', teachingToEdit.id);
        await updateDoc(teachingRef, { title, description, isPublic });
        toast({ title: 'Teaching Updated', description: `"${title}" has been successfully updated.` });
      } else {
        // --- CREATE NEW TEACHING ---
        const teachingData = {
          title: title.trim(),
          description: description.trim(),
          teacherId: user.uid,
          teacherName: user.displayName || 'Anonymous Teacher',
          isPublic,
          students: [], 
          createdAt: serverTimestamp(),
        };
        await addDoc(collection(db, 'teachings'), teachingData);
        toast({ title: 'Teaching Created', description: `"${title}" has been successfully created.` });
      }
      
      onSuccess();

    } catch (error) {
      console.error('Error saving teaching:', error);
      toast({ variant: 'destructive', title: 'Save Failed', description: 'Could not save the teaching. Check Firestore rules and console for errors.' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>{teachingToEdit ? 'Edit Teaching' : 'Create New Teaching'}</DialogTitle>
        <DialogDescription>{teachingToEdit ? 'Update the details.' : 'Fill out the details for your new teaching.'}</DialogDescription>
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
          {teachingToEdit ? 'Save Changes' : 'Create Teaching'}
        </Button>
      </DialogFooter>
    </>
  );
};

export default function TeachingsPage() {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  
  const [myTeachings, setMyTeachings] = useState<Teaching[]>([]);
  const [enrolledTeachings, setEnrolledTeachings] = useState<EnrolledTeachingInfo[]>([]);
  const [discoverTeachings, setDiscoverTeachings] = useState<Teaching[]>([]);
  
  const [isLoadingMy, setIsLoadingMy] = useState(true);
  const [isLoadingEnrolled, setIsLoadingEnrolled] = useState(true);
  const [isLoadingDiscover, setIsLoadingDiscover] = useState(true);

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [teachingToEdit, setTeachingToEdit] = useState<Teaching | null>(null);
  const [teachingToDelete, setTeachingToDelete] = useState<Teaching | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [requestingToJoin, setRequestingToJoin] = useState<string | null>(null);


  // Fetch My Teachings
  useEffect(() => {
    if (!user) { setIsLoadingMy(false); setMyTeachings([]); return; }
    setIsLoadingMy(true);
    const q = query(collection(db, 'teachings'), where('teacherId', '==', user.uid));
    const unsub = onSnapshot(q, (snapshot) => {
        setMyTeachings(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Teaching)));
        setIsLoadingMy(false);
    }, (error) => { console.error("My Teachings fetch error:", error); setIsLoadingMy(false); });
    return () => unsub();
  }, [user]);

  // Fetch Enrolled Teachings
  useEffect(() => {
    if (!user) { setIsLoadingEnrolled(false); setEnrolledTeachings([]); return; }
    setIsLoadingEnrolled(true);
    const q = query(collection(db, 'users', user.uid, 'enrolled'));
    const unsub = onSnapshot(q, (snapshot) => {
        setEnrolledTeachings(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as EnrolledTeachingInfo)));
        setIsLoadingEnrolled(false);
    }, (error) => { console.error("Enrolled Teachings fetch error:", error); setIsLoadingEnrolled(false); });
    return () => unsub();
  }, [user]);

  // Fetch public teachings for discovery
  useEffect(() => {
    setIsLoadingDiscover(true);
    const q = query(collection(db, 'teachings'), where('isPublic', '==', true));
    const unsub = onSnapshot(q, (snapshot) => {
        setDiscoverTeachings(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Teaching)));
        setIsLoadingDiscover(false);
    }, (error) => { 
        console.error('Discover fetch error:', error); 
        toast({ variant: 'destructive', title: 'Error', description: "Could not fetch public teachings. Check Firestore rules."});
        setIsLoadingDiscover(false); 
    });
    return () => unsub();
  }, [toast]);

  const handleEdit = (teaching: Teaching) => {
    setTeachingToEdit(teaching);
    setIsCreateDialogOpen(true);
  };

  const handleCreateNew = () => {
    setTeachingToEdit(null);
    setIsCreateDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!teachingToDelete || !user) return;
    if (user.uid !== teachingToDelete.teacherId) {
        toast({ variant: 'destructive', title: 'Permission Denied', description: 'You can only delete your own teachings.' });
        return;
    }
    try {
        const teachingRef = doc(db, 'teachings', teachingToDelete.id);
        await deleteDoc(teachingRef);
        toast({ title: 'Success', description: `Teaching "${teachingToDelete.title}" deleted.` });
    } catch (error) {
      console.error('Error deleting teaching:', error);
      toast({ variant: 'destructive', title: 'Error', description: 'Could not delete the teaching. Check Firestore rules and permissions.' });
    } finally {
      setTeachingToDelete(null);
    }
  };
  
  const handleRequestToJoin = useCallback(async (teachingId: string, role: 'student' | 'teacher') => {
    if (!user) {
        toast({ variant: 'destructive', title: "Authentication required", description: "You must be signed in to join a teaching." });
        return;
    }
    setRequestingToJoin(teachingId);
    try {
        const requestRef = doc(db, `teachings/${teachingId}/joinRequests`, user.uid);
        await setDoc(requestRef, {
            studentId: user.uid,
            studentName: user.displayName || 'Anonymous User',
            studentPhotoURL: user.photoURL || '',
            status: 'pending',
            role: role,
            requestedAt: serverTimestamp()
        });
        toast({ title: 'Request Sent!', description: `Your request to join as a ${role} has been sent.` });
    } catch (error) {
        console.error("Error sending join request:", error);
        toast({ variant: 'destructive', title: 'Request Failed', description: 'Could not send join request. Check Firestore Rules for write permissions.' });
    } finally {
        // We might not want to reset this immediately to show a pending state
        // setRequestingToJoin(null);
    }
  }, [user, toast]);

  const copyTeachingId = (id: string) => {
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
    toast({ title: 'Teaching code copied!' });
  };

  const renderMyTeachingCard = useCallback((teaching: Teaching) => (
    <Card key={teaching.id}>
        <CardHeader>
            <CardTitle>{teaching.title}</CardTitle>
            <CardDescription>{teaching.description || "No description."}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
            <p className="text-sm text-muted-foreground">Visibility: {teaching.isPublic ? 'Public' : 'Private'}</p>
            <div className="flex items-center gap-2">
                <Input value={teaching.id} readOnly className="text-xs font-mono"/>
                <Button size="icon" variant="ghost" onClick={() => copyTeachingId(teaching.id)}>
                    {copiedId === teaching.id ? <ClipboardCheck className="h-4 w-4 text-green-500" /> : <Clipboard className="h-4 w-4" />}
                </Button>
            </div>
        </CardContent>
        <CardFooter className="flex justify-between items-center">
            <Button asChild><Link href={`/dashboard/teachings/${teaching.id}`}>Enter Teaching <ArrowRight className="ml-2 h-4 w-4" /></Link></Button>
            <div className="flex items-center">
                <Button variant="ghost" size="icon" onClick={() => handleEdit(teaching)}><Edit className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" onClick={() => setTeachingToDelete(teaching)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
            </div>
        </CardFooter>
    </Card>
  ), [copiedId]);
  
  const renderEnrolledTeachingCard = useCallback((teachingInfo: EnrolledTeachingInfo) => (
    <Card key={teachingInfo.id}>
      <CardHeader>
        <CardTitle>{teachingInfo.title}</CardTitle>
        <CardDescription>{teachingInfo.description || "No description."}</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">Taught by: {teachingInfo.teacherName}</p>
      </CardContent>
      <CardFooter>
        <Button asChild className="w-full"><Link href={`/dashboard/teachings/${teachingInfo.teachingId}`}>Enter Teaching <ArrowRight className="ml-2 h-4 w-4" /></Link></Button>
      </CardFooter>
    </Card>
  ), []);

  const renderDiscoverTeachingCard = useCallback((teaching: Teaching) => {
    const isRequesting = requestingToJoin === teaching.id;
    const isMyTeaching = user?.uid === teaching.teacherId;

    return (
      <Card key={teaching.id} className="flex flex-col">
          <CardHeader>
              <CardTitle>{teaching.title}</CardTitle>
              <CardDescription>{teaching.description || "No description."}</CardDescription>
          </CardHeader>
          <CardContent className="flex-grow">
              <p className="text-sm text-muted-foreground">Taught by: {teaching.teacherName}</p>
          </CardContent>
          <CardFooter className="flex-col items-stretch gap-2 pt-4">
            {isMyTeaching ? (
              <Button asChild className="w-full"><Link href={`/dashboard/teachings/${teaching.id}`}>Enter Teaching <ArrowRight className="ml-2 h-4 w-4" /></Link></Button>
            ) : user ? (
                 isRequesting ? (
                    <Button className="w-full" disabled>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin"/>Pending...
                    </Button>
                ) : (
                    <div className="grid grid-cols-2 gap-2">
                        <Button variant="outline" onClick={() => handleRequestToJoin(teaching.id, 'student')}>
                            <GraduationCap className="mr-2 h-4 w-4"/>
                            Join as Student
                        </Button>
                        <Button variant="outline" onClick={() => handleRequestToJoin(teaching.id, 'teacher')}>
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
  }, [user, requestingToJoin, handleRequestToJoin]);

  const renderSkeleton = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {[...Array(3)].map((_, i) => (
        <Card key={i}><CardHeader><Skeleton className="h-6 w-3/4" /><Skeleton className="h-4 w-full mt-2" /></CardHeader><CardContent><Skeleton className="h-4 w-1/2" /></CardContent><CardFooter><Skeleton className="h-10 w-24" /></CardFooter></Card>
      ))}
    </div>
  );

  const MyTeachingsTab = () => {
    if (isLoadingMy || authLoading) return renderSkeleton();
    if (!user) return <p className="text-muted-foreground text-center py-10">Please sign in to see your teachings.</p>;
    if (myTeachings.length === 0) return <p className="text-muted-foreground text-center py-10">You haven't created any teachings yet.</p>;
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {myTeachings.map(renderMyTeachingCard)}
      </div>
    );
  };
  
  const EnrolledTeachingsTab = () => {
    if (isLoadingEnrolled || authLoading) return renderSkeleton();
    if (!user) return <p className="text-muted-foreground text-center py-10">Please sign in to see your enrolled teachings.</p>;
    if (enrolledTeachings.length === 0) {
       return (
        <div className="text-center py-10">
          <p className="text-muted-foreground">You are not enrolled in any teachings.</p>
          <p className="text-muted-foreground mt-2">Find one in the "Discover" tab or join one with a code!</p>
        </div>
      );
    }
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {enrolledTeachings.map(renderEnrolledTeachingCard)}
      </div>
    );
  };

  const DiscoverTeachingsTab = () => {
    if (isLoadingDiscover) return renderSkeleton();

    // Filter out teachings the user is already enrolled in or teaches
    const discoverableTeachings = discoverTeachings.filter(publicTeaching => {
      if (!user) return true; // Show all public teachings if not logged in
      
      const isEnrolled = enrolledTeachings.some(enrolled => enrolled.teachingId === publicTeaching.id);
      
      return !isEnrolled;
    });

    if (discoverableTeachings.length === 0) {
        return <p className="text-muted-foreground text-center py-10">No new public teachings to discover right now.</p>;
    }

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {discoverableTeachings.map(renderDiscoverTeachingCard)}
      </div>
    );
  };

  return (
    <div className="container mx-auto p-4 md:p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Teachings</h1>
        { user && (
            <div>
                <Button asChild variant="outline" className="mr-2">
                    <Link href="/dashboard/teachings/join">Join a Teaching</Link>
                </Button>
                <Dialog open={isCreateDialogOpen} onOpenChange={(isOpen) => { if (!isOpen) setTeachingToEdit(null); setIsCreateDialogOpen(isOpen); }}>
                  <DialogTrigger asChild><Button onClick={handleCreateNew}><PlusCircle className="mr-2 h-4 w-4" /> Create New</Button></DialogTrigger>
                  <DialogContent><CreateTeachingDialogContent onSuccess={() => setIsCreateDialogOpen(false)} teachingToEdit={teachingToEdit} /></DialogContent>
                </Dialog>
            </div>
        )}
      </div>

      <AlertDialog open={!!teachingToDelete} onOpenChange={(isOpen) => !isOpen && setTeachingToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle><AlertDialogDescription>This will permanently delete the teaching &quot;{teachingToDelete?.title}&quot;. This action cannot be undone.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Tabs defaultValue="discover" className="w-full">
        <TabsList><TabsTrigger value="discover"><Eye className="mr-2 h-4 w-4" /> Discover</TabsTrigger><TabsTrigger value="my-classes"><School className="mr-2 h-4 w-4" /> My Teachings</TabsTrigger><TabsTrigger value="enrolled"><BookOpen className="mr-2 h-4 w-4" /> Enrolled</TabsTrigger></TabsList>
        <TabsContent value="discover" className="mt-4"><DiscoverTeachingsTab /></TabsContent>
        <TabsContent value="my-classes" className="mt-4"><MyTeachingsTab /></TabsContent>
        <TabsContent value="enrolled" className="mt-4"><EnrolledTeachingsTab /></TabsContent>
      </Tabs>
    </div>
  );
}
