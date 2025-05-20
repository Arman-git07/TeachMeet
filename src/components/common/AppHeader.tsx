
'use client';
import { Search, Menu } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button as UIButton } from '@/components/ui/button'; // Renamed to avoid conflict if needed, though current Button is also from ui
import { SidebarTrigger } from '@/components/ui/sidebar';
import Link from 'next/link';
import { Logo } from './Logo';
import { ThemeToggle } from './ThemeToggle';
import { UserProfileDropdown } from './UserProfileDropdown';

type AppHeaderProps = {
  showLogo?: boolean;
};

export function AppHeader({ showLogo = false }: AppHeaderProps) {
  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/80 backdrop-blur-md">
      <div className="container mx-auto flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-4">
          <SidebarTrigger className="md:hidden">
            <Menu className="h-6 w-6" />
          </SidebarTrigger>
          {showLogo && (
            <Link href="/" className="hidden md:block">
              <Logo size="small" />
            </Link>
          )}
        </div>

        <div className="flex flex-1 items-center justify-center px-4 md:px-8">
          <div className="relative w-full max-w-md">
            <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
            <button
              onClick={() => {
                alert("Opening your phone's contact list directly from a web browser is generally not possible due to security and privacy restrictions. If you'd like to select a contact for use within the app, we could explore the Contact Picker API, or if you intend to call a number, a 'tel:' link could be used.");
              }}
              className="w-full rounded-full bg-accent/10 pl-10 pr-4 py-2 text-sm text-left text-muted-foreground/80 hover:bg-accent/20 focus:outline-none focus:ring-2 focus:ring-accent transition-colors h-[calc(2rem+4px)] flex items-center" // Adjusted height to match input and ensure text aligns
              aria-label="Search contact"
            >
              Search contact
            </button>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <UserProfileDropdown />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
