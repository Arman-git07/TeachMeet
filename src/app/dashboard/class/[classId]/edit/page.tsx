
'use client';

import { use, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Save, Trash2, Image as ImageIcon } from "lucide-react";
import Link from 'next/link';
import Image from 'next/image';
import { useToast } from '@/hooks/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';

// Mock data for an existing class
const mockClassDetails = {
    id: "cls1",
    name: "Introduction to Biology",
    subject: "Science",
    description: "A comprehensive course covering the fundamental principles of biology, from cellular structure to ecosystems.",
    bannerUrl: "https://placehold.co/800x250.png",
};


export default function EditClassPage({ params: paramsPromise }: { params: Promise<{ classId: string }> }) {
    const { classId } = use(paramsPromise);
    const [className, setClassName] = useState(mockClassDetails.name);
    const [subject, setSubject] = useState(mockClassDetails.subject);
    const [description, setDescription] = useState(mockClassDetails.description);
    const [bannerUrl, setBannerUrl] = useState(mockClassDetails.bannerUrl);
    const { toast } = useToast();

    const handleSaveChanges = () => {
        toast({
            title: "Changes Saved (Mock)",
            description: `Details for "${className}" have been updated.`,
        });
        // Here you would typically call an API to save the changes
    };
    
    const handleDeleteClass = () => {
         toast({
            variant: "destructive",
            title: "Class Deleted (Mock)",
            description: `The class "${className}" has been permanently deleted.`,
        });
        // Add logic to redirect or update UI after deletion
    }

    return (
        <div className="container mx-auto py-8">
            <Card className="max-w-3xl mx-auto shadow-lg rounded-xl border-border/50">
                <CardHeader>
                    <div className="flex justify-between items-center">
                        <div className="space-y-1">
                            <CardTitle className="text-2xl">Edit Class Details</CardTitle>
                            <CardDescription>Update information for your class.</CardDescription>
                        </div>
                         <Button asChild variant="outline" size="sm" className="rounded-lg">
                           <Link href={`/dashboard/class/${classId}`}>
                               <ArrowLeft className="mr-2 h-4 w-4" />
                               Cancel
                           </Link>
                        </Button>
                    </div>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div>
                        <Label htmlFor="class-banner">Class Banner Image</Label>
                        <div className="mt-2 aspect-[16/5] w-full relative rounded-lg overflow-hidden border">
                            <Image src={bannerUrl} layout="fill" objectFit="cover" alt="Class banner" data-ai-hint="class banner" />
                            <Button size="icon" className="absolute top-2 right-2 rounded-full shadow-md">
                                <ImageIcon className="h-5 w-5" />
                            </Button>
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="class-name">Class Name</Label>
                        <Input id="class-name" value={className} onChange={(e) => setClassName(e.target.value)} className="rounded-lg"/>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="class-subject">Subject</Label>
                        <Input id="class-subject" value={subject} onChange={(e) => setSubject(e.target.value)} className="rounded-lg"/>
                    </div>
                     <div className="space-y-2">
                        <Label htmlFor="class-description">Description</Label>
                        <Textarea id="class-description" value={description} onChange={(e) => setDescription(e.target.value)} className="rounded-lg min-h-[120px]"/>
                    </div>
                </CardContent>
                <CardFooter className="flex justify-between items-center border-t pt-6">
                     <AlertDialog>
                        <AlertDialogTrigger asChild>
                           <Button variant="destructive" className="rounded-lg">
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete Class
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="rounded-xl">
                            <AlertDialogHeader>
                                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    This action cannot be undone. This will permanently delete the class
                                    and all associated data, including assignments, materials, and member lists.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel className="rounded-lg">Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={handleDeleteClass} className="bg-destructive hover:bg-destructive/90 rounded-lg">
                                    Delete
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                    <Button onClick={handleSaveChanges} className="btn-gel rounded-lg">
                        <Save className="mr-2 h-4 w-4"/>
                        Save Changes
                    </Button>
                </CardFooter>
            </Card>
        </div>
    );
}
