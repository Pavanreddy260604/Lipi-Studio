export interface ScoredSample {
    _id: string;
    bibleId: string;
    characterId?: string;
    content: string;
    contentHash?: string;
    speaker?: string;
    era?: string;
    language?: string;
    tactic?: string;
    emotion?: string;
    masterScriptId?: string;
    chunkType?: string;
    chunkIndex?: number;
    embedding?: number[];
    tags?: string[];
    source?: string;
    parentNodeId?: string;
    isHierarchicalNode?: boolean;
    scriptVersion?: string;
    parserVersion?: string;
    chunkId?: string;
    sceneSeq?: number;
    elementSeq?: number;
    elementType?: string;
    sourceStartLine?: number;
    sourceEndLine?: number;
    sourceLineIds?: string[];
    dualDialogue?: boolean;
    sceneNumber?: string;
    nonPrinting?: boolean;
    ingestState?: string;
    parentContent?: string;
    similarityScore: number;
}

export interface FindSimilarOptions {
    minSimilarity?: number;
    maxLength?: number;
    dedupe?: boolean;
    era?: string;
    language?: string;
    scopeType?: 'bibleId' | 'masterScriptId';
    allowedScopeIds?: string[];
    interests?: {
        directors: string[];
        genres: string[];
        styles: string[];
    };
    includeParentContext?: boolean;
    includeHierarchicalNodes?: boolean;
    scriptVersion?: string;
    ingestState?: 'staging' | 'active' | 'archived';
}

export function toQdrantId(mongoId: string): string {
    const hex = mongoId.replace(/-/g, '');
    const padded = hex.length >= 32 ? hex.slice(0, 32) : hex.padStart(32, '0');
    return `${padded.slice(0,8)}-${padded.slice(8,12)}-${padded.slice(12,16)}-${padded.slice(16,20)}-${padded.slice(20,32)}`;
}

export function fromQdrantId(qdrantId: string): string {
    const hex = qdrantId.replace(/-/g, '');
    return hex.replace(/^0+/, '').padStart(24, '0');
}
