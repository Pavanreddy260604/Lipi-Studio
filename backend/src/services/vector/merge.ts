import { ScoredSample } from "./types.js";

export function dedupeSamples(samples: ScoredSample[]): ScoredSample[] {
    const seen = new Set<string>();
    return samples.filter(sample => {
        const fallbackKey = `${(sample.speaker || '').toLowerCase()}|${sample.content.trim().toLowerCase()}`;
        const key = sample.contentHash || fallbackKey;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

export function filterByMaxLength(samples: ScoredSample[], maxLength: number): ScoredSample[] {
    return samples.filter(s => s.content.length <= maxLength);
}
