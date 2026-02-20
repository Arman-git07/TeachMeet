'use client';
import { Logo } from '@/components/common/Logo';
import { AnimatedLogo } from '@/components/common/AnimatedLogo';
import { SlideUpPanel } from '@/components/common/SlideUpPanel';
import { useState, useEffect, useMemo, useRef } from 'react';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import { 
  Video, 
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
  Bell,
  CheckCircle2,
  AlertTriangle,
  Wallet
} from 'lucide-react';
import { AppHeader } from '@/components/common/AppHeader';
import { useAuth } from '@/hooks/useAuth';
import { collection, query, where, onSnapshot, limit, orderBy, doc, getDoc, updateDoc } from 'firebase/firestore';
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
  | 'exam'
  | 'submission'
  | 'enrollment'
  | 'subscription_warning';

interface BaseActivityItem {
  id: string;
  type: ActivityItemType;
  title: string;
  timestamp: number;
  updatedAt?: number;
  classroomId?: string;
  classroomName?: string;
  isUpdated?: boolean;
  statusLabel?: string;
  isImportant?: boolean;
  link?: string;
  endTs?: number;
}

export interface JoinRequestActivityItem extends BaseActivityItem {
    type: 'joinRequest';
    requesterName: string;
}

export type ActivityItem = BaseActivityItem | JoinRequestActivityItem;

const DISMISSED_ITEMS_KEY_PREFIX = 'teachmeet-dismissed-items-';
const STARTED_MEETINGS_KEY_PREFIX = 'teachmeet-started-meetings-';
const TWO_HOURS_IN_MS = 2 * 60 * 60 * 1000;
const TWENTY_FOUR_HOURS_IN_MS = 24 * 60 * 60 * 1000;

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
  submission: CheckCircle2,
  enrollment: UserPlus,
  subscription_warning: AlertTriangle,
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
  submission: (id, item) => item.link || `/dashboard/classrooms/${item.classroomId}`,
  enrollment: (id, item) => `/dashboard/classrooms/${item.classroomId}`,
  subscription_warning: (id, item) => `/dashboard/classrooms/${item.classroomId}`,
};

export default function HomePage() {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  
  const [activityChunks, setActivityChunks] = useState<Record<string, ActivityItem[]>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [validMeetings, setValidMeetings] = useState<Record<string, boolean>>({});
  const [currentTime, setCurrentTime] = useState(new Date());
  
  const managedSubsRef = useRef<Record<string, () => void>>({});
  const enrolledSubsRef = useRef<Record<string, () => void>>({});
  const submissionSubsRef = useRef<Record<string, () => void>>({});
  const personalSubsRef = useRef<(() => void)[]>([]);

  const [allClassroomIds, setAllClassroomIds] = useState<Record<string, { title: string, role: 'teacher' | 'student' }>>({});

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 30000); // Sync every 30 seconds
    return () => clearInterval(timer);
  }, []);

  // 1. Identify all classrooms the user is involved in (as teacher or student)
  useEffect(() => {
    if (!user || !isAuthenticated) {
        setAllClassroomIds({});
        return;
    }

    const unsubManaged = onSnapshot(
        query(collection(db, 'classrooms'), where('teacherId', '==', user.uid)),
        (snap) => {
            setAllClassroomIds(prev => {
                const next = { ...prev };
                snap.docs.forEach(d => {
                    next[d.id] = { title: d.data().title, role: 'teacher' };
                });
                return next;
            });
        }
    );

    const unsubEnrolled = onSnapshot(
        query(collection(db, 'users', user.uid, 'enrolled')),
        (snap) => {
            setAllClassroomIds(prev => {
                const next = { ...prev };
                snap.docs.forEach(d => {
                    if (!next[d.id]) {
                        next[d.id] = { title: d.data().title, role: 'student' };
                    }
                });
                return next;
            });
        }
    );

    return () => {
        unsubManaged();
        unsubEnrolled();
    };
  }, [user, isAuthenticated]);

  // 2. Set up real-time listeners for all identified classrooms
  useEffect(() => {
    if (!user || !isAuthenticated || Object.keys(allClassroomIds).length === 0) return;

    Object.keys(allClassroomIds).forEach(classId => {
        const classInfo = allClassroomIds[classId];
        
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
                            const startTs = (data.createdAt || data.uploadedAt || data.startDate)?.toMillis() || Date.now();
                            const endTs = data.endDate?.toMillis() || 0;
                            const updatedTs = data.updatedAt?.toMillis() || startTs;
                            
                            let statusLabel = cat === 'exam' ? 'Exam' : 'New';
                            if (cat === 'exam') {
                                if (endTs && Date.now() > endTs) {
                                    statusLabel = "Exam paper ready to see";
                                } else if (updatedTs > startTs + 5000) {
                                    statusLabel = "Rescheduled";
                                }
                            } else if (updatedTs > startTs + 5000) {
                                statusLabel = "Updated";
                            }

                            return {
                                id: `${cat}-${d.id}`,
                                type: cat,
                                title: cat === 'announcement' ? (data.text?.substring(0, 50) || 'New Voice Announcement') : (data.title || data.name),
                                timestamp: startTs,
                                updatedAt: updatedTs,
                                isUpdated: updatedTs > startTs + 5000,
                                statusLabel: statusLabel,
                                classroomId: classId,
                                classroomName: classInfo.title,
                                endTs: endTs,
                                isImportant: cat === 'exam' && endTs && Date.now() > endTs
                            };
                        }) as ActivityItem[];

                        setActivityChunks(prev => ({ ...prev, [key]: items }));
                    },
                    (err) => {
                        console.warn(`Listener failed for ${key}`, err);
                        setActivityChunks(prev => { const next = {...prev}; delete next[key]; return next; });
                    }
                );
            }
        });

        // Specific listener for classroom subscription warnings
        const subWarningKey = `sub-warn-${classId}`;
        if (!enrolledSubsRef.current[subWarningKey]) {
            enrolledSubsRef.current[subWarningKey] = onSnapshot(doc(db, 'classrooms', classId), (snap) => {
                if (snap.exists()) {
                    const data = snap.data();
                    if (data.subscriptionStatus === 'grace_period') {
                        setActivityChunks(prev => ({
                            ...prev,
                            [subWarningKey]: [{
                                id: `warn-${classId}`,
                                type: 'subscription_warning',
                                title: `Classroom Renewal Pending`,
                                timestamp: data.nextPaymentDue?.toMillis() || Date.now(),
                                classroomId: classId,
                                classroomName: data.title,
                                statusLabel: "Grace Period",
                                isImportant: true
                            }]
                        }));
                    } else {
                        setActivityChunks(prev => { const next = {...prev}; delete next[subWarningKey]; return next; });
                    }
                }
            });
        }

        if (classInfo.role === 'teacher') {
            const jrKey = `join-${classId}`;
            if (!managedSubsRef.current[jrKey]) {
                managedSubsRef.current[jrKey] = onSnapshot(collection(db, 'classrooms', classId, 'joinRequests'), (snap) => {
                    const items = snap.docs.map(doc => ({
                        id: `join-${classId}-${doc.id}`,
                        type: 'joinRequest',
                        title: classInfo.title,
                        timestamp: doc.data().requestedAt?.toMillis() || Date.now(),
                        classroomId: classId,
                        requesterName: doc.data().studentName || 'A new user'
                    } as JoinRequestActivityItem));
                    setActivityChunks(prev => ({ ...prev, [jrKey]: items }));
                });
            }

            const subKey = `subs-${classId}`;
            if (!submissionSubsRef.current[subKey]) {
                submissionSubsRef.current[subKey] = onSnapshot(
                    query(collection(db, 'classrooms', classId, 'assignments'), orderBy('createdAt', 'desc'), limit(5)),
                    (assignmentsSnap) => {
                        assignmentsSnap.docs.forEach(aDoc => {
                            const aId = aDoc.id;
                            const subPath = `classrooms/${classId}/assignments/${aId}/submissions`;
                            const innerSubKey = `sub-listen-${aId}`;
                            
                            if (!submissionSubsRef.current[innerSubKey]) {
                                submissionSubsRef.current[innerSubKey] = onSnapshot(
                                    query(collection(db, subPath), orderBy('submittedAt', 'desc'), limit(3)),
                                    (subSnap) => {
                                        const subItems = subSnap.docs.map(sDoc => {
                                            const sData = sDoc.data();
                                            if (sData.grade != null) return null;

                                            return {
                                                id: `sub-${sDoc.id}`,
                                                type: 'submission',
                                                title: `New submission from ${sData.studentName}`,
                                                timestamp: sData.submittedAt?.toMillis() || Date.now(),
                                                classroomId: classId,
                                                classroomName: classInfo.title,
                                                statusLabel: "Needs Grading",
                                                link: `/dashboard/classrooms/${classId}/assignments/${aId}/check/${sData.studentId}`
                                            } as ActivityItem;
                                        }).filter(i => i !== null) as ActivityItem[];

                                        setActivityChunks(prev => ({ ...prev, [`sub-items-${aId}`]: subItems }));
                                    }
                                );
                            }
                        });
                    }
                );
            }
        }
    });

    return () => {
        Object.values(enrolledSubsRef.current).forEach(u => u());
        Object.values(managedSubsRef.current).forEach(u => u());
        Object.values(submissionSubsRef.current).forEach(u => u());
        enrolledSubsRef.current = {};
        managedSubsRef.current = {};
        submissionSubsRef.current = {};
    };
  }, [user, isAuthenticated, allClassroomIds]);

  // 3. Listen for personal documents, recordings, and classroom acceptance
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

    const unsubEnrollments = onSnapshot(
        query(collection(db, 'users', user.uid, 'enrolled'), orderBy('enrolledAt', 'desc'), limit(5)),
        (snap) => {
            const items = snap.docs.map(d => ({
                id: `enroll-${d.id}`,
                type: 'enrollment',
                title: d.data().title || 'Classroom',
                timestamp: d.data().enrolledAt?.toMillis() || Date.now(),
                classroomId: d.id,
                statusLabel: "Joined"
            } as ActivityItem));
            setActivityChunks(prev => ({ ...prev, 'personal-enrollments': items }));
        }
    );

    personalSubsRef.current = [unsubDocs, unsubRecs, unsubEnrollments];

    return () => {
        personalSubsRef.current.forEach(u => u());
        personalSubsRef.current = [];
    };
  }, [user, isAuthenticated]);

  // 4. Combine and filter all activity
  const allActivity = useMemo(() => {
    if (!user) return [];
    
    const DISMISSED_KEY = `${DISMISSED_ITEMS_KEY_PREFIX}${user.uid}`;
    const STARTED_KEY = `${STARTED_MEETINGS_KEY_PREFIX}${user.uid}`;

    const dismissed = JSON.parse(localStorage.getItem(DISMISSED_KEY) || '[]');
    const started = JSON.parse(localStorage.getItem(STARTED_KEY) || '[]');

    const firestoreActivity = Object.values(activityChunks).flat();

    const ongoingMeetings = started
        .filter((m: any) => m && Date.now() - m.startedAt < TWO_HOURS_IN_MS && validMeetings[m.id] !== false)
        .map((m: any) => ({ 
            type: 'meeting' as ActivityItemType, 
            id: m.id, 
            title: m.title || "Meeting", 
            timestamp: m.startedAt 
        }));
    
    const combined = [...ongoingMeetings, ...firestoreActivity]
        .filter(item => {
            if (!item || dismissed.includes(item.id)) return false;
            
            // Automatic removal after 24 hours
            const itemAge = currentTime.getTime() - (item.updatedAt || item.timestamp);
            if (itemAge > TWENTY_FOUR_HOURS_IN_MS) return false;

            // Purge deleted classrooms (except for enrollment alerts which point to that deleted classroom ID sometimes temporarily)
            if (item.type !== 'enrollment' && item.classroomId && !allClassroomIds[item.classroomId]) return false;
            return true;
        })
        .map(item => {
            // Contextual final check for labels based on current clock
            if (item.type === 'exam') {
                const endTs = item.endTs;
                if (endTs && currentTime.getTime() > endTs) {
                    return {
                        ...item,
                        statusLabel: "Exam paper ready to see",
                        isImportant: true
                    };
                }
            }
            return item;
        })
        .sort((a,b) => (b.updatedAt || b.timestamp) - (a.updatedAt || a.timestamp));

    const unique = combined.reduce((acc: ActivityItem[], current) => {
        if (!acc.find(item => item.id === current.id)) acc.push(current);
        return acc;
    }, []);

    return unique.slice(0, 15);
  }, [user, activityChunks, validMeetings, allClassroomIds, currentTime]);

  useEffect(() => {
    if (!authLoading) setIsLoading(false);
  }, [authLoading]);

  const handleDismiss = (id: string) => {
    const key = `${DISMISSED_ITEMS_KEY_PREFIX}${user?.uid}`;
    const dismissed = JSON.parse(localStorage.getItem(key) || '[]');
    localStorage.setItem(key, JSON.stringify([...dismissed, id]));
    
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
          <AnimatedLogo size="medium" className="mb-8" />
          <div className="mt-8 p-6 bg-card/50 backdrop-blur-sm rounded-xl shadow-lg w-full max-w-md border border-border/50">
            <h2 className="text-2xl font-semibold text-primary mb-4 flex items-center justify-center">
                <motion.div
                  animate={{ rotate: [0, -10, 10, -10, 10, 0] }}
                  transition={{
                    duration: 1.5,
                    repeat: Infinity,
                    repeatDelay: 2
                  }}
                  style={{ transformOrigin: 'top center' }}
                  className="mr-3"
                >
                  <Bell className="h-6 w-6" />
                </motion.div>
                Latest Activity
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
                        const link = itemLinks[item.type as ActivityItemType](item.id.split('-').pop()!, item);
                        
                        let displayTitle = item.title;
                        const label = item.statusLabel || (item.isUpdated ? 'Updated' : 'New');

                        if (item.type === 'joinRequest') {
                            displayTitle = `${(item as JoinRequestActivityItem).requesterName} wants to join "${item.title}"`;
                        } else if (item.type === 'enrollment') {
                            displayTitle = `Request accepted for "${item.title}"`;
                        } else if (item.type === 'subscription_warning') {
                            displayTitle = `Subscription Renewal Required for ${item.classroomName}`;
                        } else if (item.classroomName) {
                            displayTitle = `${label} ${item.type === 'exam' || item.type === 'submission' ? '' : item.type} in ${item.classroomName}`;
                        } else {
                            displayTitle = `${item.title}`;
                        }

                        return (
                        <div key={item.id} className="flex items-center gap-2 group animate-fade-in">
                            <Link href={link} className={cn(
                                "flex-1 p-3 border rounded-lg bg-card hover:bg-muted transition-all flex items-center gap-3 truncate shadow-sm",
                                item.isImportant && "border-primary/30 bg-primary/5 ring-1 ring-primary/20"
                            )}>
                                <div className={cn(
                                    "p-2 rounded-full shrink-0",
                                    item.type === 'meeting' ? "bg-primary/10 text-primary" :
                                    item.type === 'assignment' ? "bg-red-100 text-red-600" :
                                    item.type === 'material' ? "bg-blue-100 text-blue-600" :
                                    item.type === 'exam' ? "bg-purple-100 text-purple-600" :
                                    item.type === 'submission' ? "bg-green-100 text-green-600" :
                                    item.type === 'enrollment' ? "bg-primary/10 text-primary" :
                                    item.type === 'subscription_warning' ? "bg-amber-100 text-amber-600" :
                                    "bg-accent/10 text-accent"
                                )}>
                                    <Icon className="h-4 w-4" />
                                </div>
                                <div className="flex flex-col truncate">
                                    <span className={cn("text-sm truncate", item.isImportant ? "font-bold text-foreground" : "font-medium")}>
                                        {displayTitle}
                                    </span>
                                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                                        {item.type === 'enrollment' || item.type === 'subscription_warning' ? 'Classroom' : item.type} • {new Date(item.isUpdated ? (item.updatedAt || item.timestamp) : item.timestamp).toLocaleString([], {month:'short', day:'numeric', hour:'2-digit', minute:'2-digit'})}
                                    </span>
                                </div>
                            </Link>
                            <Button 
                                variant="ghost" 
                                size="icon" 
                                className="rounded-full h-8 w-8 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={() => handleDismiss(item.id)}
                                title="Mute notification"
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
