'use client';

import { cn } from '@/lib/utils';
import type { HTMLAttributes } from 'react';

type LogoProps = {
  className?: string;
  size?: 'small' | 'medium' | 'large';
  text?: string;
  animateChars?: boolean; // Used for complex character animation
} & HTMLAttributes<HTMLHeadingElement>;

export function Logo({ className, size = 'medium', text = 'TeachMeet', animateChars = false, ...props }: LogoProps) {
  const sizeClasses = {
    small: 'text-3xl md:text-4xl',
    medium: 'text-5xl md:text-6xl',
    large: 'text-7xl md:text-8xl',
  };

  const renderText = () => {
    if (animateChars && text === 'TeachMeet') {
      return text.split('').map((char, index) => (
        <span
          key={index}
          className={cn(
            'logo-animated-span', // Base class for individual char styling if needed
            `char-index-${index}`  // Specific class for targeting individual chars
          )}
        >
          {char}
        </span>
      ));
    }
    return text; // Render plain text if not animating or if text is "TM"
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
        letterSpacing: '-0.06em', // Tightened spacing to create a cohesive unit
        background: 'linear-gradient(to right, #32CD32, #00FFFF)', // Explicit Green to Cyan-Blue gradient
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        fontWeight: 'bold',
        filter: `drop-shadow(1px 1px 0px #228B22) 
                drop-shadow(2px 2px 0px #008B8B) 
                drop-shadow(4px 4px 10px rgba(50, 205, 50, 0.3))`, // Subtle 3D depth using branding colors
      }}
      {...props}
    >
      {renderText()}
    </h1>
  );
}
