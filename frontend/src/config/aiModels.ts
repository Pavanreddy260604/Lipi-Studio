export interface AIModelOption {
    id: string;
    name: string;
    provider: 'Gemini';
    category: string;
    description: string;
    supportsFiles: boolean;
    supportsImages: boolean;
    supportsTools: boolean;
    speedTier: 'fast' | 'balanced' | 'thinking' | 'deep';
}

export const AI_MODELS: AIModelOption[] = [
    { id: 'instant', name: 'Instant', provider: 'Gemini', category: 'Profile', description: 'Gemini 2.5 Flash — lowest latency for quick chat and simple help', supportsFiles: true, supportsImages: true, supportsTools: false, speedTier: 'fast' },
    { id: 'balanced', name: 'Balanced', provider: 'Gemini', category: 'Profile', description: 'Gemini 2.5 Flash — fast reasoning, great default for everyday work', supportsFiles: true, supportsImages: true, supportsTools: false, speedTier: 'balanced' },
    { id: 'thinking', name: 'Thinking', provider: 'Gemini', category: 'Profile', description: 'Gemini 2.5 Pro — deep thinking for planning, coding, and hard analysis', supportsFiles: true, supportsImages: true, supportsTools: false, speedTier: 'thinking' },
    { id: 'deep', name: 'Deep', provider: 'Gemini', category: 'Profile', description: 'Gemini 2.5 Pro — extended reasoning for heavyweight reviews', supportsFiles: true, supportsImages: true, supportsTools: false, speedTier: 'deep' },

    { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', provider: 'Gemini', category: 'Raw', description: 'Balanced speed and quality, 1M token context', supportsFiles: true, supportsImages: true, supportsTools: false, speedTier: 'balanced' },
    { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', provider: 'Gemini', category: 'Raw', description: 'Strongest reasoning, 1M token context', supportsFiles: true, supportsImages: true, supportsTools: false, speedTier: 'thinking' },
];
