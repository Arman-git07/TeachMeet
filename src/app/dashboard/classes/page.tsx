
// src/app/dashboard/classes/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle as ShadAlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Users as UsersIcon, Edit, ArrowRight, Loader2, Filter, ChevronDown, MoreVertical, UserCheck, Trash2, BookOpen, Sparkles, LogIn, CheckCircle } from "lucide-react";
import Image from "next/image";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from '@/hooks/useAuth';
import { db, storage } from '@/lib/firebase';
import { ref as storageRef, deleteObject as deleteStorageObject } from "firebase/storage";
import { collection, query, where, getDocs, doc, orderBy, getDoc, deleteDoc, updateDoc, arrayUnion } from 'firebase/firestore';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import Link from 'next/link';
import { CreateClassDialog } from '@/components/class/CreateClassDialog';

interface Classroom {
  id: string;
  name: string;
  teacherName: string;
  teacherId: string;
  teacherAvatar?: string;
  description: string;
  memberCount: number;
  thumbnailUrl: string;
  dataAiHint?: string;
  createdAt: any;
  isRequestedByCurrentUser?: boolean; // Client-side flag
  joinRequestDetails?: { userId: string; userName: string; userAvatar?: string; requestedAt: any; }[]; // The actual request data
  members?: { [userId: string]: { role: 'student' | 'teacher' } };
  pendingRequestCount?: number;
  subjects?: { subjectName: string }[];
}


const getInitialsFromName = (name: string, defaultInitial: string = 'P'): string => {
  if (!name || typeof name !== 'string') return defaultInitial;
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return defaultInitial;

  if (words.length === 1) {
    return words[0].substring(0, 2).toUpperCase() || defaultInitial;
  } else {
    const firstInitial = words[0][0];
    const lastInitial = words[words.length - 1][0];
    return (firstInitial + lastInitial).toUpperCase();
  }
};

const filterOptionsConfig = [
    { value: "all", label: "Explore All Classes", icon: Filter, requiresAuth: false, requiresTeacher: false },
    { value: "teaching", label: "My Teaching", icon: UsersIcon, requiresAuth: true, requiresTeacher: true },
    { value: "joined", label: "My Joined Classes", icon: UsersIcon, requiresAuth: true, requiresTeacher: false },
    { value: "requested", label: "My Requests", icon: UserCheck, requiresAuth: true, requiresTeacher: false }, // Available to students too
];


export default function ClassesPage() {
  const { toast } = useToast();
  const { user, loading: authLoading, isAuthenticated } = useAuth();
  const router = useRouter();
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [displayClassrooms, setDisplayClassrooms] = useState<Classroom[]>([]);
  const [activeFilter, setActiveFilter] = useState<string>("all");
  const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  const [isDeleteClassConfirmOpen, setIsDeleteClassConfirmOpen] = useState(false);
  const [classToDelete, setClassToDelete] = useState<Classroom | null>(null);
  const [isProcessingDelete, setIsProcessingDelete] = useState(false);
  
  const [hasTeacherCard, setHasTeacherCard] = useState(false);
  const [isTeacherCardDialogOpen, setIsTeacherCardDialogOpen] = useState(false);

  useEffect(() => {
    if (user) {
      // In a real app, you'd fetch this from the user's Firestore document.
      const mockTeacherStatus = localStorage.getItem('mock_teacher_card_status');
      if (mockTeacherStatus === 'active') {
          setHasTeacherCard(true);
      }
    }
  }, [user]);

  const currentFilterOptions = filterOptionsConfig.filter(opt => {
    if (opt.value === 'requested') { return isAuthenticated; }
    if (opt.requiresTeacher) {
      return isAuthenticated && hasTeacherCard;
    }
    if (opt.requiresAuth) {
      return isAuthenticated;
    }
    return true;
  });

  useEffect(() => {
    if (!currentFilterOptions.some(opt => opt.value === activeFilter)) {
      setActiveFilter("all");
    }
  }, [currentFilterOptions, activeFilter]);


  const handleActivateTeacherCard = () => {
    toast({
        title: "Payment Successful (Mock)",
        description: "Your Teacher Card is now active for 1 month! Payments can be sent to developer's UPI: 07arman2004-1@oksbi",
        duration: 8000
    });
    localStorage.setItem('mock_teacher_card_status', 'active');
    setHasTeacherCard(true);
    setIsTeacherCardDialogOpen(false);
  }

  useEffect(() => {
    const fetchClassrooms = async () => {
      if (authLoading || (activeFilter !== 'all' && !isAuthenticated)) {
        if (!isAuthenticated) {
            setClassrooms([]);
            setInitialLoading(false);
        }
        return;
      }
      setInitialLoading(true);
      try {
        let q;
        // To permanently fix "insufficient permissions" errors caused by missing indexes,
        // we will only apply filtering at the database level.
        // ALL sorting will be handled on the client-side. This is more robust.
        if (activeFilter === 'teaching' && user) {
          q = query(collection(db, "classrooms"), where("teacherId", "==", user.uid));
        } else {
          // For all other filters, fetch all documents without ordering from the database.
          q = query(collection(db, "classrooms"));
        }

        const querySnapshot = await getDocs(q);
        const fetchedClassroomsPromises = querySnapshot.docs.map(async (docSnap) => {
          const data = docSnap.data();
          const joinRequestDetails = data.joinRequests || [];

          const classroomData: Classroom = {
            id: docSnap.id,
            name: data.name,
            teacherName: data.teacherName,
            teacherId: data.teacherId,
            teacherAvatar: data.teacherAvatar,
            description: data.description,
            memberCount: data.memberCount || 0,
            thumbnailUrl: data.thumbnailUrl,
            dataAiHint: data.dataAiHint,
            createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt),
            subjects: data.subjects || [],
            members: {},
            joinRequestDetails: joinRequestDetails,
          };
          
          if (user) {
            classroomData.isRequestedByCurrentUser = joinRequestDetails.some((req: any) => req.userId === user.uid);
            
            const memberRef = doc(db, "classrooms", docSnap.id, "members", user.uid);
            const memberSnap = await getDoc(memberRef);
            if (memberSnap.exists()) {
              classroomData.members![user.uid] = { role: memberSnap.data()?.role || 'student' };
            }
            
            if (data.teacherId === user.uid) {
                classroomData.pendingRequestCount = joinRequestDetails.length;
            }
          }
          return classroomData;
        });
        
        let fetchedClassrooms = await Promise.all(fetchedClassroomsPromises);
        
        // Always sort client-side to ensure consistent ordering and avoid index issues.
        fetchedClassrooms.sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0));

        setClassrooms(fetchedClassrooms);

      } catch (error: any) {
        console.error("Error fetching classrooms: ", error);
        let desc = "Could not fetch classrooms.";
        if (error.code === 'permission-denied' || (error.message && error.message.includes('index'))) {
          desc = "Permission denied or a required database index is missing. Please check Firestore security rules and indexes.";
        }
        toast({ variant: "destructive", title: "Error", description: desc });
      } finally {
        setInitialLoading(false);
      }
    };
    fetchClassrooms();
  }, [user, authLoading, activeFilter, toast, isAuthenticated]);


  useEffect(() => {
    if (initialLoading || authLoading) {
      setDisplayClassrooms([]);
      return;
    }

    let filteredClassrooms = classrooms;

    if (activeFilter === 'requested' && user) {
        if (hasTeacherCard) {
            filteredClassrooms = classrooms.filter(cls => cls.teacherId === user.uid && (cls.pendingRequestCount || 0) > 0);
        } else {
            filteredClassrooms = classrooms.filter(cls => cls.isRequestedByCurrentUser && cls.teacherId !== user.uid);
        }
    } else if (activeFilter === 'joined' && user) {
      filteredClassrooms = classrooms.filter(cls => cls.members && cls.members![user.uid] && cls.teacherId !== user.uid);
    } else if (activeFilter === 'teaching' && user) {
       filteredClassrooms = classrooms.filter(cls => cls.teacherId === user.uid);
    }

    setDisplayClassrooms(filteredClassrooms);

  }, [classrooms, user, activeFilter, initialLoading, authLoading, hasTeacherCard]);

  const handleRequestToJoin = async (classId: string, className: string) => {
    if (!user) {
      toast({ variant: "destructive", title: "Authentication Required", description: "Please sign in to request to join a class." });
      return;
    }
  
    const classToUpdate = classrooms.find(c => c.id === classId);
    if (!classToUpdate) {
      toast({ variant: "destructive", title: "Error", description: "Class not found." });
      return;
    }
  
    if (classToUpdate.members && classToUpdate.members[user.uid]) {
      toast({ title: "Already a Member", description: `You are already a member of "${className}".` });
      return;
    }
    if (classToUpdate.isRequestedByCurrentUser) {
      toast({ title: "Request Already Sent", description: `You have already requested to join "${className}".` });
      return;
    }
  
    try {
      const classroomRef = doc(db, "classrooms", classId);
      const requestPayload = {
        userId: user.uid,
        userName: user.displayName || user.email,
        userAvatar: user.photoURL,
        requestedAt: new Date(),
      };
      
      await updateDoc(classroomRef, {
        joinRequests: arrayUnion(requestPayload)
      });
  
      setClassrooms(prev => prev.map(cls =>
        cls.id === classId ? { 
          ...cls, 
          isRequestedByCurrentUser: true, 
          joinRequestDetails: [...(cls.joinRequestDetails || []), requestPayload]
        } : cls
      ));
  
      toast({ title: "Request Sent!", description: `Your request to join "${className}" has been sent.` });
    } catch (error: any) {
      console.error("Error sending join request:", error);
      let desc = (error as Error).message;
      if (error.code === 'permission-denied') {
        desc = "Permission denied sending join request. Check Firestore rules for 'classrooms' collection updates.";
      }
      toast({ variant: "destructive", title: "Request Failed", description: desc });
    }
  };


  const handleNavigateToEditClass = (classToEdit: Classroom) => {
    router.push(`/dashboard/class/${classToEdit.id}/edit?name=${encodeURIComponent(classToEdit.name)}`);
  };

  const handleViewClass = (classId: string, className: string) => {
    router.push(`/dashboard/class/${classId}?name=${encodeURIComponent(className)}`);
  };

  const openDeleteClassDialog = (classroom: Classroom) => {
    setClassToDelete(classroom);
    setIsDeleteClassConfirmOpen(true);
  };

  const confirmDeleteClass = async () => {
    if (!classToDelete || !user || classToDelete.teacherId !== user.uid) {
      toast({ variant: "destructive", title: "Error", description: "Cannot delete class." });
      return;
    }
    setIsProcessingDelete(true);
    try {
      if (classToDelete.thumbnailUrl && !classToDelete.thumbnailUrl.includes('placehold.co')) {
        try {
          const thumbnailStorageRef = storageRef(storage, classToDelete.thumbnailUrl);
          await deleteObject(thumbnailStorageRef);
        } catch (storageError: any) {
          if (storageError.code === 'storage/object-not-found') {
            console.warn(`[ClassesPage] Thumbnail not found, skipping deletion.`);
          } else {
            console.error(`[ClassesPage] Error deleting thumbnail:`, storageError);
            toast({ variant: "warning", title: "Thumbnail Deletion Issue", description: "Could not delete class image, but will proceed." });
          }
        }
      }

      await deleteDoc(doc(db, "classrooms", classToDelete.id));
      toast({ title: "Class Deleted", description: `"${classToDelete.name}" has been deleted.` });
      toast({
        variant: "info",
        title: "Subcollections & Files",
        description: "Note: Class members, announcements, materials, assignments, and their uploaded files are not automatically deleted.",
        duration: 10000,
      });

      setClassrooms(prev => prev.filter(c => c.id !== classToDelete!.id));
    } catch (error: any) {
      console.error("Error deleting class:", error);
      let desc = "Could not delete class.";
      if (error.code === 'permission-denied') {
          desc = "Permission denied deleting class. Check Firestore/Storage rules.";
      }
      toast({ variant: "destructive", title: "Deletion Failed", description: desc });
    } finally {
      setIsDeleteClassConfirmOpen(false);
      setClassToDelete(null);
      setIsProcessingDelete(false);
    }
  };

  const activeFilterLabel = currentFilterOptions.find(opt => opt.value === activeFilter)?.label || "Explore All Classes";

  return (
    <div className="space-y-8 p-4 md:p-8 h-full flex flex-col">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Explore Classes</h1>
          <p className="text-muted-foreground">Discover classrooms or create your own.</p>
        </div>
        <div className="flex items-center gap-2">
             <CreateClassDialog hasTeacherCard={hasTeacherCard} onOpenTeacherCardDialog={() => setIsTeacherCardDialogOpen(true)} />
        </div>
      </div>

      <div className="my-4 flex items-center gap-2">
        <DropdownMenu open={isFilterDropdownOpen} onOpenChange={setIsFilterDropdownOpen}>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="rounded-lg text-sm">
              {activeFilterLabel}
              <ChevronDown className="ml-2 h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-60 rounded-xl">
            {currentFilterOptions.map(option => (
                <DropdownMenuItem
                    key={option.value}
                    onClick={() => {
                        setActiveFilter(option.value);
                        setIsFilterDropdownOpen(false);
                    }}
                    className={cn(
                    "cursor-pointer rounded-md p-2 text-sm",
                    activeFilter === option.value && "bg-accent text-accent-foreground"
                    )}
                >
                    <option.icon className="mr-2 h-4 w-4 opacity-70" />
                    {option.label}
                </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {(initialLoading || authLoading ) ? (
         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 flex-grow overflow-y-auto pb-4">
          {[...Array(3)].map((_, i) => (
            <Card key={i} className="flex flex-col rounded-xl shadow-lg border-border/50">
              <Skeleton className="h-40 w-full rounded-t-xl" />
              <CardHeader className="pb-2 pt-4">
                <Skeleton className="h-5 w-3/4 mb-1 rounded-md" />
                <div className="flex items-center pt-1">
                  <Skeleton className="h-6 w-6 mr-2 rounded-full" />
                  <Skeleton className="h-4 w-1/2 rounded-md" />
                </div>
              </CardHeader>
              <CardContent className="flex-grow min-h-[60px]">
                <Skeleton className="h-4 w-full mb-1 rounded-md" />
                <Skeleton className="h-4 w-5/6 rounded-md" />
              </CardContent>
              <CardFooter className="border-t pt-3 flex flex-col items-stretch gap-2">
                <Skeleton className="h-9 w-full rounded-lg" />
              </CardFooter>
            </Card>
          ))}
        </div>
      ) : displayClassrooms.length === 0 ? (
        <Card className="text-center py-12 rounded-xl shadow-lg border-border/50 flex-grow flex flex-col justify-center items-center">
          <CardHeader>
            <UsersIcon className="mx-auto h-16 w-16 text-muted-foreground mb-4" />
            <CardTitle className="text-2xl">
                {activeFilter === 'teaching' && "No Classes Taught"}
                {activeFilter === 'joined' && "No Matching Classes"}
                {activeFilter === 'requested' && (hasTeacherCard ? "No Pending Requests" : "No Matching Classes")}
                {activeFilter === 'all' && classrooms.length > 0 && "No Classes for this Filter"}
                {activeFilter === 'all' && classrooms.length === 0 && "No Classes Available"}
            </CardTitle>
            <CardDescription>
                {activeFilter === 'teaching' && "You haven't created any classes yet. Start one now!"}
                {activeFilter === 'joined' && `You haven't joined any classes that match this filter.`}
                {activeFilter === 'requested' && (hasTeacherCard ? "There are no new student requests to join your classes." : "You haven't requested to join any classes, or your requests have been processed.")}
                {activeFilter === 'all' && classrooms.length > 0 && "Try a different filter or check back later."}
                {activeFilter === 'all' && classrooms.length === 0 && "There are no classes listed right now. Be the first to create one!"}
            </CardDescription>
          </CardHeader>
          <CardContent>
             <CreateClassDialog hasTeacherCard={hasTeacherCard} onOpenTeacherCardDialog={() => setIsTeacherCardDialogOpen(true)} triggerButton={<Button size="lg" className="btn-gel rounded-lg">Create a Class</Button>} />
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 flex-grow overflow-y-auto pb-4">
          {displayClassrooms.map(classroom => {
            const isTeacher = user && user.uid === classroom.teacherId;
            const isRequested = classroom.isRequestedByCurrentUser;
            const isMember = user && classroom.members && classroom.members[user.uid];
            const showPendingBadge = isRequested && !isMember && !isTeacher;
            const showJoinedBadge = isMember && !isTeacher;
            const hasPendingRequests = isTeacher && (classroom.pendingRequestCount || 0) > 0;

            let actionButton;
            if (isTeacher || isMember) {
                actionButton = (
                    <Button onClick={() => handleViewClass(classroom.id, classroom.name)} className="w-full btn-gel rounded-lg text-sm">
                         <ArrowRight className="mr-2 h-4 w-4" /> {isTeacher ? 'View Details' : 'View Class'}
                    </Button>
                );
            } else if (isRequested) {
                actionButton = (
                    <Button disabled className="w-full rounded-lg text-sm bg-green-600 hover:bg-green-700 text-white">
                        <CheckCircle className="mr-2 h-4 w-4" /> Request Sent
                    </Button>
                );
            } else {
                actionButton = (
                    <Button onClick={() => handleRequestToJoin(classroom.id, classroom.name)} className="w-full btn-gel rounded-lg text-sm">
                         <ArrowRight className="mr-2 h-4 w-4" /> Request to Join
                    </Button>
                );
            }

            return (
            <Card key={classroom.id} className="flex flex-col rounded-xl shadow-lg hover:shadow-primary/20 transition-shadow duration-300 ease-in-out border-border/50 relative">
              <div className="absolute top-2 right-2 z-10">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full bg-card/70 hover:bg-muted text-muted-foreground hover:text-foreground relative">
                        {hasPendingRequests && <div className="absolute top-0 right-0 h-2.5 w-2.5 rounded-full bg-accent ring-2 ring-card" title={`${classroom.pendingRequestCount} pending requests`} />}
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="rounded-lg">
                      <DropdownMenuItem onClick={() => handleViewClass(classroom.id, classroom.name)} className="rounded-md">
                        <ArrowRight className="mr-2 h-4 w-4" /> View Details
                      </DropdownMenuItem>
                      {isTeacher && (
                        <>
                          <DropdownMenuItem onClick={() => handleNavigateToEditClass(classroom)} className="rounded-md">
                            <Edit className="mr-2 h-4 w-4" /> Edit Class
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <Link href={`/dashboard/class/${classroom.id}/manage-members?name=${encodeURIComponent(classroom.name)}`} className="rounded-md w-full relative flex items-center cursor-default">
                                <UsersIcon className="mr-2 h-4 w-4" /> Manage Roster
                                {hasPendingRequests && <Badge variant="destructive" className="absolute right-2 top-1/2 -translate-y-1/2 h-5 px-1.5 text-xs">{classroom.pendingRequestCount}</Badge>}
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => openDeleteClassDialog(classroom)} className="text-destructive focus:text-destructive rounded-md">
                            <Trash2 className="mr-2 h-4 w-4" /> Delete Class
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              <div className="relative h-40 w-full">
                 <Image
                    src={classroom.thumbnailUrl}
                    alt={classroom.name}
                    layout="fill"
                    objectFit="cover"
                    className="rounded-t-xl opacity-80 group-hover:opacity-100 transition-opacity"
                    data-ai-hint={classroom.thumbnailUrl.includes('placehold.co') && classroom.thumbnailUrl.includes('?text=') ? undefined : classroom.dataAiHint || "education classroom"}
                 />
                {showPendingBadge ? (
                    <Badge variant="outline" className="text-orange-600 border-orange-500/50 bg-orange-500/10 absolute top-2 left-2 text-xs px-2 py-0.5 rounded-md shadow-sm">
                    Pending Request
                    </Badge>
                ) : isTeacher && !showJoinedBadge ? (
                    <Badge variant="secondary" className="absolute top-2 left-2 text-xs px-2 py-0.5 rounded-md shadow-sm">
                    My Class
                    </Badge>
                ) : showJoinedBadge ? (
                     <Badge variant="default" className="bg-green-500/80 text-white absolute top-2 left-2 text-xs px-2 py-0.5 rounded-md shadow-sm">
                       Joined
                    </Badge>
                ) : null}
              </div>
              <CardHeader className="pb-2 pt-4">
                <CardTitle className="text-lg truncate leading-tight" title={classroom.name}>{classroom.name}</CardTitle>
                <div className="flex items-center pt-1">
                    <Avatar className="h-6 w-6 mr-2">
                        <AvatarImage src={classroom.teacherAvatar} alt={classroom.teacherName} data-ai-hint="teacher avatar"/>
                        <AvatarFallback>{getInitialsFromName(classroom.teacherName, "T")}</AvatarFallback>
                    </Avatar>
                    <CardDescription className="text-xs text-muted-foreground truncate">Managed by {classroom.teacherName}</CardDescription>
                </div>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground flex-grow min-h-[60px]">
                <p className="line-clamp-3">{classroom.description}</p>
              </CardContent>
              <CardFooter className="border-t pt-3 flex flex-col items-stretch gap-2">
                <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                    <span className="flex items-center"><UsersIcon className="mr-1.5 h-3.5 w-3.5" /> {classroom.memberCount} Members</span>
                    {classroom.subjects && classroom.subjects.length > 0 && (
                      <span className="flex items-center"><BookOpen className="mr-1.5 h-3.5 w-3.5" /> {classroom.subjects.length} Subjects</span>
                    )}
                    {classroom.createdAt && <span className="text-xs text-muted-foreground/80">{new Date(classroom.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>}
                </div>
                {actionButton}
              </CardFooter>
            </Card>
          );
        })}
        </div>
      )}

      <Dialog open={isTeacherCardDialogOpen} onOpenChange={setIsTeacherCardDialogOpen}>
        <DialogContent className="sm:max-w-md rounded-xl">
            <DialogHeader>
                <DialogTitle className="flex items-center text-xl">
                    <Sparkles className="mr-2 h-6 w-6 text-yellow-400" />
                    Unlock Teacher Features
                </DialogTitle>
                <DialogDescription>
                    Subscribe to the Teacher Card to create classes and access all teaching tools.
                </DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-4">
                <Card className="bg-muted/50 border-border/50">
                    <CardHeader>
                        <CardTitle className="text-lg">Teacher Card Benefits</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm text-muted-foreground">
                        <p className="flex items-center"><CheckCircle className="mr-2 h-4 w-4 text-green-500" />Create and manage unlimited classes.</p>
                        <p className="flex items-center"><CheckCircle className="mr-2 h-4 w-4 text-green-500" />Post announcements and materials.</p>
                        <p className="flex items-center"><CheckCircle className="mr-2 h-4 w-4 text-green-500" />Create and grade assignments & exams.</p>
                    </CardContent>
                </Card>
                <div className="text-center">
                    <p className="text-3xl font-bold">$10<span className="text-base font-normal text-muted-foreground">/month (USD)</span></p>
                    <p className="text-lg font-bold">₹10<span className="text-xs font-normal text-muted-foreground">/month (INR)</span></p>
                    <p className="text-xs text-muted-foreground mt-2">Renews monthly. Cancel anytime.</p>
                </div>
            </div>
            <DialogFooter className="flex-col gap-2">
                <Button onClick={handleActivateTeacherCard} className="w-full btn-gel rounded-lg">
                    Pay and Activate (Mock)
                </Button>
                <p className="text-center text-xs text-muted-foreground">
                    For manual payment, send to developer's UPI: <strong>07arman2004-1@oksbi</strong>
                </p>
            </DialogFooter>
        </DialogContent>
      </Dialog>
      
      <AlertDialog open={isDeleteClassConfirmOpen} onOpenChange={setIsDeleteClassConfirmOpen}>
        <AlertDialogContent className="rounded-xl">
          <AlertDialogHeader>
            <ShadAlertDialogTitle>Confirm Delete Class</ShadAlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the class "{classToDelete?.name}"? This action cannot be undone and will remove the class details and main thumbnail.
              <br/><br/>
              <strong className="text-destructive-foreground bg-destructive p-1 rounded-md">Important:</strong> Associated class members, announcements, materials, assignments, and their uploaded files will <strong className="underline">not</strong> be automatically deleted from the database or storage. You may need to set up a Firebase Cloud Function for complete cleanup or manually remove them.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setIsDeleteClassConfirmOpen(false)} className="rounded-lg">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteClass} className={cn("bg-destructive text-destructive-foreground hover:bg-destructive/90", "rounded-lg")} disabled={isProcessingDelete}>
              {isProcessingDelete ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Delete Class
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
