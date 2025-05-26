
import { Logo } from '@/components/common/Logo';
import Link from 'next/link';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-background via-background to-primary/10 p-4">
      <div className="absolute inset-0 opacity-5"
           style={{
             backgroundImage: "radial-gradient(hsl(var(--primary)) 0.5px, transparent 0.5px), radial-gradient(hsl(var(--accent)) 0.5px, transparent 0.5px)",
             backgroundSize: "30px 30px, 30px 30px", // Increased size for subtlety
             backgroundPosition: "0 0, 15px 15px",    // Adjusted position
           }}
      />
      <div className="w-full max-w-md space-y-8 z-10">
        <Link href="/" className="flex justify-center mb-12">
          <Logo size="medium" />
        </Link>
        <div className="bg-card p-8 rounded-2xl shadow-2xl border border-border/50">
          {children}
        </div>
      </div>
    </div>
  );
}
