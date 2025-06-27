import React from 'react';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import { cn } from '@/lib/utils';
import { ClientLayout } from '@/components/common/ClientLayout';

const geistSansFont = GeistSans;
const geistMonoFont = GeistMono;

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
        <ClientLayout>
          {children}
        </ClientLayout>
        <Toaster />
      </body>
    </html>
  );
}
