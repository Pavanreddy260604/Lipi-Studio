import {
    Settings,
    Document
} from "llamaindex";
import * as dotenv from 'dotenv';
import crypto from 'crypto';
import { embeddingCache } from './embeddingCache.service.js';

dotenv.config();

function truncate(text: string, max = 60): string {
    return text.length > max ? text.slice(0, max) + '...' : text;
}

export class LlamaIndexService {
    private static instance: LlamaIndexService;
    private readonly modelName = "BAAI/bge-m3";

    private constructor() {
        (Settings as any).embedModel = {
            getTextEmbedding: (text: string) => this.getEmbedding(text),
            getQueryEmbedding: (query: string) => this.getEmbedding(query),
        };

        console.log(`\n╔══ Embedding Engine ─────────────────────────╗`);
        console.log(`  Chain:    Gemini → Voyage → Fallback (hash)`);
        console.log(`  Gemini:   ${process.env.GEMINI_API_KEY ? '✓ key set' : '✗ no key'}`);
        console.log(`  Voyage:   ${process.env.VOYAGE_API_KEY ? '✓ key set' : '✗ no key'} (3 RPM)`);
        console.log(`  Local:    DISABLED (cloud only)`);
        console.log(`╚══════════════════════════════════════════════╝\n`);

        void this.getEmbedding("Warmup embedding engine.").catch(() => {});
    }

    public static getInstance(): LlamaIndexService {
        if (!LlamaIndexService.instance) {
            LlamaIndexService.instance = new LlamaIndexService();
        }
        return LlamaIndexService.instance;
    }

    async getEmbedding(text: string): Promise<number[]> {
        const preview = truncate(text);
        const t0 = Date.now();

        // 0. Cache check (avoids API calls entirely)
        const cached = embeddingCache.get(text);
        if (cached) {
            console.log(`  ○ Cache   ${preview}  (${cached.length} dims)`);
            return cached;
        }

        // 1. Gemini (3072 dims)
        try {
            const { geminiService } = await import("./gemini/index.js");
            const embedding = await geminiService.generateEmbedding(text);
            const ms = Date.now() - t0;
            const normalized = this.normalize(embedding);
            embeddingCache.set(text, normalized);
            console.log(`  ✓ Gemini  ${preview}  (${ms}ms, ${normalized.length} dims)`);
            return normalized;
        } catch (error: any) {
            const ms = Date.now() - t0;
            console.log(`  ✗ Gemini  ${preview}  (${ms}ms) — ${error.message}`);
        }

        // 2. Deterministic fallback (3072 dims — matches Gemini for Qdrant consistency)
        const ms = Date.now() - t0;
        const fallback = this.generateDeterministicFallback(text, 3072);
        console.log(`  ⚠ Hash   ${preview}  (${ms}ms, ${fallback.length} dims) — Gemini failed`);
        return fallback;
    }

    async getEmbeddingsBatch(texts: string[]): Promise<number[][]> {
        if (texts.length === 0) return [];
        const t0 = Date.now();

        const results = new Array<number[]>(texts.length);
        const cacheMissIndexes: number[] = [];
        const cacheMissTexts: string[] = [];

        // 1. Check cache first
        for (let i = 0; i < texts.length; i++) {
            const text = texts[i];
            const cached = embeddingCache.get(text);
            if (cached) {
                results[i] = cached;
            } else {
                cacheMissIndexes.push(i);
                cacheMissTexts.push(text);
            }
        }

        if (cacheMissTexts.length === 0) {
            if (process.env.NODE_ENV !== 'production') {
                console.log(`  ○ Cache Batch hit for all ${texts.length} items`);
            }
            return results;
        }

        // 2. Fetch all missing embeddings in a single batch from Gemini
        try {
            const { geminiService } = await import("./gemini/index.js");
            const rawEmbeddings = await geminiService.generateEmbeddingsBatch(cacheMissTexts);
            const ms = Date.now() - t0;

            for (let i = 0; i < cacheMissTexts.length; i++) {
                const text = cacheMissTexts[i];
                const originalIndex = cacheMissIndexes[i];
                const rawVector = rawEmbeddings[i];
                const normalized = this.normalize(rawVector);
                embeddingCache.set(text, normalized);
                results[originalIndex] = normalized;
            }

            if (process.env.NODE_ENV !== 'production') {
                console.log(`  ✓ Gemini Batch processed ${cacheMissTexts.length} items (${ms}ms)`);
            }
        } catch (error: any) {
            const ms = Date.now() - t0;
            console.log(`  ✗ Gemini Batch failed (${ms}ms) — ${error.message}. Falling back to single queries.`);
            // Fallback: resolve cache misses individually
            for (let i = 0; i < cacheMissTexts.length; i++) {
                const text = cacheMissTexts[i];
                const originalIndex = cacheMissIndexes[i];
                results[originalIndex] = await this.getEmbedding(text);
            }
        }

        return results;
    }

    private generateDeterministicFallback(text: string, dimension: number): number[] {
        const hash = crypto.createHash('sha256').update(text).digest();
        const vector = new Array<number>(dimension);
        for (let i = 0; i < dimension; i++) {
            const val = hash[i % hash.length];
            vector[i] = (val / 127.5) - 1.0;
        }
        return this.normalize(vector);
    }

    private normalize(vector: number[]): number[] {
        if (!Array.isArray(vector) || vector.length === 0) {
            throw new Error('Embedding vector is missing or empty.');
        }

        const finite = vector.map(value => (Number.isFinite(value) ? value : 0));
        const magnitude = Math.sqrt(finite.reduce((acc, val) => acc + val * val, 0));
        if (!(magnitude > 0)) {
            throw new Error('Embedding vector magnitude is zero after sanitization.');
        }
        return finite.map(val => val / magnitude);
    }

    async createDocument(text: string, metadata: any = {}): Promise<Document> {
        return new Document({ text, metadata });
    }
}

export const llamaindexService = LlamaIndexService.getInstance();
