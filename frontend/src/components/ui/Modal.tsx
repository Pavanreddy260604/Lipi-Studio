import { type ReactNode, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title?: string;
    children: ReactNode;
    size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl' | 'full';
    className?: string;
    headerAction?: ReactNode;
    showClose?: boolean;
}

export function Modal({ isOpen, onClose, title, children, size = 'md', className, headerAction, showClose = true }: ModalProps) {
    const overlayRef = useRef<HTMLDivElement>(null);
    const dialogRef = useRef<HTMLDivElement>(null);
    const previousFocusRef = useRef<HTMLElement | null>(null);

    const getFocusableElements = useCallback(() => {
        if (!dialogRef.current) return [];
        return Array.from(
            dialogRef.current.querySelectorAll<HTMLElement>(
                'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
            )
        );
    }, []);

    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };

        if (isOpen) {
            previousFocusRef.current = document.activeElement as HTMLElement;
            document.addEventListener('keydown', handleEscape);
            document.body.style.overflow = 'hidden';
        }

        return () => {
            document.removeEventListener('keydown', handleEscape);
            document.body.style.overflow = '';
            if (previousFocusRef.current) {
                previousFocusRef.current.focus();
                previousFocusRef.current = null;
            }
        };
    }, [isOpen, onClose]);

    useEffect(() => {
        if (!isOpen) return;

        const handleTab = (e: KeyboardEvent) => {
            if (e.key !== 'Tab') return;
            const focusable = getFocusableElements();
            if (focusable.length === 0) return;
            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            if (e.shiftKey) {
                if (document.activeElement === first) {
                    e.preventDefault();
                    last.focus();
                }
            } else {
                if (document.activeElement === last) {
                    e.preventDefault();
                    first.focus();
                }
            }
        };

        document.addEventListener('keydown', handleTab);
        const timer = setTimeout(() => {
            const focusable = getFocusableElements();
            if (focusable.length > 0) focusable[0].focus();
        }, 50);

        return () => {
            document.removeEventListener('keydown', handleTab);
            clearTimeout(timer);
        };
    }, [isOpen, getFocusableElements]);

    const maxWidths: Record<string, string> = {
        sm: '480px', md: '560px', lg: '640px', xl: '720px',
        '2xl': '840px', '3xl': '960px', '4xl': '1080px', '5xl': '1200px',
        'full': 'calc(100vw - var(--space-8))',
    };

    return createPortal(
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 flex items-end sm:items-center justify-center p-0 sm:p-4" style={{ zIndex: 'var(--z-modal)' }}>
                    <motion.div
                        ref={overlayRef}
                        className="absolute inset-0"
                        style={{ backgroundColor: 'var(--surface-overlay)' }}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                    />
                    <motion.div
                        ref={dialogRef}
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby={title ? 'modal-title' : undefined}
                        data-testid="modal-dialog"
                        data-modal-size={size}
                        className={cn(
                            'relative w-full flex flex-col',
                            'h-[100dvh] sm:h-auto',
                            'rounded-none sm:rounded-2xl',
                            'sm:max-h-[90vh]',
                            'bg-surface-elevated border border-subtle-8 shadow-xl',
                            size === 'full' && 'sm:max-h-[calc(100vh-var(--space-8))]',
                            'overscroll-contain',
                            className
                        )}
                        style={{
                            maxWidth: maxWidths[size],
                            paddingBottom: 'var(--safe-area-bottom)',
                        }}
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.97, y: 10 }}
                        transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
                    >
                        <div
                            className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 shrink-0 sticky top-0 z-10 sm:rounded-t-2xl"
                            style={{ borderBottom: '1px solid var(--border-subtle-8)', backgroundColor: 'var(--surface-elevated)' }}
                        >
                            <h2 id="modal-title" className="text-base sm:text-lg font-semibold truncate pr-4 text-heading">
                                {title || '\u00A0'}
                            </h2>
                            <div className="flex items-center gap-1">
                                {headerAction}
                                {showClose && (
                                    <button
                                        onClick={onClose}
                                        className="flex-center focus-ring shrink-0"
                                        style={{
                                            width: 'var(--touch-target-min)',
                                            height: 'var(--touch-target-min)',
                                            borderRadius: 'var(--radius-md)',
                                            color: 'var(--text-tertiary)',
                                        }}
                                        aria-label="Close"
                                    >
                                        <X size={18} />
                                    </button>
                                )}
                            </div>
                        </div>
                        <div data-modal-body="true" className="flex-1 p-4 sm:p-6 overflow-y-auto overscroll-contain">
                            {children}
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>,
        document.body
    );
}
