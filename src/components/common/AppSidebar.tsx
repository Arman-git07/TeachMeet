
'use client';
import Link from 'next/link';
import { StartMeetingDialogContent } from '@/components/meeting/StartMeetingDialogContent';
import React from 'react';
import {
  LogIn,
  UserPlus,
  HelpCircle,
  Settings,
  Video,
  PlusCircle,
  LogOut,
  Clapperboard,
  Home as HomeIcon,
  FileText,
  Lock,
  Globe,
  BookOpen,
  Users,
  School,
  Library,
  History,
  PanelLeftOpen,
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
  SidebarSeparator,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import { useAuth } from '@/hooks/useAuth';
import { Skeleton } from '../ui/skeleton';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogTrigger,
} from "@/components/ui/dialog";
import { buttonVariants } from '@/components/ui/button';


type NavItemProps = {
  href?: string,
  icon: React.ElementType,
  children: React.ReactNode,
  currentPath: string,
  isGreenTheme?: boolean,
  onClick?: () => void;
  isDropdown?: boolean;
  dropdownItems?: { href: string; label: string; icon: React.ElementType, target?: string }[];
  target?: string;
};

const NavItem = ({
  href,
  icon: Icon,
  children,
  currentPath,
  isGreenTheme = false,
  onClick: onClickProp,
  isDropdown = false,
  dropdownItems = [],
  target,
}: NavItemProps) => {
  const isActive = href ? (href === '/' ? currentPath === '/' : currentPath.startsWith(href)) : (isDropdown && dropdownItems.some(item => currentPath.startsWith(item.href)));
  const isStrictlyHomeActive = href === '/' && currentPath === '/';

  const commonClasses = "w-full justify-start text-base py-3 px-4 rounded-lg";
  const { isMobile, setOpenMobile } = useSidebar();

  const handleClick = () => {
    if (onClickProp) {
      onClickProp();
    }
    if (isMobile && (href || isDropdown)) {
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
    isStrictlyHomeActive
      ? "bg-secondary text-secondary-foreground"
      : isActive
      ? "bg-primary text-primary-foreground"
      : isGreenTheme
      ? "text-primary hover:bg-primary hover:text-primary-foreground"
      : "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
  );
  
  if (isDropdown) {
    return (
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              onClick={handleClick}
              className={buttonClassName}
              isActive={isActive}
            >
              {buttonContent}
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="right" align="start" className="ml-2 w-56 rounded-lg shadow-lg bg-sidebar border-sidebar-border">
            {dropdownItems.map(item => {
              const isSubItemActive = currentPath.startsWith(item.href);
              return (
                <Link key={item.label} href={item.href} target={item.target}>
                  <DropdownMenuItem
                    className={cn(
                      "cursor-pointer p-3 text-sm hover:bg-sidebar-accent hover:text-sidebar-accent-foreground rounded-md",
                      isSubItemActive && "bg-sidebar-primary text-sidebar-primary-foreground"
                    )}
                    onSelect={() => { if (isMobile) setOpenMobile(false); }}
                  >
                      <item.icon className="mr-2 h-4 w-4" />
                      {item.label}
                  </DropdownMenuItem>
                </Link>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    );
  }

  if (href) {
    return (
      <SidebarMenuItem>
        <SidebarMenuButton
          asChild
          onClick={handleClick}
          isActive={isActive}
          className={buttonClassName}
        >
          <Link href={href} target={target}>
            {buttonContent}
          </Link>
        </SidebarMenuButton>
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
  const [showSignOutConfirm, setShowSignOutConfirm] = React.useState(false);
  const { isMobile, setOpenMobile } = useSidebar();

  const legalAndInfoItems = [
    { href: "/terms-of-service", label: "Terms of Service", icon: BookOpen, target: "_blank" },
    { href: "/privacy-policy", label: "Privacy Policy", icon: Users, target: "_blank" },
    { href: "/community-guidelines", label: "Community Guidelines", icon: Users, target: "_blank" },
  ];
  
  return (
    <>
    <Sidebar side="left" variant="sidebar" collapsible="icon">
      <SidebarHeader className="p-6 border-b border-sidebar-border flex justify-between items-center">
        <Link href="/">
          <Logo size="small" />
        </Link>
        <SidebarTrigger className="hidden md:flex">
            <PanelLeftOpen className="h-6 w-6" />
        </SidebarTrigger>
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
              <div className="flex items-center gap-2">
                <SidebarTrigger className="md:hidden">
                    <PanelLeftOpen className="h-6 w-6" />
                </SidebarTrigger>
                <NavItem href="/" icon={HomeIcon} currentPath={pathname}>Home</NavItem>
              </div>
              {pathname === '/' && (
                <>
                  <SidebarMenuItem>
                    <Dialog>
                      <DialogTrigger asChild>
                         <SidebarMenuButton className="w-full justify-start text-base py-3 px-4 rounded-lg text-primary hover:bg-primary hover:text-primary-foreground">
                            <PlusCircle className="mr-3 h-5 w-5" />
                            Start New Meeting
                        </SidebarMenuButton>
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-lg rounded-xl">
                        <StartMeetingDialogContent />
                      </DialogContent>
                    </Dialog>
                  </SidebarMenuItem>
                  <NavItem href="/dashboard/join-meeting" icon={Video} currentPath={pathname}>Join Meeting</NavItem>
                </>
              )}
               <NavItem href="/dashboard/classrooms" icon={School} currentPath={pathname}>Classrooms</NavItem>
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
          <SidebarSeparator />
          <NavItem href={isAuthenticated ? "/dashboard/help" : "/help"} icon={HelpCircle} currentPath={pathname}>Help</NavItem>
          <NavItem href={isAuthenticated ? "/dashboard/settings" : "/settings"} icon={Settings} currentPath={pathname}>Settings</NavItem>
          <NavItem icon={Library} currentPath={pathname} isDropdown dropdownItems={legalAndInfoItems}>Legal & Info</NavItem>
          {isAuthenticated && (
            <>
              <SidebarSeparator />
              <NavItem
                icon={LogOut}
                currentPath={pathname}
                onClick={() => setShowSignOutConfirm(true)}
              >
                Sign Out
              </NavItem>
            </>
          )}
        </SidebarMenu>
        )}
      </SidebarFooter>
    </Sidebar>

    <AlertDialog open={showSignOutConfirm} onOpenChange={setShowSignOutConfirm}>
      <AlertDialogContent className="rounded-xl shadow-xl">
        <AlertDialogHeader>
          <AlertDialogTitle>Confirm Sign Out</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to sign out of TeachMeet?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel
            onClick={() => setShowSignOutConfirm(false)}
            className="rounded-lg"
          >
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              signOut();
              setShowSignOutConfirm(false);
            }}
            className={cn(buttonVariants({ variant: "destructive", className: "rounded-lg" }))}
          >
            Sign Out
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}
