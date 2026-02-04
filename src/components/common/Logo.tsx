'use client';

import { cn } from '@/lib/utils';
import type { HTMLAttributes } from 'react';

type LogoProps = {
  className?: string;
  size?: 'small' | 'medium' | 'large';
  text?: string;
  animateChars?: boolean; // Used for character-by-character animation
} & HTMLAttributes<HTMLHeadingElement>;

export function Logo({ className, size = 'medium', text = 'TeachMeet', animateChars = false, ...props }: LogoProps) {
  const sizeClasses = {
    small: 'text-3xl md:text-4xl',
    medium: 'text-5xl md:text-6xl',
    large: 'text-7xl md:text-8xl',
  };

  const renderText = () => {
    if (animateChars) {
      return text.split('').map((char, index) => (
        <span
          key={`${text}-${index}`}
          className={cn(
            'logo-animated-span', // Base class for animation defined in globals.css
            `char-index-${index}`  // Specific class for staggered delays
          )}
        >
          {char === ' ' ? '\u00A0' : char}
        </span>
      ));
    }
    return text;
  };

  return (
    <h1
      data-testid="sidebar-logo"
      className={cn(
        'select-none pb-2 inline-block',
        sizeClasses[size],
        className
      )}
      style={{
        fontFamily: "'Oleo Script', system-ui",
        display: 'inline-block',
        transform: 'scaleX(1.4)', // Horizontal stretch
        transformOrigin: 'center',
        letterSpacing: '-0.06em', // Tightened spacing
        background: 'linear-gradient(to top, #32CD32, #00FFFF)', // Vertical gradient: Green (bottom) to Cyan (top)
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        fontWeight: 'bold',
        filter: `drop-shadow(1px 1px 0px #228B22) 
                drop-shadow(2px 2px 0px #008B8B) 
                drop-shadow(4px 4px 10px rgba(50, 205, 50, 0.3))`, // 3D depth effect
      }}
      {...props}
    >
      {renderText()}
    </h1>
  );
}
