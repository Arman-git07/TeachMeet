'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

type AnimatedLogoProps = {
  className?: string;
  size?: 'small' | 'medium' | 'large';
  text?: string;
};

/**
 * AnimatedLogo - Futuristic Teleport Materialization
 * 
 * Phases:
 * 1. Impact Push: 3D Force push into deep space.
 * 2. Vanish: Logo disappears.
 * 3. Portal: Cinematic energy ring appears in center.
 * 4. Teleport: Logo rematerializes from portal and zooms forward.
 * 5. Settle: Final premium neon pulse.
 */
export function AnimatedLogo({ className, size = 'medium', text = 'TeachMeet' }: AnimatedLogoProps) {
  const [animationStage, setAnimationStage] = useState<'idle' | 'push' | 'portal' | 'return'>('idle');

  const sizeClasses = {
    small: 'text-3xl md:text-4xl',
    medium: 'text-5xl md:text-6xl',
    large: 'text-7xl md:text-8xl',
  };

  const handleTrigger = () => {
    if (animationStage !== 'idle') return;
    
    setAnimationStage('push');
    
    // Sequence timing
    setTimeout(() => setAnimationStage('portal'), 600);
    setTimeout(() => setAnimationStage('return'), 1300);
    setTimeout(() => setAnimationStage('idle'), 2200);
  };

  return (
    <div 
      className={cn('relative inline-flex items-center justify-center cursor-pointer select-none py-12 px-4', className)}
      onClick={handleTrigger}
      style={{ perspective: '1500px' }}
    >
      {/* 1. Perspective Container */}
      <div className="relative" style={{ transformStyle: 'preserve-3d' }}>
        
        {/* 2. Portal Visual Effect */}
        <AnimatePresence>
          {animationStage === 'portal' && (
            <motion.div
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: [0.9, 1.1, 0.95] }}
              exit={{ opacity: 0, scale: 1.5 }}
              transition={{ 
                duration: 0.7, 
                scale: { repeat: Infinity, duration: 1.2, ease: "easeInOut" }
              }}
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-0"
            >
              {/* Inner Core */}
              <div className="w-32 h-32 md:w-48 md:h-48 rounded-full bg-gradient-to-r from-white via-primary to-accent blur-md opacity-40 animate-pulse" />
              {/* Energy Ring */}
              <div className="absolute inset-0 border-4 border-primary rounded-full shadow-[0_0_30px_#32CD32] mix-blend-screen" />
              {/* Outer Bloom */}
              <div className="absolute -inset-8 bg-primary/20 rounded-full blur-3xl" />
            </motion.div>
          )}
        </AnimatePresence>

        {/* 3. The Logo Text */}
        <motion.div
          animate={
            animationStage === 'push' ? {
              z: -900,
              scale: 0.3,
              rotateX: 20,
              rotateY: -20,
              opacity: [1, 1, 0],
              filter: 'blur(4px)',
            } : animationStage === 'portal' ? {
              opacity: 0,
              z: -900,
            } : animationStage === 'return' ? {
              z: [ -600, 20, 0 ],
              scale: [ 0.2, 1.1, 1 ],
              opacity: [ 0, 1, 1 ],
              rotateX: [ 10, -5, 0 ],
              rotateY: [ -10, 5, 0 ],
              filter: 'blur(0px)',
            } : {
              z: 0,
              scale: 1,
              rotateX: 0,
              rotateY: 0,
              opacity: 1,
              filter: 'blur(0px)',
            }
          }
          transition={
            animationStage === 'push' ? { duration: 0.5, ease: "easeIn" } :
            animationStage === 'return' ? { 
              type: 'spring', 
              stiffness: 260, 
              damping: 15, 
              mass: 1.2,
              opacity: { duration: 0.3 }
            } : { duration: 0.3 }
          }
          style={{ transformStyle: 'preserve-3d', willChange: 'transform, opacity' }}
          className="relative z-10"
        >
          {/* Main Logo Text Layer */}
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
              transform: 'scaleX(1.4)',
              filter: `drop-shadow(1px 1px 0px #228B22) 
                      drop-shadow(2px 2px 0px #008B8B)
                      ${animationStage === 'idle' ? 'drop-shadow(0 0 10px rgba(50, 205, 50, 0.3))' : 'drop-shadow(0 0 25px rgba(50, 205, 50, 0.8))'}`
            }}
          >
            {text}
          </h1>

          {/* Light Beams Effect during re-entry */}
          {animationStage === 'return' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 1, 0] }}
              transition={{ duration: 0.6 }}
              className="absolute inset-0 pointer-events-none"
            >
              {[...Array(5)].map((_, i) => (
                <div 
                  key={i} 
                  className="absolute w-1 bg-white/40 blur-sm"
                  style={{ 
                    height: '200%', 
                    left: `${20 * i}%`, 
                    top: '-50%',
                    transform: 'skewX(-15deg)' 
                  }}
                />
              ))}
            </motion.div>
          )}
        </motion.div>

        {/* 4. Screen Shake & Flash Overlay */}
        <AnimatePresence>
          {animationStage === 'push' && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 1, 0] }}
                transition={{ duration: 0.2 }}
                className="fixed inset-0 bg-white/10 pointer-events-none z-[100]"
              />
              <motion.div
                animate={{ x: [-2, 2, -2, 2, 0], y: [2, -2, 2, -2, 0] }}
                transition={{ duration: 0.3 }}
                className="absolute inset-0 pointer-events-none"
              />
            </>
          )}
        </AnimatePresence>

      </div>
    </div>
  );
}
