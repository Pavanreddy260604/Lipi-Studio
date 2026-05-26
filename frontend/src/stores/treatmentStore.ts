import { create } from 'zustand';
import { treatmentApi } from '../services/treatment.api';
import type { Treatment, Act } from '../services/treatment.api';

export interface ParsedBeat {
    name: string;
    title: string;
    slugline?: string;
    description: string;
    summary?: string;
}

export interface ParsedAct {
    name: string;
    beats: ParsedBeat[];
}

export interface BeatAgentGeneration {
    bibleId: string;
    selectedStructure: string;
    sceneCount: number;
    parsedActs: ParsedAct[];
    state: 'idle' | 'generating' | 'done' | 'error';
    rawOutput: string;
    error: string | null;
}

interface TreatmentStore {
    treatments: Treatment[];
    currentPreview: Act[] | null;
    isLoading: boolean;
    error: string | null;
    activeGeneration: BeatAgentGeneration | null;

    loadTreatments: (bibleId: string) => Promise<void>;
    generatePreview: (logline: string, style?: string) => Promise<void>;
    saveCurrentTreatment: (bibleId: string, logline: string) => Promise<void>;
    convertToScenes: (treatmentId: string) => Promise<void>;
    clearPreview: () => void;

    generateBeatAgentOutlineStream: (
        bibleId: string,
        logline: string,
        structureType: string,
        sceneCount: number,
        customInstructions?: string,
        signal?: AbortSignal
    ) => Promise<void>;
    clearActiveGeneration: () => void;
}

export const useTreatmentStore = create<TreatmentStore>((set, get) => ({
    treatments: [],
    currentPreview: null,
    isLoading: false,
    error: null,
    activeGeneration: null,

    loadTreatments: async (bibleId: string) => {
        set({ isLoading: true, error: null });
        try {
            const treatments = await treatmentApi.getTreatments(bibleId);
            set({ treatments, isLoading: false });
        } catch (error: any) {
            set({ error: error.message, isLoading: false });
        }
    },

    generatePreview: async (logline: string, style = 'Save The Cat') => {
        set({ isLoading: true, error: null, currentPreview: null });
        try {
            const acts = await treatmentApi.generateTreatment(logline, style);
            set({ currentPreview: acts, isLoading: false });
        } catch (error: any) {
            set({ error: error.message, isLoading: false });
        }
    },

    saveCurrentTreatment: async (bibleId: string, logline: string) => {
        const { currentPreview } = get();
        if (!currentPreview) return;

        set({ isLoading: true, error: null });
        try {
            const newTreatment = await treatmentApi.saveTreatment(bibleId, logline, currentPreview);
            set(state => ({
                treatments: [newTreatment, ...state.treatments],
                currentPreview: null,
                isLoading: false
            }));
        } catch (error: any) {
            set({ error: error.message, isLoading: false });
        }
    },

    convertToScenes: async (treatmentId: string) => {
        set({ isLoading: true, error: null });
        try {
            await treatmentApi.convertToScenes(treatmentId);
            set({ isLoading: false });
        } catch (error: any) {
            set({ error: error.message, isLoading: false });
        }
    },

    clearPreview: () => set({ currentPreview: null, error: null }),

    clearActiveGeneration: () => set({ activeGeneration: null }),

    generateBeatAgentOutlineStream: async (
        bibleId: string,
        logline: string,
        structureType: string,
        sceneCount: number,
        customInstructions?: string,
        signal?: AbortSignal
    ) => {
        set({
            activeGeneration: {
                bibleId,
                selectedStructure: structureType,
                sceneCount,
                parsedActs: [],
                state: 'generating',
                rawOutput: '',
                error: null
            }
        });

        try {
            const stream = await treatmentApi.generateBeatAgentOutline(
                bibleId,
                logline,
                structureType,
                sceneCount,
                customInstructions,
                [],
                signal
            );

            const reader = stream.getReader();
            const decoder = new TextDecoder();
            let accumulated = '';
            let lastStoreUpdate = 0;

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                const chunk = decoder.decode(value, { stream: true });
                accumulated += chunk;

                // Progressively parse the streaming JSON to render scene cards in real-time
                let mappedActs: ParsedAct[] = [];
                const closers = ['', '\n]\n}', '\n]\n}\n]', '\n      ]\n    }\n  ]\n}'];
                    for (const closer of closers) {
                    try {
                        const partialJson = (accumulated.trim().replace(/^```json\s*/i, '') + closer);
                        const firstBrace = partialJson.indexOf('{');
                        if (firstBrace !== -1) {
                            const parsed = JSON.parse(partialJson.substring(firstBrace));
                            const acts = parsed.acts || (Array.isArray(parsed) ? parsed : [parsed]);
                            if (acts && acts.length > 0) {
                                mappedActs = acts.map((act: any) => ({
                                    name: act.name || 'Untitled Act',
                                    beats: (act.beats || []).map((beat: any) => ({
                                        name: beat.name,
                                        title: beat.title || '',
                                        slugline: beat.slugline || '',
                                        description: beat.description || beat.summary || ''
                                    }))
                                }));
                                break;
                            }
                        }
                    } catch (e) {
                        // Ignore parse errors on incomplete chunks
                    }
                }

                // Throttle: only update store every 100ms max
                const now = Date.now();
                if (now - lastStoreUpdate > 100 || done) {
                    lastStoreUpdate = now;
                    set(state => {
                        if (!state.activeGeneration) return state;
                        return {
                            activeGeneration: {
                                ...state.activeGeneration,
                                rawOutput: accumulated,
                                parsedActs: mappedActs.length > 0 ? mappedActs : state.activeGeneration.parsedActs
                            }
                        };
                    });
                }
            }

            // Once fully done, parse final JSON
            try {
                let jsonStr = accumulated.trim();
                jsonStr = jsonStr.replace(/^```json\s*/i, '').replace(/\s*```$/, '');
                const firstBrace = jsonStr.indexOf('{');
                const lastBrace = jsonStr.lastIndexOf('}');
                if (firstBrace !== -1 && lastBrace !== -1) {
                    jsonStr = jsonStr.substring(firstBrace, lastBrace + 1);
                }
                const data = JSON.parse(jsonStr);
                const acts = data.acts || (Array.isArray(data) ? data : [data]);
                const finalMapped: ParsedAct[] = acts.map((act: any) => ({
                    name: act.name || 'Untitled Act',
                    beats: (act.beats || []).map((beat: any) => ({
                        name: beat.name,
                        title: beat.title || '',
                        slugline: beat.slugline || '',
                        description: beat.description || beat.summary || ''
                    }))
                }));

                set(state => {
                    if (!state.activeGeneration) return state;
                    return {
                        activeGeneration: {
                            ...state.activeGeneration,
                            parsedActs: finalMapped,
                            state: 'done'
                        }
                    };
                });

                // Reload saved treatments
                const store = get();
                await store.loadTreatments(bibleId);
            } catch {
                set(state => {
                    if (!state.activeGeneration) return state;
                    return {
                        activeGeneration: {
                            ...state.activeGeneration,
                            state: 'done'
                        }
                    };
                });
            }
        } catch (error: any) {
            set(state => {
                if (!state.activeGeneration) return state;
                return {
                    activeGeneration: {
                        ...state.activeGeneration,
                        state: 'error',
                        error: error.message || 'Generation failed'
                    }
                };
            });
        }
    }
}));
