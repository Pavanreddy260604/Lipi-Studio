
import { Ollama, OllamaEmbedding } from "@llamaindex/ollama";
import { ChatOptions, IAIService } from "./ai.interface";
import { llamaindexService } from "./llamaindex.service";
import * as dotenv from 'dotenv';

dotenv.config();

/**
 * Ollama Service - Local Authority
 * Provides fallback and privacy-focused AI capabilities.
 */
export class OllamaService implements IAIService {
    public llm: Ollama;
    private embedModel: OllamaEmbedding;

    constructor() {
        const baseUrl = process.env.OLLAMA_URL || "http://127.0.0.1:11434";
        const model = process.env.OLLAMA_MODEL || "glm-4.6:cloud";
        const embedModelName = process.env.OLLAMA_EMBED_MODEL || "bge-m3";

        this.llm = new Ollama({
            config: {
                host: baseUrl
            },
            model: model,
        });

        this.embedModel = new OllamaEmbedding({
            config: {
                host: baseUrl
            },
            model: embedModelName
        });

        if (process.env.NODE_ENV !== 'production') {
            console.log(`[OllamaService] Initialized with model: ${model} at ${baseUrl}`);
        }
    }

    async chat(message: string, options?: ChatOptions): Promise<string> {
        try {
            const response = await this.llm.chat({
                messages: [{ role: 'user', content: message }]
            });
            return (response as any).message.content.toString();
        } catch (error: any) {
            console.error(`[OllamaService] Chat failed: ${error.message}`);
            throw error;
        }
    }

    async *chatStream(messages: { role: string; content: string }[], systemPrompt?: string, options?: ChatOptions): AsyncGenerator<string, void, unknown> {
        try {
            const stream = await this.llm.chat({
                messages: messages as any,
                stream: true
            });

            for await (const chunk of stream) {
                const content = chunk.delta || '';
                if (content) yield content;
            }
        } catch (error: any) {
            console.error(`[OllamaService] Stream failed: ${error.message}`);
            throw error;
        }
    }

    async generateEmbedding(text: string): Promise<number[]> {
        return await llamaindexService.getEmbedding(text);
    }

    /**
     * Internal method specifically for Ollama embeddings if called directly.
     */
    async getOllamaEmbedding(text: string): Promise<number[]> {
        try {
            const response = await this.embedModel.getTextEmbedding(text);
            return response;
        } catch (error: any) {
            console.error(`[OllamaService] Embedding failed: ${error.message}`);
            throw error;
        }
    }
}

export const ollamaService = new OllamaService();
