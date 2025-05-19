import { cn } from '@/lib/utils';

type LogoProps = {
  className?: string;
  size?: 'small' | 'medium' | 'large';
};

export function Logo({ className, size = 'medium' }: LogoProps) {
  const sizeClasses = {
    small: 'text-3xl md:text-4xl',
    medium: 'text-5xl md:text-6xl',
    large: 'text-7xl md:text-8xl',
  };

  return (
    <h1
      className={cn(
        'font-extrabold tracking-tight text-gel-gradient select-none',
        sizeClasses[size],
        className
      )}
      style={{
        WebkitTextStroke: `1px hsl(var(--background) / 0.5)`, // Simulates inflation
        textShadow: `
          0px 2px 2px hsl(var(--background) / 0.3),
          0px 4px 5px hsl(var(--primary) / 0.2),
          0px 0px 10px hsl(var(--accent) / 0.2),
          2px 2px 3px hsl(var(--primary-foreground) / 0.05)
        `, // Complex shadow for 3D gel effect
      }}
    >
      TeachMeet
    </h1>
  );
}
