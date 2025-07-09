
'use client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Save, Trash2, Loader2 } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { db } from "@/lib/firebase";
import { doc, getDoc, updateDoc, deleteDoc, onSnapshot } from "firebase/firestore";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

interface ClassData {
    name: string;
    description: string;
    creatorId: string;
}

export default function EditClassPage() {
    const params = useParams();
    const router = useRouter();
    const classId = params.classId as string;
    const { toast } = useToast();
    const { user: currentUser } = useAuth();
    
    const [classData, setClassData] = useState<ClassData | null>(null);
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    
    const isHost = classData?.creatorId === currentUser?.uid;

    useEffect(() => {
        if (!classId) return;
        const classDocRef = doc(db, "classes", classId);
        const unsubscribe = onSnapshot(classDocRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data() as ClassData;
                setClassData(data);
                setName(data.name);
                setDescription(data.description);
            } else {
                toast({ variant: 'destructive', title: 'Error', description: 'Class not found.' });
                router.push('/dashboard/classes');
            }
            setIsLoading(false);
        });
        return () => unsubscribe();
    }, [classId, router, toast]);

    const handleSaveChanges = async () => {
        if (!name.trim()) {
            toast({ variant: "destructive", title: "Error", description: "Class name cannot be empty." });
            return;
        }
        setIsSaving(true);
        const classDocRef = doc(db, "classes", classId);
        try {
            await updateDoc(classDocRef, { name, description });
            toast({ title: "Changes Saved", description: "Your class details have been updated." });
        } catch (error) {
            console.error("Error updating class:", error);
            toast({ variant: "destructive", title: "Error", description: "Could not save changes." });
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteClass = async () => {
        setIsDeleting(true);
        const classDocRef = doc(db, "classes", classId);
        try {
            await deleteDoc(classDocRef);
            toast({ title: "Class Deleted", description: "The class has been permanently deleted." });
            router.push('/dashboard/classes');
        } catch (error) {
            console.error("Error deleting class:", error);
            toast({ variant: "destructive", title: "Error", description: "Could not delete the class." });
        } finally {
            setIsDeleting(false);
        }
    };

    if (isLoading) {
        return (
            <div className="space-y-8">
                <Skeleton className="h-10 w-1/2" />
                <Skeleton className="h-64 w-full" />
                <Skeleton className="h-48 w-full" />
            </div>
        );
    }

    if (!isHost) {
        return (
            <div className="text-center py-10">
                <p className="text-destructive">You do not have permission to edit this class.</p>
                <Button asChild variant="link"><Link href={`/dashboard/class/${classId}`}>Go Back</Link></Button>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-foreground">Edit Class Details</h1>
                    <p className="text-muted-foreground">Modify the settings for your class.</p>
                </div>
                <Button asChild variant="outline" className="rounded-lg">
                    <Link href={`/dashboard/class/${classId}`}><ArrowLeft className="mr-2 h-4 w-4" /> Back to Class</Link>
                </Button>
            </div>

            <Card className="rounded-xl shadow-lg border-border/50">
                <CardHeader>
                    <CardTitle>Class Information</CardTitle>
                    <CardDescription>Update the name and description of your class.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                     <div>
                        <Label htmlFor="className">Class Name</Label>
                        <Input id="className" value={name} onChange={(e) => setName(e.target.value)} className="mt-1 rounded-lg" disabled={isSaving} />
                     </div>
                     <div>
                        <Label htmlFor="classDescription">Class Description</Label>
                        <Textarea id="classDescription" value={description} onChange={(e) => setDescription(e.target.value)} className="mt-1 rounded-lg" rows={4} disabled={isSaving}/>
                     </div>
                </CardContent>
                <CardFooter>
                    <Button onClick={handleSaveChanges} className="btn-gel rounded-lg" disabled={isSaving}>
                        {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                        {isSaving ? 'Saving...' : 'Save Changes'}
                    </Button>
                </CardFooter>
            </Card>

            <Card className="rounded-xl shadow-lg border-destructive/50">
                <CardHeader>
                    <CardTitle className="text-destructive">Danger Zone</CardTitle>
                    <CardDescription>This action is permanent and cannot be undone.</CardDescription>
                </CardHeader>
                <CardContent>
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button variant="destructive" className="w-full rounded-lg" disabled={isDeleting}>
                                <Trash2 className="mr-2 h-4 w-4"/> Delete This Class
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    This action cannot be undone. This will permanently delete the class "{name}" and all of its associated data, including assignments, materials, and chat messages.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={handleDeleteClass} disabled={isDeleting} className={cn(buttonVariants({variant: "destructive"}))}>
                                    {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                    {isDeleting ? 'Deleting...' : 'Yes, delete class'}
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </CardContent>
            </Card>
        </div>
    );
}
