import { useState } from 'react';
import { ChevronDown, ChevronRight, BookOpen, Film, PenLine, Lightbulb, Database, GitBranch, FileJson, Brain, Copy, Check, Loader2 } from 'lucide-react';

function isSafeImageUrl(url: string): boolean {
    try {
        const parsed = new URL(url, window.location.origin);
        return parsed.protocol === 'http:' || parsed.protocol === 'https:' || parsed.protocol === 'data:';
    } catch {
        return false;
    }
}

function cleanStreamingText(text: string): string {
    if (!text) return '';
    let cleaned = text;

    // 1. If it ends with any part of __TOOL_CALL__:..., strip it
    // Match "__", "__T", "__TOOL_CALL", "__TOOL_CALL__:", "__TOOL_CALL__:p", etc. at the end
    cleaned = cleaned.replace(/__(?:T(?:O(?:O(?:L(?:_(?:C(?:A(?:L(?:L(?:_*(?::(?:[a-z_]*))?)?)?)?)?)?)?)?)?)?)?$/i, '');

    // 2. Strip any partial JSON after __TOOL_CALL__:name: at the end of the text
    const toolCallNames = ['propose_edit', 'query_lore', 'critique_scene', 'generate_outline'];
    for (const toolName of toolCallNames) {
        const marker = `__TOOL_CALL__:${toolName}:`;
        const idx = cleaned.indexOf(marker);
        if (idx !== -1) {
            const slice = cleaned.slice(idx + marker.length);
            const firstBrace = slice.indexOf('{');
            if (firstBrace !== -1) {
                let depth = 0;
                let foundClosing = false;
                for (let i = firstBrace; i < slice.length; i++) {
                    if (slice[i] === '{') depth++;
                    else if (slice[i] === '}') {
                        depth--;
                        if (depth === 0) {
                            foundClosing = true;
                            break;
                        }
                    }
                }
                if (!foundClosing) {
                    cleaned = cleaned.slice(0, idx);
                }
            } else {
                cleaned = cleaned.slice(0, idx);
            }
        }
    }

    // 3. Strip any partial XML tags at the end of the text (e.g. <S, <SCENE_SC, </DIRE, etc.)
    cleaned = cleaned.replace(/<\/?(?:[A-Z_]*)$/gi, '');

    return cleaned;
}

function sanitizeScreenplayMarkup(text: string): string {
    if (!text) return '';
    return text
        // Strip XML/HTML-style center tags
        .replace(/<\/?center>/gi, '')
        .replace(/<center\s*>/gi, '')
        // Strip markdown blockquotes used for dialogue at the start of lines
        .replace(/^>\s?/gm, '')
        // Strip HTML bold/italic/underline/paragraph formatting tags
        .replace(/<\/?(?:b|i|em|strong|u|span|div|p|br\s*\/?)>/gi, '');
}

interface Section {
    header: string;
    content: string;
    raw: string;
}

function parseSections(text: string, isStreaming = false): (Section | string)[] {
    const xmlTags = [
        'THINKING',
        'RESEARCH_DISCLOSURE', 
        'CREATIVE_PLAN', 
        'SCENE_SCRIPT', 
        'AGENT_EXPLANATION', 
        'CHARACTER_MEMORY_UPDATE', 
        'PLOT_STATE_UPDATE', 
        'CRAFT_ANALYSIS', 
        'DIRECTOR_NOTE'
    ];
    
    const segments: (Section | string)[] = [];
    
    interface MatchInfo {
        start: number;
        end: number;
        tag: string;
        content: string;
        raw: string;
    }
    
    const matches: MatchInfo[] = [];
    
    // 1. Detect all XML blocks sequentially
    xmlTags.forEach(tag => {
        const regex = new RegExp(`<${tag}>([\\s\\S]*?)(?:<\\/${tag}>|$)`, 'gi');
        let m;
        while ((m = regex.exec(text)) !== null) {
            matches.push({
                start: m.index,
                end: m.index + m[0].length,
                tag: tag,
                content: m[1],
                raw: m[0]
            });
        }
    });
    
    // 2. Detect all <<<REPLACE>>> diff blocks
    const replaceRegex = /(?:<<<REPLACE>>>|<<<REPLACE)([\s\S]*?)(?:<<<\/REPLACE>>>|<\/REPLACE>|$)/gi;
    let rm;
    while ((rm = replaceRegex.exec(text)) !== null) {
        matches.push({
            start: rm.index,
            end: rm.index + rm[0].length,
            tag: 'SCENE_SCRIPT', // Map screenplay diff replacements to theatrical scenes
            content: rm[1],
            raw: rm[0]
        });
    }

    // 3. Detect markdown code blocks containing screenplay content
    const codeBlockRegex = /```(?:fountain|screenplay|script-edit|markdown|script)?\s*\n([\s\S]*?)\n```/gi;
    let cbm;
    while ((cbm = codeBlockRegex.exec(text)) !== null) {
        const innerContent = cbm[1].trim();
        // Check if the code block content looks like a screenplay scene script
        const hasScreenplayIndicators = /^(?:INT\.|EXT\.|INT\/EXT\.)/im.test(innerContent) || 
                                       innerContent.includes('<<<SEARCH>>>') ||
                                       innerContent.includes('<<<REPLACE>>>');
        
        if (hasScreenplayIndicators) {
            matches.push({
                start: cbm.index,
                end: cbm.index + cbm[0].length,
                tag: 'SCENE_SCRIPT',
                content: innerContent,
                raw: cbm[0]
            });
        }
    }
    
    // Sort all blocks chronologically by start index
    matches.sort((a, b) => a.start - b.start);
    
    // Filter out overlapping matches
    const activeMatches: MatchInfo[] = [];
    let currentEnd = 0;
    for (const match of matches) {
        if (match.start >= currentEnd) {
            activeMatches.push(match);
            currentEnd = match.end;
        }
    }
    
    // Reconstruct sequential segments including conversational introductions
    let cursor = 0;
    for (const match of activeMatches) {
        if (match.start > cursor) {
            const leadingText = text.slice(cursor, match.start).trim();
            if (leadingText) {
                segments.push(leadingText);
            }
        }
        
        segments.push({
            header: match.tag,
            content: match.content,
            raw: match.raw
        });
        
        cursor = match.end;
    }
    
    if (cursor < text.length) {
        const trailingText = text.slice(cursor).trim();
        if (trailingText) {
            segments.push(trailingText);
        }
    }
    
    // Strategy 2 Splitter for legacy Markdown header formats if no XML structures are present
    if (segments.length === 0 && !isStreaming) {
        const parts = text.split(/(?=### )/);
        const mapped = parts.map(part => {
            const headerMatch = part.match(/^### (.+)/);
            if (headerMatch) {
                const content = part.replace(/^### .+\n?/, '').trim();
                return { header: headerMatch[1].trim(), content, raw: part };
            }
            return part.trim();
        }).filter(Boolean);
        if (mapped.length > 0) return mapped;
    }

    // Pre-mount "Screenplay Draft" and "AI Agent Notes" cards if we are streaming scene generation or AI rewrite
    if (isStreaming) {
        // Strip string conversational wrappers if they are simple leading/trailing instructions
        const filteredSegments = segments.filter(seg => {
            if (typeof seg === 'string') {
                const trimmed = seg.trim();
                return !trimmed.startsWith('propose_edit') && !trimmed.startsWith('__TOOL_CALL__');
            }
            return true;
        });

        const hasScript = filteredSegments.some(seg => typeof seg !== 'string' && seg.header === 'SCENE_SCRIPT');
        const hasNotes = filteredSegments.some(seg => typeof seg !== 'string' && (seg.header === 'AGENT_EXPLANATION' || seg.header === 'DIRECTOR_NOTE'));

        if (!hasScript) {
            let insertIdx = filteredSegments.length;
            for (let i = 0; i < filteredSegments.length; i++) {
                const seg = filteredSegments[i];
                if (typeof seg !== 'string' && (seg.header === 'SCENE_SCRIPT' || seg.header === 'AGENT_EXPLANATION' || seg.header === 'DIRECTOR_NOTE')) {
                    insertIdx = i;
                    break;
                }
            }
            filteredSegments.splice(insertIdx, 0, {
                header: 'SCENE_SCRIPT',
                content: '',
                raw: '<SCENE_SCRIPT></SCENE_SCRIPT>'
            });
        }

        if (!hasNotes) {
            filteredSegments.push({
                header: 'AGENT_EXPLANATION',
                content: '',
                raw: '<AGENT_EXPLANATION></AGENT_EXPLANATION>'
            });
        }
        return filteredSegments;
    }
    
    return segments;
}

const SECTION_ICONS: Record<string, typeof BookOpen> = {
    THINKING: Brain,
    RESEARCH_DISCLOSURE: BookOpen,
    CREATIVE_PLAN: Lightbulb,
    SCENE_SCRIPT: Film,
    AGENT_EXPLANATION: PenLine,
    DIRECTOR_NOTE: PenLine,
    CHARACTER_MEMORY_UPDATE: Database,
    PLOT_STATE_UPDATE: GitBranch,
    CRAFT_ANALYSIS: PenLine,
};

const SECTION_LABELS: Record<string, string> = {
    THINKING: 'Thinking Process',
    RESEARCH_DISCLOSURE: 'Research Insights',
    CREATIVE_PLAN: 'Creative Strategy',
    SCENE_SCRIPT: 'Screenplay Draft',
    AGENT_EXPLANATION: 'AI Agent Notes',
    DIRECTOR_NOTE: "Director's Instruction",
    CHARACTER_MEMORY_UPDATE: 'Character State Updates',
    PLOT_STATE_UPDATE: 'Narrative Plot Updates',
    CRAFT_ANALYSIS: 'Craft Blueprint',
};

const METADATA_SECTIONS = new Set(['THINKING', 'RESEARCH_DISCLOSURE', 'CHARACTER_MEMORY_UPDATE', 'PLOT_STATE_UPDATE']);

function renderTextWithImages(text: string) {
    const regex = /!\[(.*?)\]\((.*?)\)/g;
    const parts: ({ type: 'image'; alt: string; url: string } | string)[] = [];
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(text)) !== null) {
        const startIndex = match.index;
        if (startIndex > lastIndex) {
            parts.push(text.slice(lastIndex, startIndex));
        }

        const alt = match[1];
        const url = match[2];
        if (isSafeImageUrl(url)) {
            parts.push({ type: 'image', alt, url } as any);
        }
        lastIndex = regex.lastIndex;
    }

    if (lastIndex < text.length) {
        parts.push(text.slice(lastIndex));
    }

    if (parts.length === 0) return <span>{text}</span>;

    return (
        <>
            {parts.map((part, i) => {
                if (typeof part === 'string') {
                    return <span key={i} className="whitespace-pre-wrap">{part}</span>;
                }
                return (
                    <span key={i} className="block my-2.5 space-y-1">
                        <span className="relative block overflow-hidden rounded-lg border border-subtle-8 bg-surface-elevated group max-w-full">
                            <img 
                                src={part.url} 
                                alt={part.alt} 
                                className="w-full max-h-60 object-cover hover:scale-[1.02] transition-transform duration-300 ease-smooth cursor-pointer"
                                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                            />
                        </span>
                        {part.alt && (
                            <span className="flex items-center gap-1 text-[10px] text-text-tertiary font-semibold pl-0.5">
                                <span className="inline-block w-1 h-1 rounded-full bg-accent animate-pulse" />
                                <span>{part.alt}</span>
                            </span>
                        )}
                    </span>
                );
            })}
        </>
    );
}

function SectionCard({ header, content, isStreaming = false }: { header: string; content: string; isStreaming?: boolean }) {
    // Keep metadata and research expanded by default to ensure maximum readability and transparency
    const isThinking = header === 'THINKING';
    const [userCollapsed, setUserCollapsed] = useState<boolean | null>(null);
    const collapsed = userCollapsed !== null 
        ? userCollapsed 
        : isThinking 
            ? !isStreaming 
            : false;

    const [copied, setCopied] = useState(false);

    const handleCopy = async (e: React.MouseEvent) => {
        e.stopPropagation(); // prevent collapsing/expanding card
        try {
            await navigator.clipboard.writeText(content);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error('Failed to copy text: ', err);
        }
    };

    const Icon = SECTION_ICONS[header] || FileJson;
    const label = SECTION_LABELS[header] || header.replace(/_/g, ' ');

    const isMetadata = METADATA_SECTIONS.has(header);
    const isSceneScript = header === 'SCENE_SCRIPT';

    // Premium Inkwell borders for structural thought streams
    const cardBorderClass = 
        header === 'THINKING' ? 'border-accent/15 bg-subtle-2/60' :
        header === 'RESEARCH_DISCLOSURE' ? 'border-accent bg-subtle-2' :
        header === 'CREATIVE_PLAN' ? 'border-intelligence bg-subtle-3' :
        header === 'SCENE_SCRIPT' ? 'border-strong bg-surface-elevated font-serif shadow-sm' :
        'border-subtle bg-subtle-2';

    return (
        <div className={`rounded-xl border ${cardBorderClass} overflow-hidden shadow-sm transition-all duration-200 hover:shadow-md my-3`}>
            <div className="flex items-center justify-between w-full bg-subtle-2/30">
                <button
                    type="button"
                    onClick={() => setUserCollapsed(!collapsed)}
                    className="flex items-center gap-2 flex-1 text-left px-3 py-2 text-[10px] font-extrabold uppercase tracking-widest text-text-tertiary hover:text-text-secondary hover:bg-subtle-3/50 transition-colors focus-ring"
                >
                    {collapsed ? <ChevronRight size={11} className="text-text-tertiary" /> : <ChevronDown size={11} className="text-text-tertiary" />}
                    <Icon size={11} className="text-text-secondary" />
                    <span>{label}</span>
                    {isMetadata && (
                        <span className="ml-2 text-[8px] font-semibold text-text-tertiary/60 opacity-60 bg-subtle-3 px-1.5 py-0.5 rounded-full border border-subtle-10">
                            {header === 'THINKING' ? 'reasoning process' : 'thought process'}
                        </span>
                    )}
                </button>
                
                <button
                    type="button"
                    onClick={handleCopy}
                    className="flex items-center justify-center p-1.5 rounded-lg border border-subtle-8 hover:bg-subtle-3 text-text-tertiary hover:text-text-primary transition-all active:scale-95 mr-2 focus-ring"
                    style={{ minWidth: '32px', minHeight: '32px' }}
                    title="Copy content"
                >
                    {copied ? <Check size={11} className="text-accent animate-pulse" /> : <Copy size={11} />}
                </button>
            </div>
            {!collapsed && (
                <div className={`${isSceneScript ? 'px-4 py-3' : 'px-3 py-2'} border-t border-subtle-5`}>
                    {!content.trim() || content.trim() === '...' || content.trim() === 'AI is processing...' ? (
                        <div className="flex flex-col gap-2 p-1 animate-pulse">
                            <div className="flex items-center gap-2 text-text-tertiary">
                                <Loader2 size={12} className="animate-spin text-accent" />
                                <span className="text-[10px] font-medium italic">
                                    {header === 'SCENE_SCRIPT' ? 'Drafting screenplay draft...' :
                                     header === 'DIRECTOR_NOTE' || header === 'AGENT_EXPLANATION' ? 'Formulating editor notes...' :
                                     header === 'THINKING' ? 'Reasoning...' :
                                     header === 'CREATIVE_PLAN' ? 'Planning creative strategy...' :
                                     header === 'RESEARCH_DISCLOSURE' ? 'Retrieving lore reference context...' :
                                     'Analyzing...'}
                                </span>
                            </div>
                            <div className="h-1.5 bg-subtle-10 rounded w-[85%] mt-1" />
                            <div className="h-1.5 bg-subtle-10 rounded w-[60%]" />
                            <div className="h-1.5 bg-subtle-10 rounded w-[40%]" />
                        </div>
                    ) : isSceneScript ? (
                        <div className="space-y-3 font-serif bg-surface-page p-3 rounded-lg border border-subtle-5 max-h-[400px] overflow-y-auto">
                            {sanitizeScreenplayMarkup(content).split(/\n\n+/).map((block, i) => {
                                const trimmed = block.trim();
                                if (!trimmed) return null;
                                
                                const isSceneHeading = /^(INT\.|EXT\.|INT\/EXT\.)/i.test(trimmed);
                                const isTransition = /^FADE (IN|OUT)|^CUT TO:|^DISSOLVE TO:/i.test(trimmed);

                                if (isSceneHeading) {
                                    return <p key={i} className="text-sm font-bold text-accent/80 uppercase leading-relaxed tracking-wide mt-3">{trimmed}</p>;
                                }
                                if (isTransition) {
                                    return <p key={i} className="text-xs font-bold text-text-tertiary uppercase tracking-wider text-right my-2">{trimmed}</p>;
                                }
                                
                                // Detect Character Dialogue block
                                const lines = trimmed.split('\n');
                                const firstLine = lines[0]?.trim() || '';
                                const isDialogueHeader = firstLine.length > 1 && 
                                    firstLine === firstLine.toUpperCase() && 
                                    !firstLine.startsWith('<') && 
                                    !firstLine.startsWith('INT.') && 
                                    !firstLine.startsWith('EXT.');

                                if (isDialogueHeader || trimmed.startsWith('SIDDHARTHA') || trimmed.startsWith('KAI') || trimmed.startsWith('REN')) {
                                    return (
                                        <div key={i} className="space-y-1 my-2.5 max-w-[85%] mx-auto">
                                            <p className="text-xs font-bold text-text-primary text-center uppercase tracking-wider">{firstLine}</p>
                                            {lines.slice(1).map((line, li) => {
                                                const trimmedLine = line.trim();
                                                const isParenthetical = trimmedLine.startsWith('(') && trimmedLine.endsWith(')');
                                                return (
                                                    <p key={li} className={`text-xs leading-relaxed text-center ${
                                                        isParenthetical 
                                                            ? 'text-text-tertiary italic font-sans my-0.5' 
                                                            : 'text-text-secondary pl-6 pr-6'
                                                    }`}>
                                                        {trimmedLine}
                                                    </p>
                                                );
                                            })}
                                        </div>
                                    );
                                }
                                
                                // Standard Action / Description paragraph
                                return <p key={i} className="text-xs leading-relaxed text-text-secondary font-sans leading-normal pl-2 pr-2 my-1">{trimmed}</p>;
                            })}
                        </div>
                    ) : isMetadata ? (
                        <pre className="text-[10px] text-text-tertiary whitespace-pre-wrap font-mono leading-relaxed bg-subtle-3 p-2.5 rounded-lg border border-subtle-10 max-h-60 overflow-y-auto">{content}</pre>
                    ) : (
                        <div className="text-xs leading-relaxed text-text-secondary">{renderTextWithImages(content)}</div>
                    )}
                </div>
            )}
        </div>
    );
}

export function StructuredMessage({ content, isStreaming = false }: { content: string; isStreaming?: boolean }) {
    // Clean trailing partial XML tags and tool calls
    const cleanedText = cleanStreamingText(content);

    // Strip simulated tool call headers like **propose_edit**: or propose_edit:
    let displayContent = cleanedText
        .replace(/(?:^|\n)\s*\*\*propose_edit\*\*[:]?\s*(?:\n|$)/gi, '\n')
        .replace(/(?:^|\n)\s*propose_edit[:]?\s*(?:\n|$)/gi, '\n');

    // Strip ALL tool call markers — display only the explanation/result to the user
    const toolCallNames = ['propose_edit', 'query_lore', 'critique_scene', 'generate_outline'];
    for (const toolName of toolCallNames) {
        const marker = `__TOOL_CALL__:${toolName}:`;
        const idx = displayContent.indexOf(marker);
        if (idx !== -1) {
            const textBefore = displayContent.slice(0, idx).trim();
            const slice = displayContent.slice(idx + marker.length);
            
            let parsedArgs: any = null;
            let jsonEndIdx = -1;
            const firstBrace = slice.indexOf('{');
            if (firstBrace !== -1) {
                let depth = 0;
                let insideString = false;
                let escaped = false;
                for (let i = firstBrace; i < slice.length; i++) {
                    const char = slice[i];
                    if (char === '\\') {
                        escaped = !escaped;
                    } else if (char === '"') {
                        if (!escaped) insideString = !insideString;
                        escaped = false;
                    } else {
                        escaped = false;
                        if (!insideString) {
                            if (char === '{') {
                                depth++;
                            } else if (char === '}') {
                                depth--;
                                if (depth === 0) {
                                    jsonEndIdx = idx + marker.length + i;
                                    try {
                                        parsedArgs = JSON.parse(slice.slice(firstBrace, i + 1));
                                    } catch {
                                        parsedArgs = null;
                                    }
                                    break;
                                }
                            }
                        }
                    }
                }
            }

            if (toolName === 'propose_edit') {
                let explanation = '';
                if (parsedArgs) {
                    explanation = parsedArgs.explanation || '';
                } else {
                    // Try regex matching to extract partial explanation while streaming
                    const explanationRegex = /"explanation"\s*:\s*"((?:[^"\\]|\\.)*)/;
                    const explanationMatch = slice.match(explanationRegex);
                    if (explanationMatch) {
                        explanation = explanationMatch[1]
                            .replace(/\\"/g, '"')
                            .replace(/\\n/g, '\n')
                            .replace(/\\t/g, '\t');
                    }
                }
                
                const explanationText = explanation || (isStreaming ? 'Analyzing screenplay proposal...' : 'Script revision proposed.');
                displayContent = textBefore ? `${textBefore}\n\n${explanationText}`.trim() : explanationText;
            } else {
                // For lore, critique, outline — strip the marker and the JSON but keep the result text that follows
                if (jsonEndIdx !== -1) {
                    displayContent = textBefore + displayContent.slice(jsonEndIdx + 1);
                } else {
                    const markerEnd = displayContent.indexOf('}', idx + marker.length);
                    if (markerEnd !== -1) {
                        displayContent = textBefore + displayContent.slice(markerEnd + 1);
                    } else {
                        // While streaming or if no complete block, just show textBefore to hide the raw JSON/marker
                        displayContent = textBefore || (isStreaming ? 'AI is processing...' : '');
                    }
                }
            }
            break; // Only process the first tool call marker found
        }
    }

    const sections = parseSections(displayContent, isStreaming);

    if (sections.length === 0) return null;
    if (sections.length === 1 && typeof sections[0] === 'string') {
        return <>{renderTextWithImages(sanitizeScreenplayMarkup(sections[0] as string))}</>;
    }

    return (
        <div className="space-y-3">
            {sections.map((section, i) => {
                if (typeof section === 'string') {
                    return <p key={i} className="text-xs leading-relaxed text-text-secondary my-1.5">{renderTextWithImages(sanitizeScreenplayMarkup(section))}</p>;
                }
                return <SectionCard key={i} header={section.header} content={section.content} isStreaming={isStreaming} />;
            })}
        </div>
    );
}
