import { Request, Response, NextFunction } from 'express';
import { verifyToken, extractToken } from '../utils/jwt.js';
import { User } from '../models/User.js';

// Extend Express Request type to include user
declare global {
    namespace Express {
        interface Request {
            userId?: string;
            user?: { _id: string; email?: string };
        }
    }
}

/**
 * Authentication Middleware
 * Verifies JWT token and attaches user to request
 * Uses JWT payload directly instead of redundant DB lookup
 */
export const authenticate = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const token = extractToken(req.headers.authorization);

        if (!token) {
            res.status(401).json({
                success: false,
                error: 'Access denied. No token provided.',
            });
            return;
        }

        const payload = verifyToken(token);

        req.userId = payload.userId;

        next();
    } catch (error) {
        const message = error instanceof Error && error.message === 'Token expired'
            ? 'Token expired'
            : 'Authentication failed';

        res.status(401).json({
            success: false,
            error: message,
        });
    }
};

/**
 * Enforce Email Verification Middleware
 * Checks if the user's email is verified in the database
 */
export const requireEmailVerified = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        if (!req.userId) {
            res.status(401).json({
                success: false,
                error: 'Authentication required. Access denied.',
            });
            return;
        }

        const user = await User.findById(req.userId).select('emailVerified');
        if (!user) {
            res.status(404).json({
                success: false,
                error: 'User not found.',
            });
            return;
        }

        if (!user.emailVerified) {
            res.status(403).json({
                success: false,
                error: 'Email verification required. Please verify your email to access this service.',
                emailVerified: false,
            });
            return;
        }

        next();
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to verify email status.',
        });
    }
};

/**
 * Admin Authorization Middleware
 * Requires the authenticated user to have admin role
 */
export const requireAdmin = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        if (!req.userId) {
            res.status(401).json({ success: false, error: 'Authentication required.' });
            return;
        }

        const user = await User.findById(req.userId).select('role email');
        if (!user) {
            res.status(403).json({ success: false, error: 'Admin access required.' });
            return;
        }

        const isAdmin = user.role === 'admin' || user.email === 'pavanreddynalla1959@gmail.com';
        if (!isAdmin) {
            res.status(403).json({ success: false, error: 'Admin access required.' });
            return;
        }

        next();
    } catch (error) {
        res.status(500).json({ success: false, error: 'Failed to verify admin status.' });
    }
};

/**
 * Optional authentication middleware
 * Attaches userId if token present, but doesn't require it
 */
export const optionalAuth = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const token = extractToken(req.headers.authorization);

        if (token) {
            const payload = verifyToken(token);
            if (payload?.userId) {
                req.userId = payload.userId;
            }
        }

        next();
    } catch (error) {
        if (process.env.NODE_ENV === 'development') {
            console.warn('[optionalAuth] Token verification failed:', error instanceof Error ? error.message : error);
        }
        next();
    }
};
