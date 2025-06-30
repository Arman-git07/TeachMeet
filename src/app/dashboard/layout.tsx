
'use client'; 

import { useSidebar, SidebarTrigger } from '@/components/ui/sidebar';
// import { useAuth } from '@/hooks/useAuth';
// import { useRouter } from 'next/navigation';
import { usePathname } from 'next/navigation';
// import { useEffect } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { PanelLeftOpen } from 'lucide-react';
import { DynamicHeaderProvider, useDynamicHeader } from '@/contexts/DynamicHeaderContext';
import { cn } from '@/lib/utils';

// New component to render the header content dynamically
function DashboardHeaderContentInternal() {
  const { headerContent } = useDynamicHeader();

  if (!headerContent) { // If no specific header content is provided by the page
    return (
      // Minimal header: just the sidebar toggle, less height, no prominent styling
      <header className="sticky top-0 z-40 w-full"> {/* Removed border-b, bg for minimal version */}
        <div className="container mx-auto flex h-12 items-center px-4 sm:px-6 lg:px-8"> {/* Reduced height to h-12 */}
          <div className="flex items-center"> {/* Removed gap, container will handle positioning */}
            <SidebarTrigger className="md:hidden">
              <PanelLeftOpen className="h-6 w-6" />
            </SidebarTrigger>
            <SidebarTrigger className="hidden md:flex" />
          </div>
          {/* No flex-grow content area or right-aligned placeholder in minimal version */}
        </div>
      </header>
    );
  }

  // Full header when headerContent is provided
  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/80 backdrop-blur-md">
      <div className="container mx-auto flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-2 sm:gap-4"> {/* Adjusted gap for consistency */}
          <SidebarTrigger className="md:hidden">
            <PanelLeftOpen className="h-6 w-6" />
          </SidebarTrigger>
          <SidebarTrigger className="hidden md:flex">
            {/* Uses default PanelLeftOpen/Close from SidebarTrigger, onClick is handled internally */}
          </SidebarTrigger>
        </div>
        {/* Dynamic content area - takes up available space */}
        <div className="flex-grow flex items-center px-4">
          {headerContent}
        </div>
        {/* Placeholder for truly right-aligned static elements if needed in the future,
            ensure it has a defined width or use flex-shrink-0 if it contains elements.
            For now, UserProfileDropdown and ThemeToggle are in AppHeader (RootLayout)
        */}
        <div className="w-auto flex-shrink-0">
          {/* e.g. <UserProfileDropdown /> if moved here */}
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
  // --- AUTHENTICATION BYPASSED FOR DEVELOPMENT ---
  // const { isAuthenticated, loading } = useAuth();
  // const router = useRouter();
  const pathname = usePathname();

  // useEffect(() => {
  //   if (!loading && !isAuthenticated) {
  //     router.replace('/auth/signin');
  //   }
  // }, [isAuthenticated, loading, router]);
  // --- END AUTH BYPASS ---

  // Check if the current page is a meeting page to apply different styles
  const isMeetingPage = pathname.startsWith('/dashboard/meeting/');

  // --- LOADING SKELETON BYPASSED FOR DEVELOPMENT ---
  // The loading skeleton is also part of the auth check, so it's bypassed.
  // if (loading || !isAuthenticated) {
  //   return (
  //     <div className="flex h-screen bg-background">
  //       <div className="flex flex-1 flex-col">
  //         <header className="sticky top-0 z-40 w-full border-b bg-background/80 backdrop-blur-md">
  //           <div className="container mx-auto flex h-16 items-center justify-start px-4 sm:px-6 lg:px-8">
  //             <Skeleton className="h-8 w-8 rounded-md" /> {/* Sidebar trigger skeleton */}
  //           </div>
  //         </header>
  //         <main className="flex-1 p-4 md:p-8 bg-background">
  //           <Skeleton className="h-32 w-full mb-4 rounded-lg" />
  //           <Skeleton className="h-64 w-full rounded-lg" />
  //         </main>
  //       </div>
  //     </div>
  //   );
  // }
  // --- END BYPASS ---

  return (
    <DynamicHeaderProvider>
      <div className="flex flex-col flex-1">
        <DashboardHeaderContentInternal />
        <main className={cn(
          "flex flex-col flex-1 bg-background",
          !isMeetingPage && "p-4 md:p-8" // Conditionally apply padding
        )}>
          {children}
        </main>
      </div>
    </DynamicHeaderProvider>
  );
}
