import axios from 'axios';

export class HuggingFaceEmbeddingService {
    private readonly baseUrl = process.env.HF_INFERENCE_API_URL || 'https://api-inference.huggingface.co/models';
    private readonly model = process.env.HF_EMBED_MODEL || process.env.HUGGINGFACE_EMBED_MODEL || 'BAAI/bge-m3';
    private readonly apiToken = process.env.HF_API_TOKEN || process.env.HUGGINGFACE_API_TOKEN || '';
    private readonly timeoutMs = this.parsePositiveInt(process.env.HF_EMBED_TIMEOUT_MS, 60_000);
    private readonly maxRetries = this.parsePositiveInt(process.env.HF_EMBED_MAX_RETRIES, 4);

    async generateEmbedding(text: string): Promise<number[]> {
        let lastError: unknown;

        for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
            try {
                const response = await axios.post(
                    `${this.baseUrl}/${encodeURIComponent(this.model)}`,
                    {
                        inputs: text,
                        options: {
                            wait_for_model: true,
                            use_cache: true
                        }
                    },
                    {
                        timeout: this.timeoutMs,
                        headers: this.buildHeaders()
                    }
                );

                return this.extractEmbedding(response.data);
            } catch (error: any) {
                lastError = error;
                const status = axios.isAxiosError(error) ? error.response?.status : undefined;
                const message = this.extractErrorMessage(error);
                console.warn(`[HuggingFaceEmbedding] Attempt ${attempt}/${this.maxRetries} failed: ${message}`);

                if (status === 401 || status === 403) {
                    throw new Error('Hugging Face authentication failed. Set HF_API_TOKEN with Inference API access.');
                }

                if (status === 400) {
                    throw new Error(`Hugging Face rejected embedding request: ${message}`);
                }

                const isRetryable = status === 429 || status === 503 || status === 504 || status === undefined;
                if (!isRetryable || attempt >= this.maxRetries) {
                    break;
                }

                await this.wait(300 * attempt);
            }
        }

        throw new Error(`Hugging Face embedding failed after retries: ${this.extractErrorMessage(lastError)}`);
    }

    private buildHeaders(): Record<string, string> {
        const headers: Record<string, string> = {
            'Content-Type': 'application/json'
        };
        if (this.apiToken) {
            headers.Authorization = `Bearer ${this.apiToken}`;
        }
        return headers;
    }

    private extractEmbedding(data: unknown): number[] {
        // Common shape: [number, number, ...]
        if (Array.isArray(data) && data.every(v => typeof v === 'number')) {
            return data as number[];
        }

        // Token matrix shape: [[...], [...], ...] -> mean pool across tokens.
        if (Array.isArray(data) && data.length > 0 && Array.isArray(data[0])) {
            const matrix = data as unknown[];
            if (matrix.every(row => Array.isArray(row) && (row as unknown[]).every(v => typeof v === 'number'))) {
                return this.meanPool(matrix as number[][]);
            }
        }

        // Some providers wrap vector payloads.
        if (data && typeof data === 'object') {
            const maybeObj = data as Record<string, unknown>;
            const embedding = maybeObj.embedding;
            if (Array.isArray(embedding) && embedding.every(v => typeof v === 'number')) {
                return embedding as number[];
            }
        }

        throw new Error('Unexpected Hugging Face embedding response shape.');
    }

    private meanPool(matrix: number[][]): number[] {
        if (!Array.isArray(matrix) || matrix.length === 0 || !Array.isArray(matrix[0]) || matrix[0].length === 0) {
            throw new Error('Cannot pool empty token embedding matrix.');
        }

        const dims = matrix[0].length;
        const sum = new Array<number>(dims).fill(0);

        for (const row of matrix) {
            if (row.length !== dims) {
                throw new Error('Inconsistent token embedding dimensions from Hugging Face response.');
            }
            for (let i = 0; i < dims; i++) {
                sum[i] += row[i];
            }
        }

        return sum.map(v => v / matrix.length);
    }

    private extractErrorMessage(error: unknown): string {
        if (axios.isAxiosError(error)) {
            const payload = error.response?.data;
            if (typeof payload === 'string' && payload.trim()) {
                return payload;
            }
            if (payload && typeof payload === 'object') {
                const p = payload as Record<string, unknown>;
                if (typeof p.error === 'string' && p.error.trim()) {
                    return p.error;
                }
                try {
                    return JSON.stringify(payload);
                } catch {
                    // Ignore serialization failure and continue.
                }
            }
            if (typeof error.message === 'string' && error.message.trim()) {
                return error.message;
            }
        }

        if (typeof (error as any)?.message === 'string' && (error as any).message.trim()) {
            return (error as any).message;
        }

        return 'Unknown Hugging Face embedding error';
    }

    private parsePositiveInt(raw: string | undefined, fallback: number): number {
        const parsed = Number(raw);
        if (!Number.isFinite(parsed) || parsed <= 0) {
            return fallback;
        }
        return Math.floor(parsed);
    }

    private async wait(ms: number): Promise<void> {
        await new Promise(resolve => setTimeout(resolve, ms));
    }
}

export const huggingFaceEmbeddingService = new HuggingFaceEmbeddingService();
