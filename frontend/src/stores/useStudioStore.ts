import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface StudioState {
    // UI Layout State
    leftPanelOpen: boolean;
    rightPanelOpen: boolean;
    activeRightTool: 'assistant' | 'critique' | 'research' | 'cast';
    
    // Editor State
    isGenerating: boolean;
    isCritiquing: boolean;
    isAiThinking: boolean;
    aiStatus: string;
    aiProgress: number;
    
    // Actions
    toggleLeftPanel: () => void;
    toggleRightPanel: () => void;
    setRightTool: (tool: 'assistant' | 'critique' | 'research' | 'cast') => void;
    setAiStatus: (status: string, progress?: number) => void;
    setAiThinking: (thinking: boolean) => void;
    setGenerating: (generating: boolean) => void;
    setCritiquing: (critiquing: boolean) => void;
}

export const useStudioStore = create<StudioState>()(
    persist(
        (set) => ({
            leftPanelOpen: true,
            rightPanelOpen: true,
            activeRightTool: 'assistant',
            
            isGenerating: false,
            isCritiquing: false,
            isAiThinking: false,
            aiStatus: '',
            aiProgress: 0,
            
            toggleLeftPanel: () => set((state) => ({ leftPanelOpen: !state.leftPanelOpen })),
            toggleRightPanel: () => set((state) => ({ rightPanelOpen: !state.rightPanelOpen })),
            setRightTool: (tool) => set({ activeRightTool: tool }),
            setAiStatus: (status, progress = 0) => set({ aiStatus: status, aiProgress: progress }),
            setAiThinking: (thinking) => set({ isAiThinking: thinking }),
            setGenerating: (generating) => set({ isGenerating: generating }),
            setCritiquing: (critiquing) => set({ isCritiquing: critiquing }),
        }),
        {
            name: 'studio-storage',
            partialize: (state) => ({ 
                leftPanelOpen: state.leftPanelOpen, 
                rightPanelOpen: state.rightPanelOpen,
                activeRightTool: state.activeRightTool 
            }),
        }
    )
);
