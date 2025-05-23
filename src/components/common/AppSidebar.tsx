
'use client';
import Link from 'next/link';
import {
  LogIn,
  UserPlus,
  HelpCircle,
  Settings,
  Video,
  PlusCircle,
  LogOut,
  Clapperboard,
  Home,
  FileText,
  Lock,
  Globe,
} from 'lucide-react';
import { Logo } from './Logo';
import { cn } from '@/lib/utils';
import { usePathname, useRouter } from 'next/navigation';
import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  useSidebar,
} from '@/components/ui/sidebar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from '@/hooks/useAuth';
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
  onClick: onClickProp
}: NavItemProps) => {
  const isActive = currentPath === href;
  const commonClasses = "w-full justify-start text-base py-3 px-4 rounded-lg";
  const { isMobile, setOpenMobile } = useSidebar();

  const handleClick = () => {
    if (onClickProp) {
      onClickProp();
    }
    if (isMobile && !onClickProp) { // Close sidebar on navigation, but not for actions like sign out
      setOpenMobile(false);
    }
  };

  if (onClickProp) {
     return (
        <SidebarMenuItem>
            <SidebarMenuButton
            onClick={handleClick}
            className={cn(
                commonClasses,
                "hover:bg-destructive hover:text-destructive-foreground"
            )}
            >
            <Icon className="mr-3 h-5 w-5" />
            {children}
            </SidebarMenuButton>
        </SidebarMenuItem>
     );
  }

  return (
    <SidebarMenuItem>
      <Link href={href} passHref legacyBehavior={href.startsWith('http') ? undefined : true}>
        <SidebarMenuButton
          as="a" 
          onClick={handleClick}
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
  const router = useRouter();
  const { isMobile, setOpenMobile } = useSidebar();

  const handleLogoClick = () => {
    router.push('/');
  };

  const handleDropdownItemClick = () => {
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  return (
    <Sidebar side="left" variant="sidebar" collapsible="icon">
      <SidebarHeader className="p-6 border-b border-sidebar-border">
        <Link href="/" legacyBehavior>
          <a>
            <Logo size="small" />
          </a>
        </Link>
      </SidebarHeader>
      <SidebarContent className="flex-grow p-4">
        {loading ? (
          <SidebarMenu className="space-y-2">
            {[...Array(5)].map((_, i) => ( 
              <SidebarMenuItem key={i}>
                <Skeleton className="h-10 w-full rounded-lg" />
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        ) : (
        <SidebarMenu className="space-y-2">
          {isAuthenticated ? (
            <>
              <NavItem href="/" icon={Home} currentPath={pathname}>Home</NavItem>
              <NavItem href="/dashboard/start-meeting" icon={PlusCircle} currentPath={pathname} isGreenTheme>Start Meeting</NavItem>
              <NavItem href="/dashboard/join-meeting" icon={Video} currentPath={pathname} isGreenTheme>Join Meeting</NavItem>
              
              <SidebarMenuItem>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <SidebarMenuButton
                      className={cn(
                        "w-full justify-start text-base py-3 px-4 rounded-lg",
                        (pathname.startsWith('/dashboard/documents/private') || pathname.startsWith('/dashboard/documents/public'))
                          ? "bg-primary text-primary-foreground" 
                          : "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                      )}
                    >
                      <FileText className="mr-3 h-5 w-5" />
                      Documents
                    </SidebarMenuButton>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent side="right" align="start" className="ml-2 rounded-lg shadow-lg w-56">
                    <DropdownMenuItem asChild onClick={handleDropdownItemClick}>
                      <Link href="/dashboard/documents/private" className="flex items-center w-full">
                        <Lock className="mr-2 h-4 w-4" /> Private
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild onClick={handleDropdownItemClick}>
                      <Link href="/dashboard/documents/public" className="flex items-center w-full">
                        <Globe className="mr-2 h-4 w-4" /> Public
                      </Link>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </SidebarMenuItem>

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
