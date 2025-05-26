
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
import { useAuth } from '@/hooks/useAuth';
import { Skeleton } from '../ui/skeleton';
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog"; 
import { StartMeetingDialogContent } from "@/components/meeting/StartMeetingDialogContent"; 

type NavItemProps = {
  href?: string, 
  icon: React.ElementType,
  children: React.ReactNode,
  currentPath: string,
  isGreenTheme?: boolean,
  onClick?: () => void;
  asDialogTrigger?: boolean; 
};

const NavItem = ({
  href,
  icon: Icon,
  children,
  currentPath,
  isGreenTheme = false,
  onClick: onClickProp,
  asDialogTrigger = false, 
}: NavItemProps) => {
  const isActive = href ? currentPath === href || (href === "/dashboard/documents" && currentPath.startsWith("/dashboard/documents")) : false;
  const commonClasses = "w-full justify-start text-base py-3 px-4 rounded-lg";
  const { isMobile, setOpenMobile } = useSidebar();

  const handleClick = () => {
    if (onClickProp && !asDialogTrigger) { 
      onClickProp();
    }
    if (isMobile && (href || asDialogTrigger) ) {  // Close sidebar on mobile if it's a link OR a dialog trigger
      setOpenMobile(false);
    }
  };

  const buttonContent = (
    <>
      <Icon className="mr-3 h-5 w-5" />
      {children}
    </>
  );

  const buttonClassName = cn(
    commonClasses,
    isActive
      ? "bg-primary text-primary-foreground"
      : isGreenTheme
        ? "text-primary hover:bg-primary hover:text-primary-foreground"
        : "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
  );

  if (asDialogTrigger) {
    return (
      <SidebarMenuItem>
        <Dialog>
          <DialogTrigger asChild>
            <SidebarMenuButton
              onClick={handleClick} 
              className={buttonClassName}
            >
              {buttonContent}
            </SidebarMenuButton>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <StartMeetingDialogContent />
          </DialogContent>
        </Dialog>
      </SidebarMenuItem>
    );
  }

  if (href) {
    return (
      <SidebarMenuItem>
        <Link href={href} passHref legacyBehavior={href.startsWith('http') ? undefined : true}>
          <SidebarMenuButton
            as="a"
            onClick={handleClick}
            isActive={isActive}
            className={buttonClassName}
          >
            {buttonContent}
          </SidebarMenuButton>
        </Link>
      </SidebarMenuItem>
    );
  }

  return (
     <SidebarMenuItem>
         <SidebarMenuButton
         onClick={handleClick}
         className={cn(
             commonClasses,
             "hover:bg-destructive hover:text-destructive-foreground" 
         )}
         >
         {buttonContent}
         </SidebarMenuButton>
     </SidebarMenuItem>
  );
};


export function AppSidebar() {
  const pathname = usePathname();
  const { isAuthenticated, signOut, loading } = useAuth();
  const router = useRouter(); 
  const { isMobile, setOpenMobile } = useSidebar();


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
              <NavItem icon={PlusCircle} currentPath={pathname} isGreenTheme asDialogTrigger>Start New Meeting</NavItem>
              <NavItem href="/dashboard/join-meeting" icon={Video} currentPath={pathname} isGreenTheme>Join Meeting</NavItem>
              <NavItem href="/dashboard/documents" icon={FileText} currentPath={pathname}>Documents</NavItem>
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
            <NavItem icon={LogOut} currentPath={pathname} onClick={signOut}>Sign Out</NavItem>
          )}
        </SidebarMenu>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
