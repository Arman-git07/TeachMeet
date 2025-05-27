
import type { Metadata } from 'next';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import { SidebarProvider } from '@/components/ui/sidebar';
import { ThemeProvider } from 'next-themes';
import { AuthProvider } from '@/hooks/useAuth'; // Import AuthProvider
import { AppSidebar } from '@/components/common/AppSidebar'; // Import AppSidebar
import { SidebarInset } from '@/components/ui/sidebar'; // Import SidebarInset

const geistSans = GeistSans;
const geistMono = GeistMono;

export const metadata: Metadata = {
  title: 'TeachMeet',
  description: 'A study meeting app with a 3D interface.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased flex flex-col min-h-screen`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <AuthProvider>
            <SidebarProvider defaultOpen={false}>
              <div className="flex h-screen bg-background"> {/* Ensure full height flex container */}
                <AppSidebar /> {/* Render AppSidebar globally */}
                <SidebarInset> {/* Wrap children in SidebarInset */}
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
