
import axios from 'axios';
import * as dotenv from 'dotenv';
import { ChatOptions, IAIService } from './ai.interface';


dotenv.config();

/**
 * NvidiaService - Integration for Nvidia Integrate API
 */
export class NvidiaService implements IAIService {
    private apiKey: string;
    private baseUrl: string = "https://integrate.api.nvidia.com/v1/chat/completions";
    private defaultModel: string = "mistralai/mistral-large-3-675b-instruct-2512";

    constructor() {
        this.apiKey = process.env.NVIDIA_API_KEY || '';
    }

    async chat(message: string, options?: ChatOptions): Promise<string> {
        try {
            const payload: any = {
                model: options?.model || this.defaultModel,
                messages: [
                    { role: "user", content: message }
                ],
                max_tokens: options?.max_tokens || 8192,
                temperature: options?.temperature || 0.15,
                top_p: options?.top_p || 1.0,
                stream: false
            };

            // Support tools if provided
            if (options?.tools) {
                payload.tools = options.tools;
                payload.tool_choice = 'auto';
            }

            const response = await axios.post(this.baseUrl, payload, {
                headers: {
                    "Authorization": `Bearer ${this.apiKey}`,
                    "Accept": "application/json",
                    "Content-Type": "application/json"
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
            console.error(`[NvidiaService] Chat failed (${status}):`, data || error.message);
            throw new Error(`Nvidia Error: ${status} ${error.message}`);
        }
    }

    async *chatStream(messages: { role: string; content: string }[], systemPrompt?: string, options?: ChatOptions): AsyncGenerator<string, void, unknown> {
        try {
            const formattedMessages = messages.map(msg => ({
                role: msg.role === 'assistant' ? 'assistant' : 'user',
                content: msg.content
            }));

            if (systemPrompt && !formattedMessages.some(m => m.role === 'system')) {
                formattedMessages.unshift({ role: "system", content: systemPrompt });
            }

            const payload: any = {
                model: options?.model || this.defaultModel,
                messages: formattedMessages,
                max_tokens: options?.max_tokens || 8192,
                temperature: options?.temperature !== undefined ? options.temperature : 0.15,
                top_p: options?.top_p !== undefined ? options.top_p : 1.0,
                stream: true
            };

            const response = await axios.post(this.baseUrl, payload, {
                headers: {
                    "Authorization": `Bearer ${this.apiKey}`,
                    "Accept": "text/event-stream",
                    "Content-Type": "application/json"
                },
                responseType: 'stream'
            });

            const stream = response.data;
            let buffer = '';

            for await (const chunk of stream) {
                buffer += chunk.toString();
                let boundary = buffer.indexOf('\n');
                while (boundary !== -1) {
                    const line = buffer.substring(0, boundary).trim();
                    buffer = buffer.substring(boundary + 1);
                    boundary = buffer.indexOf('\n');

                    if (line.startsWith('data: ')) {
                        const dataText = line.slice(6).trim();
                        if (dataText === '[DONE]') return;
                        try {
                            const parsed = JSON.parse(dataText);
                            const content = parsed.choices[0]?.delta?.content || '';
                            if (content) yield content;
                        } catch (e) {
                            // Ignore partial JSON
                        }
                    }
                }
            }
        } catch (error: any) {
            console.error('[NvidiaService] Stream failed:', error.response?.data || error.message);
            throw new Error(`Nvidia Stream Error: ${error.message}`);
        }
    }

    async generateEmbedding(text: string): Promise<number[]> {
        throw new Error('Embeddings not implemented for NvidiaService yet.');
    }
}

export const nvidiaService = new NvidiaService();
