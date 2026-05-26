import type { StateStorage } from 'zustand/middleware';

/**
 * Safe storage wrapper that handles restricted contexts (iframes, private mode, etc.)
 */
const memoryFallback = new Map<string, string>();
let resolvedLocalStorage: Storage | null | undefined;

function getLocalStorageSafe(): Storage | null {
    if (resolvedLocalStorage !== undefined) {
        return resolvedLocalStorage;
    }

    if (typeof window === 'undefined') {
        resolvedLocalStorage = null;
        return resolvedLocalStorage;
    }

    try {
        const storage = window.localStorage;
        const probeKey = '__storage_probe__';
        storage.setItem(probeKey, '1');
        storage.removeItem(probeKey);
        resolvedLocalStorage = storage;
    } catch {
        resolvedLocalStorage = null;
    }

    return resolvedLocalStorage;
}

export const safeStorage: StateStorage = {
    getItem: (name: string): string | null => {
        const storage = getLocalStorageSafe();
        if (!storage) return memoryFallback.get(name) ?? null;
        try {
            return storage.getItem(name);
        } catch {
            console.warn(`[Storage] localStorage not available for key: ${name}`);
            return memoryFallback.get(name) ?? null;
        }
    },
    setItem: (name: string, value: string): void => {
        const storage = getLocalStorageSafe();
        if (!storage) {
            memoryFallback.set(name, value);
            return;
        }
        try {
            storage.setItem(name, value);
        } catch {
            console.warn(`[Storage] localStorage not available, ${name} will not persist`);
            memoryFallback.set(name, value);
        }
    },
    removeItem: (name: string): void => {
        const storage = getLocalStorageSafe();
        if (!storage) {
            memoryFallback.delete(name);
            return;
        }
        try {
            storage.removeItem(name);
        } catch {
            console.warn(`[Storage] localStorage not available for removal of: ${name}`);
            memoryFallback.delete(name);
        }
    },
};

/**
 * Simple wrapper for non-Zustand usage
 */
export const storage = {
    get: <T>(key: string, defaultValue: T): T => {
        const val = safeStorage.getItem(key);
        if (val === null || val instanceof Promise) return defaultValue;
        try {
            return JSON.parse(val) as T;
        } catch {
            return val as unknown as T;
        }
    },
    set: (key: string, value: any): void => {
        const val = typeof value === 'string' ? value : JSON.stringify(value);
        safeStorage.setItem(key, val);
    },
    remove: (key: string): void => {
        safeStorage.removeItem(key);
    }
};


