'use client';
import Link from 'next/link';
import { 
  Home, 
  LogIn, 
  UserPlus, 
  HelpCircle, 
  Settings, 
  Video, 
  PlusCircle,
  Users,
  LogOut
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Logo } from './Logo';
import { cn } from '@/lib/utils';
import { usePathname } from 'next/navigation';
import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarGroup,
  SidebarGroupLabel,
} from '@/components/ui/sidebar';

type AppSidebarProps = {
  isAuthenticated: boolean; // This would typically come from an auth context/hook
};

const NavItem = ({ 
  href, 
  icon: Icon, 
  children, 
  currentPath,
  isGreenTheme = false 
}: { 
  href: string, 
  icon: React.ElementType, 
  children: React.ReactNode, 
  currentPath: string,
  isGreenTheme?: boolean 
}) => {
  const isActive = currentPath === href;
  return (
    <SidebarMenuItem>
      <Link href={href} passHref legacyBehavior>
        <SidebarMenuButton 
          isActive={isActive} 
          className={cn(
            "w-full justify-start text-base py-3 px-4 rounded-lg", 
            isActive 
              ? "bg-primary text-primary-foreground" 
              : isGreenTheme 
                ? "text-primary hover:bg-primary hover:text-primary-foreground" 
                : "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          )}
        >
          <Icon className="mr-3 h-5 w-5" />
          {children}
        </SidebarMenuButton>
      </Link>
    </SidebarMenuItem>
  );
};


export function AppSidebar({ isAuthenticated }: AppSidebarProps) {
  const pathname = usePathname();

  // Mock authentication actions
  const handleSignOut = () => {
    alert("Simulating Sign Out. Implement actual sign out logic.");
    // Example: router.push('/');
  };
  
  return (
    <Sidebar side="left" variant="sidebar" collapsible="icon">
      <SidebarHeader className="p-6 border-b border-sidebar-border">
        <Logo size="small" />
      </SidebarHeader>
      <SidebarContent className="flex-grow p-4">
        <SidebarMenu className="space-y-2">
          {isAuthenticated ? (
            <>
              <NavItem href="/" icon={Home} currentPath={pathname}>Home</NavItem>
              <NavItem href="/dashboard/start-meeting" icon={PlusCircle} currentPath={pathname} isGreenTheme>Start Meeting</NavItem>
              <NavItem href="/dashboard/join-meeting" icon={Video} currentPath={pathname} isGreenTheme>Join Meeting</NavItem>
              <NavItem href="/dashboard/meetings" icon={Users} currentPath={pathname}>My Meetings</NavItem>
            </>
          ) : (
            <>
              <NavItem href="/auth/signin" icon={LogIn} currentPath={pathname}>Sign In</NavItem>
              <NavItem href="/auth/signup" icon={UserPlus} currentPath={pathname}>Sign Up</NavItem>
            </>
          )}
        </SidebarMenu>
      </SidebarContent>
      <SidebarFooter className="p-4 border-t border-sidebar-border">
        <SidebarMenu className="space-y-2">
          <NavItem href={isAuthenticated ? "/dashboard/help" : "/help"} icon={HelpCircle} currentPath={pathname}>Help</NavItem>
          <NavItem href={isAuthenticated ? "/dashboard/settings" : "/settings"} icon={Settings} currentPath={pathname}>Settings</NavItem>
          {isAuthenticated && (
            <SidebarMenuItem>
              <SidebarMenuButton onClick={handleSignOut} className="w-full justify-start text-base py-3 px-4 rounded-lg hover:bg-destructive hover:text-destructive-foreground">
                <LogOut className="mr-3 h-5 w-5" />
                Sign Out
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
