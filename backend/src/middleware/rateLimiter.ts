import rateLimit from 'express-rate-limit';

/**
 * Rate limiter for auth endpoints
 * Strict limits to prevent brute force attacks
 */
export const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // 100 requests per window (increased from 20 for developer convenience)
    message: {
        success: false,
        error: 'Too many authentication attempts. Please try again in 15 minutes.',
    },
    standardHeaders: true,
    legacyHeaders: false,
});

/**
 * Rate limiter for general API endpoints
 */
export const apiLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 1000, // 1000 requests per minute (increased from 200)
    message: {
        success: false,
        error: 'Too many requests. Please slow down.',
    },
    standardHeaders: true,
    legacyHeaders: false,
});

/**
 * Rate limiter for write operations
 */
export const writeLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 300, // 300 writes per minute (increased from 60)
    message: {
        success: false,
        error: 'Too many write operations. Please slow down.',
    },
    standardHeaders: true,
    legacyHeaders: false,
});

/**
 * Rate limiter for AI generation endpoints.
 * Prevents abuse of expensive LLM calls.
 */
export const aiLimiter = rateLimit({
    windowMs: 1 * 60 * 1000,
    max: 200, // Increased from 10 to support active paid-tier developer testing
    message: {
        success: false,
        error: 'Too many AI generation requests. Please wait before generating more content.',
    },
    standardHeaders: true,
    legacyHeaders: false,
});

/**
 * Rate limiter for AI critique/fix endpoints.
 * Critique chains are expensive — 2-3 LLM calls per request.
 */
export const aiCritiqueLimiter = rateLimit({
    windowMs: 1 * 60 * 1000,
    max: 120, // Increased from 6 to support active paid-tier developer testing
    message: {
        success: false,
        error: 'Too many critique requests. Please slow down.',
    },
    standardHeaders: true,
    legacyHeaders: false,
});

/**
 * Per-email rate limiter for password reset.
 * Limits any one email to 20 reset requests per hour.
 */
export const forgotPasswordEmailLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 20, // 20 requests per hour (increased from 5)
    keyGenerator: (req) => {
        const email = typeof req.body?.email === 'string'
            ? req.body.email.trim().toLowerCase()
            : '';
        // Fall back to IP if email is missing
        return email || `ip:${req.ip}`;
    },
    validate: false,
    skipSuccessfulRequests: false,
    message: {
        success: false,
        error: 'Too many password reset requests for this email. Try again in an hour.',
    },
    standardHeaders: true,
    legacyHeaders: false,
});

/**
 * Rate limiter for Beat Sheet generator.
 * Limits generation to 3 requests per minute per IP.
 */
export const beatSheetLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 3, // 3 requests per minute
    message: {
        success: false,
        error: 'Too many beat sheet generation requests. Limit is 3 per minute.',
    },
    standardHeaders: true,
    legacyHeaders: false,
});

