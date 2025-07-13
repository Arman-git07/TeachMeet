
'use client'; 

import { useSidebar, SidebarTrigger } from '@/components/ui/sidebar';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { PanelLeftOpen } from 'lucide-react';
import { DynamicHeaderProvider, useDynamicHeader } from '@/contexts/DynamicHeaderContext';
import { cn } from '@/lib/utils';

// This component is defined outside the main layout component to prevent module loading issues.
function DashboardHeaderContentInternal() {
  const { headerContent } = useDynamicHeader();

  if (!headerContent) {
    return (
      <header className="sticky top-0 z-40 w-full">
        <div className="container mx-auto flex h-12 items-center px-4 sm:px-6 lg:px-8">
          <div className="flex items-center">
            <SidebarTrigger className="md:hidden">
              <PanelLeftOpen className="h-6 w-6" />
            </SidebarTrigger>
            <SidebarTrigger className="hidden md:flex" />
          </div>
        </div>
      </header>
    );
  }

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/80 backdrop-blur-md">
      <div className="container mx-auto flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-2 sm:gap-4">
          <SidebarTrigger className="md:hidden">
            <PanelLeftOpen className="h-6 w-6" />
          </SidebarTrigger>
          <SidebarTrigger className="hidden md:flex" />
        </div>
        <div className="flex-grow flex items-center px-4">
          {headerContent}
        </div>
        <div className="w-auto flex-shrink-0">
          {/* Placeholder for right-aligned content */}
        </div>
      </div>
    </header>
  );
}

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

  if (loading || !isAuthenticated) {
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

  return (
    <DynamicHeaderProvider>
      <div className="flex flex-col flex-1">
        <DashboardHeaderContentInternal />
        <main className={cn(
          "flex flex-col flex-1 bg-background",
          !isMeetingPage && "p-4 md:p-8"
        )}>
          {children}
        </main>
      </div>
    </DynamicHeaderProvider>
  );
}
