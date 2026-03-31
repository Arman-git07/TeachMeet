import React from 'react';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import { cn } from '@/lib/utils';
import { Providers } from '@/components/common/Providers';
import ClientWrapper from './ClientWrapper';

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/favicon-new.ico" />
        <link rel="shortcut icon" href="/favicon-new.ico" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#0f172a" />

        {/* ✅ EARLY SW REGISTRATION */}
        <script dangerouslySetInnerHTML={{
          __html: `
            if ('serviceWorker' in navigator) {
              navigator.serviceWorker.register('/service-worker.js');
            }
          `
        }} />
      </head>

      <body className={cn('font-sans antialiased min-h-screen flex flex-col')}>
        <Providers>
          <ClientWrapper>
            {children}
          </ClientWrapper>
        </Providers>
        <Toaster />
      </body>
    </html>
  );
}
