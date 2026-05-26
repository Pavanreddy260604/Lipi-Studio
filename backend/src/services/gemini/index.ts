import axios from 'axios';
import * as dotenv from 'dotenv';
import { ChatOptions, IAIService } from '../ai.interface';
import { getUrl, getEmbeddingUrl, resolveModel, withRetry, buildGeminiContents, buildGenerationConfig } from './helpers.js';

dotenv.config();

export class GeminiService implements IAIService {
    private apiKey: string;
    private defaultModel: string;

    private embedModel: string;

    constructor() {
        this.apiKey = process.env.GEMINI_API_KEY || '';
        this.defaultModel = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
        this.embedModel = process.env.GEMINI_EMBED_MODEL || 'gemini-embedding-2';
        if (!this.apiKey) {
            console.warn('[GeminiService] No GEMINI_API_KEY found. Gemini service will fail if used.');
        } else {
            console.log(`[Gemini] embed model: ${this.embedModel}, chat model: ${this.defaultModel}`);
        }
    }

    async chat(message: string, options?: ChatOptions): Promise<string> {
        return withRetry(async () => {
            const model = resolveModel(options?.model, this.defaultModel);
            const { contents, systemInstruction, tools } = buildGeminiContents(
                [{ role: 'user', content: message }], undefined, options
            );
            const url = getUrl('generateContent', model, this.apiKey);
            const payload: any = { contents, generationConfig: buildGenerationConfig(options) };
            if (systemInstruction) payload.systemInstruction = systemInstruction;
            if (tools) payload.tools = tools;
            try {
                const response = await axios.post(url, payload, { headers: { 'Content-Type': 'application/json' } });
                const candidate = response.data.candidates?.[0];
                if (!candidate) return '';
                const parts: any[] = candidate.content?.parts || [];
                // Filter out thinking/reasoning parts — only return final answer for non-streaming calls
                const answerParts = parts.filter((p: any) => !p.thought);
                const textParts = answerParts.filter((p: any) => p.text).map((p: any) => p.text);
                const functionCalls = answerParts.filter((p: any) => p.functionCall);
                if (functionCalls.length > 0) {
                    const fcs = functionCalls.map((fc: any) =>
                        `[TOOL_CALL: ${fc.functionCall!.name}(${JSON.stringify(fc.functionCall!.args)})]`
                    ).join('\n');
                    const text = textParts.join('\n');
                    return text ? `${text}\n${fcs}` : fcs;
                }
                return textParts.join('\n');
            } catch (error: any) {
                const errorDetails = error.response?.data?.error || {};
                console.error(`[GeminiService] Chat failed:`, errorDetails.message || error.message);
                throw new Error(`Gemini Error: ${errorDetails.message || error.message}`);
            }
        });
    }

    async *chatStream(
        messages: { role: string; content: string; images?: string[] }[],
        systemPrompt?: string,
        options?: ChatOptions
    ): AsyncGenerator<string, void, unknown> {
        const model = resolveModel(options?.model, this.defaultModel);
        const { contents, systemInstruction, tools } = buildGeminiContents(messages as any, systemPrompt, options);
        const url = getUrl('streamGenerateContent', model, this.apiKey);
        const payload: any = { contents, generationConfig: buildGenerationConfig(options) };
        if (systemInstruction) payload.systemInstruction = systemInstruction;
        if (tools) payload.tools = tools;
        let inThinking = false;
        try {
            const response = await withRetry(async () =>
                axios.post(url, payload, { headers: { 'Content-Type': 'application/json' }, responseType: 'stream' })
            );
            const stream = response.data;
            let buffer = '';
            for await (const chunk of stream) {
                const text = typeof chunk === 'string' ? chunk : Buffer.isBuffer(chunk) ? chunk.toString('utf-8') : '';
                buffer += text;
                
                let i = 0;
                while (i < buffer.length) {
                    let depth = 0;
                    let startIdx = -1;
                    let insideString = false;
                    let escaped = false;
                    let foundJson = false;

                    for (let j = 0; j < buffer.length; j++) {
                        const char = buffer[j];
                        if (char === '\\') { escaped = !escaped; }
                        else if (char === '"') { if (!escaped) insideString = !insideString; escaped = false; }
                        else { 
                            escaped = false; 
                            if (!insideString) {
                                if (char === '{') { if (depth === 0) startIdx = j; depth++; }
                                else if (char === '}') { 
                                    depth--; 
                                    if (depth === 0 && startIdx !== -1) {
                                        const jsonStr = buffer.slice(startIdx, j + 1);
                                        try {
                                            const parsed = JSON.parse(jsonStr);
                                            const candidate = parsed.candidates?.[0];
                                            if (candidate) {
                                                const parts: any[] = candidate.content?.parts || [];
                                                for (const part of parts) {
                                                    const isThought = part.thought === true;
                                                    if (isThought && part.text) {
                                                        // Transition into thinking — emit opening tag
                                                        if (!inThinking) {
                                                            yield '\n<THINKING>\n';
                                                            inThinking = true;
                                                        }
                                                        yield part.text;
                                                    } else {
                                                        // Transition out of thinking — emit closing tag
                                                        if (inThinking) {
                                                            yield '\n</THINKING>\n';
                                                            inThinking = false;
                                                        }
                                                        if (part.text) yield part.text;
                                                        if (part.functionCall) yield `__TOOL_CALL__:${part.functionCall.name}:${JSON.stringify(part.functionCall.args)}`;
                                                    }
                                                }
                                            }
                                            buffer = buffer.slice(j + 1);
                                            foundJson = true;
                                            break;
                                        } catch {
                                            // Partial JSON or parse error, keep searching
                                        }
                                    }
                                }
                            }
                        }
                    }
                    if (!foundJson) break;
                }
            }
            // Close any unclosed thinking tag at stream end
            if (inThinking) {
                yield '\n</THINKING>\n';
            }
        } catch (error: any) {
            let errorMessage = error.message;
            if (error.response?.data && typeof error.response.data.on === 'function') {
                try {
                    // Buffer stream to get the actual JSON error
                    const chunks: any[] = [];
                    for await (const chunk of error.response.data) {
                        chunks.push(chunk);
                    }
                    const rawBody = Buffer.concat(chunks).toString('utf-8');
                    try {
                        const parsed = JSON.parse(rawBody);
                        if (parsed.error?.message) {
                            errorMessage = parsed.error.message;
                        } else {
                            errorMessage = rawBody;
                        }
                    } catch {
                        errorMessage = rawBody;
                    }
                } catch (e) {
                    console.error('[GeminiService] Failed to parse error response stream:', e);
                }
            }
            console.error(`[GeminiService] Stream failed:`, errorMessage);
            throw new Error(`Gemini Stream Error: ${errorMessage}`);
        }
    }

    async generateEmbedding(text: string): Promise<number[]> {
        return withRetry(async () => {
            const url = getEmbeddingUrl(this.embedModel, this.apiKey);
            try {
                const response = await axios.post(url, {
                    content: { role: 'user', parts: [{ text }] },
                    outputDimensionality: 3072
                }, { headers: { 'Content-Type': 'application/json' } });
                const values = response.data.embedding?.values;
                if (!values || !Array.isArray(values)) throw new Error('Invalid embedding response from Gemini');
                return values;
            } catch (error: any) {
                const errorDetails = error.response?.data?.error || {};
                console.error(`[GeminiService] Embedding failed:`, errorDetails.message || error.message);
                throw new Error(`Gemini Embedding Error: ${errorDetails.message || error.message}`);
            }
        });
    }

    async generateEmbeddingsBatch(texts: string[]): Promise<number[][]> {
        if (texts.length === 0) return [];
        return withRetry(async () => {
            const url = `https://generativelanguage.googleapis.com/v1/models/${this.embedModel}:batchEmbedContents?key=${this.apiKey}`;
            const requests = texts.map(text => ({
                model: `models/${this.embedModel}`,
                content: { role: 'user', parts: [{ text }] }
            }));
            try {
                const response = await axios.post(url, { requests }, { headers: { 'Content-Type': 'application/json' } });
                const embeddings = response.data.embeddings;
                if (!embeddings || !Array.isArray(embeddings)) throw new Error('Invalid batch embedding response from Gemini');
                return embeddings.map((emb: any) => {
                    const values = emb.values;
                    if (!values || !Array.isArray(values)) throw new Error('Invalid embedding values in batch response');
                    return values;
                });
            } catch (error: any) {
                const errorDetails = error.response?.data?.error || {};
                console.error(`[GeminiService] Batch embedding failed:`, errorDetails.message || error.message);
                throw new Error(`Gemini Batch Embedding Error: ${errorDetails.message || error.message}`);
            }
        });
    }
}

export const geminiService = new GeminiService();
