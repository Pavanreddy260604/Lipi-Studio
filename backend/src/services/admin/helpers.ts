import crypto from 'crypto';
import type { ParsedElement, ParsedScene } from '../masterScriptParser/types.js';
import type { ExtractedMasterScriptSource, MasterScriptSourceLayoutLine, MasterScriptSourceFormat } from '../../types/masterScriptLayout';

const scenePreviewChars = 3500;

export function createScriptVersion(): string {
    return `v_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function buildTitlePageSummary(lines: MasterScriptSourceLayoutLine[]): Record<string, string | string[]> {
    const titleLines = lines.filter(line => line.sourceKind === 'title_page' && !line.isBlank).map(line => line.rawText.trim()).filter(Boolean);
    if (titleLines.length === 0) return {};
    const titlePage: Record<string, string | string[]> = { 'Title Page': titleLines };
    const keyValueLines = titleLines.map(line => line.match(/^([A-Za-z ]+):\s*(.+)$/)).filter((match): match is RegExpMatchArray => Boolean(match));
    for (const match of keyValueLines) {
        const key = match[1].trim();
        const value = match[2].trim();
        titlePage[key] = value;
    }
    if (!titlePage.Title && titleLines[0]) titlePage.Title = titleLines[0];
    return titlePage;
}

export function applySourceMetadata(
    target: { sourceFormat?: string; pageCount?: number; layoutVersion?: string; ingestWarnings?: string[] },
    extractedSource: ExtractedMasterScriptSource
): void {
    target.sourceFormat = extractedSource.sourceFormat;
    target.pageCount = extractedSource.pageCount;
    target.layoutVersion = extractedSource.layoutVersion;
    target.ingestWarnings = extractedSource.warnings;
}

export function buildSceneNodeText(scene: ParsedScene): string {
    const previewLines = scene.elements.map(element => element.content.trim()).filter(Boolean).slice(0, 24);
    const preview = previewLines.join('\n').slice(0, scenePreviewChars);
    return [`SCENE ${scene.sceneSeq}`, scene.heading, preview].filter(Boolean).join('\n').trim();
}

export function buildElementEmbeddingText(element: ParsedElement, sceneHeading: string): string {
    const content = normalizeElementContent(element);
    return [`SCENE: ${sceneHeading}`, `ELEMENT_TYPE: ${element.elementType}`, `CHUNK_TYPE: ${element.chunkType}`, element.speaker ? `SPEAKER: ${element.speaker}` : '', `CONTENT: ${content}`].filter(Boolean).join('\n');
}

export function normalizeElementContent(element: ParsedElement): string {
    if (typeof element.content === 'string' && element.content.length > 0) return element.content;
    return '[BLANK_LINE]';
}

export function createStableHash(...parts: string[]): string {
    return crypto.createHash('sha256').update(parts.join('|')).digest('hex').slice(0, 16);
}
