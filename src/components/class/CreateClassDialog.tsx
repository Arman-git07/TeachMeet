
'use client';
import { Button } from "@/components/ui/button";
import { DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { PlusCircle, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { useRouter } from 'next/navigation';

export function CreateClassDialogContent() {
    const { toast } = useToast();
    const { user } = useAuth();
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!user) {
            toast({ variant: 'destructive', title: 'Not Authenticated', description: 'You must be signed in to create a class.' });
            return;
        }

        setIsLoading(true);
        const formData = new FormData(event.currentTarget);
        const classData = {
            name: formData.get('className') as string,
            subject: formData.get('subject') as string,
            description: formData.get('description') as string,
            creatorId: user.uid,
            teacherName: user.displayName || 'Unnamed Teacher',
            createdAt: serverTimestamp(),
            studentCount: 0, // Initial student count
        };
        
        console.log("Attempting to create class with data:", classData);

        try {
            const docRef = await addDoc(collection(db, "classes"), classData);
            console.log("Class created with ID: ", docRef.id);
            toast({
                title: "Class Created!",
                description: `"${classData.name}" has been successfully created.`,
            });
            // Consider redirecting to the new class page
            router.push(`/dashboard/class/${docRef.id}`);
        } catch (error: any) {
            console.error("Error creating class: ", error);
             toast({
                variant: 'destructive',
                title: 'Failed to Create Class',
                description: error.message || 'An unexpected error occurred.',
            });
        } finally {
            setIsLoading(false);
            // Programmatically close the dialog if it's still open.
            // This can be tricky without direct control over the Dialog's open state.
            // A common pattern is to pass an `onSuccess` callback to close it from the parent.
            // For now, the user must click "Cancel" or the X button.
        }
    };

    return (
        <form onSubmit={handleSubmit}>
            <DialogHeader>
                <DialogTitle className="text-2xl flex items-center gap-2"><PlusCircle/>Create a New Class</DialogTitle>
                <DialogDescription>
                    Fill out the details below to set up your new class.
                </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-6">
                <div className="space-y-2">
                    <Label htmlFor="className">Class Name</Label>
                    <Input id="className" name="className" placeholder="e.g., Introduction to Algebra" required className="rounded-lg" />
                </div>
                 <div className="space-y-2">
                    <Label htmlFor="subject">Subject</Label>
                    <Input id="subject" name="subject" placeholder="e.g., Mathematics" required className="rounded-lg" />
                </div>
                 <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea id="description" name="description" placeholder="Provide a brief overview of the class." className="rounded-lg"/>
                </div>
            </div>
            <DialogFooter>
                <DialogClose asChild>
                    <Button type="button" variant="outline" className="rounded-lg">Cancel</Button>
                </DialogClose>
                <Button type="submit" className="btn-gel rounded-lg" disabled={isLoading}>
                    {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {isLoading ? 'Creating...' : 'Create Class'}
                </Button>
            </DialogFooter>
        </form>
    );
}
