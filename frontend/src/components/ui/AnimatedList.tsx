import { useRef, useState, useEffect, useCallback, type ReactNode } from 'react';


interface AnimatedListProps {
    /** Array of ReactNode items to render */
    items: ReactNode[];
    /** Callback when an item is clicked or selected via keyboard */
    onItemSelect?: (item: ReactNode, index: number) => void;
    /** Show top/bottom gradient fade overlays when scrollable */
    showGradients?: boolean;
    /** Enable arrow key navigation between items */
    enableArrowNavigation?: boolean;
    /** Show the scrollbar (hidden by default) */
    displayScrollbar?: boolean;
    /** Custom class for the outer wrapper */
    className?: string;
    /** Stagger delay between each item animation in ms */
    staggerDelay?: number;
}

export function AnimatedList({
    items,
    onItemSelect,
    showGradients = true,
    enableArrowNavigation = true,
    displayScrollbar = false,
    className = '',
    staggerDelay = 50,
}: AnimatedListProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [activeIndex, setActiveIndex] = useState(-1);
    const [showTopGradient, setShowTopGradient] = useState(false);
    const [showBottomGradient, setShowBottomGradient] = useState(false);

    // Check scroll position for gradient visibility
    const updateGradients = useCallback(() => {
        const el = containerRef.current;
        if (!el) return;
        setShowTopGradient(el.scrollTop > 10);
        setShowBottomGradient(el.scrollTop + el.clientHeight < el.scrollHeight - 10);
    }, []);

    useEffect(() => {
        updateGradients();
        const el = containerRef.current;
        if (!el) return;
        el.addEventListener('scroll', updateGradients, { passive: true });
        // Observe resize to recalculate
        const observer = new ResizeObserver(updateGradients);
        observer.observe(el);
        return () => {
            el.removeEventListener('scroll', updateGradients);
            observer.disconnect();
        };
    }, [updateGradients, items.length]);

    const scrollToIndex = useCallback((index: number) => {
        const el = containerRef.current;
        if (!el) return;
        const child = el.children[index] as HTMLElement;
        if (child) {
            child.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
    }, []);

    // Keyboard navigation
    useEffect(() => {
        if (!enableArrowNavigation) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            // Only handle if the list or its children have focus
            if (!containerRef.current?.contains(document.activeElement) && document.activeElement !== containerRef.current) return;

            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setActiveIndex((prev) => {
                    const next = Math.min(prev + 1, items.length - 1);
                    scrollToIndex(next);
                    return next;
                });
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setActiveIndex((prev) => {
                    const next = Math.max(prev - 1, 0);
                    scrollToIndex(next);
                    return next;
                });
            } else if (e.key === 'Enter' && activeIndex >= 0) {
                e.preventDefault();
                onItemSelect?.(items[activeIndex], activeIndex);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [enableArrowNavigation, activeIndex, items, onItemSelect, scrollToIndex]);

    const handleItemClick = (index: number) => {
        setActiveIndex(index);
        onItemSelect?.(items[index], index);
    };

    return (
        <div className={`animated-list ${className}`}>
            {showGradients && (
                <div
                    className={`animated-list__gradient-top ${showTopGradient ? 'is-visible' : ''}`}
                />
            )}

            <div
                ref={containerRef}
                className={`animated-list__container ${!displayScrollbar ? 'animated-list__container--no-scrollbar' : ''}`}
                tabIndex={enableArrowNavigation ? 0 : undefined}
                role="list"
            >
                {items.map((item, index) => (
                    <div
                        key={index}
                        className={`animated-list__item ${activeIndex === index ? 'is-active' : ''} cursor-pointer`}
                        style={{ animationDelay: `${index * staggerDelay}ms` }}
                        onClick={() => handleItemClick(index)}
                        role="listitem"
                        tabIndex={-1}
                        onMouseDown={(e) => { const t = e.currentTarget; t.style.transform = 'scale(0.99)'; }}
                        onMouseUp={(e) => { const t = e.currentTarget; t.style.transform = ''; }}
                        onMouseLeave={(e) => { const t = e.currentTarget; t.style.transform = ''; }}
                    >
                        {item}
                    </div>
                ))}
            </div>

            {showGradients && (
                <div
                    className={`animated-list__gradient-bottom ${showBottomGradient ? 'is-visible' : ''}`}
                />
            )}
        </div>
    );
}

export default AnimatedList;
