
'use client'; 

import React from 'react';
import dynamic from 'next/dynamic'; // Import dynamic
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import { SidebarProvider } from '@/components/ui/sidebar';
import { ThemeProvider } from 'next-themes';
import { AuthProvider } from '@/hooks/useAuth';
// import { AppSidebar } from '@/components/common/AppSidebar'; // REMOVED STATIC IMPORT
import { SidebarInset } from '@/components/ui/sidebar';
import { cn } from '@/lib/utils'; 
import { Skeleton } from '@/components/ui/skeleton'; // Import Skeleton for loading state

const geistSansFont = GeistSans;
const geistMonoFont = GeistMono;

// Dynamically import AppSidebar
const AppSidebar = dynamic(() => 
  import('@/components/common/AppSidebar').then(mod => mod.AppSidebar), 
  { 
    ssr: false,
    loading: () => (
      <div className="hidden md:flex flex-col h-svh w-[16rem] p-2 border-r border-sidebar-border bg-sidebar">
        <div className="p-4 border-b border-sidebar-border">
          <Skeleton className="h-8 w-32 rounded-md" />
        </div>
        <div className="flex-grow p-4 space-y-2">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-10 w-full rounded-lg" />)}
        </div>
        <div className="p-4 border-t border-sidebar-border space-y-2">
          <Skeleton className="h-10 w-full rounded-lg" />
          <Skeleton className="h-10 w-full rounded-lg" />
        </div>
      </div>
    )
  }
);

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={cn(
        geistSansFont.variable,
        geistMonoFont.variable,
        'font-sans antialiased min-h-screen flex flex-col' 
      )}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <AuthProvider>
            <SidebarProvider defaultOpen={false}>
              <div className="flex flex-1 bg-background"> 
                <AppSidebar />
                <SidebarInset>
                  {children}
                </SidebarInset>
              </div>
            </SidebarProvider>
          </AuthProvider>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
