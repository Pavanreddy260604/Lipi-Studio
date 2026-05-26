// Frontend interfaces (avoiding cross-project dependencies)

export interface AssistantPreferences {
    defaultMode: 'ask' | 'edit' | 'agent';
    replyLanguage?: string;
    transliteration?: boolean;
    savedDirectives: string[];
}

export interface StoryResource {
    _id?: string;
    title: string;
    content?: string;
    type: 'synopsis' | 'novel_excerpt' | 'treatment' | 'reference' | 'notes' | 'other';
    sourceFilename?: string;
    addedAt?: string;
    contentLength?: number;
}

export interface BeatSheetStructureInfo {
    name: string;
    description: string;
    beatCount: string;
}

export interface Bible {
    _id: string;
    title: string;
    logline: string;
    genre: string;
    tone: string;
    language?: string;
    transliteration?: boolean;
    visualStyle?: string;
    rules?: string[];
    targetSceneCount?: number;
    storyResources?: StoryResource[];
    assistantPreferences?: AssistantPreferences;
    ignoredCharacterNames?: string[];
    createdAt: string;
}

import type { CritiqueResult } from './scriptWriter.types';
export type { CritiqueResult };

export interface IScene {
    _id: string;
    bibleId: string;
    sequenceNumber: number;
    title?: string;
    slugline: string;
    summary: string;
    content: string;
    status: 'planned' | 'drafted' | 'reviewed' | 'final';
    goal?: string;
    critique?: CritiqueResult;
    lastCritiqueContent?: string;
    pendingContent?: string;
    lastInstruction?: string;
    assistantChatHistory?: any[];
    images?: string[];
    comments?: any[];
    highScore?: {
        content: string;
        critique: CritiqueResult;
        savedAt: string;
    };
    createdAt?: string;
    updatedAt?: string;
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
        priority: 'high' | 'medium' | 'low';
        reason: string;
    }>;
    syncToken: string;
    generatedAt: string;
}

import { baseApi } from './base.api';

export const projectApi = {
    // Projects (Bibles)
    listProjects: async (_userId?: string): Promise<Bible[]> => {
        const data = await baseApi.request<Bible[]>('/script/bible');
        return (data || []).filter(Boolean);
    },

    createProject: async (_userId: string, data: Partial<Bible>): Promise<Bible> => {
        return baseApi.request<Bible>('/script/bible', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    },

    getProject: async (id: string): Promise<Bible> => {
        return baseApi.request<Bible>(`/script/bible/${id}`);
    },

    getProjectStatus: async (id: string): Promise<ProjectStatusSummary> => {
        return baseApi.request<ProjectStatusSummary>(`/script/bible/${id}/status`);
    },

    // Scenes
    listScenes: async (bibleId: string): Promise<IScene[]> => {
        const data = await baseApi.request<IScene[]>(`/script/scene/bible/${bibleId}`);
        return (data || []).filter(Boolean);
    },

    createScene: async (bibleId: string, data: Partial<IScene>): Promise<IScene> => {
        return baseApi.request<IScene>('/script/scene', {
            method: 'POST',
            body: JSON.stringify({ bibleId, ...data }),
        });
    },

    updateScene: async (sceneId: string, data: Partial<IScene>): Promise<IScene> => {
        return baseApi.request<IScene>(`/script/scene/${sceneId}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        });
    },

    // Delete a scene
    deleteScene: async (sceneId: string): Promise<void> => {
        await baseApi.request(`/script/scene/${sceneId}`, {
            method: 'DELETE',
        });
    },

    // Update a project
    updateProject: async (projectId: string, data: Partial<Bible>): Promise<Bible> => {
        return baseApi.request<Bible>(`/script/bible/${projectId}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        });
    },

    // Delete a project (and all its scenes)
    deleteProject: async (projectId: string): Promise<void> => {
        await baseApi.request(`/script/bible/${projectId}`, {
            method: 'DELETE',
        });
    },

    // Generation
    generateScene: async (sceneId: string, _userId: string, options: any): Promise<ReadableStream> => {
        const res = await baseApi.requestRaw(`/script/scene/${sceneId}/generate`, {
            method: 'POST',
            body: JSON.stringify({ ...options }),
        });
        if (!res.body) throw new Error('Generation failed: No response body');
        return res.body;
    },

    // Critique
    critiqueScene: async (sceneId: string, content?: string): Promise<CritiqueResult> => {
        if (import.meta.env.DEV) {
            console.log('[API] critiqueScene payload:', { sceneId, contentLength: content?.length, contentPreview: content?.slice(0, 50) });
        }
        return baseApi.request<CritiqueResult>(`/script/scene/${sceneId}/critique`, {
            method: 'POST',
            body: JSON.stringify({ content }),
        });
    },

    fixScene: async (sceneId: string): Promise<{
        content: string;
        critique: any;
        auditNotes: string;
        isSuperior: boolean;
        benchmarkScore: number;
    }> => {
        return baseApi.request<{
            content: string;
            critique: any;
            auditNotes: string;
            isSuperior: boolean;
            benchmarkScore: number;
        }>(`/script/scene/${sceneId}/fix`, {
            method: 'POST',
        });
    },

    // Export
    exportProject: async (bibleId: string, format: 'fountain' | 'txt' | 'json' | 'pdf'): Promise<void> => {
        const res = await baseApi.requestRaw(`/script/bible/${bibleId}/export?format=${format}`);

        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `script_export.${format}`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
    },

    // Beat Sheet Generation (streaming)
    generateBeatSheet: async (
        bibleId: string,
        structureType: string,
        targetSceneCount?: number,
        customInstructions?: string
    ): Promise<ReadableStream> => {
        const res = await baseApi.requestRaw(`/script/bible/${bibleId}/beat-sheet`, {
            method: 'POST',
            body: JSON.stringify({ structureType, targetSceneCount, customInstructions }),
        });
        if (!res.body) throw new Error('Beat sheet generation failed');
        return res.body;
    },

    // Beat Sheet Structures
    getBeatSheetStructures: async (bibleId: string): Promise<Record<string, BeatSheetStructureInfo>> => {
        return baseApi.request<Record<string, BeatSheetStructureInfo>>(`/script/bible/${bibleId}/beat-sheet/structures`);
    },

    // Story Resources
    getResources: async (bibleId: string): Promise<StoryResource[]> => {
        return baseApi.request<StoryResource[]>(`/script/bible/${bibleId}/resources`);
    },

    addResource: async (bibleId: string, resource: { title: string; content: string; type: string }): Promise<StoryResource[]> => {
        return baseApi.request<StoryResource[]>(`/script/bible/${bibleId}/resources`, {
            method: 'POST',
            body: JSON.stringify(resource),
        });
    },

    uploadResource: async (bibleId: string, file: File, title?: string): Promise<{ data: StoryResource[]; extractedChars: number }> => {
        const formData = new FormData();
        formData.append('file', file);
        if (title) formData.append('title', title);
        const res = await baseApi.requestRaw(`/script/bible/${bibleId}/resources/upload`, {
            method: 'POST',
            body: formData,
        });
        const json = await res.json();
        if (!json.success) throw new Error(json.error || 'Upload failed');
        return { data: json.data, extractedChars: json.extractedChars };
    },

    deleteResource: async (bibleId: string, resourceId: string): Promise<StoryResource[]> => {
        return baseApi.request<StoryResource[]>(`/script/bible/${bibleId}/resources/${resourceId}`, {
            method: 'DELETE',
        });
    },
};
