import type { ScoredSample } from '../vector/index.js';
import type { BuildAssistantReferencePackParams, RankedCandidate, AssistantReference, AssistantReferenceGroup, AssistantSourceFamily } from './types.js';
import { lexicalOverlapScore, truncateText } from './utils.js';

export function rankCandidates(
    candidates: RankedCandidate[],
    params: BuildAssistantReferencePackParams,
    preferredElementTypes: string[],
    sourceFamily: 'project' | 'master'
): Array<RankedCandidate & { score: number }> {
    if (candidates.length === 1 && candidates[0]?.id === 'fallback') {
        return [{ ...(candidates[0] as any), score: 1.0 }];
    }
    const comparisonText = [
        params.instruction, params.selection?.text || '',
        params.currentContent || params.scene?.content || '',
        params.scene?.summary || '', params.scene?.slugline || ''
    ].filter(Boolean).join('\n');

    const styleText = [
        params.bible?.genre || '', params.bible?.tone || '', params.bible?.visualStyle || '',
        (params.bible?.rules || []).join(' '),
        (params.userInterests?.genres || []).join(' '),
        (params.userInterests?.styles || []).join(' ')
    ].join(' ');

    const sourceFrequency = new Map<string, number>();
    for (const c of candidates) {
        const sk = c.sample.masterScriptId || c.sample.source || 'unknown';
        sourceFrequency.set(sk, (sourceFrequency.get(sk) || 0) + 1);
    }

    return candidates
        .map((candidate) => {
            if (candidate.id === 'fallback') {
                return { ...candidate, score: 1.0 };
            }
            const sample = candidate.sample;
            const elementType = (sample.elementType || sample.chunkType || 'other').toLowerCase();

            const lexicalBoost = lexicalOverlapScore(
                comparisonText,
                [sample.content, sample.parentContent, sample.source, (sample.tags || []).join(' ')].filter(Boolean).join('\n')
            ) * 0.18;

            const styleBoost = lexicalOverlapScore(
                styleText,
                [sample.source, (sample.tags || []).join(' '), sample.parentContent].filter(Boolean).join('\n')
            ) * 0.14;

            const genreBoost = params.bible?.genre
                ? lexicalOverlapScore(params.bible.genre, (sample.tags || []).join(' ')) * 0.15 : 0;

            const toneBoost = params.bible?.tone
                ? lexicalOverlapScore(params.bible.tone, [sample.parentContent, (sample.tags || []).join(' ')].join(' ')) * 0.12 : 0;

            const preferredElementBoost = preferredElementTypes.includes(elementType) ? 0.15 : 0;
            const projectPriorityBoost = sourceFamily === 'project' ? 0.45 : 0.02;
            const matchedQueryBoost = Math.min(0.12, Math.max(0, candidate.matchedQueries.size - 1) * 0.05);
            const characterBoost = candidate.strictCharacterMatch ? 0.08 : 0;
            const languageBoost = candidate.languageMatched ? 0.06 : 0;

            const isNonEnglish = (params.language || 'English').toLowerCase() !== 'english';
            const linguisticBoost = (isNonEnglish && (candidate.sourceType === 'literature' || candidate.sourceType === 'dictionary')) ? 0.25 : 0;

            const continuityBoost = sourceFamily === 'project'
                ? lexicalOverlapScore(
                    [params.bible?.storySoFar || '', params.scene?.previousSceneSummary || ''].join('\n'),
                    [sample.content, sample.parentContent].filter(Boolean).join('\n')
                ) * 0.25 : 0;

            const sourceKey = sample.masterScriptId || sample.source || 'unknown';
            const freq = sourceFrequency.get(sourceKey) || 0;
            const varietyPenalty = sourceFamily === 'master' ? Math.min(0.15, (freq - 1) * 0.04) : 0;

            const recentHistory = params.scene?.assistantChatHistory || [];
            const recentInstructions = recentHistory.filter(h => h.role === 'user').slice(-3).map(h => h.content).join('\n');
            const recencyBoost = recentInstructions
                ? lexicalOverlapScore(recentInstructions, [sample.content, (sample.tags || []).join(' ')].join('\n')) * 0.10 : 0;

            const isTransliteration = Boolean(params.transliteration);
            const transliterationBoost = (isTransliteration && (sample.tags || []).some(t => /romanized|phonetic|translit/i.test(t))) ? 0.20 : 0;

            return {
                ...candidate,
                score: sample.similarityScore + lexicalBoost + styleBoost + genreBoost + toneBoost
                    + preferredElementBoost + projectPriorityBoost + matchedQueryBoost + characterBoost
                    + languageBoost + linguisticBoost + continuityBoost + recencyBoost + transliterationBoost - varietyPenalty
            };
        })
        .sort((left, right) => right.score - left.score);
}

export function inferPreferredElementTypes(params: BuildAssistantReferencePackParams): string[] {
    const sourceText = [params.instruction, params.selection?.text || '', params.currentContent || ''].join('\n').toLowerCase();

    const preferred = new Set<string>();
    if (/\b(dialogue|subtext|voice|line|speak|say|conversation)\b/.test(sourceText)) {
        preferred.add('dialogue'); preferred.add('cue'); preferred.add('parenthetical');
    }
    if (/\b(action|visual|cinematic|blocking|pace|pacing|movement|beat)\b/.test(sourceText)) {
        preferred.add('action'); preferred.add('scene'); preferred.add('slug');
    }
    if (!preferred.size) {
        if (params.mode === 'agent') {
            preferred.add('scene'); preferred.add('action'); preferred.add('dialogue');
        } else if (params.target === 'selection') {
            preferred.add('dialogue'); preferred.add('action');
        } else {
            preferred.add('scene'); preferred.add('dialogue');
        }
    }

    return Array.from(preferred);
}

export function buildMasterFeedRefs(
    masterResult: { candidates: RankedCandidate[] },
    params: BuildAssistantReferencePackParams,
    preferredElementTypes: string[],
    quota: number
): AssistantReference[] {
    if (!masterResult.candidates.length || quota < 1) return [];

    const linguisticQuota = Math.max(1, Math.floor(quota * 0.4));
    const craftQuota = quota - linguisticQuota;
    const ranked = rankCandidates(masterResult.candidates, params, preferredElementTypes, 'master');

    const linguisticRefs = ranked
        .filter(c => c.sourceType === 'literature' || c.sourceType === 'dictionary')
        .slice(0, linguisticQuota)
        .map(c => toReference(c.sample, 'master_feed', 'master', c.score, c.sourceType));

    const craftRefs = ranked
        .filter(c => c.sourceType === 'screenplay')
        .slice(0, craftQuota + (linguisticQuota - linguisticRefs.length))
        .map(c => toReference(c.sample, 'master_feed', 'master', c.score, c.sourceType));

    return [...linguisticRefs, ...craftRefs].sort((a, b) => b.score - a.score);
}

export function toReference(
    sample: ScoredSample,
    group: AssistantReferenceGroup,
    sourceFamily: AssistantSourceFamily,
    score: number,
    sourceType?: string
): AssistantReference {
    return {
        group, sourceFamily,
        label: truncateText(sample.source || 'Retrieved reference', 120),
        excerpt: truncateText(sample.content, 280),
        parentContext: truncateText(sample.parentContent, 220) || undefined,
        elementType: sample.elementType, chunkType: sample.chunkType,
        source: sample.source, sampleId: sample._id, masterScriptId: sample.masterScriptId,
        sourceType, score: Number(score.toFixed(4))
    };
}
