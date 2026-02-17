'use client';

import { cn } from '@/lib/utils';
import { useState, type HTMLAttributes } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

type LogoProps = {
  className?: string;
  size?: 'small' | 'medium' | 'large';
  text?: string;
} & HTMLAttributes<HTMLHeadingElement>;

export function Logo({ className, size = 'medium', text = 'TeachMeet', ...props }: LogoProps) {
  const [phase, setPhase] = useState<'normal' | 'hidden' | 'shimmer'>('normal');

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (phase !== 'normal') return;

    // Phase 1: Vanish instantly
    setPhase('hidden');

    // Phase 2: Start rainbow shimmer after a tiny gap
    setTimeout(() => {
      setPhase('shimmer');
      
      // Phase 3: Shimmer for 1s, then reappear slowly
      setTimeout(() => {
        setPhase('normal');
      }, 1000);
    }, 100);
  };

  const sizeClasses = {
    small: 'text-3xl md:text-4xl',
    medium: 'text-5xl md:text-6xl',
    large: 'text-7xl md:text-8xl',
  };

  return (
    <div className="relative inline-block cursor-pointer active:scale-95 transition-transform" onClick={handleClick}>
      <AnimatePresence mode="wait">
        {phase === 'normal' && (
          <motion.h1
            key="logo-normal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className={cn(
              'select-none pb-2 inline-block font-bold',
              sizeClasses[size],
              className
            )}
            style={{
              fontFamily: "'Oleo Script', system-ui",
              display: 'inline-block',
              transform: 'scaleX(1.4)',
              transformOrigin: 'center',
              letterSpacing: '-0.06em',
              background: 'linear-gradient(to top, #32CD32, #00FFFF)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              filter: `drop-shadow(1px 1px 0px #228B22) 
                      drop-shadow(2px 2px 0px #008B8B) 
                      drop-shadow(4px 4px 10px rgba(50, 205, 50, 0.3))`,
            }}
            {...props}
          >
            {text}
          </motion.h1>
        )}

        {phase === 'shimmer' && (
          <motion.h1
            key="logo-shimmer"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className={cn(
              'select-none pb-2 inline-block font-bold animate-pulse',
              sizeClasses[size],
              className
            )}
            style={{
              fontFamily: "'Oleo Script', system-ui",
              display: 'inline-block',
              transform: 'scaleX(1.4)',
              transformOrigin: 'center',
              letterSpacing: '-0.06em',
              // Vibrant rainbow shimmer using brand variants
              background: 'linear-gradient(90deg, #32CD32, #00FFFF, #32CD32, #00FFFF)',
              backgroundSize: '200% auto',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              animation: 'rainbowShimmer 1s linear infinite',
            }}
          >
            {text}
            <style jsx>{`
              @keyframes rainbowShimmer {
                to { background-position: 200% center; }
              }
            `}</style>
          </motion.h1>
        )}
      </AnimatePresence>
    </div>
  );
}
