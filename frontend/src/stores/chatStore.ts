import { create } from 'zustand';
import type { Message } from '../contexts/AIContext';

export type ChatLoadingLabel = 'thinking' | 'knowledge' | 'github';

interface ChatState {
  isOpen: boolean;
  toggleOpen: () => void;
  messages: Message[];
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
  setMessages: (messages: Message[] | ((prev: Message[]) => Message[])) => void;
  selectedModel: string;
  setSelectedModel: (model: string) => void;
  clearMessages: () => void;
  conversationId?: string;
  setConversationId: (id: string | undefined) => void;
}

export const useChatStore = create<ChatState>((set) => ({
  isOpen: false,
  toggleOpen: () => set((s) => ({ isOpen: !s.isOpen })),
  messages: [],
  isLoading: false,
  setIsLoading: (loading) => set({ isLoading: loading }),
  setMessages: (messagesOrFn) =>
    set((s) => ({
      messages: typeof messagesOrFn === 'function' ? messagesOrFn(s.messages) : messagesOrFn,
    })),
  selectedModel: 'balanced',
  setSelectedModel: (model) => set({ selectedModel: model }),
  clearMessages: () => set({ messages: [], isLoading: false }),
  conversationId: undefined,
  setConversationId: (id) => set({ conversationId: id }),
}));
