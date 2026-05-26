import { forwardRef } from 'react';
import { motion } from 'framer-motion';
import { cn } from '../../lib/utils';
import { Stack } from './Stack';
import { Skeleton } from './Skeleton';

export interface PageProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  kicker?: React.ReactNode;
  animate?: boolean;
  isLoading?: boolean;
  fullWidth?: boolean;
}

const Page = forwardRef<HTMLDivElement, PageProps>(
  ({ className, title, subtitle, action, kicker, animate = true, isLoading, fullWidth, children, ...props }, ref) => {
    if (isLoading) {
      return (
        <div className={cn("page-shell flex flex-col gap-12 animate-fade-in", fullWidth && "max-w-none px-0")}>
          <div className="flex flex-col gap-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-32 rounded-3xl" />
            ))}
          </div>
          <Skeleton className="h-64 rounded-3xl w-full" />
        </div>
      );
    }

    const Content = (
      <Stack gap={12} className={cn('page-shell pb-32', fullWidth && "max-w-none px-0", className)} {...props}>
        {(title || kicker || action) && (
          <header className={cn("page-header sm:flex-row sm:items-center sm:justify-between sm:gap-4", fullWidth && "px-[var(--page-padding)]")}>
            <div>
              {kicker && (
                <div className="page-kicker flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
                  {kicker}
                </div>
              )}
              {title && <h1 className="page-title mt-1">{title}</h1>}
              {subtitle && <p className="page-description mt-1">{subtitle}</p>}
            </div>
            {action && <div>{action}</div>}
          </header>
        )}
        <div className={cn(fullWidth ? "w-full" : "")}>
          {children}
        </div>
      </Stack>
    );

    if (animate) {
      return (
        <motion.div
          ref={ref}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.26, ease: [0.16, 1, 0.3, 1] }}
        >
          {Content}
        </motion.div>
      );
    }

    return <div ref={ref}>{Content}</div>;
  }
);
Page.displayName = 'Page';

export { Page };
