import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { api } from '../../services/api';
import { Lock, Mail, LogOut, RefreshCw, AlertCircle, CheckCircle2, Loader2, Settings } from 'lucide-react';
import { Button } from './Button';
import { Input } from './Input';
import { Card } from './Card';
import { Stack } from './Stack';

export function VerificationOverlay() {
    const { user, logout, checkAuth } = useAuthStore();
    const navigate = useNavigate();
    
    const [code, setCode] = useState('');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState({ text: '', type: '' });
    
    // Cooldown timer for resending verification code
    const [cooldown, setCooldown] = useState(0);

    useEffect(() => {
        let timer: any;
        if (cooldown > 0) {
            timer = setInterval(() => {
                setCooldown(prev => prev - 1);
            }, 1000);
        }
        return () => clearInterval(timer);
    }, [cooldown]);

    if (!user || user.emailVerified) {
        return null;
    }

    const handleVerify = async (e: React.FormEvent) => {
        e.preventDefault();
        const trimmedCode = code.trim();
        if (trimmedCode.length !== 6) {
            setMessage({ text: 'Code must be exactly 6 digits.', type: 'error' });
            return;
        }

        setLoading(true);
        setMessage({ text: '', type: '' });
        try {
            await api.verifyEmail(trimmedCode);
            await checkAuth(); // Refresh authentication state
            setMessage({ text: 'Email verified successfully! Opening workspace...', type: 'success' });
        } catch (error: any) {
            setMessage({ text: error.message || 'Verification failed. Please double check your code.', type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    const handleResend = async () => {
        if (cooldown > 0) return;
        
        setLoading(true);
        setMessage({ text: '', type: '' });
        try {
            await api.resendVerification();
            setMessage({ text: 'A fresh 6-digit verification code has been dispatched.', type: 'success' });
            setCooldown(60); // 60 seconds cooldown
        } catch (error: any) {
            setMessage({ text: error.message || 'Failed to resend code.', type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    const handleCorrectEmail = () => {
        navigate('/settings');
    };

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-[color:var(--bg-canvas)] px-4 sm:px-6">
            <Card className="max-w-md w-full p-8 sm:p-10 border border-subtle-10 bg-subtle-2 shadow-2xl">
                <Stack gap={6} align="stretch">
                    {/* Header */}
                    <div className="text-center flex flex-col items-center gap-3">
                        <div className="w-16 h-16 rounded-2xl border border-accent/20 flex items-center justify-center bg-accent/5 text-accent animate-pulse">
                            <Lock size={28} />
                        </div>
                        <Stack gap={1} align="center">
                            <h1 className="text-xl font-black text-heading tracking-tight">SaaS Workspace Locked</h1>
                            <p className="text-xs font-bold text-muted uppercase tracking-widest">Email Verification Required</p>
                        </Stack>
                    </div>

                    <div className="h-[1px] bg-subtle-8 w-full" />

                    {/* Instructions */}
                    <div className="text-xs text-secondary leading-relaxed text-center">
                        To access creative screenplay tools, please verify your identity. A secure 6-digit code has been dispatched to:
                        <div className="font-bold text-heading mt-2 px-3 py-2 rounded-xl bg-subtle-3 border border-subtle-5 inline-flex items-center gap-2 select-all font-mono">
                            <Mail size={12} className="text-accent" />
                            {user.email}
                        </div>
                    </div>

                    {/* Verification Form */}
                    <form onSubmit={handleVerify} className="flex flex-col gap-4">
                        <Stack gap={2}>
                            <label className="text-[10px] font-black uppercase tracking-widest text-muted ml-1">6-Digit Verification Token</label>
                            <Input
                                type="text"
                                maxLength={6}
                                value={code}
                                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                                placeholder="0 0 0 0 0 0"
                                className="text-center font-mono text-xl tracking-[0.3em] font-black focus-ring min-h-[48px]"
                                disabled={loading}
                                required
                            />
                        </Stack>

                        {message.text && (
                            <div className={`p-3.5 rounded-xl border text-xs leading-relaxed flex items-start gap-2.5 ${
                                message.type === 'success' 
                                    ? 'bg-status-success/5 border-status-success/20 text-status-success' 
                                    : 'bg-status-error/5 border-status-error/20 text-status-error'
                            }`}>
                                {message.type === 'success' ? (
                                    <CheckCircle2 size={16} className="shrink-0 mt-0.5" />
                                ) : (
                                    <AlertCircle size={16} className="shrink-0 mt-0.5" />
                                )}
                                <span>{message.text}</span>
                            </div>
                        )}

                        <Button
                            type="submit"
                            disabled={loading || code.length !== 6}
                            isLoading={loading}
                            variant="primary"
                            className="w-full min-h-[44px] focus-ring font-bold uppercase tracking-wider text-xs"
                        >
                            Verify Workspace Key
                        </Button>
                    </form>

                    <div className="h-[1px] bg-subtle-8 w-full" />

                    {/* Secondary Actions */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <Button
                            type="button"
                            onClick={handleResend}
                            disabled={loading || cooldown > 0}
                            variant="secondary"
                            className="min-h-[44px] text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 focus-ring"
                        >
                            {loading ? (
                                <Loader2 size={14} className="animate-spin" />
                            ) : (
                                <RefreshCw size={14} />
                            )}
                            {cooldown > 0 ? `Resend (${cooldown}s)` : 'Resend Code'}
                        </Button>

                        <Button
                            type="button"
                            onClick={handleCorrectEmail}
                            variant="secondary"
                            className="min-h-[44px] text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 focus-ring"
                        >
                            <Settings size={14} />
                            Correct Email
                        </Button>
                    </div>

                    <Button
                        type="button"
                        onClick={logout}
                        variant="secondary"
                        className="w-full min-h-[44px] text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 border-status-error/10 hover:bg-status-error/5 hover:text-status-error focus-ring text-muted"
                    >
                        <LogOut size={14} />
                        Exit Workspace (Logout)
                    </Button>
                </Stack>
            </Card>
        </div>
    );
}
