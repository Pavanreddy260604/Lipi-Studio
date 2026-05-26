import { MasterScript } from '../../models/MasterScript.js';
import { vectorService, type FindSimilarOptions } from '../vector/index.js';
import { redisCache } from '../redisCache.service.js';
import type { BuildAssistantReferencePackParams, EmbeddedQueryVariant, RankedCandidate } from './types.js';
import { toId } from './utils.js';
import { mergeCandidates, mergeCandidateSets } from './merge.js';
import { queryMasterCandidates } from './queryMaster.js';

export async function retrieveProjectCandidates(
    embeddedQueries: EmbeddedQueryVariant[],
    params: BuildAssistantReferencePackParams
): Promise<RankedCandidate[]> {
    const bibleId = toId(params.bible?._id);
    if (!bibleId || embeddedQueries.length === 0) return [];

    const characterIds = (params.scene?.charactersInvolved || [])
        .map((value) => toId(value))
        .filter((value): value is string => !!value);

    const collected = new Map<string, RankedCandidate>();
    const baseOptions: FindSimilarOptions = {
        minSimilarity: 0.05, maxLength: 900, dedupe: true,
        language: params.language, includeParentContext: true, includeHierarchicalNodes: false
    };

    const strictPromises = characterIds.length > 0
        ? embeddedQueries.map((query) =>
            vectorService.findSimilarSamples(bibleId, query.embedding, 10, characterIds, baseOptions)
                .then((samples) => ({ queryKey: query.key, samples, strictCharacterMatch: true }))
        ) : [];

    const relaxedPromises = embeddedQueries.map((query) =>
        vectorService.findSimilarSamples(bibleId, query.embedding, 12, undefined, baseOptions)
            .then((samples) => ({ queryKey: query.key, samples, strictCharacterMatch: false }))
    );

    const results = await Promise.all([...strictPromises, ...relaxedPromises]);
    for (const result of results) {
        mergeCandidates(collected, result.samples, result.queryKey, result.strictCharacterMatch, true);
    }

    if (collected.size === 0) {
        return [{
            id: 'fallback',
            sample: {
                _id: 'fallback',
                bibleId: bibleId || 'fallback',
                content: "No relevant information found in the project's lore. Answer from your own knowledge.",
                source: 'system',
                similarityScore: 1.0,
            },
            score: 1.0,
            queryKey: 'fallback',
            matchedQueries: new Set(['fallback']),
            strictCharacterMatch: false,
            languageMatched: true,
            isProjectCandidate: true,
            sourceType: 'fallback'
        }];
    }

    return Array.from(collected.values());
}

export async function retrieveMasterCandidates(
    embeddedQueries: EmbeddedQueryVariant[],
    params: BuildAssistantReferencePackParams
): Promise<{
    candidates: RankedCandidate[];
    languageFallbackUsed: boolean;
    eligibleMasterScriptCount: number;
    exactLanguageMasterCount: number;
}> {
    if (embeddedQueries.length === 0) {
        return { candidates: [], languageFallbackUsed: false, eligibleMasterScriptCount: 0, exactLanguageMasterCount: 0 };
    }

    interface EligibleScript {
        _id: { toString(): string };
        title?: string; director?: string; tags?: string[];
        language?: string; sourceType?: string; activeScriptVersion?: string;
    }

    const cacheKey = 'rag:eligible_master_scripts';
    let eligibleScripts = await redisCache.get<EligibleScript[]>(cacheKey);
    if (!eligibleScripts) {
        eligibleScripts = await MasterScript.find({
            status: 'indexed', ragReady: true, gateStatus: 'passed',
            activeScriptVersion: { $exists: true, $ne: null }
        })
            .select('_id title director tags language sourceType activeScriptVersion')
            .lean() as unknown as EligibleScript[];
        await redisCache.set(cacheKey, eligibleScripts, 120);
    }

    const targetLang = params.language.toLowerCase().trim();
    const langMatch = (s: EligibleScript) => {
        const sl = (s.language || 'English').toLowerCase().trim();
        return sl === targetLang || sl.startsWith(targetLang + ' ') || sl.startsWith(targetLang + '(');
    };

    const linguisticScripts = eligibleScripts.filter(s =>
        langMatch(s) && (s.sourceType === 'literature' || s.sourceType === 'dictionary')
    );
    const linguisticIds = linguisticScripts.map(s => s._id.toString());

    const craftScriptsLocal = eligibleScripts.filter(s =>
        langMatch(s) && (s.sourceType === 'screenplay' || !s.sourceType)
    );
    const craftIdsLocal = craftScriptsLocal.map(s => s._id.toString());

    const craftScriptsGlobal = eligibleScripts.filter(s =>
        (s.language || 'English').toLowerCase().trim() === 'english' &&
        (s.sourceType === 'screenplay' || !s.sourceType)
    );
    const craftIdsGlobal = craftScriptsGlobal.map(s => s._id.toString());

    const [linguisticCandidates, craftCandidatesLocal, craftCandidatesGlobal] = await Promise.all([
        queryMasterCandidates(embeddedQueries, linguisticIds, params.language, true, 'literature'),
        queryMasterCandidates(embeddedQueries, craftIdsLocal, params.language, true, 'screenplay'),
        queryMasterCandidates(embeddedQueries, craftIdsGlobal, undefined, false, 'screenplay')
    ]);

    const craftCandidates = mergeCandidateSets(craftCandidatesLocal, craftCandidatesGlobal);
    const languageFallbackUsed = craftCandidatesLocal.length === 0 && craftCandidatesGlobal.length > 0;
    const mergedCandidates = mergeCandidateSets(linguisticCandidates, craftCandidates);

    return {
        candidates: mergedCandidates,
        languageFallbackUsed,
        eligibleMasterScriptCount: eligibleScripts.length,
        exactLanguageMasterCount: eligibleScripts.filter(s =>
            (s.language || 'English').toLowerCase().includes(params.language.toLowerCase())
        ).length
    };
}
