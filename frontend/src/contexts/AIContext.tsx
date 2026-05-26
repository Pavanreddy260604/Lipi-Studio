import {
    createContext,
    useContext,
    useState,
    useCallback,
    useEffect,
    useRef,
    useMemo,
    type ReactNode,
} from 'react';
import { api } from '../services/api';
import { useAuthStore } from '../stores/authStore';
import { useChatStore } from '../stores/chatStore';
import { storage } from '../lib/safeStorage';

import { AI_MODELS, type AIModelOption } from '../config/aiModels';

export interface Attachment {
    localId?: string;
    name: string;
    content?: string;
    type: string;
    file?: File;
    attachmentId?: string;
    status?: 'pending' | 'indexing' | 'completed' | 'failed' | 'cancelled';
    errorMessage?: string;
    isImage?: boolean;
    isBinary?: boolean;
    isText?: boolean;
    shouldIndex?: boolean;
}

export interface Message {
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: Date;
    attachments?: Attachment[];
    status?: 'pending' | 'indexing' | 'completed' | 'failed' | 'cancelled';
    loadingLabel?: 'thinking' | 'knowledge' | 'github';
    resourceSummary?: string[];
    progressText?: string;
    progressSteps?: string[];
    progressPhase?: number;
    modelUsed?: string;
}

interface AIContextType {
    sendMessage: (content: string, attachments?: Attachment[], onChunk?: (chunk: string) => void) => Promise<void>;
    stopStreaming: () => void;
    regenerateLastResponse: (onChunk?: (chunk: string) => void) => Promise<void>;
    clearMessages: () => void;
    AI_MODELS: typeof AI_MODELS;
    context: any;
    setContext: (data: any) => void;
    ensureChatConversation: () => Promise<string>;
    indexAttachment: (conversationId: string, attachment: Attachment, onStatusUpdate?: (patch: Partial<Attachment>) => void) => Promise<string>;
}

const AIContext = createContext<AIContextType | undefined>(undefined);

const EMPTY_ASSISTANT_RESPONSE = 'No response from the assistant.';
const PROGRESS_PREFIX = '__PROGRESS__:';
const PROGRESS_PREFIX_GUARD = 3;

const isAbortError = (error: unknown) => {
    if (error instanceof DOMException && error.name === 'AbortError') return true;
    if (error instanceof Error && error.name === 'AbortError') return true;
    return false;
};

const inferLoadingLabel = (
    progressText: string,
    fallback: Message['loadingLabel'] = 'thinking'
): Message['loadingLabel'] => {
    const normalized = progressText.toLowerCase();
    if (/\b(github|repo|repository|branch|tree|files|audit|review)\b/.test(normalized)) {
        return 'github';
    }
    if (/\b(knowledge|attachment|document|context|vector|index|retriev|workspace)\b/.test(normalized)) {
        return 'knowledge';
    }
    return fallback;
};

const inferProgressPhase = (label: Message['loadingLabel'], progressText: string) => {
    const normalized = progressText.toLowerCase();

    if (label === 'github') {
        if (/\b(connect|metadata|access)\b/.test(normalized)) return 1;
        if (/\b(tree|branch|scan|structure)\b/.test(normalized)) return 2;
        if (/\b(read|download|files)\b/.test(normalized)) return 3;
        if (/\b(review|audit|generat|final)\b/.test(normalized)) return 4;
    }

    if (label === 'knowledge') {
        if (/\b(index|attachment|document)\b/.test(normalized)) return 1;
        if (/\b(search|retriev|context|knowledge)\b/.test(normalized)) return 2;
        return 3;
    }

    return /\b(plan|tool|analy|synth)\b/.test(normalized) ? 2 : 1;
};

const consumeStreamingChunk = (
    previousBuffer: string,
    chunk: string,
    onProgress: (progress: string) => void,
    flush: boolean = false
) => {
    let buffer = previousBuffer + chunk;
    let visibleText = '';

    while (buffer.length > 0) {
        const markerIndex = buffer.indexOf(PROGRESS_PREFIX);

        if (markerIndex === -1) {
            if (flush) {
                visibleText += buffer;
                buffer = '';
            } else {
                const safeLength = Math.max(0, buffer.length - PROGRESS_PREFIX_GUARD);
                visibleText += buffer.slice(0, safeLength);
                buffer = buffer.slice(safeLength);
            }
            break;
        }

        if (markerIndex > 0) {
            visibleText += buffer.slice(0, markerIndex);
            buffer = buffer.slice(markerIndex);
        }

        const newlineIndex = buffer.indexOf('\n');
        if (newlineIndex === -1) {
            if (flush && buffer.startsWith(PROGRESS_PREFIX)) {
                const trailingProgress = buffer.slice(PROGRESS_PREFIX.length).trim();
                if (trailingProgress) {
                    onProgress(trailingProgress);
                }
                buffer = '';
            }
            break;
        }

        const progressText = buffer.slice(PROGRESS_PREFIX.length, newlineIndex).trim();
        if (progressText) {
            onProgress(progressText);
        }
        buffer = buffer.slice(newlineIndex + 1);
    }

    return {
        visibleText,
        remainder: buffer
    };
};

export function AIProvider({ children }: { children: ReactNode }) {
    const [conversationId, setConversationId] = useState<string | null>(() => {
        return storage.get('learning-os-conversation-id', null);
    });
    const [selectedModel, setSelectedModel] = useState(() => {
        return storage.get('learning-os-ai-model', 'balanced');
    });
    const lastSyncedModelRef = useRef<string | null>(null);
    const [context, setContext] = useState<any>({});
    const sessionInitPromiseRef = useRef<Promise<string> | null>(null);
    const messagesRef = useRef<Message[]>([]);
    const abortControllerRef = useRef<AbortController | null>(null);

    const [systemContext, setSystemContext] = useState('');
    const { token } = useAuthStore();

    // Sync messages/isOpen/isLoading to chatStore
    const setStoreState = useCallback((patch: Partial<ReturnType<typeof useChatStore.getState>>) => {
        useChatStore.setState(patch);
    }, []);

    useEffect(() => {
        const unsub = useChatStore.subscribe((s) => {
            messagesRef.current = s.messages;
        });
        return unsub;
    }, []);

    useEffect(() => {
        useChatStore.setState({ selectedModel });
        storage.set('learning-os-ai-model', selectedModel);
    }, [selectedModel]);

    useEffect(() => {
        useChatStore.setState({ conversationId: conversationId || undefined });
    }, [conversationId]);

    useEffect(() => {
        if (conversationId) {
            storage.set('learning-os-conversation-id', conversationId);
        } else {
            storage.remove('learning-os-conversation-id');
        }
    }, [conversationId]);

    useEffect(() => {
        if (!conversationId) {
            lastSyncedModelRef.current = null;
            return;
        }
        if (!selectedModel || selectedModel === lastSyncedModelRef.current) return;

        api.updateChatConversation(conversationId, { model: selectedModel })
            .then(() => {
                lastSyncedModelRef.current = selectedModel;
            })
            .catch(() => {});
    }, [conversationId, selectedModel]);

    const isSpecificChatQuery = useCallback((value: string) => {
        const text = value.trim().toLowerCase();
        if (!text) return false;

        const genericGreeting = /^(hi|hello|hey|thanks|thank you|ok|okay|cool|test|ping|yo|sup)\b/;
        if (genericGreeting.test(text)) return false;

        const resourceHints = /\b(file|files|document|doc|pdf|attachment|attachments|upload|uploaded|notes|notebook|kb|knowledge base|source|sources|cite|citation|context|from my|in my|from the doc|from the file|in the file|in the doc|in the pdf)\b/;
        const taskHints = /\b(summarize|summary|explain|extract|find|search|compare|analyze|list|quote|show|give me|based on|according to|what does it say)\b/;

        if (resourceHints.test(text) || taskHints.test(text)) return true;
        if (text.length >= 80) return true;
        if (text.includes('?') && text.length >= 20) return true;

        return false;
    }, []);

    const isResourceAttachment = useCallback((att: Attachment) => {
        return Boolean(att.shouldIndex || att.isText || (!att.isImage && !att.isBinary));
    }, []);

    useEffect(() => {
        const { isOpen, messages } = useChatStore.getState();
        if (isOpen && messages.length <= 1) {
            const path = window.location.pathname;
            let contextMsg = "Hi! I'm your deeper learning assistant. I have context on what you're working on. How can I help?";

            if (path.includes('script-writer')) {
                contextMsg = "I see you're in Lipi Studio. Need help developing a scene or character?";
            } else if (path.includes('dsa')) {
                contextMsg = "Ready to solve some DSA problems? I can help you optimize your code.";
            } else if (path.includes('interview')) {
                contextMsg = "Preparing for an interview? Let's practice some mock questions.";
            } else if (path.includes('backend')) {
                contextMsg = "Working on backend architecture? I can help with system design.";
            }

            const current = useChatStore.getState().messages;
            if (current.length === 0 || (current.length === 1 && current[0].id === 'welcome')) {
                useChatStore.setState({
                    messages: [{
                        id: 'welcome',
                        role: 'assistant',
                        content: contextMsg,
                        timestamp: new Date()
                    }]
                });
            }
        }
    }, []);

    const setMessages = useCallback((updater: Message[] | ((prev: Message[]) => Message[])) => {
        const current = useChatStore.getState().messages;
        const next = typeof updater === 'function' ? updater(current) : updater;
        useChatStore.setState({ messages: next });
    }, []);

    const clearMessages = useCallback(() => {
        abortControllerRef.current?.abort();
        abortControllerRef.current = null;
        useChatStore.setState({ messages: [], isLoading: false });
        setConversationId(null);
    }, []);

    const ensureChatConversation = useCallback(async () => {
        if (conversationId) return conversationId;
        if (sessionInitPromiseRef.current) return sessionInitPromiseRef.current;

        const createPromise = (async () => {
            const newConversation = await api.createChatConversation(undefined, selectedModel);
            setConversationId(newConversation._id);
            lastSyncedModelRef.current = selectedModel;
            return newConversation._id;
        })();

        sessionInitPromiseRef.current = createPromise;
        try {
            return await createPromise;
        } finally {
            sessionInitPromiseRef.current = null;
        }
    }, [conversationId, selectedModel]);

    const updateMessageById = useCallback((messageId: string | null, updater: (message: Message) => Message) => {
        if (!messageId) return;
        setMessages((prev) => prev.map((message) => (
            message.id === messageId ? updater(message) : message
        )));
    }, [setMessages]);

    const removeMessageById = useCallback((messageId: string | null) => {
        if (!messageId) return;
        setMessages((prev) => prev.filter((message) => message.id !== messageId));
    }, [setMessages]);

    const toggleOpen = useCallback(() => {
        const next = !useChatStore.getState().isOpen;
        useChatStore.setState({ isOpen: next });
    }, []);

    const indexAttachment = useCallback(async (
        activeConversationId: string,
        attachment: Attachment,
        onStatusUpdate?: (patch: Partial<Attachment>) => void
    ) => {
        const updateStatus = (patch: Partial<Attachment>) => {
            if (onStatusUpdate) onStatusUpdate(patch);
            setMessages((prev) => prev.map((msg) => {
                if (!msg.attachments) return msg;
                const hasMatch = msg.attachments.some(a => a.localId === attachment.localId);
                if (!hasMatch) return msg;
                return {
                    ...msg,
                    attachments: msg.attachments.map(a =>
                        a.localId === attachment.localId ? { ...a, ...patch } : a
                    )
                };
            }));
        };

        if (attachment.attachmentId && attachment.status === 'completed') {
            return attachment.attachmentId;
        }

        updateStatus({ status: 'indexing', errorMessage: undefined });

        try {
            let uploadTarget: File | Blob;
            if (attachment.file) {
                uploadTarget = attachment.file;
            } else if (attachment.content) {
                if (attachment.content.startsWith('data:')) {
                    const res = await fetch(attachment.content);
                    uploadTarget = await res.blob();
                } else {
                    uploadTarget = new Blob([attachment.content], { type: attachment.type || 'text/plain' });
                }
            } else {
                throw new Error('Attachment content is unavailable');
            }

            const uploadRes = await api.uploadChatAttachment(activeConversationId, uploadTarget, attachment.name);
            updateStatus({
                attachmentId: uploadRes.attachmentId,
                status: 'completed',
                errorMessage: undefined
            });
            return uploadRes.attachmentId;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Upload failed';
            updateStatus({ status: 'failed', errorMessage });
            throw error;
        }
    }, [setMessages]);

    const prepareAttachmentsForSend = useCallback(async (
        activeConversationId: string,
        attachments: Attachment[],
        userMessageId: string
    ) => {
        const collectedAttachmentIds: string[] = [];
        const indexedAttachmentNames: string[] = [];
        const failedAttachmentNames: string[] = [];
        const fallbackTextAttachments: Attachment[] = [];
        const images: string[] = [];

        const updateAttachmentStatus = (localId: string | undefined, patch: Partial<Attachment>) => {
            if (!localId) return;
            updateMessageById(userMessageId, (message) => ({
                ...message,
                attachments: (message.attachments || []).map((attachment) => (
                    attachment.localId === localId ? { ...attachment, ...patch } : attachment
                ))
            }));
        };

        for (const attachment of attachments) {
            if (attachment.isImage) {
                const base64 = typeof attachment.content === 'string' ? attachment.content.split(',')[1] : '';
                if (base64) {
                    images.push(base64);
                    updateAttachmentStatus(attachment.localId, { status: 'completed' });
                }
                continue;
            }

            if (!attachment.shouldIndex) {
                if (attachment.isText && attachment.content) {
                    fallbackTextAttachments.push(attachment);
                }
                updateAttachmentStatus(attachment.localId, { status: 'completed' });
                continue;
            }

            if (attachment.attachmentId && attachment.status === 'completed') {
                collectedAttachmentIds.push(attachment.attachmentId);
                indexedAttachmentNames.push(attachment.name);
                continue;
            }

            try {
                const attachmentId = await indexAttachment(activeConversationId, attachment);
                collectedAttachmentIds.push(attachmentId);
                indexedAttachmentNames.push(attachment.name);
            } catch (error) {
                failedAttachmentNames.push(attachment.name);
                if (attachment.isText && attachment.content) {
                    fallbackTextAttachments.push(attachment);
                }
            }
        }

        return {
            collectedAttachmentIds,
            indexedAttachmentNames,
            failedAttachmentNames,
            fallbackTextAttachments,
            images
        };
    }, [updateMessageById, indexAttachment]);

    const finalizeAssistantMessage = useCallback((messageId: string, content: string, status?: Message['status']) => {
        const finalContent = content.trim() || EMPTY_ASSISTANT_RESPONSE;
        updateMessageById(messageId, (message) => ({
            ...message,
            content: finalContent,
            status,
            progressText: undefined,
            progressSteps: undefined,
            progressPhase: undefined
        }));
    }, [updateMessageById]);

    const sendMessage = useCallback(async (
        content: string,
        attachments: Attachment[] = [],
        onChunk?: (chunk: string) => void
    ) => {
        const isLoading = useChatStore.getState().isLoading;
        if ((!content.trim() && attachments.length === 0) || isLoading) return;

        const priorResources = messagesRef.current
            .flatMap((msg) => msg.attachments || [])
            .filter(isResourceAttachment)
            .map((att) => att.name);
        const currentResources = attachments
            .filter(isResourceAttachment)
            .map((att) => att.name);
        const resourceSummary = Array.from(new Set([...priorResources, ...currentResources]));
        const isSpecific = isSpecificChatQuery(content);
        const loadingLabel: Message['loadingLabel'] = resourceSummary.length > 0 && isSpecific
            ? 'knowledge'
            : 'thinking';

        const normalizedAttachments: Attachment[] = attachments.map((attachment) => ({
            ...attachment,
            status: attachment.isImage
                ? 'completed'
                : (attachment.shouldIndex ? 'pending' : 'completed') as Attachment['status']
        }));

        const assistantMessageId = `${Date.now() + 1}`;
        const userMessageId = `${Date.now()}`;

        useChatStore.setState({ isLoading: true });
        setMessages((prev) => [
            ...prev,
            {
                id: userMessageId,
                role: 'user',
                content: content.trim(),
                timestamp: new Date(),
                attachments: normalizedAttachments.length > 0 ? normalizedAttachments : undefined,
                status: normalizedAttachments.some((att) => att.shouldIndex && !att.isImage) ? 'indexing' : undefined
            },
            {
                id: assistantMessageId,
                role: 'assistant',
                content: '',
                timestamp: new Date(),
                loadingLabel,
                resourceSummary: resourceSummary.slice(0, 6)
            }
        ]);

        const controller = new AbortController();
        abortControllerRef.current = controller;

        let botContent = '';
        let pendingChunk = '';
        let streamBuffer = '';
        let lastUpdate = Date.now();

        const handleProgressUpdate = (progressText: string) => {
            if (progressText.startsWith('SYSTEM:Inference via ')) {
                const modelId = progressText.replace('SYSTEM:Inference via ', '');
                updateMessageById(assistantMessageId, (message) => ({
                    ...message,
                    modelUsed: modelId
                }));
                return;
            }

            updateMessageById(assistantMessageId, (message) => {
                const nextLabel = inferLoadingLabel(progressText, message.loadingLabel || loadingLabel);
                const nextSteps = Array.from(new Set([...(message.progressSteps || []), progressText])).slice(-4);

                return {
                    ...message,
                    loadingLabel: nextLabel,
                    progressText,
                    progressSteps: nextSteps,
                    progressPhase: inferProgressPhase(nextLabel, progressText)
                };
            });
        };

        try {
            let injectedContext = '';

            if (systemContext && systemContext.trim()) {
                injectedContext += `${systemContext.trim()}\n\n`;
                setSystemContext('');
            }

            if (context && Object.keys(context).length > 0) {
                const contextStr = JSON.stringify(context, null, 2);
                const safeContext = contextStr.length > 4000 ? `${contextStr.slice(0, 4000)}...` : contextStr;
                injectedContext += `[Current Data Context: ${safeContext}]\n\n`;
            }

            const activeConversationId = await ensureChatConversation();
            const {
                collectedAttachmentIds,
                indexedAttachmentNames,
                failedAttachmentNames,
                fallbackTextAttachments,
                images
            } = await prepareAttachmentsForSend(activeConversationId, attachments, userMessageId);

            if (
                attachments.some((attachment) => attachment.shouldIndex && !attachment.isImage) &&
                collectedAttachmentIds.length === 0 &&
                fallbackTextAttachments.length === 0
            ) {
                throw new Error(`Failed to analyze attachments: ${failedAttachmentNames.join(', ') || 'upload failed'}`);
            }

            let apiPayload = injectedContext ? `${injectedContext}${content.trim()}` : content.trim();
            const indexedNotice = indexedAttachmentNames.length > 0
                ? `ATTACHED FILES INDEXED FOR RETRIEVAL:\n- ${indexedAttachmentNames.join('\n- ')}\n\n`
                : '';
            const failedNotice = failedAttachmentNames.length > 0
                ? `THE FOLLOWING ATTACHMENTS FAILED TO INDEX AND MAY BE UNAVAILABLE:\n- ${failedAttachmentNames.join('\n- ')}\n\n`
                : '';

            if (fallbackTextAttachments.length > 0) {
                const fileContext = fallbackTextAttachments.map((attachment) => {
                    const rawContent = typeof attachment.content === 'string' ? attachment.content : '';
                    const safeContent = rawContent.length > 6000 ? `${rawContent.slice(0, 6000)}...` : rawContent;
                    return `[File Attachment: ${attachment.name}]\n${safeContent}`;
                }).join('\n\n');

                apiPayload = `${indexedNotice}${failedNotice}CONTEXT FROM ATTACHED FILES (fallback text):\n${fileContext}\n\nUSER MESSAGE: ${apiPayload}`;
            } else if (indexedNotice || failedNotice) {
                apiPayload = `${indexedNotice}${failedNotice}USER MESSAGE: ${apiPayload}`;
            }

            await api.sendChatMessage(
                activeConversationId,
                apiPayload,
                (chunk) => {
                    const parsedChunk = consumeStreamingChunk(streamBuffer, chunk, handleProgressUpdate);
                    streamBuffer = parsedChunk.remainder;
                    if (parsedChunk.visibleText) {
                        botContent += parsedChunk.visibleText;
                        pendingChunk += parsedChunk.visibleText;
                    }

                    const now = Date.now();
                    if (now - lastUpdate > 16) {
                        lastUpdate = now;
                        updateMessageById(assistantMessageId, (message) => ({
                            ...message,
                            content: botContent
                        }));
                        if (pendingChunk) onChunk?.(pendingChunk);
                        pendingChunk = '';
                    }
                },
                controller.signal,
                'learning-os',
                undefined,
                images,
                collectedAttachmentIds
            );

            const finalChunk = consumeStreamingChunk(streamBuffer, '', handleProgressUpdate, true);
            if (finalChunk.visibleText) {
                botContent += finalChunk.visibleText;
                pendingChunk += finalChunk.visibleText;
            }

            if (pendingChunk) {
                updateMessageById(assistantMessageId, (message) => ({
                    ...message,
                    content: botContent
                }));
                onChunk?.(pendingChunk);
            }

            finalizeAssistantMessage(assistantMessageId, botContent);
        } catch (error) {
            if (isAbortError(error)) {
                if (botContent.trim()) {
                    finalizeAssistantMessage(assistantMessageId, botContent, 'cancelled');
                } else {
                    removeMessageById(assistantMessageId);
                }
                return;
            }

            const errorMessage = error instanceof Error ? error.message : 'Sorry, I encountered an error. Please try again.';
            updateMessageById(assistantMessageId, (message) => ({
                ...message,
                content: errorMessage,
                status: 'failed',
                progressText: undefined,
                progressSteps: undefined,
                progressPhase: undefined
            }));
        } finally {
            abortControllerRef.current = null;
            useChatStore.setState({ isLoading: false });
        }
    }, [
        context,
        ensureChatConversation,
        finalizeAssistantMessage,
        isResourceAttachment,
        isSpecificChatQuery,
        prepareAttachmentsForSend,
        removeMessageById,
        systemContext,
        updateMessageById,
        setMessages
    ]);

    const stopStreaming = useCallback(() => {
        abortControllerRef.current?.abort();
    }, []);

    const regenerateLastResponse = useCallback(async (onChunk?: (chunk: string) => void) => {
        const { conversationId: convId, isLoading } = useChatStore.getState();
        if (!convId || isLoading) return;

        const currentMessages = messagesRef.current.filter((message) => message.id !== 'welcome');
        if (currentMessages.length === 0) return;

        const trailingAssistant = currentMessages[currentMessages.length - 1]?.role === 'assistant'
            ? currentMessages[currentMessages.length - 1]
            : null;
        const lastUser = [...(trailingAssistant ? currentMessages.slice(0, -1) : currentMessages)]
            .reverse()
            .find((message) => message.role === 'user');

        if (!lastUser) return;

        const assistantMessageId = `${Date.now()}-regen`;
        const baseMessages = trailingAssistant
            ? currentMessages.filter((message) => message.id !== trailingAssistant.id)
            : currentMessages;

        setMessages([
            ...baseMessages,
            {
                id: assistantMessageId,
                role: 'assistant',
                content: '',
                timestamp: new Date(),
                loadingLabel: lastUser.attachments?.length ? 'knowledge' : 'thinking',
                resourceSummary: (lastUser.attachments || []).map((attachment) => attachment.name).slice(0, 6)
            }
        ]);

        const controller = new AbortController();
        abortControllerRef.current = controller;
        useChatStore.setState({ isLoading: true });

        let botContent = '';
        let pendingChunk = '';
        let streamBuffer = '';
        let lastUpdate = Date.now();

        const handleProgressUpdate = (progressText: string) => {
            updateMessageById(assistantMessageId, (message) => {
                const nextLabel = inferLoadingLabel(progressText, message.loadingLabel || 'thinking');
                const nextSteps = Array.from(new Set([...(message.progressSteps || []), progressText])).slice(-4);

                return {
                    ...message,
                    loadingLabel: nextLabel,
                    progressText,
                    progressSteps: nextSteps,
                    progressPhase: inferProgressPhase(nextLabel, progressText)
                };
            });
        };

        try {
            await api.regenerateChatResponse(convId, (chunk) => {
                const parsedChunk = consumeStreamingChunk(streamBuffer, chunk, handleProgressUpdate);
                streamBuffer = parsedChunk.remainder;
                if (parsedChunk.visibleText) {
                    botContent += parsedChunk.visibleText;
                    pendingChunk += parsedChunk.visibleText;
                }

                const now = Date.now();
                if (now - lastUpdate > 16) {
                    lastUpdate = now;
                    updateMessageById(assistantMessageId, (message) => ({
                        ...message,
                        content: botContent
                    }));
                    if (pendingChunk) onChunk?.(pendingChunk);
                    pendingChunk = '';
                }
            }, controller.signal);

            const finalChunk = consumeStreamingChunk(streamBuffer, '', handleProgressUpdate, true);
            if (finalChunk.visibleText) {
                botContent += finalChunk.visibleText;
                pendingChunk += finalChunk.visibleText;
            }

            if (pendingChunk) {
                updateMessageById(assistantMessageId, (message) => ({
                    ...message,
                    content: botContent
                }));
                onChunk?.(pendingChunk);
            }

            finalizeAssistantMessage(assistantMessageId, botContent);
        } catch (error) {
            if (isAbortError(error)) {
                if (botContent.trim()) {
                    finalizeAssistantMessage(assistantMessageId, botContent, 'cancelled');
                } else {
                    removeMessageById(assistantMessageId);
                }
                return;
            }

            const errorMessage = error instanceof Error ? error.message : 'Failed to regenerate the response.';
            updateMessageById(assistantMessageId, (message) => ({
                ...message,
                content: errorMessage,
                status: 'failed',
                progressText: undefined,
                progressSteps: undefined,
                progressPhase: undefined
            }));
        } finally {
            abortControllerRef.current = null;
            useChatStore.setState({ isLoading: false });
        }
    }, [finalizeAssistantMessage, removeMessageById, updateMessageById, setMessages]);

    useEffect(() => {
        const { isOpen } = useChatStore.getState();
        if (isOpen && token) {
            api.getActivityHistory(10)
                .then((activities) => {
                    const topActivities = activities.slice(0, 5);
                    const formattedDetails = topActivities.map((activity) =>
                        `- [${new Date(activity.timestamp || Date.now()).toLocaleTimeString()}] ${activity.description} (${activity.type})`
                    ).join('\n');

                    if (formattedDetails) {
                        setSystemContext(`USER ACTIVITY CONTEXT:\n${formattedDetails}\n\n`);
                    }
                })
                .catch((err) => {
                    if (import.meta.env.DEV) console.warn('Failed to fetch activity context:', err);
                });
        }
    }, [token]);

    const updateContext = useCallback((newData: any) => {
        setContext((prev: any) => {
            if (JSON.stringify(prev) === JSON.stringify(newData)) return prev;
            return newData;
        });
    }, []);

    const value: AIContextType = useMemo(() => ({
        sendMessage,
        stopStreaming,
        regenerateLastResponse,
        clearMessages,
        AI_MODELS,
        context,
        setContext: updateContext,
        ensureChatConversation,
        indexAttachment
    }), [
        clearMessages,
        context,
        ensureChatConversation,
        indexAttachment,
        regenerateLastResponse,
        sendMessage,
        stopStreaming,
        updateContext,
    ]);

    return (
        <AIContext.Provider value={value}>
            {children}
        </AIContext.Provider>
    );
}

export function useAI() {
    const context = useContext(AIContext);
    if (context === undefined) {
        throw new Error('useAI must be used within an AIProvider');
    }
    return context;
}

export function useAIContextTracker(type: string | null, data: any) {
    const { setContext } = useAI();
    const lastDataRef = useRef<string>('');

    useEffect(() => {
        if (!type || !data) {
            if (lastDataRef.current !== 'null') {
                setContext(null);
                lastDataRef.current = 'null';
            }
            return;
        }

        const dataId = data?._id || data?.id || 'no-id';
        const currentDataStr = `${type}-${dataId}-${JSON.stringify(data).length}`;

        if (currentDataStr !== lastDataRef.current) {
            setContext({
                type,
                data,
                trackedAt: new Date().toISOString()
            });
            lastDataRef.current = currentDataStr;
        }
    }, [type, data, setContext]);
}
