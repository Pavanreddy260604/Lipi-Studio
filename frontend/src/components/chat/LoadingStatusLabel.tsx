import { cn } from '../../lib/utils';

export type LoadingAnimationKind = 'thinking' | 'knowledge' | 'tools' | 'github' | 'writing';

type LoadingMessage = {
    loadingLabel?: 'thinking' | 'knowledge' | 'github';
    progressText?: string;
    content?: string;
};

export interface LoadingVisual {
    title: string;
    detail: string;
    animation: LoadingAnimationKind;
}

const toSentenceCase = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return '';
    return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
};

const shouldUseProgressDetail = (progressText: string, title: string) => (
    progressText.length > 0 && progressText.toLowerCase() !== title.toLowerCase()
);

export const getLoadingVisual = (message?: LoadingMessage | null): LoadingVisual => {
    const progressText = typeof message?.progressText === 'string' ? message.progressText.trim() : '';
    const normalized = progressText.toLowerCase();
    const hasContent = Boolean(message?.content?.trim());

    if (hasContent) {
        return {
            title: 'Writing answer',
            detail: shouldUseProgressDetail(progressText, 'Writing answer')
                ? toSentenceCase(progressText)
                : 'Turning the result into a clear response.',
            animation: 'writing'
        };
    }

    if (message?.loadingLabel === 'github') {
        const title = /\b(read|file|source|diff|download)\b/.test(normalized)
            ? 'Reading files'
            : /\b(scan|tree|branch|structure)\b/.test(normalized)
                ? 'Scanning repository'
                : /\b(review|audit|finding|report|final)\b/.test(normalized)
                    ? 'Reviewing repository'
                    : /\b(access|connect|metadata)\b/.test(normalized)
                        ? 'Opening repository'
                        : 'Reviewing repository';

        return {
            title,
            detail: shouldUseProgressDetail(progressText, title)
                ? toSentenceCase(progressText)
                : 'Checking repository structure and code before replying.',
            animation: 'github'
        };
    }

    if (/\b(tool|function|call|invoke|executor|plugin)\b/.test(normalized)) {
        return {
            title: 'Calling tools',
            detail: shouldUseProgressDetail(progressText, 'Calling tools')
                ? toSentenceCase(progressText)
                : 'Running the right tools before replying.',
            animation: 'tools'
        };
    }

    if (message?.loadingLabel === 'knowledge') {
        const title = /\b(index|attachment|document|upload)\b/.test(normalized)
            ? 'Reading documents'
            : /\b(rank|ground|source|citation)\b/.test(normalized)
                ? 'Grounding answer'
                : 'Searching knowledge';

        return {
            title,
            detail: shouldUseProgressDetail(progressText, title)
                ? toSentenceCase(progressText)
                : 'Finding the most relevant context for the answer.',
            animation: 'knowledge'
        };
    }

    const title = /\b(search|browse|lookup|find)\b/.test(normalized)
        ? 'Searching'
        : /\b(analy|inspect|check|reason)\b/.test(normalized)
            ? 'Analyzing'
            : 'Thinking';

    return {
        title,
        detail: shouldUseProgressDetail(progressText, title)
            ? toSentenceCase(progressText)
            : 'Working through the next response.',
        animation: title === 'Searching' ? 'knowledge' : 'thinking'
    };
};

interface LoadingStatusLabelProps {
    text: string;
    animation: LoadingAnimationKind;
    className?: string;
}

export function LoadingStatusLabel({
    text,
    animation,
    className
}: LoadingStatusLabelProps) {
    const words = text.split(/\s+/).filter(Boolean);

    if (animation === 'thinking') {
        return (
            <span className={cn('text-[var(--text-primary)]', className)} aria-label={text}>
                {Array.from(text).map((char, index) => (
                    <span
                        key={`${char}-${index}`}
                        className={cn(char === ' ' ? 'inline-block w-[0.25em]' : '')}
                        style={{ ['--char-index' as string]: index.toString() }}
                    >
                        {char === ' ' ? '\u00A0' : char}
                    </span>
                ))}
            </span>
        );
    }

    if (animation === 'tools') {
        return (
            <span className={cn('text-[var(--text-primary)]', className)} aria-label={text}>
                {words.map((word, index) => (
                    <span
                        key={`${word}-${index}`}
                        style={{ ['--segment-index' as string]: index.toString() }}
                    >
                        {word}{' '}
                    </span>
                ))}
            </span>
        );
    }

    if (animation === 'github') {
        return (
            <span
                className={cn('text-[var(--text-primary)]', className)}
                style={{ ['--segment-count' as string]: Math.max(words.length, 1).toString() }}
                aria-label={text}
            >
                {words.map((word, index) => (
                    <span
                        key={`${word}-${index}`}
                        style={{ ['--segment-index' as string]: index.toString() }}
                    >
                        {word}{' '}
                    </span>
                ))}
            </span>
        );
    }

    if (animation === 'writing') {
        return (
            <span className={cn('text-[var(--text-primary)]', className)}>
                <span>{text}</span>
            </span>
        );
    }

    return (
        <span className={cn('text-[var(--text-primary)]', className)}>
            <span>{text}</span>
        </span>
    );
}
