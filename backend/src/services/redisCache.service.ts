import { Redis } from 'ioredis';
import fs from 'fs';
import path from 'path';

interface CacheEntry<T> {
  data: T;
  expiry: number;
}

export class RedisCacheService {
  private client: Redis | null = null;
  private ready = false;
  private readonly defaultTTL = 300; // 5 min default
  private memoryCache: Map<string, CacheEntry<unknown>> = new Map();
  private memoryFallback = true;

  async init(): Promise<boolean> {
    try {
      const redisOptions: any = {
        host: process.env.REDIS_HOST || '127.0.0.1',
        port: Number(process.env.REDIS_PORT) || 6379,
        connectTimeout: 2000,
        lazyConnect: true,
        maxRetriesPerRequest: null, // Let ioredis handle retry queue
        retryStrategy: (times: number) => Math.min(times * 100, 2000),
      };

      if (process.env.REDIS_PASSWORD) {
        redisOptions.password = process.env.REDIS_PASSWORD;
      }

      // Secure SSL/TLS support (Required for Azure Cache for Redis / Azure VMs)
      if (process.env.REDIS_TLS === 'true' || Number(process.env.REDIS_PORT) === 6380) {
        const tlsOptions: any = {};

        if (process.env.REDIS_TLS_CA_FILE) {
          tlsOptions.ca = [fs.readFileSync(path.resolve(process.env.REDIS_TLS_CA_FILE))];
        }
        if (process.env.REDIS_TLS_KEY_FILE) {
          tlsOptions.key = fs.readFileSync(path.resolve(process.env.REDIS_TLS_KEY_FILE));
        }
        if (process.env.REDIS_TLS_CERT_FILE) {
          tlsOptions.cert = fs.readFileSync(path.resolve(process.env.REDIS_TLS_CERT_FILE));
        }
        if (process.env.REDIS_TLS_REJECT_UNAUTHORIZED === 'false') {
          tlsOptions.rejectUnauthorized = false;
        } else {
          tlsOptions.rejectUnauthorized = true;
        }

        redisOptions.tls = tlsOptions;
      }

      this.client = new Redis(redisOptions);

      // Register error listener to catch TCP reset/timeout exceptions and prevent node crashes
      this.client.on('error', (err: any) => {
        if (process.env.NODE_ENV !== 'production' || process.env.DEBUG === 'true') {
          console.error('[RedisCache] Redis connection error:', err.message);
        }
      });

      await this.client.connect();
      this.ready = true;
      console.log('[RedisCache] Connected');
      return true;
    } catch (err: any) {
      console.warn(`[RedisCache] Not available (Error: ${err.message}), using in-memory fallback`);
      this.ready = false;
      this.memoryFallback = true;
      return false;
    }
  }

  async get<T>(key: string): Promise<T | undefined> {
    if (this.ready && this.client) {
      try {
        const raw = await this.client.get(key);
        if (raw) return JSON.parse(raw) as T;
      } catch { /* fall through */ }
    }
    if (this.memoryFallback) {
      const entry = this.memoryCache.get(key);
      if (entry && Date.now() < entry.expiry) return entry.data as T;
      if (entry) this.memoryCache.delete(key);
    }
    return undefined;
  }

  async set<T>(key: string, data: T, ttlSeconds = this.defaultTTL): Promise<void> {
    if (this.ready && this.client) {
      try {
        await this.client.setex(key, ttlSeconds, JSON.stringify(data));
        return;
      } catch { /* fall through */ }
    }
    if (this.memoryFallback) {
      if (this.memoryCache.size > 200) {
        const oldest = this.memoryCache.keys().next().value;
        if (oldest) this.memoryCache.delete(oldest);
      }
      this.memoryCache.set(key, { data, expiry: Date.now() + ttlSeconds * 1000 });
    }
  }

  async del(key: string): Promise<void> {
    if (this.ready && this.client) {
      try { await this.client.del(key); } catch { /* ignore */ }
    }
    this.memoryCache.delete(key);
  }

  async delPattern(pattern: string): Promise<void> {
    if (this.ready && this.client) {
      try {
        const keys = await this.client.keys(pattern);
        if (keys.length > 0) await this.client.del(...keys);
      } catch { /* ignore */ }
    }
    for (const key of this.memoryCache.keys()) {
      if (key.includes(pattern.replace('*', ''))) this.memoryCache.delete(key);
    }
  }

  async quit(): Promise<void> {
    if (this.client) {
      try { await this.client.quit(); } catch { /* ignore */ }
    }
    this.memoryCache.clear();
  }

  get isReady(): boolean {
    return this.ready;
  }
}

export const redisCache = new RedisCacheService();
