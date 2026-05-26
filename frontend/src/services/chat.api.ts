// Chat API Service
import { baseApi } from './base.api';
import type { AssistantContextPayload } from './scriptWriter.api';
import type { ChatConversation } from './types';

export const chatApi = {
    async getChatHistory() {
        return baseApi.request<ChatConversation[]>('/chat/history');
    },

    async getChatConversation(id: string) {
        return baseApi.request<ChatConversation>(`/chat/${id}`);
    },

    async createChatConversation(
        message?: string,
        model?: string,
        assistantType?: 'learning-os' | 'script-writer'
    ) {
        return baseApi.request<ChatConversation>('/chat', {
            method: 'POST',
            body: JSON.stringify({ message, model, assistantType })
        });
    },

    async sendChatMessage(
        conversationId: string,
        message: string,
        onChunk?: (chunk: string) => void,
        signal?: AbortSignal,
        assistantType?: 'learning-os' | 'script-writer',
        context?: string | AssistantContextPayload,
        images?: string[],
        attachmentIds?: string[]
    ) {
        if (!onChunk) {
            return baseApi.request('/chat/' + conversationId + '/message', {
                method: 'POST',
                body: JSON.stringify({ message, assistantType, context, images, attachmentIds })
            });
        }

        await baseApi.streamRequest(
            `/chat/${conversationId}/message`,
            { message, assistantType, context, images, attachmentIds },
            onChunk,
            signal
        );
    },

    async regenerateChatResponse(
        conversationId: string,
        onChunk?: (chunk: string) => void,
        signal?: AbortSignal
    ) {
        if (!onChunk) {
            return baseApi.request(`/chat/${conversationId}/regenerate`, {
                method: 'POST'
            });
        }

        await baseApi.streamRequest(
            `/chat/${conversationId}/regenerate`,
            {},
            onChunk,
            signal
        );
    },

    async uploadChatAttachment(conversationId: string, file: File | Blob, fileName: string) {
        const formData = new FormData();
        formData.append('file', file, fileName);
        return baseApi.request<{ attachmentId: string }>(`/chat/${conversationId}/attachments`, {
            method: 'POST',
            body: formData
        });
    },

    async uploadChatAttachmentsBulk(
        conversationId: string,
        files: Array<{ file: File | Blob; fileName: string }>
    ) {
        const formData = new FormData();
        files.forEach(({ file, fileName }) => {
            formData.append('files', file, fileName);
        });

        return baseApi.request<{ attachmentIds: string[] }>(`/chat/${conversationId}/attachments/bulk`, {
            method: 'POST',
            body: formData
        });
    },

    async updateChatConversation(
        id: string,
        updates: { title?: string; model?: string; assistantType?: 'learning-os' | 'script-writer' }
    ) {
        return baseApi.request<ChatConversation>(`/chat/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(updates)
        });
    },

    async deleteChatConversation(id: string) {
        return baseApi.request<{ success: boolean }>(`/chat/${id}`, { method: 'DELETE' });
    }
};
