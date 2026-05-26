export const STOP_WORDS = new Set([
    'the', 'and', 'for', 'with', 'that', 'this', 'from', 'into', 'your', 'about',
    'have', 'will', 'would', 'should', 'could', 'them', 'they', 'their', 'there',
    'what', 'when', 'where', 'while', 'keep', 'make', 'more', 'less', 'than', 'then',
    'scene', 'script', 'line', 'lines', 'edit', 'agent', 'ask', 'write', 'rewrite'
]);

export function toId(value?: { toString(): string } | string | null): string | undefined {
    if (!value) return undefined;
    return typeof value === 'string' ? value : value.toString();
}

export function truncateText(value: string | undefined | null, maxLength: number): string {
    const text = (value || '').replace(/\s+/g, ' ').trim();
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return `${text.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

export function tokenize(value: string): string[] {
    const normalized = value.normalize('NFC').toLowerCase();
    const tokens = normalized.split(/[\s,;:.!?()[\]{}<>"'\u2018\u2019\u201C\u201D-]+/);
    return tokens
        .map((token) => token.trim())
        .filter((token) => token.length > 2 && !STOP_WORDS.has(token));
}

export function lexicalOverlapScore(left: string, right: string): number {
    const leftTokens = new Set(tokenize(left));
    if (!leftTokens.size) return 0;
    const rightTokens = new Set(tokenize(right));
    if (!rightTokens.size) return 0;

    let matches = 0;
    for (const token of leftTokens) {
        if (rightTokens.has(token)) matches += 1;
    }

    return matches / Math.max(1, Math.min(leftTokens.size, 8));
}

export function normalizeSectionText(value: string): string {
    return value.replace(/\s+/g, ' ').trim().toLowerCase();
}
