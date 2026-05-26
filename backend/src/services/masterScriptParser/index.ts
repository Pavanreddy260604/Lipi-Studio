import type { ExtractedMasterScriptSource, MasterScriptSourceLayoutLine } from '../../types/masterScriptLayout.js';
import type { ParsedElement, ParsedScene, ParseResult } from './types.js';

const SCENE_HEADING_RE = /^(INT\.?\/EXT\.?|EXT\.?\/INT\.?|I\/E\.?|EST\.?|INT\.?|EXT\.?)\s+.+$/i;
const NUMBERED_SCENE_HEADING_RE = /^(?:(?:#[A-Za-z0-9.-]+#)|(?:\d+[A-Za-z0-9.-]*))\s+(?:INT\.?\/EXT\.?|EXT\.?\/INT\.?|I\/E\.?|EST\.?|INT\.?|EXT\.?)\s+.+$/i;
const TRANSITION_RE = /^(?:FADE IN:?|FADE OUT\.?|CUT TO:|DISSOLVE TO:|MATCH CUT TO:|SMASH CUT TO:|FADE TO BLACK\.?)$/i;
const PARENTHETICAL_RE = /^\([\w\s\.\-',]+\)$/;
const CREDIT_RE = /^(?:written by|screenplay by|story by|directed by|adapted by|based on|teleplay by|by|shooting script|first draft|revised draft|contact)\b/i;
const NOTE_RE = /^(\[\[|\/\*|#{1,6}\s+|=\s*|>\s*.+\s*<)/;

function isSceneHeading(text: string): boolean {
    return SCENE_HEADING_RE.test(text.trim()) || NUMBERED_SCENE_HEADING_RE.test(text.trim());
}

function isTransition(text: string): boolean {
    return TRANSITION_RE.test(text.trim());
}

function isParenthetical(text: string): boolean {
    return PARENTHETICAL_RE.test(text.trim());
}

function isCharacterCue(text: string, indentColumns: number, nextMeaningfulContent: string): boolean {
    const candidate = text.trim();
    if (!candidate || candidate.length > 40) return false;
    if (isSceneHeading(candidate) || isTransition(candidate) || NOTE_RE.test(candidate)) return false;
    if (CREDIT_RE.test(candidate)) return false;
    const normalized = candidate.replace(/\^\s*$/, '').trim();
    const isUppercase = normalized === normalized.toUpperCase() && /[A-Z]/.test(normalized);
    const shortEnough = normalized.split(/\s+/).length <= 6;
    const hasCharacterIndent = indentColumns >= 10 && indentColumns <= 45;
    const nextExists = nextMeaningfulContent.trim().length > 0;
    const nextIsNotSceneHead = !isSceneHeading(nextMeaningfulContent);
    if (hasCharacterIndent && isUppercase && nextExists && nextIsNotSceneHead) return true;
    return isUppercase && shortEnough && nextExists && nextIsNotSceneHead;
}

function detectElementType(
    line: MasterScriptSourceLayoutLine,
    nextMeaningfulContent: string,
    inDialogue: boolean
): { elementType: string; chunkType: string; speaker?: string } {
    const raw = line.rawText;
    const trimmed = raw.trim();
    if (!trimmed || line.isBlank) return { elementType: 'blank', chunkType: 'other' };
    if (line.sourceKind === 'title_page') return { elementType: 'title_page', chunkType: 'other' };
    if (line.sourceKind === 'page_marker') return { elementType: 'page_marker', chunkType: 'other', speaker: undefined };
    if (isSceneHeading(trimmed)) return { elementType: 'scene_heading', chunkType: 'slug' };
    if (isTransition(trimmed)) return { elementType: 'transition', chunkType: 'transition' };
    if (isParenthetical(trimmed)) return { elementType: 'parenthetical', chunkType: 'parenthetical' };
    if (isCharacterCue(trimmed, line.indentColumns, nextMeaningfulContent)) {
        const colonIdx = trimmed.indexOf(':');
        const speaker = colonIdx > 0 && colonIdx < 30 ? trimmed.slice(0, colonIdx).trim() : trimmed.replace(/\s*\([^)]*\)\s*$/, '').trim();
        return { elementType: 'character_cue', chunkType: 'cue', speaker };
    }
    if (inDialogue) return { elementType: 'dialogue', chunkType: 'dialogue' };
    return { elementType: 'action', chunkType: 'action' };
}

function getNextMeaningfulLine(lines: MasterScriptSourceLayoutLine[], index: number): string {
    for (let i = index + 1; i < lines.length; i++) {
        const t = lines[i].rawText.trim();
        if (t && !lines[i].isBlank) return t;
    }
    return '';
}

const PARSER_VERSION = 'master_parser_v1';

export class MasterScriptParserService {
    parse(source: ExtractedMasterScriptSource, _processingVersion: string): ParseResult {
        const lines = source.lines;
        const titlePage: Record<string, string | string[]> = {};
        const scenes: ParsedScene[] = [];
        const elements: ParsedElement[] = [];
        const titlePageLines: string[] = [];

        let currentScene: ParsedScene | null = null;
        let sceneSeq = 0;
        let elementSeq = 0;
        let chunkIndex = 0;
        let inDialogue = false;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmed = line.rawText.trim();
            const nextMeaningful = getNextMeaningfulLine(lines, i);

            if (line.sourceKind === 'title_page') {
                if (trimmed) titlePageLines.push(trimmed);
            }

            if (!trimmed || line.isBlank) {
                inDialogue = false;
            }

            if (line.sourceKind === 'page_marker') {
                elements.push({
                    sceneSeq,
                    elementSeq: elementSeq++,
                    chunkIndex: chunkIndex++,
                    elementType: 'page_marker',
                    chunkType: 'other',
                    content: trimmed,
                    sourceStartLine: line.lineNo,
                    sourceEndLine: line.lineNo,
                    sourceLineIds: [line.lineId],
                    nonPrinting: true
                });
                continue;
            }

            if (isSceneHeading(trimmed)) {
                if (currentScene) {
                    currentScene.sourceEndLine = line.lineNo;
                }
                sceneSeq++;
                elementSeq = 0;
                inDialogue = false;
                currentScene = {
                    sceneSeq,
                    heading: trimmed,
                    elements: [],
                    sourceStartLine: line.lineNo,
                    sourceEndLine: line.lineNo
                };
                scenes.push(currentScene);
                elements.push({
                    sceneSeq,
                    elementSeq: elementSeq++,
                    chunkIndex: chunkIndex++,
                    elementType: 'scene_heading',
                    chunkType: 'slug',
                    content: trimmed,
                    sourceStartLine: line.lineNo,
                    sourceEndLine: line.lineNo,
                    sourceLineIds: [line.lineId]
                });
                continue;
            }

            const detected = detectElementType(line, nextMeaningful, inDialogue);
            inDialogue = detected.chunkType === 'cue' || detected.chunkType === 'dialogue' || detected.chunkType === 'parenthetical';

            elements.push({
                sceneSeq: sceneSeq,
                elementSeq: elementSeq++,
                chunkIndex: chunkIndex++,
                elementType: detected.elementType,
                chunkType: detected.chunkType,
                speaker: detected.speaker,
                content: trimmed,
                sourceStartLine: line.lineNo,
                sourceEndLine: line.lineNo,
                sourceLineIds: [line.lineId]
            });
        }

        if (currentScene) {
            currentScene.sourceEndLine = lines[lines.length - 1]?.lineNo ?? currentScene.sourceEndLine;
        }

        if (titlePageLines.length > 0) {
            titlePage['Title Page'] = titlePageLines;
            const keyValueLines = titlePageLines.map(l => l.match(/^([A-Za-z ]+):\s*(.+)$/)).filter((m): m is RegExpMatchArray => !!m);
            for (const match of keyValueLines) {
                titlePage[match[1].trim()] = match[2].trim();
            }
        }

        return { elements, scenes, parserVersion: PARSER_VERSION, titlePage };
    }
}

export const masterScriptParserService = new MasterScriptParserService();
