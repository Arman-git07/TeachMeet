"use client";
import { useEffect } from "react";
import React from 'react';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import { cn } from '@/lib/utils';
import { Providers } from '@/components/common/Providers';
import ClientWrapper from './ClientWrapper';
import SWRegister from "@/components/SWRegister";

export default function RootLayout({ children }) {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js");
    }
  }, []);
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/favicon-new.ico" />
        <link rel="shortcut icon" href="/favicon-new.ico" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#0f172a" />
<meta name="mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="black" />
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
      <SWRegister />   {/* ✅ ADD HERE */}
      {children}
    </ClientWrapper>
  </Providers>
  <Toaster />
</body>
    </html>
  );
}
