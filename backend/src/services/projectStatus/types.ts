export type SceneStatus = 'planned' | 'drafted' | 'reviewed' | 'final';
export type NextActionPriority = 'high' | 'medium' | 'low';

export interface StatusProjectInput {
    _id: unknown;
    title?: string;
    logline?: string;
    genre?: string;
    tone?: string;
    language?: string;
    targetSceneCount?: number;
    storyResources?: unknown[];
    assistantPreferences?: unknown;
    createdAt?: Date | string;
    updatedAt?: Date | string;
}

export interface StatusSceneInput {
    _id: unknown;
    sequenceNumber?: number;
    title?: string;
    slugline?: string;
    summary?: string;
    goal?: string;
    content?: string;
    status?: SceneStatus;
    updatedAt?: Date | string;
    critique?: {
        score?: number;
        grade?: string;
        summary?: string;
        formattingIssues?: string[];
        dialogueIssues?: string[];
        pacingIssues?: string[];
        suggestions?: string[];
    };
    lastCritiqueContent?: string;
    highScore?: {
        critique?: {
            score?: number;
        };
        savedAt?: Date | string;
    };
    assistantChatHistory?: Array<{
        role?: string;
        type?: string;
        content?: string;
        status?: string;
        timestamp?: Date | string;
    }>;
}

export interface ProjectStatusSummary {
    project: {
        id: string;
        title: string;
        genre?: string;
        tone?: string;
        language?: string;
        targetSceneCount: number;
        createdAt?: string;
        updatedAt?: string;
    };
    readiness: {
        hasLogline: boolean;
        hasScenes: boolean;
        hasDraftedContent: boolean;
        hasCharacters: boolean;
        hasStoryResources: boolean;
        hasTreatment: boolean;
        readyScore: number;
        blockers: string[];
    };
    pipeline: {
        totalScenes: number;
        plannedScenes: number;
        draftedScenes: number;
        reviewedScenes: number;
        finalScenes: number;
        emptyScenes: number;
        scenesWithSummary: number;
        wordCount: number;
        latestSceneUpdatedAt?: string;
        progressPercent: number;
    };
    quality: {
        reviewedScenes: number;
        staleCritiqueScenes: number;
        averageScore: number | null;
        bestScore: number | null;
        scenesNeedingReview: string[];
    };
    assistant: {
        totalMessages: number;
        pendingProposals: number;
        lastActivityAt?: string;
    };
    snapshots: {
        count: number;
        branches: string[];
        latestSnapshotAt?: string;
    };
    export: {
        ready: boolean;
        formats: Array<'fountain' | 'txt' | 'json' | 'pdf'>;
        blockers: string[];
    };
    nextActions: Array<{
        id: string;
        label: string;
        priority: NextActionPriority;
        reason: string;
    }>;
    syncToken: string;
    generatedAt: string;
}

export interface ProjectStatusBuildInput {
    project: StatusProjectInput;
    scenes: StatusSceneInput[];
    characterCount: number;
    treatmentCount: number;
    snapshotCount: number;
    latestSnapshotAt?: Date | string | null;
    branches: string[];
}
