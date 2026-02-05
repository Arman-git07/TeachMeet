'use client';
import { Logo } from '@/components/common/Logo';
import { SlideUpPanel } from '@/components/common/SlideUpPanel';
import { useState, useEffect, useCallback, useRef } from 'react';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Video, Users as UsersIcon, XCircle, History, FileText, Clapperboard, Loader2, AtSign, Megaphone, UserPlus } from 'lucide-react';
import { AppHeader } from '@/components/common/AppHeader';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export type ActivityItemType = 'meeting' | 'document' | 'recording' | 'chatMention' | 'announcement' | 'joinRequest';

interface BaseActivityItem {
  id: string;
  type: ActivityItemType;
  title: string;
  timestamp: number;
}

export interface JoinRequestActivityItem extends BaseActivityItem {
    type: 'joinRequest';
    classroomId: string;
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
};

const itemLinks: Record<ActivityItemType, (id: string, item: any) => string> = {
  meeting: (id, item) => `/dashboard/meeting/prejoin?meetingId=${id}&topic=${encodeURIComponent(item.title)}&role=host`,
  document: () => `/dashboard/documents`,
  recording: () => `/dashboard/recordings`,
  chatMention: () => `/dashboard/classrooms`,
  announcement: (id, item) => `/dashboard/classrooms/${item.classroomId}`,
  joinRequest: (id, item) => `/dashboard/classrooms/${item.classroomId}/requests`,
};

export default function HomePage() {
  const [allActivity, setAllActivity] = useState<ActivityItem[]>([]);
  const [firestoreActivity, setFirestoreActivity] = useState<ActivityItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const classUnsubsRef = useRef<(() => void)[]>([]);
  
  useEffect(() => {
    if (!user || !isAuthenticated) return;
    
    const qClassrooms = query(collection(db, 'classrooms'), where('teacherId', '==', user.uid));

    const unsubClassrooms = onSnapshot(qClassrooms, (snapshot) => {
        classUnsubsRef.current.forEach(unsub => unsub());
        classUnsubsRef.current = [];
        
        const activityMap: Record<string, ActivityItem[]> = {};

        snapshot.docs.forEach(classDoc => {
            const classId = classDoc.id;
            const classTitle = classDoc.data().title;
            
            const unsubRequests = onSnapshot(query(collection(db, 'classrooms', classId, 'joinRequests')), (reqSnap) => {
                const requests = reqSnap.docs.map(doc => {
                    const data = doc.data();
                    return {
                        id: `join-${classId}-${doc.id}`, 
                        type: 'joinRequest',
                        title: classTitle,
                        timestamp: data.requestedAt?.toMillis() || Date.now(),
                        classroomId: classId,
                        requesterName: data.studentName || 'A new user'
                    } as JoinRequestActivityItem;
                });
                
                activityMap[classId] = requests;
                const combined = Object.values(activityMap).flat();
                setFirestoreActivity(combined);
            });
            
            classUnsubsRef.current.push(unsubRequests);
        });
    });

    return () => { 
        unsubClassrooms(); 
        classUnsubsRef.current.forEach(u => u()); 
    };
  }, [user, isAuthenticated]);
  
  const loadActivities = useCallback(() => {
    if (!user) { setIsLoading(false); setAllActivity([]); return; }
    const DISMISSED_KEY = `${DISMISSED_ITEMS_KEY_PREFIX}${user.uid}`;
    const STARTED_KEY = `${STARTED_MEETINGS_KEY_PREFIX}${user.uid}`;
    const LATEST_KEY = `${LATEST_ACTIVITY_KEY_PREFIX}${user.uid}`;

    const dismissed = JSON.parse(localStorage.getItem(DISMISSED_KEY) || '[]');
    const started = JSON.parse(localStorage.getItem(STARTED_KEY) || '[]');
    const latest = JSON.parse(localStorage.getItem(LATEST_KEY) || '[]');

    const ongoing = started.filter((m:any) => m && Date.now() - m.startedAt < TWO_HOURS_IN_MS).map((m:any) => ({ type: 'meeting', id: m.id, title: m.title || "Meeting", timestamp: m.startedAt }));
    
    const filteredLatest = latest.filter((item: any) => item.type !== 'joinRequest');
    
    const combined = [...ongoing, ...filteredLatest, ...firestoreActivity]
        .filter(item => item && !dismissed.includes(item.id))
        .sort((a,b) => b.timestamp - a.timestamp);

    const uniqueCombined = combined.filter((item, index, self) =>
        index === self.findIndex((t) => t.id === item.id)
    );

    setAllActivity(uniqueCombined);
    setIsLoading(false);
  }, [user, firestoreActivity]);

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
        loadActivities();
        window.addEventListener('teachmeet_activity_updated', loadActivities);
        return () => window.removeEventListener('teachmeet_activity_updated', loadActivities);
    }
  }, [authLoading, isAuthenticated, loadActivities]);

  return (
    <div className="flex flex-col min-h-screen">
      <AppHeader showLogo={false} />
      <main className="flex-grow flex flex-col items-center justify-center pt-16 sm:pt-4 relative pb-[18rem]">
        <div className="relative z-10 flex w-full flex-col items-center text-center px-4">
          <Logo size="medium" className="mb-8" />
          <div className="mt-8 p-6 bg-card/50 backdrop-blur-sm rounded-xl shadow-lg w-full max-w-md border border-border/50">
            <h2 className="text-2xl font-semibold text-primary mb-4 flex items-center justify-center">
                <History className="mr-3 h-6 w-6" /> Latest Activity
            </h2>
            {isLoading ? (
                <div className="py-8"><Loader2 className="animate-spin h-8 w-8 mx-auto text-primary/50"/></div>
            ) : allActivity.length > 0 ? (
                <ul className="space-y-3 text-left">
                  {allActivity.map(item => {
                    const Icon = itemIcons[item.type as ActivityItemType];
                    const link = itemLinks[item.type as ActivityItemType](item.id, item);
                    return (
                      <li key={item.id} className="flex items-center gap-2 group">
                        <Link href={link} className="flex-1 p-3 border rounded-lg bg-card hover:bg-muted transition-all flex items-center gap-3 truncate shadow-sm">
                          <div className="p-2 bg-primary/10 rounded-full shrink-0">
                            <Icon className="h-4 w-4 text-primary" />
                          </div>
                          <div className="flex flex-col truncate">
                            <span className="text-sm font-medium truncate">
                                {item.type === 'joinRequest' ? `${(item as JoinRequestActivityItem).requesterName} wants to join "${item.title}"` : item.title}
                            </span>
                            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{item.type} • {new Date(item.timestamp).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
                          </div>
                        </Link>
                        <Button 
                            variant="ghost" 
                            size="icon" 
                            className="rounded-full h-8 w-8 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => {
                                const key = `${DISMISSED_ITEMS_KEY_PREFIX}${user?.uid}`;
                                const d = JSON.parse(localStorage.getItem(key) || '[]');
                                localStorage.setItem(key, JSON.stringify([...d, item.id]));
                                setAllActivity(prev => prev.filter(i => i.id !== item.id));
                            }}
                        >
                            <XCircle className="h-4 w-4"/>
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <div className="py-12 text-center text-muted-foreground">
                    <p className="text-sm">No recent activity.</p>
                    <p className="text-xs mt-1">Start a meeting or create a classroom to get started!</p>
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
