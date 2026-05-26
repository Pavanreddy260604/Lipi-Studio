export type ChunkType = 'dialogue' | 'action' | 'transition' | 'slug' | 'parenthetical';

export interface DialogueChunk {
    type: ChunkType;
    content: string;
    speaker?: string;
    parenthetical?: string;
    lineNumber: number;
    chunkIndex: number;
    contextBefore?: string;
    raw: string;
    era?: string;
    tactic?: string;
    emotion?: string;
}

export interface ParseResult {
    chunks: DialogueChunk[];
    characters: string[];
    sceneCount: number;
    stats: {
        dialogueCount: number;
        actionCount: number;
        avgDialogueLength: number;
    };
}

export const PATTERNS = {
    sceneHeader: /^(INT\.|EXT\.|INT\.\/EXT\.|I\/E\.)\s+.+$/i,
    characterCue: /^(?!(?:INT\.|EXT\.|I\/E))(?:(?:[A-Z][A-Z\s\d\-\.']*[A-Z])|(?:.*:)|(?:[\p{L}\p{M}][\p{L}\p{M}\s\d\-\.']{0,50}[^\s\.,!\?]))(?:[\s]*\([^\)]+\))?$/u,
    parenthetical: /^\([\w\s\.\-',]+\)$/,
    transition: /^(CUT TO:|FADE OUT\.|FADE IN:|DISSOLVE TO:|SMASH CUT TO:|MATCH CUT TO:|FADE TO BLACK\.)$/i,
    pageBreak: /^(CONTINUED|MORE|\(MORE\)|Page \d+)$/i,
    voiceTypes: /\((V\.O\.|O\.S\.|O\.C\.|CONT'D|CONTINUING|PRE-LAP|FILTERED|INTO PHONE)\)/i,
    eraHeader: /^#\s*ERA:\s*(.+)$/i,
    colonSplit: /^([^:]{1,30}):\s*(.+)$/
};
