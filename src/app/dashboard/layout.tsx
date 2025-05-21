
'use client'; // Required for using hooks like useAuth and useRouter

import { AppHeader } from '@/components/common/AppHeader';
import { AppSidebar } from '@/components/common/AppSidebar';
import { SidebarInset, useSidebar } from '@/components/ui/sidebar';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isAuthenticated, loading } = useAuth();
  const router = useRouter();
  const sidebarContext = useSidebar(); // Get sidebar context if needed for loading UI

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.replace('/auth/signin');
    }
  }, [isAuthenticated, loading, router]);

  if (loading || (!isAuthenticated && !loading) ) { // Show loading skeleton or a blank screen while checking auth
    return (
      <div className="flex h-screen bg-background">
        {!sidebarContext.isMobile && sidebarContext.state === 'expanded' && (
          <div className="w-[16rem] border-r bg-sidebar p-4">
            <Skeleton className="h-10 w-32 mb-8 rounded-lg" />
            <Skeleton className="h-8 w-full mb-2 rounded-lg" />
            <Skeleton className="h-8 w-full mb-2 rounded-lg" />
            <Skeleton className="h-8 w-full mb-2 rounded-lg" />
          </div>
        )}
         {!sidebarContext.isMobile && sidebarContext.state === 'collapsed' && (
          <div className="w-[3rem] border-r bg-sidebar p-2">
            <Skeleton className="h-8 w-8 mb-8 rounded-full" />
            <Skeleton className="h-6 w-6 mb-3 rounded-full" />
            <Skeleton className="h-6 w-6 mb-3 rounded-full" />
            <Skeleton className="h-6 w-6 mb-3 rounded-full" />
          </div>
        )}
        <div className="flex flex-1 flex-col">
          <header className="sticky top-0 z-40 w-full border-b bg-background/80 backdrop-blur-md">
            <div className="container mx-auto flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
              <div className="flex items-center gap-4">
                <Skeleton className="h-8 w-8 rounded-md md:hidden" />
                <Skeleton className="h-8 w-32 rounded-lg hidden md:block" />
              </div>
              <Skeleton className="h-8 w-1/2 max-w-md rounded-full" />
              <div className="flex items-center gap-2">
                <Skeleton className="h-8 w-8 rounded-full" />
                <Skeleton className="h-8 w-8 rounded-full" />
              </div>
            </div>
          </header>
          <main className="flex-1 overflow-y-auto p-4 md:p-8 bg-background">
            <Skeleton className="h-32 w-full mb-4 rounded-lg" />
            <Skeleton className="h-64 w-full rounded-lg" />
          </main>
        </div>
      </div>
    );
  }


  return (
    <div className="flex h-screen bg-background">
      <AppSidebar /> {/* Removed isAuthenticated prop, it will use useAuth internally */}
      <SidebarInset>
        <div className="flex flex-1 flex-col">
          <AppHeader showLogo />
          <main className="flex-1 overflow-y-auto p-4 md:p-8 bg-background">
            {children}
          </main>
        </div>
      </SidebarInset>
    </div>
  );
}
