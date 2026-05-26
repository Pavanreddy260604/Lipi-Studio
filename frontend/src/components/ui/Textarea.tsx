import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { cn } from '../../lib/utils';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
    label?: string;
    error?: string;
    autoResize?: boolean;
    size?: 'sm' | 'md' | 'lg';
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(({
    label,
    error,
    className,
    rows = 3,
    autoResize = false,
    value,
    onChange,
    id,
    size = 'md',
    ...props
}, ref) => {
    const internalRef = useRef<HTMLTextAreaElement>(null);
    useImperativeHandle(ref, () => internalRef.current as HTMLTextAreaElement);
    
    const textareaId = id || (label ? `textarea-${label.toLowerCase().replace(/\s+/g, '-')}` : undefined);

    useEffect(() => {
        if (!autoResize || !internalRef.current) return;

        const adjustHeight = () => {
            const el = internalRef.current;
            if (el) {
                el.style.height = 'auto';
                el.style.height = `${el.scrollHeight}px`;
            }
        };

        adjustHeight();
    }, [value, autoResize]);

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        if (onChange) onChange(e);
        if (autoResize) {
            e.target.style.height = 'auto';
            e.target.style.height = `${e.target.scrollHeight}px`;
        }
    };

    return (
        <div className={cn("w-full flex flex-col gap-1")}>
            {label && (
                <label
                    htmlFor={textareaId}
                    className="block text-xs font-semibold tracking-wide text-secondary"
                >
                    {label}
                </label>
            )}
            <textarea
                id={textareaId}
                ref={internalRef}
                rows={rows}
                value={value}
                onChange={handleChange}
                className={cn(
                    'w-full text-sm transition-all duration-120 ease-smooth focus-ring',
                    'placeholder:text-placeholder',
                    'resize-none',
                    size === 'sm' ? 'px-3 py-2 rounded-lg text-xs' : 'px-4 py-3 rounded-xl',
                    'bg-subtle-3 text-heading',
                    'border border-border-input focus:border-accent',
                    error && 'border-status-error focus:border-status-error',
                    className
                )}
                {...props}
            />
            {error && (
                <p className="text-xs font-medium text-status-error" role="alert">{error}</p>
            )}
        </div>
    );
});

Textarea.displayName = 'Textarea';
