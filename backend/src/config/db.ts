import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/script-editor-standalone';

let isShuttingDown = false;

export const connectDB = async (): Promise<void> => {
    // Remove existing connection event listeners to prevent duplicate listener accumulation
    mongoose.connection.removeAllListeners('connected');
    mongoose.connection.removeAllListeners('disconnected');
    mongoose.connection.removeAllListeners('reconnected');
    mongoose.connection.removeAllListeners('error');

    // Register event listeners once before connecting
    mongoose.connection.on('connected', () => {
        console.log('✅ AI Script Editor DB connected successfully to database:', mongoose.connection.name);
    });

    mongoose.connection.on('disconnected', () => {
        if (!isShuttingDown) {
            console.log('⚠️ MongoDB disconnected — Mongoose will auto-reconnect');
        }
    });

    mongoose.connection.on('reconnected', () => {
        console.log('✅ AI Script Editor DB reconnected successfully');
    });

    mongoose.connection.on('error', (err) => {
        console.error('❌ MongoDB connection error:', err.message);
    });

    try {
        const poolSize = parseInt(process.env.MONGO_POOL_SIZE || '') || 50;
        
        const options: any = {
            maxPoolSize: poolSize,
            minPoolSize: 5,
            serverSelectionTimeoutMS: 10_000,
            socketTimeoutMS: 45_000,
            heartbeatFrequencyMS: 10_000,
            retryWrites: true,
            appName: 'script-editor-standalone',
            autoIndex: process.env.NODE_ENV !== 'production',
        };

        // Secure TLS/SSL options (Required for Azure Cosmos DB / Managed MongoDB)
        if (process.env.MONGO_TLS === 'true') {
            options.tls = true;
            
            if (process.env.MONGO_TLS_CA_FILE) {
                options.tlsCAFile = path.resolve(process.env.MONGO_TLS_CA_FILE);
            }
            if (process.env.MONGO_TLS_KEY_FILE) {
                options.tlsCertificateKeyFile = path.resolve(process.env.MONGO_TLS_KEY_FILE);
            }
            if (process.env.MONGO_TLS_ALLOW_INVALID_CERTS === 'true') {
                options.tlsAllowInvalidCertificates = true;
            }
        }

        await mongoose.connect(MONGODB_URI, options);
    } catch (error) {
        console.error('❌ MongoDB initial connection failed:', error);
        throw error;
    }
};

/** Check if DB is ready (useful for health checks) */
export const isDBReady = (): boolean =>
    mongoose.connection.readyState === mongoose.ConnectionStates.connected;

/** Graceful shutdown — close connection cleanly on SIGTERM/SIGINT */
export const gracefulClose = async (): Promise<void> => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    console.log('🛑 Closing MongoDB connection gracefully...');
    await mongoose.connection.close();
    console.log('✅ MongoDB connection closed');
};

process.on('SIGINT', gracefulClose);
process.on('SIGTERM', gracefulClose);

export default mongoose;
