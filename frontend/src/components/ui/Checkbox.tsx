import React from 'react';
import { Check } from 'lucide-react';
import { cn } from '../../lib/utils';

interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
    label?: string;
    onCheckedChange?: (checked: boolean) => void;
}

export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
    ({ className, label, checked, onCheckedChange, ...props }, ref) => {
        return (
            <label className="flex items-center gap-3 cursor-pointer group select-none touch-target transition-all duration-120 ease-smooth active:scale-[0.98]">
                <div className="relative">
                    <input
                        type="checkbox"
                        className="sr-only peer"
                        checked={checked}
                        onChange={(e) => onCheckedChange?.(e.target.checked)}
                        ref={ref}
                        {...props}
                    />
                    <div className={cn(
                        "w-5 h-5 rounded-md border-2 transition-all duration-120 ease-smooth flex items-center justify-center",
                        "border-subtle-20 bg-subtle-2",
                        "peer-checked:bg-accent peer-checked:border-accent",
                        "group-hover:border-accent/40",
                        "peer-focus-visible:ring-2 peer-focus-visible:ring-accent peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-surface-page",
                        className
                    )}>
                        <Check 
                            size={12} 
                            className={cn(
                                "text-on-accent transition-all duration-120 ease-smooth scale-0 opacity-0",
                                checked && "scale-100 opacity-100"
                            )} 
                            strokeWidth={4}
                        />
                    </div>
                </div>
                {label && (
                    <span className={cn(
                        "text-sm font-semibold transition-colors duration-120",
                        checked ? "text-heading" : "text-secondary group-hover:text-heading"
                    )}>
                        {label}
                    </span>
                )}
            </label>
        );
    }
);

Checkbox.displayName = 'Checkbox';
