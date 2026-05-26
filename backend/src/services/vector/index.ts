import { QdrantVectorStore } from "@llamaindex/qdrant";
import { QdrantClient } from "@qdrant/js-client-rest";
import { llamaindexService } from "../llamaindex.service";
import { VectorNodeDTO } from "../../types/vector.types";
import { ScoredSample, FindSimilarOptions, toQdrantId, fromQdrantId } from "./types.js";
import { findSimilarSamplesImpl, isSemanticallyDuplicateImpl } from "./findSimilar.js";

async function withTimeout<T>(promise: Promise<T>, ms: number, errorMessage = 'Operation timed out'): Promise<T> {
    let timeoutId: NodeJS.Timeout;
    const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error(errorMessage)), ms);
    });
    try {
        return await Promise.race([promise, timeoutPromise]);
    } finally {
        clearTimeout(timeoutId!);
    }
}


export class VectorService {
    private vectorStore: QdrantVectorStore | null = null;
    private client: QdrantClient | null = null;
    private collectionVectorSize: number | null = null;
    private lastDimensionWarningKey: string | null = null;
    private static readonly COLLECTION_NAME = "voice_samples";

    private async ensureStore() {
        if (this.vectorStore && this.client) return;
        const _service = llamaindexService;
        const qdrantUrl = process.env.QDRANT_URL || "http://localhost:6333";
        const qdrantApiKey = process.env.QDRANT_API_KEY || undefined;
        this.client = new QdrantClient({ url: qdrantUrl, apiKey: qdrantApiKey });
        this.vectorStore = new QdrantVectorStore({
            url: qdrantUrl, apiKey: qdrantApiKey, collectionName: VectorService.COLLECTION_NAME
        });
        if (process.env.NODE_ENV !== 'production') {
            console.log(`[VectorService] Qdrant client and store initialized for collection: ${VectorService.COLLECTION_NAME} at ${qdrantUrl}`);
        }
        // Ensure payload indexes exist on the live collection (idempotent, safe to call on every start)
        await this.ensurePayloadIndexes();
    }

    /**
     * Creates keyword payload indexes required for filtered deletions.
     * Qdrant requires an index on any field used in a filter condition.
     * This is idempotent — creating an index that already exists is a no-op.
     */
    private async ensurePayloadIndexes(): Promise<void> {
        if (!this.client) return;
        const KEYWORD_FIELDS = ['masterScriptId', 'bibleId', 'scriptVersion', 'source', 'characterId'];
        try {
            // Check if collection exists before trying to create indexes
            await this.client.getCollection(VectorService.COLLECTION_NAME);
            for (const field of KEYWORD_FIELDS) {
                try {
                    await this.client.createPayloadIndex(VectorService.COLLECTION_NAME, {
                        field_name: field,
                        field_schema: 'keyword',
                        wait: true,
                    });
                } catch (indexErr: any) {
                    // Ignore "already exists" errors — Qdrant returns 400 if index is already present
                    if (indexErr?.status !== 400) throw indexErr;
                }
            }
        } catch (err: any) {
            // Collection doesn't exist yet — indexes will be created after first upsert creates it
            if (err?.status === 404 || err?.message?.includes('Not found')) return;
            console.error('[VectorService] Failed to ensure payload indexes:', err?.message || err);
        }
    }

    private extractVectorSize(collectionInfo: any): number | null {
        const vectors = collectionInfo?.config?.params?.vectors || collectionInfo?.result?.config?.params?.vectors;
        const size = vectors?.size ?? vectors?.size?.value;
        return Number.isFinite(Number(size)) ? Number(size) : null;
    }

    private async getCollectionVectorSize(): Promise<number | null> {
        if (this.collectionVectorSize) return this.collectionVectorSize;
        if (!this.client) return null;
        try {
            const collection = await this.client.getCollection(VectorService.COLLECTION_NAME);
            this.collectionVectorSize = this.extractVectorSize(collection);
            return this.collectionVectorSize;
        } catch (err: any) {
            if (err?.status === 404 || err?.message?.includes('Not found')) return null;
            throw err;
        }
    }

    private async canQueryEmbedding(queryEmbedding: number[]): Promise<boolean> {
        if (!Array.isArray(queryEmbedding) || queryEmbedding.length === 0) return false;
        const collectionSize = await this.getCollectionVectorSize();
        if (!collectionSize || collectionSize === queryEmbedding.length) return true;

        const warningKey = `${collectionSize}->${queryEmbedding.length}`;
        if (this.lastDimensionWarningKey !== warningKey) {
            this.lastDimensionWarningKey = warningKey;
            console.warn(
                `[VectorService] Skipping Qdrant search: collection "${VectorService.COLLECTION_NAME}" uses ` +
                `${collectionSize}-dim vectors, but the current embedding query is ${queryEmbedding.length}-dim. ` +
                `Reindex vectors with the current embedding model or configure the embedding provider to match the collection.`
            );
        }
        return false;
    }

    async upsertSample(node: VectorNodeDTO): Promise<void> {
        await this.ensureStore();
        if (!this.client) throw new Error("Qdrant client not initialized");
        if (!node.embedding || node.embedding.length === 0) throw new Error("Sample embedding is missing or empty");

        const metadata: any = {
            bibleId: node.metadata.bibleId || "GLOBAL",
            source: node.metadata.source ?? "unknown",
        };
        if (node.metadata.characterId) metadata.characterId = node.metadata.characterId;
        if (node.metadata.speaker) metadata.speaker = node.metadata.speaker;
        if (node.metadata.era) metadata.era = node.metadata.era;
        if (node.metadata.language) metadata.language = node.metadata.language;
        if (node.metadata.tactic) metadata.tactic = node.metadata.tactic;
        if (node.metadata.emotion) metadata.emotion = node.metadata.emotion;
        if (node.metadata.masterScriptId) metadata.masterScriptId = node.metadata.masterScriptId;
        if (node.metadata.chunkType) metadata.chunkType = node.metadata.chunkType;
        if (node.metadata.contentHash) metadata.contentHash = node.metadata.contentHash;
        if (node.metadata.parentNodeId) metadata.parentNodeId = node.metadata.parentNodeId;
        if (node.metadata.isHierarchicalNode !== undefined) metadata.isHierarchicalNode = node.metadata.isHierarchicalNode;
        if (node.metadata.tags && node.metadata.tags.length > 0) metadata.tags = node.metadata.tags.join(',');
        if (node.metadata.scriptVersion) metadata.scriptVersion = node.metadata.scriptVersion;
        if (node.metadata.parserVersion) metadata.parserVersion = node.metadata.parserVersion;
        if (node.metadata.chunkId) metadata.chunkId = node.metadata.chunkId;
        if (node.metadata.sceneSeq !== undefined) metadata.sceneSeq = node.metadata.sceneSeq;
        if (node.metadata.elementSeq !== undefined) metadata.elementSeq = node.metadata.elementSeq;
        if (node.metadata.elementType) metadata.elementType = node.metadata.elementType;
        if (node.metadata.sourceStartLine !== undefined) metadata.sourceStartLine = node.metadata.sourceStartLine;
        if (node.metadata.sourceEndLine !== undefined) metadata.sourceEndLine = node.metadata.sourceEndLine;
        if (node.metadata.dualDialogue !== undefined) metadata.dualDialogue = node.metadata.dualDialogue;
        if (node.metadata.sceneNumber) metadata.sceneNumber = node.metadata.sceneNumber;
        if (node.metadata.nonPrinting !== undefined) metadata.nonPrinting = node.metadata.nonPrinting;
        if (node.metadata.sourceLineIds && node.metadata.sourceLineIds.length > 0) metadata.sourceLineIds = node.metadata.sourceLineIds.join(',');
        if (node.metadata.ingestState) metadata.ingestState = node.metadata.ingestState;
        metadata.text = node.content;

        try {
            const existing = await this.client.getCollection(VectorService.COLLECTION_NAME) as any;
            const cfg = existing.config || existing.result?.config || {};
            const existingDim = cfg.params?.vectors?.size || cfg.params?.vectors?.size?.value;
            const newDim = node.embedding.length;
            if (existingDim && existingDim !== newDim) {
                const errorMessage = `[VectorService] Dimension mismatch: cannot upsert a ${newDim}-dimension vector into a collection with ${existingDim}-dimension vectors. Please re-index your data or use a different collection.`;
                console.error(errorMessage);
                throw new Error(errorMessage);
            }
        } catch (err: any) {
            if (err.status === 404 || err.message?.includes('Not found')) {
                console.log(`[VectorService] Creating collection ${VectorService.COLLECTION_NAME} in Qdrant (${node.embedding.length} dims)...`);
                await this.client.createCollection(VectorService.COLLECTION_NAME, {
                    vectors: { size: node.embedding.length, distance: "Cosine" }
                });
                this.collectionVectorSize = node.embedding.length;
                this.lastDimensionWarningKey = null;
                await this.ensurePayloadIndexes();
            } else {
                throw err;
            }
        }

        await this.client.upsert(VectorService.COLLECTION_NAME, {
            wait: true,
            points: [{ id: toQdrantId(node.id), vector: Array.from(node.embedding), payload: { ...metadata, _mongoId: node.id } }]
        });
    }

    async upsertSamplesBatch(nodes: VectorNodeDTO[]): Promise<void> {
        if (nodes.length === 0) return;
        await this.ensureStore();
        if (!this.client) throw new Error("Qdrant client not initialized");

        // 1. Validate nodes and embeddings
        for (const node of nodes) {
            if (!node.embedding || node.embedding.length === 0) {
                throw new Error(`Sample embedding is missing or empty for node ID: ${node.id}`);
            }
        }

        // 2. Validate/ensure collection exists and matches dimension
        const targetDim = nodes[0].embedding.length;
        try {
            const existing = await this.client.getCollection(VectorService.COLLECTION_NAME) as any;
            const cfg = existing.config || existing.result?.config || {};
            const existingDim = cfg.params?.vectors?.size || cfg.params?.vectors?.size?.value;
            if (existingDim && existingDim !== targetDim) {
                const errorMessage = `[VectorService] Dimension mismatch: cannot upsert a ${targetDim}-dimension vector into a collection with ${existingDim}-dimension vectors. Please re-index your data or use a different collection.`;
                console.error(errorMessage);
                throw new Error(errorMessage);
            }
        } catch (err: any) {
            if (err.status === 404 || err.message?.includes('Not found')) {
                console.log(`[VectorService] Creating collection ${VectorService.COLLECTION_NAME} in Qdrant (${targetDim} dims)...`);
                await this.client.createCollection(VectorService.COLLECTION_NAME, {
                    vectors: { size: targetDim, distance: "Cosine" }
                });
                this.collectionVectorSize = targetDim;
                this.lastDimensionWarningKey = null;
                await this.ensurePayloadIndexes();
            } else {
                throw err;
            }
        }

        // 3. Map all nodes to points
        const points = nodes.map(node => {
            const metadata: any = {
                bibleId: node.metadata.bibleId || "GLOBAL",
                source: node.metadata.source ?? "unknown",
            };
            if (node.metadata.characterId) metadata.characterId = node.metadata.characterId;
            if (node.metadata.speaker) metadata.speaker = node.metadata.speaker;
            if (node.metadata.era) metadata.era = node.metadata.era;
            if (node.metadata.language) metadata.language = node.metadata.language;
            if (node.metadata.tactic) metadata.tactic = node.metadata.tactic;
            if (node.metadata.emotion) metadata.emotion = node.metadata.emotion;
            if (node.metadata.masterScriptId) metadata.masterScriptId = node.metadata.masterScriptId;
            if (node.metadata.chunkType) metadata.chunkType = node.metadata.chunkType;
            if (node.metadata.contentHash) metadata.contentHash = node.metadata.contentHash;
            if (node.metadata.parentNodeId) metadata.parentNodeId = node.metadata.parentNodeId;
            if (node.metadata.isHierarchicalNode !== undefined) metadata.isHierarchicalNode = node.metadata.isHierarchicalNode;
            if (node.metadata.tags && node.metadata.tags.length > 0) metadata.tags = node.metadata.tags.join(',');
            if (node.metadata.scriptVersion) metadata.scriptVersion = node.metadata.scriptVersion;
            if (node.metadata.parserVersion) metadata.parserVersion = node.metadata.parserVersion;
            if (node.metadata.chunkId) metadata.chunkId = node.metadata.chunkId;
            if (node.metadata.sceneSeq !== undefined) metadata.sceneSeq = node.metadata.sceneSeq;
            if (node.metadata.elementSeq !== undefined) metadata.elementSeq = node.metadata.elementSeq;
            if (node.metadata.elementType) metadata.elementType = node.metadata.elementType;
            if (node.metadata.sourceStartLine !== undefined) metadata.sourceStartLine = node.metadata.sourceStartLine;
            if (node.metadata.sourceEndLine !== undefined) metadata.sourceEndLine = node.metadata.sourceEndLine;
            if (node.metadata.dualDialogue !== undefined) metadata.dualDialogue = node.metadata.dualDialogue;
            if (node.metadata.sceneNumber) metadata.sceneNumber = node.metadata.sceneNumber;
            if (node.metadata.nonPrinting !== undefined) metadata.nonPrinting = node.metadata.nonPrinting;
            if (node.metadata.sourceLineIds && node.metadata.sourceLineIds.length > 0) metadata.sourceLineIds = node.metadata.sourceLineIds.join(',');
            if (node.metadata.ingestState) metadata.ingestState = node.metadata.ingestState;
            metadata.text = node.content;

            return {
                id: toQdrantId(node.id),
                vector: Array.from(node.embedding),
                payload: { ...metadata, _mongoId: node.id }
            };
        });

        // 4. Batch upsert points
        await this.client.upsert(VectorService.COLLECTION_NAME, {
            wait: true,
            points
        });
    }

    async findSimilarSamples(
        bibleId: string, queryEmbedding: number[], limit?: number,
        characterIds?: string[], options?: FindSimilarOptions
    ): Promise<ScoredSample[]> {
        await this.ensureStore();
        if (!this.client) return [];
        if (!(await this.canQueryEmbedding(queryEmbedding))) return [];
        try {
            return await findSimilarSamplesImpl(this.client, VectorService.COLLECTION_NAME, bibleId, queryEmbedding, limit, characterIds, options);
        } catch (err: any) {
            console.error('[VectorService] Qdrant query error:', err.message || err);
            return [];
        }
    }

    private async deletePoints(filter: any): Promise<void> {
        try {
            await withTimeout(
                (async () => {
                    await this.ensureStore();
                    if (!this.client) return;
                    await this.client.delete(VectorService.COLLECTION_NAME, filter);
                })(),
                3000,
                'Qdrant deletePoints timed out'
            );
        } catch (err: any) {
            if (err?.status !== 404) {
                console.warn(`[VectorService] deletePoints failed or timed out: ${err.message || err}`);
            }
        }
    }

    async deleteSample(sampleId: string): Promise<void> {
        await this.deletePoints({ points: [toQdrantId(sampleId)] });
    }

    async deleteSamplesByIds(sampleIds: string[]): Promise<void> {
        if (sampleIds.length === 0) return;
        await this.deletePoints({ points: sampleIds.map(toQdrantId) });
        if (process.env.NODE_ENV !== 'production') console.log(`[VectorService] Deleted ${sampleIds.length} vectors from Qdrant by IDs`);
    }

    async deleteSamplesBySource(bibleId: string, source: string, characterId?: string): Promise<void> {
        const must: any[] = [
            { key: "bibleId", match: { value: bibleId } },
            { key: "source", match: { value: source } }
        ];
        if (characterId) must.push({ key: "characterId", match: { value: characterId } });
        await this.deletePoints({ filter: { must } });
        if (process.env.NODE_ENV !== 'production') console.log(`[VectorService] Deleted vectors by source="${source}" in bible="${bibleId}"`);
    }

    async deleteSamplesByBibleId(bibleId: string): Promise<void> {
        await this.deletePoints({ filter: { must: [{ key: "bibleId", match: { value: bibleId } }] } });
        if (process.env.NODE_ENV !== 'production') console.log(`[VectorService] Deleted Qdrant vectors for bible: ${bibleId}`);
    }

    async deleteSamplesByMasterScriptId(masterScriptId: string): Promise<void> {
        await this.deletePoints({ filter: { must: [{ key: "masterScriptId", match: { value: masterScriptId } }] } });
        if (process.env.NODE_ENV !== 'production') console.log(`[VectorService] Deleted Qdrant vectors for master script: ${masterScriptId}`);
    }

    async deleteSamplesByMasterScriptVersion(masterScriptId: string, scriptVersion: string): Promise<void> {
        await this.deletePoints({
            filter: { must: [
                { key: "masterScriptId", match: { value: masterScriptId } },
                { key: "scriptVersion", match: { value: scriptVersion } }
            ]}
        });
        if (process.env.NODE_ENV !== 'production') console.log(`[VectorService] Deleted Qdrant vectors for master script ${masterScriptId} version ${scriptVersion}`);
    }

    async isSemanticallyDuplicate(
        scopeId: string, embedding: number[], threshold?: number,
        scopeType?: 'bibleId' | 'masterScriptId'
    ): Promise<boolean> {
        await this.ensureStore();
        if (!this.client) return false;
        return isSemanticallyDuplicateImpl(this.client, VectorService.COLLECTION_NAME, scopeId, embedding, threshold, scopeType);
    }

    async getStats(): Promise<{ count: number }> {
        try {
            return await withTimeout(
                (async () => {
                    await this.ensureStore();
                    if (this.client) {
                        const info = await this.client.getCollection(VectorService.COLLECTION_NAME);
                        return { count: info.points_count || 0 };
                    }
                    return { count: 0 };
                })(),
                2000,
                'Qdrant getStats timed out'
            );
        } catch {
            return { count: 0 };
        }
    }
}

export const vectorService = new VectorService();
export type { ScoredSample, FindSimilarOptions };
