import { useState, forwardRef } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: string;
  error?: string;
  leftIcon?: React.ReactNode;
  helperText?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, helperText, leftIcon, className, type, id, disabled, size = 'md', ...props }, ref
) {
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === 'password';
  const inputId = id || (label ? `input-${label.toLowerCase().replace(/\s+/g, '-')}` : undefined);

  return (
    <div className={cn("w-full flex flex-col gap-1")}>
      {label && (
        <label
          htmlFor={inputId}
          className="text-xs font-semibold text-secondary tracking-wide"
        >
          {label}
        </label>
      )}
      <div className="relative">
        {leftIcon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-tertiary">
            {leftIcon}
          </div>
        )}
        <input
          ref={ref}
          id={inputId}
          type={isPassword && showPassword ? 'text' : type}
          disabled={disabled}
          aria-describedby={error ? `${inputId}-error` : helperText ? `${inputId}-helper` : undefined}
          aria-invalid={error ? true : undefined}
          className={cn(
            'w-full text-sm transition-all duration-150 focus-ring',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            'placeholder:text-text-placeholder',
            size === 'sm' ? 'min-h-[32px] px-3 text-xs rounded-lg' : 'min-h-[var(--touch-target-min)] px-4 rounded-xl',
            'bg-subtle-3 text-heading',
            'border border-border-input focus:border-accent',
            leftIcon ? (size === 'sm' ? 'pl-9' : 'pl-12') : (size === 'sm' ? 'px-3' : 'px-4'),
            isPassword ? (size === 'sm' ? 'pr-9' : 'pr-12') : (size === 'sm' ? 'px-3' : 'px-4'),
            error && 'border-status-error focus:border-status-error',
            className
          )}
          {...props}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            disabled={disabled}
            className="flex-center focus-ring absolute right-3 top-1/2 -translate-y-1/2 w-11 h-11 text-tertiary rounded-xl"
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        )}
      </div>
      {helperText && !error && (
        <p id={`${inputId}-helper`} className="text-xs text-tertiary">{helperText}</p>
      )}
      {error && (
        <p id={`${inputId}-error`} className="text-xs font-medium text-status-error" role="alert">{error}</p>
      )}
    </div>
  );
});

Input.displayName = 'Input';
