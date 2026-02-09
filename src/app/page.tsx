
'use client';
import { Logo } from '@/components/common/Logo';
import { SlideUpPanel } from '@/components/common/SlideUpPanel';
import { useState, useEffect, useCallback, useRef } from 'react';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { 
  Video, 
  Users as UsersIcon, 
  XCircle, 
  History, 
  FileText, 
  Clapperboard, 
  Loader2, 
  AtSign, 
  Megaphone, 
  UserPlus, 
  BookOpen, 
  ClipboardList, 
  ClipboardCheck, 
  Bell 
} from 'lucide-react';
import { AppHeader } from '@/components/common/AppHeader';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { collection, query, where, onSnapshot, limit, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export type ActivityItemType = 
  | 'meeting' 
  | 'document' 
  | 'recording' 
  | 'chatMention' 
  | 'announcement' 
  | 'joinRequest' 
  | 'assignment' 
  | 'material' 
  | 'exam';

interface BaseActivityItem {
  id: string;
  type: ActivityItemType;
  title: string;
  timestamp: number;
  classroomId?: string;
  classroomName?: string;
}

export interface JoinRequestActivityItem extends BaseActivityItem {
    type: 'joinRequest';
    requesterName: string;
}

export type ActivityItem = BaseActivityItem | JoinRequestActivityItem;

const DISMISSED_ITEMS_KEY_PREFIX = 'teachmeet-dismissed-items-';
const STARTED_MEETINGS_KEY_PREFIX = 'teachmeet-started-meetings-';
const LATEST_ACTIVITY_KEY_PREFIX = 'teachmeet-latest-activity-';
const TWO_HOURS_IN_MS = 2 * 60 * 60 * 1000;

const itemIcons: Record<ActivityItemType, React.ElementType> = {
  meeting: Video,
  document: FileText,
  recording: Clapperboard,
  chatMention: AtSign,
  announcement: Megaphone,
  joinRequest: UserPlus,
  assignment: ClipboardList,
  material: BookOpen,
  exam: ClipboardCheck,
};

const itemLinks: Record<ActivityItemType, (id: string, item: any) => string> = {
  meeting: (id, item) => `/dashboard/meeting/prejoin?meetingId=${id}&topic=${encodeURIComponent(item.title)}&role=host`,
  document: () => `/dashboard/documents`,
  recording: () => `/dashboard/recordings`,
  chatMention: () => `/dashboard/classrooms`,
  announcement: (id, item) => `/dashboard/classrooms/${item.classroomId}`,
  joinRequest: (id, item) => `/dashboard/classrooms/${item.classroomId}/requests`,
  assignment: (id, item) => `/dashboard/classrooms/${item.classroomId}`,
  material: (id, item) => `/dashboard/classrooms/${item.classroomId}`,
  exam: (id, item) => `/dashboard/classrooms/${item.classroomId}`,
};

export default function HomePage() {
  const [allActivity, setAllActivity] = useState<ActivityItem[]>([]);
  const [firestoreActivity, setFirestoreActivity] = useState<ActivityItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const unsubsRef = useRef<(() => void)[]>([]);
  
  useEffect(() => {
    if (!user || !isAuthenticated) {
        setIsLoading(false);
        return;
    }
    
    setIsLoading(true);
    
    const cleanup = () => {
        unsubsRef.current.forEach(u => u());
        unsubsRef.current = [];
    };

    // 1. Listen to classrooms where user is teacher or creator (to see Join Requests)
    const qManaged = query(collection(db, 'classrooms'), where('teacherId', '==', user.uid));
    const unsubManaged = onSnapshot(qManaged, (snapshot) => {
        const activityMap: Record<string, ActivityItem[]> = {};
        
        snapshot.docs.forEach(classDoc => {
            const classId = classDoc.id;
            const classTitle = classDoc.data().title;
            
            const unsubRequests = onSnapshot(query(collection(db, 'classrooms', classId, 'joinRequests')), (reqSnap) => {
                activityMap[`join-${classId}`] = reqSnap.docs.map(doc => ({
                    id: `join-${classId}-${doc.id}`, 
                    type: 'joinRequest',
                    title: classTitle,
                    timestamp: doc.data().requestedAt?.toMillis() || Date.now(),
                    classroomId: classId,
                    requesterName: doc.data().studentName || 'A new user'
                } as JoinRequestActivityItem));
                updateCombinedFirestoreActivity(activityMap);
            });
            unsubsRef.current.push(unsubRequests);
        });
    });

    // 2. Listen to enrolled classrooms (to see materials, assignments, etc.)
    const qEnrolled = query(collection(db, 'users', user.uid, 'enrolled'));
    const unsubEnrolled = onSnapshot(qEnrolled, (snapshot) => {
        const classActivityMap: Record<string, ActivityItem[]> = {};
        
        snapshot.docs.forEach(enrolledDoc => {
            const classId = enrolledDoc.id;
            const classTitle = enrolledDoc.data().title;

            // Listen to Assignments
            const unsubAssignments = onSnapshot(query(collection(db, 'classrooms', classId, 'assignments'), orderBy('dueDate', 'desc'), limit(5)), (snap) => {
                classActivityMap[`ass-${classId}`] = snap.docs.map(d => ({
                    id: `ass-${d.id}`,
                    type: 'assignment',
                    title: d.data().title,
                    timestamp: d.data().createdAt?.toMillis() || Date.now(),
                    classroomId: classId,
                    classroomName: classTitle
                }));
                updateCombinedFirestoreActivity(classActivityMap);
            });

            // Listen to Materials
            const unsubMaterials = onSnapshot(query(collection(db, 'classrooms', classId, 'materials'), orderBy('uploadedAt', 'desc'), limit(5)), (snap) => {
                classActivityMap[`mat-${classId}`] = snap.docs.map(d => ({
                    id: `mat-${d.id}`,
                    type: 'material',
                    title: d.data().name,
                    timestamp: d.data().uploadedAt?.toMillis() || Date.now(),
                    classroomId: classId,
                    classroomName: classTitle
                }));
                updateCombinedFirestoreActivity(classActivityMap);
            });

            // Listen to Announcements
            const unsubAnnouncements = onSnapshot(query(collection(db, 'classrooms', classId, 'announcements'), orderBy('createdAt', 'desc'), limit(5)), (snap) => {
                classActivityMap[`ann-${classId}`] = snap.docs.map(d => ({
                    id: `ann-${d.id}`,
                    type: 'announcement',
                    title: d.data().text?.substring(0, 50) || 'New Voice Announcement',
                    timestamp: d.data().createdAt?.toMillis() || Date.now(),
                    classroomId: classId,
                    classroomName: classTitle
                }));
                updateCombinedFirestoreActivity(classActivityMap);
            });

            // Listen to Exams
            const unsubExams = onSnapshot(query(collection(db, 'classrooms', classId, 'exams'), orderBy('startDate', 'desc'), limit(5)), (snap) => {
                classActivityMap[`exm-${classId}`] = snap.docs.map(d => ({
                    id: `exm-${d.id}`,
                    type: 'exam',
                    title: d.data().title,
                    timestamp: d.data().createdAt?.toMillis() || Date.now(),
                    classroomId: classId,
                    classroomName: classTitle
                }));
                updateCombinedFirestoreActivity(classActivityMap);
            });

            unsubsRef.current.push(unsubAssignments, unsubMaterials, unsubAnnouncements, unsubExams);
        });
    });

    // 3. Listen to Personal Library
    const unsubDocs = onSnapshot(query(collection(db, 'documents'), where('uploaderId', '==', user.uid), orderBy('createdAt', 'desc'), limit(5)), (snap) => {
        const docs = snap.docs.map(d => ({
            id: `doc-${d.id}`,
            type: 'document',
            title: d.data().name,
            timestamp: d.data().createdAt?.toMillis() || Date.now()
        } as ActivityItem));
        updateCombinedFirestoreActivity({ 'personal-docs': docs });
    });

    const unsubRecs = onSnapshot(query(collection(db, 'recordings'), where('uploaderId', '==', user.uid), orderBy('createdAt', 'desc'), limit(5)), (snap) => {
        const recs = snap.docs.map(d => ({
            id: `rec-${d.id}`,
            type: 'recording',
            title: d.data().name,
            timestamp: d.data().createdAt?.toMillis() || Date.now()
        } as ActivityItem));
        updateCombinedFirestoreActivity({ 'personal-recs': recs });
    });

    unsubsRef.current.push(unsubManaged, unsubEnrolled, unsubDocs, unsubRecs);

    const updateCombinedFirestoreActivity = (newChunks: Record<string, ActivityItem[]>) => {
        setFirestoreActivity(prev => {
            const combinedMap = new Map<string, ActivityItem[]>();
            // This is slightly complex because we're merging multiple real-time streams
            // We'll rely on the loadActivities callback to handle the final flatten and unique
            return Object.values(newChunks).flat();
        });
    };

    return () => cleanup();
  }, [user, isAuthenticated]);
  
  const loadActivities = useCallback(() => {
    if (!user) { setIsLoading(false); setAllActivity([]); return; }
    const DISMISSED_KEY = `${DISMISSED_ITEMS_KEY_PREFIX}${user.uid}`;
    const STARTED_KEY = `${STARTED_MEETINGS_KEY_PREFIX}${user.uid}`;
    const LATEST_KEY = `${LATEST_ACTIVITY_KEY_PREFIX}${user.uid}`;

    const dismissed = JSON.parse(localStorage.getItem(DISMISSED_KEY) || '[]');
    const started = JSON.parse(localStorage.getItem(STARTED_KEY) || '[]');
    const latest = JSON.parse(localStorage.getItem(LATEST_KEY) || '[]');

    const ongoingMeetings = started.filter((m:any) => m && Date.now() - m.startedAt < TWO_HOURS_IN_MS).map((m:any) => ({ 
        type: 'meeting', 
        id: m.id, 
        title: m.title || "Meeting", 
        timestamp: m.startedAt 
    }));
    
    // Merge all sources
    const combined = [...ongoingMeetings, ...latest, ...firestoreActivity]
        .filter(item => item && !dismissed.includes(item.id))
        .sort((a,b) => b.timestamp - a.timestamp);

    // Ensure uniqueness by ID
    const uniqueCombined = combined.reduce((acc: ActivityItem[], current) => {
        const x = acc.find(item => item.id === current.id);
        if (!x) {
            return acc.concat([current]);
        } else {
            return acc;
        }
    }, []);

    setAllActivity(uniqueCombined.slice(0, 15)); // Show top 15 activities
    setIsLoading(false);
  }, [user, firestoreActivity]);

  useEffect(() => {
    if (!authLoading) {
        if (isAuthenticated) {
            loadActivities();
            window.addEventListener('teachmeet_activity_updated', loadActivities);
            return () => window.removeEventListener('teachmeet_activity_updated', loadActivities);
        } else {
            setIsLoading(false);
        }
    }
  }, [authLoading, isAuthenticated, loadActivities]);

  const handleDismiss = (id: string) => {
    const key = `${DISMISSED_ITEMS_KEY_PREFIX}${user?.uid}`;
    const dismissed = JSON.parse(localStorage.getItem(key) || '[]');
    localStorage.setItem(key, JSON.stringify([...dismissed, id]));
    setAllActivity(prev => prev.filter(i => i.id !== id));
  };

  return (
    <div className="flex flex-col min-h-screen">
      <AppHeader showLogo={false} />
      <main className="flex-grow flex flex-col items-center justify-center pt-16 sm:pt-4 relative pb-[18rem]">
        <div className="relative z-10 flex w-full flex-col items-center text-center px-4">
          <Logo size="medium" className="mb-8" />
          <div className="mt-8 p-6 bg-card/50 backdrop-blur-sm rounded-xl shadow-lg w-full max-w-md border border-border/50">
            <h2 className="text-2xl font-semibold text-primary mb-4 flex items-center justify-center">
                <Bell className="mr-3 h-6 w-6" /> Latest Activity
            </h2>
            {authLoading ? (
                <div className="py-8"><Loader2 className="animate-spin h-8 w-8 mx-auto text-primary/50"/></div>
            ) : !isAuthenticated ? (
                <div className="py-12 text-center text-muted-foreground">
                    <p className="text-sm font-medium">No recent activity.</p>
                    <p className="text-xs mt-1">Sign in to track your meetings and classes!</p>
                </div>
            ) : isLoading ? (
                <div className="py-8"><Loader2 className="animate-spin h-8 w-8 mx-auto text-primary/50"/></div>
            ) : allActivity.length > 0 ? (
                <ScrollArea className="max-h-[400px] pr-2">
                    <ul className="space-y-3 text-left">
                    {allActivity.map(item => {
                        const Icon = itemIcons[item.type as ActivityItemType];
                        const link = itemLinks[item.type as ActivityItemType](item.id, item);
                        
                        let displayTitle = item.title;
                        if (item.type === 'joinRequest') {
                            displayTitle = `${(item as JoinRequestActivityItem).requesterName} wants to join "${item.title}"`;
                        } else if (item.classroomName) {
                            displayTitle = `${item.title} (${item.classroomName})`;
                        }

                        return (
                        <li key={item.id} className="flex items-center gap-2 group">
                            <Link href={link} className="flex-1 p-3 border rounded-lg bg-card hover:bg-muted transition-all flex items-center gap-3 truncate shadow-sm">
                            <div className={cn(
                                "p-2 rounded-full shrink-0",
                                item.type === 'meeting' ? "bg-primary/10 text-primary" :
                                item.type === 'assignment' ? "bg-red-100 text-red-600" :
                                item.type === 'material' ? "bg-blue-100 text-blue-600" :
                                item.type === 'exam' ? "bg-purple-100 text-purple-600" :
                                "bg-accent/10 text-accent"
                            )}>
                                <Icon className="h-4 w-4" />
                            </div>
                            <div className="flex flex-col truncate">
                                <span className="text-sm font-medium truncate">
                                    {displayTitle}
                                </span>
                                <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                                    {item.type} • {new Date(item.timestamp).toLocaleString([], {month:'short', day:'numeric', hour:'2-digit', minute:'2-digit'})}
                                </span>
                            </div>
                            </Link>
                            <Button 
                                variant="ghost" 
                                size="icon" 
                                className="rounded-full h-8 w-8 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={() => handleDismiss(item.id)}
                            >
                                <XCircle className="h-4 w-4"/>
                            </Button>
                        </li>
                        );
                    })}
                    </ul>
                </ScrollArea>
              ) : (
                <div className="py-12 text-center text-muted-foreground">
                    <p className="text-sm">No recent activity.</p>
                    <p className="text-xs mt-1">Activity from your classes and meetings will appear here.</p>
                </div>
              )
            }
          </div>
        </div>
      </main>
      <SlideUpPanel />
    </div>
  );
}

function ScrollArea({ children, className }: { children: React.ReactNode, className?: string }) {
    return (
        <div className={cn("overflow-y-auto", className)}>
            {children}
        </div>
    );
}
