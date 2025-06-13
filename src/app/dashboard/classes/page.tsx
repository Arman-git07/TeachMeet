
// src/app/dashboard/classes/page.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { PlusCircle, Users, Edit, ArrowRight, UploadCloud, Loader2, Save, CheckCircle, Filter, ChevronDown, MoreVertical } from "lucide-react";
import Image from "next/image";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from '@/hooks/useAuth';
import { storage } from '@/lib/firebase';
import { ref as storageRef, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { StartMeetingDialogContent } from "@/components/meeting/StartMeetingDialogContent";


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
  createdAt: Date;
}

const baseMockClassroomsData: Omit<Classroom, 'teacherName' | 'teacherId' | 'teacherAvatar' | 'createdAt' | 'memberCount'>[] = [
  { id: "cl1", name: "Introduction to Quantum Physics", description: "Explore the fascinating world of quantum mechanics, from wave-particle duality to quantum entanglement. Suitable for beginners with a curious mind.", thumbnailUrl: `https://placehold.co/600x400.png`, dataAiHint: "science education" },
  { id: "cl2", name: "Advanced JavaScript Techniques", description: "Deep dive into modern JavaScript patterns, performance optimization, and functional programming concepts. Prior JS knowledge recommended.", thumbnailUrl: `https://placehold.co/600x400.png`, dataAiHint: "programming code" },
  { id: "cl3", name: "Creative Writing Workshop", description: "Unleash your inner storyteller. This workshop focuses on weekly prompts, constructive peer reviews, and in-depth discussions on narrative craft.", thumbnailUrl: `https://placehold.co/600x400.png`, dataAiHint: "writing books" },
  { id: "cl4", name: "Beginner's Yoga & Mindfulness", description: "Learn foundational yoga poses and mindfulness techniques designed to reduce stress and improve overall well-being. No prior experience needed.", thumbnailUrl: `https://placehold.co/600x400.png`, dataAiHint: "yoga meditation" },
  { id: "cl5", name: "Data Science Bootcamp Prep", description: "A foundational course covering basic statistics, Python programming, and data visualization to prepare for a data science bootcamp.", thumbnailUrl: `https://placehold.co/600x400.png`, dataAiHint: "data science" },
  { id: "cl6", name: "The Art of Digital Painting", description: "From basic sketching to advanced rendering techniques, learn to create stunning digital artwork using popular software.", thumbnailUrl: `https://placehold.co/600x400.png`, dataAiHint: "digital art" },
];

const defaultTeacherDetailsMap: Record<string, { name: string; initial: string; placeholderId: string }> = {
  cl1: { name: "Dr. Evelyn Reed", initial: "ER", placeholderId: "teacher1_placeholder_uid" },
  cl2: { name: "Mr. Kenji Tanaka", initial: "KT", placeholderId: "teacher2_placeholder_uid" },
  cl3: { name: "Ms. Aisha Khan", initial: "AK", placeholderId: "teacher3_placeholder_uid" },
  cl4: { name: "Sara Chen", initial: "SC", placeholderId: "user1_placeholder_uid" }, 
  cl5: { name: "Dr. Ben Carter", initial: "BC", placeholderId: "teacher4_placeholder_uid" },
  cl6: { name: "Lena Petrova", initial: "LP", placeholderId: "teacher5_placeholder_uid" },
};


const MAX_IMAGE_SIZE_MB = 5;
const MAX_IMAGE_SIZE_BYTES = MAX_IMAGE_SIZE_MB * 1024 * 1024;
const REQUESTED_CLASSES_KEY = 'teachmeet-requested-classes';

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

const filterOptions = [
    { value: "all", label: "Explore All Classes" },
    { value: "teaching", label: "My Teaching" },
    { value: "joined", label: "My Joined Classes" },
    { value: "requested", label: "My Requests" },
];


export default function ClassesPage() {
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [requestedClassIds, setRequestedClassIds] = useState<string[]>([]);
  const [displayClassrooms, setDisplayClassrooms] = useState<Classroom[]>([]);
  
  const [activeFilter, setActiveFilter] = useState<string>("all");
  const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false); // Added for explicit dropdown control

  const [initialLoading, setInitialLoading] = useState(true);

  // Create Class Dialog State
  const [isCreateClassDialogOpen, setIsCreateClassDialogOpen] = useState(false);
  const [newClassName, setNewClassName] = useState('');
  const [newClassDescription, setNewClassDescription] = useState('');
  const [newClassImageFile, setNewClassImageFile] = useState<File | null>(null);
  const [newClassImagePreview, setNewClassImagePreview] = useState<string | null>(null);
  const [isUploadingClassImage, setIsUploadingClassImage] = useState(false);

  // Edit Class Dialog State
  const [isEditClassDialogOpen, setIsEditClassDialogOpen] = useState(false);
  const [editingClass, setEditingClass] = useState<Classroom | null>(null);
  const [editClassName, setEditClassName] = useState('');
  const [editClassDescription, setEditClassDescription] = useState('');
  const [editClassImageFile, setEditClassImageFile] = useState<File | null>(null);
  const [editClassImagePreview, setEditClassImagePreview] = useState<string | null>(null);
  const [isUploadingEditClassImage, setIsUploadingEditClassImage] = useState(false);

  useEffect(() => {
    const storedRequests = localStorage.getItem(REQUESTED_CLASSES_KEY);
    if (storedRequests) {
      try {
        const parsedRequests = JSON.parse(storedRequests);
        if (Array.isArray(parsedRequests)) {
          setRequestedClassIds(parsedRequests);
        }
      } catch (error) {
        console.error("Error parsing requested classes from localStorage:", error);
        localStorage.removeItem(REQUESTED_CLASSES_KEY);
      }
    }
  }, []);

  useEffect(() => {
    const processedMocks = baseMockClassroomsData.map((baseCls, index) => {
      let finalTeacherId: string;
      let finalTeacherName: string;
      let finalTeacherAvatar: string;
      
      const defaultDetails = defaultTeacherDetailsMap[baseCls.id as keyof typeof defaultTeacherDetailsMap] || { name: "Mock Teacher", initial: "M", placeholderId: `teacher_mock_${baseCls.id}`};

      if (baseCls.id === "cl1" && user && !authLoading) { 
        finalTeacherId = user.uid;
        finalTeacherName = user.displayName || "My Class Teacher";
        finalTeacherAvatar = user.photoURL || `https://placehold.co/40x40.png?text=${getInitialsFromName(finalTeacherName, "M")}`;
      } else {
        finalTeacherId = defaultDetails.placeholderId;
        finalTeacherName = defaultDetails.name;
        finalTeacherAvatar = `https://placehold.co/40x40.png?text=${defaultDetails.initial}`;
      }
      
      return {
        ...baseCls,
        teacherId: finalTeacherId,
        teacherName: finalTeacherName,
        teacherAvatar: finalTeacherAvatar,
        memberCount: Math.floor(Math.random() * 25) + 10,
        createdAt: new Date(Date.now() - (index + 1) * 1000 * 60 * 60 * 24 * (Math.floor(Math.random() * 60) + 1)), 
      };
    });
    setClassrooms(processedMocks);
    setInitialLoading(false);
  }, [user, authLoading]);


 useEffect(() => {
    if (authLoading || initialLoading) {
      setDisplayClassrooms([]);
      return;
    }

    let filteredList: Classroom[] = [];
    if (activeFilter === 'teaching') {
      filteredList = classrooms.filter(cls => user && cls.teacherId === user.uid);
    } else if (activeFilter === 'requested') {
      filteredList = classrooms.filter(cls => requestedClassIds.includes(cls.id));
    } else if (activeFilter === 'joined') {
      filteredList = classrooms.filter(cls => requestedClassIds.includes(cls.id) && (!user || cls.teacherId !== user.uid));
    } else { // 'all'
      filteredList = [...classrooms];
    }
    
    const pendingInFilter: Classroom[] = [];
    const nonPendingInFilter: Classroom[] = [];

    filteredList.forEach(cls => {
      if (requestedClassIds.includes(cls.id) && (activeFilter === 'all' || activeFilter === 'requested' || activeFilter === 'joined')) {
        pendingInFilter.push(cls);
      } else {
        nonPendingInFilter.push(cls);
      }
    });
    
    const sortByDateDesc = (a: Classroom, b: Classroom) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0);
    
    pendingInFilter.sort(sortByDateDesc);
    nonPendingInFilter.sort(sortByDateDesc);

    setDisplayClassrooms([...pendingInFilter, ...nonPendingInFilter]);

  }, [classrooms, user, requestedClassIds, authLoading, activeFilter, initialLoading]);


  const handleImageFileChange = (event: React.ChangeEvent<HTMLInputElement>, type: 'create' | 'edit') => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > MAX_IMAGE_SIZE_BYTES) {
        toast({ variant: "destructive", title: "Image Too Large", description: `Please select an image smaller than ${MAX_IMAGE_SIZE_MB}MB.` });
        if (type === 'create') {
          setNewClassImageFile(null);
          setNewClassImagePreview(null);
        } else {
          setEditClassImageFile(null);
          setEditClassImagePreview(editingClass?.thumbnailUrl || null);
        }
        event.target.value = "";
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        if (type === 'create') {
          setNewClassImageFile(file);
          setNewClassImagePreview(reader.result as string);
        } else {
          setEditClassImageFile(file);
          setEditClassImagePreview(reader.result as string);
        }
      };
      reader.readAsDataURL(file);
    } else {
      if (type === 'create') {
        setNewClassImageFile(null);
        setNewClassImagePreview(null);
      } else {
        setEditClassImageFile(null);
        setEditClassImagePreview(editingClass?.thumbnailUrl || null);
      }
    }
  };

  const resetCreateClassDialog = () => {
    setNewClassName('');
    setNewClassDescription('');
    setNewClassImageFile(null);
    if (newClassImagePreview?.startsWith('blob:')) URL.revokeObjectURL(newClassImagePreview);
    setNewClassImagePreview(null);
    setIsUploadingClassImage(false);
    setIsCreateClassDialogOpen(false);
  };

  const resetEditClassDialog = () => {
    setEditingClass(null);
    setEditClassName('');
    setEditClassDescription('');
    setEditClassImageFile(null);
    if (editClassImagePreview?.startsWith('blob:')) URL.revokeObjectURL(editClassImagePreview);
    setEditClassImagePreview(null);
    setIsUploadingEditClassImage(false);
    setIsEditClassDialogOpen(false);
  };

  const uploadImage = async (imageFile: File, userId: string, type: 'create' | 'edit'): Promise<{ thumbnailUrl: string; dataAiHint?: string }> => {
    setIsUploadingClassImage(type === 'create');
    setIsUploadingEditClassImage(type === 'edit');

    const imageFileName = `${Date.now()}_${imageFile.name.replace(/\s+/g, '_')}`;
    const imagePath = `class_thumbnails/${userId}/${imageFileName}`;
    const imageFileRef = storageRef(storage, imagePath);

    const toastId = `upload-class-image-${Date.now()}`;
    const toastTitle = type === 'create' ? "Uploading Class Image..." : "Uploading New Class Image...";

    toast({
        id: toastId,
        title: toastTitle,
        description: <div className="flex items-center"><UploadCloud className="mr-2 h-4 w-4 animate-pulse" /><span>Starting upload of {imageFile.name}. (0%)</span></div>,
        duration: Infinity,
    });

    return new Promise((resolve, reject) => {
      const uploadTask = uploadBytesResumable(imageFileRef, imageFile);
      uploadTask.on('state_changed',
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          toast({
            id: toastId,
            title: toastTitle,
            description: <div className="flex items-center"><UploadCloud className="mr-2 h-4 w-4 animate-pulse" /><span>Uploading {imageFile.name}. Please wait. ({Math.round(progress)}%)</span></div>,
            duration: Infinity,
          });
        },
        (error) => {
          console.error("Class Image Upload Error:", error);
          toast.dismiss(toastId);
          toast({ variant: "destructive", title: "Image Upload Failed", description: `Could not upload ${imageFile.name}. Please try again.` });
          reject(error);
        },
        async () => {
          try {
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
            toast.dismiss(toastId);
            toast({ title: "Image Uploaded!", description: `${imageFile.name} successfully uploaded.` });
            resolve({ thumbnailUrl: downloadURL, dataAiHint: undefined }); 
          } catch (getUrlError) {
             console.error("Error getting download URL for class image:", getUrlError);
             toast.dismiss(toastId);
             toast({ variant: "destructive", title: "Image URL Error", description: "Image uploaded, but could not get URL." });
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

    setIsUploadingClassImage(true); 
    
    let imageDetails: { thumbnailUrl: string; dataAiHint?: string };

    if (newClassImageFile) {
      try {
        imageDetails = await uploadImage(newClassImageFile, user.uid, 'create');
      } catch (error) {
        setIsUploadingClassImage(false);
        return; 
      }
    } else {
      const classNameInitials = getInitialsFromName(newClassName.trim(), "C");
      imageDetails = { 
        thumbnailUrl: `https://placehold.co/600x400.png?text=${classNameInitials}`, 
        dataAiHint: "education general" 
      };
    }

    const teacherInitials = getInitialsFromName(user.displayName || "User", "U");
    const teacherAvatarUrl = user.photoURL || `https://placehold.co/40x40.png?text=${teacherInitials}`;

    const newClass: Classroom = {
      id: `cl${Date.now()}`,
      name: newClassName.trim(),
      description: newClassDescription.trim(),
      teacherName: user.displayName || "Teacher",
      teacherId: user.uid,
      teacherAvatar: teacherAvatarUrl,
      memberCount: 1, 
      createdAt: new Date(),
      ...imageDetails, 
    };
    setClassrooms(prev => [newClass, ...prev].sort((a,b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0)));
    toast({
      title: "Class Created!",
      description: `"${newClassName.trim()}" has been successfully created.`,
    });

    resetCreateClassDialog(); 
  };

  const handleUpdateClass = async () => {
    if (!editingClass || !editClassName.trim() || !editClassDescription.trim()) {
      toast({ variant: "destructive", title: "Missing Information", description: "Please provide a class name and description." });
      return;
    }
    if (!user) {
      toast({ variant: "destructive", title: "Authentication Error", description: "You must be logged in to update a class." });
      return;
    }

    setIsUploadingEditClassImage(true);
    let imageDetails = { 
      thumbnailUrl: editingClass.thumbnailUrl, 
      dataAiHint: editingClass.dataAiHint 
    };

    if (editClassImageFile) {
      try {
        imageDetails = await uploadImage(editClassImageFile, user.uid, 'edit');
      } catch (error) {
        setIsUploadingEditClassImage(false);
        return;
      }
    } else if (editingClass.name !== editClassName.trim() && editingClass.thumbnailUrl.includes('placehold.co') && editingClass.thumbnailUrl.includes('?text=')) {
      const newClassNameInitials = getInitialsFromName(editClassName.trim(), "C");
      imageDetails = {
        thumbnailUrl: `https://placehold.co/600x400.png?text=${newClassNameInitials}`,
        dataAiHint: editingClass.dataAiHint 
      };
    }


    setClassrooms(prev => prev.map(cls =>
      cls.id === editingClass.id
        ? {
            ...cls,
            name: editClassName.trim(),
            description: editClassDescription.trim(),
            thumbnailUrl: imageDetails.thumbnailUrl,
            dataAiHint: imageDetails.dataAiHint,
          }
        : cls
    ));

    toast({
      title: "Class Updated!",
      description: `"${editClassName.trim()}" has been successfully updated.`,
    });

    resetEditClassDialog(); 
  };


  const handleRequestToJoin = (classId: string, className: string) => {
    if (requestedClassIds.includes(classId)) {
      toast({
        title: "Request Already Sent",
        description: `You have already requested to join "${className}".`,
      });
      return;
    }
    
    const newRequestedIds = [...requestedClassIds, classId];
    setRequestedClassIds(newRequestedIds);
    localStorage.setItem(REQUESTED_CLASSES_KEY, JSON.stringify(newRequestedIds));
    
    toast({
      title: "Request Sent!",
      description: `Your request to join "${className}" has been sent to the teacher.`,
    });
  };

  const handleOpenEditDialog = (classToEdit: Classroom) => {
    setEditingClass(classToEdit);
    setEditClassName(classToEdit.name);
    setEditClassDescription(classToEdit.description);
    setEditClassImagePreview(classToEdit.thumbnailUrl); 
    setEditClassImageFile(null); 
    setIsEditClassDialogOpen(true);
  };

  const handleViewClass = (classId: string, className: string) => {
    router.push(`/dashboard/class/${classId}?name=${encodeURIComponent(className)}`);
  };

  const handleManageMembers = (className: string) => {
    toast({
        title: "Manage Members (Mock)",
        description: `Member management for "${className}" is a planned feature.`,
    });
  };

  useEffect(() => {
    return () => {
      if (newClassImagePreview && newClassImagePreview.startsWith('blob:')) {
        URL.revokeObjectURL(newClassImagePreview);
      }
      if (editClassImagePreview && editClassImagePreview.startsWith('blob:')) {
        URL.revokeObjectURL(editClassImagePreview);
      }
    };
  }, [newClassImagePreview, editClassImagePreview]);

  const activeFilterLabel = filterOptions.find(opt => opt.value === activeFilter)?.label || "Explore All Classes";

  return (
    <div className="space-y-8 p-4 md:p-8 h-full flex flex-col">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Explore Classes</h1>
          <p className="text-muted-foreground">Discover classrooms or create your own.</p>
        </div>
        <div className="flex items-center gap-2">
             <Dialog open={isCreateClassDialogOpen} onOpenChange={(isOpen) => {
                if (!isOpen) resetCreateClassDialog();
                setIsCreateClassDialogOpen(isOpen);
            }}>
            <DialogTrigger asChild>
                <Button className="btn-gel rounded-lg">
                <PlusCircle className="mr-2 h-5 w-5" /> Create New Class
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[520px] rounded-xl">
               <StartMeetingDialogContent />
            </DialogContent>
            </Dialog>
        </div>
      </div>

      <div className="my-4">
        <DropdownMenu open={isFilterDropdownOpen} onOpenChange={setIsFilterDropdownOpen}>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="rounded-lg text-sm">
              {activeFilterLabel}
              <ChevronDown className="ml-2 h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56 rounded-xl">
            {filterOptions.map(option => (
              <DropdownMenuItem
                key={option.value}
                onClick={() => {
                    setActiveFilter(option.value);
                    setIsFilterDropdownOpen(false); // Close dropdown on selection
                }}
                className={cn(
                  "cursor-pointer rounded-md",
                  activeFilter === option.value && "bg-accent text-accent-foreground"
                )}
              >
                <Filter className="mr-2 h-4 w-4 opacity-70" />
                {option.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Dialog open={isEditClassDialogOpen} onOpenChange={(isOpen) => {
          if (!isOpen) resetEditClassDialog();
          setIsEditClassDialogOpen(isOpen);
      }}>
        <DialogContent className="sm:max-w-[520px] rounded-xl">
          <DialogHeader>
            <DialogTitle className="text-xl">Edit Classroom</DialogTitle>
            <DialogDescription>
              Update the details for your class: {editingClass?.name}.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4 max-h-[70vh] overflow-y-auto px-1">
            <div className="grid gap-2">
              <Label htmlFor="editClassName">Class Name</Label>
              <Input id="editClassName" value={editClassName} onChange={(e) => setEditClassName(e.target.value)} placeholder="e.g., Math 101" className="rounded-lg" disabled={isUploadingEditClassImage}/>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="editClassDescription">Description</Label>
              <Textarea id="editClassDescription" value={editClassDescription} onChange={(e) => setEditClassDescription(e.target.value)} placeholder="A brief overview of your class..." className="rounded-lg min-h-[100px]" disabled={isUploadingEditClassImage}/>
            </div>
             <div className="grid gap-2">
              <Label htmlFor="editClassImage">Class Image (Optional, Max {MAX_IMAGE_SIZE_MB}MB)</Label>
              <Input id="editClassImage" type="file" accept="image/*" onChange={(e) => handleImageFileChange(e, 'edit')} className="rounded-lg file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20" disabled={isUploadingEditClassImage}/>
              {editClassImagePreview && (
                <div className="mt-2 relative w-full h-40 rounded-lg overflow-hidden border shadow-inner">
                  <Image src={editClassImagePreview} alt="Class image preview" layout="fill" objectFit="cover" />
                </div>
              )}
            </div>
             <div className="grid gap-2 pt-2">
                <Button variant="outline" className="rounded-lg" onClick={() => handleManageMembers(editingClass?.name || 'this class')} disabled={isUploadingEditClassImage}>
                    <Users className="mr-2 h-4 w-4" /> Manage Members (Mock)
                </Button>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" className="rounded-lg" disabled={isUploadingEditClassImage}>Cancel</Button>
            </DialogClose>
            <Button type="button" onClick={handleUpdateClass} className="btn-gel rounded-lg" disabled={isUploadingEditClassImage || !editClassName.trim()}>
              {isUploadingEditClassImage ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              {isUploadingEditClassImage ? (editClassImageFile ? 'Uploading Image...' : 'Saving...') : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {initialLoading || authLoading ? ( 
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
            <Users className="mx-auto h-16 w-16 text-muted-foreground mb-4" />
            <CardTitle className="text-2xl">
              {activeFilter === 'teaching' && "No Classes Taught"}
              {activeFilter === 'requested' && "No Pending Requests"}
              {activeFilter === 'joined' && "No Joined Classes"}
              {activeFilter === 'all' && "No Classes Available"}
            </CardTitle>
            <CardDescription>
              {activeFilter === 'teaching' && "You haven't created any classes yet. Start one now!"}
              {activeFilter === 'requested' && "You haven't requested to join any classes, or your requests have been processed."}
              {activeFilter === 'joined' && "You haven't joined any classes yet. Explore and send requests!"}
              {activeFilter === 'all' && "There are no classes listed right now. Be the first to create one!"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {(activeFilter === 'all' || activeFilter === 'teaching') && (
                <Button onClick={() => setIsCreateClassDialogOpen(true)} size="lg" className="btn-gel rounded-lg">
                Create a Class
                </Button>
            )}
            {(activeFilter === 'requested' || activeFilter === 'joined') && (
                 <Button onClick={() => setActiveFilter('all')} size="lg" variant="outline" className="rounded-lg">
                    View All Classes
                </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 flex-grow overflow-y-auto pb-4">
          {displayClassrooms.map(classroom => (
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
                {requestedClassIds.includes(classroom.id) ? (
                    <Badge variant="outline" className="text-orange-600 border-orange-500/50 bg-orange-500/10 absolute top-2 right-2 text-xs px-2 py-0.5 rounded-md shadow-sm">
                    Pending Request
                    </Badge>
                ) : user && user.uid === classroom.teacherId ? (
                    <Badge variant="secondary" className="absolute top-2 right-2 text-xs px-2 py-0.5 rounded-md shadow-sm">
                    My Class
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
                    <span className="flex items-center"><Users className="mr-1.5 h-3.5 w-3.5" /> {classroom.memberCount} Members</span>
                    {classroom.createdAt && <span className="text-xs text-muted-foreground/80">{classroom.createdAt.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>}
                </div>
                {user && user.uid === classroom.teacherId ? (
                    <Button onClick={() => handleOpenEditDialog(classroom)} className="w-full btn-gel rounded-lg text-sm">
                        <Edit className="mr-2 h-4 w-4" /> Manage Class
                    </Button>
                ) : (
                  requestedClassIds.includes(classroom.id) ? (
                    <Button disabled className="w-full rounded-lg text-sm bg-green-600 hover:bg-green-700 text-white">
                        <CheckCircle className="mr-2 h-4 w-4" /> Request Sent
                    </Button>
                  ) : (
                    <Button onClick={() => handleRequestToJoin(classroom.id, classroom.name)} className="w-full btn-gel rounded-lg text-sm">
                         <ArrowRight className="mr-2 h-4 w-4" /> Request to Join
                    </Button>
                  )
                )}
                 <Button onClick={() => handleViewClass(classroom.id, classroom.name)} variant="outline" className="w-full rounded-lg text-sm">
                    View Details
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
    

    