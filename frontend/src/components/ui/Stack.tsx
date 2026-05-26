import { forwardRef } from 'react';
import { cn } from '../../lib/utils';

export interface StackProps extends React.HTMLAttributes<HTMLDivElement> {
  direction?: 'vertical' | 'horizontal';
  gap?: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 8 | 10 | 12 | 16 | 20 | 24;
  align?: 'start' | 'center' | 'end' | 'baseline' | 'stretch';
  justify?: 'start' | 'center' | 'end' | 'between' | 'around' | 'evenly';
  fullWidth?: boolean;
}

const Stack = forwardRef<HTMLDivElement, StackProps>(
  ({ className, direction = 'vertical', gap = 4, align, justify, fullWidth = true, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'flex',
          direction === 'vertical' ? 'flex-col' : 'flex-row',
          fullWidth && 'w-full',
          // Gap mapping based on --space tokens
          gap === 0 && 'gap-0',
          gap === 1 && 'gap-[var(--space-1)]',
          gap === 2 && 'gap-[var(--space-2)]',
          gap === 3 && 'gap-[var(--space-3)]',
          gap === 4 && 'gap-[var(--space-4)]',
          gap === 5 && 'gap-[var(--space-5)]',
          gap === 6 && 'gap-[var(--space-6)]',
          gap === 8 && 'gap-[var(--space-8)]',
          gap === 10 && 'gap-[var(--space-10)]',
          gap === 12 && 'gap-[var(--space-12)]',
          gap === 16 && 'gap-[var(--space-16)]',
          gap === 20 && 'gap-[var(--space-20)]',
          gap === 24 && 'gap-[var(--space-24)]',
          // Alignment
          align === 'start' && 'items-start',
          align === 'center' && 'items-center',
          align === 'end' && 'items-end',
          align === 'baseline' && 'items-baseline',
          align === 'stretch' && 'items-stretch',
          // Justify
          justify === 'start' && 'justify-start',
          justify === 'center' && 'justify-center',
          justify === 'end' && 'justify-end',
          justify === 'between' && 'justify-between',
          justify === 'around' && 'justify-around',
          justify === 'evenly' && 'justify-evenly',
          className
        )}
        {...props}
      />
    );
  }
);
Stack.displayName = 'Stack';

export { Stack };
