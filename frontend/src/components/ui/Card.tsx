import { forwardRef } from 'react';
import { cn } from '../../lib/utils';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'interactive' | 'highlight';
  hoverable?: boolean;
}

const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant = 'default', hoverable, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'bg-surface-elevated border border-subtle-8 rounded-2xl overflow-hidden',
          'transition-all duration-120 ease-smooth',
          hoverable && 'hover:bg-subtle-3',
          variant === 'interactive' && 'cursor-pointer active:scale-[0.99] active:bg-subtle-5',
          variant === 'highlight' && 'border-accent',
          className
        )}
        {...props}
      />
    );
  }
);
Card.displayName = 'Card';

export { Card };
