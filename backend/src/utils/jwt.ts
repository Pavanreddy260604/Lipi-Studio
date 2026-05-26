import jwt, { SignOptions } from 'jsonwebtoken';
import { z } from 'zod';
import crypto from 'crypto';

const getRequiredEnvSecret = (): string => {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
        throw new Error('[jwt] JWT_SECRET environment variable is missing.');
    }
    return secret;
};

// Lazy read environment configurations
function getSecret(): string {
    return getRequiredEnvSecret();
}

function getExpiresIn(): SignOptions['expiresIn'] {
    return (process.env.JWT_EXPIRES_IN || '15m') as SignOptions['expiresIn'];
}

function getIssuer(): string | undefined {
    return process.env.JWT_ISSUER;
}

/**
 * Generates a secure random refresh token string (UUID v4)
 */
export const generateRefreshToken = (): string => {
    return crypto.randomUUID();
};

/**
 * Creates a SHA-256 hash of a string to store securely in database
 */
export const hashToken = (token: string): string => {
    return crypto.createHash('sha256').update(token).digest('hex');
};

const jwtPayloadSchema = z.object({
    userId: z.string().min(1),
    email: z.string().email(),
});

export interface JWTPayload {
    userId: string;
    email: string;
}

/**
 * Generate JWT token for authenticated user
 */
export const generateToken = (payload: JWTPayload): string => {
    const parsedPayload = jwtPayloadSchema.parse(payload);
    const secret = getSecret();
    const options: SignOptions = {
        expiresIn: getExpiresIn(),
        algorithm: 'HS256',
    };

    const issuer = getIssuer();
    if (issuer) {
        options.issuer = issuer;
    }

    return jwt.sign(parsedPayload, secret, options);
};

/**
 * Verify JWT token and return payload
 * Throws error if invalid or expired
 */
export const verifyToken = (token: string): JWTPayload => {
    const secret = getSecret();
    try {
        const verifyOptions: jwt.VerifyOptions = {
            algorithms: ['HS256'],
        };
        const issuer = getIssuer();
        if (issuer) {
            verifyOptions.issuer = issuer;
        }

        const decoded = jwt.verify(token, secret, verifyOptions);
        const parsed = jwtPayloadSchema.safeParse(decoded);

        if (!parsed.success) {
            throw new Error('Invalid token payload');
        }

        return parsed.data;
    } catch (error) {
        if (error instanceof jwt.TokenExpiredError) {
            throw new Error('Token expired');
        }
        if (error instanceof jwt.JsonWebTokenError) {
            throw new Error('Invalid token');
        }
        throw error;
    }
};

/**
 * Extract token from Authorization header
 * Format: "Bearer <token>"
 */
export const extractToken = (authHeader: string | undefined): string | null => {
    if (!authHeader) {
        return null;
    }

    const [scheme, token] = authHeader.trim().split(/\s+/);
    if (!scheme || scheme.toLowerCase() !== 'bearer' || !token) {
        return null;
    }

    return token;
};
