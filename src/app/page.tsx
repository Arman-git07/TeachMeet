import { Logo } from '@/components/common/Logo';
import { SlideUpPanel } from '@/components/common/SlideUpPanel';
import { AppHeader } from '@/components/common/AppHeader';
import { AppSidebar } from '@/components/common/AppSidebar'; // For mobile view and unauth options
import { SidebarInset } from '@/components/ui/sidebar'; // Main content area wrapper

export default function HomePage() {
  // This page will serve as the public landing.
  // Authentication status would typically determine if user sees this or is redirected.
  // For now, we assume it's the public view.
  const isAuthenticated = false; // Mock auth state

  return (
    <div className="flex flex-col min-h-screen">
      <AppSidebar isAuthenticated={isAuthenticated} />
      <SidebarInset>
        <AppHeader showLogo={false} />
        <main className="flex-grow flex flex-col items-center justify-center p-4 text-center relative overflow-hidden">
          <div 
            className="absolute inset-0 opacity-10"
            style={{
              backgroundImage: "radial-gradient(hsl(var(--primary)) 1px, transparent 1px), radial-gradient(hsl(var(--accent)) 1px, transparent 1px)",
              backgroundSize: "30px 30px, 30px 30px",
              backgroundPosition: "0 0, 15px 15px",
              maskImage: "radial-gradient(circle at center, white, transparent 70%)"
            }}
          />
          <div className="relative z-10 mb-20"> {/* Added mb-20 to avoid overlap with slide panel */}
            <Logo size="large" className="mb-8 animate-fadeIn" />
            <p className="text-xl text-foreground/80 mb-4 animate-slideUp">
              Experience seamless 3D meetings with low data usage.
            </p>
            <div className="mt-8 p-6 bg-card/50 backdrop-blur-sm rounded-xl shadow-lg max-w-md mx-auto">
              <h2 className="text-2xl font-semibold text-primary mb-3">Latest Activity</h2>
              <p className="text-muted-foreground">No ongoing meetings. Start one now!</p>
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
      `}</style>
    </div>
  );
}
