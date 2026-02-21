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
 * AnimatedLogo - A high-impact cinematic 3D logo component.
 * Triggers an extreme 3D push-back effect on click, moving the text 
 * deep into visual space before springing it back with force.
 */
export function AnimatedLogo({ className, size = 'medium', text = 'TeachMeet' }: AnimatedLogoProps) {
  const [isAnimating, setIsAnimating] = useState(false);

  const sizeClasses = {
    small: 'text-3xl md:text-4xl',
    medium: 'text-5xl md:text-6xl',
    large: 'text-7xl md:text-8xl',
  };

  const handleImpact = () => {
    if (isAnimating) return;
    setIsAnimating(true);
    // Reset state after the animation sequence finishes
    setTimeout(() => setIsAnimating(false), 1200);
  };

  return (
    <div 
      className={cn('relative inline-flex items-center justify-center cursor-pointer select-none', className)}
      onClick={handleImpact}
      style={{ perspective: '1200px' }}
    >
      {/* 1. Background Radial Glow Flash - Appears during impact */}
      {isAnimating && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: [0, 0.3, 0], scale: [0.8, 1.6, 2.2] }}
          transition={{ duration: 1, ease: "easeOut" }}
          className="absolute inset-0 bg-[#32CD32] blur-[90px] rounded-full -z-10 pointer-events-none"
        />
      )}

      {/* 2. Expanding Shockwave Ring */}
      <AnimatePresence>
        {isAnimating && (
          <motion.div
            initial={{ scale: 0.2, opacity: 0.7, border: '3px solid #32CD32' }}
            animate={{ scale: 5, opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 rounded-full z-10 pointer-events-none shadow-[0_0_50px_#32CD32]"
          />
        )}
      </AnimatePresence>

      {/* 3. Screen Shake & Lighting Flash Wrapper */}
      <motion.div
        animate={isAnimating ? {
          x: [0, -3, 3, -3, 3, 0],
          y: [0, 3, -3, 3, -3, 0],
        } : {}}
        transition={{ duration: 0.4, times: [0, 0.2, 0.4, 0.6, 0.8, 1] }}
        className="relative"
        style={{ transformStyle: 'preserve-3d' }}
      >
        {/* Lighting Flash Overlay */}
        <AnimatePresence>
          {isAnimating && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 1, 0] }}
              transition={{ duration: 0.3, times: [0, 0.3, 1] }}
              className="absolute inset-0 bg-white/50 blur-3xl z-40 pointer-events-none rounded-xl"
            />
          )}
        </AnimatePresence>

        {/* 4. EXTREME 3D Push-Back Animation */}
        <motion.div
          initial={{ z: 0, rotateX: 0, rotateY: 0, scale: 1 }}
          animate={isAnimating ? {
            // Sequence: Tension -> Extreme Push Back -> Hold -> Powerful Return
            z: [0, -30, -750, -750, 40, 0],
            scale: [1, 0.92, 0.4, 0.4, 1.1, 1],
            rotateX: [0, 0, 18, 18, -4, 0],
            rotateY: [0, 0, -18, -18, 4, 0],
            filter: [
              'blur(0px) drop-shadow(0 0 10px rgba(50, 205, 50, 0.3))',
              'blur(0.5px) drop-shadow(0 0 15px rgba(50, 205, 50, 0.4))',
              'blur(5px) drop-shadow(0 0 5px rgba(50, 205, 50, 0.1))',
              'blur(5px) drop-shadow(0 0 5px rgba(50, 205, 50, 0.1))',
              'blur(0px) drop-shadow(0 0 40px rgba(50, 205, 50, 0.9))',
              'blur(0px) drop-shadow(0 0 10px rgba(50, 205, 50, 0.3))'
            ],
          } : {
            z: 0, scale: 1, rotateX: 0, rotateY: 0,
            filter: 'blur(0px) drop-shadow(0 0 10px rgba(50, 205, 50, 0.3))'
          }}
          transition={isAnimating ? {
            duration: 1.2,
            times: [0, 0.08, 0.35, 0.45, 0.85, 1],
            ease: [0.34, 1.56, 0.64, 1] // Custom spring-like easing for keyframes
          } : {}}
          style={{ transformStyle: 'preserve-3d', willChange: 'transform' }}
        >
          {/* Logo Text Styling - Maintained from original brand ID */}
          <h1
            className={cn(
              'font-bold pb-2 transition-all duration-300',
              sizeClasses[size]
            )}
            style={{
              fontFamily: "'Oleo Script', system-ui",
              display: 'inline-block',
              transformOrigin: 'center',
              letterSpacing: '-0.06em',
              backgroundImage: 'linear-gradient(to top, #32CD32, #00FFFF)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              transform: 'scaleX(1.4)', // Base stylization for Oleo Script
              filter: `drop-shadow(1px 1px 0px #228B22) 
                      drop-shadow(2px 2px 0px #008B8B)`
            }}
          >
            {text}
          </h1>
        </motion.div>
      </motion.div>
    </div>
  );
}
