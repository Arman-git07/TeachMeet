'use client';

import { cn } from '@/lib/utils';
import { type HTMLAttributes } from 'react';

type LogoProps = {
  className?: string;
  size?: 'small' | 'medium' | 'large';
  text?: string;
} & HTMLAttributes<HTMLHeadingElement>;

export function Logo({ className, size = 'medium', text = 'TeachMeet', ...props }: LogoProps) {
  const sizeClasses = {
    small: 'text-3xl md:text-4xl',
    medium: 'text-5xl md:text-6xl',
    large: 'text-7xl md:text-8xl',
  };

  return (
    <h1
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
    </h1>
  );
}
