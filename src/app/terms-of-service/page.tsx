
// src/app/terms-of-service/page.tsx
import { AppHeader } from '@/components/common/AppHeader';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import Link from 'next/link';

export default function TermsOfServicePage() {
  return (
    <div className="flex flex-col min-h-screen">
      <AppHeader showLogo={true} />
      <main className="flex-grow container mx-auto py-12 px-4">
        <Card className="max-w-3xl mx-auto shadow-lg rounded-xl border-border/50">
          <CardHeader className="text-center border-b pb-6">
            <CardTitle className="text-3xl font-bold">Terms of Service</CardTitle>
            <CardDescription className="text-muted-foreground mt-2">Last Updated: [Date]</CardDescription>
          </CardHeader>
          <CardContent className="prose prose-sm sm:prose-base dark:prose-invert max-w-none py-8 px-6 space-y-6">
            <p className="text-lg font-semibold text-center text-destructive">This is a Placeholder Terms of Service.</p>
            <p>
              This document is a template and does not constitute legal advice. You should consult with a legal professional
              to create Terms of Service that are appropriate for your application.
            </p>
            <p>
              Welcome to TeachMeet! These Terms of Service ("Terms") govern your access to and use of the TeachMeet
              application and services ("Services"). Please read these Terms carefully.
            </p>

            <h2 className="text-xl font-semibold">1. Acceptance of Terms</h2>
            <p>
              By accessing or using our Services, you agree to be bound by these Terms and our Privacy Policy.
              If you do not agree to these Terms, do not use our Services.
            </p>

            <h2 className="text-xl font-semibold">2. User Conduct</h2>
            <p>
              You agree not to use the Services for any unlawful purpose or in any way that interrupts, damages,
              or impairs the service. You agree to comply with our Community Guidelines.
            </p>

            <h2 className="text-xl font-semibold">3. Content</h2>
            <p>
              You are responsible for any content you share or create using the Services.
              We reserve the right to remove content that violates our policies.
            </p>

            <h2 className="text-xl font-semibold">4. Disclaimers (Placeholder)</h2>
            <p>
              The Services are provided "as is" without any warranties, express or implied.
            </p>
            
            <h2 className="text-xl font-semibold">5. Limitation of Liability (Placeholder)</h2>
            <p>
             To the fullest extent permitted by applicable law, TeachMeet shall not be liable for any indirect, incidental,
             special, consequential, or punitive damages, or any loss of profits or revenues.
            </p>

            <p className="mt-8 text-center">
              <Link href="/" className="text-accent hover:underline">
                Return to Home
              </Link>
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
