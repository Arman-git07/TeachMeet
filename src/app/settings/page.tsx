
'use client'; // Added this directive

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { AppHeader } from "@/components/common/AppHeader";
import { LogIn } from "lucide-react";

export default function PublicSettingsPage() {
  // This page is for unauthenticated users.
  // Most settings would require authentication.
  return (
    <div className="flex flex-col min-h-screen">
       <AppHeader showLogo={true} />
       <main className="flex-grow container mx-auto py-16 flex flex-col items-center justify-center">
        <Card className="w-full max-w-lg text-center p-8 shadow-xl rounded-xl border-border/50">
          <CardHeader>
            <CardTitle className="text-3xl font-bold">Settings</CardTitle>
            <CardDescription className="text-lg mt-2">
              To manage your TeachMeet settings, please sign in to your account.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/auth/signin" passHref legacyBehavior>
              <Button size="lg" className="w-full btn-gel text-lg py-3 mt-6 rounded-lg">
                <LogIn className="mr-2 h-5 w-5" />
                Sign In to Access Settings
              </Button>
            </Link>
            <p className="mt-6 text-sm text-muted-foreground">
              Don&apos;t have an account? <Link href="/auth/signup" className="text-accent hover:underline">Sign up here</Link>.
            </p>
          </CardContent>
        </Card>
      </main>
      <footer className="py-8 text-center text-muted-foreground text-sm border-t border-border">
        © {new Date().getFullYear()} TeachMeet. All rights reserved.
      </footer>
    </div>
  );
}
