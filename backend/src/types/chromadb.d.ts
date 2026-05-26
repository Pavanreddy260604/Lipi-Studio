declare module 'chromadb' {
    export class ChromaClient {
        constructor(params: { path?: string; host?: string; port?: number });
        getOrCreateCollection(params: {
            name: string;
            metadata?: Record<string, any>;
            embeddingFunction?: any;
        }): Promise<Collection>;
    }

    export interface Collection {
        add(params: {
            ids: string[];
            embeddings?: number[][];
            metadatas?: Record<string, any>[];
            documents?: string[];
        }): Promise<void>;

        upsert(params: {
            ids: string[];
            embeddings?: number[][];
            metadatas?: Record<string, any>[];
            documents?: string[];
        }): Promise<void>;

        delete(params: {
            ids?: string[];
            where?: Record<string, any>;
        }): Promise<void>;

        query(params: {
            queryEmbeddings: number[][];
            nResults: number;
            where?: Record<string, any>;
        }): Promise<{
            ids: string[][];
            embeddings?: number[][][];
            documents?: string[][];
            metadatas?: Record<string, any>[][];
        }>;
    }
}
