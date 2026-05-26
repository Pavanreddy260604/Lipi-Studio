import { vectorService } from '../vector/index.js';
import type { EmbeddedQueryVariant, RankedCandidate } from './types.js';
import { mergeCandidates } from './merge.js';

export async function queryMasterCandidates(
    embeddedQueries: EmbeddedQueryVariant[],
    masterScriptIds: string[],
    language: string | undefined,
    languageMatched: boolean,
    sourceType?: 'screenplay' | 'literature' | 'dictionary'
): Promise<RankedCandidate[]> {
    if (masterScriptIds.length === 0) return [];

    const collected = new Map<string, RankedCandidate>();
    const results = await Promise.all(
        embeddedQueries.map((query) =>
            vectorService.findSimilarSamples('ALL', query.embedding, 16, undefined, {
                minSimilarity: languageMatched ? 0.32 : 0.25,
                maxLength: 980,
                dedupe: true,
                language: masterScriptIds.length > 0 ? undefined : (languageMatched ? language : 'English'),
                scopeType: 'masterScriptId',
                allowedScopeIds: masterScriptIds,
                includeParentContext: true,
                includeHierarchicalNodes: false
            }).then((samples) => ({ queryKey: query.key, samples }))
        )
    );

    for (const result of results) {
        mergeCandidates(collected, result.samples, result.queryKey, false, languageMatched, sourceType);
    }

    return Array.from(collected.values());
}
