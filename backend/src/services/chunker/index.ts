import crypto from 'crypto';
import type { DialogueChunk, ParseResult } from './types.js';
import { PATTERNS } from './types.js';

export class ChunkerService {
    async parseScreenplay(text: string): Promise<ParseResult> {
        if (process.env.NODE_ENV !== 'production') { console.log('[ChunkerService] Starting fast regex-powered script parsing...'); }

        if (!text || typeof text !== 'string') {
            throw new Error('Invalid input: text must be a non-empty string');
        }

        const lines = text.split(/\r?\n/);
        const allChunks: DialogueChunk[] = [];

        let globalChunkIndex = 0;
        let currentEraContext: string | undefined = undefined;
        let currentSpeaker: string | null = null;
        let currentDialogue: string[] = [];
        let currentAction: string[] = [];
        let lastActionContext: string | undefined = undefined;
        let lastDialogueContext: string | undefined = undefined;

        const flushAction = (lineNumber: number, raw: string) => {
            if (currentAction.length > 0) {
                const content = currentAction.join(' ').replace(/\s+/g, ' ').trim();
                allChunks.push({
                    type: 'action',
                    content: content,
                    lineNumber: lineNumber - currentAction.length,
                    chunkIndex: globalChunkIndex++,
                    era: currentEraContext,
                    raw: raw,
                    contextBefore: lastDialogueContext || lastActionContext
                });
                lastActionContext = content;
                currentAction = [];
            }
        };

        const flushDialogue = (lineNumber: number, raw: string) => {
            if (currentSpeaker && currentDialogue.length > 0) {
                while (currentDialogue.length > 0 && currentDialogue[currentDialogue.length - 1].trim() === '') {
                    currentDialogue.pop();
                }

                if (currentDialogue.length > 0) {
                    const content = currentDialogue.join(' ').replace(/\s+/g, ' ').trim();

                    const context = lastDialogueContext
                        ? `${lastDialogueContext}${lastActionContext ? ` (Action: ${lastActionContext})` : ''}`
                        : lastActionContext;

                    allChunks.push({
                        type: 'dialogue',
                        speaker: this.normalizeCharacterName(currentSpeaker),
                        content: content,
                        lineNumber: lineNumber - currentDialogue.length,
                        chunkIndex: globalChunkIndex++,
                        era: currentEraContext,
                        raw: raw,
                        contextBefore: context
                    });

                    lastDialogueContext = `[${currentSpeaker}] ${content}`;
                    lastActionContext = undefined;
                }
            }
            currentDialogue = [];
            currentSpeaker = null;
        };

        const flushAll = (lineNumber: number, raw: string) => {
            flushAction(lineNumber, raw);
            flushDialogue(lineNumber, raw);
        };

        for (let i = 0; i < lines.length; i++) {
            const rawLine = lines[i];
            const line = rawLine.trim();
            const indent = rawLine.length - rawLine.trimStart().length;

            if (!line) {
                flushAll(i + 1, rawLine);
                continue;
            }

            const eraMatch = line.match(PATTERNS.eraHeader);
            if (eraMatch) {
                currentEraContext = eraMatch[1].trim();
                continue;
            }

            if (PATTERNS.sceneHeader.test(line)) {
                flushAll(i + 1, rawLine);
                allChunks.push({
                    type: 'slug',
                    content: line,
                    lineNumber: i + 1,
                    chunkIndex: globalChunkIndex++,
                    era: currentEraContext,
                    raw: rawLine
                });
                continue;
            }

            if (PATTERNS.transition.test(line)) {
                flushAll(i + 1, rawLine);
                allChunks.push({
                    type: 'transition',
                    content: line,
                    lineNumber: i + 1,
                    chunkIndex: globalChunkIndex++,
                    era: currentEraContext,
                    raw: rawLine
                });
                continue;
            }

            if (PATTERNS.pageBreak.test(line)) {
                continue;
            }

            let isCharacterCue = false;

            const hasCharacterIndent = indent >= 10 && indent <= 45;
            const isAllCaps = line === line.toUpperCase() && /[A-Z]/.test(line);

            if (!currentSpeaker) {
                if (hasCharacterIndent && isAllCaps && line.length < 40) {
                    isCharacterCue = true;
                } else {
                    isCharacterCue = line.length > 0 && line.length <= 50 && PATTERNS.characterCue.test(line);
                }
            } else {
                if (hasCharacterIndent && isAllCaps && !/[.,!?]$/.test(line)) {
                    isCharacterCue = true;
                } else {
                    const endsInColon = line.endsWith(':');
                    const endsInPunc = /[.,!?]$/.test(line.replace(/\)$/, ''));
                    isCharacterCue = line.length > 0 && line.length <= 50 && (isAllCaps || endsInColon) && !endsInPunc && !hasCharacterIndent;
                }
            }

            if (isCharacterCue) {
                flushAll(i + 1, rawLine);

                const colonMatch = line.match(PATTERNS.colonSplit);
                if (colonMatch) {
                    currentSpeaker = this.normalizeCharacterName(colonMatch[1].trim());
                    currentDialogue.push(colonMatch[2].trim());
                } else {
                    currentSpeaker = this.normalizeCharacterName(line);
                }
                continue;
            }

            if (currentSpeaker) {
                if (indent === 0 && line.length > 0 && !PATTERNS.parenthetical.test(line)) {
                    const hadIndents = currentDialogue.length > 0;
                    if (hadIndents && !allChunks.some(c => c.type === 'dialogue' && c.raw.startsWith(currentSpeaker!))) {
                    }
                }
                currentDialogue.push(line);
            } else {
                currentAction.push(line);
            }
        }

        flushAll(lines.length + 1, '');

        const dialogueChunks = allChunks.filter(c => c.type === 'dialogue');
        const characters = Array.from(new Set(allChunks.map(c => c.speaker).filter(Boolean))) as string[];

        if (process.env.NODE_ENV !== 'production') { console.log(`[ChunkerService] Fast parse complete. Found ${dialogueChunks.length} dialogue chunks from ${lines.length} lines.`); }

        return {
            chunks: allChunks,
            characters,
            sceneCount: allChunks.filter(c => c.type === 'slug').length,
            stats: {
                dialogueCount: dialogueChunks.length,
                actionCount: allChunks.filter(c => c.type === 'action').length,
                avgDialogueLength: dialogueChunks.length > 0
                    ? Math.round(dialogueChunks.reduce((sum, c) => sum + c.content.length, 0) / dialogueChunks.length)
                    : 0
            }
        };
    }

    private normalizeCharacterName(name: string): string {
        return name
            .replace(/\s*\(V\.O\.\)/i, '')
            .replace(/\s*\(O\.S\.\)/i, '')
            .replace(/\s*\(CONT'D\)/i, '')
            .replace(/\s*\(CONTINUING\)/i, '')
            .trim();
    }

    extractDialogueForIngestion(
        parseResult: ParseResult,
        options?: {
            minLength?: number;
            maxLength?: number;
            characterFilter?: string[];
        }
    ): DialogueChunk[] {
        const minLen = options?.minLength ?? 10;
        const maxLen = options?.maxLength ?? 2000;
        const charFilter = options?.characterFilter?.map(c => c.toUpperCase());

        return parseResult.chunks.filter(chunk => {
            if (chunk.type !== 'dialogue') return false;
            if (chunk.content.length > maxLen) return false;
            if (charFilter && chunk.speaker && !charFilter.includes(chunk.speaker.toUpperCase())) {
                return false;
            }
            return true;
        });
    }

    generateContentHash(content: string): string {
        const normalized = content.toLowerCase().replace(/\s+/g, ' ').trim();
        return crypto.createHash('sha256').update(normalized).digest('hex').slice(0, 16);
    }
}

export const chunkerService = new ChunkerService();

export type { DialogueChunk, ParseResult } from './types.js';
export { PATTERNS } from './types.js';
