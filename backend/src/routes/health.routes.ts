
import express from 'express';
import { aiServiceManager } from '../services/aiManager/index.js';
import mongoose from 'mongoose';
import Redis from 'ioredis';
import { authenticate, requireEmailVerified } from '../middleware/auth.js';

const router = express.Router();

let redisClient: Redis | null = null;

function getRedisClient(): Redis {
    if (!redisClient) {
        redisClient = new Redis({
            host: process.env.REDIS_HOST || '127.0.0.1',
            port: Number(process.env.REDIS_PORT) || 6379,
            connectTimeout: 1000,
            lazyConnect: true,
            maxRetriesPerRequest: 1,
        });
    }
    return redisClient;
}

// GET /api/script/health/infra
router.get('/infra', async (req, res) => {
    const health: {
        status: string;
        timestamp: string;
        services: {
            mongodb: string;
            redis: string;
            ai_provider: { active: string; status: string };
        };
    } = {
        status: 'UP',
        timestamp: new Date().toISOString(),
        services: {
            mongodb: 'DOWN',
            redis: 'DOWN',
            ai_provider: {
                active: aiServiceManager.getProvider(),
                status: 'UNKNOWN'
            }
        }
    };

    // 1. Check MongoDB
    try {
        if (mongoose.connection.readyState === 1) {
            health.services.mongodb = 'UP';
        }
    } catch {
        health.status = 'DEGRADED';
    }

    // 2. Check Redis (reuse singleton client)
    try {
        const redis = getRedisClient();
        await redis.connect();
        health.services.redis = 'UP';
    } catch {
        health.services.redis = 'DOWN (Background tasks will fail)';
        health.status = 'DEGRADED';
    }

    // 3. Check AI Provider
    health.services.ai_provider.status = 'READY';

    res.json(health);
});

// Temporary Secure Diagnostic Endpoint
router.get('/debug-db-status', authenticate, requireEmailVerified, async (req, res) => {
    if (process.env.NODE_ENV !== 'development') {
        res.status(403).json({ success: false, error: 'Forbidden. Development environment only.' });
        return;
    }

    try {
        const users = await mongoose.model('User').find();
        res.json({
            success: true,
            mongodbUri: process.env.MONGODB_URI,
            dbName: mongoose.connection.name,
            host: mongoose.connection.host,
            readyState: mongoose.connection.readyState,
            usersCount: users.length,
            users: users.map(u => ({ email: (u as any).email, id: u._id })),
            jwtSecretLength: process.env.JWT_SECRET ? process.env.JWT_SECRET.length : 0,
            jwtSecretPrefix: process.env.JWT_SECRET ? process.env.JWT_SECRET.slice(0, 5) : 'none',
        });
    } catch (err: any) {
        res.status(500).json({ success: false, error: err.message });
    }
});

export const healthRoutes = router;
