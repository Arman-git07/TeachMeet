
'use client';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button, buttonVariants } from '@/components/ui/button';
import {
  Users,
  PlusCircle,
  BookOpen,
  Settings,
  AlertTriangle,
  Loader2,
  GraduationCap,
  ShieldAlert,
  ClipboardCheck,
  RefreshCw,
} from 'lucide-react';
import Link from 'next/link';
import {
  Dialog,
  DialogContent,
  DialogTrigger,
  DialogClose,
} from '@/components/ui/dialog';
import { CreateClassDialogContent } from '@/components/class/CreateClassDialog';
import { CreateExamDialogContent } from '@/components/exam/CreateExamDialog';
import Image from 'next/image';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useEffect, useState } from 'react';
import { collection, query, where, getDocs, doc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

interface ClassData {
    id: string;
    name: string;
    subject: string;
    teacherName: string;
    studentCount: number;
    bannerUrl?: string;
    creatorId: string;
}


export default function ClassesPage() {
    const { user, loading: authLoading } = useAuth();
    const { toast } = useToast();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [classes, setClasses] = useState<ClassData[]>([]);
    const [isLoadingClasses, setIsLoadingClasses] = useState(true);
    const [isTeacherCardActive, setIsTeacherCardActive] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

    useEffect(() => {
        const checkTeacherStatus = async () => {
            if (user) {
                if (classes.length > 0) {
                  setIsTeacherCardActive(true);
                } else {
                  const storedStatus = localStorage.getItem(`teacher_status_${user.uid}`);
                  setIsTeacherCardActive(storedStatus === 'active');
                }
            }
        };
        checkTeacherStatus();
    }, [user, classes]);


    useEffect(() => {
        if (!user || authLoading) {
            if (!authLoading) setIsLoadingClasses(false);
            return;
        };

        const fetchClasses = async () => {
            setIsLoadingClasses(true);
            setError(null);
            try {
                const q = query(collection(db, 'classes'), where('creatorId', '==', user.uid));
                const querySnapshot = await getDocs(q);
                const fetchedClasses: ClassData[] = [];
                querySnapshot.forEach((doc) => {
                    const data = doc.data();
                    fetchedClasses.push({
                        id: doc.id,
                        name: data.name,
                        subject: data.subject,
                        teacherName: data.teacherName,
                        studentCount: data.studentCount || 0,
                        bannerUrl: data.bannerUrl,
                        creatorId: data.creatorId,
                    });
                });
                setClasses(fetchedClasses);
            } catch (err: any) {
                console.error("[ClassesPage] Firestore Error fetching classes:", err);
                setError("You don't have permission to view classes. This is usually due to your Firebase project setup, not a bug in the app. Please see the checklist below.");
                toast({
                    variant: "destructive",
                    title: "Permissions Error",
                    description: "Could not fetch classes due to a permissions issue. Ensure your Firestore security rules are correctly configured.",
                    duration: 10000,
                });
            } finally {
                setIsLoadingClasses(false);
            }
        };

        fetchClasses();
    }, [user, authLoading, toast]);
    
    const handleActivateTeacherCard = async () => {
        if (!user) return;
        setIsSubmitting(true);
        await new Promise(resolve => setTimeout(resolve, 1500));
        setIsSubmitting(false);
        setIsTeacherCardActive(true);
        localStorage.setItem(`teacher_status_${user.uid}`, 'active');
        toast({
            title: "Teacher Profile Activated!",
            description: "You can now create and manage classes.",
        });
    };
    
    const handleDeleteClass = async () => {
        if (!showDeleteConfirm) return;
        console.log(`[Mock] Deleting class ${showDeleteConfirm}`);
        setClasses(prev => prev.filter(c => c.id !== showDeleteConfirm));
        toast({ title: 'Class Deleted', description: 'The class has been removed.' });
        setShowDeleteConfirm(null);
    };

    if (authLoading || isLoadingClasses) {
        return (
             <div className="space-y-8">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <Skeleton className="h-9 w-48 mb-2" />
                        <Skeleton className="h-5 w-64" />
                    </div>
                    <Skeleton className="h-12 w-48 rounded-lg" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {[...Array(3)].map((_, i) => (
                         <Card key={i} className="rounded-xl shadow-lg">
                            <CardHeader>
                               <Skeleton className="h-36 w-full" />
                            </CardHeader>
                            <CardContent className="space-y-2">
                                <Skeleton className="h-6 w-3/4" />
                                <Skeleton className="h-4 w-1/2" />
                                <Skeleton className="h-4 w-1/4" />
                            </CardContent>
                             <CardFooter>
                                <Skeleton className="h-10 w-full" />
                             </CardFooter>
                        </Card>
                    ))}
                </div>
            </div>
        )
    }
    
    if (error) {
        const firestoreRules = `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      // This rule allows anyone to read and write.
      // NOT FOR PRODUCTION. For development only.
      allow read, write: if true;
    }
  }
}`;
        return (
            <Card className="max-w-3xl mx-auto my-12 text-center rounded-xl shadow-2xl border-2 border-destructive/50 bg-destructive/5">
                <CardHeader className="p-6">
                    <ClipboardCheck className="mx-auto h-16 w-16 text-primary" />
                    <CardTitle className="text-3xl text-destructive font-bold mt-4">Permissions Error Detected</CardTitle>
                    <CardDescription className="text-lg text-foreground/90 mt-2 max-w-xl mx-auto">
                        The app can't access your database because of Firestore's security rules. This is a standard part of Firebase setup.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6 text-left p-6">
                    <div className="space-y-2">
                        <p className="font-semibold text-lg">1. Go to your Firestore Rules</p>
                        <a
                            href={`https://console.firebase.google.com/project/${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}/firestore/rules`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={cn(buttonVariants({ variant: 'outline' }), "w-full rounded-lg")}
                        >
                            Open Firestore Rules Tab &rarr;
                        </a>
                    </div>
                    <div className="space-y-2">
                        <p className="font-semibold text-lg">2. Paste these development rules and "Publish"</p>
                        <p className="text-muted-foreground text-sm">
                            I have also added this rule to a new `firestore.rules` file in your project for reference.
                        </p>
                        <code className="relative rounded bg-muted px-[0.3rem] py-[0.2rem] font-mono text-sm font-semibold block whitespace-pre-wrap">
                            {firestoreRules}
                        </code>
                    </div>
                </CardContent>
                <CardFooter className="p-6 border-t">
                    <Button onClick={() => window.location.reload()} className="w-full btn-gel rounded-lg" size="lg">
                        <RefreshCw className="mr-2 h-4 w-4" />
                        I've published the new rules, Retry Connection
                    </Button>
                </CardFooter>
            </Card>
        );
    }

    return (
        <div className="space-y-8">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-foreground">My Classes</h1>
                    <p className="text-muted-foreground">Manage your classes, assignments, and students.</p>
                </div>
                {isTeacherCardActive && (
                 <div className="flex gap-2">
                    <Dialog>
                        <DialogTrigger asChild>
                            <Button variant="outline" className="rounded-lg">
                               <ShieldAlert className="mr-2 h-5 w-5" /> Create New Exam
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-xl rounded-xl">
                           <CreateExamDialogContent />
                        </DialogContent>
                    </Dialog>
                    <Dialog>
                        <DialogTrigger asChild>
                            <Button className="btn-gel rounded-lg">
                                <PlusCircle className="mr-2 h-5 w-5" /> Create New Class
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-xl rounded-xl">
                            <CreateClassDialogContent />
                        </DialogContent>
                    </Dialog>
                 </div>
                )}
            </div>

            {classes.length === 0 && !isTeacherCardActive ? (
                 <Card className="text-center py-12 flex flex-col items-center rounded-xl shadow-2xl border-primary/30 bg-gradient-to-br from-background via-background to-primary/10">
                    <CardHeader>
                        <GraduationCap className="mx-auto h-16 w-16 text-primary mb-4" />
                        <CardTitle className="text-2xl">Become a Teacher on TeachMeet</CardTitle>
                        <CardDescription>Activate your teacher profile to create and manage classes.</CardDescription>
                    </CardHeader>
                    <CardContent className="max-w-md">
                        <p className="text-muted-foreground mb-6">
                            By activating your teacher profile, you'll unlock all the tools needed to run your online classroom, including creating assignments, sharing materials, and managing students. A one-time activation fee is required.
                        </p>
                    </CardContent>
                     <CardFooter>
                        <Dialog>
                            <DialogTrigger asChild>
                                <Button size="lg" className="btn-gel rounded-lg text-lg">
                                    Activate Teacher Profile
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-md rounded-xl">
                                <Card className="border-0 shadow-none">
                                    <CardHeader className="text-center">
                                         <DialogTitle>Confirm Activation</DialogTitle>
                                         <DialogDescription>
                                            You are about to activate your teacher profile.
                                         </DialogDescription>
                                    </CardHeader>
                                    <CardContent className="text-center">
                                         <p className="text-4xl font-bold">$49.99</p>
                                         <p className="text-sm text-muted-foreground">One-time payment</p>
                                    </CardContent>
                                    <CardFooter className="flex-col gap-2">
                                        <Button onClick={handleActivateTeacherCard} className="w-full btn-gel rounded-lg" disabled={isSubmitting}>
                                            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                            {isSubmitting ? 'Processing...' : 'Pay and Activate (Mock)'}
                                        </Button>
                                         <DialogClose asChild>
                                            <Button variant="outline" className="w-full rounded-lg">Cancel</Button>
                                         </DialogClose>
                                    </CardFooter>
                                </Card>
                            </DialogContent>
                        </Dialog>
                     </CardFooter>
                </Card>
            ) : classes.length === 0 && isTeacherCardActive ? (
                 <Card className="text-center py-12 rounded-xl shadow-lg border-border/50">
                    <CardHeader>
                        <BookOpen className="mx-auto h-16 w-16 text-muted-foreground mb-4" />
                        <CardTitle className="text-2xl">No Classes Yet</CardTitle>
                        <CardDescription>You haven&apos;t created any classes.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Dialog>
                            <DialogTrigger asChild>
                                <Button size="lg" className="btn-gel rounded-lg">
                                    Create Your First Class
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-xl rounded-xl">
                               <CreateClassDialogContent />
                            </DialogContent>
                        </Dialog>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {classes.map(cls => (
                        <Card key={cls.id} className="flex flex-col rounded-xl shadow-lg hover:shadow-xl transition-shadow duration-300 border-border/50">
                             <CardHeader className="p-0 overflow-hidden">
                                <Link href={`/dashboard/class/${cls.id}`} passHref>
                                    <div className="relative h-36 w-full cursor-pointer">
                                        <Image
                                            src={cls.bannerUrl || 'https://placehold.co/400x200.png'}
                                            alt={cls.name}
                                            layout="fill"
                                            objectFit="cover"
                                            className="rounded-t-xl"
                                            data-ai-hint="class banner"
                                        />
                                    </div>
                                </Link>
                            </CardHeader>
                            <CardContent className="pt-4 flex-grow">
                                <h3 className="text-xl font-semibold text-foreground truncate" title={cls.name}>{cls.name}</h3>
                                <p className="text-sm text-muted-foreground">{cls.subject}</p>
                                <div className="mt-2 flex items-center text-sm text-muted-foreground">
                                    <Users className="mr-2 h-4 w-4" />
                                    <span>{cls.studentCount} Student{cls.studentCount !== 1 && 's'}</span>
                                </div>
                            </CardContent>
                            <CardFooter className="border-t pt-4 grid grid-cols-2 gap-2">
                                <Link href={`/dashboard/class/${cls.id}`} passHref legacyBehavior>
                                    <Button asChild className="w-full rounded-lg">
                                       <a>View Class</a>
                                    </Button>
                                </Link>
                                 <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="outline" className="w-full rounded-lg">
                                            <Settings className="mr-2 h-4 w-4" /> Manage
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="rounded-lg">
                                        <DropdownMenuItem asChild><Link href={`/dashboard/class/${cls.id}/edit`} className="cursor-pointer">Edit Class</Link></DropdownMenuItem>
                                        <DropdownMenuItem asChild><Link href={`/dashboard/class/${cls.id}/manage-members`} className="cursor-pointer">Manage Members</Link></DropdownMenuItem>
                                        <DropdownMenuItem className="text-destructive focus:bg-destructive/10 focus:text-destructive cursor-pointer" onClick={() => setShowDeleteConfirm(cls.id)}>
                                            Delete Class
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </CardFooter>
                        </Card>
                    ))}
                </div>
            )}
            
            <AlertDialog open={!!showDeleteConfirm} onOpenChange={(open) => !open && setShowDeleteConfirm(null)}>
                <AlertDialogContent className="rounded-xl">
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This action cannot be undone. This will permanently delete the class and all of its associated data.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setShowDeleteConfirm(null)} className="rounded-lg">Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          className={cn(buttonVariants({ variant: 'destructive', className: 'rounded-lg' }))}
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

    