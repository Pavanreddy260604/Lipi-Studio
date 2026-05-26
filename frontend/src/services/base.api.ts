// Base API infrastructure - shared by all domain services
const API_BASE = import.meta.env.VITE_API_URL || '/api';

export interface ApiResponse<T> {
    success: boolean;
    data?: T;
    error?: string;
}

/**
 * Base API service with shared request infrastructure.
 * Domain-specific services extend or compose with this.
 */
class BaseApiService {
    private token: string | null = null;
    private refreshPromise: Promise<string | null> | null = null;
    private csrfToken: string | null = null;
    private csrfPromise: Promise<string | null> | null = null;
    private refreshFailed = false;

    setToken(token: string | null) {
        this.token = token;
        if (token) {
            this.refreshFailed = false;
        }
    }

    getToken(): string | null {
        return this.token;
    }

    private async getCsrfToken(): Promise<string | null> {
        if (this.csrfToken) return this.csrfToken;
        if (this.csrfPromise) return this.csrfPromise;
        
        this.csrfPromise = (async () => {
            try {
                const resp = await fetch(`${API_BASE}/auth/csrf`, {
                    credentials: 'include',
                });
                const data: ApiResponse<{ token: string }> = await resp.json();
                if (resp.ok && data.success && data.data) {
                    this.csrfToken = data.data.token;
                    return this.csrfToken;
                }
            } catch {
                // CSRF token fetch failed; proceed without it
            }
            return null;
        })();
        
        const token = await this.csrfPromise;
        this.csrfPromise = null;
        return token;
    }

    private async executeWithRetry(endpoint: string, options: RequestInit): Promise<Response> {
        const MAX_ATTEMPTS = 3;
        let lastResponse: Response | null = null;

        for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
            // Proactive Refresh: If we have no token and it's the first attempt,
            // try to refresh once before making the request. This avoids the 401 log in the console.
            if (!this.token && !this.refreshFailed && attempt === 1 && !endpoint.includes('/auth/login') && !endpoint.includes('/auth/refresh')) {
                if (!this.refreshPromise) {
                    this.refreshPromise = this.refreshToken();
                }
                const newToken = await this.refreshPromise;
                if (newToken) {
                    this.token = newToken;
                }
                this.refreshPromise = null;
            }

            const currentToken = this.token;
            const isMutation = options.method && !['GET', 'HEAD', 'OPTIONS'].includes(options.method.toUpperCase());
            const currentCsrfToken = isMutation ? await this.getCsrfToken() : null;

            const isFormData = options.body instanceof FormData;

            const headers: HeadersInit = {
                ...(!isFormData && { 'Content-Type': 'application/json' }),
                ...(currentToken && { Authorization: `Bearer ${currentToken}` }),
                ...(currentCsrfToken && { 'X-CSRF-Token': currentCsrfToken }),
                ...options.headers,
            };

            const response = await fetch(`${API_BASE}${endpoint}`, {
                ...options,
                headers,
                credentials: 'include',
            });

            lastResponse = response;

            // 1. Handle 401 (Unauthorized)
            if (response.status === 401 && !this.refreshFailed && !endpoint.includes('/auth/login') && !endpoint.includes('/auth/refresh')) {
                // If we've already tried identifying ourselves and failed, we need to refresh
                if (!this.refreshPromise) {
                    this.refreshPromise = this.refreshToken();
                }

                try {
                    const newToken = await this.refreshPromise;
                    if (newToken) {
                        this.token = newToken;
                        // Continue to next loop iteration to retry the request with new token
                        this.refreshPromise = null;
                        continue;
                    } else {
                        // Refresh failed, exit and let caller handle
                        window.dispatchEvent(new Event('auth:unauthorized'));
                        return response;
                    }
                } catch (err) {
                    window.dispatchEvent(new Event('auth:unauthorized'));
                    throw err;
                }
            }

            // 2. Handle 403 (Forbidden/CSRF)
            if (response.status === 403 && !endpoint.includes('/auth/csrf')) {
                this.csrfToken = null; // Clear cached token
                this.csrfPromise = null;
                // Continue to next loop iteration to re-fetch CSRF and retry
                continue;
            }

            // If we got here, it's not a 401 or 403 that we can fix, so return it
            return response;
        }

        return lastResponse!;
    }

    /**
     * Standard JSON request
     */
    async request<T>(
        endpoint: string,
        options: RequestInit = {}
    ): Promise<T> {
        const response = await this.executeWithRetry(endpoint, options);

        const data: ApiResponse<T> = await response.json().catch(async () => {
            const text = await response.text().catch(() => 'No text returned');
            return {
                success: false,
                error: `Server Error ${response.status}: ${text.substring(0, 80)}...`
            };
        });

        if (!response.ok || !data.success) {
            if (response.status === 401 && !endpoint.includes('/auth/login') && !endpoint.includes('/auth/refresh')) {
                window.dispatchEvent(new Event('auth:unauthorized'));
            }

            if (response.status === 429) {
                throw new Error(data.error || 'Too many requests. Please slow down.');
            }
            
            throw new Error(data.error || 'An error occurred');
        }

        return data.data as T;
    }

    /**
     * Raw request that returns the Response object.
     * Useful for blobs, manual stream handling, etc.
     */
    async requestRaw(
        endpoint: string,
        options: RequestInit = {}
    ): Promise<Response> {
        const response = await this.executeWithRetry(endpoint, options);
        if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            throw new Error(data.error || data.message || `Request failed with status ${response.status}`);
        }
        return response;
    }

    private async refreshToken(): Promise<string | null> {
        try {
            const resp = await fetch(`${API_BASE}/auth/refresh`, {
                method: 'POST',
                credentials: 'include' // Must send the httpOnly cookie
            });
            const data: ApiResponse<{ token: string }> = await resp.json();
            if (resp.ok && data.success && data.data) {
                this.refreshFailed = false;
                return data.data.token;
            }
        } catch (e) {
            console.error('Failed to refresh token silently', e);
        }
        this.refreshFailed = true;
        return null;
    }

    /**
     * Streaming request for chat/AI endpoints
     */
    async streamRequest(
        endpoint: string,
        body: object,
        onChunk: (chunk: string) => void,
        signal?: AbortSignal
    ): Promise<void> {
        const response = await this.executeWithRetry(endpoint, {
            method: 'POST',
            body: JSON.stringify(body),
            signal
        });

        if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            if (response.status === 401 && !endpoint.includes('/auth/login') && !endpoint.includes('/auth/refresh')) {
                window.dispatchEvent(new Event('auth:unauthorized'));
            }
            throw new Error(data.error || data.message || 'Streaming request failed');
        }

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();

        if (!reader) return;

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value, { stream: true });
            onChunk(chunk);
        }
    }
}

// Singleton instance shared across all services
export const baseApi = new BaseApiService();
export { API_BASE };
