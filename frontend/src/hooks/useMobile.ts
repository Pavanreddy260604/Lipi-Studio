import { useState, useEffect } from 'react';

/**
 * Hook to detect mobile/tablet breakpoints, touch capabilities, and orientation.
 * Uses window.matchMedia initializers to prevent layout flash on first render.
 */
export function useMobile() {
    const [isMobile, setIsMobile] = useState(() =>
        typeof window !== 'undefined' ? window.matchMedia('(max-width: 767px)').matches : false
    );
    const [isTablet, setIsTablet] = useState(() =>
        typeof window !== 'undefined' ? window.matchMedia('(max-width: 1024px)').matches : false
    );
    const [isTouchDevice, setIsTouchDevice] = useState(() =>
        typeof window !== 'undefined' ? ('ontouchstart' in window || navigator.maxTouchPoints > 0) : false
    );
    const [isLandscape, setIsLandscape] = useState(() =>
        typeof window !== 'undefined' ? window.matchMedia('(orientation: landscape)').matches : false
    );
    const [screenWidth, setScreenWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1024);

    useEffect(() => {
        const mobileMql = window.matchMedia('(max-width: 767px)');
        const tabletMql = window.matchMedia('(max-width: 1024px)');
        const landscapeMql = window.matchMedia('(orientation: landscape)');

        const updateMatch = () => {
            setIsMobile(mobileMql.matches);
            setIsTablet(tabletMql.matches);
            setIsTouchDevice('ontouchstart' in window || navigator.maxTouchPoints > 0);
            setIsLandscape(landscapeMql.matches);
            setScreenWidth(window.innerWidth);
        };

        mobileMql.addEventListener('change', updateMatch);
        tabletMql.addEventListener('change', updateMatch);
        landscapeMql.addEventListener('change', updateMatch);
        window.addEventListener('resize', updateMatch);

        return () => {
            mobileMql.removeEventListener('change', updateMatch);
            tabletMql.removeEventListener('change', updateMatch);
            landscapeMql.removeEventListener('change', updateMatch);
            window.removeEventListener('resize', updateMatch);
        };
    }, []);

    return { isMobile, isTablet, isTouchDevice, isLandscape, screenWidth };
}
