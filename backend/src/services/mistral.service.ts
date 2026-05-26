import axios from 'axios';
import * as dotenv from 'dotenv';
import { ChatOptions, IAIService } from './ai.interface';

dotenv.config();

export class MistralService implements IAIService {
    private apiKey: string;
    private baseUrl: string = "https://api.mistral.ai/v1/chat/completions";
    private defaultModel: string = "mistral-large-latest";

    constructor() {
        // Fallback to the user's provided API key if not defined in .env
        this.apiKey = process.env.MISTRAL_API_KEY || '';
    }

    private async withRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
        let lastError: any;
        for (let i = 0; i <= maxRetries; i++) {
            try {
                return await fn();
            } catch (error: any) {
                lastError = error;
                const status = error.response?.status;
                const errorCode = error.code || '';
                const isRateLimit = status === 429;
                const isNetworkReset = errorCode === 'ECONNRESET' || errorCode === 'ETIMEDOUT' || error.message?.includes('ECONNRESET');

                if ((isRateLimit || isNetworkReset) && i < maxRetries) {
                    const delay = (i + 1) * 2000; // Wait 2s to 6s
                    console.warn(`[MistralService] Transient error hit (${isRateLimit ? '429 Rate Limit' : 'ECONNRESET Network Reset'}). Retrying in ${delay}ms... (Attempt ${i + 1}/${maxRetries})`);
                    await new Promise(r => setTimeout(r, delay));
                    continue;
                }
                throw error;
            }
        }
        throw lastError;
    }

    async chat(message: string, options?: ChatOptions): Promise<string> {
        return this.withRetry(async () => {
            try {
                const payload: any = {
                    model: this.defaultModel,
                    messages: [
                        { role: "user", content: message }
                    ],
                    max_tokens: options?.max_tokens || 8192,
                    temperature: options?.temperature !== undefined ? options.temperature : 0.7,
                    top_p: options?.top_p !== undefined ? options.top_p : 1.0,
                    stream: false
                };

                if (options?.format === 'json') {
                    payload.response_format = { type: 'json_object' };
                }

                if (options?.tools) {
                    payload.tools = options.tools;
                    payload.tool_choice = 'auto';
                }

                const response = await axios.post(this.baseUrl, payload, {
                    headers: {
                        "Authorization": `Bearer ${this.apiKey}`,
                        "Accept": "application/json",
                        "Content-Type": "application/json",
                    }
                });

                const msg = response.data.choices[0]?.message;
                if (msg?.tool_calls && msg.tool_calls.length > 0) {
                    const toolCall = msg.tool_calls[0];
                    return `[TOOL_CALL: ${toolCall.function.name}(${toolCall.function.arguments})]`;
                }

                return msg?.content || '';
            } catch (error: any) {
                const status = error.response?.status;
                const data = error.response?.data;
                console.error(`[MistralService] Chat failed (${status}):`, data || error.message);
                throw error;
            }
        });
    }

    async *chatStream(messages: { role: string; content: string }[], systemPrompt?: string, options?: ChatOptions): AsyncGenerator<string, void, unknown> {
        // Stream fallback: just concatenate all messages and run the non-streaming chat. Mistral handles this fast anyway!
        let fullMessage = systemPrompt ? systemPrompt + '\n\n' : '';
        fullMessage += messages.map(m => m.content).join('\n\n');
        
        const fullResponse = await this.chat(fullMessage, options);
        yield fullResponse;
    }

    async generateEmbedding(text: string): Promise<number[]> {
        throw new Error("generateEmbedding not implemented for Mistral API. LlamaIndex service handles embeddings.");
    }
}

export const mistralService = new MistralService();
