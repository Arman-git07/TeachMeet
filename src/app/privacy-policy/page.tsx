
// src/app/privacy-policy/page.tsx
import { AppHeader } from '@/components/common/AppHeader';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import Link from 'next/link';

export default function PrivacyPolicyPage() {
  return (
    <div className="flex flex-col min-h-screen">
      <AppHeader showLogo={true} />
      <main className="flex-grow container mx-auto py-12 px-4">
        <Card className="max-w-3xl mx-auto shadow-lg rounded-xl border-border/50">
          <CardHeader className="text-center border-b pb-6">
            <CardTitle className="text-3xl font-bold">Privacy Policy</CardTitle>
            <CardDescription className="text-muted-foreground mt-2">Last Updated: [Date]</CardDescription>
          </CardHeader>
          <CardContent className="prose prose-sm sm:prose-base dark:prose-invert max-w-none py-8 px-6 space-y-6">
            <p className="text-lg font-semibold text-center text-destructive">This is a Placeholder Privacy Policy.</p>
            <p>
              This document is a template and does not constitute legal advice. You should consult with a legal professional
              to create a privacy policy that is compliant with all applicable laws and regulations for your specific
              application and data processing activities.
            </p>
            <p>
              TeachMeet ("we," "us," or "our") is committed to protecting your privacy. This Privacy Policy explains how we
              collect, use, disclose, and safeguard your information when you use our application.
            </p>

            <h2 className="text-xl font-semibold">1. Information We Collect (Placeholder)</h2>
            <p>
              We may collect personal information that you voluntarily provide to us when you register for an account,
              participate in meetings, or use other features of the app. This may include:
            </p>
            <ul>
              <li>Name, email address, profile picture.</li>
              <li>Meeting recordings and shared documents (if you choose to record or share).</li>
              <li>Usage data and analytics.</li>
            </ul>

            <h2 className="text-xl font-semibold">2. How We Use Your Information (Placeholder)</h2>
            <p>
              We may use the information we collect to:
            </p>
            <ul>
              <li>Provide, operate, and maintain the TeachMeet application.</li>
              <li>Improve, personalize, and expand our services.</li>
              <li>Communicate with you, including for customer service and support.</li>
              <li>Process your transactions.</li>
              <li>Monitor and analyze usage and trends to improve your experience.</li>
            </ul>
             <p className="text-sm text-muted-foreground">
              Communications within TeachMeet meetings (audio, video, chat) are transmitted over encrypted channels (HTTPS/WSS).
              Data stored with Firebase (like user profiles and uploaded files) uses Firebase's standard encryption-at-rest.
              End-to-end encryption for meeting content itself is a complex feature and is not implemented in this prototype.
            </p>

            <h2 className="text-xl font-semibold">3. Disclosure of Your Information (Placeholder)</h2>
            <p>
              We will not share your personal information with third parties except as described in a complete and legally compliant
              Privacy Policy.
            </p>

            <h2 className="text-xl font-semibold">4. Security of Your Information (Placeholder)</h2>
            <p>
              We use administrative, technical, and physical security measures to help protect your personal information.
              While we have taken reasonable steps to secure the personal information you provide to us, please be aware that
              no security measures are perfect or impenetrable.
            </p>

            <h2 className="text-xl font-semibold">5. Your Choices and Rights (Placeholder)</h2>
            <p>
              You may have certain rights regarding your personal information, subject to local data protection laws.
              These may include the right to access, correct, or delete your personal data.
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
