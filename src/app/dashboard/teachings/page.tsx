
'use client';

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { School, PlusCircle, Loader2, BookOpen, Trash2, Edit, Video } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { collection, addDoc, serverTimestamp, doc, deleteDoc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Skeleton } from "@/components/ui/skeleton";
import type { Teaching } from "@/hooks/useAuth";

function CreateTeachingDialogContent({ setOpen, teachingToEdit }: { setOpen: (open: boolean) => void, teachingToEdit?: Teaching | null }) {
    const { user } = useAuth();
    const { toast } = useToast();
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const isEditing = !!teachingToEdit;

    useEffect(() => {
        if (isEditing && teachingToEdit) {
            setTitle(teachingToEdit.title);
            setDescription(teachingToEdit.description);
        } else {
            setTitle('');
            setDescription('');
        }
    }, [teachingToEdit, isEditing]);

    const handleSubmit = async () => {
        if (!user) {
            toast({ variant: "destructive", title: "Not authenticated", description: "You must be logged in to create a teaching." });
            return;
        }
        if (!title.trim()) {
            toast({ variant: "destructive", title: "Title is required", description: "Please provide a title for your teaching." });
            return;
        }
        setIsLoading(true);
        try {
            if (isEditing && teachingToEdit) {
                const teachingRef = doc(db, 'teachings', teachingToEdit.id);
                await updateDoc(teachingRef, {
                    title,
                    description,
                });
                toast({ title: "Teaching Updated!", description: "Your teaching has been successfully updated." });
            } else {
                await addDoc(collection(db, "teachings"), {
                    title,
                    description,
                    creatorId: user.uid,
                    createdAt: serverTimestamp(),
                });
                toast({ title: "Teaching Created!", description: "Your new teaching is now available." });
            }
            setOpen(false);
        } catch (error) {
            console.error("Error saving teaching:", error);
            toast({ variant: "destructive", title: "Save Failed", description: "Could not save the teaching." });
        } finally {
            setIsLoading(false);
        }
    };
    
    return (
        <DialogContent className="sm:max-w-[425px] rounded-xl">
            <DialogHeader>
                <DialogTitle>{isEditing ? 'Edit Teaching' : 'Create New Teaching'}</DialogTitle>
                <DialogDescription>
                    {isEditing ? 'Update the details for your teaching.' : 'Fill in the details below to create a new teaching class.'}
                </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="title" className="text-right">Title</Label>
                    <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} className="col-span-3 rounded-lg" placeholder="e.g., Introduction to Algebra" />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="description" className="text-right">Description</Label>
                    <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} className="col-span-3 rounded-lg" placeholder="A brief overview of the teaching session."/>
                </div>
            </div>
            <DialogFooter>
                <Button onClick={handleSubmit} disabled={isLoading} className="btn-gel rounded-lg">
                    {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    {isLoading ? (isEditing ? 'Saving...' : 'Creating...') : (isEditing ? 'Save Changes' : 'Create Teaching')}
                </Button>
            </DialogFooter>
        </DialogContent>
    );
}


function TeachingCard({ teaching, onEdit, onDelete }: { teaching: Teaching, onEdit: (teaching: Teaching) => void, onDelete: (teachingId: string) => void }) {
    return (
        <Card className="shadow-lg rounded-xl border-border/50 flex flex-col">
            <CardHeader>
                <CardTitle className="truncate">{teaching.title}</CardTitle>
                <CardDescription className="text-xs">Created on {teaching.createdAt ? new Date(teaching.createdAt.toDate()).toLocaleDateString() : 'N/A'}</CardDescription>
            </CardHeader>
            <CardContent className="flex-grow">
                <p className="text-sm text-muted-foreground line-clamp-3">{teaching.description || "No description provided."}</p>
            </CardContent>
            <CardFooter className="grid grid-cols-3 gap-2">
                 <Button variant="outline" size="sm" className="rounded-lg"><Video className="mr-1.5 h-4 w-4" /> Start</Button>
                 <Button variant="outline" size="sm" className="rounded-lg" onClick={() => onEdit(teaching)}><Edit className="mr-1.5 h-4 w-4" /> Edit</Button>
                 <Button variant="destructive" size="sm" className="rounded-lg" onClick={() => onDelete(teaching.id)}><Trash2 className="mr-1.5 h-4 w-4" /> Delete</Button>
            </CardFooter>
        </Card>
    )
}

export default function TeachingsPage() {
    const { teachings, loading } = useAuth();
    const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
    const [teachingToEdit, setTeachingToEdit] = useState<Teaching | null>(null);
    const { toast } = useToast();

    const handleEdit = (teaching: Teaching) => {
        setTeachingToEdit(teaching);
        setIsCreateDialogOpen(true);
    };

    const handleDelete = async (teachingId: string) => {
        try {
            await deleteDoc(doc(db, "teachings", teachingId));
            toast({ title: "Teaching Deleted", description: "The teaching has been removed." });
        } catch (error) {
            toast({ variant: "destructive", title: "Deletion Failed", description: "Could not delete the teaching." });
        }
    };
    
    // This effect ensures that when the dialog is closed, the 'edit' state is cleared.
    useEffect(() => {
        if (!isCreateDialogOpen) {
            setTeachingToEdit(null);
        }
    }, [isCreateDialogOpen]);

    return (
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <div className="space-y-4">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-foreground">Teachings</h1>
                        <p className="text-muted-foreground">Manage your teaching sessions and classes.</p>
                    </div>
                    <DialogTrigger asChild>
                        <Button className="btn-gel rounded-lg">
                            <PlusCircle className="mr-2 h-5 w-5" /> Create New Teaching
                        </Button>
                    </DialogTrigger>
                </div>
                
                {loading ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        <Skeleton className="h-60 w-full rounded-xl" />
                        <Skeleton className="h-60 w-full rounded-xl" />
                        <Skeleton className="h-60 w-full rounded-xl" />
                    </div>
                ) : teachings.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {teachings.map(t => <TeachingCard key={t.id} teaching={t} onEdit={handleEdit} onDelete={handleDelete} />)}
                    </div>
                ) : (
                    <div className="text-center py-16 text-muted-foreground border-2 border-dashed rounded-xl">
                        <BookOpen className="mx-auto h-12 w-12 mb-4" />
                        <h3 className="text-lg font-semibold text-foreground">No Teachings Yet</h3>
                        <p className="text-sm mt-1 mb-4">Click "Create New Teaching" to get started.</p>
                    </div>
                )}
                
                <CreateTeachingDialogContent setOpen={setIsCreateDialogOpen} teachingToEdit={teachingToEdit} />
            </div>
        </Dialog>
    );
}
