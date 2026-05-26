import { create } from 'zustand';
import { characterApi } from '../services/character.api';
import type { Character } from '../services/character.api';

interface CharacterStore {
    characters: Character[];
    isLoading: boolean;
    error: string | null;

    loadCharacters: (bibleId: string) => Promise<void>;
    createCharacter: (bibleId: string, name: string, archetype?: string) => Promise<Character>;
    updateCharacter: (id: string, updates: Partial<Character>) => Promise<void>;
    deleteCharacter: (id: string) => Promise<void>;
}

export const useCharacterStore = create<CharacterStore>((set) => ({
    characters: [],
    isLoading: false,
    error: null,

    loadCharacters: async (bibleId: string) => {
        set({ isLoading: true, error: null });
        try {
            const characters = await characterApi.getCharacters(bibleId);
            set({ characters, isLoading: false });
        } catch (error: any) {
            set({ error: error.message, isLoading: false });
        }
    },

    createCharacter: async (bibleId: string, name: string, archetype = 'supporting') => {
        set({ isLoading: true, error: null });
        try {
            const newChar = await characterApi.createCharacter({
                bibleId,
                name,
                role: archetype as any
            });
            set(state => ({
                characters: [...state.characters, newChar],
                isLoading: false
            }));
            return newChar;
        } catch (error: any) {
            set({ error: error.message, isLoading: false });
            throw error;
        }
    },

    updateCharacter: async (id: string, updates: Partial<Character>) => {
        try {
            const updated = await characterApi.updateCharacter(id, updates);
            set(state => ({
                characters: state.characters.map(c => c._id === id ? updated : c)
            }));
        } catch (error: any) {
            set({ error: error.message });
        }
    },

    deleteCharacter: async (id: string) => {
        try {
            await characterApi.deleteCharacter(id);
            set(state => ({
                characters: state.characters.filter(c => c._id !== id)
            }));
        } catch (error: any) {
            set({ error: error.message });
        }
    }
}));
