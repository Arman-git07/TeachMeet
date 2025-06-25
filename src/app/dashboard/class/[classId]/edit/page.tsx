
// src/app/dashboard/class/[classId]/edit/page.tsx
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Save, Loader2, UploadCloud, Users as UsersIcon, Edit as EditIcon, AlertTriangle, BookOpen, PlusCircle, Trash2 } from "lucide-react";
import Image from "next/image";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from '@/hooks/useAuth';
import { db, storage } from '@/lib/firebase'; // Import db
import { ref as storageRef, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { doc, getDoc, updateDoc } from 'firebase/firestore'; // Firestore imports
import { cn } from '@/lib/utils';
import Link from 'next/link';

interface Subject {
  subjectName: string;
  teacherId: string;
  teacherName: string; // Keep this for display, even if it's a placeholder initially
}

interface ClassroomEditableDetails {
  id: string;
  name: string;
  description: string;
  thumbnailUrl: string;
  dataAiHint?: string;
  teacherId: string; 
  subjects?: Subject[];
}

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

export default function EditClassPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();

  const classId = params.classId as string;

  const [classroom, setClassroom] = useState<ClassroomEditableDetails | null>(null);
  const [editClassName, setEditClassName] = useState('');
  const [editClassDescription, setEditClassDescription] = useState('');
  const [editClassImageFile, setEditClassImageFile] = useState<File | null>(null);
  const [editClassImagePreview, setEditClassImagePreview] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [newSubjectName, setNewSubjectName] = useState('');
  const [newTeacherId, setNewTeacherId] = useState('');

  useEffect(() => {
    if (classId && !authLoading) {
      setIsLoading(true);
      const classroomDocRef = doc(db, "classrooms", classId);
      getDoc(classroomDocRef).then(docSnap => {
        if (docSnap.exists()) {
          const data = docSnap.data() as Omit<ClassroomEditableDetails, 'id'>;
          const fetchedClass: ClassroomEditableDetails = { id: docSnap.id, ...data };
          
          if (user && fetchedClass.teacherId !== user.uid) {
            toast({ variant: "destructive", title: "Permission Denied", description: "You are not authorized to edit this class." });
            router.push(`/dashboard/class/${classId}?name=${encodeURIComponent(fetchedClass.name)}`);
            return;
          }

          setClassroom(fetchedClass);
          setEditClassName(fetchedClass.name);
          setEditClassDescription(fetchedClass.description);
          setEditClassImagePreview(fetchedClass.thumbnailUrl);
          setSubjects(fetchedClass.subjects || []);
        } else {
          toast({ variant: "destructive", title: "Error", description: "Could not load class details." });
          router.push('/dashboard/classes');
        }
      }).catch(error => {
        console.error("Error fetching class for edit:", error);
        toast({ variant: "destructive", title: "Error", description: "Failed to fetch class details." });
        router.push('/dashboard/classes');
      }).finally(() => {
        setIsLoading(false);
      });
    }
  }, [classId, user, authLoading, router, toast]);

  const handleImageFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > MAX_IMAGE_SIZE_BYTES) {
        toast({ variant: "destructive", title: "Image Too Large", description: `Please select an image smaller than ${MAX_IMAGE_SIZE_MB}MB.` });
        setEditClassImageFile(null);
        setEditClassImagePreview(classroom?.thumbnailUrl || null);
        if (event.target) event.target.value = "";
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setEditClassImageFile(file);
        setEditClassImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setEditClassImageFile(null);
      setEditClassImagePreview(classroom?.thumbnailUrl || null);
    }
  };
  
  const handleAddSubject = () => {
    if (!newSubjectName.trim() || !newTeacherId.trim()) {
      toast({ variant: 'destructive', title: 'Missing Info', description: 'Please provide both a subject name and a teacher ID.' });
      return;
    }
    // Note: In a production app, you would likely fetch teacher's name using their ID.
    // For this prototype, a placeholder name is used.
    const newSubject: Subject = {
      subjectName: newSubjectName.trim(),
      teacherId: newTeacherId.trim(),
      teacherName: `Teacher (${newTeacherId.trim().substring(0, 5)}...)`
    };
    setSubjects(prev => [...prev, newSubject]);
    setNewSubjectName('');
    setNewTeacherId('');
    toast({ title: 'Subject Added', description: `${newSubject.subjectName} added to the list. Click "Save Changes" to confirm.` });
  };
  
  const handleRemoveSubject = (indexToRemove: number) => {
    const subjectToRemove = subjects[indexToRemove];
    setSubjects(prev => prev.filter((_, index) => index !== indexToRemove));
    toast({ title: 'Subject Removed', description: `${subjectToRemove.subjectName} removed from the list. Click "Save Changes" to confirm.` });
  };


  const uploadImageToStorage = async (imageFile: File, userId: string): Promise<{ thumbnailUrl: string; dataAiHint?: string }> => {
    const imageFileName = `${Date.now()}_${imageFile.name.replace(/\s+/g, '_')}`;
    const imagePath = `class_thumbnails/${userId}/${imageFileName}`; // Same path as create
    const imageFileRef = storageRef(storage, imagePath);
    const toastId = `upload-edit-class-image-${Date.now()}`;
    toast({
        id: toastId, title: "Uploading New Class Image...",
        description: <div className="flex items-center"><UploadCloud className="mr-2 h-4 w-4 animate-pulse" /><span>Starting upload...</span></div>,
        duration: Infinity,
    });
    return new Promise((resolve, reject) => {
      const uploadTask = uploadBytesResumable(imageFileRef, imageFile);
      uploadTask.on('state_changed',
        (snapshot) => { /* Progress */ }, (error) => {
          toast.dismiss(toastId);
          toast({ variant: "destructive", title: "Image Upload Failed", description: `Could not upload. Error: ${error.message}` });
          reject(error);
        },
        async () => {
          try {
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
            toast.dismiss(toastId);
            toast({ title: "Image Uploaded!", description: `New image successfully uploaded.` });
            resolve({ thumbnailUrl: downloadURL, dataAiHint: undefined }); // No AI hint for uploaded images
          } catch (getUrlError) {
             toast.dismiss(toastId);
             toast({ variant: "destructive", title: "Image URL Error", description: (getUrlError as Error).message });
             reject(getUrlError);
          }
        }
      );
    });
  };

  const handleUpdateClass = async () => {
    if (!classroom || !editClassName.trim() || !editClassDescription.trim()) {
      toast({ variant: "destructive", title: "Missing Information", description: "Please provide a class name and description." });
      return;
    }
    if (!user || user.uid !== classroom.teacherId) {
      toast({ variant: "destructive", title: "Permission Denied", description: "You are not authorized to update this class." });
      return;
    }

    setIsSaving(true);
    let updatedThumbnailUrl = classroom.thumbnailUrl;
    let updatedDataAiHint = classroom.dataAiHint;

    try {
      if (editClassImageFile) {
        const imageUploadResult = await uploadImageToStorage(editClassImageFile, user.uid);
        updatedThumbnailUrl = imageUploadResult.thumbnailUrl;
        updatedDataAiHint = imageUploadResult.dataAiHint;
      } else if (classroom.name !== editClassName.trim() && classroom.thumbnailUrl.includes('placehold.co') && classroom.thumbnailUrl.includes('?text=')) {
        // If name changed and placeholder was based on old name, update placeholder
        const newClassNameInitials = getInitialsFromName(editClassName.trim(), "C");
        updatedThumbnailUrl = `https://placehold.co/600x400.png?text=${newClassNameInitials}`;
        // Keep existing dataAiHint if it was a placeholder
      }

      const classroomDocRef = doc(db, "classrooms", classId);
      await updateDoc(classroomDocRef, {
        name: editClassName.trim(),
        description: editClassDescription.trim(),
        thumbnailUrl: updatedThumbnailUrl,
        dataAiHint: updatedDataAiHint, // Will be undefined if new image uploaded, or same if placeholder updated
        subjects: subjects,
      });

      toast({ title: "Class Updated!", description: `"${editClassName.trim()}" has been successfully updated.` });
      router.push(`/dashboard/class/${classId}?name=${encodeURIComponent(editClassName.trim())}`);
    } catch (error) {
      console.error("Error updating class:", error);
      toast({ variant: "destructive", title: "Update Failed", description: (error as Error).message });
    } finally {
      setIsSaving(false);
    }
  };
  
  const handleManageMembers = () => {
    if (!classroom) return;
    router.push(`/dashboard/class/${classroom.id}/manage-members?name=${encodeURIComponent(classroom.name)}`);
  };

  if (isLoading || authLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground">Loading class details...</p>
      </div>
    );
  }

  if (!classroom) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center">
        <AlertTriangle className="h-16 w-16 text-destructive mb-4" />
        <h1 className="text-2xl font-bold text-destructive mb-2">Class Not Found</h1>
        <p className="text-muted-foreground mb-6">Details for this class could not be loaded.</p>
        <Button onClick={() => router.push('/dashboard/classes')} variant="outline" className="rounded-lg">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to All Classes
        </Button>
      </div>
    );
  }
  
  const canEdit = user?.uid === classroom.teacherId;

  return (
    <div className="space-y-6 p-4 md:p-8 w-full">
       <div className="flex items-center justify-between">
        <Button onClick={() => router.back()} variant="outline" className="rounded-lg">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>
      </div>

      <Card className="rounded-xl shadow-xl border-border/50 max-w-2xl mx-auto">
        <CardHeader>
          <div className="flex items-center gap-3">
            <EditIcon className="h-7 w-7 text-primary" />
            <CardTitle className="text-2xl">Edit: {classroom.name}</CardTitle>
          </div>
          <CardDescription>Update the details for your class.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
            { !canEdit && user && ( // Only show if logged in but not authorized
                 <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Permission Denied</AlertTitle>
                    <AlertDescription>You are not authorized to edit this class.</AlertDescription>
                </Alert>
            )}
          <div className="grid gap-2">
            <Label htmlFor="editClassName">Class Name</Label>
            <Input id="editClassName" value={editClassName} onChange={(e) => setEditClassName(e.target.value)} placeholder="e.g., Math 101" className="rounded-lg" disabled={isSaving || !canEdit}/>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="editClassDescription">Description</Label>
            <Textarea id="editClassDescription" value={editClassDescription} onChange={(e) => setEditClassDescription(e.target.value)} placeholder="A brief overview of your class..." className="rounded-lg min-h-[100px]" disabled={isSaving || !canEdit}/>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="editClassImage">Class Image (Optional, Max {MAX_IMAGE_SIZE_MB}MB)</Label>
            <Input id="editClassImage" type="file" accept="image/*" onChange={handleImageFileChange} className="rounded-lg file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20" disabled={isSaving || !canEdit}/>
            {editClassImagePreview && (
              <div className="mt-2 relative w-full h-48 rounded-lg overflow-hidden border shadow-inner">
                <Image src={editClassImagePreview} alt="Class image preview" layout="fill" objectFit="cover" data-ai-hint={classroom.thumbnailUrl.includes('placehold.co') && classroom.thumbnailUrl.includes('?text=') ? classroom.dataAiHint : "education classroom"} />
              </div>
            )}
          </div>
          {canEdit && (
            <Button variant="outline" className="w-full rounded-lg" onClick={handleManageMembers} disabled={isSaving}>
                <UsersIcon className="mr-2 h-4 w-4" /> Manage Class Roster
            </Button>
          )}
        </CardContent>
        {/* Save button is now at the bottom of the page */}
      </Card>
      
      {canEdit && (
        <Card className="rounded-xl shadow-xl border-border/50 max-w-2xl mx-auto" id="subjects">
          <CardHeader>
            <div className="flex items-center gap-3">
              <BookOpen className="h-7 w-7 text-primary" />
              <CardTitle>Manage Subjects &amp; Teachers</CardTitle>
            </div>
            <CardDescription>Add or remove subjects and assign teachers to this class.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {subjects && subjects.length > 0 ? (
              <div className="space-y-2">
                {subjects.map((subject, index) => (
                  <div key={index} className="flex items-center justify-between p-2.5 border rounded-lg bg-muted/30">
                    <div>
                      <p className="font-medium text-foreground">{subject.subjectName}</p>
                      <p className="text-xs text-muted-foreground">Teacher ID: {subject.teacherId}</p>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => handleRemoveSubject(index)} disabled={isSaving}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-center text-muted-foreground py-4">No subjects added yet.</p>
            )}
            <div className="pt-4 border-t mt-4 space-y-3">
              <h4 className="font-medium text-foreground">Add New Subject</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className='space-y-1.5'>
                  <Label htmlFor='newSubjectName'>Subject Name</Label>
                  <Input id='newSubjectName' value={newSubjectName} onChange={e => setNewSubjectName(e.target.value)} placeholder="e.g., Physics 101" className="rounded-lg" disabled={isSaving}/>
                </div>
                <div className='space-y-1.5'>
                  <Label htmlFor='newTeacherId'>Teacher's User ID</Label>
                  <Input id='newTeacherId' value={newTeacherId} onChange={e => setNewTeacherId(e.target.value)} placeholder="e.g., abCDe12fgH..." className="rounded-lg" disabled={isSaving}/>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">Note: In a full app, you would search for a teacher by email. For now, please enter their unique User ID.</p>
              <Button onClick={handleAddSubject} className="w-full mt-2 btn-gel rounded-lg" disabled={isSaving}>
                <PlusCircle className="mr-2 h-4 w-4" />
                Add Subject
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {canEdit && (
        <div className="max-w-2xl mx-auto w-full">
            <Button type="button" onClick={handleUpdateClass} className="w-full btn-gel rounded-lg text-lg py-3" disabled={isSaving || !editClassName.trim() || !canEdit}>
                {isSaving ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Save className="mr-2 h-5 w-5" />}
                {isSaving ? (editClassImageFile ? 'Uploading & Saving...' : 'Saving Changes...') : 'Save All Changes'}
            </Button>
        </div>
      )}
    </div>
  );
}
