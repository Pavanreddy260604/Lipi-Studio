import { z } from 'zod';

const passwordSchema = z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[a-z]/, 'Password must contain a lowercase letter')
    .regex(/[A-Z]/, 'Password must contain an uppercase letter')
    .regex(/[0-9]/, 'Password must contain a number');

export const registerSchema = z.object({
    name: z.string().min(2, 'Name must be at least 2 characters').max(50),
    email: z.string().email('Invalid email format'),
    password: passwordSchema,
    timezone: z.string().optional(),
});

export const loginSchema = z.object({
    email: z.string().email('Invalid email format'),
    password: z.string().min(1, 'Password is required'),
});

export const aiKeySchema = z.object({
    apiKey: z.string().trim().min(1, 'API Key is required').max(500, 'API Key is too long'),
}).strict();

export const forgotPasswordSchema = z.object({
    email: z.string().email('Invalid email format'),
});

export const resetPasswordSchema = z.object({
    token: z.string().min(1, 'Reset token is required'),
    password: passwordSchema,
});

export const changePasswordSchema = z.object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: passwordSchema,
});

export const verifyEmailSchema = z.object({
    code: z.string().length(6, 'Verification code must be 6 digits'),
});

export const updateProfileSchema = z.object({
    name: z.string().min(2).max(50).optional(),
    email: z.string().email('Invalid email format').optional(),
    timezone: z.string().optional(),
    scriptInterests: z.object({ directors: z.array(z.string()), genres: z.array(z.string()), styles: z.array(z.string()) }).optional(),
    theme: z.enum(['dark', 'light', 'system']).optional(),
    accentColor: z.string().optional(),
    customAccentColor: z.string().nullable().optional(),
    aiAccentColor: z.string().optional(),
    backgroundTinting: z.boolean().optional(),
    reducedMotion: z.boolean().optional(),
});

export const normalizeEmail = (email: string) => email.trim().toLowerCase();
