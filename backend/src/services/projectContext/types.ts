export interface ActiveSceneBrief {
    sequenceNumber: number;
    title?: string;
    slugline: string;
    summary: string;
    goal?: string;
}

export interface ProjectContext {
    activeScene?: ActiveSceneBrief;
    project: {
        title: string;
        logline: string;
        genre: string;
        tone: string;
        language: string;
        visualStyle?: string;
        rules: string[];
        globalOutline: string[];
        storySoFar: string;
        transliteration: boolean;
        targetSceneCount: number;
    };
    scenes: Array<{
        sequenceNumber: number;
        title?: string;
        slugline: string;
        summary: string;
        goal?: string;
        status: string;
        content?: string;
    }>;
    characters: Array<{
        name: string;
        role: string;
        description?: string;
        motivation?: string;
        traits?: string;
    }>;
    storyResources: Array<{
        title: string;
        type: string;
        content: string;
    }>;
    lore?: {
        entities: Array<{
            name: string;
            type: 'character' | 'location' | 'object' | 'faction';
            description?: string;
        }>;
        relations: Array<{
            source: string;
            type: string;
            target: string;
            description?: string;
        }>;
    };
}
