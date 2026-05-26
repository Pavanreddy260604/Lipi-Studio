import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion } from 'framer-motion';
import { User, Mail, Lock, Eye, EyeOff, ArrowRight } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { cn } from '../lib/utils';
import { Button, Card, Stack, Input } from '../components/ui';

const registerSchema = z.object({
    name: z.string().min(2, 'Name must be at least 2 characters'),
    email: z.string().email('Invalid email address'),
    password: z
        .string()
        .min(8, 'Password must be at least 8 characters')
        .regex(/[a-z]/, 'Must contain a lowercase letter')
        .regex(/[A-Z]/, 'Must contain an uppercase letter')
        .regex(/[0-9]/, 'Must contain a number'),
    confirmPassword: z.string(),
}).refine(data => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
});

type RegisterForm = z.infer<typeof registerSchema>;

export function Register() {
    const [error, setError] = useState<string | null>(null);
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const navigate = useNavigate();
    const { register: registerUser, isLoading } = useAuthStore();

    const {
        register,
        handleSubmit,
        watch,
        formState: { errors },
    } = useForm<RegisterForm>({
        resolver: zodResolver(registerSchema),
        mode: 'onChange',
    });

    const password = watch('password') || '';

    const passwordChecks = [
        { label: '8+ characters', valid: password.length >= 8 },
        { label: 'Lowercase', valid: /[a-z]/.test(password) },
        { label: 'Uppercase', valid: /[A-Z]/.test(password) },
        { label: 'Number', valid: /[0-9]/.test(password) },
    ];

    const strengthCount = passwordChecks.filter(c => c.valid).length;

    const onSubmit = async (data: RegisterForm) => {
        setError(null);
        try {
            await registerUser(data.name, data.email, data.password);
            navigate('/dashboard');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Registration failed');
        }
    };

    return (
        <div className="auth-page">
            <div className="auth-page__ambient" />

            <motion.div
                className="auth-page__container auth-page__container--wide"
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
                                Create your account
                            </h1>
                            <p className="auth-page__subtitle">
                                Start writing your first screenplay.
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
                                    label="Full name"
                                    type="text"
                                    autoComplete="name"
                                    placeholder="John Doe"
                                    leftIcon={<User size={16} />}
                                    error={errors.name?.message}
                                    {...register('name')}
                                />

                                <Input
                                    label="Email"
                                    type="email"
                                    autoComplete="email"
                                    placeholder="you@example.com"
                                    leftIcon={<Mail size={16} />}
                                    error={errors.email?.message}
                                    {...register('email')}
                                />

                                {/* Password field */}
                                <div className="flex flex-col gap-1.5">
                                    <label htmlFor="reg-password" className="text-xs font-semibold text-secondary tracking-wide">
                                        Password
                                    </label>
                                    <div className="relative">
                                        <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-tertiary">
                                            <Lock size={16} />
                                        </div>
                                        <input
                                            id="reg-password"
                                            type={showPassword ? 'text' : 'password'}
                                            autoComplete="new-password"
                                            placeholder="Create a strong password"
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

                                    {/* Strength bar */}
                                    <div className="auth-page__strength">
                                        <div className="auth-page__strength-track">
                                            {[0, 1, 2, 3].map(i => (
                                                <div
                                                    key={i}
                                                    className={cn(
                                                        'auth-page__strength-segment',
                                                        i < strengthCount && (
                                                            strengthCount <= 1 ? 'auth-page__strength-segment--weak' :
                                                            strengthCount <= 3 ? 'auth-page__strength-segment--medium' :
                                                            'auth-page__strength-segment--strong'
                                                        )
                                                    )}
                                                />
                                            ))}
                                        </div>
                                        <div className="auth-page__strength-checks">
                                            {passwordChecks.map((check) => (
                                                <span key={check.label} className={cn(
                                                    'auth-page__strength-label',
                                                    check.valid && 'auth-page__strength-label--valid'
                                                )}>
                                                    {check.valid ? '✓' : '·'} {check.label}
                                                </span>
                                            ))}
                                        </div>
                                    </div>

                                    {errors.password?.message && (
                                        <p className="text-xs font-medium text-status-error" role="alert">
                                            {errors.password.message}
                                        </p>
                                    )}
                                </div>

                                {/* Confirm password */}
                                <div className="flex flex-col gap-1.5">
                                    <label htmlFor="reg-confirm" className="text-xs font-semibold text-secondary tracking-wide">
                                        Confirm password
                                    </label>
                                    <div className="relative">
                                        <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-tertiary">
                                            <Lock size={16} />
                                        </div>
                                        <input
                                            id="reg-confirm"
                                            type={showConfirm ? 'text' : 'password'}
                                            autoComplete="new-password"
                                            placeholder="Re-enter your password"
                                            className="auth-page__input"
                                            style={errors.confirmPassword?.message ? { borderColor: 'var(--status-error)' } : undefined}
                                            {...register('confirmPassword')}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowConfirm(!showConfirm)}
                                            className="flex-center focus-ring absolute right-3 top-1/2 -translate-y-1/2 w-11 h-11 text-tertiary rounded-xl"
                                            aria-label={showConfirm ? 'Hide password' : 'Show password'}
                                        >
                                            {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                                        </button>
                                    </div>
                                    {errors.confirmPassword?.message && (
                                        <p className="text-xs font-medium text-status-error" role="alert">
                                            {errors.confirmPassword.message}
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
                                    Create account
                                </Button>
                            </Stack>
                        </form>
                    </Card>

                    {/* Footer */}
                    <p className="auth-page__free-note">Free to use. No credit card required.</p>
                    <p className="auth-page__footer">
                        <span className="text-tertiary">Already have an account?</span>{' '}
                        <Link to="/login" className="font-semibold text-accent hover:text-accent-hover transition-colors">
                            Sign in
                        </Link>
                    </p>
                </Stack>
            </motion.div>
        </div>
    );
}
