import type { AssistantPreferences } from './project.api';

import type {
    ScriptTemplates,
    ScriptRequest,
    ScriptHistoryItem,
    IScriptDetail,
    IMasterScript,
    ProcessMasterScriptResponse,
    MasterScriptValidationReport,
    MasterScriptReconstruction,
    VoiceIngestResult,
    AssistedEditOptions,
    ProjectAssistantOptions,
    CritiqueResult
} from './scriptWriter.types';

export type {
    ScriptTemplates,
    ScriptRequest,
    ScriptHistoryItem,
    IScriptDetail,
    IMasterScript,
    ProcessMasterScriptResponse,
    MasterScriptValidationReport,
    MasterScriptReconstruction,
    VoiceIngestResult,
    AssistedEditOptions,
    ProjectAssistantOptions,
    CritiqueResult
};

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


// Microservice runs on a different port (5003)


import { baseApi } from './base.api';

export type ScriptWriterAssistantIntent = 'chat' | 'selection_edit' | 'scene_edit' | 'ambiguous';

class ScriptWriterApi {

    async getTemplates(): Promise<ScriptTemplates> {
        return baseApi.request<ScriptTemplates>('/script/templates');
    }

    async getHistory(_userId?: string): Promise<ScriptHistoryItem[]> {
        const data = await baseApi.request<ScriptHistoryItem[]>('/script/history');
        return (data || []).filter(Boolean);
    }

    async getScript(id: string): Promise<IScriptDetail> {
        return baseApi.request<IScriptDetail>(`/script/history/${id}`);
    }

    async getScene(id: string): Promise<any> {
        return baseApi.request<any>(`/scene/${id}`);
    }

    async generateScriptStream(
        request: ScriptRequest,
        onChunk: (chunk: string) => void,
        signal?: AbortSignal
    ): Promise<void> {
        await baseApi.streamRequest('/script/generate', request, onChunk, signal);
    }

    async ingestVoiceSample(bibleId: string, file: File, characterId?: string): Promise<VoiceIngestResult> {
        const formData = new FormData();
        formData.append('bibleId', bibleId);
        formData.append('file', file);
        if (characterId) {
            formData.append('characterId', characterId);
        }

        return baseApi.request<VoiceIngestResult>('/script/voice/ingest', {
            method: 'POST',
            body: formData
        });
    }

    async getAIProvider(): Promise<string> {
        const data = await baseApi.request<{ provider: string }>('/script/ai/provider');
        return data.provider;
    }

    async setAIProvider(provider: string): Promise<string> {
        const data = await baseApi.request<{ provider: string }>('/script/ai/provider', {
            method: 'POST',
            body: JSON.stringify({ provider })
        });
        return data.provider;
    }

    async getVoiceSources(bibleId: string, characterId?: string): Promise<any[]> {
        return baseApi.request<any[]>(`/script/voice/sources?bibleId=${bibleId}${characterId ? `&characterId=${characterId}` : ''}`);
    }

    async deleteVoiceSource(bibleId: string, source: string, characterId?: string): Promise<void> {
        await baseApi.request('/script/voice/delete-source', {
            method: 'DELETE',
            body: JSON.stringify({ bibleId, source, characterId })
        });
    }

    // Admin Master Scripts (PH 23)
    async getMasterScripts(): Promise<IMasterScript[]> {
        const data = await baseApi.request<IMasterScript[]>('/script/admin/master-scripts');
        return (data || []).filter(Boolean);
    }

    async createMasterScript(data: Partial<IMasterScript> & { file?: File }): Promise<IMasterScript> {
        const url = '/script/admin/master-scripts';

        if (data.file) {
            const formData = new FormData();
            if (data.title) formData.append('title', data.title);
            if (data.director) formData.append('director', data.director);
            if (data.language) formData.append('language', data.language);
            if (data.tags && Array.isArray(data.tags)) formData.append('tags', JSON.stringify(data.tags));
            else if (data.tags) formData.append('tags', data.tags as any);
            if (data.rawContent) formData.append('rawContent', data.rawContent);
            formData.append('file', data.file);

            return baseApi.request<IMasterScript>(url, {
                method: 'POST',
                body: formData
            });
        }

        return baseApi.request<IMasterScript>(url, {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }

    async processMasterScript(id: string): Promise<ProcessMasterScriptResponse> {
        return baseApi.request<ProcessMasterScriptResponse>(`/script/admin/master-scripts/${id}/process`, {
            method: 'POST'
        });
    }

    async deleteMasterScript(id: string): Promise<{ message: string }> {
        return baseApi.request<{ message: string }>(`/script/admin/master-scripts/${id}`, {
            method: 'DELETE'
        });
    }

    async getMasterScriptChunks(id: string, scriptVersion?: string): Promise<any[]> {
        const query = scriptVersion ? `?scriptVersion=${scriptVersion}` : '';
        const data = await baseApi.request<any[]>(`/script/admin/master-scripts/${id}/chunks${query}`);
        return (data || []).filter(Boolean);
    }

    async getMasterScriptReconstruction(id: string, scriptVersion?: string): Promise<MasterScriptReconstruction> {
        const query = scriptVersion ? `?scriptVersion=${scriptVersion}` : '';
        return baseApi.request<MasterScriptReconstruction>(`/script/admin/master-scripts/${id}/reconstructed${query}`);
    }

    async getMasterScriptValidationReport(id: string, scriptVersion?: string): Promise<MasterScriptValidationReport | null> {
        const query = scriptVersion ? `?scriptVersion=${scriptVersion}` : '';
        return baseApi.request<MasterScriptValidationReport | null>(`/script/admin/master-scripts/${id}/validation-report${query}`);
    }

    // Assisted Edit / Assistant Flow (PH 35/36)
    async assistedEditStream(
        sceneId: string,
        instruction: string,
        onChunk: (chunk: string) => void,
        options: AssistedEditOptions = {},
        signal?: AbortSignal
    ): Promise<void> {
        await baseApi.streamRequest(`/script/scene/${sceneId}/assisted-edit`, {
            instruction,
            ...options
        }, onChunk, signal);
    }

    async projectAssistantStream(
        bibleId: string,
        instruction: string,
        onChunk: (chunk: string) => void,
        options: ProjectAssistantOptions = {},
        signal?: AbortSignal
    ): Promise<void> {
        await baseApi.streamRequest(`/script/bible/${bibleId}/assistant`, {
            instruction,
            ...options
        }, onChunk, signal);
    }

    async commitEdit(sceneId: string): Promise<{ success: boolean }> {
        return baseApi.request<{ success: boolean }>(`/script/scene/${sceneId}/commit-edit`, {
            method: 'POST'
        });
    }

    async discardEdit(sceneId: string): Promise<{ success: boolean }> {
        return baseApi.request<{ success: boolean }>(`/script/scene/${sceneId}/discard-edit`, {
            method: 'POST'
        });
    }

    async getAssistantHistory(sceneId: string): Promise<any[]> {
        const data = await baseApi.request<any[]>(`/script/scene/${sceneId}/assistant-history`);
        return (data || []).filter(Boolean);
    }

    async deleteAssistantHistory(sceneId: string, messageId?: string): Promise<any[]> {
        const data = await baseApi.request<any[]>(`/script/scene/${sceneId}/assistant-history`, {
            method: 'DELETE',
            body: JSON.stringify({ messageId })
        });
        return (data || []).filter(Boolean);
    }

    async updateAssistantHistory(sceneId: string, messageId: string, content: string): Promise<any[]> {
        const data = await baseApi.request<any[]>(`/script/scene/${sceneId}/assistant-history`, {
            method: 'PUT',
            body: JSON.stringify({ messageId, content })
        });
        return (data || []).filter(Boolean);
    }

    async classifyIntent(
        instruction: string,
        context: { hasScene?: boolean; hasSelection?: boolean; currentMode?: string },
    ): Promise<{ intent: ScriptWriterAssistantIntent; confidence: number }> {
        return baseApi.request<{ intent: ScriptWriterAssistantIntent; confidence: number }>('/script/assistant/classify', {
            method: 'POST',
            body: JSON.stringify({ instruction, context })
        });
    }

    async critiqueScene(sceneId: string, content?: string): Promise<CritiqueResult> {
        return baseApi.request<CritiqueResult>(`/script/scene/${sceneId}/critique`, {
            method: 'POST',
            body: JSON.stringify({ content })
        });
    }

    async fixScene(sceneId: string, content: string, instruction: string): Promise<{
        content: string;
        critique: CritiqueResult;
        auditNotes: string;
        isSuperior: boolean;
        benchmarkScore: number;
    }> {
        return baseApi.request<any>(`/script/scene/${sceneId}/fix`, {
            method: 'POST',
            body: JSON.stringify({ content, instruction })
        });
    }

    // Version & Snapshot Management
    async listSnapshots(bibleId: string, branch?: string): Promise<any[]> {
        const query = branch ? `?branch=${encodeURIComponent(branch)}` : '';
        const response = await baseApi.request<{ data: any[] }>(`/script/snapshot/bible/${bibleId}${query}`);
        return response.data || [];
    }

    async saveSnapshot(bibleId: string, data: { label: string; description?: string; branch?: string }): Promise<any> {
        const response = await baseApi.request<{ data: any }>(`/script/snapshot/bible/${bibleId}`, {
            method: 'POST',
            body: JSON.stringify(data)
        });
        return response.data;
    }

    async getSnapshot(id: string): Promise<any> {
        const response = await baseApi.request<{ data: any }>(`/script/snapshot/${id}`);
        return response.data;
    }

    async restoreSnapshot(id: string): Promise<any> {
        const response = await baseApi.request<{ data: any }>(`/script/snapshot/${id}/restore`, {
            method: 'POST'
        });
        return response.data;
    }

    async deleteSnapshot(id: string): Promise<void> {
        await baseApi.request(`/script/snapshot/${id}`, {
            method: 'DELETE'
        });
    }

    async listBranches(bibleId: string): Promise<string[]> {
        const response = await baseApi.request<{ data: string[] }>(`/script/snapshot/bible/${bibleId}/branches`);
        return response.data || [];
    }

    // Script Analysis
    async analyzeDialogueRhythm(sceneId: string): Promise<any> {
        const response = await baseApi.request<{ data: any }>(`/script/snapshot/analyze/dialogue/${sceneId}`, {
            method: 'POST'
        });
        return response.data;
    }

    async analyzeStructure(bibleId: string): Promise<any> {
        const response = await baseApi.request<{ data: any }>(`/script/snapshot/analyze/structure/${bibleId}`, {
            method: 'POST'
        });
        return response.data;
    }
}


export const scriptWriterApi = new ScriptWriterApi();
