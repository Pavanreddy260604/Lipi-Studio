import { useState } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { api } from '../../services/api';
import { AlertCircle, CheckCircle2, Loader2, X } from 'lucide-react';

export function VerificationBanner() {
    const { user, checkAuth } = useAuthStore();
    const [isOpen, setIsOpen] = useState(false);
    const [code, setCode] = useState('');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState({ text: '', type: '' });
    const [isVisible, setIsVisible] = useState(() => {
        return sessionStorage.getItem('dismiss-verification-banner') !== 'true';
    });

    if (!user || user.emailVerified || !isVisible) {
        return null;
    }

    const handleVerify = async (e: React.FormEvent) => {
        e.preventDefault();
        if (code.length !== 6) {
            setMessage({ text: 'Code must be 6 digits', type: 'error' });
            return;
        }

        setLoading(true);
        setMessage({ text: '', type: '' });
        try {
            await api.verifyEmail(code);
            await checkAuth(); // Refresh user state to clear the banner
            setMessage({ text: 'Email verified successfully!', type: 'success' });
            setTimeout(() => setIsVisible(false), 2000);
        } catch (error: any) {
            setMessage({ text: error.message || 'Verification failed', type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    const handleResend = async () => {
        setLoading(true);
        setMessage({ text: '', type: '' });
        try {
            await api.resendVerification();
            setMessage({ text: 'Verification code sent to your email', type: 'success' });
        } catch (error: any) {
            setMessage({ text: error.message || 'Failed to resend code', type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-subtle-5 border-b border-subtle-20 px-4 py-3 sm:px-6 lg:px-8 relative z-50">
            <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-16">
                <div className="flex items-center gap-3 w-full sm:w-auto">
                    <AlertCircle className="text-status-warning flex-shrink-0" size={20} />
                    <p className="text-sm text-status-warning font-semibold tracking-tight">
                        Please verify your email address ({user.email}) to secure your account.
                    </p>
                </div>

                {!isOpen ? (
                    <div className="flex items-center gap-3 w-full sm:w-auto shrink-0 justify-end">
                        <button
                            onClick={async () => {
                                setIsOpen(true);
                                // Auto-send verification code when user opens the panel
                                setLoading(true);
                                try {
                                    await api.resendVerification();
                                    setMessage({ text: 'Verification code sent to your email!', type: 'success' });
                                } catch (error: any) {
                                    setMessage({ text: error.message || 'Failed to send code. Click Resend to try again.', type: 'error' });
                                } finally {
                                    setLoading(false);
                                }
                            }}
                            disabled={loading}
                            className="text-xs font-semibold bg-subtle-5 hover:bg-subtle-5 text-status-warning px-3 py-1.5 rounded-lg transition-colors border border-subtle-20 disabled:opacity-50 focus-ring"
                        >
                            {loading ? 'Sending...' : 'Enter Code'}
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setIsVisible(false);
                                sessionStorage.setItem('dismiss-verification-banner', 'true');
                            }}
                            className="p-1.5 rounded-lg text-status-warning/70 hover:text-status-warning hover:bg-subtle-2/50 transition-all focus-ring"
                            title="Dismiss banner"
                        >
                            <X size={16} />
                        </button>
                    </div>
                ) : (
                    <div className="w-full sm:w-auto">
                        <form onSubmit={handleVerify} className="flex items-center gap-2">
                            <input
                                type="text"
                                maxLength={6}
                                value={code}
                                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                                placeholder="6-digit code"
                                className="bg-console-surface border border-border-subtle rounded-lg px-3 py-1.5 text-sm w-32 focus:outline-none focus:border-subtle-20"
                                disabled={loading}
                            />
                            <button
                                type="submit"
                                disabled={loading || code.length !== 6}
                                className="bg-amber-500 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-amber-600 disabled:opacity-50 flex items-center gap-2 transition-colors"
                            >
                                {loading && <Loader2 size={14} className="animate-spin" />}
                                Verify
                            </button>
                            <button
                                type="button"
                                onClick={handleResend}
                                disabled={loading}
                                className="text-sm text-text-secondary hover:text-text-primary px-2 py-1.5 transition-colors"
                            >
                                Resend
                            </button>
                            <button
                                type="button"
                                onClick={() => setIsOpen(false)}
                                className="text-text-secondary hover:text-text-primary p-1"
                            >
                                <X size={16} />
                            </button>
                        </form>
                        {message.text && (
                            <p className={`text-xs mt-2 flex items-center gap-1 ${message.type === 'success' ? 'text-status-success' : 'text-status-error'}`}>
                                {message.type === 'success' && <CheckCircle2 size={12} />}
                                {message.text}
                            </p>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
