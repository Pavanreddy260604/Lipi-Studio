import { useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useScriptWriter } from '../../contexts/ScriptWriterContext';
import { useThemeStore } from '../../stores/themeStore';
import {
    LayoutDashboard,
    Code2,
    Server,
    Briefcase,
    BarChart2,
    Settings,
    Map,
    Bot,
    MessageSquare,
    Film,
    ChevronDown,
    ChevronLeft,
    GraduationCap,
    Wrench,
    X,
    BrainCircuit,
    Keyboard,
    Moon,
    Sun,
} from 'lucide-react';
import { cn } from '../../lib/utils';

interface SidebarProps {
    isDrawerOpen: boolean;
    inOverlay?: boolean;
    pathname: string;
    isMobile: boolean;
    expandedSections: Record<string, boolean>;
    onToggleSection: (section: string) => void;
    onCloseDrawer: () => void;
    onToggleDrawer?: () => void;
    user?: { name?: string; email?: string } | null;
    isAIOpen: boolean;
    onToggleAI: () => void;
    onToggleShortcuts: () => void;
}

interface NavItem {
    icon: React.ComponentType<{ size?: number; className?: string; strokeWidth?: number }>;
    label: string;
    href: string;
    external?: boolean;
}

const scriptNavItems: NavItem[] = [
    { icon: LayoutDashboard, label: 'Dashboard', href: '/' },
    { icon: MessageSquare, label: 'AI Assistant', href: '/chat' },
];

const isPathActive = (pathname: string, href: string) => {
    if (href === '/') return pathname === '/' || pathname === '/script-writer';
    return pathname === href || pathname.startsWith(`${href}/`);
};

const staggerItem = {
    hidden: { opacity: 0, x: -8 },
    visible: (i: number) => ({
        opacity: 1,
        x: 0,
        transition: { delay: i * 0.04, duration: 0.2, ease: [0.23, 1, 0.32, 1] as const },
    }),
};

export function Sidebar({
    isDrawerOpen,
    inOverlay,
    pathname,
    isMobile,
    expandedSections,
    onToggleSection,
    onCloseDrawer,
    onToggleDrawer,
    user,
    isAIOpen,
    onToggleAI,
    onToggleShortcuts,
}: SidebarProps) {
    const { isGenerating, isCritiquing, isAiThinking, hasUnsavedChanges } = useScriptWriter();
    const navigate = useNavigate();
    const expanded = isDrawerOpen;

    const handleNav = (href: string) => {
        if (href === '/chat') {
            onToggleAI();
            return;
        }
        if (isGenerating || isCritiquing || isAiThinking || hasUnsavedChanges) {
            const confirmed = window.confirm('You have an active process or unsaved changes. Leaving now may result in data loss. Continue?');
            if (!confirmed) return;
        }
        if (isMobile) onCloseDrawer();
        navigate(href);
    };

    const renderNavItems = useCallback(
        (items: NavItem[], startIndex: number) =>
            items.map((item, idx) => {
                const isActive = item.href === '/chat' ? isAIOpen : isPathActive(pathname, item.href);
                const linkClass = cn(
                    'flex items-center gap-3 rounded-xl transition-all duration-150',
                    'hover:bg-subtle-8 text-text-secondary hover:text-text-heading',
                    'focus-ring',
                    expanded ? 'px-3' : 'p-0 justify-center',
                    isActive && 'bg-subtle-10 text-accent'
                );

                const sharedProps = {
                    className: linkClass,
                    style: {
                        minHeight: expanded ? 'var(--touch-target-min)' : '44px',
                        width: expanded ? '100%' : '44px',
                    } as React.CSSProperties,
                    'aria-label': expanded ? item.label : `${item.label}`,
                    'aria-current': (isActive ? 'page' : undefined) as React.AriaAttributes['aria-current'],
                };

                const content = (
                    <>
                        <div className="flex items-center justify-center shrink-0" style={{ width: '20px' }}>
                            <item.icon size={18} strokeWidth={isActive ? 2.5 : 2} />
                        </div>
                        {expanded && (
                            <span className="truncate" style={{ fontSize: 'var(--text-sm)', fontWeight: isActive ? 600 : 400 }}>
                                {item.label}
                            </span>
                        )}
                    </>
                );

                return (
                    <motion.div
                        key={item.href}
                        custom={startIndex + idx}
                        variants={staggerItem}
                        initial="hidden"
                        animate="visible"
                        title={!expanded ? item.label : undefined}
                    >
                        {item.external ? (
                            <a href={item.href} target="_blank" rel="noopener noreferrer" {...sharedProps} onClick={() => isMobile && onCloseDrawer()}>
                                {content}
                            </a>
                        ) : (
                            <button {...sharedProps} onClick={() => handleNav(item.href)}>
                                {content}
                            </button>
                        )}
                    </motion.div>
                );
            }),
        [expanded, isMobile, onCloseDrawer, pathname, isGenerating, isCritiquing, isAiThinking, hasUnsavedChanges, isAIOpen, onToggleAI]
    );

    const { effectiveTheme, toggleTheme } = useThemeStore();

    return (
        <div className="flex flex-col h-full" style={{ padding: 'var(--space-2)' }}>
            {/* Profile Card */}
            <div
                className={cn(
                    'flex items-center rounded-xl shrink-0',
                    expanded ? 'gap-3 px-3' : 'justify-center'
                )}
                style={{
                    minHeight: 'var(--touch-target-min)',
                    width: expanded ? '100%' : '44px',
                    marginBottom: 'var(--space-2)',
                }}
                title={!expanded ? (user?.name || 'Profile') : undefined}
            >
                <div
                    className="shrink-0 flex items-center justify-center rounded-lg font-black text-xs"
                    style={{
                        width: '28px',
                        height: '28px',
                        backgroundColor: 'var(--accent)',
                        color: 'var(--text-on-accent, #fff)',
                    }}
                >
                    {user?.name?.charAt(0).toUpperCase() || 'U'}
                </div>
                {expanded && (
                    <div className="flex flex-col items-start overflow-hidden min-w-0">
                        <span className="truncate w-full text-left" style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-heading)' }}>
                            {user?.name || 'User'}
                        </span>
                        <span className="truncate w-full text-left" style={{ fontSize: '10px', color: 'var(--text-tertiary)', letterSpacing: '0.02em' }}>
                            {user?.email || ''}
                        </span>
                    </div>
                )}
            </div>

            <div className="w-full" style={{ height: '1px', backgroundColor: 'var(--border-subtle)', marginBottom: 'var(--space-2)' }} />

            <div className="flex-1 overflow-y-auto scrollbar-hide" style={{ display: 'flex', flexDirection: 'column', gap: 'calc(var(--space-1) / 2)' }}>
                <button
                    onClick={() => onToggleSection('tools')}
                    className={cn(
                        'w-full flex items-center rounded-xl text-text-secondary hover:text-text-heading transition-all duration-150',
                        'hover:bg-subtle-8 focus-ring',
                        expanded ? 'justify-between px-3' : 'justify-center'
                    )}
                    style={{
                        minHeight: 'var(--touch-target-min)',
                        paddingBlock: expanded ? 'var(--space-2)' : '0',
                    }}
                    title={expanded ? 'Creative Workspace' : 'Workspace'}
                    aria-expanded={expandedSections.tools}
                >
                    <div className="flex items-center gap-3">
                        <Film size={18} className="shrink-0 transition-colors" style={{ color: expandedSections.tools ? 'var(--accent)' : undefined }} />
                        {expanded && (
                            <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 'var(--tracking-wider)' }}>
                                Workspace
                            </span>
                        )}
                    </div>
                    {expanded && (
                        <ChevronDown
                            size={14}
                            className={cn('transition-transform duration-200', expandedSections.tools ? 'rotate-180' : '')}
                        />
                    )}
                </button>

                {expandedSections.tools && (
                    <div className={cn('flex flex-col', expanded ? 'pl-2' : 'items-center')}>
                        {renderNavItems(scriptNavItems, 0)}
                    </div>
                )}

                {expanded && (
                    <div className="px-3 py-2" style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: 'var(--tracking-wider)' }}>
                        System
                    </div>
                )}

                {/* Theme Toggle */}
                <motion.div custom={scriptNavItems.length} variants={staggerItem} initial="hidden" animate="visible">
                    <button
                        onClick={toggleTheme}
                        className={cn(
                            'flex items-center gap-3 rounded-xl transition-all duration-150',
                            'hover:bg-subtle-8 text-text-secondary hover:text-text-heading',
                            'focus-ring',
                            expanded ? 'px-3' : 'p-0 justify-center'
                        )}
                        style={{
                            minHeight: expanded ? 'var(--touch-target-min)' : '44px',
                            width: expanded ? '100%' : '44px',
                        }}
                        title={!expanded ? `Switch to ${effectiveTheme === 'dark' ? 'light' : 'dark'} mode` : undefined}
                        aria-label={`Switch to ${effectiveTheme === 'dark' ? 'light' : 'dark'} mode`}
                    >
                        <div className="flex items-center justify-center shrink-0" style={{ width: '20px' }}>
                            {effectiveTheme === 'dark' ? <Moon size={18} /> : <Sun size={18} />}
                        </div>
                        {expanded && (
                            <span style={{ fontSize: 'var(--text-sm)' }}>
                                {effectiveTheme === 'dark' ? 'Dark Mode' : 'Light Mode'}
                            </span>
                        )}
                    </button>
                </motion.div>

                {/* Settings */}
                <motion.div custom={scriptNavItems.length + 1} variants={staggerItem} initial="hidden" animate="visible">
                    <button
                        onClick={() => handleNav('/settings')}
                        className={cn(
                            'flex items-center gap-3 rounded-xl transition-all duration-150',
                            'hover:bg-subtle-8 text-text-secondary hover:text-text-heading',
                            'focus-ring',
                            expanded ? 'px-3' : 'p-0 justify-center',
                            isPathActive(pathname, '/settings') && 'bg-subtle-10 text-accent'
                        )}
                        style={{
                            minHeight: expanded ? 'var(--touch-target-min)' : '44px',
                            width: expanded ? '100%' : '44px',
                        }}
                        title={!expanded ? 'Settings' : undefined}
                        aria-current={isPathActive(pathname, '/settings') ? 'page' : undefined}
                    >
                        <Settings size={18} className="shrink-0" />
                        {expanded && <span style={{ fontSize: 'var(--text-sm)' }}>Settings</span>}
                    </button>
                </motion.div>
            </div>

            {!isMobile && onToggleDrawer && (
                <button
                    onClick={onToggleDrawer}
                    className="flex-center focus-ring mt-2 w-full rounded-xl transition-all duration-150 hover:bg-subtle-8"
                    style={{
                        minHeight: 'var(--touch-target-min)',
                        color: 'var(--text-tertiary)',
                    }}
                    title={isDrawerOpen ? 'Collapse sidebar' : 'Expand sidebar'}
                    aria-label={isDrawerOpen ? 'Collapse sidebar' : 'Expand sidebar'}
                >
                    <ChevronLeft
                        size={16}
                        className={cn('transition-transform duration-200', !isDrawerOpen && 'rotate-180')}
                    />
                    {expanded && <span className="ml-2" style={{ fontSize: 'var(--text-xs)' }}>Collapse</span>}
                </button>
            )}
        </div>
    );
}

interface SidebarShellProps {
    isDrawerOpen: boolean;
    isMobile: boolean;
    pathname: string;
    expandedSections: Record<string, boolean>;
    onToggleSection: (section: string) => void;
    onCloseDrawer: () => void;
    onToggleDrawer?: () => void;
    user?: { name?: string; email?: string } | null;
    isAIOpen: boolean;
    onToggleAI: () => void;
    onToggleShortcuts: () => void;
}

export function SidebarShell({
    isDrawerOpen,
    isMobile,
    pathname,
    expandedSections,
    onToggleSection,
    onCloseDrawer,
    onToggleDrawer,
    user,
    isAIOpen,
    onToggleAI,
    onToggleShortcuts,
}: SidebarShellProps) {
    if (isMobile) {
        return (
            <AnimatePresence>
                {isDrawerOpen && (
                    <div className="fixed inset-0" style={{ zIndex: 'var(--z-overlay)' }}>
                        <motion.div
                            className="absolute inset-0"
                            style={{ backgroundColor: 'var(--surface-overlay)' }}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            onClick={onCloseDrawer}
                            aria-hidden="true"
                        />
                        <motion.aside
                            className="flex flex-col overflow-y-auto"
                            style={{
                                position: 'fixed',
                                top: 'max(var(--space-3), var(--safe-area-top))',
                                left: 'max(var(--space-3), var(--safe-area-left))',
                                bottom: 'max(var(--space-3), var(--safe-area-bottom))',
                                width: 'min(320px, calc(100vw - max(var(--space-3), var(--safe-area-left)) - max(var(--space-3), var(--safe-area-right))))',
                                backgroundColor: 'var(--surface-sidebar)',
                                borderRadius: 'var(--radius-xl)',
                                border: '1px solid var(--border-subtle)',
                                boxShadow: 'var(--shadow-xl)',
                            }}
                            initial={{ x: '-100%', opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            exit={{ x: '-100%', opacity: 0 }}
                            transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                            aria-label="Primary navigation"
                        >
                            <div className="flex justify-end p-2 shrink-0">
                                <button
                                    onClick={onCloseDrawer}
                                    className="flex-center focus-ring"
                                    style={{
                                        width: 'var(--touch-target-min)',
                                        height: 'var(--touch-target-min)',
                                        borderRadius: 'var(--radius-md)',
                                        color: 'var(--text-secondary)',
                                    }}
                                    aria-label="Close navigation"
                                >
                                    <X size={18} />
                                </button>
                            </div>
                            <div className="flex-1 overflow-y-auto">
                                <Sidebar
                                    isDrawerOpen={true}
                                    inOverlay={true}
                                    pathname={pathname}
                                    isMobile={true}
                                    expandedSections={expandedSections}
                                    onToggleSection={onToggleSection}
                                    onCloseDrawer={onCloseDrawer}
                                    user={user}
                                    isAIOpen={isAIOpen}
                                    onToggleAI={onToggleAI}
                                    onToggleShortcuts={onToggleShortcuts}
                                />
                            </div>
                        </motion.aside>
                    </div>
                )}
            </AnimatePresence>
        );
    }

    return (
        <aside
            className="fixed flex flex-col overflow-hidden transition-all duration-300 border border-subtle"
            style={{
                top: 'calc(var(--safe-area-top, 0px) + var(--space-3))',
                left: 'max(var(--space-3), var(--safe-area-left))',
                bottom: 'max(var(--space-3), var(--safe-area-bottom))',
                width: isDrawerOpen ? 'var(--sidebar-width)' : 'var(--sidebar-collapsed)',
                borderRadius: 'var(--radius-xl)',
                backgroundColor: 'var(--surface-sidebar)',
                zIndex: 'var(--z-sidebar)',
                boxShadow: 'var(--shadow-md)',
            }}
            aria-label="Primary navigation"
        >
            <div className="flex-1 overflow-y-auto scrollbar-hide">
                <Sidebar
                    isDrawerOpen={isDrawerOpen}
                    pathname={pathname}
                    isMobile={false}
                    expandedSections={expandedSections}
                    onToggleSection={onToggleSection}
                    onCloseDrawer={onCloseDrawer}
                    onToggleDrawer={onToggleDrawer}
                    user={user}
                    isAIOpen={isAIOpen}
                    onToggleAI={onToggleAI}
                    onToggleShortcuts={onToggleShortcuts}
                />
            </div>
        </aside>
    );
}
