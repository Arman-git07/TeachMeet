
'use client'; 

import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { DynamicHeaderProvider } from '@/contexts/DynamicHeaderContext';
import { cn } from '@/lib/utils';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader'; // Import the new header component

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isAuthenticated, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.replace('/auth/signin');
    }
  }, [isAuthenticated, loading, router]);

  const isMeetingPage = pathname.startsWith('/dashboard/meeting/');
  const isPrejoinPage = pathname === '/dashboard/meeting/prejoin';

  if (loading) {
    return (
      <div className="flex h-screen bg-background">
        <div className="flex flex-1 flex-col">
          <header className="sticky top-0 z-40 w-full border-b bg-background/80 backdrop-blur-md">
            <div className="container mx-auto flex h-16 items-center justify-start px-4 sm:px-6 lg:px-8">
              <Skeleton className="h-8 w-8 rounded-md" />
            </div>
          </header>
          <main className="flex-1 p-4 md:p-8 bg-background">
            <Skeleton className="h-32 w-full mb-4 rounded-lg" />
            <Skeleton className="h-64 w-full rounded-lg" />
          </main>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    // Return null or a minimal loader while redirecting to avoid showing content to unauthenticated users.
    return null;
  }

  return (
    <DynamicHeaderProvider>
      <div className="flex flex-col flex-1">
        {!isPrejoinPage && <DashboardHeader />}
        <main className={cn(
          "flex flex-col flex-1 bg-background",
          !isMeetingPage && !isPrejoinPage && "p-4 md:p-8"
        )}>
          {children}
        </main>
      </div>
    </DynamicHeaderProvider>
  );
}
