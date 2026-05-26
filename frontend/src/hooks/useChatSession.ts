import { useState, useEffect, useRef, useCallback, useMemo, type MouseEvent } from 'react';
import { api, type ChatConversation } from '../services/api';
import { useAI } from '../contexts/AIContext';
import { useChatStore } from '../stores/chatStore';

export function useChatSession() {
    // 1. Context & Stores
    const messages = useChatStore((s) => s.messages);
    const setMessages = useChatStore((s) => s.setMessages);
    const isLoading = useChatStore((s) => s.isLoading);
    const conversationId = useChatStore((s) => s.conversationId || null);
    const setConversationId = useChatStore((s) => s.setConversationId);
    const clearMessages = useChatStore((s) => s.clearMessages);
    const { sendMessage: contextSendMessage, stopStreaming, regenerateLastResponse: contextRegenerateLastResponse } = useAI();

    // 2. State Hooks
    const [conversations, setConversations] = useState<ChatConversation[]>([]);
    const [globalLoading, setGlobalLoading] = useState(true);
    const [shouldAutoScroll, setShouldAutoScroll] = useState(true);
    const [isAtBottom, setIsAtBottom] = useState(true);
    const [renameTargetId, setRenameTargetId] = useState<string | null>(null);
    const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
    const [newTitle, setNewTitle] = useState('');

    // 3. Ref Hooks
    const lastLoadedIdRef = useRef<string | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const messagesContainerRef = useRef<HTMLDivElement>(null);
    const userInteractionRef = useRef<number>(0);

    // 4. Data Loading Functions
    const loadConversations = useCallback(async () => {
        try {
            const data = await api.getChatHistory();
            setConversations(data);
        } catch (error) {
            console.error('Failed to load history', error);
        } finally {
            setGlobalLoading(false);
        }
    }, []);

    const loadHistory = useCallback(async (id: string) => {
        if (!id) return;
        try {
            const conversation = await api.getChatConversation(id);
            setMessages(
                (conversation.messages || []).map((message: any) => ({
                    ...message,
                    timestamp: new Date(message.timestamp)
                }))
            );
        } catch (error) {
            console.error('Failed to load conversation', error);
        }
    }, [setMessages]);

    // 5. Effects
    useEffect(() => {
        loadConversations();
    }, [loadConversations]);

    useEffect(() => {
        if (conversationId) {
            // Load history if we switch to a different conversation
            if (lastLoadedIdRef.current !== conversationId) {
                if (isLoading) return;
                void loadHistory(conversationId);
                lastLoadedIdRef.current = conversationId;
                setShouldAutoScroll(true);
            }
        } else {
            // Reset if we're in a new chat state
            if (lastLoadedIdRef.current !== null) {
                lastLoadedIdRef.current = null;
                setMessages((prev: any[]) => {
                    // Don't clear if it's already empty or just the welcome message
                    if (prev.length === 0 || (prev.length === 1 && prev[0]?.id === 'welcome')) {
                        return prev;
                    }
                    return [];
                });
            }
        }
    }, [conversationId, isLoading, loadHistory, setMessages]);

    // 6. Action Handlers
    const handleNewChat = useCallback(() => {
        setConversationId(null);
        clearMessages();
        lastLoadedIdRef.current = null;
    }, [clearMessages, setConversationId]);

    const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
        if (!messagesContainerRef.current) return;

        const isUserInteracting = Date.now() - userInteractionRef.current < 1500;
        if (isUserInteracting && !isAtBottom) return;

        const { scrollHeight, clientHeight } = messagesContainerRef.current;
        messagesContainerRef.current.scrollTo({
            top: scrollHeight - clientHeight,
            behavior
        });
    }, [isAtBottom]);

    const handleSend = useCallback(async (content: string, attachments: any[] = []) => {
        if ((!content.trim() && attachments.length === 0)) return;

        setShouldAutoScroll(true);
        try {
            // Rely on Virtuoso's followOutput='auto' to scroll — manual scrollToBottom
            // races with Virtuoso's internal engine and causes jitter
            await contextSendMessage(content, attachments, () => {
                // Optional: add more logic here if needed
            });

            if (!conversationId) {
                await loadConversations();
            }
        } catch (error) {
            console.error('Chat error', error);
        }
    }, [contextSendMessage, conversationId, loadConversations]);

    const handleStop = useCallback(() => {
        stopStreaming();
    }, [stopStreaming]);

    const handleRegenerateLastResponse = useCallback(async () => {
        setShouldAutoScroll(true);
        await contextRegenerateLastResponse(() => {
            // We rely on Virtuoso's followOutput or useEffect in MessageList
        });
        await loadConversations();
    }, [contextRegenerateLastResponse, loadConversations]);

    const confirmRename = useCallback(async () => {
        if (!renameTargetId || !newTitle.trim()) {
            setRenameTargetId(null);
            return;
        }
        try {
            await api.updateChatConversation(renameTargetId, { title: newTitle });
            setConversations((prev) => prev.map((conversation) => (
                conversation._id === renameTargetId
                    ? { ...conversation, title: newTitle }
                    : conversation
            )));
        } catch (error) {
            console.error('Failed to rename', error);
        } finally {
            setRenameTargetId(null);
        }
    }, [newTitle, renameTargetId]);

    const confirmDelete = useCallback(async (e?: MouseEvent) => {
        if (e) e.stopPropagation();
        if (!deleteTargetId) return;

        try {
            await api.deleteChatConversation(deleteTargetId);
            setConversations((prev) => prev.filter((conversation) => conversation._id !== deleteTargetId));
            if (conversationId === deleteTargetId) {
                handleNewChat();
            }
        } catch (error) {
            console.error('Failed to delete', error);
        } finally {
            setDeleteTargetId(null);
        }
    }, [conversationId, deleteTargetId, handleNewChat]);

    const memoizedGroups = useMemo(() => {
        const groups: { [key: string]: ChatConversation[] } = {
            Today: [],
            Yesterday: [],
            'Previous 7 Days': [],
            'Previous 30 Days': [],
            Older: []
        };

        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        const yesterday = today - 86400000;
        const sevenDaysAgo = today - 7 * 86400000;
        const thirtyDaysAgo = today - 30 * 86400000;

        conversations.forEach((conversation) => {
            const date = new Date(conversation.updatedAt || conversation.createdAt).getTime();
            if (date >= today) groups.Today.push(conversation);
            else if (date >= yesterday) groups.Yesterday.push(conversation);
            else if (date >= sevenDaysAgo) groups['Previous 7 Days'].push(conversation);
            else if (date >= thirtyDaysAgo) groups['Previous 30 Days'].push(conversation);
            else groups.Older.push(conversation);
        });

        return Object.entries(groups).filter(([, list]) => list.length > 0);
    }, [conversations]);

    return {
        conversationId,
        setConversationId,
        conversations,
        setConversations,
        messages,
        isLoading,
        globalLoading,
        shouldAutoScroll,
        setShouldAutoScroll,
        isAtBottom,
        setIsAtBottom,
        messagesEndRef,
        messagesContainerRef,
        userInteractionRef,
        renameTargetId,
        setRenameTargetId,
        deleteTargetId,
        setDeleteTargetId,
        newTitle,
        setNewTitle,
        loadConversations,
        handleNewChat,
        scrollToBottom,
        handleSend,
        handleStop,
        handleRegenerateLastResponse,
        confirmRename,
        confirmDelete,
        memoizedGroups
    };
}
