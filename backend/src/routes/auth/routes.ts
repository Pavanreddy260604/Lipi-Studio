import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { authLimiter, forgotPasswordEmailLimiter } from '../../middleware/rateLimiter.js';
import { csrf, register, login, refresh, logout } from './session.js';
import { getMe, updateProfile, updateAiKey, changePassword } from './profile.js';
import { forgotPassword, resetPassword, verifyEmail, resendVerification, deleteAccount } from './security.js';

const router = Router();

router.get('/csrf', csrf);
router.post('/register', authLimiter, register);
router.post('/login', authLimiter, login);
router.post('/refresh', refresh);
router.post('/logout', logout);

router.get('/me', authenticate, getMe);
router.put('/profile', authenticate, updateProfile);
router.put('/ai-key', authenticate, updateAiKey);
router.put('/change-password', authenticate, changePassword);

router.post('/forgot-password', authLimiter, forgotPasswordEmailLimiter, forgotPassword);
router.post('/reset-password', authLimiter, resetPassword);

router.post('/verify-email', authenticate, authLimiter, verifyEmail);
router.post('/resend-verification', authenticate, authLimiter, resendVerification);
router.delete('/account', authenticate, deleteAccount);

export default router;
