import crypto from 'crypto';
import type { BuildAssistantReferencePackParams, AssistantReferencePack } from './types.js';
import { toId } from './utils.js';

export class RagCache {
    private cache = new Map<string, { result: AssistantReferencePack; timestamp: number }>();
    private maxSize = 50;
    private ttlMs = 60_000;

    getKey(params: BuildAssistantReferencePackParams): string {
        const sceneContent = params.scene
            ? `${params.scene.summary || ''}|${params.scene.goal || ''}|${(params.currentContent || '').slice(0, 200)}`
            : '';
        const key = [
            params.instruction,
            toId(params.bible?._id) || '',
            params.language,
            params.mode,
            params.target,
            params.lite ? 'lite' : 'full',
            sceneContent
        ].join('|');
        return crypto.createHash('sha256').update(key).digest('hex').slice(0, 16);
    }

    get(key: string): AssistantReferencePack | undefined {
        const cached = this.cache.get(key);
        if (cached && Date.now() - cached.timestamp < this.ttlMs) {
            return cached.result;
        }
        return undefined;
    }

    set(key: string, result: AssistantReferencePack): void {
        if (this.cache.size >= this.maxSize) {
            const oldest = this.cache.keys().next().value;
            if (oldest) this.cache.delete(oldest);
        }
        this.cache.set(key, { result, timestamp: Date.now() });
    }
}
