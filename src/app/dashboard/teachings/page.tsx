
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
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';

export interface Teaching {
  id: string;
  title: string;
  description: string;
  creatorId: string;
  creatorName: string;
  isPublic: boolean;
  members: string[];
  pendingRequests: string[];
  createdAt?: any;
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
      toast({
        variant: 'destructive',
        title: 'Not Authenticated',
        description: 'You must be logged in to create or edit a teaching.',
      });
      return;
    }
    if (!title.trim()) {
      toast({
        variant: 'destructive',
        title: 'Title Required',
        description: 'Please provide a title for your teaching.',
      });
      return;
    }

    setIsLoading(true);

    try {
      if (teachingToEdit) {
        // Update existing teaching
        const teachingRef = doc(db, 'teachings', teachingToEdit.id);
        await updateDoc(teachingRef, {
          title,
          description,
          isPublic,
        });
        toast({
          title: 'Teaching Updated',
          description: `"${title}" has been successfully updated.`,
        });
      } else {
        // Create new teaching
        await addDoc(collection(db, 'teachings'), {
          title,
          description,
          isPublic,
          creatorId: user.uid,
          creatorName: user.displayName || 'Anonymous',
          members: [user.uid],
          pendingRequests: [],
          createdAt: serverTimestamp(),
        });
        toast({
          title: 'Teaching Created',
          description: `"${title}" has been successfully created.`,
        });
      }
      onSuccess();
    } catch (error) {
      console.error('Error saving teaching:', error);
      toast({
        variant: 'destructive',
        title: 'Save Failed',
        description:
          'Could not save the teaching. Check Firestore rules and network connection.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>
          {teachingToEdit ? 'Edit Teaching' : 'Create New Teaching'}
        </DialogTitle>
        <DialogDescription>
          {teachingToEdit
            ? 'Update the details for your teaching.'
            : 'Fill out the details below to create a new teaching.'}
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-4 py-4">
        <div className="grid grid-cols-4 items-center gap-4">
          <Label htmlFor="title" className="text-right">
            Title
          </Label>
          <Input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="col-span-3"
            placeholder="e.g., Introduction to React"
          />
        </div>
        <div className="grid grid-cols-4 items-center gap-4">
          <Label htmlFor="description" className="text-right">
            Description
          </Label>
          <Input
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="col-span-3"
            placeholder="A brief summary of the teaching"
          />
        </div>
        <div className="flex items-center space-x-2 justify-end">
          <Label htmlFor="is-public">Make Public</Label>
          <Switch
            id="is-public"
            checked={isPublic}
            onCheckedChange={setIsPublic}
          />
        </div>
      </div>
      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="secondary">
            Cancel
          </Button>
        </DialogClose>
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
  const [allTeachings, setAllTeachings] = useState<Teaching[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isRequestsDialogOpen, setIsRequestsDialogOpen] = useState(false);
  const [teachingToEdit, setTeachingToEdit] = useState<Teaching | null>(null);
  const [teachingToDelete, setTeachingToDelete] = useState<Teaching | null>(
    null
  );
  const [teachingToManage, setTeachingToManage] = useState<Teaching | null>(
    null
  );

  useEffect(() => {
    setIsLoading(true);
    const q = query(collection(db, 'teachings'));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const teachingsData = snapshot.docs.map(
          (doc) => ({ id: doc.id, ...doc.data() } as Teaching)
        );
        setAllTeachings(teachingsData);
        setIsLoading(false);
      },
      (error) => {
        console.error('Error fetching teachings:', error);
        toast({
          variant: 'destructive',
          title: 'Error',
          description: 'Could not fetch teachings data.',
        });
        setIsLoading(false);
      }
    );
    return () => unsubscribe();
  }, [toast]);

  const { myTeachings, enrolledTeachings, publicTeachings } = useMemo(() => {
    const my: Teaching[] = [];
    const enrolled: Teaching[] = [];
    const publicList: Teaching[] = [];

    if (user) {
      allTeachings.forEach((t) => {
        if (t.creatorId === user.uid) {
          my.push(t);
        } else if (t.members.includes(user.uid)) {
          enrolled.push(t);
        } else if (t.isPublic) {
          publicList.push(t);
        }
      });
    }
    return { myTeachings: my, enrolledTeachings: enrolled, publicTeachings: publicList };
  }, [allTeachings, user]);

  const handleEdit = (teaching: Teaching) => {
    setTeachingToEdit(teaching);
    setIsCreateDialogOpen(true);
  };

  const handleCreateNew = () => {
    setTeachingToEdit(null);
    setIsCreateDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!teachingToDelete) return;
    try {
      await deleteDoc(doc(db, 'teachings', teachingToDelete.id));
      toast({
        title: 'Success',
        description: `Teaching "${teachingToDelete.title}" deleted.`,
      });
      setTeachingToDelete(null);
    } catch (error) {
      console.error('Error deleting teaching:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Could not delete the teaching.',
      });
    }
  };

  const handleRequestToJoin = async (teachingId: string) => {
    if (!user) return;
    try {
      const teachingRef = doc(db, 'teachings', teachingId);
      await updateDoc(teachingRef, {
        pendingRequests: arrayUnion(user.uid),
      });
      toast({
        title: 'Request Sent',
        description: 'Your request to join has been sent to the teacher.',
      });
    } catch (error) {
      console.error('Error requesting to join:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Could not send your join request.',
      });
    }
  };
  
    const handleManageRequests = (teaching: Teaching) => {
    setTeachingToManage(teaching);
    setIsRequestsDialogOpen(true);
  };

  const handleApproveRequest = async (teachingId: string, studentId: string) => {
    try {
      const teachingRef = doc(db, 'teachings', teachingId);
      await updateDoc(teachingRef, {
        pendingRequests: arrayRemove(studentId),
        members: arrayUnion(studentId),
      });
      toast({ title: 'Success', description: 'Student approved.' });
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'Could not approve student.' });
    }
  };
  
  const handleDenyRequest = async (teachingId: string, studentId: string) => {
    try {
      const teachingRef = doc(db, 'teachings', teachingId);
      await updateDoc(teachingRef, {
        pendingRequests: arrayRemove(studentId),
      });
      toast({ title: 'Success', description: 'Student denied.' });
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'Could not deny student.' });
    }
  };


  const renderTeachingCard = (teaching: Teaching, type: 'my' | 'enrolled' | 'public') => {
    const isMyTeaching = type === 'my';
    const isEnrolled = type === 'enrolled';
    const isPending = user ? teaching.pendingRequests.includes(user.uid) : false;

    return (
      <Card key={teaching.id}>
        <CardHeader>
          <CardTitle>{teaching.title}</CardTitle>
          <CardDescription>{teaching.description}</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Created by: {teaching.creatorName}
          </p>
          <p className="text-sm text-muted-foreground">
            Members: {teaching.members.length}
          </p>
        </CardContent>
        <CardFooter className="flex justify-between">
          {isMyTeaching ? (
            <>
              <Button
                variant="outline"
                onClick={() => handleManageRequests(teaching)}
              >
                <Users className="mr-2 h-4 w-4" /> Manage Requests (
                {teaching.pendingRequests.length})
              </Button>
              <div>
                <Button variant="ghost" size="icon" onClick={() => handleEdit(teaching)}>
                  <Edit className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setTeachingToDelete(teaching)}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </>
          ) : isEnrolled ? (
            <Button disabled>
              <Check className="mr-2 h-4 w-4" /> Enrolled
            </Button>
          ) : isPending ? (
             <Button disabled>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Pending Approval
            </Button>
          ): (
            <Button onClick={() => handleRequestToJoin(teaching.id)}>
              <LogIn className="mr-2 h-4 w-4" /> Request to Join
            </Button>
          )}
        </CardFooter>
      </Card>
    );
  };
  
    const renderSkeleton = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {[...Array(3)].map((_, i) => (
        <Card key={i}>
          <CardHeader>
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-4 w-full mt-2" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-4 w-1/3 mt-2" />
          </CardContent>
          <CardFooter>
            <Skeleton className="h-10 w-24" />
          </CardFooter>
        </Card>
      ))}
    </div>
  );

  return (
    <div className="container mx-auto p-4 md:p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Teachings</h1>
        <Button onClick={handleCreateNew}>
          <PlusCircle className="mr-2 h-4 w-4" /> Create New
        </Button>
      </div>

      <Dialog
        open={isCreateDialogOpen}
        onOpenChange={(isOpen) => {
          if (!isOpen) setTeachingToEdit(null);
          setIsCreateDialogOpen(isOpen);
        }}
      >
        <DialogContent>
          <CreateTeachingDialogContent
            onSuccess={() => setIsCreateDialogOpen(false)}
            teachingToEdit={teachingToEdit}
          />
        </DialogContent>
      </Dialog>
      
       <Dialog
        open={isRequestsDialogOpen}
        onOpenChange={setIsRequestsDialogOpen}
      >
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
                             <Avatar>
                                <AvatarImage src={`https://placehold.co/40x40.png?text=${studentId.substring(0,1)}`} data-ai-hint="avatar user"/>
                                <AvatarFallback>{studentId.substring(0, 1)}</AvatarFallback>
                             </Avatar>
                             <span className="text-sm font-mono truncate" title={studentId}>...{studentId.slice(-6)}</span>
                           </div>
                           <div className="flex gap-1">
                               <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => handleApproveRequest(teachingToManage.id, studentId)}><Check className="h-4 w-4 text-green-500"/></Button>
                               <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => handleDenyRequest(teachingToManage.id, studentId)}><X className="h-4 w-4 text-red-500"/></Button>
                           </div>
                        </div>
                    )) : (
                        <p className="text-sm text-center text-muted-foreground py-8">No pending requests.</p>
                    )}
                </div>
            </ScrollArea>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!teachingToDelete}
        onOpenChange={(isOpen) => !isOpen && setTeachingToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the teaching &quot;
              {teachingToDelete?.title}&quot;. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Tabs defaultValue="my-classes" className="w-full">
        <TabsList>
          <TabsTrigger value="my-classes">
            <School className="mr-2 h-4 w-4" /> My Classes
          </TabsTrigger>
          <TabsTrigger value="enrolled">
            <BookOpen className="mr-2 h-4 w-4" /> Enrolled
          </TabsTrigger>
          <TabsTrigger value="discover">
            <Eye className="mr-2 h-4 w-4" /> Discover
          </TabsTrigger>
        </TabsList>
        <TabsContent value="my-classes" className="mt-4">
          {isLoading ? renderSkeleton() : (
            myTeachings.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {myTeachings.map((t) => renderTeachingCard(t, 'my'))}
                </div>
              ) : (
                <p>You haven&apos;t created any teachings yet.</p>
              )
          )}
        </TabsContent>
        <TabsContent value="enrolled" className="mt-4">
          {isLoading ? renderSkeleton() : (
             enrolledTeachings.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {enrolledTeachings.map((t) => renderTeachingCard(t, 'enrolled'))}
                </div>
              ) : (
                <p>You are not enrolled in any teachings.</p>
              )
          )}
        </TabsContent>
        <TabsContent value="discover" className="mt-4">
           {isLoading ? renderSkeleton() : (
             publicTeachings.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {publicTeachings.map((t) => renderTeachingCard(t, 'public'))}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <Card>
                    <CardHeader>
                      <CardTitle>Sample Class: Physics 101</CardTitle>
                      <CardDescription>An introduction to classical mechanics and electromagnetism.</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground">
                        Created by: Dr. Evelyn Reed
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Members: 24
                      </p>
                    </CardContent>
                    <CardFooter className="flex justify-between">
                      <Button onClick={() => toast({ title: "Sample Action", description: "This is just a placeholder card." })}>
                        <LogIn className="mr-2 h-4 w-4" /> Request to Join
                      </Button>
                    </CardFooter>
                  </Card>
                   <Card className="opacity-50">
                    <CardHeader>
                      <CardTitle>Placeholder Class</CardTitle>
                      <CardDescription>This is a disabled example of another class.</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground">
                        Created by: A Teacher
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Members: 15
                      </p>
                    </CardContent>
                    <CardFooter className="flex justify-between">
                      <Button disabled>
                        <LogIn className="mr-2 h-4 w-4" /> Request to Join
                      </Button>
                    </CardFooter>
                  </Card>
                </div>
              )
           )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
