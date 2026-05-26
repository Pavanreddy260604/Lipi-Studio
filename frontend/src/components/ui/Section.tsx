import { forwardRef } from 'react';
import { cn } from '../../lib/utils';
import { Stack } from './Stack';

export interface SectionProps extends React.HTMLAttributes<HTMLElement> {
  title?: string;
  subtitle?: string;
  action?: React.ReactNode;
  spacing?: 0 | 1 | 2 | 3 | 4 | 6 | 8 | 12;
}

const Section = forwardRef<HTMLElement, SectionProps>(
  ({ className, title, subtitle, action, spacing = 6, children, ...props }, ref) => {
    return (
      <section
        ref={ref}
        className={cn('w-full', className)}
        {...props}
      >
        <Stack gap={spacing}>
          {(title || action) && (
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-1">
                {title && (
                  <h2 className="text-xl font-bold tracking-tight text-heading">
                    {title}
                  </h2>
                )}
                {subtitle && (
                  <p className="text-sm text-secondary">
                    {subtitle}
                  </p>
                )}
              </div>
              {action && <div>{action}</div>}
            </div>
          )}
          {children}
        </Stack>
      </section>
    );
  }
);
Section.displayName = 'Section';

export { Section };
