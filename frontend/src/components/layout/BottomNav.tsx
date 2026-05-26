import { motion } from 'framer-motion';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
    LayoutDashboard,
    Settings,
    MessageSquare,
    Film,
    Moon,
    Sun,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useThemeStore } from '../../stores/themeStore';
import { useScriptWriter } from '../../contexts/ScriptWriterContext';
import { useChatStore } from '../../stores/chatStore';

interface BottomNavProps {
    className?: string;
}

interface NavItem {
    icon: React.ComponentType<{ size?: number; className?: string; strokeWidth?: number }>;
    label: string;
    href: string;
}

const primaryItems: NavItem[] = [
    { icon: LayoutDashboard, label: 'Home', href: '/' },
    { icon: MessageSquare, label: 'Assistant', href: '/chat' },
    { icon: Settings, label: 'Settings', href: '/settings' },
];

export function BottomNav({ className }: BottomNavProps) {
    const location = useLocation();
    const navigate = useNavigate();
    const { isGenerating, isCritiquing, isAiThinking, hasUnsavedChanges } = useScriptWriter();
    const { effectiveTheme, toggleTheme } = useThemeStore();
    const isChatOpen = useChatStore((s) => s.isOpen);

    const handleNav = (href: string) => {
        if (href === '/chat') {
            useChatStore.getState().toggleOpen();
            return;
        }
        if (isGenerating || isCritiquing || isAiThinking || hasUnsavedChanges) {
            const confirmed = window.confirm('You have an active process or unsaved changes. Leaving now may result in data loss. Continue?');
            if (!confirmed) return;
        }
        navigate(href);
    };

    const isActive = (href: string) => {
        if (href === '/chat') return isChatOpen;
        return href === '/'
            ? location.pathname === '/' || location.pathname === '/script-writer'
            : location.pathname.startsWith(href);
    };

    return (
        <motion.nav
            className={cn('fixed bottom-0 left-0 right-0 px-2 md:hidden', className)}
            style={{
                zIndex: 'var(--z-header)',
                backgroundColor: 'var(--surface-elevated)',
                borderTop: '1px solid var(--border-subtle)',
                boxShadow: 'var(--shadow-lg)',
                paddingBottom: 'calc(var(--safe-area-bottom) + var(--space-2))',
            }}
            initial={{ y: 100 }}
            animate={{ y: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        >
            <div className="flex items-center justify-around pt-1">
                {primaryItems.map((item) => {
                    const active = isActive(item.href);

                    return (
                        <button
                            key={item.label}
                            onClick={() => handleNav(item.href)}
                            className={cn(
                                'flex flex-col items-center justify-center rounded-xl',
                                'transition-colors duration-150 active:scale-[0.92]',
                                'relative focus-ring',
                            )}
                            style={{
                                minWidth: 'var(--touch-target-min)',
                                minHeight: 'var(--touch-target-min)',
                                color: active ? 'var(--accent)' : 'var(--text-tertiary)',
                            }}
                        >
                            <div className="relative flex flex-col items-center">
                                {active && (
                                    <motion.div
                                        className="rounded-full mb-0.5"
                                        style={{ width: '4px', height: '4px', backgroundColor: 'var(--accent)' }}
                                        layoutId="activeTabIndicator"
                                        initial={{ opacity: 0, scale: 0 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                                    />
                                )}
                                <item.icon
                                    size={20}
                                    className="relative z-10"
                                    strokeWidth={active ? 2.5 : 2}
                                />
                                <span className={cn(
                                    'relative z-10 transition-all',
                                    active ? 'opacity-100' : 'opacity-70'
                                )}
                                    style={{ fontSize: 'var(--text-xs)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 'var(--tracking-tight)', marginTop: '2px' }}
                                >
                                    {item.label}
                                </span>
                            </div>
                        </button>
                    );
                })}

                {/* Theme Toggle */}
                <button
                    onClick={toggleTheme}
                    className={cn(
                        'flex flex-col items-center justify-center rounded-xl',
                        'transition-colors duration-150 active:scale-[0.92]',
                        'relative focus-ring',
                    )}
                    style={{
                        minWidth: 'var(--touch-target-min)',
                        minHeight: 'var(--touch-target-min)',
                        color: 'var(--text-tertiary)',
                    }}
                    aria-label={`Switch to ${effectiveTheme === 'dark' ? 'light' : 'dark'} mode`}
                >
                    <div className="relative flex flex-col items-center">
                        {effectiveTheme === 'dark' ? (
                            <Moon size={20} className="relative z-10" />
                        ) : (
                            <Sun size={20} className="relative z-10" />
                        )}
                        <span className="relative z-10 opacity-70 transition-all"
                            style={{ fontSize: 'var(--text-xs)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 'var(--tracking-tight)', marginTop: '2px' }}
                        >
                            {effectiveTheme === 'dark' ? 'Dark' : 'Light'}
                        </span>
                    </div>
                </button>
            </div>
        </motion.nav>
    );
}
