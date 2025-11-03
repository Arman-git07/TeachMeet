import React from 'react';
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
          <AppShell>
            {children}
          </AppShell>
        </Providers>
        <Toaster />
      </body>
    </html>
  );
}
