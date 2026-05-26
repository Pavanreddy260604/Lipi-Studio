import { baseApi } from './base.api';
import { authApi } from './auth.api';
import { chatApi } from './chat.api';
import { activityApi } from './activity.api';

export type {
    User,
    ChatConversation,
    ChatSession,
} from './types';

class ApiService {
    setToken(token: string | null) {
        baseApi.setToken(token);
    }

    getToken(): string | null {
        return baseApi.getToken();
    }

    // Auth
    register = authApi.register;
    login = authApi.login;
    logout = authApi.logout;
    getMe = authApi.getMe;
    forgotPassword = authApi.forgotPassword;
    resetPassword = authApi.resetPassword;
    changePassword = authApi.changePassword;
    verifyEmail = authApi.verifyEmail;
    resendVerification = authApi.resendVerification;
    updateProfile = authApi.updateProfile;
    updateAIKey = authApi.updateAIKey;
    exportData = authApi.exportData;
    deleteAccount = authApi.deleteAccount;

    // Chat
    getChatHistory = chatApi.getChatHistory;
    getChatConversation = chatApi.getChatConversation;
    createChatConversation = chatApi.createChatConversation;
    sendChatMessage = chatApi.sendChatMessage;
    regenerateChatResponse = chatApi.regenerateChatResponse;
    uploadChatAttachment = chatApi.uploadChatAttachment;
    uploadChatAttachmentsBulk = chatApi.uploadChatAttachmentsBulk;
    updateChatConversation = chatApi.updateChatConversation;
    deleteChatConversation = chatApi.deleteChatConversation;

    getChatSession = chatApi.getChatConversation;
    createChatSession = chatApi.createChatConversation;
    updateChatSession = chatApi.updateChatConversation;
    deleteChatSession = chatApi.deleteChatConversation;

    // Activity / System Awareness
    logActivity = activityApi.log;
    getActivityHistory = activityApi.getHistory;

    async post<T = any>(url: string, body: any, options: any = {}) {
        const isFormData = body instanceof FormData;
        const headers = { ...options.headers };
        if (isFormData) {
            delete headers['Content-Type'];
        } else if (!headers['Content-Type']) {
            headers['Content-Type'] = 'application/json';
        }
        const response = await baseApi.request<T>(url, {
            method: 'POST',
            body: isFormData ? body : JSON.stringify(body),
            headers
        });
        return response;
    }
}

export const api = new ApiService();
