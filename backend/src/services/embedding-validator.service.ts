/**
 * Embedding Validator Service
 * 
 * Validates embedding quality and monitors model performance.
 * Useful for debugging RAG issues and ensuring semantic search quality.
 */

import { llamaindexService } from './llamaindex.service';

export interface ValidationResult {
    isValid: boolean;
    semanticQuality: number;     // 0-1, how well similar/dissimilar pairs behave
    embeddingDimension: number;
    modelName: string;
    testResults: TestPairResult[];
}

export interface TestPairResult {
    pair: [string, string];
    expectedSimilarity: 'high' | 'low';
    actualSimilarity: number;
    passed: boolean;
}

// Test pairs for semantic validation
const TEST_PAIRS: { pair: [string, string]; expected: 'high' | 'low' }[] = [
    // Should be HIGH similarity
    { pair: ['I love you with all my heart', 'I adore you completely'], expected: 'high' },
    { pair: ['The car exploded in flames', 'The vehicle burst into fire'], expected: 'high' },
    { pair: ['She walked into the room slowly', 'She entered the room with hesitation'], expected: 'high' },

    // Should be LOW similarity
    { pair: ['I love you', 'The stock market crashed'], expected: 'low' },
    { pair: ['INT. COFFEE SHOP - DAY', 'quantum physics equation'], expected: 'low' },
    { pair: ['Happy birthday to you', 'The murderer hid the body'], expected: 'low' },
];

export class EmbeddingValidator {
    private modelName: string;
    public embeddingDimension: number;

    constructor() {
        this.modelName = process.env.OLLAMA_EMBED_MODEL || 'bge-m3:latest';
        this.embeddingDimension = 3072; // gemini-embedding-2 outputs 3072-dimensional vectors
    }

    /**
     * Run full validation suite on the embedding model.
     */
    async validateModel(): Promise<ValidationResult> {
        console.log(`[EmbeddingValidator] Testing model: ${this.modelName}`);

        const testResults: TestPairResult[] = [];
        let dimension = 0;

        for (const test of TEST_PAIRS) {
            try {
                const [emb1, emb2] = await Promise.all([
                    llamaindexService.getEmbedding(test.pair[0]),
                    llamaindexService.getEmbedding(test.pair[1])
                ]);

                if (dimension === 0) {
                    dimension = emb1.length;
                }

                const similarity = this.cosineSimilarity(emb1, emb2);

                // High similarity should be > 0.65, low should be < 0.45
                const passed = test.expected === 'high'
                    ? similarity > 0.65
                    : similarity < 0.45;

                testResults.push({
                    pair: test.pair,
                    expectedSimilarity: test.expected,
                    actualSimilarity: similarity,
                    passed
                });

                const status = passed ? '✓' : '✗';
                console.log(`  ${status} "${test.pair[0].slice(0, 25)}..." vs "${test.pair[1].slice(0, 25)}..." = ${similarity.toFixed(3)} (expected ${test.expected})`);

            } catch (err: any) {
                console.error(`  ✗ Failed to embed pair: ${err.message}`);
                testResults.push({
                    pair: test.pair,
                    expectedSimilarity: test.expected,
                    actualSimilarity: -1,
                    passed: false
                });
            }
        }

        const passedCount = testResults.filter(r => r.passed).length;
        const semanticQuality = passedCount / testResults.length;

        const result: ValidationResult = {
            isValid: semanticQuality >= 0.7,
            semanticQuality,
            embeddingDimension: dimension,
            modelName: this.modelName,
            testResults
        };

        console.log(`[EmbeddingValidator] Quality: ${(semanticQuality * 100).toFixed(0)}% (${passedCount}/${testResults.length} tests passed)`);
        console.log(`[EmbeddingValidator] Model ${result.isValid ? 'PASSED' : 'FAILED'} validation`);

        return result;
    }

    /**
     * Quick sanity check - just test one pair.
     */
    async quickCheck(): Promise<{ ok: boolean; similarity: number }> {
        try {
            const [emb1, emb2] = await Promise.all([
                llamaindexService.getEmbedding('Hello world'),
                llamaindexService.getEmbedding('Hi there')
            ]);

            const similarity = this.cosineSimilarity(emb1, emb2);
            return { ok: similarity > 0.5, similarity };
        } catch {
            return { ok: false, similarity: 0 };
        }
    }

    /**
     * Calculate cosine similarity between two vectors.
     */
    private cosineSimilarity(a: number[], b: number[]): number {
        if (a.length !== b.length) {
            throw new Error('Vectors must have same dimension');
        }

        let dotProduct = 0;
        let normA = 0;
        let normB = 0;

        for (let i = 0; i < a.length; i++) {
            dotProduct += a[i] * b[i];
            normA += a[i] * a[i];
            normB += b[i] * b[i];
        }

        if (normA === 0 || normB === 0) return 0;

        return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
    }
}

export const embeddingValidator = new EmbeddingValidator();
