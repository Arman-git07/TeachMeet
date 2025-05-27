
'use client'; // Required for using hooks like useAuth, useRouter, and useSidebar

import { useSidebar, SidebarTrigger } from '@/components/ui/sidebar';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { PanelLeftOpen } from 'lucide-react';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isAuthenticated, loading } = useAuth();
  const router = useRouter();
  const { state: sidebarState, isMobile: sidebarIsMobile, toggleSidebar } = useSidebar();

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.replace('/auth/signin');
    }
  }, [isAuthenticated, loading, router]);

  if (loading || (!isAuthenticated && !loading) ) {
    // Skeleton structure remains similar, but AppSidebar and SidebarInset are handled by RootLayout
    return (
      <div className="flex h-screen bg-background">
        {/* Sidebar skeleton part would be implicitly handled by RootLayout's sidebar if it had its own skeleton */}
        <div className="flex flex-1 flex-col">
          <header className="sticky top-0 z-40 w-full border-b bg-background/80 backdrop-blur-md">
            <div className="container mx-auto flex h-16 items-center justify-start px-4 sm:px-6 lg:px-8">
              <Skeleton className="h-8 w-8 rounded-md" /> {/* Sidebar trigger skeleton */}
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
    // AppSidebar and SidebarInset are now handled by RootLayout
    // This component now only defines the content area for the dashboard
    <div className="flex flex-1 flex-col">
      {/* Minimal header for DashboardLayout */}
      <header className="sticky top-0 z-40 w-full border-b bg-background/80 backdrop-blur-md">
        <div className="container mx-auto flex h-16 items-center justify-start gap-4 px-4 sm:px-6 lg:px-8">
          <SidebarTrigger className="md:hidden">
            <PanelLeftOpen className="h-6 w-6" />
          </SidebarTrigger>
          {/* Desktop sidebar toggle, controls the global sidebar */}
          <SidebarTrigger className="hidden md:flex" onClick={toggleSidebar}>
             {/* Uses default PanelLeftOpen/Close from SidebarTrigger */}
          </SidebarTrigger>
          {/* Other dashboard-specific header elements could go here if needed */}
        </div>
      </header>
      <main className="flex-1 overflow-y-auto p-4 md:p-8 bg-background">
        {children}
      </main>
    </div>
  );
}
