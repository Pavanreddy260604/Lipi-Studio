import type {
    ExtractedMasterScriptSource,
    MasterScriptSourceFormat,
    MasterScriptSourceKind,
    MasterScriptSourceLayoutLine
} from '../../types/masterScriptLayout';
import type { PendingSourceLine, PdfWord } from './types.js';
import {
    LAYOUT_VERSION, X_TO_COLUMN_RATIO, PAGE_MARKER_PATTERN,
    SCENE_HEADING_PATTERN, NUMBERED_SCENE_HEADING_PATTERN,
    TRANSITION_PATTERN, CREDIT_PATTERN, NOTE_PATTERN
} from './types.js';
import crypto from 'crypto';

function hash(input: string): string {
    return crypto.createHash('sha256').update(input).digest('hex');
}

export function computeIndentColumns(rawText: string, xStart?: number): number {
    if (typeof xStart === 'number' && Number.isFinite(xStart)) {
        return Math.max(0, Math.round(xStart / X_TO_COLUMN_RATIO));
    }
    const match = rawText.match(/^ */);
    return match ? match[0].length : 0;
}

export function isPageMarker(rawText: string): boolean {
    return PAGE_MARKER_PATTERN.test(rawText.trim());
}

export function isLikelyCharacterCue(rawText: string, nextMeaningfulLine: string): boolean {
    const candidate = rawText.trim();
    if (!candidate || candidate.length > 40) return false;
    if (SCENE_HEADING_PATTERN.test(candidate) || NUMBERED_SCENE_HEADING_PATTERN.test(candidate)) return false;
    if (TRANSITION_PATTERN.test(candidate)) return false;
    if (NOTE_PATTERN.test(candidate)) return false;

    const normalized = candidate.replace(/\^\s*$/, '').trim();
    const isUppercase = normalized === normalized.toUpperCase() && /[A-Z]/.test(normalized);
    const shortEnough = normalized.split(/\s+/).length <= 6;
    const nextExists = nextMeaningfulLine.trim().length > 0;
    const nextIsNotStructure =
        !SCENE_HEADING_PATTERN.test(nextMeaningfulLine) &&
        !NUMBERED_SCENE_HEADING_PATTERN.test(nextMeaningfulLine) &&
        !TRANSITION_PATTERN.test(nextMeaningfulLine);

    return isUppercase && shortEnough && nextExists && nextIsNotStructure;
}

export function isLikelyBodyStart(lines: PendingSourceLine[], index: number): boolean {
    const rawText = lines[index]?.rawText || '';
    const trimmed = rawText.trim();

    if (!trimmed || isPageMarker(trimmed)) {
        return false;
    }

    if (CREDIT_PATTERN.test(trimmed)) {
        return false;
    }

    if (
        SCENE_HEADING_PATTERN.test(trimmed) ||
        NUMBERED_SCENE_HEADING_PATTERN.test(trimmed) ||
        TRANSITION_PATTERN.test(trimmed) ||
        NOTE_PATTERN.test(trimmed) ||
        trimmed.startsWith('.') ||
        /^@\s*\S+/.test(trimmed)
    ) {
        return true;
    }

    let nextMeaningfulLine = '';
    for (let cursor = index + 1; cursor < lines.length; cursor += 1) {
        const candidate = lines[cursor].rawText.trim();
        if (!candidate || isPageMarker(candidate)) {
            continue;
        }
        nextMeaningfulLine = candidate;
        break;
    }

    const looksLikeEarlyTitleLine =
        index <= 10 &&
        trimmed === trimmed.toUpperCase() &&
        trimmed.length <= 60 &&
        (
            CREDIT_PATTERN.test(nextMeaningfulLine) ||
            nextMeaningfulLine === nextMeaningfulLine.toUpperCase()
        );

    if (looksLikeEarlyTitleLine) {
        return false;
    }

    if (isLikelyCharacterCue(trimmed, nextMeaningfulLine)) {
        return true;
    }

    if (/^[^:]{1,30}:\s+.+$/.test(trimmed)) {
        return true;
    }

    const indentColumns = computeIndentColumns(rawText, lines[index].xStart);
    const looksLikeProse = /[a-z]/.test(trimmed) && trimmed.split(/\s+/).length >= 5;
    const looksLikeTitle = trimmed === trimmed.toUpperCase() && trimmed.length <= 40;

    if (looksLikeProse && !looksLikeTitle) {
        if (/[.!?:]$/.test(trimmed) || indentColumns >= 8 || trimmed.length >= 45) {
            return true;
        }
    }

    const firstNonBlankIndex = lines.findIndex(line => line.rawText.trim().length > 0 && !isPageMarker(line.rawText));
    if (index === firstNonBlankIndex && !looksLikeTitle && !CREDIT_PATTERN.test(trimmed)) {
        return true;
    }

    return false;
}

export function detectBodyStartIndex(lines: PendingSourceLine[]): number {
    const firstNonBlankIndex = lines.findIndex(line => line.rawText.trim().length > 0 && !isPageMarker(line.rawText));
    if (firstNonBlankIndex === -1) {
        return 0;
    }

    for (let index = firstNonBlankIndex; index < lines.length; index += 1) {
        if (isLikelyBodyStart(lines, index)) {
            return index;
        }
    }

    return firstNonBlankIndex;
}

function detectSourceKind(lines: PendingSourceLine[], index: number, bodyStartIndex: number): MasterScriptSourceKind {
    if (isPageMarker(lines[index].rawText)) {
        return 'page_marker';
    }
    return index < bodyStartIndex ? 'title_page' : 'body';
}

export function parseTextPages(rawContent: string): PendingSourceLine[] {
    const normalized = rawContent.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const pages = normalized.split('\f');
    const lines: PendingSourceLine[] = [];

    pages.forEach((page, pageIndex) => {
        const pageLines = page.split('\n');
        pageLines.forEach(rawText => {
            lines.push({
                pageNo: pageIndex + 1,
                rawText
            });
        });
    });

    return lines;
}

export function buildSourceFromPendingLines(
    sourceFormat: MasterScriptSourceFormat,
    pendingLines: PendingSourceLine[],
    pageCount: number,
    warnings: string[]
): ExtractedMasterScriptSource {
    const bodyStartIndex = detectBodyStartIndex(pendingLines);
    const pageLineCounters = new Map<number, number>();

    const lines: MasterScriptSourceLayoutLine[] = pendingLines.map((line, index) => {
        const nextPageLine = (pageLineCounters.get(line.pageNo) || 0) + 1;
        pageLineCounters.set(line.pageNo, nextPageLine);

        const sourceKind = detectSourceKind(pendingLines, index, bodyStartIndex);
        const isBlank = line.rawText.length === 0;
        const indentColumns = computeIndentColumns(line.rawText, line.xStart);
        const lineHash = hash(line.rawText).slice(0, 24);
        const lineId = hash(
            `${line.pageNo}|${nextPageLine}|${sourceKind}|${indentColumns}|${line.rawText}|${line.xStart ?? ''}|${line.yTop ?? ''}`
        ).slice(0, 24);

        return {
            lineNo: index + 1,
            pageNo: line.pageNo,
            pageLineNo: nextPageLine,
            rawText: line.rawText,
            isBlank,
            indentColumns,
            lineHash,
            lineId,
            sourceKind,
            xStart: line.xStart,
            yTop: line.yTop
        };
    });

    return {
        sourceFormat,
        layoutVersion: LAYOUT_VERSION,
        rawContent: lines.map(line => line.rawText).join('\n'),
        pageCount: Math.max(pageCount, ...lines.map(line => line.pageNo), 1),
        warnings,
        lines
    };
}

export function extractStructuredTextFromRawContent(
    rawContent: string,
    sourceFormat: MasterScriptSourceFormat = 'raw_text'
): ExtractedMasterScriptSource {
    const pendingLines = parseTextPages(rawContent);
    const pageCount = Math.max(1, rawContent.split('\f').length);
    return buildSourceFromPendingLines(sourceFormat, pendingLines, pageCount, []);
}
