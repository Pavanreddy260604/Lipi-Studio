export interface ParsedElement {
    sceneSeq: number;
    elementSeq: number;
    chunkIndex: number;
    elementType: string;
    chunkType: string;
    speaker?: string;
    content: string;
    sourceStartLine: number;
    sourceEndLine: number;
    sourceLineIds: string[];
    dualDialogue?: boolean;
    sceneNumber?: string;
    nonPrinting?: boolean;
}

export interface ParsedScene {
    sceneSeq: number;
    heading: string;
    elements: ParsedElement[];
    sourceStartLine: number;
    sourceEndLine: number;
}

export interface ParseResult {
    elements: ParsedElement[];
    scenes: ParsedScene[];
    parserVersion: string;
    titlePage: Record<string, string | string[]>;
}
