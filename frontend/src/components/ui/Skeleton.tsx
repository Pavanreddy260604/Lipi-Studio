import { cn } from "../../lib/utils"

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
    variant?: 'text' | 'circular' | 'rectangular';
}

function Skeleton({
    className,
    variant = 'text',
    ...props
}: SkeletonProps) {
    const variantStyles = {
        text: 'rounded-md h-4 w-full',
        circular: 'rounded-full h-10 w-10',
        rectangular: 'rounded-lg h-32 w-full',
    };

    return (
        <div
            role="status"
            aria-busy="true"
            aria-label="Loading"
            className={cn(
                'bg-subtle-5 skeleton-shimmer',
                variantStyles[variant],
                className
            )}
            {...props}
        />
    )
}

export { Skeleton }
