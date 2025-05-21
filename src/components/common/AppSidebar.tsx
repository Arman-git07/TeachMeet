
'use client';
import Link from 'next/link';
import {
  LogIn,
  UserPlus,
  HelpCircle,
  Settings,
  Video,
  PlusCircle,
  Users,
  LogOut,
  Clapperboard
} from 'lucide-react';
// import { Button } from '@/components/ui/button'; // Button not directly used here for items
// import { Separator } from '@/components/ui/separator'; // Separator not directly used here
import { Logo } from './Logo';
import { cn } from '@/lib/utils';
import { usePathname } from 'next/navigation'; // Removed useRouter
import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  useSidebar, // Import useSidebar
  // SidebarGroup, // Not used
  // SidebarGroupLabel, // Not used
} from '@/components/ui/sidebar';
import { useAuth } from '@/hooks/useAuth'; // Import real useAuth
import { Skeleton } from '../ui/skeleton';

type NavItemProps = {
  href: string,
  icon: React.ElementType,
  children: React.ReactNode,
  currentPath: string,
  isGreenTheme?: boolean,
  onClick?: () => void;
};

const NavItem = ({
  href,
  icon: Icon,
  children,
  currentPath,
  isGreenTheme = false,
  onClick: onClickProp // Renamed to avoid conflict
}: NavItemProps) => {
  const isActive = currentPath === href;
  const commonClasses = "w-full justify-start text-base py-3 px-4 rounded-lg";
  const { isMobile, setOpenMobile } = useSidebar(); // Get sidebar context

  const handleClick = () => {
    if (onClickProp) {
      onClickProp();
    }
    if (isMobile) {
      setOpenMobile(false); // Close sidebar on mobile
    }
  };

  if (onClickProp) { // For items like "Sign Out" that have a direct onClick action
     return (
        <SidebarMenuItem>
            <SidebarMenuButton
            onClick={handleClick}
            className={cn(
                commonClasses,
                "hover:bg-destructive hover:text-destructive-foreground" // Specific for sign out
            )}
            >
            <Icon className="mr-3 h-5 w-5" />
            {children}
            </SidebarMenuButton>
        </SidebarMenuItem>
     );
  }

  // For navigation links
  return (
    <SidebarMenuItem>
      <Link href={href} passHref legacyBehavior={href.startsWith('http') ? undefined : true}>
        <SidebarMenuButton
          onClick={handleClick} // Also close sidebar on navigation
          isActive={isActive}
          className={cn(
            commonClasses,
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


export function AppSidebar() {
  const pathname = usePathname();
  const { isAuthenticated, signOut, loading } = useAuth();
  const router = useRouter(); // Use useRouter for navigation

  const handleLogoClick = () => {
    router.push('/');
  };

  return (
    <Sidebar side="left" variant="sidebar" collapsible="icon">
      <SidebarHeader className="p-6 border-b border-sidebar-border">
        {/* Updated to be a button for navigation */}
        <button
          onClick={handleLogoClick}
          aria-label="Go to homepage"
          className="focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md"
        >
          <Logo size="small" />
        </button>
      </SidebarHeader>
      <SidebarContent className="flex-grow p-4">
        {loading ? (
          <SidebarMenu className="space-y-2">
            {[...Array(4)].map((_, i) => (
              <SidebarMenuItem key={i}>
                <Skeleton className="h-10 w-full rounded-lg" />
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        ) : (
        <SidebarMenu className="space-y-2">
          {isAuthenticated ? (
            <>
              {/* <NavItem href="/" icon={HomeIcon} currentPath={pathname}>Home</NavItem> */}
              <NavItem href="/dashboard/start-meeting" icon={PlusCircle} currentPath={pathname} isGreenTheme>Start Meeting</NavItem>
              <NavItem href="/dashboard/join-meeting" icon={Video} currentPath={pathname} isGreenTheme>Join Meeting</NavItem>
              <NavItem href="/dashboard/meetings" icon={Users} currentPath={pathname}>My Meetings</NavItem>
              <NavItem href="/dashboard/recordings" icon={Clapperboard} currentPath={pathname}>Recordings</NavItem>
            </>
          ) : (
            <>
              <NavItem href="/auth/signin" icon={LogIn} currentPath={pathname}>Sign In</NavItem>
              <NavItem href="/auth/signup" icon={UserPlus} currentPath={pathname}>Sign Up</NavItem>
            </>
          )}
        </SidebarMenu>
        )}
      </SidebarContent>
      <SidebarFooter className="p-4 border-t border-sidebar-border">
         {loading ? (
            <SidebarMenu className="space-y-2">
                <Skeleton className="h-10 w-full rounded-lg" />
                <Skeleton className="h-10 w-full rounded-lg" />
            </SidebarMenu>
         ) : (
        <SidebarMenu className="space-y-2">
          <NavItem href={isAuthenticated ? "/dashboard/help" : "/help"} icon={HelpCircle} currentPath={pathname}>Help</NavItem>
          <NavItem href={isAuthenticated ? "/dashboard/settings" : "/settings"} icon={Settings} currentPath={pathname}>Settings</NavItem>
          {isAuthenticated && (
            <NavItem href="#" icon={LogOut} currentPath={pathname} onClick={signOut}>Sign Out</NavItem>
          )}
        </SidebarMenu>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}

// Added useRouter import to fix error
import { useRouter } from 'next/navigation';
