import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion } from 'framer-motion';
import { Mail, Lock, Eye, EyeOff, ArrowRight } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { Button, Card, Stack, Input } from '../components/ui';

const loginSchema = z.object({
    email: z.string().email('Invalid email address'),
    password: z.string().min(1, 'Password is required'),
});

type LoginForm = z.infer<typeof loginSchema>;

export function Login() {
    const [error, setError] = useState<string | null>(null);
    const [showPassword, setShowPassword] = useState(false);
    const navigate = useNavigate();
    const location = useLocation();
    const { login, isLoading } = useAuthStore();

    const {
        register,
        handleSubmit,
        formState: { errors },
    } = useForm<LoginForm>({
        resolver: zodResolver(loginSchema),
    });

    const errorsMounted = useRef(false);

    useEffect(() => {
        if (errorsMounted.current && Object.keys(errors).length > 0) {
            const firstErrorKey = Object.keys(errors)[0];
            const el = document.getElementById(firstErrorKey === 'password' ? 'login-password' : `input-${firstErrorKey}`);
            el?.focus();
        }
        errorsMounted.current = true;
    }, [errors]);

    const onSubmit = async (data: LoginForm) => {
        setError(null);
        try {
            await login(data.email, data.password);
            const state = location.state as { from?: { pathname?: string } } | null;
            const from = state?.from?.pathname || '/dashboard';
            navigate(from, { replace: true });
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Login failed');
        }
    };

    return (
        <div className="auth-page">
            <div className="auth-page__ambient" />

            <motion.div
                className="auth-page__container"
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            >
                <Stack gap={8}>
                    {/* Brand header */}
                    <Stack gap={3} align="center" className="text-center">
                        <motion.div
                            className="auth-brand"
                            initial={{ opacity: 0, y: -8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.5, delay: 0.1 }}
                        >
                            <div className="auth-brand__mark">
                                <span className="auth-brand__lipi">Lipi</span>
                                <span className="auth-brand__studio">Studio</span>
                            </div>
                            <span className="auth-brand__descriptor">Free screenplay writing studio</span>
                        </motion.div>
                        <Stack gap={1}>
                            <h1 className="auth-page__title">
                                Welcome back
                            </h1>
                            <p className="auth-page__subtitle">
                                Pick up where you left off.
                            </p>
                        </Stack>
                    </Stack>

                    {/* Form card */}
                    <Card className="auth-page__card">
                        <form onSubmit={handleSubmit(onSubmit)} noValidate>
                            <Stack gap={5}>
                                {error && (
                                    <motion.div
                                        className="auth-page__error"
                                        initial={{ opacity: 0, y: -8 }}
                                        animate={{ opacity: 1, y: 0 }}
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
                                    leftIcon={<Mail size={16} />}
                                    error={errors.email?.message}
                                    {...register('email')}
                                />

                                <div className="flex flex-col gap-1.5">
                                    <div className="flex items-center justify-between">
                                        <label htmlFor="login-password" className="text-xs font-semibold text-secondary tracking-wide">
                                            Password
                                        </label>
                                        <Link
                                            to="/forgot-password"
                                            className="text-xs font-medium text-accent hover:text-accent-hover transition-colors"
                                        >
                                            Forgot password?
                                        </Link>
                                    </div>
                                    <div className="relative">
                                        <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-tertiary">
                                            <Lock size={16} />
                                        </div>
                                        <input
                                            id="login-password"
                                            type={showPassword ? 'text' : 'password'}
                                            autoComplete="current-password"
                                            placeholder="••••••••"
                                            className="auth-page__input"
                                            style={errors.password?.message ? { borderColor: 'var(--status-error)' } : undefined}
                                            {...register('password')}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="flex-center focus-ring absolute right-3 top-1/2 -translate-y-1/2 w-11 h-11 text-tertiary rounded-xl"
                                            aria-label={showPassword ? 'Hide password' : 'Show password'}
                                        >
                                            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                        </button>
                                    </div>
                                    {errors.password?.message && (
                                        <p className="text-xs font-medium text-status-error" role="alert">
                                            {errors.password.message}
                                        </p>
                                    )}
                                </div>

                                <Button
                                    type="submit"
                                    variant="primary"
                                    isLoading={isLoading}
                                    className="auth-page__submit"
                                    rightIcon={<ArrowRight size={16} />}
                                >
                                    Sign in
                                </Button>
                            </Stack>
                        </form>
                    </Card>

                    {/* Footer */}
                    <p className="auth-page__footer">
                        <span className="text-tertiary">Don't have an account?</span>{' '}
                        <Link to="/register" className="font-semibold text-accent hover:text-accent-hover transition-colors">
                            Create one
                        </Link>
                    </p>
                </Stack>
            </motion.div>
        </div>
    );
}
