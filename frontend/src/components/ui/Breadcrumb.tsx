import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';
import { cn } from '../../lib/utils';

interface BreadcrumbItem {
    label: string;
    path?: string;
    active?: boolean;
}

interface BreadcrumbProps {
    items: BreadcrumbItem[];
    className?: string;
}

export function Breadcrumb({ items, className }: BreadcrumbProps) {
    return (
        <nav className={cn("flex items-center space-x-2 text-xs font-medium", className)}>
            <Link
                to="/dashboard"
                className="text-text-disabled hover:text-accent-primary transition-colors flex items-center gap-1 active:scale-95"
            >
                <Home size={14} />
            </Link>

            {items.map((item, index) => (
                <React.Fragment key={index}>
                    <ChevronRight size={12} className="text-text-disabled shrink-0" />
                    {item.path ? (
                        <Link
                            to={item.path}
                            className={cn(
                                "hover:text-accent-primary transition-colors truncate max-w-[150px] active:scale-95",
                                item.active ? "text-text-primary" : "text-text-disabled"
                            )}
                        >
                            {item.label}
                        </Link>
                    ) : (
                        <span className={cn(
                            "truncate max-w-[200px]",
                            item.active ? "text-text-primary font-bold" : "text-text-disabled"
                        )}>
                            {item.label}
                        </span>
                    )}
                </React.Fragment>
            ))}
        </nav>
    );
}
