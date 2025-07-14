
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
            <CardDescription className="text-muted-foreground mt-2">Last Updated: {new Date().toLocaleDateString()}</CardDescription>
          </CardHeader>
          <CardContent className="prose prose-sm sm:prose-base dark:prose-invert max-w-none py-8 px-6 space-y-6">
            <p className="text-lg font-semibold text-center text-destructive">This is a Placeholder Privacy Policy.</p>
            <p>
              This document is a template and does not constitute legal advice. You should consult with a legal professional
              to create a privacy policy that is compliant with all applicable laws for your specific
              application and data processing activities.
            </p>
            <p>
              TeachMeet ("we," "us," or "our") is committed to protecting your privacy. This Privacy Policy explains how we
              collect, use, disclose, and safeguard your information when you use our application.
            </p>

            <h2 className="text-xl font-semibold">1. Information We Collect</h2>
            <p>
              We may collect the following information:
            </p>
            <ul>
              <li><strong>Personal Information:</strong> When you register, we collect your name, email address, and an encrypted version of your password.</li>
              <li><strong>User-Generated Content:</strong> Any files you upload (documents, recordings) or content you generate (whiteboard screenshots) are stored on our servers. You control whether this content is private or public.</li>
              <li><strong>Usage Data:</strong> We may collect data about your interactions with the service, such as features used and session duration, to improve our application.</li>
            </ul>

            <h2 className="text-xl font-semibold">2. How We Use Your Information</h2>
            <p>
              We use the information we collect to:
            </p>
            <ul>
              <li>Provide, operate, and maintain the TeachMeet application.</li>
              <li>Improve, personalize, and expand our services.</li>
              <li>Authenticate users and manage accounts.</li>
              <li>Communicate with you for service-related purposes.</li>
              <li>Enforce our Terms of Service and Community Guidelines.</li>
            </ul>
            
            <h2 className="text-xl font-semibold">3. Data Security and Encryption</h2>
            <p>
              We take the security of your data seriously. Our security measures include:
            </p>
            <ul>
              <li><strong>Encryption in Transit:</strong> All communications between your device and our servers (including audio, video, and chat signaling) are encrypted using industry-standard protocols like TLS (HTTPS/WSS).</li>
              <li><strong>Encryption at Rest:</strong> Your data, including uploaded files and user information, is stored on Google Firebase servers and is encrypted at rest by default.</li>
            </ul>
            <p className="text-sm text-muted-foreground">
              Note: True end-to-end encryption (E2EE), where only participants can decrypt meeting content, is a highly complex feature and is not implemented in this prototype. Our current model secures the data channels to and from our servers.
            </p>

            <h2 className="text-xl font-semibold">4. Data Sharing and Disclosure</h2>
            <p>
              We do not sell your personal information. We will not share your personal information with third parties except in the following situations:
            </p>
             <ul>
              <li>With your explicit consent.</li>
              <li>To comply with legal obligations.</li>
              <li>To protect and defend our rights and property.</li>
              <li>For service provision with vendors who are bound by confidentiality agreements (e.g., our cloud provider, Google Firebase).</li>
            </ul>

            <h2 className="text-xl font-semibold">5. Your Choices and Rights</h2>
            <p>
              You have control over your data. From the dashboard and settings, you can access, manage, and delete your uploaded content (documents and recordings). You can also update your profile information or delete your account, subject to our data retention policies.
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
