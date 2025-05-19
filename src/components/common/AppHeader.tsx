'use client';
import { Search, Menu } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { SidebarTrigger } from '@/components/ui/sidebar';
import Link from 'next/link';
import { Logo } from './Logo';

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
            <Input
              type="search"
              placeholder="Search content or start a call..."
              className="w-full rounded-full bg-muted pl-10 pr-4 py-2 text-sm focus:ring-accent"
              aria-label="Search"
            />
          </div>
        </div>
        
        {/* Placeholder for User Profile / Actions if needed */}
        <div>
          {/* Example: <UserButton /> */}
        </div>
      </div>
    </header>
  );
}
