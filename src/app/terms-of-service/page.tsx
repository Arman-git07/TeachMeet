
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
            <CardDescription className="text-muted-foreground mt-2">Last Updated: {new Date().toLocaleDateString()}</CardDescription>
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
              By creating an account or using our Services, you agree to be bound by these Terms, our <Link href="/privacy-policy" target="_blank" className="text-accent hover:underline">Privacy Policy</Link>, and our <Link href="/community-guidelines" target="_blank" className="text-accent hover:underline">Community Guidelines</Link>.
              If you do not agree, you may not use our Services.
            </p>

            <h2 className="text-xl font-semibold">2. User Accounts and Responsibilities</h2>
            <p>
              You are responsible for maintaining the confidentiality of your account password and for all activities that occur under your account. You must be of legal age to form a binding contract to use our services.
            </p>

            <h2 className="text-xl font-semibold">3. User Content and Conduct</h2>
            <p>
              You are solely responsible for any content you share, create, or upload using the Services ("User Content"). You agree not to upload User Content that is illegal, harmful, or violates our Community Guidelines. Specifically, <strong>the upload or sharing of adult content is strictly forbidden</strong>. We have the right to review and remove any User Content and terminate accounts that violate our policies, at our sole discretion.
            </p>

            <h2 className="text-xl font-semibold">4. Disclaimers and Limitation of Liability</h2>
            <p>
              The Services are provided "as is" and "as available" without any warranties, express or implied. We do not guarantee that the service will be uninterrupted or error-free.
            </p>
            <p>
             To the fullest extent permitted by applicable law, TeachMeet shall not be liable for any indirect, incidental,
             special, consequential, or punitive damages, or any loss of profits or revenues, whether incurred directly or indirectly.
            </p>
            
            <h2 className="text-xl font-semibold">5. Termination</h2>
            <p>
             We may terminate or suspend your access to our Services immediately, without prior notice or liability, for any reason whatsoever, including without limitation if you breach the Terms.
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
