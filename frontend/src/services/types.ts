export interface User {
    _id: string;
    name: string;
    email: string;
    timezone: string;
    scriptInterests?: {
        directors: string[];
        genres: string[];
        styles: string[];
    };
    emailVerified?: boolean;
    createdAt: string;
    role?: 'user' | 'admin';
    theme?: 'dark' | 'light' | 'system';
    accentColor?: string;
    customAccentColor?: string | null;
    aiAccentColor?: string;
    backgroundTinting?: boolean;
    reducedMotion?: boolean;
    hasApiKey?: boolean;
}

export interface ChatConversation {
    _id: string;
    userId: string;
    title: string;
    messages: { role: 'user' | 'assistant' | 'system'; content: string; timestamp: string }[];
    metadata?: {
        model?: string;
        tokensUsed?: number;
        assistantType?: 'learning-os' | 'script-writer';
    };
    createdAt: string;
    updatedAt: string;
}

/** @deprecated Use ChatConversation */
export type ChatSession = ChatConversation;
