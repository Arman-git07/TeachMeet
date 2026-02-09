
'use client';
import { Logo } from '@/components/common/Logo';
import { SlideUpPanel } from '@/components/common/SlideUpPanel';
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { 
  Video, 
  Users as UsersIcon, 
  XCircle, 
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
import { useAuth } from '@/hooks/useAuth';
import { collection, query, where, onSnapshot, limit, orderBy, doc, getDoc } from 'firebase/firestore';
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
  updatedAt?: number;
  classroomId?: string;
  classroomName?: string;
  isUpdated?: boolean;
}

export interface JoinRequestActivityItem extends BaseActivityItem {
    type: 'joinRequest';
    requesterName: string;
}

export type ActivityItem = BaseActivityItem | JoinRequestActivityItem;

const DISMISSED_ITEMS_KEY_PREFIX = 'teachmeet-dismissed-items-';
const STARTED_MEETINGS_KEY_PREFIX = 'teachmeet-started-meetings-';
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
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  
  const [activityChunks, setActivityChunks] = useState<Record<string, ActivityItem[]>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [validMeetings, setValidMeetings] = useState<Record<string, boolean>>({});
  
  const managedSubsRef = useRef<Record<string, () => void>>({});
  const enrolledSubsRef = useRef<Record<string, () => void>>({});
  const personalSubsRef = useRef<(() => void)[]>([]);

  // Derived flat list of firestore activity - strictly reflects current server state
  const firestoreActivity = useMemo(() => {
    return Object.values(activityChunks).flat();
  }, [activityChunks]);

  // 1. Listen to Classrooms where user is Teacher (Managed)
  useEffect(() => {
    if (!user || !isAuthenticated) {
        setActivityChunks({});
        return;
    }

    const q = query(collection(db, 'classrooms'), where('teacherId', '==', user.uid));
    const unsub = onSnapshot(q, (snapshot) => {
        const currentIds = snapshot.docs.map(d => d.id);
        
        // Cleanup listeners for removed classes
        Object.keys(managedSubsRef.current).forEach(id => {
            if (!currentIds.includes(id)) {
                managedSubsRef.current[id]();
                delete managedSubsRef.current[id];
                setActivityChunks(prev => {
                    const next = { ...prev };
                    delete next[`join-${id}`];
                    return next;
                });
            }
        });

        // Start listeners for new classes
        snapshot.docs.forEach(classDoc => {
            const classId = classDoc.id;
            const classTitle = classDoc.data().title;

            if (!managedSubsRef.current[classId]) {
                managedSubsRef.current[classId] = onSnapshot(
                    collection(db, 'classrooms', classId, 'joinRequests'), 
                    (reqSnap) => {
                        const items = reqSnap.docs.map(doc => ({
                            id: `join-${classId}-${doc.id}`,
                            type: 'joinRequest',
                            title: classTitle,
                            timestamp: doc.data().requestedAt?.toMillis() || Date.now(),
                            classroomId: classId,
                            requesterName: doc.data().studentName || 'A new user'
                        } as JoinRequestActivityItem));
                        
                        setActivityChunks(prev => ({ ...prev, [`join-${classId}`]: items }));
                    }
                );
            }
        });
    });

    return () => {
        unsub();
        Object.values(managedSubsRef.current).forEach(u => u());
        managedSubsRef.current = {};
    };
  }, [user, isAuthenticated]);

  // 2. Listen to Enrolled Classrooms (Assignments, Materials, etc.)
  useEffect(() => {
    if (!user || !isAuthenticated) return;

    const q = query(collection(db, 'users', user.uid, 'enrolled'));
    const unsub = onSnapshot(q, (snapshot) => {
        const currentIds = snapshot.docs.map(d => d.id);

        // Cleanup
        Object.keys(enrolledSubsRef.current).forEach(key => {
            const classId = key.split('-').pop()!;
            if (!currentIds.includes(classId)) {
                enrolledSubsRef.current[key]();
                delete enrolledSubsRef.current[key];
                setActivityChunks(prev => {
                    const next = { ...prev };
                    delete next[key];
                    return next;
                });
            }
        });

        // Start listeners for each class
        snapshot.docs.forEach(enrolledDoc => {
            const classId = enrolledDoc.id;
            const classTitle = enrolledDoc.data().title;

            const categories: {cat: ActivityItemType, col: string, order: string}[] = [
                { cat: 'assignment', col: 'assignments', order: 'dueDate' },
                { cat: 'material', col: 'materials', order: 'uploadedAt' },
                { cat: 'announcement', col: 'announcements', order: 'createdAt' },
                { cat: 'exam', col: 'exams', order: 'startDate' }
            ];

            categories.forEach(({ cat, col, order }) => {
                const key = `${cat}-${classId}`;
                if (!enrolledSubsRef.current[key]) {
                    enrolledSubsRef.current[key] = onSnapshot(
                        query(collection(db, 'classrooms', classId, col), orderBy(order, 'desc'), limit(5)),
                        (snap) => {
                            const items = snap.docs.map(d => {
                                const data = d.data();
                                
                                // Logical Filter: If announcement has expired (vanished), don't show it
                                if (cat === 'announcement' && data.vanishAt && data.vanishAt.toDate() < new Date()) {
                                    return null;
                                }

                                const createdAt = (data.createdAt || data.uploadedAt || data.startDate)?.toMillis() || Date.now();
                                const updatedAt = data.updatedAt?.toMillis() || createdAt;
                                
                                // Logic: Determine if item was updated significantly after creation (Rescheduled/Updated)
                                const isUpdated = updatedAt > createdAt + 5000; 

                                return {
                                    id: `${cat}-${d.id}`,
                                    type: cat,
                                    title: cat === 'announcement' ? (data.text?.substring(0, 50) || 'New Voice Announcement') : (data.title || data.name),
                                    timestamp: createdAt,
                                    updatedAt: updatedAt,
                                    isUpdated: isUpdated,
                                    classroomId: classId,
                                    classroomName: classTitle
                                };
                            }).filter(i => i !== null) as ActivityItem[];

                            setActivityChunks(prev => ({ ...prev, [key]: items }));
                        },
                        (err) => {
                            console.warn(`Listener failed for ${key}, removing chunk.`, err);
                            setActivityChunks(prev => { const next = {...prev}; delete next[key]; return next; });
                        }
                    );
                }
            });
        });
    });

    return () => {
        unsub();
        Object.values(enrolledSubsRef.current).forEach(u => u());
        enrolledSubsRef.current = {};
    };
  }, [user, isAuthenticated]);

  // 3. Listen to Personal Library
  useEffect(() => {
    if (!user || !isAuthenticated) return;

    const unsubDocs = onSnapshot(
        query(collection(db, 'documents'), where('uploaderId', '==', user.uid), orderBy('createdAt', 'desc'), limit(5)), 
        (snap) => {
            const items = snap.docs.map(d => ({
                id: `doc-${d.id}`,
                type: 'document',
                title: d.data().name,
                timestamp: d.data().createdAt?.toMillis() || Date.now()
            } as ActivityItem));
            setActivityChunks(prev => ({ ...prev, 'personal-docs': items }));
        }
    );

    const unsubRecs = onSnapshot(
        query(collection(db, 'recordings'), where('uploaderId', '==', user.uid), orderBy('createdAt', 'desc'), limit(5)), 
        (snap) => {
            const items = snap.docs.map(d => ({
                id: `rec-${d.id}`,
                type: 'recording',
                title: d.data().name,
                timestamp: d.data().createdAt?.toMillis() || Date.now()
            } as ActivityItem));
            setActivityChunks(prev => ({ ...prev, 'personal-recs': items }));
        }
    );

    personalSubsRef.current = [unsubDocs, unsubRecs];

    return () => {
        personalSubsRef.current.forEach(u => u());
        personalSubsRef.current = [];
    };
  }, [user, isAuthenticated]);

  // 4. Logical Meeting Validator - verifies if ongoing meetings still exist in Firestore
  useEffect(() => {
    if (!user || !isAuthenticated) return;
    const STARTED_KEY = `${STARTED_MEETINGS_KEY_PREFIX}${user.uid}`;
    const started = JSON.parse(localStorage.getItem(STARTED_KEY) || '[]');
    
    started.forEach(async (m: any) => {
        if (!m?.id) return;
        const meetingRef = doc(db, 'meetings', m.id);
        const snap = await getDoc(meetingRef);
        setValidMeetings(prev => ({ ...prev, [m.id]: snap.exists() && snap.data().status !== 'ended' }));
    });
  }, [user, isAuthenticated, firestoreActivity]);

  // Combine everything for the UI
  const allActivity = useMemo(() => {
    if (!user) return [];
    
    const DISMISSED_KEY = `${DISMISSED_ITEMS_KEY_PREFIX}${user.uid}`;
    const STARTED_KEY = `${STARTED_MEETINGS_KEY_PREFIX}${user.uid}`;

    const dismissed = JSON.parse(localStorage.getItem(DISMISSED_KEY) || '[]');
    const started = JSON.parse(localStorage.getItem(STARTED_KEY) || '[]');

    const ongoingMeetings = started
        .filter((m: any) => m && Date.now() - m.startedAt < TWO_HOURS_IN_MS && validMeetings[m.id] !== false)
        .map((m: any) => ({ 
            type: 'meeting' as ActivityItemType, 
            id: m.id, 
            title: m.title || "Meeting", 
            timestamp: m.startedAt 
        }));
    
    const combined = [...ongoingMeetings, ...firestoreActivity]
        .filter(item => item && !dismissed.includes(item.id))
        .sort((a,b) => (b.updatedAt || b.timestamp) - (a.updatedAt || a.timestamp));

    // Final unique and non-null check
    const unique = combined.reduce((acc: ActivityItem[], current) => {
        if (!acc.find(item => item.id === current.id)) acc.push(current);
        return acc;
    }, []);

    return unique.slice(0, 15);
  }, [user, firestoreActivity, validMeetings]);

  useEffect(() => {
    if (!authLoading) setIsLoading(false);
  }, [authLoading]);

  const handleDismiss = (id: string) => {
    const key = `${DISMISSED_ITEMS_KEY_PREFIX}${user?.uid}`;
    const dismissed = JSON.parse(localStorage.getItem(key) || '[]');
    localStorage.setItem(key, JSON.stringify([...dismissed, id]));
    // Force immediate local cleanup
    setActivityChunks(prev => {
        const next = { ...prev };
        Object.keys(next).forEach(k => {
            next[k] = next[k].filter(item => item.id !== id);
        });
        return next;
    });
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
            {authLoading || isLoading ? (
                <div className="py-8"><Loader2 className="animate-spin h-8 w-8 mx-auto text-primary/50"/></div>
            ) : !isAuthenticated ? (
                <div className="py-12 text-center text-muted-foreground">
                    <p className="text-sm font-medium">No recent activity.</p>
                    <p className="text-xs mt-1">Sign in to track your meetings and classes!</p>
                </div>
            ) : allActivity.length > 0 ? (
                <div className="max-h-[400px] overflow-y-auto pr-2 space-y-3 text-left">
                    {allActivity.map(item => {
                        const Icon = itemIcons[item.type as ActivityItemType];
                        const link = itemLinks[item.type as ActivityItemType](item.id, item);
                        
                        let displayTitle = item.title;
                        const prefix = item.isUpdated ? (item.type === 'exam' ? 'Rescheduled' : 'Updated') : 'New';

                        if (item.type === 'joinRequest') {
                            displayTitle = `${(item as JoinRequestActivityItem).requesterName} wants to join "${item.title}"`;
                        } else if (item.classroomName) {
                            displayTitle = `${prefix} ${item.type} in ${item.classroomName}`;
                        } else {
                            displayTitle = `${item.title}`;
                        }

                        return (
                        <div key={item.id} className="flex items-center gap-2 group animate-fade-in">
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
                                        {item.type} • {new Date(item.isUpdated ? (item.updatedAt || item.timestamp) : item.timestamp).toLocaleString([], {month:'short', day:'numeric', hour:'2-digit', minute:'2-digit'})}
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
                        </div>
                        );
                    })}
                </div>
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
