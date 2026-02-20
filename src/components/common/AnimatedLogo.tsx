'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

type AnimatedLogoProps = {
  className?: string;
  size?: 'small' | 'medium' | 'large';
  text?: string;
};

/**
 * AnimatedLogo - Premium Liquid Morph + Gradient Flow interactive logo.
 * Triggers a sophisticated elastic distortion and color flow on click.
 */
export function AnimatedLogo({ className, size = 'medium', text = 'TeachMeet' }: AnimatedLogoProps) {
  const [isAnimating, setIsAnimating] = useState(false);

  const sizeClasses = {
    small: 'text-3xl md:text-4xl',
    medium: 'text-5xl md:text-6xl',
    large: 'text-7xl md:text-8xl',
  };

  const handleClick = () => {
    if (isAnimating) return;
    setIsAnimating(true);
    // Reset state after the animation sequence finishes (approx 1.5s)
    setTimeout(() => setIsAnimating(false), 1500);
  };

  // Easing: cubic-bezier(0.22, 1, 0.36, 1) for a smooth, premium feel
  const premiumEasing = [0.22, 1, 0.36, 1];

  return (
    <div 
      className={cn('relative inline-flex items-center justify-center cursor-pointer select-none', className)}
      onClick={handleClick}
    >
      {/* 1. Subtle ripple glow behind text during morph */}
      {isAnimating && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: [0, 0.15, 0], scale: [0.8, 1.4, 1.8] }}
          transition={{ duration: 1.5, ease: "easeOut" }}
          className="absolute inset-0 bg-[#00f5a0] blur-[60px] rounded-full pointer-events-none -z-10"
        />
      )}

      {/* 2. Main Logo Text with Morph + Gradient Animation */}
      <motion.h1
        initial={{ scaleX: 1.4, scaleY: 1, skewX: 0, skewY: 0 }}
        animate={isAnimating ? {
          // Morph: anticipation (0.1s) -> inward compression, then liquid stretch
          scaleX: [1.4, 1.32, 1.68, 1.36, 1.43, 1.4],
          scaleY: [1, 1.08, 0.8, 1.04, 0.97, 1],
          skewX: [0, -4, 6, -2, 1, 0],
          skewY: [0, 2, -3, 1, -0.5, 0],
          // Subtle blur and glow enhancement
          filter: [
            'blur(0px) drop-shadow(0 0 10px rgba(50, 205, 50, 0.2))',
            'blur(0.5px) drop-shadow(0 0 15px rgba(0, 245, 160, 0.3))',
            'blur(2px) drop-shadow(0 0 35px rgba(0, 245, 160, 0.7))',
            'blur(1px) drop-shadow(0 0 20px rgba(0, 245, 160, 0.4))',
            'blur(0.2px) drop-shadow(0 0 12px rgba(50, 205, 50, 0.2))',
            'blur(0px) drop-shadow(0 0 10px rgba(50, 205, 50, 0.2))'
          ],
          // Gradient Flow
          backgroundPosition: ['0% 50%', '20% 50%', '50% 50%', '80% 50%', '95% 50%', '100% 50%'],
        } : {
          scaleX: 1.4,
          scaleY: 1,
          skewX: 0,
          skewY: 0,
          filter: 'blur(0px) drop-shadow(0 0 10px rgba(50, 205, 50, 0.2))',
          backgroundPosition: '0% 50%',
        }}
        transition={{
          duration: 1.5,
          ease: premiumEasing,
          times: [0, 0.1, 0.35, 0.6, 0.85, 1]
        }}
        className={cn(
          'font-bold pb-2 transition-all duration-300',
          sizeClasses[size]
        )}
        style={{
          fontFamily: "'Oleo Script', system-ui",
          display: 'inline-block',
          transformOrigin: 'center',
          letterSpacing: '-0.06em',
          // Premium Gradient colors: #22c55e (green), #16a34a (deep green), #00f5a0 (neon mint)
          backgroundImage: 'linear-gradient(90deg, #22c55e, #00f5a0, #16a34a, #22c55e)',
          backgroundSize: '300% auto',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
        }}
      >
        {text}
      </motion.h1>
    </div>
  );
}
