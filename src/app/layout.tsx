
// src/app/layout.tsx
'use client';
import React from 'react';
import { usePathname } from 'next/navigation';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import { cn } from '@/lib/utils';
import { Providers } from '@/components/common/Providers';
import { AppShell } from '@/components/common/AppShell';

const geistSansFont = GeistSans;
const geistMonoFont = GeistMono;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname();
  const isAuthPage = pathname.startsWith('/auth');

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        
      </head>
      <body className={cn(
        'font-sans antialiased min-h-screen flex flex-col',
        geistSansFont.variable,
        geistMonoFont.variable
      )}>
        <Providers>
          {isAuthPage ? (
            children
          ) : (
            <AppShell>
              {children}
            </AppShell>
          )}
        </Providers>
        <Toaster />
      </body>
    </html>
  );
}
