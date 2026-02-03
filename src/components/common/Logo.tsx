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
        'font-extrabold tracking-tight text-gel-gradient select-none',
        sizeClasses[size],
        className
      )}
      style={{
        textShadow: `
          2px 4px 8px rgba(0, 0, 0, 0.15),
          0px 6px 15px hsl(var(--primary) / 0.6),
          0px 10px 30px hsl(var(--accent) / 0.4),
          0px 0px 40px hsl(var(--primary) / 0.3)
        `,
      }}
      {...props}
    >
      {renderText()}
    </h1>
  );
}
