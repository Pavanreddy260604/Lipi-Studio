import axios from 'axios';

function truncate(text: string, max = 60): string {
    return text.length > max ? text.slice(0, max) + '...' : text;
}

export class VoyageEmbeddingService {
    private apiKey: string;
    private model: string;
    private queue: Array<{ text: string; resolve: (val: number[]) => void; reject: (err: any) => void }> = [];
    private processing = false;
    private lastRequest = 0;
    private readonly minInterval = 20000;
    private totalSent = 0;
    private totalErrors = 0;

    constructor() {
        this.apiKey = process.env.VOYAGE_API_KEY || '';
        this.model = process.env.VOYAGE_EMBED_MODEL || 'voyage-3';
        if (this.apiKey) {
            console.log(`  └ Voyage:  model=${this.model}, key=${this.apiKey.slice(0, 8)}..., limit=3 req/min`);
        }
    }

    async generateEmbedding(text: string, retries = 2): Promise<number[]> {
        if (!this.apiKey) throw new Error('VOYAGE_API_KEY not configured');
        return this.enqueue(text, retries);
    }

    private enqueue(text: string, retries: number): Promise<number[]> {
        return new Promise((resolve, reject) => {
            this.queue.push({
                text,
                resolve,
                reject: (err: any) => {
                    if (retries > 0) {
                        const preview = truncate(text);
                        console.log(`     ⟳ Voyage retry ${retries} left for "${preview}"`);
                        this.enqueue(text, retries - 1).then(resolve).catch(reject);
                    } else {
                        reject(err);
                    }
                }
            });
            this.processQueue();
        });
    }

    private async processQueue() {
        if (this.processing || this.queue.length === 0) return;
        this.processing = true;

        const now = Date.now();
        const elapsed = now - this.lastRequest;
        if (elapsed < this.minInterval) {
            const wait = this.minInterval - elapsed;
            console.log(`     ⏳ Voyage rate limit: waiting ${(wait / 1000).toFixed(0)}s (queue: ${this.queue.length})`);
            await new Promise(r => setTimeout(r, wait));
        }

        const item = this.queue.shift();
        if (!item) { this.processing = false; return; }

        const preview = truncate(item.text);
        try {
            this.totalSent++;
            const embedding = await this.callVoyage(item.text);
            this.lastRequest = Date.now();
            console.log(`     ✓ Voyage #${this.totalSent}  "${preview}"  (${embedding.length} dims, queue: ${this.queue.length})`);
            item.resolve(embedding);
        } catch (err: any) {
            this.totalErrors++;
            console.log(`     ✗ Voyage #${this.totalSent}  "${preview}"  — ${err.message}`);
            item.reject(err);
        }

        this.processing = false;
        this.processQueue();
    }

    private async callVoyage(text: string): Promise<number[]> {
        const response = await axios.post('https://api.voyageai.com/v1/embeddings', {
            input: text,
            model: this.model,
        }, {
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json',
            },
        });
        const embedding = response.data.data?.[0]?.embedding;
        if (!embedding || !Array.isArray(embedding)) {
            throw new Error('Invalid Voyage embedding response');
        }
        return embedding;
    }
}

export const voyageEmbeddingService = new VoyageEmbeddingService();
