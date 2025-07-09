
'use client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useParams } from "next/navigation";
import React, { useState, useEffect } from "react";
import { Bell, BookOpen, ClipboardList, MessageSquare, Settings, Users, Edit, FileText, CreditCard, Loader2 } from "lucide-react";
import Link from "next/link";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/hooks/useAuth";
import { db } from "@/lib/firebase";
import { doc, onSnapshot, collection, query, orderBy, limit } from "firebase/firestore";
import { Skeleton } from "@/components/ui/skeleton";

interface ClassData {
    name: string;
    description: string;
    creatorId: string;
}

interface Instructor {
    id: string;
    name: string;
    avatar?: string;
    subject: string;
}

interface Announcement {
    id: string;
    title: string;
    content: string;
    date: string; // Should be Firestore Timestamp
}

const navigationItems = [
  { href: 'materials', icon: BookOpen, label: 'Materials' },
  { href: 'assignments', icon: ClipboardList, label: 'Assignments' },
  { href: 'test-and-exams', icon: FileText, label: 'Test & Exams' },
  { href: 'chat', icon: MessageSquare, label: 'Class Chat' },
  { href: 'manage-members', icon: Users, label: 'Members' },
  { href: 'fees', icon: CreditCard, label: 'Class Fees' },
];

export default function ClassHomePage() {
  const params = useParams();
  const classId = params.classId as string;
  const { user: currentUser } = useAuth();
  
  const [classData, setClassData] = useState<ClassData | null>(null);
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!classId) return;

    const unsubs: (() => void)[] = [];
    setIsLoading(true);

    // Fetch class data
    const classDocRef = doc(db, "classes", classId);
    unsubs.push(onSnapshot(classDocRef, (docSnap) => {
        if (docSnap.exists()) {
            const data = docSnap.data() as ClassData;
            setClassData(data);
            // Fetch creator profile for instructor card
            const instructorDocRef = doc(db, "users", data.creatorId);
            onSnapshot(instructorDocRef, (instructorSnap) => {
                if (instructorSnap.exists()) {
                    const instructorData = instructorSnap.data();
                    setInstructors([{
                        id: data.creatorId,
                        name: instructorData.displayName || "Instructor",
                        avatar: instructorData.photoURL || `https://placehold.co/100x100.png?text=${(instructorData.displayName || "I").charAt(0)}`,
                        subject: "Lead Instructor"
                    }]);
                }
            });
        }
        setIsLoading(false);
    }));

    // Fetch announcements
    const announcementsQuery = query(collection(db, "classes", classId, "announcements"), orderBy("createdAt", "desc"), limit(5));
    unsubs.push(onSnapshot(announcementsQuery, (snapshot) => {
        const fetchedAnnouncements: Announcement[] = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            fetchedAnnouncements.push({
                id: doc.id,
                ...data,
                date: data.createdAt?.toDate().toLocaleDateString() || new Date().toLocaleDateString()
            } as Announcement);
        });
        setAnnouncements(fetchedAnnouncements);
    }));
    
    return () => unsubs.forEach(unsub => unsub());
  }, [classId]);

  const isHost = classData?.creatorId === currentUser?.uid;

  if (isLoading) {
    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-8">
                <Skeleton className="h-32 w-full rounded-xl" />
                <Skeleton className="h-64 w-full rounded-xl" />
            </div>
            <div className="space-y-6">
                <Skeleton className="h-48 w-full rounded-xl" />
                <Skeleton className="h-80 w-full rounded-xl" />
            </div>
        </div>
    );
  }
  
  if (!classData) {
    return <div className="text-center">Class not found.</div>;
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <div className="lg:col-span-2 space-y-8">
        <Card className="rounded-xl shadow-lg border-border/50">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-3xl font-bold">{classData.name}</CardTitle>
                <CardDescription className="mt-1">{classData.description}</CardDescription>
              </div>
              {isHost && <Button asChild variant="outline" size="icon" className="rounded-lg flex-shrink-0"><Link href={`/dashboard/class/${classId}/edit`}><Settings className="h-5 w-5" /><span className="sr-only">Class Settings</span></Link></Button>}
            </div>
          </CardHeader>
        </Card>

        <Card className="rounded-xl shadow-lg border-border/50">
          <CardHeader><CardTitle className="flex items-center"><Bell className="mr-2 h-6 w-6 text-primary" />Announcements</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {announcements.length > 0 ? announcements.map((ann, index) => (
              <React.Fragment key={ann.id}>
                <div className="p-4 bg-muted/50 rounded-lg">
                  <div className="flex justify-between items-start"><h3 className="font-semibold text-lg">{ann.title}</h3><p className="text-xs text-muted-foreground">{ann.date}</p></div>
                  <p className="text-muted-foreground mt-1">{ann.content}</p>
                </div>
                {index < announcements.length - 1 && <Separator />}
              </React.Fragment>
            )) : <p className="text-muted-foreground text-center py-4">No announcements yet.</p>}
          </CardContent>
          {isHost && <CardFooter><Button variant="outline" className="w-full rounded-lg" disabled><Edit className="mr-2 h-4 w-4" /> Post New Announcement (Coming Soon)</Button></CardFooter>}
        </Card>
      </div>

      <div className="space-y-6">
        <Card className="rounded-xl shadow-lg border-border/50">
          <CardHeader><CardTitle className="text-lg">Instructors</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {instructors.map((instructor, index) => (
              <React.Fragment key={instructor.id}>
                <div className="flex items-center gap-4">
                  <Avatar className="h-16 w-16"><AvatarImage src={instructor.avatar} alt={instructor.name} data-ai-hint="teacher avatar"/><AvatarFallback>{instructor.name.split(' ').map(n => n[0]).join('')}</AvatarFallback></Avatar>
                  <div><p className="font-semibold">{instructor.name}</p><p className="text-sm text-muted-foreground">{instructor.subject}</p></div>
                </div>
                {index < instructors.length - 1 && <Separator />}
              </React.Fragment>
            ))}
          </CardContent>
        </Card>
        
        <Card className="rounded-xl shadow-lg border-border/50">
           <CardHeader><CardTitle className="text-lg">Classroom Hub</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {navigationItems.map(item => (
              <Button key={item.href} asChild variant="ghost" className="w-full justify-start text-base py-3 px-4 rounded-lg">
                <Link href={`/dashboard/class/${classId}/${item.href}`}><item.icon className="mr-3 h-5 w-5 text-primary" />{item.label}</Link>
              </Button>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
