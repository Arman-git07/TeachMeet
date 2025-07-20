
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
  arrayUnion,
  arrayRemove,
  onSnapshot,
  query,
  where,
  getDoc,
  getDocs,
  writeBatch,
  DocumentReference,
  or,
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

export interface Teaching {
  id: string;
  title: string;
  description: string;
  creatorId: string;
  creatorName: string;
  isPublic: boolean;
  allowedStudents: string[];
  pendingRequests: string[];
  createdAt?: any;
}

export interface EnrolledTeachingInfo {
    id: string;
    title: string;
    description: string;
    creatorName: string;
    teachingRef: DocumentReference;
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
      const batch = writeBatch(db);

      if (teachingToEdit) {
        // --- UPDATE EXISTING TEACHING ---
        const teachingRef = doc(db, 'teachings', teachingToEdit.id);
        batch.update(teachingRef, { title, description, isPublic });

      } else {
        // --- CREATE NEW TEACHING ---
        const teachingRef = doc(collection(db, 'teachings'));
        const teachingData = {
          title: title.trim(),
          description: description.trim(),
          creatorId: user.uid,
          creatorName: user.displayName || 'Anonymous',
          isPublic,
          allowedStudents: [user.uid], // Creator is always a member
          pendingRequests: [],
          createdAt: serverTimestamp(),
        };
        batch.set(teachingRef, teachingData);

        // Also add to user's "myTeachings" list
        const myTeachingRef = doc(db, 'users', user.uid, 'myTeachings', teachingRef.id);
        batch.set(myTeachingRef, {
            title: teachingData.title,
            description: teachingData.description,
            creatorName: teachingData.creatorName,
            teachingRef: teachingRef,
        });
      }
      
      await batch.commit();
      toast({ title: teachingToEdit ? 'Teaching Updated' : 'Teaching Created', description: `"${title}" has been successfully saved.` });
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
        <DialogDescription>{teachingToEdit ? 'Update the details.' : 'Fill out the details for your new class.'}</DialogDescription>
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
  
  const [isLoadingMy, setIsLoadingMy] = useState(true);
  const [isLoadingEnrolled, setIsLoadingEnrolled] = useState(true);
  const [isLoadingDiscover, setIsLoadingDiscover] = useState(true);

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isRequestsDialogOpen, setIsRequestsDialogOpen] = useState(false);
  const [teachingToEdit, setTeachingToEdit] = useState<Teaching | null>(null);
  const [teachingToDelete, setTeachingToDelete] = useState<Teaching | null>(null);
  const [teachingToManage, setTeachingToManage] = useState<Teaching | null>(null);

  // Fetch My Teachings - now listens to the main `teachings` collection
  useEffect(() => {
    if (!user) {
        setIsLoadingMy(false);
        setMyTeachings([]);
        return;
    }
    const myQuery = query(collection(db, 'teachings'), where('creatorId', '==', user.uid));
    const unsubMy = onSnapshot(myQuery, (snapshot) => {
        const teachingsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Teaching));
        setMyTeachings(teachingsData);
        setIsLoadingMy(false);
    }, (error) => { console.error("My Teachings fetch error:", error); setIsLoadingMy(false); });
    return () => unsubMy();
  }, [user]);

  // Fetch Enrolled Teachings
  useEffect(() => {
    if (!user) {
        setIsLoadingEnrolled(false);
        setEnrolledTeachingsInfo([]);
        return;
    }
    const enrolledQuery = query(collection(db, 'users', user.uid, 'enrolledTeachings'));
    const unsubEnrolled = onSnapshot(enrolledQuery, async (snapshot) => {
        const enrolledDocs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as EnrolledTeachingInfo));
        setEnrolledTeachingsInfo(enrolledDocs);
        setIsLoadingEnrolled(false);
    }, (error) => { console.error("Enrolled Teachings fetch error:", error); setIsLoadingEnrolled(false); });
    return () => unsubEnrolled();
  }, [user]);

  // Fetch public teachings for discovery
  useEffect(() => {
    setIsLoadingDiscover(true);
    const discoverQuery = query(collection(db, 'teachings'), where('isPublic', '==', true));
    const unsubDiscover = onSnapshot(discoverQuery, (snapshot) => {
        const teachingsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Teaching));
        setDiscoverTeachings(teachingsData);
        setIsLoadingDiscover(false);
    }, (error) => {
        console.error('Error fetching discoverable teachings:', error);
        toast({ variant: 'destructive', title: 'Error', description: 'Could not fetch public teachings.' });
        setIsLoadingDiscover(false);
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
        const teachingRef = doc(db, 'teachings', teachingToDelete.id);
        const myTeachingRef = doc(db, 'users', user.uid, 'myTeachings', teachingToDelete.id);
        batch.delete(teachingRef);
        batch.delete(myTeachingRef);
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

  const handleManageRequests = (teaching: Teaching) => {
    setTeachingToManage(teaching);
    setIsRequestsDialogOpen(true);
  };
  
  const handleApproveRequest = async (studentId: string) => {
    if (!teachingToManage || !user) return;
    try {
        const batch = writeBatch(db);
        
        const teachingRef = doc(db, 'teachings', teachingToManage.id);
        batch.update(teachingRef, {
            pendingRequests: arrayRemove(studentId),
            allowedStudents: arrayUnion(studentId),
        });

        const studentEnrolledRef = doc(db, 'users', studentId, 'enrolledTeachings', teachingToManage.id);
        batch.set(studentEnrolledRef, {
            title: teachingToManage.title,
            description: teachingToManage.description,
            creatorName: teachingToManage.creatorName,
            teachingRef: teachingRef,
            joinedAt: serverTimestamp(),
        });
        
        await batch.commit();
        toast({ title: 'Success', description: 'Student approved and enrolled.' });
        
        setTeachingToManage(prev => prev ? ({ ...prev, pendingRequests: prev.pendingRequests.filter(id => id !== studentId), allowedStudents: [...prev.allowedStudents, studentId] }) : null);

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
      setTeachingToManage(prev => prev ? ({ ...prev, pendingRequests: prev.pendingRequests.filter(id => id !== studentId) }) : null);
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
                    {teaching.pendingRequests?.length > 0 && (
                      <span className="absolute top-0 right-0 block h-2.5 w-2.5 rounded-full bg-destructive ring-2 ring-card" />
                    )}
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
    if (!user) return null;
    const isPending = teaching.pendingRequests?.includes(user.uid);
    const isMember = teaching.allowedStudents?.includes(user.uid);

    if (isMember) return null;

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
    if (isLoadingMy || authLoading) return renderSkeleton();
    if (!user) return <p className="text-muted-foreground text-center py-10">Please sign in to see your classes.</p>;
    if (myTeachings.length === 0) return <p className="text-muted-foreground text-center py-10">You haven't created any teachings yet.</p>;
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {myTeachings.map(renderMyTeachingCard)}
      </div>
    );
  };
  
  const EnrolledTeachingsTab = () => {
    if (isLoadingEnrolled || authLoading) return renderSkeleton();
    if (!user) return <p className="text-muted-foreground text-center py-10">Please sign in to see your enrolled classes.</p>;
    if (enrolledTeachingsInfo.length === 0) {
       return (
        <div className="text-center py-10">
          <p className="text-muted-foreground">You are not enrolled in any teachings.</p>
          <p className="text-muted-foreground mt-2">Find one in the "Discover" tab to join!</p>
        </div>
      );
    }
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {enrolledTeachingsInfo.map(renderEnrolledTeachingCard)}
      </div>
    );
  };

  const DiscoverTeachingsTab = () => {
    if (isLoadingDiscover) return renderSkeleton();
    
    const myTeachingIds = new Set(myTeachings.map(t => t.id));
    const enrolledIds = new Set(enrolledTeachingsInfo.map(t => t.id));
    const discoverable = discoverTeachings.filter(t => !myTeachingIds.has(t.id) && !enrolledIds.has(t.id));

    if (discoverable.length === 0) return <p className="text-muted-foreground text-center py-10">No public teachings to discover right now.</p>;
    
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
