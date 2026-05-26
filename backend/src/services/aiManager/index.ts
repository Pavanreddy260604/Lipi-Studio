import { IAIService } from '../ai.interface';
import { ollamaService } from '../ollama.service';
import { llamaindexService } from '../llamaindex.service';
import { mistralService } from '../mistral.service';
import { geminiService } from '../gemini/index.js';
import { Settings } from 'llamaindex';
import * as fs from 'fs';
import * as path from 'path';
import crypto from 'crypto';
import { embeddingCache } from '../embeddingCache.service';
import type { AIProvider } from './types.js';
import { SCRIPT_WRITER_PATTERNS } from './types.js';

export class AIServiceManager implements IAIService {
    private activeProvider: AIProvider = (process.env.AI_PROVIDER as AIProvider) || 'gemini'; 
    private providers: Record<AIProvider, IAIService>;
    private configPath: string;
    private lastEmbeddingDimension: number = 0;
    private readonly maxEmbeddingChars = this.parsePositiveInt(process.env.EMBEDDING_MAX_CHARS, 8000);
    private readonly embeddingBackend: 'llamaindex' = 'llamaindex';
    private readonly allowSyntheticEmbeddingFallback = true;
    private activeEmbeddings = 0;
    private readonly maxConcurrentEmbeddings = 3;
    private embeddingQueue: Array<(value: void) => void> = [];

    constructor() {
        this.configPath = path.join(process.cwd(), 'ai-config.json');
        this.activeProvider = this.resolveInitialProvider();
        this.providers = {
            gemini: geminiService,
            ollama: ollamaService,
            mistral: mistralService
        };
        
        this.syncLlamaIndexSettings();
        
        if (process.env.NODE_ENV !== 'production') { console.log(`[AIServiceManager] Initialized in ${this.activeProvider} mode.`); }
    }

    private resolveInitialProvider(): AIProvider {
        try {
            const raw = fs.readFileSync(path.join(process.cwd(), 'ai-config.json'), 'utf-8');
            const parsed = JSON.parse(raw);
            if (parsed?.provider === 'gemini' || parsed?.provider === 'ollama') return parsed.provider;
        } catch {
        }

        return (process.env.AI_PROVIDER as AIProvider) || 'gemini';
    }

    private syncLlamaIndexSettings() {
        if (this.activeProvider === 'ollama') {
            (Settings as any).llm = (ollamaService as any).llm;
        }
    }

    setProvider(provider: AIProvider) {
        if (this.providers[provider]) {
            this.activeProvider = provider;
            this.syncLlamaIndexSettings();
            if (process.env.NODE_ENV !== 'production') { console.log(`[AIServiceManager] Switched to provider: ${provider}`); }
        } else {
            console.error(`[AIServiceManager] Provider '${provider}' not found. Remaining on ${this.activeProvider}.`);
        }
    }

    getProvider(): AIProvider {
        return this.activeProvider;
    }

    async chat(message: string, options?: import('../ai.interface.js').ChatOptions): Promise<string> {
        const providerKey = options?.provider || this.activeProvider;
        const provider = this.providers[providerKey];
        if (!provider) throw new Error(`Provider ${providerKey} not found`);

        try {
            return await provider.chat(message, options);
        } catch (error: any) {
            console.warn(`[AIServiceManager] ${providerKey} failed: ${error.message}. Initiating failover recovery...`);
            
            // Tier 1: Gemini fallback (if Gemini isn't the primary that failed)
            if (providerKey !== 'gemini' && this.providers.gemini) {
                try {
                    console.log(`[AIServiceManager] Failover Tier 1: Routing to Gemini...`);
                    return await this.providers.gemini.chat(message, options);
                } catch (geminiErr: any) {
                    console.error(`[AIServiceManager] Failover Tier 1 (Gemini) failed: ${geminiErr.message}`);
                }
            }

            // Tier 2: Mistral fallback (if Mistral isn't the primary that failed)
            if (providerKey !== 'mistral' && this.providers.mistral) {
                try {
                    console.log(`[AIServiceManager] Failover Tier 2: Routing to Mistral...`);
                    return await this.providers.mistral.chat(message, options);
                } catch (mistralErr: any) {
                    console.error(`[AIServiceManager] Failover Tier 2 (Mistral) failed: ${mistralErr.message}`);
                }
            }

            // Tier 3: Ollama fallback (if Ollama isn't the primary that failed)
            if (providerKey !== 'ollama' && this.providers.ollama) {
                try {
                    console.log(`[AIServiceManager] Failover Tier 3 (Offline Fallback): Routing to Ollama...`);
                    return await this.providers.ollama.chat(message, options);
                } catch (ollamaErr: any) {
                    console.error(`[AIServiceManager] Failover Tier 3 (Ollama) failed: ${ollamaErr.message}`);
                }
            }

            throw error;
        }
    }

    async *chatStream(messages: { role: string; content: string; images?: string[] }[], systemPrompt?: string, options?: import('../ai.interface.js').ChatOptions): AsyncGenerator<string, void, unknown> {
        const providerKey = options?.provider || this.activeProvider;
        const provider = this.providers[providerKey];
        if (!provider) throw new Error(`Provider ${providerKey} not found`);

        if (!provider.chatStream) {
            throw new Error(`${providerKey} provider does not support streaming`);
        }

        try {
            for await (const chunk of provider.chatStream(messages, systemPrompt, options)) {
                yield chunk;
            }
        } catch (error: any) {
            console.warn(`[AIServiceManager] Stream on ${providerKey} failed: ${error.message}. Initiating stream failover recovery...`);
            
            // Tier 1 Fallback: Gemini Stream
            if (providerKey !== 'gemini' && this.providers.gemini && this.providers.gemini.chatStream) {
                try {
                    console.log(`[AIServiceManager] Failover Stream Tier 1: Routing to Gemini...`);
                    for await (const chunk of this.providers.gemini.chatStream(messages, systemPrompt, options)) {
                        yield chunk;
                    }
                    return;
                } catch (geminiErr: any) {
                    console.error(`[AIServiceManager] Failover Stream Tier 1 (Gemini) failed: ${geminiErr.message}`);
                }
            }

            // Tier 2 Fallback: Mistral Stream
            if (providerKey !== 'mistral' && this.providers.mistral && this.providers.mistral.chatStream) {
                try {
                    console.log(`[AIServiceManager] Failover Stream Tier 2: Routing to Mistral...`);
                    for await (const chunk of this.providers.mistral.chatStream(messages, systemPrompt, options)) {
                        yield chunk;
                    }
                    return;
                } catch (mistralErr: any) {
                    console.error(`[AIServiceManager] Failover Stream Tier 2 (Mistral) failed: ${mistralErr.message}`);
                }
            }

            // Tier 3 Fallback: Ollama Stream (Offline Fallback)
            if (providerKey !== 'ollama' && this.providers.ollama && this.providers.ollama.chatStream) {
                try {
                    console.log(`[AIServiceManager] Failover Stream Tier 3 (Ollama Fallback): Routing to Ollama...`);
                    for await (const chunk of this.providers.ollama.chatStream(messages, systemPrompt, options)) {
                        yield chunk;
                    }
                    return;
                } catch (ollamaErr: any) {
                    console.error(`[AIServiceManager] Failover Stream Tier 3 (Ollama) failed: ${ollamaErr.message}`);
                }
            }

            throw error;
        }
    }

    async generateEmbedding(text: string): Promise<number[]> {
        const cached = embeddingCache.get(text);
        if (cached) return cached;
        return this.withEmbeddingSemaphore(() => this.generateEmbeddingInternal(text));
    }

    private sanitizeEmbeddingText(text: string): string {
        const input = typeof text === 'string' ? text : '';
        const cleaned = input
            .normalize('NFKC')
            .replace(/\u0000/g, ' ')
            .replace(/[\u0001-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, ' ')
            .replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/g, ' ')
            .replace(/(^|[^\uD800-\uDBFF])[\uDC00-\uDFFF]/g, '$1 ')
            .replace(/\r\n?/g, '\n')
            .replace(/[ \t]{2,}/g, ' ')
            .trim();

        if (!cleaned) return '[EMPTY_TEXT]';

        return cleaned.length > this.maxEmbeddingChars
            ? cleaned.slice(0, this.maxEmbeddingChars)
            : cleaned;
    }

    private validateAndNormalizeEmbedding(vector: number[]): number[] {
        if (!Array.isArray(vector) || vector.length === 0) {
            throw new Error('Embedding vector is missing or empty.');
        }

        const finite = vector.map(value => (Number.isFinite(value) ? value : 0));
        const magnitude = Math.sqrt(finite.reduce((acc, val) => acc + val * val, 0));
        if (!(magnitude > 0)) {
            throw new Error('Embedding vector magnitude is zero after sanitization.');
        }

        return finite.map(value => value / magnitude);
    }

    private buildDeterministicFallbackEmbedding(seed: string, dimension: number): number[] {
        const hash = crypto.createHash('sha256').update(seed).digest();
        const vector = new Array<number>(dimension);
        let state = 2166136261;

        for (let i = 0; i < dimension; i++) {
            state ^= hash[i % hash.length];
            state = Math.imul(state, 16777619);
            const unit = (state >>> 0) / 0xffffffff;
            vector[i] = unit * 2 - 1;
        }

        return this.validateAndNormalizeEmbedding(vector);
    }

    private parsePositiveInt(raw: string | undefined, fallback: number): number {
        const parsed = Number(raw);
        return (Number.isFinite(parsed) && parsed > 0) ? Math.floor(parsed) : fallback;
    }

    private async generateEmbeddingInternal(text: string): Promise<number[]> {
        const sanitized = this.sanitizeEmbeddingText(text);
        const maxRetries = this.parsePositiveInt(process.env.EMBEDDING_MAX_RETRIES, 2);
        let lastError: any;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                const embedding = await llamaindexService.getEmbedding(sanitized);
                const normalized = this.validateAndNormalizeEmbedding(embedding);
                this.lastEmbeddingDimension = normalized.length;
                embeddingCache.set(text, normalized);
                return normalized;
            } catch (error: any) {
                lastError = error;
                if (process.env.NODE_ENV !== 'production') { console.warn(`[AIServiceManager] Cloud embedding failed (attempt ${attempt}/${maxRetries}): ${error.message}`); }
                await new Promise(r => setTimeout(r, attempt * 100));
            }
        }

        const dim = this.lastEmbeddingDimension || this.parsePositiveInt(process.env.EMBEDDING_FALLBACK_DIM, 3072);
        console.error(`[AIServiceManager] Cloud embedding fatal; using deterministic fallback vector (${dim} dims).`);
        return this.buildDeterministicFallbackEmbedding(sanitized, dim);
    }

    private async withEmbeddingSemaphore<T>(work: () => Promise<T>): Promise<T> {
        if (this.activeEmbeddings < this.maxConcurrentEmbeddings) {
            this.activeEmbeddings++;
            try {
                return await work();
            } finally {
                this.activeEmbeddings--;
                this.drainQueue();
            }
        }

        return new Promise<T>((resolve, reject) => {
            const timeout = setTimeout(() => {
                const idx = this.embeddingQueue.indexOf(run);
                if (idx !== -1) this.embeddingQueue.splice(idx, 1);
                reject(new Error('Embedding semaphore timeout'));
            }, 30000);

            const run = () => {
                clearTimeout(timeout);
                this.activeEmbeddings++;
                work().then(resolve, reject).finally(() => {
                    this.activeEmbeddings--;
                    this.drainQueue();
                });
            };
            this.embeddingQueue.push(run);
        });
    }

    private drainQueue(): void {
        while (this.activeEmbeddings < this.maxConcurrentEmbeddings && this.embeddingQueue.length > 0) {
            const next = this.embeddingQueue.shift();
            if (next) next();
        }
    }
}

export const aiServiceManager = new AIServiceManager();

export type { AIProvider } from './types.js';
export { SCRIPT_WRITER_PATTERNS } from './types.js';
