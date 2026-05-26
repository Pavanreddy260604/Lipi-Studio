import type { ScoredSample } from '../vector/index.js';

export type AssistantMode = 'ask' | 'edit' | 'agent';
export type AssistantTarget = 'scene' | 'selection';
export type AssistantReferenceGroup =
    | 'project_continuity'
    | 'project_style'
    | 'master_feed'
    | 'recent_continuity';
export type AssistantSourceFamily = 'project' | 'master' | 'recent' | 'continuity';

export type AssistantUserInterests = {
    directors: string[];
    genres: string[];
    styles: string[];
};

export type AssistantSelectionLike = {
    text: string;
    start?: number;
    end?: number;
    lineStart?: number;
    lineEnd?: number;
    lineCount?: number;
    charCount?: number;
    preview?: string;
};

export type AssistantHistoryEntry = {
    role: 'user' | 'assistant';
    content: string;
    timestamp?: Date;
};

export type AssistantBibleContext = {
    _id?: { toString(): string } | string;
    title?: string;
    logline?: string;
    genre?: string;
    tone?: string;
    visualStyle?: string;
    language?: string;
    storySoFar?: string;
    globalOutline?: string[];
    rules?: string[];
    userId?: string;
};

export type AssistantSceneContext = {
    _id?: { toString(): string } | string;
    sequenceNumber?: number;
    slugline?: string;
    summary?: string;
    goal?: string;
    content?: string;
    previousSceneSummary?: string;
    charactersInvolved?: Array<{ toString(): string } | string>;
    assistantChatHistory?: AssistantHistoryEntry[];
};

export type EmbeddedQueryVariant = {
    key: 'intent' | 'content' | 'style' | 'expansion';
    text: string;
    embedding: number[];
};

export type RankedCandidate = {
    sample: ScoredSample;
    matchedQueries: Set<string>;
    strictCharacterMatch?: boolean;
    languageMatched?: boolean;
    sourceType?: 'screenplay' | 'literature' | 'dictionary' | 'fallback';
    id?: string;
    score?: number;
    queryKey?: string;
    isProjectCandidate?: boolean;
};

export type AssistantReference = {
    group: AssistantReferenceGroup;
    sourceFamily: AssistantSourceFamily;
    label: string;
    excerpt: string;
    parentContext?: string;
    elementType?: string;
    chunkType?: string;
    source?: string;
    sampleId?: string;
    masterScriptId?: string;
    sourceType?: string;
    score: number;
};

export type AssistantRetrievalMetadata = {
    mode: AssistantMode;
    target: AssistantTarget;
    queryVariants: Array<{ key: string; preview: string; length: number }>;
    candidateCounts: {
        project: number;
        master: number;
        recent: number;
        continuity: number;
    };
    sourceMix: {
        project: number;
        master: number;
        recent: number;
        continuity: number;
    };
    selectedReferences: Array<{
        group: AssistantReferenceGroup;
        sourceFamily: AssistantSourceFamily;
        label: string;
        score: number;
        sampleId?: string;
        masterScriptId?: string;
        chunkType?: string;
        elementType?: string;
        sourceType?: string;
    }>;
    languageFallbackUsed: boolean;
    eligibleMasterScriptCount: number;
    exactLanguageMasterCount: number;
};

export type AssistantReferencePack = {
    promptSections: string;
    persistentDirectives: string;
    transliteration_rules: string;
    retrievalMetadata: AssistantRetrievalMetadata;
};

export type BuildAssistantReferencePackParams = {
    instruction: string;
    mode: AssistantMode;
    target: AssistantTarget;
    language: string;
    transliteration?: boolean;
    currentContent?: string;
    selection?: AssistantSelectionLike | null;
    bible?: AssistantBibleContext | null;
    scene?: AssistantSceneContext | null;
    userInterests?: AssistantUserInterests | null;
    lite?: boolean;
};
