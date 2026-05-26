import { useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    PanelLeftClose,
    PanelLeftOpen,
    Search,
    Bell,
    Keyboard,
    Brain,
    Settings,
    X,
    Sparkles,
    LogOut,
} from 'lucide-react';
import { cn } from '../../lib/utils';

import { useScriptWriter } from '../../contexts/ScriptWriterContext';

interface HeaderProps {
    isMobile: boolean;
    isDrawerOpen: boolean;
    onToggleDrawer: () => void;
    isMobileSearchOpen: boolean;
    setIsMobileSearchOpen: (v: boolean) => void;
    showShortcuts: boolean;
    onToggleShortcuts: () => void;
    isNotificationsOpen: boolean;
    onToggleNotifications: () => void;
    isAIOpen: boolean;
    onToggleAI: () => void;
    user?: { name?: string; email?: string } | null;
    isProfileOpen: boolean;
    onToggleProfile: () => void;
    onCloseProfile: () => void;
    onCloseNotifications: () => void;
    handleLogout: () => void;
}

export function Header({
    isMobile,
    isDrawerOpen,
    onToggleDrawer,
    isMobileSearchOpen,
    setIsMobileSearchOpen,
    showShortcuts,
    onToggleShortcuts,
    isNotificationsOpen,
    onToggleNotifications,
    isAIOpen,
    onToggleAI,
    user,
    isProfileOpen,
    onToggleProfile,
    onCloseProfile,
    onCloseNotifications,
    handleLogout,
}: HeaderProps) {
    const { isGenerating, isCritiquing, isAiThinking, hasUnsavedChanges } = useScriptWriter();
    const searchInputRef = useRef<HTMLInputElement>(null);
    const profileDropdownRef = useRef<HTMLDivElement>(null);
    const notificationsRef = useRef<HTMLDivElement>(null);
    const navigate = useNavigate();

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
                e.preventDefault();
                searchInputRef.current?.focus();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (profileDropdownRef.current && !profileDropdownRef.current.contains(event.target as Node)) {
                onCloseProfile();
            }
            if (notificationsRef.current && !notificationsRef.current.contains(event.target as Node)) {
                onCloseNotifications();
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [onCloseProfile, onCloseNotifications]);

    const sidebarInsetLeft = isDrawerOpen
        ? 'calc(var(--sidebar-width) + var(--space-6))'
        : 'calc(var(--sidebar-collapsed) + var(--space-6))';

    const handleNav = (href: string) => {
        if (isGenerating || isCritiquing || isAiThinking || hasUnsavedChanges) {
            const confirmed = window.confirm('You have an active process or unsaved changes. Leaving now may result in data loss. Continue?');
            if (!confirmed) return;
        }
        onCloseProfile();
        navigate(href);
    };

    return (
        <header
            className="fixed flex items-center justify-between transition-all duration-300"
            style={{
                top: 'max(var(--space-3), var(--safe-area-top))',
                left: isMobile ? 'max(var(--space-3), var(--safe-area-left))' : sidebarInsetLeft,
                right: 'max(var(--space-3), var(--safe-area-right))',
                height: 'var(--header-height)',
                paddingInline: 'var(--space-4)',
                backgroundColor: 'var(--surface-elevated)',
                borderRadius: 'var(--radius-xl)',
                border: '1px solid var(--border-subtle)',
                zIndex: 'var(--z-header)',
                display: isMobile && window.location.pathname === '/chat' ? 'none' : 'flex'
            }}
        >
            <div className="flex items-center gap-3">

                        <div
                            className="flex items-center gap-2 group cursor-pointer"
                            onClick={() => handleNav('/')}
                            aria-label="Go to dashboard"
                        >
                            <div
                                className="flex items-center justify-center"
                                style={{
                                    width: 'var(--space-8)',
                                    height: 'var(--space-8)',
                                    borderRadius: 'var(--radius-md)',
                                    backgroundColor: 'var(--accent)',
                                }}
                            >
                                <Sparkles size={14} style={{ color: 'var(--text-on-accent)' }} />
                            </div>
                            <span className="text-base font-semibold hidden sm:inline" style={{ color: 'var(--text-heading)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                <span style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontWeight: 600, fontSize: '1.05em' }}>Lipi</span>
                                <span style={{ fontFamily: 'var(--font-sans)', fontWeight: 500, fontSize: '0.8em', letterSpacing: '0.08em', textTransform: 'uppercase', opacity: 0.8 }}>Studio</span>
                            </span>
                        </div>
            </div>

            <div className="flex items-center gap-2">
                {!isMobile && (
                    <button
                        onClick={onToggleShortcuts}
                        className="flex-center focus-ring"
                        style={{
                            width: 'var(--touch-target-min)',
                            height: 'var(--touch-target-min)',
                            borderRadius: 'var(--radius-md)',
                            color: 'var(--text-secondary)',
                        }}
                        title="Keyboard Shortcuts"
                    >
                        <Keyboard size={18} />
                    </button>
                )}

                <button
                    onClick={onToggleAI}
                    className="flex-center focus-ring"
                    style={{
                        width: 'var(--touch-target-min)',
                        height: 'var(--touch-target-min)',
                        borderRadius: 'var(--radius-md)',
                        color: isAIOpen ? 'var(--accent)' : 'var(--text-secondary)',
                        backgroundColor: isAIOpen ? 'var(--accent-soft)' : undefined,
                    }}
                    title="Ask AI"
                    aria-label="Toggle AI assistant"
                >
                    <Brain size={isMobile ? 16 : 18} />
                </button>

                {!isMobile && (
                    <div className="relative" ref={profileDropdownRef}>
                        <button
                            onClick={onToggleProfile}
                            className="flex items-center justify-center text-sm font-bold focus-ring"
                            style={{
                                width: 'var(--touch-target-min)',
                                height: 'var(--touch-target-min)',
                                borderRadius: '9999px',
                                backgroundColor: 'var(--accent)',
                                color: 'var(--text-on-accent)',
                            }}
                            title="Account"
                            aria-label="User menu"
                            aria-haspopup="true"
                            aria-expanded={isProfileOpen}
                        >
                            {user?.name?.charAt(0).toUpperCase() || 'U'}
                        </button>

                        <AnimatePresence>
                            {isProfileOpen && (
                                <motion.div
                                    className="absolute right-0 p-3"
                                    role="menu"
                                    aria-label="User menu"
                                    style={{
                                        top: 'calc(100% + var(--space-3))',
                                        width: '280px',
                                        backgroundColor: 'var(--surface-elevated)',
                                        borderRadius: 'var(--radius-xl)',
                                        border: '1px solid var(--border-subtle)',
                                        boxShadow: 'var(--shadow-lg)',
                                        zIndex: 'var(--z-dropdown)',
                                    }}
                                    initial={{ opacity: 0, y: -8, scale: 0.96 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, y: -8, scale: 0.96 }}
                                    transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
                                >
                                    <div className="flex items-center gap-3 p-2 mb-2">
                                        <div
                                            className="flex items-center justify-center text-lg font-bold shrink-0"
                                            style={{
                                                width: '44px',
                                                height: '44px',
                                                borderRadius: '9999px',
                                                backgroundColor: 'var(--accent)',
                                                color: 'var(--text-on-accent)',
                                            }}
                                        >
                                            {user?.name?.charAt(0).toUpperCase() || 'U'}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-sm font-medium truncate" style={{ color: 'var(--text-heading)' }}>
                                                {user?.name || 'User'}
                                            </p>
                                            <p className="text-xs truncate" style={{ color: 'var(--text-tertiary)' }}>
                                                {user?.email || ''}
                                            </p>
                                        </div>
                                    </div>

                                    <div style={{ height: '1px', backgroundColor: 'var(--border-subtle)', marginBlock: 'var(--space-2)' }} />

                                    <button
                                        onClick={() => handleNav('/settings')}
                                        className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm w-full transition-all duration-150 focus-ring"
                                        style={{ color: 'var(--text-secondary)' }}
                                        role="menuitem"
                                    >
                                        <Settings size={16} />
                                        Settings
                                    </button>

                                    <button
                                        onClick={handleLogout}
                                        className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm w-full transition-all duration-150 focus-ring"
                                        style={{ color: 'var(--status-error)' }}
                                        role="menuitem"
                                    >
                                        <LogOut size={16} />
                                        Sign out
                                    </button>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                )}
            </div>
        </header>
    );
}
