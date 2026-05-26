import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import mongoSanitize from 'express-mongo-sanitize';
import { xssSanitizer } from './middleware/security.js';
import cluster from 'cluster';
import { connectDB } from './config/db.js';
import { apiLimiter, aiLimiter, aiCritiqueLimiter } from './middleware/rateLimiter.js';
import { redisCache } from './services/redisCache.service.js';

dotenv.config();

// Environment Variable Security Validation
const validateEnv = () => {
    const requiredEnv = ['MONGODB_URI', 'ENCRYPTION_KEY', 'JWT_SECRET'];
    const missing = requiredEnv.filter(key => !process.env[key]);
    
    if (missing.length > 0) {
        console.error(`\n❌ [Security Engine] CRITICAL CONFIGURATION FAILURE: Missing required environment variables: ${missing.join(', ')}`);
        console.error(`Action Required: Please check your backend/.env configuration file and supply the missing variables before launching the API.\n`);
        process.exit(1);
    }

    const encKey = process.env.ENCRYPTION_KEY || '';
    if (encKey.length !== 32) {
        console.error(`\n❌ [Security Engine] CRITICAL CONFIGURATION FAILURE: ENCRYPTION_KEY must be exactly 32 characters. Current length: ${encKey.length}`);
        console.error(`Action Required: Generate a secure 32-character key (e.g. openssl rand -hex 16) and update ENCRYPTION_KEY in backend/.env.\n`);
        process.exit(1);
    }

    const jwtSecret = process.env.JWT_SECRET || '';
    if (jwtSecret.length < 16) {
        console.error(`\n❌ [Security Engine] CRITICAL CONFIGURATION FAILURE: JWT_SECRET must be at least 16 characters for security integrity.`);
        console.error(`Action Required: Create a secure, long secret string and update JWT_SECRET in backend/.env.\n`);
        process.exit(1);
    }
};

validateEnv();

const app = express();
app.set('trust proxy', 1);
const PORT = process.env.PORT || 5003;

// Middleware
app.use(helmet());
app.use(compression({
    filter: (req: express.Request, res: express.Response) => {
        if (req.headers['x-no-compression'] || res.getHeader('x-no-compression')) {
            return false;
        }
        return compression.filter(req, res);
    }
})); // Gzip compression with stream bypass
app.use(cookieParser()); // Enable httpOnly refresh tokens
app.use(morgan('short')); // Logging

// Rate Limiter
app.use(apiLimiter);

const DEFAULT_DEV_ORIGINS = [
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:5175',
    'http://localhost:3000',
    'http://localhost:5005',
];

const allowedOrigins = (process.env.ALLOWED_ORIGINS || process.env.FRONTEND_URL || '')
    .split(',')
    .map(o => o.trim())
    .filter(Boolean);

const corsOrigins = allowedOrigins.length > 0
    ? allowedOrigins
    : DEFAULT_DEV_ORIGINS;

app.use(cors({
    origin: corsOrigins,
    credentials: true,
}));

app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

// Security Sanitizers
app.use(mongoSanitize()); // Prevent NoSQL injection
app.use(xssSanitizer); // Prevent XSS by stripping malicious scripts

// Health Check
app.get('/health', async (_req, res) => {
    try {
        const mongoose = (await import('mongoose')).default;
        const readyState = mongoose.connection.readyState;
        res.json({
            status: readyState === 1 ? 'ok' : 'degraded',
            service: 'standalone-script-editor-api',
            timestamp: new Date().toISOString(),
            readyState,
        });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// Import consolidated endpoints
import authRoutes from './routes/auth/index.js';
import { scriptRoutes } from './routes/script.routes.js';
import voiceRoutes from './routes/voice.routes.js';
import { bibleRoutes } from './routes/bible/index.js';
import { sceneRoutes } from './routes/scene/index.js';
import { characterRoutes } from './routes/character.routes.js';
import { treatmentRoutes } from './routes/treatment.routes.js';
import { aiRoutes } from './routes/ai.routes.js';
import adminRoutes from './routes/admin.routes.js';
import { healthRoutes } from './routes/health.routes.js';
import { snapshotRoutes } from './routes/snapshot.routes.js';

import { authenticate, requireEmailVerified } from './middleware/auth.js';
// Route Definitions
app.use('/api/auth', authRoutes);
app.use('/api/script/health', healthRoutes); // Public infrastructure health route

// Protected screenplay service endpoints (require authentication & verified email address)
app.use('/api/script', authenticate, requireEmailVerified, scriptRoutes);
app.use('/api/script/voice', authenticate, requireEmailVerified, voiceRoutes);
app.use('/api/script/bible', authenticate, requireEmailVerified, bibleRoutes);
app.use('/api/script/scene', authenticate, requireEmailVerified, sceneRoutes);
app.use('/api/script/character', authenticate, requireEmailVerified, characterRoutes);
app.use('/api/script/treatment', authenticate, requireEmailVerified, aiLimiter, treatmentRoutes);
app.use('/api/script/ai', authenticate, requireEmailVerified, aiLimiter, aiRoutes);
app.use('/api/script/admin', authenticate, requireEmailVerified, adminRoutes);
app.use('/api/script/snapshot', authenticate, requireEmailVerified, snapshotRoutes);

// 404 Handler for undefined API routes
app.use((req: express.Request, res: express.Response) => {
    res.status(404).json({ success: false, error: `API Endpoint not found: ${req.method} ${req.originalUrl}` });
});

// Global Error Handler
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const message = err instanceof Error ? err.message : String(err);
    console.error('Unhandled Server Error:', message);
    res.status(500).json({
        success: false,
        error: process.env.NODE_ENV === 'production' ? 'Internal server error' : message,
    });
});

// Start Server
const startServer = async () => {
    await connectDB();

    // Initialize Redis Cache (keeps connection alive for caching)
    const redisConnected = await redisCache.init();
    if (redisConnected) {
        console.log('✅ [RedisCache] Caching layer active');
    } else {
        console.warn('\n' + '═'.repeat(60));
        console.warn('⚠️  REDIS DISCONNECTED — Using in-memory cache fallback');
        console.warn('Performance: Redis provides faster eviction & cross-process cache.');
        console.warn('Action: Start Redis (e.g., redis-server) for production-grade caching.');
        console.warn('═'.repeat(60) + '\n');
    }

    // Run startup orphan recovery resiliently in the background
    const { orphanRecoveryService } = await import('./services/admin/orphanRecovery.service.js');
    orphanRecoveryService.runStartupRecovery().catch(err => {
        console.error('[OrphanRecovery] Background startup recovery failed:', err);
    });

    const server = app.listen(PORT, () => {
        console.log(`
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║   🎬 AI Script Editor Consolidated API Hub                ║
║                                                            ║
║   Server:     http://localhost:${PORT}                      ║
║   Health:     http://localhost:${PORT}/health               ║
║   Auth API:   http://localhost:${PORT}/api/auth             ║
║   Script API: http://localhost:${PORT}/api/script           ║
║                                                            ║
║   Ready to compile and style premium screenplays! 🎥       ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
        `);
    });

    server.timeout = 180000; // 3 minutes timeout for long AI operations

    // Graceful shutdown
    const shutdown = async () => {
        console.log('\n🛑 Shutting down...');
        await redisCache.quit();
        process.exit(0);
    };
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
};

(async () => {
    if (process.env.CLUSTER_ENABLED === 'true' && cluster.isPrimary) {
        const os = await import('os');
        const numWorkers = Math.min(os.cpus().length, parseInt(process.env.CLUSTER_WORKERS || '0') || os.cpus().length);
        console.log(`[Cluster] Primary ${process.pid} forking ${numWorkers} workers`);
        for (let i = 0; i < numWorkers; i++) cluster.fork();
        cluster.on('exit', (worker) => { console.warn(`[Cluster] Worker ${worker.process.pid} died, restarting`); cluster.fork(); });
    } else {
        startServer().catch(err => {
            console.error('❌ Failed to start server:', err);
            process.exit(1);
        });
    }
})();
