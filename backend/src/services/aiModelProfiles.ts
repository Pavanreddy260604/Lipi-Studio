import type { ChatOptions } from './ai.interface';

export type AIModelProfile = 'instant' | 'balanced' | 'thinking' | 'deep' | 'search' | 'vision';

export interface AIModelProfileConfig {
    model: string;
    options: ChatOptions;
}

export const AI_MODEL_PROFILES: Record<AIModelProfile, AIModelProfileConfig> = {
    instant: {
        model: 'gemini-2.5-flash',
        options: {
            temperature: 0.35,
            max_tokens: 4096,
            top_k: 40
        }
    },
    balanced: {
        model: 'gemini-2.5-flash',
        options: {
            temperature: 0.7,
            max_tokens: 8192,
            top_p: 0.95,
            top_k: 40
        }
    },
    thinking: {
        model: 'gemini-2.5-pro',
        options: {
            temperature: 0.3,
            max_tokens: 8192,
            top_p: 0.95,
            reasoning_effort: 'default',
            reasoning_format: 'parsed'
        }
    },
    deep: {
        model: 'gemini-2.5-pro',
        options: {
            temperature: 0.2,
            max_tokens: 16384,
            top_p: 0.95,
            reasoning_effort: 'high',
            reasoning_format: 'parsed'
        }
    },
    search: {
        model: 'gemini-2.5-flash',
        options: {
            temperature: 0.2,
            max_tokens: 4096,
            top_p: 0.95,
            top_k: 40,
            webSearch: true
        }
    },

    vision: {
        model: 'gemini-2.5-flash',
        options: {
            temperature: 0.4,
            max_tokens: 8192,
            top_p: 0.95,
            top_k: 40
        }
    }
};

export const DEFAULT_AI_MODEL = AI_MODEL_PROFILES.balanced.model;

export function isModelProfile(model?: string): model is AIModelProfile {
    return Boolean(model && model in AI_MODEL_PROFILES);
}

export function resolveModelProfile(model?: string): AIModelProfileConfig {
    if (isModelProfile(model)) return AI_MODEL_PROFILES[model];
    return {
        model: model || DEFAULT_AI_MODEL,
        options: {}
    };
}
