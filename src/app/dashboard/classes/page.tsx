
// src/app/dashboard/classes/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { PlusCircle, Users, Eye, Lock, Edit, ArrowRight, UploadCloud, Loader2 } from "lucide-react";
import Image from "next/image";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from '@/hooks/useAuth';
import { Badge } from '@/components/ui/badge';
import { storage } from '@/lib/firebase'; // Import Firebase storage
import { ref as storageRef, uploadBytesResumable, getDownloadURL } from "firebase/storage";

interface Classroom {
  id: string;
  name: string;
  teacherName: string;
  teacherId: string;
  teacherAvatar?: string;
  description: string;
  memberCount: number;
  thumbnailUrl: string; // Can be custom upload URL or placeholder
  isPublic: boolean;
  dataAiHint?: string; // Relevant if thumbnailUrl is a placeholder
}

const initialMockClassrooms: Classroom[] = [
  { id: "cl1", name: "Introduction to Quantum Physics", teacherName: "Dr. Evelyn Reed", teacherId: "teacher1_placeholder_uid", teacherAvatar: `https://placehold.co/40x40.png?text=ER`, description: "Explore the fascinating world of quantum mechanics, from wave-particle duality to quantum entanglement. Suitable for beginners with a curious mind.", memberCount: 25, thumbnailUrl: `https://placehold.co/600x400.png`, isPublic: true, dataAiHint: "science education" },
  { id: "cl2", name: "Advanced JavaScript Techniques", teacherName: "Mr. Kenji Tanaka", teacherId: "teacher2_placeholder_uid", teacherAvatar: `https://placehold.co/40x40.png?text=KT`, description: "Deep dive into modern JavaScript patterns, performance optimization, and functional programming concepts. Prior JS knowledge recommended.", memberCount: 18, thumbnailUrl: `https://placehold.co/600x400.png`, isPublic: true, dataAiHint: "programming code" },
  { id: "cl3", name: "Creative Writing Workshop", teacherName: "Ms. Aisha Khan", teacherId: "teacher3_placeholder_uid", teacherAvatar: `https://placehold.co/40x40.png?text=AK`, description: "Unleash your inner storyteller. This workshop focuses on weekly prompts, constructive peer reviews, and in-depth discussions on narrative craft.", memberCount: 12, thumbnailUrl: `https://placehold.co/600x400.png`, isPublic: true, dataAiHint: "writing books" },
  { id: "cl4", name: "Beginner's Yoga & Mindfulness", teacherName: "Sara Chen", teacherId: "user1_placeholder_uid", teacherAvatar: `https://placehold.co/40x40.png?text=SC`, description: "Learn foundational yoga poses and mindfulness techniques designed to reduce stress and improve overall well-being. No prior experience needed.", memberCount: 30, thumbnailUrl: `https://placehold.co/600x400.png`, isPublic: false, dataAiHint: "yoga meditation" },
];

const MAX_IMAGE_SIZE_MB = 5;
const MAX_IMAGE_SIZE_BYTES = MAX_IMAGE_SIZE_MB * 1024 * 1024;

export default function ClassesPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [classrooms, setClassrooms] = useState<Classroom[]>(initialMockClassrooms);
  const [isCreateClassDialogOpen, setIsCreateClassDialogOpen] = useState(false);

  const [newClassName, setNewClassName] = useState('');
  const [newClassDescription, setNewClassDescription] = useState('');
  const [newClassIsPublic, setNewClassIsPublic] = useState(true);
  const [newClassImageFile, setNewClassImageFile] = useState<File | null>(null);
  const [newClassImagePreview, setNewClassImagePreview] = useState<string | null>(null);
  const [isUploadingClassImage, setIsUploadingClassImage] = useState(false);

  const handleImageFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > MAX_IMAGE_SIZE_BYTES) {
        toast({ variant: "destructive", title: "Image Too Large", description: `Please select an image smaller than ${MAX_IMAGE_SIZE_MB}MB.` });
        setNewClassImageFile(null);
        setNewClassImagePreview(null);
        event.target.value = ""; // Clear the input
        return;
      }
      setNewClassImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
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
    setNewClassIsPublic(true);
    setNewClassImageFile(null);
    setNewClassImagePreview(null);
    setIsUploadingClassImage(false);
    setIsCreateClassDialogOpen(false);
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
    let thumbnailUrl = `https://placehold.co/600x400.png`;
    let dataAiHint: string | undefined = "education general";

    if (newClassImageFile) {
      const imageFileName = `${Date.now()}_${newClassImageFile.name.replace(/\s+/g, '_')}`;
      const imagePath = `class_thumbnails/${user.uid}/${imageFileName}`;
      const imageFileRef = storageRef(storage, imagePath);
      
      const uploadToastId = `upload-class-image-${Date.now()}`;
      toast({ 
          id: uploadToastId,
          title: "Uploading Class Image...",
          description: <div className="flex items-center"><UploadCloud className="mr-2 h-4 w-4 animate-pulse" /><span>Starting upload of {newClassImageFile.name}. (0%)</span></div>,
          duration: Infinity, 
      });

      try {
        const uploadTask = uploadBytesResumable(imageFileRef, newClassImageFile);
        await new Promise<void>((resolve, reject) => {
          uploadTask.on('state_changed',
            (snapshot) => {
              const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
              toast({
                id: uploadToastId,
                title: "Uploading Class Image...",
                description: <div className="flex items-center"><UploadCloud className="mr-2 h-4 w-4 animate-pulse" /><span>Uploading {newClassImageFile.name}. Please wait. ({Math.round(progress)}%)</span></div>,
                duration: Infinity,
              });
            },
            (error) => {
              console.error("Class Image Upload Error:", error);
              toast.dismiss(uploadToastId);
              toast({ variant: "destructive", title: "Image Upload Failed", description: `Could not upload ${newClassImageFile.name}. Please try again.` });
              setIsUploadingClassImage(false);
              reject(error);
            },
            async () => {
              try {
                const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                thumbnailUrl = downloadURL;
                dataAiHint = undefined; // No AI hint for custom images
                toast.dismiss(uploadToastId);
                toast({ title: "Image Uploaded!", description: `${newClassImageFile.name} successfully uploaded.` });
                resolve();
              } catch (getUrlError) {
                 console.error("Error getting download URL for class image:", getUrlError);
                 toast.dismiss(uploadToastId);
                 toast({ variant: "destructive", title: "Image URL Error", description: "Image uploaded, but could not get URL." });
                 setIsUploadingClassImage(false);
                 reject(getUrlError);
              }
            }
          );
        });
      } catch (error) {
        // Upload or URL retrieval failed, bail out
        setIsUploadingClassImage(false);
        return; 
      }
    }

    const newClass: Classroom = {
      id: `cl${Date.now()}`,
      name: newClassName,
      description: newClassDescription,
      teacherName: user.displayName || "Teacher",
      teacherId: user.uid,
      teacherAvatar: user.photoURL || `https://placehold.co/40x40.png?text=${(user.displayName || "T").charAt(0)}`,
      memberCount: 1,
      isPublic: newClassIsPublic,
      thumbnailUrl: thumbnailUrl,
      dataAiHint: dataAiHint,
    };
    setClassrooms(prev => [newClass, ...prev]);
    toast({
      title: "Class Created!",
      description: `"${newClassName}" has been successfully created.`,
    });
    
    resetCreateClassDialog();
  };

  const handleRequestToJoin = (className: string) => {
    toast({
      title: "Request Sent (Mock)",
      description: `Your request to join "${className}" has been sent to the teacher.`,
    });
  };

  const handleManageClass = (classId: string) => {
    toast({
      title: "Manage Class (Mock)",
      description: `Navigating to management for class ID: ${classId}. This feature is in development.`,
    });
  };
  
  const handleViewClass = (classId: string) => {
    toast({
        title: "View Class (Mock)",
        description: `Navigating to view class ID: ${classId}. This feature is in development.`,
    });
  };

  const visibleClassrooms = classrooms.filter(c => c.isPublic || (user && c.teacherId === user.uid));

  // Clean up preview URL when dialog closes or component unmounts
  useEffect(() => {
    return () => {
      if (newClassImagePreview && newClassImagePreview.startsWith('blob:')) {
        URL.revokeObjectURL(newClassImagePreview);
      }
    };
  }, [newClassImagePreview]);


  return (
    <div className="space-y-8 p-4 md:p-8 h-full flex flex-col">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Explore Classes</h1>
          <p className="text-muted-foreground">Discover classrooms or create your own.</p>
        </div>
        <Dialog open={isCreateClassDialogOpen} onOpenChange={(isOpen) => {
            if (!isOpen) { // If dialog is closing
                resetCreateClassDialog(); // Reset fields only when closing explicitly
            }
            setIsCreateClassDialogOpen(isOpen);
        }}>
          <DialogTrigger asChild>
            <Button className="btn-gel rounded-lg">
              <PlusCircle className="mr-2 h-5 w-5" /> Create New Class
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[520px] rounded-xl">
            <DialogHeader>
              <DialogTitle className="text-xl">Create a New Classroom</DialogTitle>
              <DialogDescription>
                Fill in the details below to set up your new class.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4 max-h-[70vh] overflow-y-auto px-1">
              <div className="grid gap-2">
                <Label htmlFor="className">Class Name</Label>
                <Input id="className" value={newClassName} onChange={(e) => setNewClassName(e.target.value)} placeholder="e.g., Math 101" className="rounded-lg" disabled={isUploadingClassImage}/>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="classDescription">Description</Label>
                <Textarea id="classDescription" value={newClassDescription} onChange={(e) => setNewClassDescription(e.target.value)} placeholder="A brief overview of your class..." className="rounded-lg min-h-[100px]" disabled={isUploadingClassImage}/>
              </div>
               <div className="grid gap-2">
                <Label htmlFor="classImage">Class Image (Optional, Max 5MB)</Label>
                <Input id="classImage" type="file" accept="image/*" onChange={handleImageFileChange} className="rounded-lg file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20" disabled={isUploadingClassImage}/>
                {newClassImagePreview && (
                  <div className="mt-2 relative w-full h-40 rounded-lg overflow-hidden border shadow-inner">
                    <Image src={newClassImagePreview} alt="Selected class image preview" layout="fill" objectFit="cover" />
                  </div>
                )}
              </div>
              <div className="flex items-center justify-between space-x-2 pt-2">
                <Label htmlFor="classIsPublic" className="flex flex-col space-y-1">
                  <span>Publicly Listed</span>
                  <span className="font-normal leading-snug text-muted-foreground text-xs">
                    Allow anyone to see this class in the list. Joining may still require approval.
                  </span>
                </Label>
                <Switch
                  id="classIsPublic"
                  checked={newClassIsPublic}
                  onCheckedChange={setNewClassIsPublic}
                  disabled={isUploadingClassImage}
                />
              </div>
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline" className="rounded-lg" disabled={isUploadingClassImage}>Cancel</Button>
              </DialogClose>
              <Button type="button" onClick={handleCreateClass} className="btn-gel rounded-lg" disabled={isUploadingClassImage}>
                {isUploadingClassImage ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {isUploadingClassImage ? (newClassImageFile ? 'Uploading Image...' : 'Creating...') : 'Create Class'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {visibleClassrooms.length === 0 ? (
        <Card className="text-center py-12 rounded-xl shadow-lg border-border/50 flex-grow flex flex-col justify-center items-center">
          <CardHeader>
            <Users className="mx-auto h-16 w-16 text-muted-foreground mb-4" />
            <CardTitle className="text-2xl">No Classes Available</CardTitle>
            <CardDescription>There are no public classes listed right now, or you haven't created any.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => setIsCreateClassDialogOpen(true)} size="lg" className="btn-gel rounded-lg">
              Be the First to Create a Class!
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 flex-grow overflow-y-auto pb-4">
          {visibleClassrooms.map(classroom => (
            <Card key={classroom.id} className="flex flex-col rounded-xl shadow-lg hover:shadow-primary/20 transition-shadow duration-300 border-border/50">
              <div className="relative h-40 w-full">
                 <Image
                    src={classroom.thumbnailUrl} // Directly use thumbnailUrl
                    alt={classroom.name}
                    layout="fill"
                    objectFit="cover"
                    className="rounded-t-xl opacity-80 group-hover:opacity-100 transition-opacity"
                    data-ai-hint={classroom.thumbnailUrl.includes('placehold.co') ? classroom.dataAiHint || "education classroom" : undefined}
                 />
                 <div className="absolute top-2 right-2">
                    {classroom.isPublic ? (
                        <Badge variant="secondary" className="bg-accent/80 text-accent-foreground backdrop-blur-sm rounded-full text-xs">
                            <Eye className="mr-1.5 h-3 w-3" /> Public
                        </Badge>
                    ) : (
                        <Badge variant="default" className="bg-primary/80 text-primary-foreground backdrop-blur-sm rounded-full text-xs">
                            <Lock className="mr-1.5 h-3 w-3" /> Private
                        </Badge>
                    )}
                 </div>
              </div>
              <CardHeader className="pb-2 pt-4">
                <CardTitle className="text-lg truncate leading-tight" title={classroom.name}>{classroom.name}</CardTitle>
                <div className="flex items-center pt-1">
                    <Avatar className="h-6 w-6 mr-2">
                        <AvatarImage src={classroom.teacherAvatar} alt={classroom.teacherName} data-ai-hint="teacher avatar"/>
                        <AvatarFallback>{classroom.teacherName.charAt(0)}</AvatarFallback>
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
                </div>
                {user && user.uid === classroom.teacherId ? (
                    <Button onClick={() => handleManageClass(classroom.id)} className="w-full btn-gel rounded-lg text-sm">
                        <Edit className="mr-2 h-4 w-4" /> Manage Class
                    </Button>
                ) : (
                    <Button onClick={() => handleRequestToJoin(classroom.name)} className="w-full btn-gel rounded-lg text-sm">
                         <ArrowRight className="mr-2 h-4 w-4" /> Request to Join
                    </Button>
                )}
                 <Button onClick={() => handleViewClass(classroom.id)} variant="outline" className="w-full rounded-lg text-sm">
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

