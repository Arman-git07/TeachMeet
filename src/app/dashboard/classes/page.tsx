
'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlusCircle, School, Users, Trash2, MoreVertical, BookOpen, UserCheck, Settings, Loader2 } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import Image from "next/image";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { CreateClassDialogContent } from "@/components/class/CreateClassDialog";
import { useAuth } from "@/hooks/useAuth";
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot, doc, deleteDoc, DocumentData } from 'firebase/firestore';
import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

interface ClassData {
  id: string;
  name: string;
  subject: string;
  description: string;
  pictureUrl?: string;
  memberCount: number;
}

export default function MyClassesPage() {
  const { user: currentUser, loading: authLoading } = useAuth();
  const [classes, setClasses] = useState<ClassData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreateClassDialogOpen, setIsCreateClassDialogOpen] = useState(false);
  const [classToDelete, setClassToDelete] = useState<ClassData | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (authLoading) return; 
    if (!currentUser) {
      setIsLoading(false);
      return;
    }

    const q = query(collection(db, "classes"), where("hostId", "==", currentUser.uid));
    const unsubscribe = onSnapshot(q, 
      (querySnapshot) => {
        const classesData: ClassData[] = [];
        querySnapshot.forEach((doc: DocumentData) => {
          classesData.push({ id: doc.id, ...doc.data() } as ClassData);
        });
        setClasses(classesData);
        setIsLoading(false);
      },
      (error) => {
        console.error("Error fetching classes:", error);
        toast({
          variant: "destructive",
          title: "Error Loading Classes",
          description: "Could not fetch your classes from the database. Please check your connection and Firestore security rules.",
        });
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [currentUser, authLoading, toast]);
  
  const handleDeleteClass = async () => {
    if (!classToDelete) return;

    try {
      await deleteDoc(doc(db, "classes", classToDelete.id));
      toast({
        title: "Class Deleted",
        description: `The class "${classToDelete.name}" has been successfully deleted.`,
      });
    } catch (error: any) {
      console.error("Error deleting class:", error);
      toast({
        variant: "destructive",
        title: "Deletion Failed",
        description: error.message || "Could not delete the class. Please try again.",
      });
    } finally {
      setClassToDelete(null);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">My Classes</h1>
          <p className="text-muted-foreground">Manage your virtual classrooms.</p>
        </div>
        <div className="flex items-center gap-2">
            <Dialog open={isCreateClassDialogOpen} onOpenChange={setIsCreateClassDialogOpen}>
              <DialogTrigger asChild>
                <Button className="btn-gel rounded-lg">
                  <PlusCircle className="mr-2 h-5 w-5" /> Create New Class
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-lg rounded-xl">
                <DialogHeader>
                  <DialogTitle>Create a New Class</DialogTitle>
                </DialogHeader>
                <CreateClassDialogContent setDialogOpen={setIsCreateClassDialogOpen} />
              </DialogContent>
            </Dialog>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-full">
                  <MoreVertical />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="rounded-lg">
                <DropdownMenuItem><UserCheck className="mr-2 h-4 w-4" /> My Joined Classes</DropdownMenuItem>
                <DropdownMenuItem><BookOpen className="mr-2 h-4 w-4" /> My Class Requests</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/dashboard/settings?highlight=classSettings">
                    <Settings className="mr-2 h-4 w-4" /> Class Settings
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center py-12">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </div>
      ) : classes.length === 0 ? (
        <Card className="text-center py-12 rounded-xl shadow-lg border-border/50">
          <CardHeader>
            <School className="mx-auto h-16 w-16 text-muted-foreground mb-4" />
            <CardTitle className="text-2xl">No Classes Yet</CardTitle>
            <CardDescription>You haven&apos;t created any classes.</CardDescription>
          </CardHeader>
          <CardContent>
            <Dialog open={isCreateClassDialogOpen} onOpenChange={setIsCreateClassDialogOpen}>
              <DialogTrigger asChild>
                <Button size="lg" className="btn-gel rounded-lg">
                  Create Your First Class
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-lg rounded-xl">
                 <DialogHeader>
                  <DialogTitle>Create a New Class</DialogTitle>
                </DialogHeader>
                <CreateClassDialogContent setDialogOpen={setIsCreateClassDialogOpen} />
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {classes.map(cls => (
            <Card key={cls.id} className="flex flex-col rounded-xl shadow-lg hover:shadow-xl transition-shadow duration-300 border-border/50">
               <div className="relative h-40 w-full">
                 <Image
                    src={cls.pictureUrl || `https://placehold.co/400x200.png?text=${cls.subject}`}
                    alt={cls.name}
                    layout="fill"
                    objectFit="cover"
                    className="rounded-t-xl"
                    data-ai-hint="class education"
                 />
                 <div className="absolute top-2 right-2">
                    <Badge variant="secondary" className="backdrop-blur-sm rounded-md">{cls.subject}</Badge>
                 </div>
              </div>
              <CardHeader>
                <CardTitle className="truncate" title={cls.name}>{cls.name}</CardTitle>
                <CardDescription className="line-clamp-2 h-[40px]">{cls.description}</CardDescription>
              </CardHeader>
              <CardContent className="flex-grow">
                <div className="flex items-center text-muted-foreground text-sm">
                  <Users className="mr-2 h-4 w-4" /> {cls.memberCount || 0} Members
                </div>
              </CardContent>
              <CardFooter className="border-t pt-4 grid grid-cols-2 gap-2">
                <Button asChild variant="default" className="w-full btn-gel rounded-lg">
                  <Link href={`/dashboard/class/${cls.id}`}>Enter Class</Link>
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" className="w-full rounded-lg" onClick={() => setClassToDelete(cls)}>
                        <Trash2 className="mr-2 h-4 w-4"/> Delete
                    </Button>
                  </AlertDialogTrigger>
                </AlertDialog>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
       <AlertDialog open={!!classToDelete} onOpenChange={(open) => !open && setClassToDelete(null)}>
          <AlertDialogContent className="rounded-xl">
            <AlertDialogHeader>
              <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently delete the class
                <span className="font-semibold text-foreground"> &quot;{classToDelete?.name}&quot; </span>
                and all of its data.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="rounded-lg" onClick={() => setClassToDelete(null)}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className={cn(buttonVariants({ variant: "destructive", className: "rounded-lg" }))}
                onClick={handleDeleteClass}
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
    </div>
  );
}
