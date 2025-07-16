
'use client';

import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { School, PlusCircle, Loader2, BookOpen, Trash2, Edit, Video, UserCheck, UserX, Users, Search, FilterX, Globe, Lock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { collection, addDoc, serverTimestamp, doc, deleteDoc, updateDoc, arrayUnion, arrayRemove } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Skeleton } from "@/components/ui/skeleton";
import type { Teaching } from "@/hooks/useAuth";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

function ManageRequestsDialog({ teaching, setOpen }: { teaching: Teaching, setOpen: (open: boolean) => void }) {
    const { toast } = useToast();

    const handleRequest = async (studentId: string, approve: boolean) => {
        const teachingRef = doc(db, 'teachings', teaching.id);
        try {
            if (approve) {
                await updateDoc(teachingRef, {
                    pendingRequests: arrayRemove(studentId),
                    members: arrayUnion(studentId),
                });
                toast({ title: "Student Approved", description: "They have been added to your class." });
            } else {
                await updateDoc(teachingRef, {
                    pendingRequests: arrayRemove(studentId),
                });
                toast({ title: "Student Denied", description: "The request has been removed." });
            }
        } catch (error) {
            console.error("Error managing request:", error);
            toast({ variant: "destructive", title: "Update Failed", description: "Could not update the teaching." });
        }
    };

    return (
        <DialogContent className="sm:max-w-md rounded-xl">
            <DialogHeader>
                <DialogTitle>Manage Join Requests</DialogTitle>
                <DialogDescription>Approve or deny requests for your class: "{teaching.title}"</DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-3 max-h-80 overflow-y-auto">
                {teaching.pendingRequests?.length > 0 ? (
                    teaching.pendingRequests.map(studentId => (
                        <div key={studentId} className="flex items-center justify-between p-2 bg-muted/50 rounded-lg">
                            <div className="flex items-center gap-2">
                                <Avatar className="h-8 w-8">
                                    <AvatarImage src={`https://placehold.co/32x32.png?text=${studentId.charAt(0)}`} alt={studentId} data-ai-hint="avatar user"/>
                                    <AvatarFallback>{studentId.charAt(0).toUpperCase()}</AvatarFallback>
                                </Avatar>
                                <span className="text-sm font-medium truncate" title={studentId}>Student ID: ...{studentId.slice(-6)}</span>
                            </div>
                            <div className="flex gap-2">
                                <Button size="sm" variant="outline" className="text-green-600 border-green-600 hover:bg-green-100 hover:text-green-700" onClick={() => handleRequest(studentId, true)}><UserCheck className="h-4 w-4"/></Button>
                                <Button size="sm" variant="destructive" onClick={() => handleRequest(studentId, false)}><UserX className="h-4 w-4"/></Button>
                            </div>
                        </div>
                    ))
                ) : (
                    <p className="text-sm text-muted-foreground text-center py-8">No pending requests.</p>
                )}
            </div>
             <DialogFooter>
                <DialogClose asChild>
                    <Button type="button" variant="secondary" className="rounded-lg">Close</Button>
                </DialogClose>
            </DialogFooter>
        </DialogContent>
    )
}

function CreateTeachingDialogContent({ onOpenChange, teachingToEdit }: { onOpenChange: (open: boolean) => void, teachingToEdit?: Teaching | null }) {
    const { user } = useAuth();
    const { toast } = useToast();
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [isPublic, setIsPublic] = useState(true);
    const [isLoading, setIsLoading] = useState(false);

    const isEditing = !!teachingToEdit;

    useEffect(() => {
        if (isEditing && teachingToEdit) {
            setTitle(teachingToEdit.title);
            setDescription(teachingToEdit.description);
            setIsPublic(teachingToEdit.isPublic ?? true);
        } else {
            setTitle('');
            setDescription('');
            setIsPublic(true);
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
                    title: title.trim(), 
                    description: description.trim(), 
                    isPublic,
                });
                toast({ title: "Teaching Updated!", description: "Your teaching has been successfully updated." });
            } else {
                await addDoc(collection(db, "teachings"), {
                    title: title.trim(),
                    description: description.trim(),
                    isPublic: isPublic,
                    creatorId: user.uid,
                    creatorName: user.displayName || user.email?.split('@')[0] || 'Anonymous',
                    createdAt: serverTimestamp(),
                    members: [user.uid],
                    pendingRequests: [],
                });
                toast({ title: "Teaching Created!", description: "Your new teaching is now available." });
            }
            onOpenChange(false);
        } catch (error) {
            console.error("Error saving teaching:", error);
            toast({ variant: "destructive", title: "Save Failed", description: "Could not save the teaching. Check Firestore rules and network connection." });
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
                    <Label htmlFor="title" className="text-right">Teaching name</Label>
                    <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} className="col-span-3 rounded-lg" placeholder="e.g., Introduction to Algebra" />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="description" className="text-right">Description</Label>
                    <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} className="col-span-3 rounded-lg" placeholder="A brief overview of the teaching session."/>
                </div>
                 <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="is-public" className="text-right">Visibility</Label>
                    <div className="col-span-3 flex items-center space-x-2">
                        <Switch id="is-public" checked={isPublic} onCheckedChange={setIsPublic} />
                        <span className="text-sm text-muted-foreground">{isPublic ? "Public (Discoverable)" : "Private (Invite only)"}</span>
                    </div>
                </div>
            </div>
            <DialogFooter>
                <DialogClose asChild>
                    <Button type="button" variant="secondary" className="rounded-lg" disabled={isLoading}>Cancel</Button>
                </DialogClose>
                <Button onClick={handleSubmit} disabled={isLoading} className="btn-gel rounded-lg">
                    {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    {isLoading ? (isEditing ? 'Saving...' : 'Creating...') : (isEditing ? 'Save Changes' : 'Create Teaching')}
                </Button>
            </DialogFooter>
        </DialogContent>
    );
}


function TeachingCard({ 
    teaching, 
    userRole,
    currentUserId,
    onEdit, 
    onDelete,
    onRequestToJoin,
    onManageRequests,
}: { 
    teaching: Teaching, 
    userRole: 'creator' | 'member' | 'guest',
    currentUserId: string | null,
    onEdit?: (teaching: Teaching) => void, 
    onDelete?: (teachingId: string) => void,
    onRequestToJoin?: (teachingId: string) => void,
    onManageRequests?: (teaching: Teaching) => void,
}) {

    const userIsPending = teaching.pendingRequests?.includes(currentUserId || '');

    return (
        <Card className="shadow-lg rounded-xl border-border/50 flex flex-col">
            <CardHeader>
                <div className="flex justify-between items-start">
                    <CardTitle className="truncate pr-2">{teaching.title}</CardTitle>
                    {teaching.isPublic ? <Globe className="h-4 w-4 text-accent" title="Public"/> : <Lock className="h-4 w-4 text-primary" title="Private"/>}
                </div>
                <CardDescription className="text-xs">
                    Created by {teaching.creatorName || '...'} on {teaching.createdAt ? new Date(teaching.createdAt.toDate()).toLocaleDateString() : 'N/A'}
                </CardDescription>
            </CardHeader>
            <CardContent className="flex-grow">
                <p className="text-sm text-muted-foreground line-clamp-3">{teaching.description || "No description provided."}</p>
            </CardContent>
            <CardFooter className="grid grid-cols-1 gap-2">
                 {userRole === 'creator' && onEdit && onDelete && onManageRequests && (
                    <div className="grid grid-cols-3 gap-2">
                         <Button variant="outline" size="sm" className="rounded-lg" onClick={() => onManageRequests(teaching)}>
                            <Users className="mr-1.5 h-4 w-4"/>
                            Requests ({teaching.pendingRequests?.length || 0})
                         </Button>
                         <Button variant="outline" size="sm" className="rounded-lg" onClick={() => onEdit(teaching)}><Edit className="mr-1.5 h-4 w-4" /> Edit</Button>
                         <Button variant="destructive" size="sm" className="rounded-lg" onClick={() => onDelete(teaching.id)}><Trash2 className="mr-1.5 h-4 w-4" /> Delete</Button>
                    </div>
                 )}
                 {userRole === 'member' && (
                     <Button size="sm" className="rounded-lg btn-gel"><Video className="mr-1.5 h-4 w-4" /> Start Session</Button>
                 )}
                 {userRole === 'guest' && onRequestToJoin && (
                     <Button size="sm" className="rounded-lg" onClick={() => onRequestToJoin(teaching.id)} disabled={userIsPending}>
                        {userIsPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <PlusCircle className="mr-2 h-4 w-4"/>}
                        {userIsPending ? 'Request Sent' : 'Request to Join'}
                    </Button>
                 )}
            </CardFooter>
        </Card>
    )
}

export default function TeachingsPage() {
    const { user, teachings, loading } = useAuth();
    const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
    const [teachingToEdit, setTeachingToEdit] = useState<Teaching | null>(null);
    const [teachingToManage, setTeachingToManage] = useState<Teaching | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const { toast } = useToast();

    const { myTeachings, enrolledTeachings, publicTeachingsToJoin } = useMemo(() => {
        if (!user || !teachings) return { myTeachings: [], enrolledTeachings: [], publicTeachingsToJoin: [] };
        
        const my: Teaching[] = [];
        const enrolled: Teaching[] = [];
        const publicList: Teaching[] = [];

        teachings.forEach(t => {
            const isCreator = t.creatorId === user.uid;
            const isMember = t.members?.includes(user.uid);

            if (isCreator) {
                my.push(t);
            } else if (isMember) {
                enrolled.push(t);
            }
            
            if (t.isPublic && !isMember) {
                publicList.push(t);
            }
        });

        return { myTeachings: my, enrolledTeachings: enrolled, publicTeachingsToJoin: publicList };
    }, [teachings, user]);


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
    
    const handleRequestToJoin = async (teachingId: string) => {
        if (!user) {
            toast({variant: "destructive", title: "Not logged in", description: "You must be signed in to join a class."});
            return;
        }
        const teachingRef = doc(db, 'teachings', teachingId);
        try {
            await updateDoc(teachingRef, {
                pendingRequests: arrayUnion(user.uid)
            });
            toast({ title: "Request Sent!", description: "Your request to join has been sent to the teacher."});
        } catch(error) {
            console.error("Error requesting to join:", error);
            toast({variant: "destructive", title: "Request Failed", description: "Could not send your join request. Check Firestore rules."});
        }
    };

    const handleManageRequests = (teaching: Teaching) => {
        setTeachingToManage(teaching);
    };
    
    useEffect(() => {
        if (!isCreateDialogOpen) {
            setTeachingToEdit(null);
        }
    }, [isCreateDialogOpen]);

    const filteredPublicTeachings = useMemo(() => {
        if (!searchQuery) return publicTeachingsToJoin;
        return publicTeachingsToJoin.filter(t => 
            t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (t.description && t.description.toLowerCase().includes(searchQuery.toLowerCase()))
        );
    }, [publicTeachingsToJoin, searchQuery]);


    const renderGrid = (teachingsList: Teaching[], userRole: 'creator' | 'member' | 'guest', emptyState: React.ReactNode) => {
        if (loading) {
            return (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <Skeleton className="h-60 w-full rounded-xl" />
                    <Skeleton className="h-60 w-full rounded-xl" />
                    <Skeleton className="h-60 w-full rounded-xl" />
                </div>
            )
        }
        if (teachingsList.length === 0) return emptyState;
        return (
             <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {teachingsList.map(t => {
                    let roleForCard: 'creator' | 'member' | 'guest' = 'guest';
                    if (user && t.creatorId === user.uid) {
                        roleForCard = 'creator';
                    } else if (user && t.members?.includes(user.uid)) {
                        roleForCard = 'member';
                    }

                    return (
                        <TeachingCard 
                            key={t.id} 
                            teaching={t} 
                            userRole={roleForCard}
                            currentUserId={user?.uid || null}
                            onEdit={roleForCard === 'creator' ? handleEdit : undefined}
                            onDelete={roleForCard === 'creator' ? handleDelete : undefined}
                            onRequestToJoin={roleForCard === 'guest' ? handleRequestToJoin : undefined}
                            onManageRequests={roleForCard === 'creator' ? handleManageRequests : undefined}
                        />
                    );
                })}
            </div>
        )
    }

    return (
        <>
            <div className="space-y-4">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-foreground">Teachings</h1>
                        <p className="text-muted-foreground">Manage your teaching sessions and classes.</p>
                    </div>
                    <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                        <DialogTrigger asChild>
                            <Button className="btn-gel rounded-lg">
                                <PlusCircle className="mr-2 h-5 w-5" /> Create New Teaching
                            </Button>
                        </DialogTrigger>
                        <CreateTeachingDialogContent onOpenChange={setIsCreateDialogOpen} teachingToEdit={teachingToEdit} />
                    </Dialog>
                </div>

                <Tabs defaultValue="created" className="w-full">
                    <TabsList className="grid w-full grid-cols-3 rounded-lg">
                        <TabsTrigger value="created" className="rounded-l-md">My Classes</TabsTrigger>
                        <TabsTrigger value="enrolled">Enrolled</TabsTrigger>
                        <TabsTrigger value="discover" className="rounded-r-md">Discover</TabsTrigger>
                    </TabsList>
                    <TabsContent value="created" className="mt-4">
                       {renderGrid(myTeachings, 'creator', (
                           <div className="text-center py-16 text-muted-foreground border-2 border-dashed rounded-xl">
                                <BookOpen className="mx-auto h-12 w-12 mb-4" />
                                <h3 className="text-lg font-semibold text-foreground">You haven't created any classes yet.</h3>
                                <p className="text-sm mt-1 mb-4">Teachings you create will appear here. Click "Create New Teaching" to get started.</p>
                           </div>
                       ))}
                    </TabsContent>
                     <TabsContent value="enrolled" className="mt-4">
                       {renderGrid(enrolledTeachings, 'member', (
                           <div className="text-center py-16 text-muted-foreground border-2 border-dashed rounded-xl">
                                <School className="mx-auto h-12 w-12 mb-4" />
                                <h3 className="text-lg font-semibold text-foreground">No Enrolled Classes</h3>
                                <p className="text-sm mt-1 mb-4">Classes you have joined will appear here.</p>
                           </div>
                       ))}
                    </TabsContent>
                     <TabsContent value="discover" className="mt-4 space-y-4">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                            <Input
                                type="search"
                                placeholder="Search for public classes..."
                                className="pl-10 rounded-lg w-full"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                       {renderGrid(filteredPublicTeachings, 'guest', (
                           <div className="text-center py-16 text-muted-foreground border-2 border-dashed rounded-xl">
                                <FilterX className="mx-auto h-12 w-12 mb-4" />
                                <h3 className="text-lg font-semibold text-foreground">No Public Classes Available</h3>
                                <p className="text-sm mt-1 mb-4">{searchQuery ? "Try a different search term." : "All public teachings available to join will appear here."}</p>
                           </div>
                       ))}
                    </TabsContent>
                </Tabs>
            </div>
            
            <Dialog open={!!teachingToManage} onOpenChange={(open) => !open && setTeachingToManage(null)}>
                {teachingToManage && <ManageRequestsDialog teaching={teachingToManage} setOpen={(open) => !open && setTeachingToManage(null)} />}
            </Dialog>
        </>
    );
}
