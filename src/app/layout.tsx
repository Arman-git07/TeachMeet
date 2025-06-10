'use client'; // Added this directive

import React from 'react';
import type { Metadata, Viewport } from 'next';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import { SidebarProvider } from '@/components/ui/sidebar';
import { ThemeProvider } from 'next-themes';
import { AuthProvider } from '@/hooks/useAuth';
import { AppSidebar } from '@/components/common/AppSidebar';
import { SidebarInset } from '@/components/ui/sidebar';
import { cn } from '@/lib/utils'; // Import cn

const geistSansFont = GeistSans;
const geistMonoFont = GeistMono;

export const metadata: Metadata = {
  title: 'TeachMeet',
  description: 'A study meeting app.',
};

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
        'font-sans antialiased min-h-screen' // Removed flex flex-col
      )}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <AuthProvider>
            <SidebarProvider defaultOpen={false}>
              <div className="flex flex-1 bg-background"> {/* Changed h-screen to flex-1 */}
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
