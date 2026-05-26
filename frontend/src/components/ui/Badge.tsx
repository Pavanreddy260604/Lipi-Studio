import { cn } from '../../lib/utils';

type BadgeVariant = 'default' | 'success' | 'warning' | 'error' | 'info' | 'purple' | 'outline' | 'secondary';

interface BadgeProps {
    children: React.ReactNode;
    variant?: BadgeVariant;
    size?: 'sm' | 'md';
    className?: string;
}

const variantStyles: Record<BadgeVariant, string> = {
    default: 'bg-subtle-5 text-secondary border-none',
    secondary: 'bg-subtle-8 text-secondary border-none',
    outline: 'bg-transparent text-secondary border-subtle-20',
    success: 'text-status-success bg-status-success-soft border-subtle-8',
    warning: 'text-status-warning bg-status-warning-soft border-subtle-8',
    error: 'text-status-error bg-status-error-soft border-subtle-8',
    info: 'text-status-info bg-status-info-soft border-subtle-8',
    purple: 'text-accent bg-accent-soft border-accent/20',
};

export function Badge({ children, variant = 'default', size = 'sm', className }: BadgeProps) {
    return (
        <span
            className={cn(
                'inline-flex items-center gap-1 font-medium rounded-full border',
                variantStyles[variant],
                size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm',
                className
            )}
        >
            {children}
        </span>
    );
}

export function DifficultyBadge({ difficulty }: { difficulty: 'easy' | 'medium' | 'hard' }) {
    const variants: Record<string, BadgeVariant> = {
        easy: 'success',
        medium: 'warning',
        hard: 'error',
    };

    return (
        <Badge variant={variants[difficulty]}>
            {difficulty.charAt(0).toUpperCase() + difficulty.slice(1)}
        </Badge>
    );
}

export function StatusBadge({ status }: { status: 'solved' | 'revisit' | 'attempted' | 'completed' | 'in_progress' | 'planned' }) {
    const variants: Record<string, BadgeVariant> = {
        solved: 'success',
        completed: 'success',
        revisit: 'warning',
        in_progress: 'info',
        attempted: 'info',
        planned: 'default',
    };

    const labels: Record<string, string> = {
        solved: 'Solved',
        completed: 'Completed',
        revisit: 'Revisit',
        in_progress: 'In Progress',
        attempted: 'Attempted',
        planned: 'Planned',
    };

    return (
        <Badge variant={variants[status] || 'default'}>
            {labels[status] || status}
        </Badge>
    );
}
