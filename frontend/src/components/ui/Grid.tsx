import { forwardRef } from 'react';
import { cn } from '../../lib/utils';

export interface GridProps extends React.HTMLAttributes<HTMLDivElement> {
  cols?: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;
  gap?: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 8 | 10 | 12 | 16;
  align?: 'start' | 'center' | 'end' | 'stretch';
}

const Grid = forwardRef<HTMLDivElement, GridProps>(
  ({ className, cols = 1, gap = 4, align, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'grid',
          // Columns mapping
          cols === 1 && 'grid-cols-1',
          cols === 2 && 'grid-cols-2',
          cols === 3 && 'grid-cols-3',
          cols === 4 && 'grid-cols-4',
          cols === 5 && 'grid-cols-5',
          cols === 6 && 'grid-cols-6',
          cols === 7 && 'grid-cols-7',
          cols === 8 && 'grid-cols-8',
          cols === 9 && 'grid-cols-9',
          cols === 10 && 'grid-cols-10',
          cols === 11 && 'grid-cols-11',
          cols === 12 && 'grid-cols-12',
          // Gap mapping
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
          // Alignment
          align === 'start' && 'items-start',
          align === 'center' && 'items-center',
          align === 'end' && 'items-end',
          align === 'stretch' && 'items-stretch',
          className
        )}
        {...props}
      />
    );
  }
);
Grid.displayName = 'Grid';

export { Grid };
