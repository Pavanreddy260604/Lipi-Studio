import fs from 'fs';
import path from 'path';
import { ChatOptions } from '../ai.interface';
import { resolveModelProfile } from '../aiModelProfiles';

interface GeminiPart {
    text?: string;
    inlineData?: { mimeType: string; data: string };
    functionCall?: { name: string; args: any };
    functionResponse?: { name: string; response: any };
}

interface GeminiContent {
    role: string;
    parts: GeminiPart[];
}

export function getUrl(action: 'generateContent' | 'streamGenerateContent', model: string, apiKey: string): string {
    return `https://generativelanguage.googleapis.com/v1beta/models/${model}:${action}?key=${apiKey}`;
}

export function getEmbeddingUrl(model: string, apiKey: string): string {
    return `https://generativelanguage.googleapis.com/v1/models/${model}:embedContent?key=${apiKey}`;
}

export function resolveModel(model?: string, defaultModel?: string): string {
    const profile = resolveModelProfile(model);
    return profile.model || defaultModel || 'gemini-2.5-flash';
}

export async function withRetry<T>(fn: () => Promise<T>, maxRetries = 4): Promise<T> {
    let lastError: any;
    for (let i = 0; i <= maxRetries; i++) {
        try {
            return await fn();
        } catch (error: any) {
            lastError = error;
            const status = error.response?.status;
            const errorMsg = error.response?.data?.error?.message || error.message || '';
            const isRateLimit = status === 429 || errorMsg.includes('RESOURCE_EXHAUSTED') || errorMsg.includes('rate_limit') || errorMsg.includes('quota');
            if (isRateLimit && i < maxRetries) {
                // Exponential backoff + randomized jitter to prevent concurrent collision
                const jitter = Math.random() * 1500;
                const delay = Math.min(1000 * Math.pow(2, i), 10000) + jitter;
                console.warn(`[GeminiService] Rate limit hit. Retrying in ${Math.round(delay)}ms... (Attempt ${i + 1}/${maxRetries})`);
                await new Promise(r => setTimeout(r, delay));
                continue;
            }
            throw error;
        }
    }
    throw lastError;
}

export function detectMimeType(data: string): string {
    if (data.startsWith('/9j/')) return 'image/jpeg';
    if (data.startsWith('iVBOR')) return 'image/png';
    if (data.startsWith('R0lG')) return 'image/gif';
    if (data.startsWith('UklGR')) return 'image/webp';
    if (data.startsWith('PHN2')) return 'image/svg+xml';
    return 'image/png';
}

export function buildContentParts(msg: { role: string; content: string; images?: string[] }): GeminiPart[] {
    const parts: GeminiPart[] = [];
    if (msg.content) parts.push({ text: msg.content });
    if (msg.images && msg.images.length > 0) {
        for (const img of msg.images) {
            if (!img) continue;
            let data = img;
            let mimeType = 'image/png';
            
            if (img.startsWith('data:image/')) {
                data = img.replace(/^data:image\/\w+;base64,/, '');
                mimeType = detectMimeType(data);
                parts.push({ inlineData: { mimeType, data } });
            } else if (img.includes('uploads/')) {
                try {
                    const relativePath = img.substring(img.indexOf('uploads/'));
                    const absolutePath = path.resolve(process.cwd(), relativePath);
                    if (fs.existsSync(absolutePath)) {
                        const buffer = fs.readFileSync(absolutePath);
                        data = buffer.toString('base64');
                        const ext = path.extname(absolutePath).toLowerCase();
                        if (ext === '.jpg' || ext === '.jpeg') mimeType = 'image/jpeg';
                        else if (ext === '.webp') mimeType = 'image/webp';
                        else if (ext === '.gif') mimeType = 'image/gif';
                        parts.push({ inlineData: { mimeType, data } });
                    }
                } catch (err) {
                    console.error('[Gemini Helpers] Failed to read local uploaded image:', err);
                }
            } else if (!img.startsWith('http') && img.length > 20) {
                // Assume it is a raw base64 string
                data = img;
                mimeType = detectMimeType(data);
                parts.push({ inlineData: { mimeType, data } });
            }
            // Skip external web URLs (http) to avoid Gemini API payload exceptions
        }
    }
    return parts;
}

function mapRole(role: string): string {
    if (role === 'assistant' || role === 'model') return 'model';
    if (role === 'tool') return 'function';
    return 'user';
}

export function buildGeminiContents(
    messages: { role: string; content: string; images?: string[]; tool_calls?: any[]; tool_call_id?: string; name?: string }[],
    systemPrompt?: string,
    options?: ChatOptions
): { contents: GeminiContent[]; systemInstruction?: { parts: [{ text: string }] }; tools?: any[] } {
    const contents: GeminiContent[] = [];
    for (const msg of messages) {
        if (msg.role === 'system') {
            if (!systemPrompt) systemPrompt = msg.content;
            continue;
        }
        if (msg.role === 'tool') {
            const prevContent = contents.length > 0 ? contents[contents.length - 1] : null;
            if (prevContent && prevContent.role === 'function') {
                prevContent.parts.push({ functionResponse: { name: msg.name || 'unknown', response: { response: msg.content } } });
            } else {
                contents.push({ role: 'function', parts: [{ functionResponse: { name: msg.name || 'unknown', response: { response: msg.content } } }] });
            }
            continue;
        }
        if (msg.tool_calls && msg.tool_calls.length > 0) {
            const parts: GeminiPart[] = [];
            if (msg.content) parts.push({ text: msg.content });
            for (const tc of msg.tool_calls) {
                let args: any = {};
                try { args = typeof tc.function.arguments === 'string' ? JSON.parse(tc.function.arguments) : tc.function.arguments; } catch { }
                parts.push({ functionCall: { name: tc.function.name, args } });
            }
            contents.push({ role: 'model', parts });
            continue;
        }
        contents.push({ role: mapRole(msg.role), parts: buildContentParts(msg) });
    }
    const result: any = { contents };
    if (systemPrompt) result.systemInstruction = { parts: [{ text: systemPrompt }] };
    const tools: any[] = [];
    const hasCustomTools = options?.tools && Array.isArray(options.tools) && options.tools.length > 0;
    
    // Built-in search (Google Grounding) and custom function tools are mutually exclusive in the Gemini API.
    // Prioritize custom functions if present.
    if ((options?.webSearch || options?.browserSearch) && !hasCustomTools) {
        tools.push({ googleSearch: {} });
    }
    
    if (options?.tools && Array.isArray(options.tools)) {
        for (const tool of options.tools) {
            if (tool.functionDeclarations) tools.push(tool);
        }
    }
    if (tools.length > 0) result.tools = tools;
    return result;
}

export function buildGenerationConfig(options?: ChatOptions) {
    const config: any = {
        temperature: options?.temperature ?? 0.7,
        maxOutputTokens: options?.max_tokens ?? 8192,
        topP: options?.top_p ?? 0.95
    };
    if (options?.top_k !== undefined) config.topK = options.top_k;
    
    const hasTools = !!(
        options?.webSearch ||
        options?.browserSearch ||
        (options?.tools && Array.isArray(options.tools) && options.tools.length > 0)
    );

    if (options?.format === 'json' && !hasTools) {
        config.responseMimeType = 'application/json';
    }

    // Gemini Thinking / Reasoning Config
    if (options?.reasoning_effort && options.reasoning_effort !== 'none') {
        const budgetMap: Record<string, number> = {
            low: 1024,
            medium: 8192,
            default: -1,  // dynamic — model decides
            high: 24576
        };
        const thinkingConfig: any = {
            thinkingBudget: budgetMap[options.reasoning_effort] ?? -1
        };
        // Include raw thought tokens in response when format is 'parsed' or 'raw'
        if (options.reasoning_format === 'parsed' || options.reasoning_format === 'raw') {
            thinkingConfig.includeThoughts = true;
        }
        config.thinkingConfig = thinkingConfig;
    }

    return config;
}
