
// src/app/layout.tsx
'use client';
import React from 'react';
import { usePathname } from 'next/navigation';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import { cn } from '@/lib/utils';
import { Providers } from '@/components/common/Providers';
import { AppShell } from '@/components/common/AppShell';

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
  <link rel="icon" href="/favicon-new.ico" />
  <link rel="shortcut icon" href="/favicon-new.ico" />
  <link rel="apple-touch-icon" href="/icon-192.png" />
  <link rel="manifest" href="/manifest.json" />
  <meta name="theme-color" content="#0f172a" />
</head>
      <body className={cn(
        'font-sans antialiased min-h-screen flex flex-col',
        'subpixel-antialiased' // Added for potentially smoother font rendering
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
