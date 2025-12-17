import { Logo } from '@/components/common/Logo';
import Link from 'next/link';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-card sm:items-center sm:justify-center sm:bg-gradient-to-br sm:from-background sm:via-background sm:to-primary/10">
      <div className="flex-grow flex flex-col justify-center p-6 sm:w-full sm:max-w-md sm:flex-grow-0 sm:bg-card sm:p-8 sm:rounded-2xl sm:shadow-2xl sm:border sm:border-border/50">
        <Link href="/" className="flex justify-center mb-8">
          <Logo size="medium" />
        </Link>
        {children}
      </div>
    </div>
  );
}
