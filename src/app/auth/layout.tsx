import { Logo } from '@/components/common/Logo';
import Link from 'next/link';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-background via-background to-primary/10 p-4 sm:p-6 md:p-8">
      <div className="w-full max-w-md bg-card p-6 sm:p-8 rounded-2xl shadow-2xl border border-border/50">
        <Link href="/" className="flex justify-center mb-8">
          <Logo size="medium" />
        </Link>
        {children}
      </div>
    </div>
  );
}
