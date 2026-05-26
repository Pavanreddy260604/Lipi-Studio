import type { AssistantPreferences } from './project.api';

export interface CritiqueResult {
    score: number;
    grade: string;
    summary: string;
    formattingIssues: string[];
    dialogueIssues: string[];
    pacingIssues: string[];
    suggestions: string[];
}

export interface ScriptTemplates {
    formats: {
        id: string;
        name: string;
        description: string;
    }[];
    styles: {
        id: string;
        name: string;
        description: string;
    }[];
}

export interface ScriptRequest {
    userId?: string;
    idea: string;
    format: string;
    style: string;
    language?: string;
    duration?: number;
    genre?: string;
    tone?: string;
    transliteration?: boolean;
    bibleId?: string;
    characterIds?: string[];
    sceneLength?: 'short' | 'medium' | 'long' | 'extended';
    currentContent?: string;
    model?: string;
}

export interface ScriptHistoryItem {
    _id: string;
    title: string;
    prompt: string;
    format: string;
    style: string;
    status: 'generating' | 'completed' | 'failed' | 'draft';
    createdAt: string;
}

export interface IScriptDetail {
    _id: string;
    content: string;
    title: string;
    metadata: any;
}

export interface IMasterScript {
    _id: string;
    title: string;
    director: string;
    description?: string;
    tags: string[];
    language: string;
    rawContent: string;
    status: 'pending' | 'processing' | 'validating' | 'indexed' | 'failed';
    progress?: number;
    processedChunks: number;
    activeScriptVersion?: string;
    processingScriptVersion?: string;
    parserVersion?: string;
    sourceFormat?: 'pdf' | 'docx' | 'txt' | 'md' | 'fountain' | 'script' | 'raw_text';
    pageCount?: number;
    layoutVersion?: string;
    readerReady?: boolean;
    ragReady?: boolean;
    ingestWarnings?: string[];
    gateStatus?: 'pending' | 'passed' | 'failed';
    lastValidationSummary?: string;
    createdAt: string;
}

export interface ProcessMasterScriptResponse {
    message: string;
    scriptId: string;
    scriptVersion?: string | null;
    gateStatus?: 'pending' | 'passed' | 'failed';
}

export interface MasterScriptValidationReport {
    scriptVersion: string;
    status: 'passed' | 'failed';
    summary: string;
    reconstructionMismatch: boolean;
    missingLines: Array<{ lineNo: number; lineId?: string; detail?: string }>;
    extraLines: Array<{ lineNo: number; lineId?: string; detail?: string }>;
    layoutMismatches: Array<{ lineNo: number; lineId?: string; detail?: string }>;
    classificationMismatches: Array<{ lineNo: number; lineId?: string; detail?: string }>;
    orderMismatches: Array<{ sceneSeq: number; elementSeq: number; detail: string }>;
    hierarchyMismatches: Array<{ chunkId?: string; detail: string }>;
    geAudit?: {
        status: 'passed' | 'failed' | 'skipped';
        summary?: string;
        checkedAt?: string;
        command?: string;
        details?: Record<string, unknown>;
    };
}

export interface MasterScriptReconstructionLine {
    lineNo: number;
    pageNo: number;
    pageLineNo: number;
    rawText: string;
    isBlank: boolean;
    indentColumns: number;
    lineHash: string;
    lineId: string;
    sourceKind: 'title_page' | 'body' | 'page_marker';
    xStart?: number;
    yTop?: number;
}

export interface MasterScriptReconstruction {
    scriptVersion: string;
    parserVersion?: string;
    sourceFormat?: 'pdf' | 'docx' | 'txt' | 'md' | 'fountain' | 'script' | 'raw_text';
    pageCount?: number;
    layoutVersion?: string;
    readerReady?: boolean;
    ragReady?: boolean;
    warnings?: string[];
    lineCount: number;
    content: string;
    lines: MasterScriptReconstructionLine[];
    titlePage?: Record<string, string | string[]>;
}

export interface VoiceIngestResult {
    count: number;
    skippedDuplicates: number;
    skippedShort: number;
    characters: string[];
    sceneCount: number;
    message: string;
}

export interface AssistantSelectionPayload {
    text: string;
    start?: number;
    end?: number;
    lineStart?: number;
    lineEnd?: number;
    lineCount?: number;
    charCount?: number;
    preview?: string;
}

export interface AssistantContextPayload {
    project?: {
        id?: string;
        title?: string;
        logline?: string;
        genre?: string;
        tone?: string;
        language?: string;
    };
    scene?: {
        id?: string;
        name?: string;
    };
    script?: {
        excerpt?: string;
    };
    selection?: AssistantSelectionPayload | null;
    reply?: {
        language?: string;
        transliteration?: boolean;
    };
    assistantPreferences?: AssistantPreferences;
}

export interface AssistedEditOptions {
    language?: string;
    mode?: 'ask' | 'edit' | 'agent';
    target?: 'scene' | 'selection';
    currentContent?: string;
    selection?: AssistantSelectionPayload | null;
    transliteration?: boolean;
    model?: string;
    images?: string[];
}

export interface ProjectAssistantOptions {
    language?: string;
    mode?: 'ask' | 'edit' | 'agent';
    target?: 'scene' | 'selection';
    currentContext?: string | AssistantContextPayload;
    currentContent?: string;
    selection?: AssistantSelectionPayload | null;
    transliteration?: boolean;
    model?: string;
    images?: string[];
}
