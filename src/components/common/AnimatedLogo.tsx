'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

type AnimatedLogoProps = {
  className?: string;
  size?: 'small' | 'medium' | 'large';
  text?: string;
};

/**
 * AnimatedLogo - A premium version of the Logo component with a click-triggered 
 * energy burst animation including scale pulse, wave ring, and particles.
 */
export function AnimatedLogo({ className, size = 'medium', text = 'TeachMeet' }: AnimatedLogoProps) {
  const [isAnimating, setIsAnimating] = useState(false);
  const [particles, setParticles] = useState<{ id: number; x: number; y: number }[]>([]);

  const sizeClasses = {
    small: 'text-3xl md:text-4xl',
    medium: 'text-5xl md:text-6xl',
    large: 'text-7xl md:text-8xl',
  };

  const handleClick = () => {
    if (isAnimating) return;
    setIsAnimating(true);

    // Generate 16 glowing particles for the burst
    const newParticles = Array.from({ length: 16 }).map((_, i) => ({
      id: Date.now() + i,
      x: (Math.random() - 0.5) * 350,
      y: (Math.random() - 0.5) * 350,
    }));
    setParticles(newParticles);

    // Reset state after animation duration (1s)
    setTimeout(() => {
      setIsAnimating(false);
      setParticles([]);
    }, 1000);
  };

  return (
    <div 
      className={cn('relative inline-flex items-center justify-center cursor-pointer select-none', className)}
      onClick={handleClick}
    >
      {/* 1. Background Radial Glow Flash */}
      <AnimatePresence>
        {isAnimating && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 0.3, scale: 2.5 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="absolute inset-0 bg-[#32CD32] blur-[60px] rounded-full pointer-events-none -z-10"
          />
        )}
      </AnimatePresence>

      {/* 2. Energy Wave Ring */}
      <AnimatePresence>
        {isAnimating && (
          <motion.div
            initial={{ scale: 0.5, opacity: 0.6 }}
            animate={{ scale: 3, opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            className="absolute w-24 h-24 border-2 border-[#22c55e] rounded-full pointer-events-none z-0 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
          />
        )}
      </AnimatePresence>

      {/* 3. Particle Burst */}
      {particles.map((p) => (
        <motion.div
          key={p.id}
          initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
          animate={{ x: p.x, y: p.y, opacity: 0, scale: 0 }}
          transition={{ duration: Math.random() * 0.4 + 0.6, ease: [0.23, 1, 0.32, 1] }}
          className="absolute w-1.5 h-1.5 bg-[#22c55e] rounded-full shadow-[0_0_10px_#32CD32] z-50 pointer-events-none top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
        />
      ))}

      {/* 4. Main Logo Text with Scale & Pulse Animation */}
      <motion.div
        animate={isAnimating ? {
          scale: [1, 1.08, 1],
        } : {}}
        transition={{ duration: 0.5, ease: [0.34, 1.56, 0.64, 1] }}
        className="relative z-10 flex items-center justify-center"
      >
        <motion.h1
          animate={isAnimating ? {
            filter: [
              `drop-shadow(1px 1px 0px #228B22) drop-shadow(2px 2px 0px #008B8B) drop-shadow(4px 4px 10px rgba(50, 205, 50, 0.3))`,
              `drop-shadow(1px 1px 0px #228B22) drop-shadow(2px 2px 0px #008B8B) drop-shadow(0px 0px 30px rgba(50, 205, 50, 0.9))`,
              `drop-shadow(1px 1px 0px #228B22) drop-shadow(2px 2px 0px #008B8B) drop-shadow(4px 4px 10px rgba(50, 205, 50, 0.3))`
            ]
          } : {}}
          transition={{ duration: 0.5 }}
          className={cn(
            'font-bold pb-2',
            sizeClasses[size]
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
        >
          {text}
        </motion.h1>
      </motion.div>
    </div>
  );
}
