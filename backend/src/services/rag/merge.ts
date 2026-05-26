import type { ScoredSample } from '../vector/index.js';
import type { RankedCandidate } from './types.js';

export function mergeCandidates(
    target: Map<string, RankedCandidate>,
    samples: ScoredSample[],
    queryKey: string,
    strictCharacterMatch: boolean,
    languageMatched: boolean,
    sourceType?: 'screenplay' | 'literature' | 'dictionary'
) {
    for (const sample of samples) {
        const existing = target.get(sample._id);
        if (existing) {
            if (sample.similarityScore > existing.sample.similarityScore) {
                existing.sample = sample;
            }
            existing.matchedQueries.add(queryKey);
            existing.strictCharacterMatch = existing.strictCharacterMatch || strictCharacterMatch;
            existing.languageMatched = existing.languageMatched || languageMatched;
            existing.sourceType = existing.sourceType || sourceType;
            continue;
        }

        target.set(sample._id, {
            sample,
            matchedQueries: new Set([queryKey]),
            strictCharacterMatch,
            languageMatched,
            sourceType
        });
    }
}

export function mergeCandidateSets(primary: RankedCandidate[], secondary: RankedCandidate[]): RankedCandidate[] {
    const merged = new Map<string, RankedCandidate>();
    for (const candidate of [...primary, ...secondary]) {
        const existing = merged.get(candidate.sample._id);
        if (!existing) {
            merged.set(candidate.sample._id, candidate);
            continue;
        }

        if (candidate.sample.similarityScore > existing.sample.similarityScore) {
            existing.sample = candidate.sample;
        }
        candidate.matchedQueries.forEach((queryKey) => existing.matchedQueries.add(queryKey));
        existing.strictCharacterMatch = existing.strictCharacterMatch || candidate.strictCharacterMatch;
        existing.languageMatched = existing.languageMatched || candidate.languageMatched;
        existing.sourceType = existing.sourceType || candidate.sourceType;
    }

    return Array.from(merged.values());
}
