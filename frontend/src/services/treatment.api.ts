import { baseApi } from './base.api';
import type { Character } from './character.api';

export interface Beat {
    name: string;
    description: string;
}

export interface Act {
    name: string;
    beats: Beat[];
}

export interface Treatment {
    _id: string;
    bibleId: string;
    logline: string;
    style: string;
    acts: Act[];
}

class TreatmentApi {
    async generateTreatment(logline: string, style: string = 'Save The Cat', sceneCount: number = 60, characters: Character[] = [], bibleId?: string): Promise<Act[]> {
        const data = await baseApi.request<{ acts: Act[] }>('/script/treatment/generate', {
            method: 'POST',
            body: JSON.stringify({ logline, style, sceneCount, cast: characters, bibleId })
        });
        return data.acts;
    }

    async saveTreatment(bibleId: string, logline: string, acts: Act[], style: string = 'Save The Cat'): Promise<Treatment> {
        return baseApi.request<Treatment>('/script/treatment/save', {
            method: 'POST',
            body: JSON.stringify({ bibleId, logline, acts, style })
        });
    }

    async getTreatments(bibleId: string): Promise<Treatment[]> {
        return baseApi.request<Treatment[]>(`/script/treatment/bible/${bibleId}`);
    }

    async convertToScenes(treatmentId: string): Promise<void> {
        await baseApi.request('/script/treatment/convert', {
            method: 'POST',
            body: JSON.stringify({ treatmentId })
        });
    }

    // ============================================
    // SPECIALIZED BEAT SHEET AGENT (DIRECTOR AGENT)
    // ============================================

    async generateBeatAgentOutline(
        bibleId: string,
        logline: string,
        structureType: string,
        sceneCount: number,
        customInstructions?: string,
        cast: any[] = [],
        signal?: AbortSignal
    ): Promise<ReadableStream> {
        const res = await baseApi.requestRaw('/script/treatment/agent/generate', {
            method: 'POST',
            body: JSON.stringify({ bibleId, logline, structureType, sceneCount, customInstructions, cast }),
            signal
        });
        if (!res.body) throw new Error('Beat sheet generation failed');
        return res.body;
    }

    async updateBeatAgentCard(
        bibleId: string,
        beatIdOrName: string,
        updateFields: { title?: string; slugline?: string; description?: string; summary?: string }
    ): Promise<Treatment> {
        return baseApi.request<Treatment>('/script/treatment/agent/card', {
            method: 'PATCH',
            body: JSON.stringify({ bibleId, beatIdOrName, updateFields })
        });
    }

    async syncBeatAgentOutline(bibleId: string): Promise<any> {
        return baseApi.request<any>('/script/treatment/agent/sync', {
            method: 'POST',
            body: JSON.stringify({ bibleId })
        });
    }
}

export const treatmentApi = new TreatmentApi();
