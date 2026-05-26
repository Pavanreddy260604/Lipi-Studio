
import { baseApi } from './base.api';





export interface Character {
    _id: string;
    bibleId: string;
    name: string;
    role: 'protagonist' | 'antagonist' | 'supporting' | 'minor';
    isHero?: boolean;
    voice?: {
        description?: string;
        accent?: string;
    };
    traits?: string[];
    motivation?: string;
    historyLogs?: { sceneNumber: number; event: string }[];
}

class CharacterApi {

    async getCharacters(bibleId: string): Promise<Character[]> {
        const data = await baseApi.request<Character[]>(`/script/character/bible/${bibleId}`);
        return (data || []).filter(Boolean);
    }

    async generateCharacterProfile(bibleId: string, prompt?: string, name?: string): Promise<any> {
        const response = await baseApi.request<any>('/script/character/generate-profile', {
            method: 'POST',
            body: JSON.stringify({ bibleId, prompt, name })
        });
        return response;
    }

    async createCharacter(character: Partial<Character>): Promise<Character> {
        return baseApi.request<Character>('/script/character', {
            method: 'POST',
            body: JSON.stringify(character)
        });
    }

    async updateCharacter(id: string, updates: Partial<Character>): Promise<Character> {
        return baseApi.request<Character>(`/script/character/${id}`, {
            method: 'PUT',
            body: JSON.stringify(updates)
        });
    }

    async deleteCharacter(id: string): Promise<void> {
        await baseApi.request(`/script/character/${id}`, {
            method: 'DELETE'
        });
    }

    async generateProactiveCasting(bibleId: string): Promise<any[]> {
        const data = await baseApi.request<any[]>(`/script/character/bible/${bibleId}/proactive-casting`, {
            method: 'POST'
        });
        return data || [];
    }

    async auditSceneCast(bibleId: string, sceneGoal: string, instruction: string): Promise<{ existingCharactersUsed: string[], newCharactersNeeded: any[] }> {
        const data = await baseApi.request<{ existingCharactersUsed: string[], newCharactersNeeded: any[] }>(`/script/character/bible/${bibleId}/audit-scene-cast`, {
            method: 'POST',
            body: JSON.stringify({ sceneGoal, instruction })
        });
        return data || { existingCharactersUsed: [], newCharactersNeeded: [] };
    }

    async ignoreCharacter(bibleId: string, name: string): Promise<string[]> {
        const data = await baseApi.request<string[]>(`/script/character/bible/${bibleId}/ignore-character`, {
            method: 'POST',
            body: JSON.stringify({ name })
        });
        return data || [];
    }

    async getRlhfMetrics(bibleId: string): Promise<any> {
        const data = await baseApi.request<any>(`/script/character/bible/${bibleId}/rlhf-metrics`, {
            method: 'GET'
        });
        return data;
    }

    async submitFeedback(bibleId: string, mistakeContext: string, userCorrection: string, category = 'voice', characterId?: string): Promise<any> {
        const response = await baseApi.request<any>('/script/character/feedback', {
            method: 'POST',
            body: JSON.stringify({ bibleId, characterId, mistakeContext, userCorrection, category })
        });
        return response;
    }
    async bulkCasting(bibleId: string, payload: { approvedCharacters: any[], ignoredNames: string[], locations: string[], extras: string[] }): Promise<any> {
        return baseApi.request<any>(`/script/character/bible/${bibleId}/bulk-casting`, {
            method: 'POST',
            body: JSON.stringify(payload)
        });
    }
}

export const characterApi = new CharacterApi();
