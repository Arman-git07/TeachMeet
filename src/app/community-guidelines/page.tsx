
// src/app/community-guidelines/page.tsx
import { AppHeader } from '@/components/common/AppHeader';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import Link from 'next/link';

export default function CommunityGuidelinesPage() {
  return (
    <div className="flex flex-col min-h-screen">
      <AppHeader showLogo={true} />
      <main className="flex-grow container mx-auto py-12 px-4">
        <Card className="max-w-3xl mx-auto shadow-lg rounded-xl border-border/50">
          <CardHeader className="text-center border-b pb-6">
            <CardTitle className="text-3xl font-bold">Community Guidelines</CardTitle>
            <CardDescription className="text-muted-foreground mt-2">Creating a Safe and Respectful Environment</CardDescription>
          </CardHeader>
          <CardContent className="prose prose-sm sm:prose-base dark:prose-invert max-w-none py-8 px-6 space-y-6">
            <p className="text-lg font-semibold text-center text-destructive">These are Placeholder Community Guidelines.</p>
            <p>
              TeachMeet is dedicated to providing a welcoming and harassment-free experience for everyone.
              We do not tolerate harassment of participants in any form.
            </p>

            <h2 className="text-xl font-semibold">1. Be Respectful</h2>
            <p>
              Treat all users with respect. Healthy debates are natural, but kindness is required.
              Do not engage in personal attacks, bullying, or any form of harassment.
            </p>

            <h2 className="text-xl font-semibold">2. No Hateful Conduct or Harmful Content</h2>
            <p>
              Do not share content that is obscene, pornographic, defamatory, libelous, threatening, harassing,
              hateful, racially or ethnically offensive, or encourages conduct that would be considered a criminal offense.
              This includes, but is not limited to, any content that exploits, abuses, or endangers children.
              <strong>Adult content is strictly prohibited.</strong> We reserve the right to remove such content and
              terminate accounts of users who violate this policy.
            </p>

            <h2 className="text-xl font-semibold">3. Protect Privacy</h2>
            <p>
              Do not share personal information about others without their explicit consent.
              Respect the privacy of all participants.
            </p>
            
            <h2 className="text-xl font-semibold">4. No Illegal Activities</h2>
            <p>
             Do not use TeachMeet for any illegal activities or to promote illegal acts.
            </p>

            <h2 className="text-xl font-semibold">5. Reporting Violations</h2>
            <p>
             If you see something that you believe violates our guidelines, please report it.
             (Note: Actual reporting mechanisms would need to be implemented).
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
