import { Logo } from '@/components/common/Logo';
import Link from 'next/link';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-card p-4 sm:bg-gradient-to-br sm:from-background sm:via-background sm:to-primary/10 sm:p-8">
      <div className="w-full max-w-md">
        <Link href="/" className="flex justify-center mb-8">
          <Logo size="medium" />
        </Link>
        {children}
      </div>
    </div>
  );
}
