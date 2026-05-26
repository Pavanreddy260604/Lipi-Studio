import { cn } from '../../lib/utils';
import { ChevronDown } from 'lucide-react';

interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
    value: string;
    onChange: (value: any) => void;
    options: { value: string; label: string }[];
    placeholder?: string;
    label?: string;
    error?: string;
    disabled?: boolean;
    id?: string;
    size?: 'sm' | 'md' | 'lg';
}

export function Select({
    value,
    onChange,
    options,
    placeholder = 'Select...',
    label,
    error,
    disabled,
    id,
    size = 'md',
    className,
    ...props
}: SelectProps) {
    const selectId = id || (label ? `select-${label.toLowerCase().replace(/\s+/g, '-')}` : undefined);

    return (
        <div className={cn("w-full flex flex-col gap-1")}>
            {label && (
                <label
                    htmlFor={selectId}
                    className="block text-xs font-semibold tracking-wide text-secondary"
                >
                    {label}
                </label>
            )}
            <div className="relative">
                <select
                    id={selectId}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    disabled={disabled}
                    className={cn(
                        'w-full appearance-none cursor-pointer focus-ring',
                        'disabled:opacity-50 disabled:cursor-not-allowed',
                        size === 'sm' ? 'min-h-[32px] px-3 pr-8 text-xs rounded-lg' : 'min-h-[var(--touch-target-min)] px-4 pr-10 rounded-xl',
                        'bg-subtle-2 border border-subtle-8',
                        error && 'border-status-error focus:border-status-error',
                        className
                    )}
                    {...props}
                >
                    <option value="" disabled className="bg-surface-elevated text-placeholder">
                        {placeholder}
                    </option>
                    {options.map((option) => (
                        <option
                            key={option.value}
                            value={option.value}
                            className="bg-surface-elevated text-heading"
                        >
                            {option.label}
                        </option>
                    ))}
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-tertiary">
                    <ChevronDown size={16} />
                </div>
            </div>
            {error && (
                <p className="text-xs font-medium text-status-error" role="alert">{error}</p>
            )}
        </div>
    );
}
