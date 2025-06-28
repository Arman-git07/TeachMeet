
'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { PlusCircle, UploadCloud, Loader2, Save, Sparkles } from "lucide-react";
import Image from "next/image";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from '@/hooks/useAuth';
import { db, storage } from '@/lib/firebase';
import { ref as storageRef, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { collection, addDoc, doc, setDoc, serverTimestamp } from 'firebase/firestore';

const MAX_IMAGE_SIZE_MB = 5;
const MAX_IMAGE_SIZE_BYTES = MAX_IMAGE_SIZE_MB * 1024 * 1024;

const getInitialsFromName = (name: string, defaultInitial: string = 'P'): string => {
  if (!name || typeof name !== 'string') return defaultInitial;
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return defaultInitial;
  if (words.length === 1) return words[0].substring(0, 2).toUpperCase() || defaultInitial;
  const firstInitial = words[0][0];
  const lastInitial = words[words.length - 1][0];
  return (firstInitial + lastInitial).toUpperCase();
};

interface CreateClassDialogProps {
  hasTeacherCard: boolean;
  onOpenTeacherCardDialog: () => void;
  triggerButton?: React.ReactNode;
}

export function CreateClassDialog({ hasTeacherCard, onOpenTeacherCardDialog, triggerButton }: CreateClassDialogProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newClassName, setNewClassName] = useState('');
  const [newClassDescription, setNewClassDescription] = useState('');
  const [newClassImageFile, setNewClassImageFile] = useState<File | null>(null);
  const [newClassImagePreview, setNewClassImagePreview] = useState<string | null>(null);
  const [isUploadingOrCreating, setIsUploadingOrCreating] = useState(false);

  const resetCreateClassDialog = () => {
    setNewClassName('');
    setNewClassDescription('');
    setNewClassImageFile(null);
    if (newClassImagePreview?.startsWith('blob:')) URL.revokeObjectURL(newClassImagePreview);
    setNewClassImagePreview(null);
    setIsUploadingOrCreating(false);
    setIsDialogOpen(false);
  };
  
  useEffect(() => {
    return () => {
      if (newClassImagePreview && newClassImagePreview.startsWith('blob:')) {
        URL.revokeObjectURL(newClassImagePreview);
      }
    };
  }, [newClassImagePreview]);
  
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
        (snapshot) => {},
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
        subjects: [],
        joinRequests: [],
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

  if (!hasTeacherCard) {
    return triggerButton ? (
        <div onClick={onOpenTeacherCardDialog}>{triggerButton}</div>
    ) : (
        <Button className="btn-gel rounded-lg bg-cta-orange text-cta-orange-foreground hover:bg-cta-orange/90 shadow-lg hover:shadow-cta-orange/50" onClick={onOpenTeacherCardDialog}>
            <Sparkles className="mr-2 h-5 w-5" /> Get Teacher Card
        </Button>
    );
  }

  return (
    <Dialog open={isDialogOpen} onOpenChange={(open) => {
        if (!open) resetCreateClassDialog();
        setIsDialogOpen(open);
    }}>
      <DialogTrigger asChild>
        {triggerButton ? triggerButton : (
            <Button className="btn-gel rounded-lg">
                <PlusCircle className="mr-2 h-5 w-5" /> Create New Class
            </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[520px] rounded-xl">
          <DialogHeader>
              <DialogTitle>Create New Classroom</DialogTitle>
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
              <Button type="button" variant="outline" className="rounded-lg" onClick={resetCreateClassDialog} disabled={isUploadingOrCreating}>Cancel</Button>
              <Button type="button" onClick={handleCreateClass} className="btn-gel rounded-lg" disabled={isUploadingOrCreating || !newClassName.trim() || !newClassDescription.trim()}>
                  {isUploadingOrCreating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  {isUploadingOrCreating ? (newClassImageFile ? 'Uploading Image...' : 'Creating...') : 'Create Class'}
              </Button>
          </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
