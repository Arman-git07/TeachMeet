
// src/app/dashboard/classes/page.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogTrigger, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { PlusCircle, Users as UsersIcon, Edit, ArrowRight, UploadCloud, Loader2, Save, CheckCircle, Filter, ChevronDown, MoreVertical, UserCheck } from "lucide-react";
import Image from "next/image";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from '@/hooks/useAuth';
import { db, storage } from '@/lib/firebase'; // Import db
import { ref as storageRef, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { collection, addDoc, query, where, getDocs, doc, setDoc, serverTimestamp, orderBy, getDoc, deleteDoc, updateDoc } from 'firebase/firestore'; // Firestore imports
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import dynamic from 'next/dynamic';

// Dynamically import StartMeetingDialogContent
const StartMeetingDialogContent = dynamic(() =>
  import('@/components/meeting/StartMeetingDialogContent').then(mod => mod.StartMeetingDialogContent),
  {
    ssr: false,
    loading: () => <p className="p-4 text-center">Loading dialog...</p>
  }
);

const MAX_IMAGE_SIZE_MB = 5;
const MAX_IMAGE_SIZE_BYTES = MAX_IMAGE_SIZE_MB * 1024 * 1024;

interface Classroom {
  id: string;
  name: string;
  teacherName: string;
  teacherId: string;
  teacherAvatar?: string;
  description: string;
  memberCount: number;
  thumbnailUrl: string;
  dataAiHint?: string;
  createdAt: any; // Firestore Timestamp or Date
  joinRequests?: { [userId: string]: boolean }; // For client-side checking after fetch
  members?: { [userId: string]: { role: 'student' | 'teacher' } }; 
}


const getInitialsFromName = (name: string, defaultInitial: string = 'P'): string => {
  if (!name || typeof name !== 'string') return defaultInitial;
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return defaultInitial;

  if (words.length === 1) {
    return words[0].substring(0, 2).toUpperCase() || defaultInitial;
  } else {
    const firstInitial = words[0][0];
    const lastInitial = words[words.length - 1][0];
    return (firstInitial + lastInitial).toUpperCase();
  }
};

const filterOptionsConfig = [
    { value: "all", label: "Explore All Classes", icon: Filter },
    { value: "teaching", label: "My Teaching", icon: UsersIcon, requiresAuth: true },
    { value: "joined", label: "My Joined Classes", icon: UsersIcon },
    { value: "requested", label: "My Requests", icon: UserCheck },
];


export default function ClassesPage() {
  const { toast } = useToast();
  const { user, loading: authLoading, isAuthenticated } = useAuth();
  const router = useRouter();
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  
  const [displayClassrooms, setDisplayClassrooms] = useState<Classroom[]>([]);

  const [activeFilter, setActiveFilter] = useState<string>("all");
  const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false);

  const [initialLoading, setInitialLoading] = useState(true);

  const [isCreateClassDialogOpen, setIsCreateClassDialogOpen] = useState(false);
  const [newClassName, setNewClassName] = useState('');
  const [newClassDescription, setNewClassDescription] = useState('');
  const [newClassImageFile, setNewClassImageFile] = useState<File | null>(null);
  const [newClassImagePreview, setNewClassImagePreview] = useState<string | null>(null);
  const [isUploadingOrCreating, setIsUploadingOrCreating] = useState(false);

  const currentFilterOptions = filterOptionsConfig.filter(opt => !opt.requiresAuth || isAuthenticated);

  useEffect(() => {
    const fetchClassrooms = async () => {
      if (authLoading) return; 
      setInitialLoading(true);
      try {
        let q;
        if (activeFilter === 'teaching' && user) {
          q = query(collection(db, "classrooms"), where("teacherId", "==", user.uid), orderBy("createdAt", "desc"));
        } else {
          q = query(collection(db, "classrooms"), orderBy("createdAt", "desc"));
        }
        
        const querySnapshot = await getDocs(q);
        const fetchedClassroomsPromises = querySnapshot.docs.map(async (docSnap) => {
          const data = docSnap.data();
          const classroomData: Classroom = {
            id: docSnap.id,
            name: data.name,
            teacherName: data.teacherName,
            teacherId: data.teacherId,
            teacherAvatar: data.teacherAvatar,
            description: data.description,
            memberCount: data.memberCount || 0,
            thumbnailUrl: data.thumbnailUrl,
            dataAiHint: data.dataAiHint,
            createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt),
            joinRequests: {},
            members: {}, 
          };

          if (user) {
            const joinRequestRef = doc(db, "classrooms", docSnap.id, "joinRequests", user.uid);
            const joinRequestSnap = await getDoc(joinRequestRef);
            if (joinRequestSnap.exists()) {
              classroomData.joinRequests![user.uid] = true;
            }

            const memberRef = doc(db, "classrooms", docSnap.id, "members", user.uid);
            const memberSnap = await getDoc(memberRef);
            if (memberSnap.exists()) {
              classroomData.members![user.uid] = { role: memberSnap.data()?.role || 'student' };
            }
          }
          return classroomData;
        });
        const fetchedClassrooms = await Promise.all(fetchedClassroomsPromises);
        setClassrooms(fetchedClassrooms);
      } catch (error: any) {
        console.error("Error fetching classrooms: ", error);
        let desc = "Could not fetch classrooms.";
        if (error.code === 'permission-denied') {
          desc = "Permission denied fetching classrooms. Please check Firestore security rules.";
        }
        toast({ variant: "destructive", title: "Error", description: desc });
      } finally {
        setInitialLoading(false);
      }
    };
    fetchClassrooms();
  }, [user, authLoading, activeFilter, toast]);


  useEffect(() => {
    if (initialLoading || authLoading) {
      setDisplayClassrooms([]);
      return;
    }

    let filteredClassrooms = classrooms;

    if (activeFilter === 'requested' && user) {
      filteredClassrooms = classrooms.filter(cls => cls.joinRequests && cls.joinRequests![user.uid] && cls.teacherId !== user.uid);
    } else if (activeFilter === 'joined' && user) {
      filteredClassrooms = classrooms.filter(cls => cls.members && cls.members![user.uid] && cls.teacherId !== user.uid);
    }
    
    setDisplayClassrooms(filteredClassrooms);

  }, [classrooms, user, activeFilter, initialLoading, authLoading]);


  const handleImageFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > MAX_IMAGE_SIZE_BYTES) {
        toast({ variant: "destructive", title: "Image Too Large", description: `Please select an image smaller than ${MAX_IMAGE_SIZE_MB}MB.` });
        setNewClassImageFile(null);
        setNewClassImagePreview(null);
        if (event.target) event.target.value = "";
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setNewClassImageFile(file);
        setNewClassImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setNewClassImageFile(null);
      setNewClassImagePreview(null);
    }
  };

  const resetCreateClassDialog = () => {
    setNewClassName('');
    setNewClassDescription('');
    setNewClassImageFile(null);
    if (newClassImagePreview?.startsWith('blob:')) URL.revokeObjectURL(newClassImagePreview);
    setNewClassImagePreview(null);
    setIsUploadingOrCreating(false);
    setIsCreateClassDialogOpen(false);
  };

  const uploadImageToStorage = async (imageFile: File, userId: string): Promise<{ thumbnailUrl: string; dataAiHint?: string }> => {
    const imageFileName = `${Date.now()}_${imageFile.name.replace(/\s+/g, '_')}`;
    const imagePath = `class_thumbnails/${userId}/${imageFileName}`;
    const imageFileRef = storageRef(storage, imagePath);
    const toastId = `upload-class-image-${Date.now()}`;
    toast({
        id: toastId, title: "Uploading Class Image...",
        description: <div className="flex items-center"><UploadCloud className="mr-2 h-4 w-4 animate-pulse" /><span>Starting upload...</span></div>,
        duration: Infinity,
    });
    return new Promise((resolve, reject) => {
      const uploadTask = uploadBytesResumable(imageFileRef, imageFile);
      uploadTask.on('state_changed',
        (snapshot) => { /* Progress handling if needed */ },
        (error) => {
          toast.dismiss(toastId);
          let desc = `Could not upload. Error: ${error.message}`;
          if (error.code && error.code.includes('storage/unauthorized')) {
            desc = "Permission denied for image upload. Please check Firebase Storage security rules for 'class_thumbnails'.";
          }
          toast({ variant: "destructive", title: "Image Upload Failed", description: desc });
          reject(error);
        },
        async () => {
          try {
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
            toast.dismiss(toastId);
            toast({ title: "Image Uploaded!", description: `New image successfully uploaded.` });
            resolve({ thumbnailUrl: downloadURL, dataAiHint: undefined }); 
          } catch (getUrlError) {
             toast.dismiss(toastId);
             toast({ variant: "destructive", title: "Image URL Error", description: (getUrlError as Error).message });
             reject(getUrlError);
          }
        }
      );
    });
  };


  const handleCreateClass = async () => {
    if (!newClassName.trim() || !newClassDescription.trim()) {
      toast({ variant: "destructive", title: "Missing Information", description: "Please provide a class name and description." });
      return;
    }
    if (!user) {
      toast({ variant: "destructive", title: "Authentication Error", description: "You must be logged in to create a class." });
      return;
    }

    setIsUploadingOrCreating(true);
    let imageDetails: { thumbnailUrl: string; dataAiHint?: string };

    try {
      if (newClassImageFile) {
        imageDetails = await uploadImageToStorage(newClassImageFile, user.uid);
      } else {
        const classNameInitials = getInitialsFromName(newClassName.trim(), "C");
        imageDetails = {
          thumbnailUrl: `https://placehold.co/600x400.png?text=${classNameInitials}`,
          dataAiHint: "education general"
        };
      }

      const teacherInitials = getInitialsFromName(user.displayName || "User", "U");
      const teacherAvatarUrl = user.photoURL || `https://placehold.co/40x40.png?text=${teacherInitials}`;

      const newClassData = {
        name: newClassName.trim(),
        description: newClassDescription.trim(),
        teacherName: user.displayName || "Teacher",
        teacherId: user.uid,
        teacherAvatar: teacherAvatarUrl,
        memberCount: 1, 
        createdAt: serverTimestamp(),
        thumbnailUrl: imageDetails.thumbnailUrl,
        dataAiHint: imageDetails.dataAiHint,
      };

      const docRef = await addDoc(collection(db, "classrooms"), newClassData);
      
      const memberRef = doc(db, "classrooms", docRef.id, "members", user.uid);
      await setDoc(memberRef, {
        userId: user.uid,
        name: user.displayName || "Teacher",
        avatarUrl: teacherAvatarUrl,
        role: "teacher",
        joinedAt: serverTimestamp(),
      });
      
      const createdClass: Classroom = {
          ...newClassData,
          id: docRef.id,
          createdAt: new Date(), 
          members: { [user.uid]: { role: 'teacher'} }, 
      };
      setClassrooms(prev => [createdClass, ...prev].sort((a,b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0)));
      if (activeFilter === 'all' || activeFilter === 'teaching') {
        setDisplayClassrooms(prev => [createdClass, ...prev].sort((a,b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0)));
      }

      toast({ title: "Class Created!", description: `"${newClassName.trim()}" has been successfully created.` });
      resetCreateClassDialog();
    } catch (error: any) {
      console.error("Error creating class:", error);
      let desc = (error as Error).message;
      if (error.code === 'permission-denied') {
        desc = "Permission denied creating class or adding member. Check Firestore security rules for 'classrooms' and 'classrooms/{classId}/members'.";
      }
      toast({ variant: "destructive", title: "Creation Failed", description: desc });
      setIsUploadingOrCreating(false);
    }
  };

  const handleRequestToJoin = async (classId: string, className: string) => {
    if (!user) {
      toast({ variant: "destructive", title: "Authentication Required", description: "Please sign in to request to join a class." });
      return;
    }
    
    const classToUpdate = classrooms.find(c => c.id === classId);
    if (classToUpdate?.members && classToUpdate.members[user.uid]) {
        toast({ title: "Already a Member", description: `You are already a member of "${className}".`});
        return;
    }
    if (classToUpdate?.joinRequests && classToUpdate.joinRequests[user.uid]) {
        toast({ title: "Request Already Sent", description: `You have already requested to join "${className}".` });
        return;
    }

    try {
      const requestRef = doc(db, "classrooms", classId, "joinRequests", user.uid);
      await setDoc(requestRef, {
        userId: user.uid,
        userName: user.displayName || user.email,
        userAvatar: user.photoURL,
        requestedAt: serverTimestamp(),
      });

      setClassrooms(prev => prev.map(cls => 
        cls.id === classId ? { ...cls, joinRequests: { ...cls.joinRequests, [user.uid]: true } } : cls
      ));
      
      toast({ title: "Request Sent!", description: `Your request to join "${className}" has been sent.` });
    } catch (error: any) {
      console.error("Error sending join request:", error);
      let desc = (error as Error).message;
      if (error.code === 'permission-denied') {
        desc = "Permission denied sending join request. Check Firestore security rules for 'classrooms/{classId}/joinRequests'.";
      }
      toast({ variant: "destructive", title: "Request Failed", description: desc });
    }
  };


  const handleNavigateToEditClass = (classToEdit: Classroom) => {
    router.push(`/dashboard/class/${classToEdit.id}/edit?name=${encodeURIComponent(classToEdit.name)}`);
  };

  const handleViewClass = (classId: string, className: string) => {
    router.push(`/dashboard/class/${classId}?name=${encodeURIComponent(className)}`);
  };

  useEffect(() => {
    return () => {
      if (newClassImagePreview && newClassImagePreview.startsWith('blob:')) {
        URL.revokeObjectURL(newClassImagePreview);
      }
    };
  }, [newClassImagePreview]);

  const activeFilterLabel = currentFilterOptions.find(opt => opt.value === activeFilter)?.label || "Explore All Classes";

  return (
    <div className="space-y-8 p-4 md:p-8 h-full flex flex-col">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Explore Classes</h1>
          <p className="text-muted-foreground">Discover classrooms or create your own.</p>
        </div>
        <div className="flex items-center gap-2">
            {isAuthenticated && (
                <Dialog open={isCreateClassDialogOpen} onOpenChange={(isOpen) => {
                    if (!isOpen) resetCreateClassDialog();
                    setIsCreateClassDialogOpen(isOpen);
                }}>
                <DialogTrigger asChild>
                    <Button className="btn-gel rounded-lg">
                    <PlusCircle className="mr-2 h-5 w-5" /> Create New Class
                    </Button>
                </DialogTrigger>
                {isCreateClassDialogOpen && (
                  <DialogContent className="sm:max-w-[520px] rounded-xl">
                    <DialogHeader>
                        <DialogTitle className="text-xl">Create New Classroom</DialogTitle>
                        <DialogDescription>
                          Fill in the details to set up your new class.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="grid gap-4 py-4 max-h-[70vh] overflow-y-auto px-1">
                        <div className="grid gap-2">
                          <Label htmlFor="newClassName">Class Name</Label>
                          <Input id="newClassName" value={newClassName} onChange={(e) => setNewClassName(e.target.value)} placeholder="e.g., Introduction to Algebra" className="rounded-lg" disabled={isUploadingOrCreating}/>
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="newClassDescription">Description</Label>
                          <Textarea id="newClassDescription" value={newClassDescription} onChange={(e) => setNewClassDescription(e.target.value)} placeholder="Provide a brief description of your class..." className="rounded-lg min-h-[100px]" disabled={isUploadingOrCreating}/>
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="newClassImage">Class Image (Optional, Max {MAX_IMAGE_SIZE_MB}MB)</Label>
                          <Input id="newClassImage" type="file" accept="image/*" onChange={handleImageFileChange} className="rounded-lg file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20" disabled={isUploadingOrCreating}/>
                          {newClassImagePreview && (
                            <div className="mt-2 relative w-full h-40 rounded-lg overflow-hidden border shadow-inner">
                              <Image src={newClassImagePreview} alt="New class image preview" layout="fill" objectFit="cover" data-ai-hint="education classroom" />
                            </div>
                          )}
                        </div>
                      </div>
                      <DialogFooter>
                        <DialogClose asChild><Button type="button" variant="outline" className="rounded-lg" onClick={resetCreateClassDialog} disabled={isUploadingOrCreating}>Cancel</Button></DialogClose>
                        <Button type="button" onClick={handleCreateClass} className="btn-gel rounded-lg" disabled={isUploadingOrCreating || !newClassName.trim()}>
                          {isUploadingOrCreating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                          {isUploadingOrCreating ? (newClassImageFile ? 'Uploading Image...' : 'Creating...') : 'Create Class'}
                        </Button>
                      </DialogFooter>
                  </DialogContent>
                )}
                </Dialog>
            )}
        </div>
      </div>

      <div className="my-4 flex items-center gap-2">
        <DropdownMenu open={isFilterDropdownOpen} onOpenChange={setIsFilterDropdownOpen}>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="rounded-lg text-sm">
              {activeFilterLabel}
              <ChevronDown className="ml-2 h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-60 rounded-xl">
            {currentFilterOptions.map(option => (
                (option.value !== 'teaching' || isAuthenticated) && 
                <DropdownMenuItem
                    key={option.value}
                    onClick={() => {
                        setActiveFilter(option.value);
                        setIsFilterDropdownOpen(false);
                    }}
                    className={cn(
                    "cursor-pointer rounded-md p-2 text-sm",
                    activeFilter === option.value && "bg-accent text-accent-foreground"
                    )}
                >
                    <option.icon className="mr-2 h-4 w-4 opacity-70" />
                    {option.label}
                </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {(initialLoading || authLoading ) ? (
         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 flex-grow overflow-y-auto pb-4">
          {[...Array(3)].map((_, i) => (
            <Card key={i} className="flex flex-col rounded-xl shadow-lg border-border/50">
              <Skeleton className="h-40 w-full rounded-t-xl" />
              <CardHeader className="pb-2 pt-4">
                <Skeleton className="h-5 w-3/4 mb-1 rounded-md" />
                <div className="flex items-center pt-1">
                  <Skeleton className="h-6 w-6 mr-2 rounded-full" />
                  <Skeleton className="h-4 w-1/2 rounded-md" />
                </div>
              </CardHeader>
              <CardContent className="flex-grow min-h-[60px]">
                <Skeleton className="h-4 w-full mb-1 rounded-md" />
                <Skeleton className="h-4 w-5/6 rounded-md" />
              </CardContent>
              <CardFooter className="border-t pt-3 flex flex-col items-stretch gap-2">
                <Skeleton className="h-9 w-full rounded-lg" />
                <Skeleton className="h-9 w-full rounded-lg" />
              </CardFooter>
            </Card>
          ))}
        </div>
      ) : displayClassrooms.length === 0 ? (
        <Card className="text-center py-12 rounded-xl shadow-lg border-border/50 flex-grow flex flex-col justify-center items-center">
          <CardHeader>
            <UsersIcon className="mx-auto h-16 w-16 text-muted-foreground mb-4" />
            <CardTitle className="text-2xl">
              {activeFilter === 'teaching' && "No Classes Taught"}
              {(activeFilter === 'requested' || activeFilter === 'joined') && "No Matching Classes"}
              {activeFilter === 'all' && classrooms.length > 0 && "No Classes for this Filter"}
              {activeFilter === 'all' && classrooms.length === 0 && "No Classes Available"}
            </CardTitle>
            <CardDescription>
              {activeFilter === 'teaching' && "You haven't created any classes yet. Start one now!"}
              {(activeFilter === 'requested' || activeFilter === 'joined') && `You haven't ${activeFilter === 'requested' ? 'requested to join' : 'joined'} any classes that match this filter, or your requests have been processed.`}
              {activeFilter === 'all' && classrooms.length > 0 && "Try a different filter or check back later."}
              {activeFilter === 'all' && classrooms.length === 0 && "There are no classes listed right now. Be the first to create one!"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {(activeFilter === 'all' || activeFilter === 'teaching') && classrooms.length === 0 && isAuthenticated && (
                 <Dialog open={isCreateClassDialogOpen} onOpenChange={(isOpen) => {
                  if (!isOpen) resetCreateClassDialog();
                  setIsCreateClassDialogOpen(isOpen);
                }}>
                  <DialogTrigger asChild>
                    <Button size="lg" className="btn-gel rounded-lg">
                      Create a Class
                    </Button>
                  </DialogTrigger>
                   {isCreateClassDialogOpen && (
                    <DialogContent className="sm:max-w-[520px] rounded-xl">
                        <DialogHeader><DialogTitle className="text-xl">Create New Classroom</DialogTitle><DialogDescription>Fill in the details to set up your new class.</DialogDescription></DialogHeader>
                        <div className="grid gap-4 py-4 max-h-[70vh] overflow-y-auto px-1">
                          <div className="grid gap-2"><Label htmlFor="newClassNameModal">Class Name</Label><Input id="newClassNameModal" value={newClassName} onChange={(e) => setNewClassName(e.target.value)} placeholder="e.g., Introduction to Algebra" className="rounded-lg" disabled={isUploadingOrCreating}/></div>
                          <div className="grid gap-2"><Label htmlFor="newClassDescriptionModal">Description</Label><Textarea id="newClassDescriptionModal" value={newClassDescription} onChange={(e) => setNewClassDescription(e.target.value)} placeholder="Provide a brief description of your class..." className="rounded-lg min-h-[100px]" disabled={isUploadingOrCreating}/></div>
                          <div className="grid gap-2"><Label htmlFor="newClassImageModal">Class Image (Optional, Max {MAX_IMAGE_SIZE_MB}MB)</Label><Input id="newClassImageModal" type="file" accept="image/*" onChange={handleImageFileChange} className="rounded-lg file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20" disabled={isUploadingOrCreating}/>
                            {newClassImagePreview && (<div className="mt-2 relative w-full h-40 rounded-lg overflow-hidden border shadow-inner"><Image src={newClassImagePreview} alt="New class image preview" layout="fill" objectFit="cover" data-ai-hint="education classroom"/></div>)}
                          </div>
                        </div>
                        <DialogFooter><DialogClose asChild><Button type="button" variant="outline" className="rounded-lg" onClick={resetCreateClassDialog} disabled={isUploadingOrCreating}>Cancel</Button></DialogClose><Button type="button" onClick={handleCreateClass} className="btn-gel rounded-lg" disabled={isUploadingOrCreating || !newClassName.trim()}>{isUploadingOrCreating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}{isUploadingOrCreating ? (newClassImageFile ? 'Uploading Image...' : 'Creating...') : 'Create Class'}</Button></DialogFooter>
                    </DialogContent>
                  )}
                </Dialog>
            )}
            {(activeFilter === 'requested' || activeFilter === 'joined') && (
                 <Button onClick={() => { setActiveFilter('all'); setIsFilterDropdownOpen(false); }} size="lg" variant="outline" className="rounded-lg">
                    Explore All Classes
                </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 flex-grow overflow-y-auto pb-4">
          {displayClassrooms.map(classroom => {
            const isTeacher = user && user.uid === classroom.teacherId;
            const isRequested = user && classroom.joinRequests && classroom.joinRequests[user.uid];
            const isMember = user && classroom.members && classroom.members[user.uid];
            
            const showPendingBadge = isRequested && !isMember && !isTeacher;
            const showJoinedBadge = isMember && !isTeacher;
            
            let actionButton;

            if (isTeacher) {
                actionButton = (
                    <Button onClick={() => handleNavigateToEditClass(classroom)} className="w-full btn-gel rounded-lg text-sm">
                        <Edit className="mr-2 h-4 w-4" /> Manage Class
                    </Button>
                );
            } else if (isMember) { 
                actionButton = (
                    <Button onClick={() => handleViewClass(classroom.id, classroom.name)} className="w-full btn-gel rounded-lg text-sm">
                         <ArrowRight className="mr-2 h-4 w-4" /> View Class
                    </Button>
                );
            } else if (isRequested) { 
                actionButton = (
                    <Button disabled className="w-full rounded-lg text-sm bg-green-600 hover:bg-green-700 text-white">
                        <CheckCircle className="mr-2 h-4 w-4" /> Request Sent
                    </Button>
                );
            } else { 
                actionButton = (
                    <Button onClick={() => handleRequestToJoin(classroom.id, classroom.name)} className="w-full btn-gel rounded-lg text-sm">
                         <ArrowRight className="mr-2 h-4 w-4" /> Request to Join
                    </Button>
                );
            }

            return (
            <Card key={classroom.id} className="flex flex-col rounded-xl shadow-lg hover:shadow-primary/20 transition-shadow duration-300 border-border/50 relative">
              <div className="relative h-40 w-full">
                 <Image
                    src={classroom.thumbnailUrl}
                    alt={classroom.name}
                    layout="fill"
                    objectFit="cover"
                    className="rounded-t-xl opacity-80 group-hover:opacity-100 transition-opacity"
                    data-ai-hint={classroom.thumbnailUrl.includes('placehold.co') && classroom.thumbnailUrl.includes('?text=') ? undefined : classroom.dataAiHint || "education classroom"}
                 />
                {showPendingBadge ? (
                    <Badge variant="outline" className="text-orange-600 border-orange-500/50 bg-orange-500/10 absolute top-2 right-2 text-xs px-2 py-0.5 rounded-md shadow-sm">
                    Pending Request
                    </Badge>
                ) : isTeacher ? (
                    <Badge variant="secondary" className="absolute top-2 right-2 text-xs px-2 py-0.5 rounded-md shadow-sm">
                    My Class
                    </Badge>
                ) : showJoinedBadge ? (
                     <Badge variant="default" className="bg-green-500/80 text-white absolute top-2 right-2 text-xs px-2 py-0.5 rounded-md shadow-sm">
                       Joined
                    </Badge>
                ) : null}
              </div>
              <CardHeader className="pb-2 pt-4">
                <CardTitle className="text-lg truncate leading-tight" title={classroom.name}>{classroom.name}</CardTitle>
                <div className="flex items-center pt-1">
                    <Avatar className="h-6 w-6 mr-2">
                        <AvatarImage src={classroom.teacherAvatar} alt={classroom.teacherName} data-ai-hint="teacher avatar"/>
                        <AvatarFallback>{getInitialsFromName(classroom.teacherName, "T")}</AvatarFallback>
                    </Avatar>
                    <CardDescription className="text-xs text-muted-foreground truncate">Taught by {classroom.teacherName}</CardDescription>
                </div>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground flex-grow min-h-[60px]">
                <p className="line-clamp-3">{classroom.description}</p>
              </CardContent>
              <CardFooter className="border-t pt-3 flex flex-col items-stretch gap-2">
                <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                    <span className="flex items-center"><UsersIcon className="mr-1.5 h-3.5 w-3.5" /> {classroom.memberCount} Members</span>
                    {classroom.createdAt && <span className="text-xs text-muted-foreground/80">{new Date(classroom.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>}
                </div>
                {actionButton}
                 <Button onClick={() => handleViewClass(classroom.id, classroom.name)} variant="outline" className="w-full rounded-lg text-sm">
                    View Details
                </Button>
              </CardFooter>
            </Card>
          );
        })}
        </div>
      )}
    </div>
  );
}
