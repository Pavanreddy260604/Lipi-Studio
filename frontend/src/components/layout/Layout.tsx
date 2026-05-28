import { useState, useRef, useEffect, lazy, Suspense } from 'react';
import { useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useChatStore } from '../../stores/chatStore';
const ShortcutsModal = lazy(() => import('../ui/ShortcutsModal').then(m => ({ default: m.ShortcutsModal })));
import { useMobile } from '../../hooks/useMobile';
import { cn } from '../../lib/utils';
import { BottomNav } from './BottomNav';
import { Breadcrumb } from '../ui/Breadcrumb';

interface LayoutProps {
    children: React.ReactNode;
    banner?: React.ReactNode;
}

const routeLabels: Record<string, string> = {
    settings: 'Settings',
    chat: 'AI Assistant',
    'script-writer': 'Studio Editor',
    'master-script': 'Master Script',
};

const isIdSegment = (segment: string) => /^[a-f0-9-]{8,}$/i.test(segment) || /^\d+$/.test(segment);

const titleCase = (value: string) =>
    value
         .split('-')
         .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
         .join(' ');

const getSegmentLabel = (segment: string) => {
    if (isIdSegment(segment)) return 'Details';
    return routeLabels[segment] ?? titleCase(segment);
};

const buildBreadcrumbItems = (pathname: string) => {
    const segments = pathname.split('/').filter(Boolean);
    if (segments.length === 0) return [{ label: 'Dashboard', active: true }];

    const items: Array<{ label: string; path?: string; active?: boolean }> = [];
    segments.forEach((segment, index) => {
        const path = `/${segments.slice(0, index + 1).join('/')}`;
        const active = index === segments.length - 1;
        items.push({
            label: getSegmentLabel(segment),
            path: active ? undefined : path,
            active,
        });
    });
    return items;
};

export function Layout({ children, banner }: LayoutProps) {
    const { isMobile } = useMobile();
    const [showShortcuts, setShowShortcuts] = useState(false);

    const toggleOpen = useChatStore((s) => s.toggleOpen);
    const isOpen = useChatStore((s) => s.isOpen);

    const location = useLocation();
    const mainRef = useRef<HTMLElement>(null);

    useEffect(() => {
        if (mainRef.current) {
            mainRef.current.scrollTo({ top: 0, left: 0, behavior: 'auto' });
        }
    }, [location.pathname]);

    return (
        <div
            className="min-h-screen flex flex-col bg-[var(--surface-page)]"
            style={{ minHeight: '100dvh' }}
        >
            {/* Main Content Area */}

            <motion.main
                id="main-content"
                ref={mainRef}
                className="flex-1 transition-all duration-300"
                style={{
                    paddingTop: isMobile && location.pathname === '/chat'
                        ? 'var(--space-2)'
                        : 'calc(var(--safe-area-top, 0px) + var(--space-4))',
                    paddingLeft: isMobile ? 'var(--page-padding-inline-mobile)' : 'var(--page-padding-inline)',
                    paddingRight: isMobile ? 'var(--page-padding-inline-mobile)' : 'var(--page-padding-inline)',
                    paddingBottom: isMobile
                        ? 'calc(var(--space-24) + var(--safe-area-bottom, 0px))'
                        : 'var(--space-12)',
                    minHeight: '100dvh',
                }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
            >
                <div className="mx-auto" style={{ maxWidth: 'var(--content-max)' }}>
                    <Breadcrumb
                        items={buildBreadcrumbItems(location.pathname)}
                        className={cn(
                            'mb-6 overflow-x-auto whitespace-nowrap pb-1',
                            location.pathname === '/' && 'hidden sm:flex'
                        )}
                    />

                    <AnimatePresence mode="wait" initial={false}>
                        <motion.div
                            key={location.pathname}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -8 }}
                            transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
                        >
                            {children}
                        </motion.div>
                    </AnimatePresence>
                </div>
            </motion.main>

            {showShortcuts && (
                <Suspense fallback={null}>
                    <ShortcutsModal isOpen={showShortcuts} onClose={() => setShowShortcuts(false)} />
                </Suspense>
            )}
        </div>
    );
}
