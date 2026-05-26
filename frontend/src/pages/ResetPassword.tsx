import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion } from 'framer-motion';
import { Lock, Eye, EyeOff, ArrowRight, CheckCircle2, ArrowLeft } from 'lucide-react';
import { api } from '../services/api';
import { Button, Card, Stack, Badge, Input } from '../components/ui';

const resetSchema = z.object({
    password: z.string()
        .min(8, 'Password must be at least 8 characters')
        .regex(/[a-z]/, 'Password must contain a lowercase letter')
        .regex(/[A-Z]/, 'Password must contain an uppercase letter')
        .regex(/[0-9]/, 'Password must contain a number'),
    confirmPassword: z.string()
}).refine(data => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
});

type ResetForm = z.infer<typeof resetSchema>;

export function ResetPassword() {
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<boolean>(false);
    const [isLoading, setIsLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);

    const [searchParams] = useSearchParams();
    const token = searchParams.get('token');
    const navigate = useNavigate();

    const {
        register,
        handleSubmit,
        formState: { errors },
    } = useForm<ResetForm>({
        resolver: zodResolver(resetSchema),
    });

    useEffect(() => {
        if (!token) {
            setError('Invalid or missing reset token.');
        }
    }, [token]);

    const onSubmit = async (data: ResetForm) => {
        if (!token) return;

        setError(null);
        setIsLoading(true);
        try {
            await api.resetPassword(token, data.password);
            setSuccess(true);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Reset failed');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-[100dvh] w-full flex items-center justify-center bg-surface-page p-6 selection:bg-accent/20">
            <motion.div
                className="w-full max-w-[400px]"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            >
                <Stack gap={10}>
                    <Stack gap={4} align="center" className="text-center">
                        <div className="flex items-center justify-center">
                            <Badge variant="secondary" className="px-3 py-1 font-black text-[10px] tracking-[0.2em] uppercase">
                                LIPI STUDIO
                            </Badge>
                        </div>
                        <Stack gap={1}>
                            <h1 className="text-3xl font-black tracking-tighter text-heading uppercase">
                                Reset <span className="text-accent">Password</span>
                            </h1>
                            <p className="text-sm font-medium text-secondary max-w-[28ch] mx-auto leading-relaxed">
                                Create a new password for your account.
                            </p>
                        </Stack>
                    </Stack>

                    <Card className="p-8 bg-surface-elevated border-subtle-8 shadow-2xl">
                        {!success ? (
                            <form onSubmit={handleSubmit(onSubmit)} noValidate>
                                <Stack gap={6}>
                                    {error && (
                                        <motion.div
                                            className="rounded-xl border border-status-error/20 bg-status-error/5 p-4 text-[11px] font-black uppercase tracking-widest text-status-error"
                                            initial={{ opacity: 0, scale: 0.95 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            role="alert"
                                        >
                                            {error}
                                        </motion.div>
                                    )}

                                    <Stack gap={2}>
                                        <label htmlFor="reset-password" className="text-[10px] font-black uppercase tracking-widest text-muted px-1">
                                            New Password
                                        </label>
                                        <div className="relative">
                                            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted">
                                                <Lock size={16} />
                                            </div>
                                            <input
                                                id="reset-password"
                                                type={showPassword ? 'text' : 'password'}
                                                placeholder="New password..."
                                                disabled={!token}
                                                className={errors.password?.message ? "w-full h-12 text-sm pl-10 pr-12 rounded-xl border border-status-error bg-subtle-2 text-heading placeholder:text-muted/30 focus:outline-none transition-all disabled:opacity-30" : "w-full h-12 text-sm pl-10 pr-12 rounded-xl border border-subtle-8 bg-subtle-2 text-heading placeholder:text-muted/30 focus:border-accent/40 focus:outline-none transition-all disabled:opacity-30"}
                                                {...register('password')}
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowPassword(!showPassword)}
                                                disabled={!token}
                                                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-muted hover:text-heading transition-all focus-ring rounded-lg"
                                            >
                                                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                            </button>
                                        </div>
                                        {errors.password?.message && (
                                            <p className="text-[10px] font-black text-status-error uppercase tracking-widest px-1" role="alert">
                                                {errors.password.message}
                                            </p>
                                        )}
                                    </Stack>

                                    <Stack gap={2}>
                                        <label htmlFor="reset-confirm" className="text-[10px] font-black uppercase tracking-widest text-muted px-1">
                                            Confirm Password
                                        </label>
                                        <div className="relative">
                                            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted">
                                                <Lock size={16} />
                                            </div>
                                            <input
                                                id="reset-confirm"
                                                type={showConfirm ? 'text' : 'password'}
                                                placeholder="Confirm password..."
                                                disabled={!token}
                                                className={errors.confirmPassword?.message ? "w-full h-12 text-sm pl-10 pr-12 rounded-xl border border-status-error bg-subtle-2 text-heading placeholder:text-muted/30 focus:outline-none transition-all disabled:opacity-30" : "w-full h-12 text-sm pl-10 pr-12 rounded-xl border border-subtle-8 bg-subtle-2 text-heading placeholder:text-muted/30 focus:border-accent/40 focus:outline-none transition-all disabled:opacity-30"}
                                                {...register('confirmPassword')}
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowConfirm(!showConfirm)}
                                                disabled={!token}
                                                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-muted hover:text-heading transition-all focus-ring rounded-lg"
                                            >
                                                {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                                            </button>
                                        </div>
                                        {errors.confirmPassword?.message && (
                                            <p className="text-[10px] font-black text-status-error uppercase tracking-widest px-1" role="alert">
                                                {errors.confirmPassword.message}
                                            </p>
                                        )}
                                    </Stack>

                                    <Button
                                        type="submit"
                                        variant="primary"
                                        isLoading={isLoading}
                                        disabled={!token}
                                        className="h-12 text-[11px] font-black uppercase tracking-[0.2em] w-full"
                                        rightIcon={<ArrowRight size={16} />}
                                    >
                                        Reset Password
                                    </Button>
                                </Stack>
                            </form>
                        ) : (
                            <motion.div
                                className="flex flex-col items-center gap-6 text-center"
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                role="status"
                            >
                                <div className="w-16 h-16 rounded-full bg-status-success/10 flex items-center justify-center text-status-success border border-status-success/20">
                                    <CheckCircle2 size={32} />
                                </div>
                                <Stack gap={2}>
                                    <h3 className="text-lg font-black text-heading uppercase tracking-tight">Password Updated</h3>
                                    <p className="text-xs font-medium text-secondary leading-relaxed">
                                        Your password has been successfully updated.
                                    </p>
                                </Stack>
                                <Button
                                    variant="primary"
                                    className="w-full h-12 text-[11px] font-black uppercase tracking-[0.2em]"
                                    rightIcon={<ArrowRight size={16} />}
                                    onClick={() => navigate('/login')}
                                >
                                    Proceed to Login
                                </Button>
                            </motion.div>
                        )}
                    </Card>

                    <Stack gap={6} align="center">
                        <Link
                            to="/login"
                            className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-muted hover:text-heading transition-all"
                        >
                            <ArrowLeft size={12} />
                            Back to Login
                        </Link>
                    </Stack>
                </Stack>
            </motion.div>
        </div>
    );
}
