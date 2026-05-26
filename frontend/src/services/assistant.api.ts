import { baseApi } from './base.api';

export interface AssistedEditSelection {
    text: string;
    start?: number;
    end?: number;
    lineStart?: number;
    lineEnd?: number;
    lineCount?: number;
    charCount?: number;
    preview?: string;
}

export interface AssistedEditOptions {
    language?: string;
    mode?: 'ask' | 'edit' | 'agent';
    target?: 'scene' | 'selection';
    currentContent?: string;
    selection?: AssistedEditSelection | null;
    transliteration?: boolean;
    model?: string;
    images?: string[];
}

export class AssistantApiService {
    /**
     * Streams an AI refactor of a scene or selection.
     */
    async streamAssistedEdit(
        sceneId: string,
        instruction: string,
        onChunk: (chunk: string) => void,
        options: AssistedEditOptions = {},
        signal?: AbortSignal
    ): Promise<void> {
        return baseApi.streamRequest(
            `/scene/${sceneId}/assisted-edit`,
            {
                instruction,
                ...options
            },
            onChunk,
            signal
        );
    }

    /**
     * Commits a pending AI proposal to the scene.
     */
    async commitEdit(sceneId: string) {
        return baseApi.request<{ success: boolean }>(`/scene/${sceneId}/commit-edit`, {
            method: 'POST'
        });
    }

    /**
     * Discards a pending AI proposal.
     */
    async discardEdit(sceneId: string) {
        return baseApi.request<{ success: boolean }>(`/scene/${sceneId}/discard-edit`, {
            method: 'POST'
        });
    }
}

export const assistantApi = new AssistantApiService();
