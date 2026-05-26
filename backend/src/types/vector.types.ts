export interface VectorNodeDTO {
    id: string;
    content: string;
    embedding: number[];
    metadata: {
        bibleId?: string;
        masterScriptId?: string;
        characterId?: string;
        contentHash?: string;
        speaker?: string;
        era?: string;
        language?: string;
        tactic?: string;
        emotion?: string;
        chunkType?: string;
        chunkIndex?: number;
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
    };
}
