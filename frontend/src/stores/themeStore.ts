import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { safeStorage } from '../lib/safeStorage';


type Theme = 'dark' | 'light' | 'system';

interface ThemeState {
    theme: Theme;
    effectiveTheme: 'dark' | 'light';
    toggleTheme: () => void;
    setTheme: (theme: Theme) => void;
    updateSystemTheme: () => void;
}

const getSystemTheme = (): 'dark' | 'light' => 
    window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';

export const useThemeStore = create<ThemeState>()(
    persist(
        (set, get) => ({
            theme: 'system',
            effectiveTheme: typeof window !== 'undefined' ? getSystemTheme() : 'dark',

            toggleTheme: () => {
                const current = get().theme;
                const next: Theme = current === 'dark' ? 'light' : 'dark';
                get().setTheme(next);
            },

            setTheme: (theme) => {
                const effective = theme === 'system' ? getSystemTheme() : theme;
                set({ theme, effectiveTheme: effective });
                applyTheme(effective);
            },

            updateSystemTheme: () => {
                const { theme } = get();
                if (theme === 'system') {
                    const effective = getSystemTheme();
                    set({ effectiveTheme: effective });
                    applyTheme(effective);
                }
            },
        }),
        {
            name: 'theme-storage',
            storage: createJSONStorage(() => safeStorage),
            onRehydrateStorage: () => {
                return (state) => {
                    if (state) {
                        const effective = state.theme === 'system' ? getSystemTheme() : state.theme;
                        state.effectiveTheme = effective;
                        applyTheme(effective);
                    }
                };
            },
        }
    )
);

function applyTheme(effective: 'dark' | 'light') {
    if (typeof window === 'undefined') return;
    const root = document.documentElement;
    if (effective === 'light') {
        root.classList.add('light');
        root.classList.remove('dark');
    } else {
        root.classList.add('dark');
        root.classList.remove('light');
    }
}

// System theme listener
if (typeof window !== 'undefined') {
    window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => {
        useThemeStore.getState().updateSystemTheme();
    });
}
