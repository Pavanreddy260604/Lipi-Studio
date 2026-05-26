// Auth API Service
import { baseApi } from './base.api';
import type { User } from './types';

export const authApi = {
    async register(name: string, email: string, password: string) {
        return baseApi.request<{ user: User; token: string }>('/auth/register', {
            method: 'POST',
            body: JSON.stringify({ name, email, password }),
        });
    },

    async login(email: string, password: string) {
        return baseApi.request<{ user: User; token: string }>('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password }),
        });
    },

    async getMe() {
        return baseApi.request<{ user: User }>('/auth/me');
    },

    async updateProfile(data: {
        name?: string;
        email?: string;
        timezone?: string;
        targets?: { dsa: number; backend: number; project: number };
        scriptInterests?: { directors: string[]; genres: string[]; styles: string[] };
        theme?: 'dark' | 'light' | 'system';
        accentColor?: string;
        customAccentColor?: string | null;
        aiAccentColor?: string;
        backgroundTinting?: boolean;
        reducedMotion?: boolean;
    }) {
        return baseApi.request<{ user: User; emailChanged?: boolean; message?: string }>('/auth/profile', {
            method: 'PUT',
            body: JSON.stringify(data),
        });
    },

    async updateAIKey(apiKey: string) {
        return baseApi.request<{ message: string }>('/auth/ai-key', {
            method: 'PUT',
            body: JSON.stringify({ apiKey }),
        });
    },

    async exportData() {
        return baseApi.request<{
            user: User;
            dailyLogs: unknown[];
            dsaProblems: unknown[];
            backendTopics: unknown[];
            projectStudies: unknown[];
            exportedAt: string;
        }>('/auth/export');
    },

    async forgotPassword(email: string) {
        return baseApi.request<{ message: string }>('/auth/forgot-password', {
            method: 'POST',
            body: JSON.stringify({ email }),
        });
    },

    async resetPassword(token: string, password: string) {
        return baseApi.request<{ message: string }>('/auth/reset-password', {
            method: 'POST',
            body: JSON.stringify({ token, password }),
        });
    },

    async changePassword(currentPassword: string, newPassword: string) {
        return baseApi.request<{ message: string }>('/auth/change-password', {
            method: 'PUT',
            body: JSON.stringify({ currentPassword, newPassword }),
        });
    },

    async verifyEmail(code: string) {
        const response = await baseApi.request<{ message: string; user: User }>('/auth/verify-email', {
            method: 'POST',
            body: JSON.stringify({ code }),
        });
        return response.user;
    },

    async resendVerification() {
        return baseApi.request<{ message: string }>('/auth/resend-verification', {
            method: 'POST',
        });
    },

    async deleteAccount() {
        return baseApi.request<{ message: string }>('/auth/account', {
            method: 'DELETE',
        });
    },

    async logout() {
        return baseApi.request<{ message: string }>('/auth/logout', {
            method: 'POST',
        });
    }
};
