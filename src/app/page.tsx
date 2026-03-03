
'use client';
import { SlideUpPanel } from '@/components/common/SlideUpPanel';
import { useState, useEffect, useMemo, useRef } from 'react';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';
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
  AlertTriangle
} from 'lucide-react';
import { AppHeader } from '@/components/common/AppHeader';
import { useAuth } from '@/hooks/useAuth';
import { collection, query, where, onSnapshot, limit, orderBy, doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Logo } from '@/components/common/Logo';

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
  role?: 'host' | 'participant';
}

export interface JoinRequestActivityItem extends BaseActivityItem {
    type: 'joinRequest';
    requesterName: string;
}

export type ActivityItem = BaseActivityItem | JoinRequestActivityItem;

interface FallenLetter {
  id: string;
  char: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fallY: number;
  style: any;
  index: number;
  isDragging: boolean;
}

const DISMISSED_ITEMS_KEY_PREFIX = 'teachmeet-dismissed-items-';
const STARTED_MEETINGS_KEY_PREFIX = 'teachmeet-started-meetings-';
const JOINED_MEETINGS_KEY_PREFIX = 'teachmeet-joined-meetings-';
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
  submission: CheckCircle2,
  enrollment: UserPlus,
  subscription_warning: AlertTriangle,
};

const itemLinks: Record<ActivityItemType, (id: string, item: any) => string> = {
  meeting: (id, item) => `/dashboard/meeting/prejoin?meetingId=${id}&topic=${encodeURIComponent(item.title)}&role=${item.role || 'host'}`,
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
  const [validMeetings] = useState<Record<string, boolean>>({});
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  
  const [fallenLetters, setFallenLetters] = useState<FallenLetter[]>([]);
  const [showBubble, setShowBubble] = useState(false);
  const [fallenIndices, setFallenIndices] = useState<Set<number>>(new Set());
  
  const logoWrapperRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const bubbleDismissedRef = useRef(false);

  const managedSubsRef = useRef<Record<string, () => void>>({});
  const enrolledSubsRef = useRef<Record<string, () => void>>({});
  const personalSubsRef = useRef<(() => void)[]>([]);

  const [allClassroomIds, setAllClassroomIds] = useState<Record<string, { title: string, role: 'teacher' | 'student' }>>({});

  // Local Storage Change Listener
  useEffect(() => {
    const handleRefresh = () => setRefreshTrigger(prev => prev + 1);
    window.addEventListener('teachmeet_meeting_started', handleRefresh);
    window.addEventListener('teachmeet_meeting_joined', handleRefresh);
    window.addEventListener('teachmeet_meeting_ended', handleRefresh);
    return () => {
      window.removeEventListener('teachmeet_meeting_started', handleRefresh);
      window.removeEventListener('teachmeet_meeting_joined', handleRefresh);
      window.removeEventListener('teachmeet_meeting_ended', handleRefresh);
    };
  }, []);

  // Logo Animation & Visibility Logic
  useEffect(() => {
    setShowBubble(true);
    const bubbleTimer = setTimeout(() => {
      setShowBubble(false);
      bubbleDismissedRef.current = true;
    }, 6000);

    const wrapper = logoWrapperRef.current;
    if (!wrapper) return;
    const h1 = wrapper.querySelector('h1');
    if (!h1) return;

    h1.style.opacity = '1';
    h1.style.visibility = 'visible';
    h1.style.transform = 'none';

    const originalText = h1.textContent || "";
    h1.innerHTML = originalText.split('').map((char, i) => 
      `<span class="logo-letter-trigger" data-index="${i}" style="display: inline-block; position: relative; cursor: pointer; transition: opacity 0.2s; opacity: 1; visibility: visible !important; background: linear-gradient(to top, #32CD32, #00FFFF); -webkit-background-clip: text; -webkit-text-fill-color: transparent; color: #32CD32;">${char}</span>`
    ).join('');

    const handleLetterClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.classList.contains('logo-letter-trigger')) {
        const index = parseInt(target.getAttribute('data-index') || '0');
        if (target.style.opacity === '0') return;

        if (!bubbleDismissedRef.current) {
          setShowBubble(false);
          bubbleDismissedRef.current = true;
          sessionStorage.setItem('teachmeet-logo-bubble-shown', 'true');
        }

        const logoRect = wrapper.getBoundingClientRect();
        const letterRect = target.getBoundingClientRect();
        const latestCard = document.getElementById("latest-activity");
        if (!latestCard) return;
        const latestRect = latestCard.getBoundingClientRect();

        const fallY = latestRect.top - letterRect.top - letterRect.height - 12;
        const computed = window.getComputedStyle(h1);
        
        const newFallen: FallenLetter = {
          id: `fallen-${index}-${Date.now()}`,
          char: target.textContent || "",
          x: letterRect.left - logoRect.left,
          y: letterRect.top - logoRect.top,
          width: letterRect.width,
          height: letterRect.height,
          fallY,
          style: {
            fontFamily: computed.fontFamily,
            fontSize: computed.fontSize,
            fontWeight: computed.fontWeight,
            letterSpacing: computed.letterSpacing,
            display: 'inline-block',
            transform: computed.transform, 
            transformOrigin: 'center',
            pointerEvents: 'auto',
            background: 'linear-gradient(to top, #32CD32, #00FFFF)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            color: '#32CD32',
          },
          index,
          isDragging: false
        };

        setFallenLetters(prev => [...prev, newFallen]);
        setFallenIndices(prev => {
          const next = new Set(prev);
          next.add(index);
          return next;
        });
        target.style.opacity = '0';
      }
    };

    h1.addEventListener('click', handleLetterClick);
    return () => {
      h1.removeEventListener('click', handleLetterClick);
      clearTimeout(bubbleTimer);
    };
  }, []);

  const handleDragStart = (id: string) => {
    setFallenLetters(prev => prev.map(l => l.id === id ? { ...l, isDragging: true } : l));
  };

  const handleDragEnd = (letter: FallenLetter, info: any) => {
    if (Math.abs(info.offset.y + letter.fallY) < 50) {
      setFallenLetters(prev => prev.filter(l => l.id !== letter.id));
      setFallenIndices(prev => {
        const next = new Set(prev);
        next.delete(letter.index);
        return next;
      });
      const wrapper = logoWrapperRef.current;
      if (wrapper) {
        const original = wrapper.querySelector(`[data-index="${letter.index}"]`) as HTMLElement;
        if (original) original.style.opacity = '1';
      }
    } else {
      setFallenLetters(prev => prev.map(l => l.id === letter.id ? { ...l, isDragging: false } : l));
    }
  };

  // Activity Listeners
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
                    }
                );
            }
        });

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
        }
    });

    return () => {
        Object.values(enrolledSubsRef.current).forEach(u => u());
        Object.values(managedSubsRef.current).forEach(u => u());
        enrolledSubsRef.current = {};
        managedSubsRef.current = {};
    };
  }, [user, isAuthenticated, allClassroomIds]);

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
    return () => personalSubsRef.current.forEach(u => u());
  }, [user, isAuthenticated]);

  const allActivity = useMemo(() => {
    if (!user) return [];
    
    const DISMISSED_KEY = `${DISMISSED_ITEMS_KEY_PREFIX}${user.uid}`;
    const STARTED_KEY = `${STARTED_MEETINGS_KEY_PREFIX}${user.uid}`;
    const JOINED_KEY = `${JOINED_MEETINGS_KEY_PREFIX}${user.uid}`;

    const dismissed = JSON.parse(localStorage.getItem(DISMISSED_KEY) || '[]');
    const started = JSON.parse(localStorage.getItem(STARTED_KEY) || '[]');
    const joined = JSON.parse(localStorage.getItem(JOINED_KEY) || '[]');

    const firestoreActivity = Object.values(activityChunks).flat();

    const ongoingMeetings = [
        ...started.map((m: any) => ({ ...m, role: 'host' as const })),
        ...joined.map((m: any) => ({ ...m, role: 'participant' as const }))
    ]
    .filter((m: any) => m && Date.now() - m.startedAt < TWO_HOURS_IN_MS && validMeetings[m.id] !== false)
    .map((m: any) => ({ 
        type: 'meeting' as ActivityItemType, 
        id: m.id, 
        title: m.title || "Meeting", 
        timestamp: m.startedAt,
        role: m.role
    }));
    
    const combined = [...ongoingMeetings, ...firestoreActivity]
        .filter(item => item && !dismissed.includes(item.id))
        .sort((a,b) => (b.updatedAt || b.timestamp) - (a.updatedAt || a.timestamp));

    const unique = combined.reduce((acc: ActivityItem[], current) => {
        const currentCompareId = current.type === 'meeting' 
            ? (current.id.startsWith('meeting-') ? current.id : `meeting-${current.id}`)
            : current.id;

        const alreadyExists = acc.some(item => {
            const itemCompareId = item.type === 'meeting'
                ? (item.id.startsWith('meeting-') ? item.id : `meeting-${item.id}`)
                : item.id;
            return itemCompareId === currentCompareId;
        });

        if (!alreadyExists) acc.push(current);
        return acc;
    }, []);

    return unique.slice(0, 15);
  }, [user, activityChunks, validMeetings, refreshTrigger]);

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
          
          {/* Logo Section */}
          <div ref={logoWrapperRef} className="relative inline-block mb-8">
            <AnimatePresence>
              {showBubble && (
                <motion.div 
                  initial={{ opacity: 0, y: 10, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  className="absolute z-[60]"
                  style={{ top: '-45px', left: '-60px' }}
                >
                  <div className="relative bg-gradient-to-b from-white to-[#ececec] px-6 py-2 rounded-[28px] shadow-xl border border-white/20">
                    <span className="text-sm font-bold text-gray-700 whitespace-nowrap">Click it</span>
                    <div className="absolute -bottom-3 right-6 w-6 h-6 animate-tail-pulse">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                        <path d="M0 0C0 12 12 24 24 24V0H0Z" fill="#ececec" />
                      </svg>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <Logo size="medium" />
            
            <div ref={overlayRef} className="absolute inset-0 pointer-events-none z-50">
              {fallenLetters.map((letter) => (
                <motion.div
                  key={letter.id}
                  drag="y"
                  dragElastic={0.15}
                  dragMomentum={false}
                  onDragStart={() => handleDragStart(letter.id)}
                  onDragEnd={(_, info) => handleDragEnd(letter, info)}
                  initial={{ y: 0, rotate: 0 }}
                  animate={{ y: letter.fallY, rotate: letter.index % 2 === 0 ? 15 : -15 }}
                  transition={{ type: 'spring', stiffness: 100, damping: 10 }}
                  style={{
                    position: 'absolute',
                    top: letter.y,
                    left: letter.x,
                    width: letter.width,
                    height: letter.height,
                    cursor: 'grab',
                    pointerEvents: 'auto',
                  }}
                >
                  <span style={letter.style}>{letter.char}</span>
                  {!letter.isDragging && (
                    <div className="absolute top-[-35px] left-1/2 -translate-x-1/2 px-3 py-1 bg-gradient-to-br from-white to-[#ececec] rounded-full text-[10px] font-bold text-gray-800 shadow-lg whitespace-nowrap pointer-events-none border border-white/50 animate-fade-in">
                      Pick me up!
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          </div>

          <div 
            id="latest-activity" 
            className="mt-8 p-6 bg-card/50 backdrop-blur-sm rounded-xl shadow-lg w-full max-w-md border border-border/50"
          >
            <h2 className="text-2xl font-semibold text-primary mb-4 flex items-center justify-center">
                <motion.div
                  animate={{ rotate: [0, -10, 10, -10, 10, 0] }}
                  transition={{ duration: 1.5, repeat: Infinity, repeatDelay: 2 }}
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
                        } else if (item.classroomName) {
                            displayTitle = `${label} ${item.type} in ${item.classroomName}`;
                        } else if (item.type === 'meeting' && item.role === 'participant') {
                            displayTitle = `Rejoin: ${item.title}`;
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
