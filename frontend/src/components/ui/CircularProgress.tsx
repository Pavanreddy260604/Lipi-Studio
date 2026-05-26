import { motion } from 'framer-motion';
import { cn } from '../../lib/utils';

interface CircularProgressProps {
    value: number;
    size?: number;
    strokeWidth?: number;
    color?: 'blue' | 'purple' | 'cyan' | 'green' | 'amber';
    label?: string;
    sublabel?: string;
    showValue?: boolean;
    className?: string;
}

const colorTokens: Record<string, { token: string; glow: string }> = {
    blue: { token: 'var(--status-info)', glow: 'color-mix(in oklch, var(--status-info) 20%, transparent)' },
    purple: { token: 'var(--accent)', glow: 'color-mix(in oklch, var(--accent) 20%, transparent)' },
    cyan: { token: 'var(--status-info)', glow: 'color-mix(in oklch, var(--status-info) 20%, transparent)' },
    green: { token: 'var(--status-success)', glow: 'color-mix(in oklch, var(--status-success) 20%, transparent)' },
    amber: { token: 'var(--status-warning)', glow: 'color-mix(in oklch, var(--status-warning) 20%, transparent)' },
};

export function CircularProgress({
    value,
    size = 120,
    strokeWidth = 8,
    color = 'blue',
    label,
    sublabel,
    showValue = true,
    className,
}: CircularProgressProps) {
    const radius = (size - strokeWidth) / 2;
    const circumference = radius * 2 * Math.PI;
    const offset = circumference - (value / 100) * circumference;
    const config = colorTokens[color];

    return (
        <div className={cn('relative inline-flex flex-col items-center', className)}>
            <div className="relative" style={{ width: size, height: size }}>
                <svg
                    width={size}
                    height={size}
                    className="transform -rotate-90 overflow-visible"
                >
                    <defs>
                        <linearGradient id={`gradient-${color}`} x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor={config.token} stopOpacity={0.8} />
                            <stop offset="100%" stopColor={config.token} stopOpacity={1} />
                        </linearGradient>
                    </defs>
                    <circle
                        cx={size / 2}
                        cy={size / 2}
                        r={radius}
                        fill="none"
                        stroke="color-mix(in oklch, var(--text-body) 5%, transparent)"
                        strokeWidth={strokeWidth}
                    />
                    <motion.circle
                        cx={size / 2}
                        cy={size / 2}
                        r={radius}
                        fill="none"
                        stroke={`url(#gradient-${color})`}
                        strokeWidth={strokeWidth}
                        strokeLinecap="round"
                        strokeDasharray={circumference}
                        initial={{ strokeDashoffset: circumference }}
                        animate={{ strokeDashoffset: offset }}
                        transition={{ duration: 1.2, ease: [0.34, 1.56, 0.64, 1] }}
                    />
                </svg>

                <div className="absolute inset-0 flex flex-col items-center justify-center">
                    {showValue && (
                        <motion.span
                            className="text-lg sm:text-2xl font-bold text-text-heading tabular-nums"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: 0.3, duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
                        >
                            {Math.round(value)}%
                        </motion.span>
                    )}
                    {sublabel && (
                        <span className="text-[10px] sm:text-xs text-text-secondary mt-0.5 tabular-nums">{sublabel}</span>
                    )}
                </div>
            </div>

            {label && (
                <span className="mt-3 text-sm font-medium text-text-secondary">{label}</span>
            )}
        </div>
    );
}
