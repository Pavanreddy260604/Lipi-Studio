import { useEffect, useRef } from 'react';

export function useAutoResize(content: string) {
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const observerRef = useRef<ResizeObserver | null>(null);

    // Set up ResizeObserver once on mount
    useEffect(() => {
        observerRef.current = new ResizeObserver(() => {
            const textarea = textareaRef.current;
            if (!textarea) return;
            textarea.style.height = 'auto';
            textarea.style.height = `${textarea.scrollHeight}px`;
        });

        if (textareaRef.current) {
            observerRef.current.observe(textareaRef.current);
        }

        return () => observerRef.current?.disconnect();
    }, []);

    // Sync height when content changes
    useEffect(() => {
        const textarea = textareaRef.current;
        if (!textarea) return;
        textarea.style.height = 'auto';
        textarea.style.height = `${textarea.scrollHeight}px`;
    }, [content]);

    return textareaRef;
}
