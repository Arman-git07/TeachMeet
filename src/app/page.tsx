
'use client';
import { Logo } from '@/components/common/Logo';
import { SlideUpPanel } from '@/components/common/SlideUpPanel';
import { AppHeader } from '@/components/common/AppHeader';
import { AppSidebar } from '@/components/common/AppSidebar';
import { SidebarInset } from '@/components/ui/sidebar';
import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';

export default function HomePage() {
  const [logoText, setLogoText] = useState('TeachMeet');
  const [isAnimatingChars, setIsAnimatingChars] = useState(false);
  const [animationLock, setAnimationLock] = useState(false);

  const handleComplexLogoAnimation = () => {
    if (animationLock) return;

    setAnimationLock(true);
    setIsAnimatingChars(false); // Ensure no char animation when "TM" is shown
    setLogoText('TM');

    const tmVisibleDuration = 300; // How long "TM" is visible
    const charAnimationTotalDuration = 8 * 50 + 500; // (number of chars * delay) + base animation duration

    setTimeout(() => {
      setLogoText('TeachMeet');
      setIsAnimatingChars(true); // Trigger character animation for "TeachMeet"
    }, tmVisibleDuration);

    setTimeout(() => {
      setIsAnimatingChars(false); // End character animation state
      setAnimationLock(false); // Release lock
    }, tmVisibleDuration + charAnimationTotalDuration + 100); // Add a small buffer
  };

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
              text={logoText}
              size="large"
              animateChars={isAnimatingChars}
              className={cn(
                "mb-8 animate-fadeIn text-center cursor-pointer",
                // The 'animate-logoExpand' class is no longer used here directly
              )}
              onClick={handleComplexLogoAnimation}
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
        .animate-fadeIn { animation: fadeIn 0.8s ease-out forwards; }
        .animate-slideUp { animation: slideUp 0.8s ease-out 0.2s forwards; }

        /* Character Animation */
        .logo-animated-char {
          display: inline-block; /* Needed for transform */
          opacity: 0;
          transform: translateY(20px);
          animation: charReveal 0.5s forwards;
        }

        @keyframes charReveal {
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        /* Specific animation for T to slide from left (example) */
        .logo-animated-char.char-0 {
           /* Keep default charReveal, or specialize if needed */
           /* For a more distinct "T" animation, you could do:
           opacity: 0;
           transform: translateX(-30px);
           animation: tReveal 0.6s forwards;
           */
        }
        /*
        @keyframes tReveal {
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
        */
      `}</style>
    </div>
  );
}
