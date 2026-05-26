import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { DEFAULT_ACCENT } from '../config/accents';

interface UIState {
    // Layout State
    sidebarOpen: boolean;
    isMobile: boolean;
    currentBreakpoint: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
    
    // Feature Visibility
    commandPaletteOpen: boolean;
    notificationsOpen: boolean;
    aiAssistantOpen: boolean;
    shortcutsOpen: boolean;
    
    // Preferences
    reducedMotion: boolean;
    accentColor: string;
    customAccentColor: string | null;
    aiAccentColor: string;
    backgroundTinting: boolean;
    
    // Actions
    toggleSidebar: (open?: boolean) => void;
    setMobile: (isMobile: boolean) => void;
    setBreakpoint: (breakpoint: 'sm' | 'md' | 'lg' | 'xl' | '2xl') => void;
    
    setCommandPalette: (open: boolean) => void;
    setNotifications: (open: boolean) => void;
    setAIAssistant: (open: boolean) => void;
    setShortcuts: (open: boolean) => void;
    
    setReducedMotion: (reduced: boolean) => void;
    setAccentColor: (accent: string) => void;
    setCustomAccentColor: (hex: string | null) => void;
    setAiAccentColor: (hex: string) => void;
    setBackgroundTinting: (enabled: boolean) => void;
}

export const useUIStore = create<UIState>()(
    persist(
        (set) => ({
            // Initial State
            sidebarOpen: true,
            isMobile: false,
            currentBreakpoint: 'lg',
            
            commandPaletteOpen: false,
            notificationsOpen: false,
            aiAssistantOpen: false,
            shortcutsOpen: false,
            
            reducedMotion: typeof window !== 'undefined' ? window.matchMedia('(prefers-reduced-motion: reduce)').matches : false,
            accentColor: DEFAULT_ACCENT,
            customAccentColor: null,
            aiAccentColor: '#00f2ff', // Default Antigravity Cyan
            backgroundTinting: true,
            
            // Actions
            toggleSidebar: (open) => set((state) => ({ 
                sidebarOpen: open !== undefined ? open : !state.sidebarOpen 
            })),
            
            setMobile: (isMobile) => set({ isMobile }),
            
            setBreakpoint: (currentBreakpoint) => set({ currentBreakpoint }),
            
            setCommandPalette: (commandPaletteOpen) => set({ commandPaletteOpen }),
            
            setNotifications: (notificationsOpen) => set({ notificationsOpen }),
            
            setAIAssistant: (aiAssistantOpen) => set({ aiAssistantOpen }),
            
            setShortcuts: (shortcutsOpen) => set({ shortcutsOpen }),
            
            setReducedMotion: (reducedMotion) => set({ reducedMotion }),

            setAccentColor: (accentColor) => set({ accentColor, customAccentColor: null }),

            setCustomAccentColor: (customAccentColor) => set({ customAccentColor, accentColor: 'custom' }),

            setAiAccentColor: (aiAccentColor) => set({ aiAccentColor }),

            setBackgroundTinting: (backgroundTinting) => set({ backgroundTinting }),
        }),
        {
            name: 'crystal-ui-state',
            partialize: (state) => ({ 
                accentColor: state.accentColor,
                customAccentColor: state.customAccentColor,
                aiAccentColor: state.aiAccentColor,
                backgroundTinting: state.backgroundTinting,
                reducedMotion: state.reducedMotion 
            }),
        }
    )
);
