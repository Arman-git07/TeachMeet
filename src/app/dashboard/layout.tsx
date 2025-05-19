import { AppHeader } from '@/components/common/AppHeader';
import { AppSidebar } from '@/components/common/AppSidebar';
import { SidebarInset } from '@/components/ui/sidebar';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // In a real app, this layout would be protected, and isAuthenticated would come from auth state.
  const isAuthenticated = true; // Mock auth state for dashboard

  return (
    <div className="flex h-screen bg-background">
      <AppSidebar isAuthenticated={isAuthenticated} />
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
