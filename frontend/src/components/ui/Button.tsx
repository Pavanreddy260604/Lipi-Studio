import { memo } from 'react';
import { motion } from 'framer-motion';
import { cn } from '../../lib/utils';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const LoadingSpinner = memo(function LoadingSpinner() {
  return (
    <motion.svg
      className="h-4 w-4"
      viewBox="0 0 24 24"
      aria-hidden="true"
      animate={{ rotate: 360 }}
      transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
    >
      <circle className="opacity-30" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" fill="none" />
      <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </motion.svg>
  );
});

export const Button = memo(function Button({
  children, className, variant = 'primary', size = 'md',
  isLoading = false, leftIcon, rightIcon, disabled, ...props
}: ButtonProps) {
  const variants = {
    primary: 'bg-accent text-on-accent border border-border-accent hover:bg-accent-hover disabled:bg-subtle-3 disabled:text-text-muted disabled:border-subtle-8 disabled:opacity-50',
    secondary: 'bg-surface-elevated text-heading border border-border-subtle hover:bg-surface-hover disabled:bg-subtle-2 disabled:text-text-muted disabled:border-subtle-5 disabled:opacity-40',
    ghost: 'bg-transparent text-secondary border border-transparent hover:bg-surface-elevated hover:text-heading disabled:opacity-30',
    danger: 'bg-status-error text-white border border-transparent hover:opacity-90 disabled:opacity-40',
  };

  const sizes = {
    sm: 'h-9 px-3 text-xs gap-1',
    md: 'min-h-[var(--touch-target-min)] px-4 text-sm gap-2',
    lg: 'min-h-[48px] px-5 text-base gap-2',
  };

  return (
    <motion.button
      className={cn(
        'inline-flex items-center justify-center font-semibold select-none focus-ring touch-target rounded-xl',
        'transition-all duration-120 ease-smooth',
        'disabled:cursor-not-allowed',
        variants[variant],
        sizes[size],
        className
      )}
      disabled={disabled || isLoading}
      aria-busy={isLoading}
      whileHover={(!disabled && !isLoading) ? { scale: 1.02 } : undefined}
      whileTap={(!disabled && !isLoading) ? { scale: 0.98 } : undefined}
      transition={{ 
        duration: 0.12, 
        ease: [0.16, 1, 0.3, 1] 
      }}
      {...(props as any)}
    >
      {isLoading ? <LoadingSpinner /> : leftIcon}
      {children}
      {rightIcon}
    </motion.button>
  );
});
