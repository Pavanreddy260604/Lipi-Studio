import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion } from 'framer-motion';
import { Mail, ArrowRight, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { api } from '../services/api';
import { Button, Card, Stack, Badge, Input } from '../components/ui';

const forgotSchema = z.object({
    email: z.string().email('Invalid email address'),
});

type ForgotForm = z.infer<typeof forgotSchema>;

export function ForgotPassword() {
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const {
        register,
        handleSubmit,
        formState: { errors },
    } = useForm<ForgotForm>({
        resolver: zodResolver(forgotSchema),
    });

    const onSubmit = async (data: ForgotForm) => {
        setError(null);
        setSuccess(null);
        setIsLoading(true);
        try {
            const res = await api.forgotPassword(data.email) as { message?: string };
            setSuccess(res?.message || 'If an account exists, a reset link was sent.');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Request failed');
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
                                Password <span className="text-accent">Recovery</span>
                            </h1>
                            <p className="text-sm font-medium text-secondary max-w-[28ch] mx-auto leading-relaxed">
                                Enter your email to receive a password reset link.
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

                                    <Input
                                        label="Email"
                                        type="email"
                                        autoComplete="email"
                                        placeholder="you@example.com"
                                        leftIcon={<Mail size={16} className="text-muted" />}
                                        error={errors.email?.message}
                                        {...register('email')}
                                        className="bg-subtle-2 h-12"
                                    />

                                    <Button
                                        type="submit"
                                        variant="primary"
                                        isLoading={isLoading}
                                        className="h-12 text-[11px] font-black uppercase tracking-[0.2em] w-full"
                                        rightIcon={<ArrowRight size={16} />}
                                    >
                                        Send Reset Link
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
                                    <h3 className="text-lg font-black text-heading uppercase tracking-tight">Email Sent</h3>
                                    <p className="text-xs font-medium text-secondary leading-relaxed">
                                        {success}
                                    </p>
                                </Stack>
                            </motion.div>
                        )}
                    </Card>

                    <Stack gap={6} align="center">
                        <Link
                            to="/login"
                            className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-muted hover:text-heading transition-all"
                        >
                            <ArrowLeft size={12} />
                            Return to Login
                        </Link>
                    </Stack>
                </Stack>
            </motion.div>
        </div>
    );
}
