
'use client';
import { Logo } from '@/components/common/Logo';
import { SlideUpPanel } from '@/components/common/SlideUpPanel';
import { AppHeader } from '@/components/common/AppHeader';
import { AppSidebar } from '@/components/common/AppSidebar';
import { SidebarInset } from '@/components/ui/sidebar';
import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';

export default function HomePage() {
  const [isLogoAnimating, setIsLogoAnimating] = useState(false);

  const handleLogoClick = () => {
    setIsLogoAnimating(true);
  };

  useEffect(() => {
    if (isLogoAnimating) {
      const timer = setTimeout(() => {
        setIsLogoAnimating(false);
      }, 400); // Duration of the animation
      return () => clearTimeout(timer);
    }
  }, [isLogoAnimating]);

  return (
    <div className="flex flex-col min-h-screen">
      <AppSidebar />
      <SidebarInset>
        <AppHeader showLogo={false} />
        <main className="flex-grow flex flex-col items-center justify-center p-4 relative overflow-hidden">
          <div
            className="absolute inset-0 opacity-10"
            style={{
              backgroundImage: "radial-gradient(hsl(var(--primary)) 1px, transparent 1px), radial-gradient(hsl(var(--accent)) 1px, transparent 1px)",
              backgroundSize: "30px 30px, 30px 30px",
              backgroundPosition: "0 0, 15px 15px",
              maskImage: "radial-gradient(circle at center, white, transparent 70%)"
            }}
          />
          <div className="relative z-10 flex flex-col items-center">
            <Logo
              size="large"
              className={cn(
                "mb-8 animate-fadeIn text-center cursor-pointer",
                isLogoAnimating && "animate-logoPulse"
              )}
              onClick={handleLogoClick}
            />
            <div className="mt-8 p-6 bg-card/50 backdrop-blur-sm rounded-xl shadow-lg max-w-md text-center">
              <h2 className="text-2xl font-semibold text-primary mb-3 text-center">Latest Activity</h2>
              <p className="text-muted-foreground text-center">No ongoing meetings. Start one now!</p>
              {/* Placeholder for activity list */}
            </div>
          </div>
        </main>
        <SlideUpPanel />
      </SidebarInset>
      <style jsx global>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes logoPulse {
          0% { transform: scale(1); }
          50% { transform: scale(1.05); }
          100% { transform: scale(1); }
        }
        .animate-fadeIn { animation: fadeIn 0.8s ease-out forwards; }
        .animate-slideUp { animation: slideUp 0.8s ease-out 0.2s forwards; }
        .animate-logoPulse { animation: logoPulse 0.4s ease-in-out; }
      `}</style>
    </div>
  );
}
