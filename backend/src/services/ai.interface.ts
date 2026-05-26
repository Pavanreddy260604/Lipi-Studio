export interface GeminiFunctionDeclaration {
    name: string;
    description: string;
    parameters: {
        type: 'object';
        properties: Record<string, any>;
        required?: string[];
    };
}

export interface GeminiTool {
    functionDeclarations: GeminiFunctionDeclaration[];
}

export interface ChatOptions {
    model?: string;
    temperature?: number;
    max_tokens?: number;
    format?: 'json' | 'text';
    seed?: number;
    top_p?: number;
    top_k?: number;
    reasoning_effort?: 'none' | 'low' | 'medium' | 'high' | 'default';
    reasoning_format?: 'hidden' | 'parsed' | 'raw';
    webSearch?: boolean;
    browserSearch?: boolean;
    provider?: 'gemini' | 'ollama' | 'mistral';
    tools?: GeminiTool[] | any[];
    tool_choice?: string | object;
}

export interface IAIService {
    chat(message: string, options?: ChatOptions): Promise<string>;
    chatStream(messages: { role: string; content: string; images?: string[] }[], systemPrompt?: string, options?: ChatOptions): AsyncGenerator<string, void, unknown>;
    generateEmbedding(text: string): Promise<number[]>;
}
