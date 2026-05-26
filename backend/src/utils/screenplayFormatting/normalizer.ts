import type { ScreenplayLineKind } from './types.js';

function isCueLine(trimmed: string): boolean {
    const normalized = trimmed.replace(/^@\s*/, '').replace(/\^\s*$/, '').trim();
    return (
        normalized.length > 0 &&
        normalized.length <= 40 &&
        normalized === normalized.toUpperCase() &&
        /[A-Z]/.test(normalized) &&
        !/[.!?]$/.test(normalized)
    );
}

function classifyScreenplayLine(line: string, previousKind: ScreenplayLineKind | null): ScreenplayLineKind {
    const trimmed = line.trim();
    if (!trimmed) return 'blank';
    if (/^(INT\.?|EXT\.?|EST\.?|INT\/EXT\.?|INT\.\/EXT\.?|EXT\/INT\.?|EXT\.\/INT\.?|I\/E\.?)\s+.+$/i.test(trimmed)) {
        return 'slug';
    }
    if (/^\([^)]*\)$/.test(trimmed)) {
        return 'parenthetical';
    }
    if (/^(FADE IN:?|FADE OUT\.?|CUT TO:|MATCH CUT TO:|SMASH CUT TO:|DISSOLVE TO:)$/.test(trimmed.toUpperCase()) || trimmed.toUpperCase().endsWith(' TO:')) {
        return 'transition';
    }
    if (isCueLine(trimmed)) {
        return 'cue';
    }
    if (previousKind === 'cue' || previousKind === 'parenthetical' || previousKind === 'dialogue') {
        return 'dialogue';
    }
    return 'action';
}

function isIntentionalForcedBlankLine(line: string): boolean {
    return line === '  ';
}

function isEffectivelyBlankLine(line: string): boolean {
    return line.trim().length === 0;
}

function trimOuterBlankLines(lines: string[]): string[] {
    let start = 0;
    let end = lines.length;

    while (start < end && isEffectivelyBlankLine(lines[start])) {
        start += 1;
    }
    while (end > start && isEffectivelyBlankLine(lines[end - 1])) {
        end -= 1;
    }

    return lines.slice(start, end);
}

export function normalizeScreenplayWhitespace(content: string): string {
    if (!content.trim()) {
        return '';
    }

    const rawLines = trimOuterBlankLines(content.replace(/\r\n?/g, '\n').split('\n'));
    const normalizedLines: string[] = [];
    let lastMeaningfulKind: ScreenplayLineKind | null = null;

    for (let index = 0; index < rawLines.length; index += 1) {
        const line = rawLines[index];

        if (isIntentionalForcedBlankLine(line)) {
            normalizedLines.push(line);
            continue;
        }

        if (isEffectivelyBlankLine(line)) {
            const nextIndex = rawLines.findIndex((candidate, candidateIndex) => candidateIndex > index && !isEffectivelyBlankLine(candidate));
            const nextLine = nextIndex === -1 ? null : rawLines[nextIndex];
            const nextKind = nextLine ? classifyScreenplayLine(nextLine, lastMeaningfulKind) : null;

            if (
                (lastMeaningfulKind === 'cue' && (nextKind === 'parenthetical' || nextKind === 'dialogue')) ||
                (lastMeaningfulKind === 'parenthetical' && nextKind === 'dialogue')
            ) {
                continue;
            }

            const consecutiveBlanks = normalizedLines.length >= 2 && 
                isEffectivelyBlankLine(normalizedLines[normalizedLines.length - 1]) &&
                isEffectivelyBlankLine(normalizedLines[normalizedLines.length - 2]);

            if (consecutiveBlanks) {
                continue;
            }

            normalizedLines.push('');
            continue;
        }

        const kind = classifyScreenplayLine(line, lastMeaningfulKind);
        lastMeaningfulKind = kind;
        normalizedLines.push(line);
    }

    return normalizedLines.join('\n');
}
