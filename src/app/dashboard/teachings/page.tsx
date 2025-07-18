
'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
  arrayUnion,
  arrayRemove,
  onSnapshot,
  query,
  where,
  getDoc,
  getDocs,
  writeBatch,
  DocumentReference,
} from 'firebase/firestore';
import {
  PlusCircle,
  Edit,
  Trash2,
  Users,
  LogIn,
  Loader2,
  Check,
  X,
  BookOpen,
  Eye,
  School,
  ArrowRight,
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import Link from 'next/link';

// Updated interface to reflect the new data structure
export interface Teaching {
  id: string;
  title: string;
  description: string;
  creatorId: string;
  creatorName: string;
  isPublic: boolean;
  members: string[]; // This will now be derived or checked against allowedStudents
  allowedStudents: string[]; // For private teachings
  pendingRequests: string[];
  createdAt?: any;
}

export interface EnrolledTeachingInfo {
  id: string; // The ID of the teaching document itself
  title: string;
  description: string;
  creatorName: string;
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
      toast({ variant: 'destructive', title: 'Title Required' });
      return;
    }
    setIsLoading(true);

    try {
      const batch = writeBatch(db);

      if (teachingToEdit) {
        // Update existing teaching in the main collection
        const teachingRef = doc(db, 'teachings', teachingToEdit.id);
        batch.update(teachingRef, { title, description, isPublic });

        // Update the reference in the user's myTeachings subcollection
        const userTeachingRef = doc(db, 'users', user.uid, 'myTeachings', teachingToEdit.id);
        batch.update(userTeachingRef, { title, description, isPublic });
        
        await batch.commit();
        toast({ title: 'Teaching Updated', description: `"${title}" has been successfully updated.` });

      } else {
        // Create new teaching
        const teachingData = {
          title: title.trim(),
          description: description.trim(),
          isPublic,
          creatorId: user.uid,
          creatorName: user.displayName || 'Anonymous',
          allowedStudents: [user.uid], // Creator is always a member
          pendingRequests: [],
          createdAt: serverTimestamp(),
        };

        const newTeachingRef = doc(collection(db, 'teachings'));
        batch.set(newTeachingRef, teachingData);

        const userTeachingRef = doc(db, 'users', user.uid, 'myTeachings', newTeachingRef.id);
        batch.set(userTeachingRef, {
            title: teachingData.title,
            description: teachingData.description,
            isPublic: teachingData.isPublic,
            ref: newTeachingRef,
            createdAt: serverTimestamp(),
        });
        
        await batch.commit();
        toast({ title: 'Teaching Created', description: `"${title}" has been successfully created.` });
      }
      onSuccess();
    } catch (error) {
      console.error('Error saving teaching:', error);
      toast({ variant: 'destructive', title: 'Save Failed', description: 'Could not save the teaching.' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>{teachingToEdit ? 'Edit Teaching' : 'Create New Teaching'}</DialogTitle>
        <DialogDescription>{teachingToEdit ? 'Update the details.' : 'Fill out the details to create a new class.'}</DialogDescription>
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
          {teachingToEdit ? 'Save Changes' : 'Create Teaching'}
        </Button>
      </DialogFooter>
    </>
  );
};

export default function TeachingsPage() {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  
  const [myTeachings, setMyTeachings] = useState<Teaching[]>([]);
  const [enrolledTeachingsInfo, setEnrolledTeachingsInfo] = useState<EnrolledTeachingInfo[]>([]);
  const [discoverTeachings, setDiscoverTeachings] = useState<Teaching[]>([]);
  
  const [isLoading, setIsLoading] = useState(true);

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isRequestsDialogOpen, setIsRequestsDialogOpen] = useState(false);
  const [teachingToEdit, setTeachingToEdit] = useState<Teaching | null>(null);
  const [teachingToDelete, setTeachingToDelete] = useState<Teaching | null>(null);
  const [teachingToManage, setTeachingToManage] = useState<Teaching | null>(null);

  // Fetch all user-related teachings
  useEffect(() => {
    if (!user) {
      setMyTeachings([]);
      setEnrolledTeachingsInfo([]);
      return;
    }
    
    // Listener for My Teachings
    const myTeachingsQuery = query(collection(db, 'users', user.uid, 'myTeachings'));
    const unsubMyTeachings = onSnapshot(myTeachingsQuery, async (snapshot) => {
        const teachingsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Teaching));
        setMyTeachings(teachingsData);
    });

    // Listener for Enrolled Teachings
    const enrolledQuery = query(collection(db, 'users', user.uid, 'enrolledTeachings'));
    const unsubEnrolled = onSnapshot(enrolledQuery, async (snapshot) => {
        const enrolledRefs = snapshot.docs.map(d => d.data().ref as DocumentReference);
        if (enrolledRefs.length > 0) {
            const teachingDocs = await Promise.all(enrolledRefs.map(ref => getDoc(ref)));
            const teachingInfos = teachingDocs
                .filter(doc => doc.exists())
                .map(doc => ({ id: doc.id, ...doc.data() } as EnrolledTeachingInfo));
            setEnrolledTeachingsInfo(teachingInfos);
        } else {
            setEnrolledTeachingsInfo([]);
        }
    });

    return () => {
        unsubMyTeachings();
        unsubEnrolled();
    };
  }, [user]);

  // Fetch public teachings for discovery
  useEffect(() => {
    setIsLoading(true);
    const discoverQuery = query(collection(db, 'teachings'), where('isPublic', '==', true));
    const unsubDiscover = onSnapshot(discoverQuery, (snapshot) => {
        const teachingsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Teaching));
        setDiscoverTeachings(teachingsData);
        setIsLoading(false);
    }, (error) => {
        console.error('Error fetching discoverable teachings:', error);
        toast({ variant: 'destructive', title: 'Error', description: 'Could not fetch public teachings.' });
        setIsLoading(false);
    });

    return () => unsubDiscover();
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
    try {
        const batch = writeBatch(db);
        // Delete from main teachings collection
        batch.delete(doc(db, 'teachings', teachingToDelete.id));
        // Delete from user's myTeachings subcollection
        batch.delete(doc(db, 'users', user.uid, 'myTeachings', teachingToDelete.id));
        await batch.commit();

      toast({ title: 'Success', description: `Teaching "${teachingToDelete.title}" deleted.` });
      setTeachingToDelete(null);
    } catch (error) {
      console.error('Error deleting teaching:', error);
      toast({ variant: 'destructive', title: 'Error', description: 'Could not delete the teaching.' });
    }
  };

  const handleRequestToJoin = async (teachingId: string) => {
    if (!user) {
        toast({ variant: 'destructive', title: 'Login Required' });
        return;
    }
    try {
      const teachingRef = doc(db, 'teachings', teachingId);
      await updateDoc(teachingRef, { pendingRequests: arrayUnion(user.uid) });
      toast({ title: 'Request Sent', description: 'Your request to join has been sent.' });
    } catch (error) {
      console.error('Error requesting to join:', error);
      toast({ variant: 'destructive', title: 'Error', description: 'Could not send join request.' });
    }
  };

  const handleManageRequests = async (teaching: Teaching) => {
    // We need to fetch the full teaching document to get pendingRequests
    const teachingRef = doc(db, 'teachings', teaching.id);
    const teachingSnap = await getDoc(teachingRef);
    if(teachingSnap.exists()) {
        setTeachingToManage(teachingSnap.data() as Teaching);
        setIsRequestsDialogOpen(true);
    }
  };
  
  const handleApproveRequest = async (studentId: string) => {
    if (!teachingToManage) return;
    try {
        const batch = writeBatch(db);
        const teachingRef = doc(db, 'teachings', teachingToManage.id);
        
        // Add student to the allowedStudents list and remove from pending
        batch.update(teachingRef, {
            pendingRequests: arrayRemove(studentId),
            allowedStudents: arrayUnion(studentId),
        });

        // Add the teaching reference to the student's enrolledTeachings subcollection
        const studentEnrolledRef = doc(db, 'users', studentId, 'enrolledTeachings', teachingToManage.id);
        batch.set(studentEnrolledRef, {
            ref: teachingRef,
            joinedAt: serverTimestamp()
        });
        
        await batch.commit();
        toast({ title: 'Success', description: 'Student approved.' });
        // Refresh managed teaching data
        const updatedTeachingSnap = await getDoc(teachingRef);
        if(updatedTeachingSnap.exists()) setTeachingToManage(updatedTeachingSnap.data() as Teaching);

    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'Could not approve student.' });
    }
  };
  
  const handleDenyRequest = async (studentId: string) => {
    if (!teachingToManage) return;
    try {
      const teachingRef = doc(db, 'teachings', teachingToManage.id);
      await updateDoc(teachingRef, { pendingRequests: arrayRemove(studentId) });
      toast({ title: 'Success', description: 'Student denied.' });
      const updatedTeachingSnap = await getDoc(teachingRef);
      if(updatedTeachingSnap.exists()) setTeachingToManage(updatedTeachingSnap.data() as Teaching);
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'Could not deny student.' });
    }
  };

  const renderMyTeachingCard = (teaching: Teaching) => (
    <Card key={teaching.id}>
        <CardHeader>
            <CardTitle>{teaching.title}</CardTitle>
            <CardDescription>{teaching.description || "No description."}</CardDescription>
        </CardHeader>
        <CardContent>
            <p className="text-sm text-muted-foreground">Visibility: {teaching.isPublic ? 'Public' : 'Private'}</p>
        </CardContent>
        <CardFooter className="flex justify-between items-center">
            <Button asChild><Link href={`/dashboard/teachings/${teaching.id}`}>Enter Class <ArrowRight className="ml-2 h-4 w-4" /></Link></Button>
            <div className="flex items-center">
                <Button variant="ghost" onClick={() => handleManageRequests(teaching)} className="text-muted-foreground hover:text-primary relative">
                    <Users className="mr-2 h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => handleEdit(teaching)}><Edit className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" onClick={() => setTeachingToDelete(teaching)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
            </div>
        </CardFooter>
    </Card>
  );
  
  const renderEnrolledTeachingCard = (teachingInfo: EnrolledTeachingInfo) => (
      <Card key={teachingInfo.id}>
          <CardHeader>
              <CardTitle>{teachingInfo.title}</CardTitle>
              <CardDescription>{teachingInfo.description || "No description."}</CardDescription>
          </CardHeader>
          <CardContent>
              <p className="text-sm text-muted-foreground">Created by: {teachingInfo.creatorName}</p>
          </CardContent>
          <CardFooter>
              <Button asChild className="w-full"><Link href={`/dashboard/teachings/${teachingInfo.id}`}>Enter Class <ArrowRight className="ml-2 h-4 w-4" /></Link></Button>
          </CardFooter>
      </Card>
  );

  const renderDiscoverTeachingCard = (teaching: Teaching) => {
    const isPending = user && teaching.pendingRequests ? teaching.pendingRequests.includes(user.uid) : false;
    return (
      <Card key={teaching.id}>
          <CardHeader>
              <CardTitle>{teaching.title}</CardTitle>
              <CardDescription>{teaching.description || "No description."}</CardDescription>
          </CardHeader>
          <CardContent>
              <p className="text-sm text-muted-foreground">Created by: {teaching.creatorName}</p>
          </CardContent>
          <CardFooter>
            { isPending ? (
              <Button disabled><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Pending Approval</Button>
            ) : (
              <Button onClick={() => handleRequestToJoin(teaching.id)}><LogIn className="mr-2 h-4 w-4" /> Request to Join</Button>
            )}
          </CardFooter>
      </Card>
    )
  };

  const renderSkeleton = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {[...Array(3)].map((_, i) => (
        <Card key={i}><CardHeader><Skeleton className="h-6 w-3/4" /><Skeleton className="h-4 w-full mt-2" /></CardHeader><CardContent><Skeleton className="h-4 w-1/2" /></CardContent><CardFooter><Skeleton className="h-10 w-24" /></CardFooter></Card>
      ))}
    </div>
  );

  const MyTeachingsTab = () => {
    if (authLoading) return renderSkeleton();
    if (!user) return <p className="text-muted-foreground text-center py-10">Please sign in to see your classes.</p>;
    if (myTeachings.length === 0) return <p className="text-muted-foreground text-center py-10">You haven't created any teachings yet.</p>;
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {myTeachings.map(renderMyTeachingCard)}
      </div>
    );
  };
  
  const EnrolledTeachingsTab = () => {
    if (authLoading) return renderSkeleton();
    if (!user) return <p className="text-muted-foreground text-center py-10">Please sign in to see your enrolled classes.</p>;
    if (enrolledTeachingsInfo.length === 0) return (
      <div className="text-center py-10">
        <p className="text-muted-foreground">You are not enrolled in any teachings.</p>
        <p className="text-muted-foreground mt-2">Find one in the "Discover" tab to join!</p>
      </div>
    );
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {enrolledTeachingsInfo.map(renderEnrolledTeachingCard)}
      </div>
    );
  };

  const DiscoverTeachingsTab = () => {
    if (isLoading) return renderSkeleton();
    if (discoverTeachings.length === 0) return <p className="text-muted-foreground text-center py-10">No public teachings available right now.</p>;
    
    // Exclude teachings the user has created or is enrolled in
    const discoverable = discoverTeachings.filter(t => 
        !myTeachings.some(myT => myT.id === t.id) && 
        !enrolledTeachingsInfo.some(enrolledT => enrolledT.id === t.id)
    );
    
    if (discoverable.length === 0) return <p className="text-muted-foreground text-center py-10">No new teachings to discover right now.</p>;
    
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {discoverable.map(renderDiscoverTeachingCard)}
      </div>
    );
  };

  return (
    <div className="container mx-auto p-4 md:p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Teachings</h1>
        <Dialog open={isCreateDialogOpen} onOpenChange={(isOpen) => { if (!isOpen) setTeachingToEdit(null); setIsCreateDialogOpen(isOpen); }}>
          <DialogTrigger asChild><Button onClick={handleCreateNew}><PlusCircle className="mr-2 h-4 w-4" /> Create New</Button></DialogTrigger>
          <DialogContent><CreateTeachingDialogContent onSuccess={() => setIsCreateDialogOpen(false)} teachingToEdit={teachingToEdit} /></DialogContent>
        </Dialog>
      </div>
      
       <Dialog open={isRequestsDialogOpen} onOpenChange={setIsRequestsDialogOpen}>
        <DialogContent className="max-w-md">
            <DialogHeader>
                <DialogTitle>Manage Join Requests</DialogTitle>
                <DialogDescription>Approve or deny requests for &quot;{teachingToManage?.title}&quot;.</DialogDescription>
            </DialogHeader>
            <ScrollArea className="max-h-80">
                <div className="py-4 space-y-2">
                    {teachingToManage?.pendingRequests?.length ? teachingToManage.pendingRequests.map(studentId => (
                        <div key={studentId} className="flex items-center justify-between p-2 rounded-lg bg-muted">
                           <div className="flex items-center gap-2">
                             <Avatar><AvatarImage src={`https://placehold.co/40x40.png?text=${studentId.substring(0,1)}`} data-ai-hint="avatar user"/><AvatarFallback>{studentId.substring(0, 1)}</AvatarFallback></Avatar>
                             <span className="text-sm font-mono truncate" title={studentId}>...{studentId.slice(-6)}</span>
                           </div>
                           <div className="flex gap-1">
                               <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => handleApproveRequest(studentId)}><Check className="h-4 w-4 text-green-500"/></Button>
                               <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => handleDenyRequest(studentId)}><X className="h-4 w-4 text-red-500"/></Button>
                           </div>
                        </div>
                    )) : (
                        <p className="text-sm text-center text-muted-foreground py-8">No pending requests.</p>
                    )}
                </div>
            </ScrollArea>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!teachingToDelete} onOpenChange={(isOpen) => !isOpen && setTeachingToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle><AlertDialogDescription>This will permanently delete the teaching &quot;{teachingToDelete?.title}&quot;. This action cannot be undone.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Tabs defaultValue="my-classes" className="w-full">
        <TabsList><TabsTrigger value="my-classes"><School className="mr-2 h-4 w-4" /> My Classes</TabsTrigger><TabsTrigger value="enrolled"><BookOpen className="mr-2 h-4 w-4" /> Enrolled</TabsTrigger><TabsTrigger value="discover"><Eye className="mr-2 h-4 w-4" /> Discover</TabsTrigger></TabsList>
        <TabsContent value="my-classes" className="mt-4"><MyTeachingsTab /></TabsContent>
        <TabsContent value="enrolled" className="mt-4"><EnrolledTeachingsTab /></TabsContent>
        <TabsContent value="discover" className="mt-4"><DiscoverTeachingsTab /></TabsContent>
      </Tabs>
    </div>
  );
}
