import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { User } from '../../models/User.js';
import { RefreshToken } from '../../models/RefreshToken.js';
import { generateToken, generateRefreshToken, hashToken } from '../../utils/jwt.js';
import { emailService } from '../../services/email.service.js';
import { logger } from '../../utils/logger.js';
import { registerSchema, loginSchema, normalizeEmail } from './validation.js';

const log = logger.child({ module: 'auth' });

export async function csrf(_req: Request, res: Response, _next: NextFunction) {
    res.json({ success: true, data: { token: 'not-applicable' } });
}

export async function register(req: Request, res: Response, _next: NextFunction) {
    try {
        const result = registerSchema.safeParse(req.body);
        if (!result.success) { res.status(400).json({ success: false, error: result.error.issues[0].message }); return; }
        const { name, email, password, timezone } = result.data;
        const normalizedEmail = normalizeEmail(email);
        const existingUser = await User.findOne({ email: normalizedEmail });
        if (existingUser) return res.status(409).json({ success: false, error: 'Email already registered' });
        const verificationCode = crypto.randomInt(100000, 999999).toString();
        const isAdmin = normalizedEmail === 'pavanreddynalla1959@gmail.com';
        const user = new User({ 
            name, 
            email: normalizedEmail, 
            passwordHash: password, 
            timezone: timezone || 'Asia/Kolkata', 
            role: isAdmin ? 'admin' : 'user', 
            emailVerified: isAdmin ? true : false, 
            verificationToken: isAdmin ? undefined : crypto.createHash('sha256').update(verificationCode).digest('hex'), 
            verificationExpiry: isAdmin ? undefined : new Date(Date.now() + 15 * 60 * 1000) 
        });
        await user.save();
        if (!isAdmin) {
            emailService.sendVerificationEmail(user.email, verificationCode).catch(e => { log.error('verification_email.send_failed', { err: e, email: user.email }); });
        }
        const token = generateToken({ userId: user._id.toString(), email: user.email });
        const refreshToken = generateRefreshToken();
        await RefreshToken.create({ userId: user._id, token: hashToken(refreshToken), expiresAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), ipAddress: req.ip, userAgent: req.headers['user-agent'] });
        res.cookie('refreshToken', refreshToken, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', maxAge: 3 * 24 * 60 * 60 * 1000 });
        res.status(201).json({ success: true, data: { user: user.toJSON(), token } });
    } catch (error) {
        if ((error as { code?: number })?.code === 11000) return res.status(409).json({ success: false, error: 'Email already registered' });
        log.error('register.failed', { err: error });
        res.status(500).json({ success: false, error: 'Registration failed' });
    }
}

export async function login(req: Request, res: Response, _next: NextFunction) {
    try {
        const result = loginSchema.safeParse(req.body);
        if (!result.success) { res.status(400).json({ success: false, error: result.error.issues[0].message }); return; }
        const { email, password } = result.data;
        const normalizedEmail = normalizeEmail(email);
        const user = await User.findOne({ email: normalizedEmail });
        if (!user) { res.status(401).json({ success: false, error: 'Invalid email or password' }); return; }
        const isValid = await user.comparePassword(password);
        if (!isValid) { res.status(401).json({ success: false, error: 'Invalid email or password' }); return; }
        const token = generateToken({ userId: user._id.toString(), email: user.email });
        const refreshToken = generateRefreshToken();
        await RefreshToken.create({ userId: user._id, token: hashToken(refreshToken), expiresAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), ipAddress: req.ip, userAgent: req.headers['user-agent'] });
        res.cookie('refreshToken', refreshToken, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', maxAge: 3 * 24 * 60 * 60 * 1000 });
        res.json({ success: true, data: { user: user.toJSON(), token } });
    } catch (error) {
        log.error('login.failed', { err: error });
        res.status(500).json({ success: false, error: 'Login failed' });
    }
}

export async function refresh(req: Request, res: Response, _next: NextFunction) {
    try {
        const refreshToken = req.cookies?.refreshToken;
        if (!refreshToken) { res.status(401).json({ success: false, error: 'No refresh token provided' }); return; }
        const hashedToken = hashToken(refreshToken);
        const storedToken = await RefreshToken.findOne({ token: hashedToken });
        if (!storedToken) { res.clearCookie('refreshToken'); res.status(401).json({ success: false, error: 'Invalid refresh token' }); return; }
        if (new Date() > storedToken.expiresAt) { await RefreshToken.deleteOne({ _id: storedToken._id }); res.clearCookie('refreshToken'); res.status(401).json({ success: false, error: 'Refresh token expired' }); return; }
        const user = await User.findById(storedToken.userId);
        if (!user) { await RefreshToken.deleteOne({ _id: storedToken._id }); res.clearCookie('refreshToken'); res.status(401).json({ success: false, error: 'User not found' }); return; }
        await RefreshToken.deleteOne({ _id: storedToken._id });
        const newAccessToken = generateToken({ userId: user._id.toString(), email: user.email });
        const newRefreshToken = generateRefreshToken();
        await RefreshToken.create({ userId: user._id, token: hashToken(newRefreshToken), expiresAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), ipAddress: req.ip, userAgent: req.headers['user-agent'] });
        res.cookie('refreshToken', newRefreshToken, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', maxAge: 3 * 24 * 60 * 60 * 1000 });
        res.json({ success: true, data: { token: newAccessToken, user: user.toJSON() } });
    } catch (error) {
        log.error('refresh_token.failed', { err: error });
        res.status(500).json({ success: false, error: 'Failed to refresh token' });
    }
}

export async function logout(req: Request, res: Response, _next: NextFunction) {
    try {
        const refreshToken = req.cookies?.refreshToken;
        if (refreshToken) { const hashedToken = hashToken(refreshToken); await RefreshToken.deleteOne({ token: hashedToken }); }
        res.clearCookie('refreshToken');
        res.json({ success: true, data: { message: 'Logged out successfully' } });
    } catch (error) {
        log.error('logout.failed', { err: error });
        res.status(500).json({ success: false, error: 'Failed to logout' });
    }
}
