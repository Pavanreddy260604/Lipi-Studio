import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, XCircle, Info, AlertTriangle, X } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useToastStore, type ToastType } from '../../stores/toastStore';

const iconMap: Record<ToastType, React.ReactNode> = {
    success: <CheckCircle2 size={18} className="text-[var(--status-success)]" />,
    error: <XCircle size={18} className="text-[var(--status-error)]" />,
    info: <Info size={18} className="text-[var(--status-info)]" />,
    warning: <AlertTriangle size={18} className="text-[var(--status-warning)]" />,
};

const borderMap: Record<ToastType, string> = {
    success: 'border-status-success/20',
    error: 'border-status-error/20',
    info: 'border-status-info/20',
    warning: 'border-status-warning/20',
};

export function ToastContainer() {
    const { toasts, removeToast } = useToastStore();

    return (
        <div
            className="fixed z-[100] flex flex-col gap-2 max-w-sm pointer-events-none"
            style={{
                left: 'max(0.5rem, env(safe-area-inset-left))',
                right: 'max(0.5rem, env(safe-area-inset-right))',
                bottom: 'max(0.5rem, env(safe-area-inset-bottom))',
            }}
            role="region"
            aria-label="Notifications"
        >
            <AnimatePresence mode="popLayout">
                {toasts.map((toast) => (
                    <motion.div
                        key={toast.id}
                        layout
                        initial={{ opacity: 0, x: 100, scale: 0.95 }}
                        animate={{ opacity: 1, x: 0, scale: 1 }}
                        exit={{ opacity: 0, x: 100, scale: 0.95 }}
                        transition={{ type: 'spring', damping: 20, stiffness: 300 }}
                        role="status"
                        aria-live="polite"
                        className={cn(
                            'bg-[var(--surface-elevated)] flex items-center gap-3 px-4 py-3 rounded-xl border shadow-[var(--shadow-lg)] border-subtle-8',
                            'pointer-events-auto text-[var(--text-primary)]',
                            borderMap[toast.type]
                        )}
                    >
                        {iconMap[toast.type]}
                        <p className="flex-1 text-sm font-medium text-[var(--text-primary)]">{toast.message}</p>
                        <button
                            onClick={() => removeToast(toast.id)}
                            className="flex items-center justify-center rounded-lg hover:bg-subtle-5 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors active:scale-90 focus-ring"
                            style={{ minWidth: 'var(--touch-target-min)', minHeight: 'var(--touch-target-min)' }}
                            aria-label="Dismiss notification"
                        >
                            <X size={14} />
                        </button>
                    </motion.div>
                ))}
            </AnimatePresence>
        </div>
    );
}
