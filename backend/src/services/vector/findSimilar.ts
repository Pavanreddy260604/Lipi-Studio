import { QdrantClient } from "@qdrant/js-client-rest";
import { VoiceSample } from "../../models/VoiceSample";
import { ScoredSample, FindSimilarOptions, fromQdrantId } from "./types.js";

export async function findSimilarSamplesImpl(
    client: QdrantClient,
    collectionName: string,
    bibleId: string,
    queryEmbedding: number[],
    limit: number = 5,
    characterIds?: string[],
    options?: FindSimilarOptions
): Promise<ScoredSample[]> {
    const normalizedCharacterIds = Array.from(new Set((characterIds || []).filter(Boolean)));
    const characterIdSet = normalizedCharacterIds.length > 0 ? new Set(normalizedCharacterIds) : null;

    const mustClauses: any[] = [];
    const filterKey = options?.scopeType || 'bibleId';

    if (bibleId !== "ALL") {
        mustClauses.push({ key: filterKey, match: { value: bibleId } });
    }
    if (!options?.includeHierarchicalNodes) {
        mustClauses.push({ key: "isHierarchicalNode", match: { value: false } });
    }
    if (options?.era) mustClauses.push({ key: "era", match: { value: options.era } });
    if (options?.language) mustClauses.push({ key: "language", match: { value: options.language } });
    if (options?.scriptVersion) mustClauses.push({ key: "scriptVersion", match: { value: options.scriptVersion } });
    if (options?.ingestState) mustClauses.push({ key: "ingestState", match: { value: options.ingestState } });
    const shouldClauses: any[] = [];
    if (options?.allowedScopeIds?.length) {
        shouldClauses.push(...options.allowedScopeIds.map(id => ({ key: filterKey, match: { value: id } })));
    }

    const baseTopK = Math.max(20, limit * 3);
    const similarityTopK = characterIdSet ? Math.max(baseTopK * 4, limit * 10, 80) : baseTopK;

    let queryResult: any[] = [];
    try {
        const response = await client.search(collectionName, {
            vector: Array.from(queryEmbedding),
            filter: mustClauses.length > 0 || shouldClauses.length > 0
                ? {
                    ...(mustClauses.length > 0 ? { must: mustClauses } : {}),
                    ...(shouldClauses.length > 0 ? { should: shouldClauses } : {})
                }
                : undefined,
            limit: similarityTopK,
            with_payload: true,
            with_vector: false
        });
        queryResult = response;
    } catch (err: any) {
        const isCollectionMissing = err?.status === 404 || err?.data?.status?.error?.includes("doesn't exist");
        if (!isCollectionMissing && process.env.NODE_ENV !== 'production') {
            console.warn(`[VectorService] Qdrant query error: ${err?.message || err}`);
        }
        return [];
    }

    if (queryResult.length === 0) return [];

    const scoredIds: { id: string; score: number; meta: any }[] = [];
    let minSimilarity = options?.minSimilarity ?? 0.5;
    if (bibleId !== "ALL" && options?.scopeType !== 'masterScriptId') {
        minSimilarity = Math.min(minSimilarity, 0.32);
    }

    for (const point of queryResult) {
        const similarity = point.score;
        if (similarity < minSimilarity) continue;

        const id = (point.payload as any)?._mongoId || fromQdrantId(point.id.toString());
        const meta = point.payload || {};
        const metaCharacterId = typeof meta.characterId === 'string' ? meta.characterId : meta.characterId?.toString?.();

        if (characterIdSet && (!metaCharacterId || !characterIdSet.has(metaCharacterId))) continue;

        let score = similarity;
        if (options?.interests) {
            const source = (meta.source || '').toUpperCase();
            if (options.interests.directors.some(d => source.includes(d.toUpperCase()))) score += 0.15;
        }
        scoredIds.push({ id, score, meta });
    }

    scoredIds.sort((a, b) => b.score - a.score);
    const fetchCount = options?.dedupe || options?.maxLength
        ? Math.max(limit * 3, limit + 10) : limit;
    const topIds = scoredIds.slice(0, fetchCount);

    if (topIds.length === 0) return [];

    const mongoQuery: Record<string, unknown> = { _id: { $in: topIds.map(t => t.id) } };
    if (characterIdSet) mongoQuery.characterId = { $in: Array.from(characterIdSet) };

    const samples = await VoiceSample.find(mongoQuery);
    const sampleMap = new Map(samples.map(s => [s._id.toString(), s]));

    let scoredSamples: ScoredSample[] = topIds
        .map(t => {
            const sample = sampleMap.get(t.id);
            if (!sample) return null;
            const obj = sample.toObject();
            return {
                _id: obj._id.toString(),
                bibleId: obj.bibleId?.toString(),
                characterId: obj.characterId?.toString(),
                content: obj.content,
                contentHash: obj.contentHash,
                speaker: obj.speaker,
                era: obj.era,
                tactic: obj.tactic,
                emotion: obj.emotion,
                masterScriptId: obj.masterScriptId?.toString(),
                chunkType: obj.chunkType,
                chunkIndex: obj.chunkIndex,
                tags: obj.tags,
                source: obj.source,
                parentNodeId: obj.parentNodeId?.toString(),
                isHierarchicalNode: obj.isHierarchicalNode,
                scriptVersion: obj.scriptVersion,
                parserVersion: obj.parserVersion,
                chunkId: obj.chunkId,
                sceneSeq: (obj as any).sceneSeq,
                elementSeq: (obj as any).elementSeq,
                elementType: (obj as any).elementType,
                sourceStartLine: (obj as any).sourceStartLine,
                sourceEndLine: (obj as any).sourceEndLine,
                sourceLineIds: (obj as any).sourceLineIds,
                dualDialogue: (obj as any).dualDialogue,
                sceneNumber: (obj as any).sceneNumber,
                nonPrinting: (obj as any).nonPrinting,
                ingestState: (obj as any).ingestState,
                similarityScore: t.score
            } as ScoredSample;
        })
        .filter(Boolean) as ScoredSample[];

    if (options?.includeParentContext) {
        const parentIds = scoredSamples
            .map((s: ScoredSample) => s.parentNodeId)
            .filter((id): id is string => !!id);
        if (parentIds.length > 0) {
            const uniqueParentIds = Array.from(new Set(parentIds));
            const parents = await VoiceSample.find({ _id: { $in: uniqueParentIds } });
            const parentMap = new Map(parents.map(p => [p._id.toString(), p.content]));
            for (const sample of scoredSamples) {
                if (sample.parentNodeId) sample.parentContent = parentMap.get(sample.parentNodeId);
            }
        }
    }

    if (options?.maxLength) {
        scoredSamples = scoredSamples.filter(s => s.content.length <= options.maxLength!);
    }

    if (options?.dedupe) {
        const seen = new Set<string>();
        scoredSamples = scoredSamples.filter(sample => {
            const fallbackKey = `${(sample.speaker || '').toLowerCase()}|${sample.content.trim().toLowerCase()}`;
            const key = sample.contentHash || fallbackKey;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    }

    return scoredSamples.slice(0, limit);
}

export async function isSemanticallyDuplicateImpl(
    client: QdrantClient,
    collectionName: string,
    scopeId: string,
    embedding: number[],
    threshold: number = 0.98,
    scopeType: 'bibleId' | 'masterScriptId' = 'bibleId'
): Promise<boolean> {
    const results = await findSimilarSamplesImpl(client, collectionName, scopeId, embedding, 1, undefined, {
        minSimilarity: threshold,
        scopeType
    });
    return results.length > 0;
}
