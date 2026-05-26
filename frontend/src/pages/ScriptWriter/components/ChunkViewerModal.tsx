import {
    Fragment,
    memo,
    startTransition,
    useCallback,
    useDeferredValue,
    useEffect,
    useMemo,
    useState,
    type CSSProperties
} from 'react';
import {
    ArrowLeft,
    X,
    Search,
    Copy,
    Check,
    FileText,
    User,
    Hash,
    Minus,
    Plus,
    AlertCircle
} from 'lucide-react';
import {
    scriptWriterApi
} from '../../../services/scriptWriter.api';
import type {
    MasterScriptReconstruction,
    MasterScriptReconstructionLine
} from '../../../services/scriptWriter.api';

interface ChunkViewerModalProps {
    isOpen: boolean;
    onClose: () => void;
    scriptId: string;
    scriptTitle: string;
    scriptVersion?: string;
    mode?: 'modal' | 'page';
}

type ViewMode = 'chunks' | 'script';
type ScriptZoom = 115 | 130 | 145 | 160;
type ScriptRenderKind =
    | 'blank'
    | 'slug'
    | 'transition'
    | 'cue'
    | 'parenthetical'
    | 'dialogue'
    | 'action'
    | 'centered'
    | 'lyrics'
    | 'note'
    | 'section'
    | 'synopsis'
    | 'other';
type DualDialogueLane = 'left' | 'right' | null;

type MasterScriptChunkRow = {
    _id?: string;
    chunkId?: string;
    chunkIndex?: number;
    chunkType?: string;
    content?: string;
    sourceStartLine?: number;
    sceneSeq?: number;
    elementSeq?: number;
    speaker?: string;
    dualDialogue?: boolean;
    sceneNumber?: string;
    nonPrinting?: boolean;
    isHierarchicalNode?: boolean;
    source?: string;
    target?: string;
};

interface ScriptRenderLine {
    id: string;
    kind: ScriptRenderKind;
    content: string;
    lineNo?: number;
    sceneSeq?: number;
    elementSeq?: number;
    speaker?: string;
    dualDialogue?: boolean;
    dualLane?: DualDialogueLane;
    sceneNumber?: string;
    nonPrinting?: boolean;
}

const SCRIPT_FONT_FAMILY = '"Courier Prime", "Courier New", monospace';
const SCRIPT_ZOOM_STEPS: ScriptZoom[] = [115, 130, 145, 160];
const CHUNK_CARD_VISIBILITY_STYLE: CSSProperties = {
    contentVisibility: 'auto',
    containIntrinsicSize: '180px'
};
const SCRIPT_LINE_VISIBILITY_STYLE: CSSProperties = {
    contentVisibility: 'auto',
    containIntrinsicSize: '56px'
};

export function ChunkViewerModal({
    isOpen,
    onClose,
    scriptId,
    scriptTitle,
    scriptVersion,
    mode = 'modal'
}: ChunkViewerModalProps) {
    const [chunks, setChunks] = useState<MasterScriptChunkRow[]>([]);
    const [reconstruction, setReconstruction] = useState<MasterScriptReconstruction | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [chunkError, setChunkError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const [viewMode, setViewMode] = useState<ViewMode>(mode === 'page' ? 'script' : 'chunks');
    const [scriptZoom, setScriptZoom] = useState<ScriptZoom>(145);
    const [showLineNumbers, setShowLineNumbers] = useState(false);
    const deferredSearchQuery = useDeferredValue(searchQuery);

    const fetchModalData = useCallback(async () => {
        if (!isOpen || !scriptId) return;

        setLoading(true);
        setError(null);
        setChunkError(null);

        try {
            const [chunkResult, reconstructedResult] = await Promise.allSettled([
                scriptWriterApi.getMasterScriptChunks(scriptId, scriptVersion),
                scriptWriterApi.getMasterScriptReconstruction(scriptId, scriptVersion)
            ]);

            if (reconstructedResult.status !== 'fulfilled') {
                throw reconstructedResult.reason;
            }

            setReconstruction(reconstructedResult.value);

            if (chunkResult.status === 'fulfilled') {
                setChunks(chunkResult.value.filter(chunk => !chunk.isHierarchicalNode));
            } else {
                console.warn('Failed to load structured chunk rows:', chunkResult.reason);
                setChunks([]);
                setChunkError(getErrorMessage(chunkResult.reason));
            }
        } catch (err) {
            console.error('Failed to fetch chunk viewer data:', err);
            setError(getErrorMessage(err));
        } finally {
            setLoading(false);
        }
    }, [isOpen, scriptId, scriptVersion]);

    useEffect(() => {
        if (isOpen && scriptId) {
            void fetchModalData();
        }
    }, [fetchModalData, isOpen, scriptId]);

    const handleCopy = (id: string, text: string) => {
        navigator.clipboard.writeText(text);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
    };

    const filteredChunks = useMemo(() => {
        if (viewMode !== 'chunks') {
            return [];
        }

        const normalizedQuery = deferredSearchQuery.trim().toLowerCase();
        if (!normalizedQuery) {
            return chunks;
        }

        return chunks.filter(chunk =>
            chunk.content?.toLowerCase().includes(normalizedQuery) ||
            chunk.speaker?.toLowerCase().includes(normalizedQuery)
        );
    }, [chunks, deferredSearchQuery, viewMode]);

    const exactLines = reconstruction?.lines || [];

    const scriptLines = useMemo<ScriptRenderLine[]>(() => {
        if (viewMode !== 'script') {
            return [];
        }


        if (chunks.length > 0) {
            return assignDualDialogueLayout(chunks.map((chunk, index) => ({
                id: chunk._id || `${chunk.chunkId || 'chunk'}-${index}`,
                kind: getScriptRenderKind(chunk),
                content: chunk.content === '[BLANK_LINE]' ? '' : (chunk.content || ''),
                lineNo: chunk.sourceStartLine,
                sceneSeq: chunk.sceneSeq,
                elementSeq: chunk.elementSeq,
                speaker: chunk.speaker,
                dualDialogue: Boolean(chunk.dualDialogue),
                sceneNumber: chunk.sceneNumber,
                nonPrinting: Boolean(chunk.nonPrinting)
            })));
        }

        if (reconstruction?.content) {
            return assignDualDialogueLayout(buildFallbackScriptLines(reconstruction.content));
        }

        return [];
    }, [chunks, exactLines.length, reconstruction, viewMode]);

    const screenplayScale = scriptZoom === 160
        ? { fontSize: '21px', lineHeight: '40px' }
        : scriptZoom === 145
            ? { fontSize: '19px', lineHeight: '36px' }
            : scriptZoom === 130
                ? { fontSize: '17px', lineHeight: '32px' }
                : { fontSize: '15px', lineHeight: '29px' };

    const increaseZoom = () => {
        const index = SCRIPT_ZOOM_STEPS.indexOf(scriptZoom);
        startTransition(() => {
            setScriptZoom(SCRIPT_ZOOM_STEPS[Math.min(index + 1, SCRIPT_ZOOM_STEPS.length - 1)]);
        });
    };

    const decreaseZoom = () => {
        const index = SCRIPT_ZOOM_STEPS.indexOf(scriptZoom);
        startTransition(() => {
            setScriptZoom(SCRIPT_ZOOM_STEPS[Math.max(index - 1, 0)]);
        });
    };

    const handleViewModeChange = (nextMode: ViewMode) => {
        startTransition(() => {
            setViewMode(nextMode);
        });
    };

    if (mode === 'modal' && !isOpen) return null;

    const readerFrame = (
        <div className={`w-full flex flex-col overflow-hidden border border-border-subtle bg-console-bg ${mode === 'page'
            ? 'h-full min-h-0 flex-1 rounded-[2rem] shadow-[0_30px_90px_rgba(0,0,0,0.35)]'
            : 'max-w-[1600px] h-[92vh] rounded-[2rem] shadow-[0_40px_120px_rgba(0,0,0,0.55)] animate-in zoom-in-95 duration-300'
            }`}>
            <div className="relative overflow-hidden border-b border-border-subtle bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.14),transparent_32%),linear-gradient(180deg,var(--console-bg),var(--console-bg))]">
                <div className="flex items-start justify-between gap-4 px-4 py-3 sm:px-6">
                    <div className="flex items-start gap-3 min-w-0">
                        <button
                            onClick={onClose}
                            className={`mt-0.5 rounded-2xl border p-2.5 transition-all ${mode === 'page'
                                ? 'border-border-subtle bg-console-surface/70 text-text-secondary hover:border-border-strong hover:text-text-primary'
                                : 'border-transparent bg-transparent text-text-tertiary hover:bg-console-surface hover:text-text-primary'
                                }`}
                        >
                            {mode === 'page' ? <ArrowLeft size={20} /> : <X size={20} />}
                        </button>
                        <div className="mt-0.5 rounded-2xl border border-blue-500/20 bg-blue-500/10 p-2.5 shadow-[0_0_40px_rgba(59,130,246,0.12)]">
                            <FileText className="text-blue-300" size={20} />
                        </div>
                        <div className="min-w-0">
                            <h2 className="truncate text-lg sm:text-xl font-black tracking-tight text-white">{scriptTitle}</h2>
                            <div className="mt-1 text-xs font-medium text-text-tertiary">
                                Client reader
                            </div>
                            <div className="mt-2 flex flex-wrap items-center gap-2 text-[9px] font-black uppercase tracking-[0.16em] text-text-tertiary">
                                {scriptVersion && (
                                    <span className="rounded-full border border-border-subtle bg-console-surface/90 px-2.5 py-1">
                                        Version {scriptVersion}
                                    </span>
                                )}
                                {reconstruction && (
                                    <span className="rounded-full border border-border-subtle bg-console-surface/90 px-2.5 py-1">
                                        {reconstruction.lineCount} source lines
                                    </span>
                                )}
                                {reconstruction?.pageCount ? (
                                    <span className="rounded-full border border-border-subtle bg-console-surface/90 px-2.5 py-1">
                                        {reconstruction.pageCount} pages
                                    </span>
                                ) : null}
                                {reconstruction?.readerReady ? (
                                    <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-emerald-300">
                                        Reader Ready
                                    </span>
                                ) : null}
                                {typeof reconstruction?.ragReady === 'boolean' ? (
                                    <span className={`rounded-full border px-2.5 py-1 ${reconstruction.ragReady
                                        ? 'border-blue-500/20 bg-blue-500/10 text-blue-300'
                                        : 'border-amber-500/20 bg-amber-500/10 text-amber-200'
                                        }`}>
                                        {reconstruction.ragReady ? 'RAG Ready' : 'RAG Pending'}
                                    </span>
                                ) : null}
                                <span className={`rounded-full border px-2.5 py-1 ${chunkError
                                    ? 'border-amber-500/20 bg-amber-500/10 text-amber-200'
                                    : 'border-border-subtle bg-console-surface/90'
                                    }`}>
                                    {chunkError ? 'typed rows unavailable' : `${chunks.length} typed rows`}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className={`border-b border-border-subtle bg-console-bg/95 px-4 py-3 sm:px-6 flex flex-col gap-4 ${mode === 'page' ? 'sticky top-0 z-10 bg-console-bg' : ''}`}>
                <div className="flex flex-wrap items-center gap-3">
                    <button
                        onClick={() => handleViewModeChange('chunks')}
                        className={`min-w-[160px] rounded-2xl border px-5 py-3 text-sm font-black uppercase tracking-[0.16em] transition-all flex items-center justify-center gap-2 ${viewMode === 'chunks'
                            ? 'border-accent-primary/20 bg-accent-primary/10 text-accent-primary shadow-[0_0_32px_rgba(59,130,246,0.08)]'
                            : 'border-border-subtle bg-console-surface text-text-tertiary hover:text-text-secondary'
                            }`}
                    >
                        <span>Structured Elements</span>
                        <div className="group relative">
                            <AlertCircle size={14} className="text-text-tertiary cursor-help" />
                            <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-64 p-3 bg-console-surface border border-border-subtle rounded-xl text-[10px] text-text-tertiary font-medium normal-case tracking-normal leading-relaxed shadow-2xl opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50">
                                <p className="text-blue-400 font-bold mb-1 uppercase tracking-widest">High-Accuracy RAG</p>
                                Screenplays are indexed as individual dialogues and actions ("Leaf" nodes) inside scene containers. This granularity allows the AI to mimic exact style and rhythm from 5,000+ reference samples.
                            </div>
                        </div>
                    </button>
                    <button
                        onClick={() => handleViewModeChange('script')}
                        className={`min-w-[200px] rounded-2xl border px-5 py-3 text-sm font-black uppercase tracking-[0.16em] transition-all ${viewMode === 'script'
                            ? 'border-amber-400/20 bg-amber-400/10 text-amber-100 shadow-[0_0_32px_rgba(251,191,36,0.08)]'
                            : 'border-border-subtle bg-console-surface text-text-tertiary hover:text-text-secondary'
                            }`}
                    >
                        Screenplay
                    </button>

                    <div className="ml-auto flex flex-wrap items-center gap-2">
                        {viewMode === 'script' && (
                            <>
                                <div className="flex items-center gap-1 rounded-2xl border border-border-subtle bg-console-surface px-1.5 py-1">
                                    <button
                                        onClick={increaseZoom}
                                        className="rounded-xl p-1.5 text-text-tertiary transition-colors hover:bg-console-surface-2 hover:text-text-primary"
                                        title="Increase zoom"
                                    >
                                        <Plus size={14} />
                                    </button>
                                    <span className="min-w-14 text-center text-[10px] font-black uppercase tracking-[0.16em] text-text-tertiary">
                                        {scriptZoom}%
                                    </span>
                                    <button
                                        onClick={decreaseZoom}
                                        className="rounded-xl p-1.5 text-text-tertiary transition-colors hover:bg-console-surface-2 hover:text-text-primary"
                                        title="Decrease zoom"
                                    >
                                        <Minus size={14} />
                                    </button>
                                </div>

                                <button
                                    onClick={() => startTransition(() => setShowLineNumbers(current => !current))}
                                    className={`rounded-2xl border px-3.5 py-2 text-[11px] font-black uppercase tracking-[0.16em] transition-all ${showLineNumbers
                                        ? 'border-amber-400/20 bg-amber-400/10 text-amber-100'
                                        : 'border-border-subtle bg-console-surface text-text-tertiary hover:text-text-primary'
                                        }`}
                                >
                                    {showLineNumbers ? 'Hide Line Nos' : 'Show Line Nos'}
                                </button>

                                {reconstruction?.content && (
                                    <button
                                        onClick={() => handleCopy('reconstructed-script', reconstruction.content)}
                                        className="flex items-center gap-2 rounded-2xl border border-border-subtle bg-console-surface px-3.5 py-2 text-[11px] font-black uppercase tracking-[0.16em] text-text-secondary transition-all hover:border-border-strong hover:text-text-primary"
                                    >
                                        {copiedId === 'reconstructed-script' ? <Check size={14} /> : <Copy size={14} />}
                                        Copy Script
                                    </button>
                                )}
                            </>
                        )}
                    </div>
                </div>

                {chunkError && (
                    <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                        Chunk formatting is temporarily unavailable for this version. The screenplay tab still uses the exact source layout.
                    </div>
                )}

                {viewMode === 'chunks' && (
                    <div className="relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-text-tertiary" size={18} />
                        <input
                            type="text"
                            placeholder="Search chunks by content or character..."
                            className="w-full rounded-2xl border border-border-subtle bg-console-surface pl-12 pr-4 py-3 text-sm text-text-secondary outline-none transition-all focus:border-accent-primary"
                            value={searchQuery}
                            onChange={event => setSearchQuery(event.target.value)}
                        />
                    </div>
                )}
            </div>

            <div className={`min-h-0 flex-1 overflow-y-auto overscroll-contain bg-[radial-gradient(circle_at_top,rgba(245,158,11,0.08),transparent_30%),linear-gradient(180deg,#09090b_0%,#111827_100%)] p-4 custom-scrollbar ${mode === 'page' ? 'sm:p-8 lg:p-10' : 'sm:p-6'}`}>
                {loading ? (
                    <div className="flex h-full flex-col items-center justify-center gap-3">
                        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500/20 border-t-blue-500" />
                        <span className="text-xs font-bold uppercase tracking-[0.18em] text-text-tertiary">Loading screenplay view...</span>
                    </div>
                ) : error ? (
                    <div className="flex h-full items-center justify-center">
                        <div className="max-w-xl rounded-3xl border border-red-500/20 bg-red-500/10 px-5 py-4 text-sm text-red-300">
                            {error}
                        </div>
                    </div>
                ) : viewMode === 'chunks' ? (
                    chunkError ? (
                        <div className="flex h-full items-center justify-center">
                            <div className="max-w-2xl rounded-3xl border border-amber-500/20 bg-amber-500/10 px-5 py-4 text-sm text-amber-100">
                                Structured Elements are unavailable for this version right now.
                                <div className="mt-2 text-xs text-amber-200/80">{chunkError}</div>
                            </div>
                        </div>
                    ) : filteredChunks.length === 0 ? (
                        <div className="flex h-full flex-col items-center justify-center text-text-tertiary">
                            <Search size={48} className="mb-4 opacity-20" />
                            <p className="font-bold">No chunks match your search.</p>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-4">
                            {filteredChunks.map((chunk, index) => (
                                <div
                                    key={chunk._id || chunk.chunkId || `chunk-${index + 1}`}
                                    className="group rounded-3xl border border-border-subtle/70 bg-console-surface/50 p-5 transition-all hover:border-border-strong hover:bg-console-surface/70"
                                    style={CHUNK_CARD_VISIBILITY_STYLE}
                                >
                                    <div className="mb-3 flex items-start justify-between gap-4">
                                        <div className="flex flex-wrap items-center gap-3">
                                            <div className="flex items-center gap-1.5 rounded-xl border border-border-subtle bg-console-bg px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-text-tertiary">
                                                <Hash size={12} className="text-blue-500/50" />
                                                Chunk {chunk.chunkIndex ?? index + 1}
                                            </div>
                                            {chunk.speaker && (
                                                <div className="flex items-center gap-1.5 rounded-xl border border-blue-500/20 bg-blue-500/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-blue-300">
                                                    <User size={12} />
                                                    {chunk.speaker}
                                                </div>
                                            )}
                                            <div className="text-[10px] font-black uppercase tracking-[0.18em] text-text-tertiary">
                                                {chunk.chunkType || 'dialogue'}
                                            </div>
                                            {chunk.sceneNumber && (
                                                <div className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-300">
                                                    #{chunk.sceneNumber}
                                                </div>
                                            )}
                                            {chunk.dualDialogue && (
                                                <div className="text-[10px] font-black uppercase tracking-[0.18em] text-purple-300">
                                                    Dual
                                                </div>
                                            )}
                                            {chunk.nonPrinting && (
                                                <div className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-200">
                                                    Non-Print
                                                </div>
                                            )}
                                            {typeof chunk.sceneSeq === 'number' && (
                                                <div className="text-[10px] font-black uppercase tracking-[0.18em] text-text-tertiary">
                                                    Scene {chunk.sceneSeq} / Element {chunk.elementSeq}
                                                </div>
                                            )}
                                        </div>
                                        <button
                                            onClick={() => handleCopy(chunk._id || chunk.chunkId || `chunk-${index + 1}`, chunk.content || '')}
                                            className="rounded-xl bg-console-bg/60 p-2 text-text-tertiary transition-all hover:bg-console-surface hover:text-accent-primary"
                                            title="Copy content"
                                        >
                                            {copiedId === (chunk._id || chunk.chunkId || `chunk-${index + 1}`) ? <Check size={16} /> : <Copy size={16} />}
                                        </button>
                                    </div>

                                    <div className="whitespace-pre-wrap font-serif text-sm leading-relaxed text-text-secondary selection:bg-accent-primary/30">
                                        {chunk.content === '[BLANK_LINE]' ? '' : chunk.content}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )
                ) : (
                    exactLines.length > 0 ? (
                        <ExactSourceReader
                            lines={exactLines}
                            copiedId={copiedId}
                            onCopy={handleCopy}
                            showLineNumbers={showLineNumbers}
                            screenplayScale={screenplayScale}
                        />
                    ) : scriptLines.length > 0 ? (
                        <div className="relative mx-auto max-w-[1460px]">
                            <div className="absolute inset-x-10 top-6 h-28 rounded-full bg-amber-200/15 blur-3xl" />
                            <div className="relative overflow-hidden rounded-[2rem] border border-stone-300/80 bg-[linear-gradient(180deg,#faf7ef_0%,#f7f1e3_48%,#fffdf8_100%)] shadow-[0_30px_100px_rgba(0,0,0,0.35)]">
                                <div className="border-b border-stone-300/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.88),rgba(245,239,225,0.94))] px-5 py-3 sm:px-8">
                                    <div className="flex flex-wrap items-center justify-between gap-4">
                                        <div>
                                            <div className="text-[9px] font-black uppercase tracking-[0.2em] text-stone-500">
                                                Reconstructed Screenplay
                                            </div>
                                            <div className="mt-1 text-xs font-semibold text-stone-700">
                                                Exact script view for client reading.
                                            </div>
                                        </div>
                                        <div className="rounded-full border border-stone-300 bg-white/70 px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.16em] text-stone-500">
                                            Scrollable Reader
                                        </div>
                                    </div>
                                </div>

                                <div
                                    className="px-3 py-5 sm:px-6 sm:py-8 md:px-10"
                                    style={{
                                        fontFamily: SCRIPT_FONT_FAMILY,
                                        ...screenplayScale
                                    }}
                                >
                                    {scriptLines.map(line => (
                                        <ScriptLineRow
                                            key={line.id}
                                            line={line}
                                            copiedId={copiedId}
                                            onCopy={handleCopy}
                                            showLineNumbers={showLineNumbers}
                                        />
                                    ))}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="flex h-full flex-col items-center justify-center text-text-tertiary">
                            <FileText size={48} className="mb-4 opacity-20" />
                            <p className="font-bold">No reconstructed script is available.</p>
                        </div>
                    )
                )}
            </div>
        </div>
    );

    if (mode === 'page') {
        return (
            <div className="h-screen overflow-hidden bg-console-bg text-text-primary selection:bg-amber-400/20">
                <div className="mx-auto flex h-full w-full max-w-[1850px] flex-col px-3 py-3 sm:px-5 sm:py-5">
                    {readerFrame}
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6 bg-black/85 animate-in fade-in duration-300">
            {readerFrame}
        </div>
    );
}

function getErrorMessage(error: unknown): string {
    if (error instanceof Error && error.message) {
        return error.message;
    }
    if (typeof error === 'string' && error.trim().length > 0) {
        return error;
    }
    return 'Failed to load script data';
}

function getScriptRenderKind(chunk: MasterScriptChunkRow): ScriptRenderKind {
    const content = (chunk?.content || '').trim();

    if (!content || content === '[BLANK_LINE]') return 'blank';
    if (chunk?.chunkType === 'cue') return 'cue';
    if (chunk?.chunkType === 'slug') return 'slug';
    if (chunk?.chunkType === 'transition') return 'transition';
    if (chunk?.chunkType === 'parenthetical') return 'parenthetical';
    if (chunk?.chunkType === 'dialogue') return 'dialogue';
    if (chunk?.chunkType === 'action') return 'action';
    if (chunk?.chunkType === 'centered') return 'centered';
    if (chunk?.chunkType === 'lyrics') return 'lyrics';
    if (chunk?.chunkType === 'note') return 'note';
    if (chunk?.chunkType === 'section') return 'section';
    if (chunk?.chunkType === 'synopsis') return 'synopsis';
    if (looksLikeCharacterCue(chunk)) return 'cue';
    return 'other';
}

function looksLikeCharacterCue(chunk: MasterScriptChunkRow): boolean {
    const content = (chunk?.content || '').trim();
    const speaker = (chunk?.speaker || '').trim();
    if (!content || !speaker) return false;

    const normalizedContent = content.toUpperCase().replace(/:$/, '').replace(/\s+/g, ' ').trim();
    const normalizedSpeaker = speaker.toUpperCase().replace(/\s+/g, ' ').trim();

    return normalizedContent === normalizedSpeaker || normalizedContent.startsWith(`${normalizedSpeaker} (`);
}

function buildFallbackScriptLines(content: string): ScriptRenderLine[] {
    const rawLines = content.split(/\r?\n/);
    let inDialogueBlock = false;
    let activeDualDialogue = false;

    return rawLines.map((rawLine, index) => {
        const trimmedLine = rawLine.trim();
        const analysis = inferRawScriptRenderLine(trimmedLine, inDialogueBlock, activeDualDialogue);

        if (analysis.kind === 'cue' || analysis.kind === 'parenthetical') {
            inDialogueBlock = true;
            activeDualDialogue = Boolean(analysis.dualDialogue);
        } else if (analysis.kind === 'dialogue') {
            inDialogueBlock = true;
            activeDualDialogue = Boolean(analysis.dualDialogue);
        } else if (analysis.kind === 'blank') {
            inDialogueBlock = false;
            activeDualDialogue = false;
        } else {
            inDialogueBlock = false;
            activeDualDialogue = false;
        }

        return {
            id: `raw-line-${index + 1}`,
            kind: analysis.kind,
            content: rawLine,
            lineNo: index + 1,
            speaker: analysis.speaker,
            dualDialogue: analysis.dualDialogue,
            sceneNumber: analysis.sceneNumber,
            nonPrinting: analysis.nonPrinting
        };
    });
}

function inferRawScriptRenderLine(
    content: string,
    inDialogueBlock: boolean,
    activeDualDialogue: boolean
): Pick<ScriptRenderLine, 'kind' | 'speaker' | 'dualDialogue' | 'sceneNumber' | 'nonPrinting'> {
    if (!content) return { kind: 'blank' };

    const sceneNumberSuffix = content.match(/\s+#([A-Za-z0-9.-]+)#\s*$/)?.[1];
    const withoutSceneSuffix = sceneNumberSuffix ? content.replace(/\s+#([A-Za-z0-9.-]+)#\s*$/, '').trim() : content;
    const scenePrefixMatch = withoutSceneSuffix.match(/^(?:(?:#([A-Za-z0-9.-]+)#)|(\d+[A-Za-z0-9.-]*))\s+(.+)$/);
    const sceneNumberPrefix = scenePrefixMatch?.[1] || scenePrefixMatch?.[2];
    const withoutSceneNumber = scenePrefixMatch?.[3] || withoutSceneSuffix;
    const withoutForcedDot = withoutSceneNumber.startsWith('.') ? withoutSceneNumber.slice(1).trim() : withoutSceneNumber;
    const upper = withoutForcedDot.toUpperCase();

    if (/^#{1,6}\s+.+$/.test(content)) {
        return { kind: 'section', nonPrinting: true };
    }
    if (/^=\s*.+$/.test(content)) {
        return { kind: 'synopsis', nonPrinting: true };
    }
    if (/^(\[\[|\/\*)/.test(content)) {
        return { kind: 'note', nonPrinting: true };
    }
    if (/^>\s*.+\s*<$/.test(content)) {
        return { kind: 'centered' };
    }
    if (content.startsWith('~')) {
        return { kind: 'lyrics' };
    }

    const isSlug = /^(INT\.?|EXT\.?|EST\.?|INT\/EXT\.?|INT\.\/EXT\.?|EXT\/INT\.?|EXT\.\/INT\.?|I\/E\.?)\s+.+$/i.test(withoutForcedDot);
    if (isSlug || content.startsWith('.')) {
        return { kind: 'slug', sceneNumber: sceneNumberSuffix || sceneNumberPrefix };
    }

    const isTransition = /^>\s*\S+/.test(content) || upper.endsWith(' TO:') || /^(FADE OUT\.?|FADE IN:?|CUT TO:|MATCH CUT TO:|SMASH CUT TO:|DISSOLVE TO:)$/.test(upper);
    if (isTransition) return { kind: 'transition' };

    if (/^\([^)]*\)$/.test(content)) {
        return { kind: 'parenthetical', dualDialogue: activeDualDialogue };
    }

    const explicitCue = content.match(/^@\s*(.+)$/);
    if (explicitCue) {
        const rawSpeaker = explicitCue[1].replace(/\^\s*$/, '').trim();
        return {
            kind: 'cue',
            speaker: normalizeRawSpeaker(rawSpeaker),
            dualDialogue: /\^\s*$/.test(explicitCue[1])
        };
    }

    const isCue = content.length <= 40 && content === content.toUpperCase() && /[A-Z]/.test(content) && !/[.!?]$/.test(content);
    if (isCue) {
        const cueText = content.replace(/\^\s*$/, '').trim();
        return {
            kind: 'cue',
            speaker: normalizeRawSpeaker(cueText),
            dualDialogue: /\^\s*$/.test(content)
        };
    }

    const colonDialogue = content.match(/^([^:]{1,30}):\s*(.+)$/);
    if (colonDialogue) {
        const rawSpeaker = colonDialogue[1].trim();
        return {
            kind: 'dialogue',
            speaker: normalizeRawSpeaker(rawSpeaker),
            dualDialogue: /\^\s*$/.test(rawSpeaker)
        };
    }

    if (inDialogueBlock) {
        return { kind: 'dialogue', dualDialogue: activeDualDialogue };
    }

    if (/^!\s*(.+)$/.test(content)) {
        return { kind: 'action' };
    }

    return { kind: 'action' };
}

function normalizeRawSpeaker(input: string): string {
    return input
        .replace(/^@\s*/g, '')
        .replace(/\^\s*$/g, '')
        .replace(/\s*\(V\.O\.\)/i, '')
        .replace(/\s*\(O\.S\.\)/i, '')
        .replace(/\s*\(CONT'D\)/i, '')
        .replace(/\s*\(CONTINUING\)/i, '')
        .replace(/\s*\(.+\)\s*$/i, '')
        .replace(/:$/, '')
        .trim();
}

function assignDualDialogueLayout(lines: ScriptRenderLine[]): ScriptRenderLine[] {
    let activeLane: DualDialogueLane = null;
    let nextLane: Exclude<DualDialogueLane, null> = 'left';

    return lines.map(line => {
        if (!line.dualDialogue) {
            activeLane = null;
            nextLane = 'left';
            return { ...line, dualLane: null };
        }

        if (line.kind === 'cue') {
            activeLane = nextLane;
            nextLane = nextLane === 'left' ? 'right' : 'left';
            return { ...line, dualLane: activeLane };
        }

        return { ...line, dualLane: activeLane || 'left' };
    });
}

const ExactSourceReader = memo(function ExactSourceReader({
    lines,
    copiedId,
    onCopy,
    showLineNumbers,
    screenplayScale
}: {
    lines: MasterScriptReconstructionLine[];
    copiedId: string | null;
    onCopy: (id: string, text: string) => void;
    showLineNumbers: boolean;
    screenplayScale: { fontSize: string; lineHeight: string };
}) {
    return (
        <div className="relative mx-auto max-w-[1620px] overflow-x-auto">
            <div className="absolute inset-x-10 top-6 h-28 rounded-full bg-amber-200/15 blur-3xl" />
            <div className="relative min-w-[780px] overflow-hidden rounded-[2rem] border border-stone-300/80 bg-[linear-gradient(180deg,#faf7ef_0%,#f7f1e3_48%,#fffdf8_100%)] shadow-[0_30px_100px_rgba(0,0,0,0.35)]">
                <div className="border-b border-stone-300/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.88),rgba(245,239,225,0.94))] px-5 py-3 sm:px-8">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                        <div>
                            <div className="text-[9px] font-black uppercase tracking-[0.2em] text-stone-500">
                                Exact Source Layout
                            </div>
                            <div className="mt-1 text-xs font-semibold text-stone-700">
                                Verbatim screenplay lines with preserved indentation and page flow.
                            </div>
                        </div>
                        <div className="rounded-full border border-stone-300 bg-white/70 px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.16em] text-stone-500">
                            Scrollable Exact Reader
                        </div>
                    </div>
                </div>

                <div
                    className="px-3 py-5 sm:px-6 sm:py-8 md:px-10"
                    style={{
                        fontFamily: SCRIPT_FONT_FAMILY,
                        ...screenplayScale
                    }}
                >
                    {lines.map((line, index) => {
                        const showPageBreak = index === 0 || lines[index - 1].pageNo !== line.pageNo;
                        return (
                            <Fragment key={line.lineId}>
                                {showPageBreak && (
                                    <div className="mb-5 mt-3 flex items-center gap-4 px-2">
                                        <div className="h-px flex-1 bg-stone-300/80" />
                                        <div className="rounded-full border border-stone-300 bg-white/80 px-4 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-stone-500">
                                            Page {line.pageNo}
                                        </div>
                                        <div className="h-px flex-1 bg-stone-300/80" />
                                    </div>
                                )}
                                <ExactSourceLineRow
                                    line={line}
                                    copiedId={copiedId}
                                    onCopy={onCopy}
                                    showLineNumbers={showLineNumbers}
                                />
                            </Fragment>
                        );
                    })}
                </div>
            </div>
        </div>
    );
});

const ExactSourceLineRow = memo(function ExactSourceLineRow({
    line,
    copiedId,
    onCopy,
    showLineNumbers
}: {
    line: MasterScriptReconstructionLine;
    copiedId: string | null;
    onCopy: (id: string, text: string) => void;
    showLineNumbers: boolean;
}) {
    return (
        <div
            className={`group flex items-start gap-3 rounded-2xl px-2 transition-colors hover:bg-white/35 ${line.sourceKind === 'page_marker' ? 'text-stone-500' : ''}`}
            style={SCRIPT_LINE_VISIBILITY_STYLE}
        >
            <div className={`shrink-0 select-none pt-2 text-right text-[10px] font-black tracking-[0.2em] text-stone-400 transition-opacity ${showLineNumbers ? 'w-14 opacity-100' : 'w-0 overflow-hidden opacity-0'}`}>
                {showLineNumbers ? line.lineNo : ''}
            </div>
            <div className="min-w-0 flex-1 overflow-hidden">
                <div className={`whitespace-pre py-1 ${line.sourceKind === 'page_marker' ? 'italic text-stone-500' : 'text-stone-900'}`}>
                    {line.rawText.length > 0 ? line.rawText : ' '}
                </div>
            </div>
            <div className="pt-2">
                {line.rawText ? (
                    <button
                        onClick={() => onCopy(line.lineId, line.rawText)}
                        className="opacity-0 group-hover:opacity-100 rounded-xl border border-stone-300 bg-white/80 p-2 text-stone-400 transition-all hover:text-stone-900"
                        title="Copy line"
                    >
                        {copiedId === line.lineId ? <Check size={14} /> : <Copy size={14} />}
                    </button>
                ) : (
                    <div className="w-[34px]" />
                )}
            </div>
        </div>
    );
});

const ScriptLineRow = memo(function ScriptLineRow({
    line,
    copiedId,
    onCopy,
    showLineNumbers
}: {
    line: ScriptRenderLine;
    copiedId: string | null;
    onCopy: (id: string, text: string) => void;
    showLineNumbers: boolean;
}) {
    const sharedCopyButton = line.content ? (
        <button
            onClick={() => onCopy(line.id, line.content)}
            className="opacity-0 group-hover:opacity-100 rounded-xl border border-stone-300 bg-white/80 p-2 text-stone-400 transition-all hover:text-stone-900"
            title="Copy line"
        >
            {copiedId === line.id ? <Check size={14} /> : <Copy size={14} />}
        </button>
    ) : <div className="w-[34px]" />;

    if (line.kind === 'blank') {
        return (
            <div
                className="group flex min-h-[1.1rem] items-center gap-3 rounded-2xl px-2"
                style={SCRIPT_LINE_VISIBILITY_STYLE}
            >
                <div className={`select-none pt-1 text-right text-[10px] font-black tracking-[0.2em] text-stone-300 transition-opacity ${showLineNumbers ? 'w-14 opacity-100' : 'w-0 overflow-hidden opacity-0'}`}>
                    {showLineNumbers ? (line.lineNo || '') : ''}
                </div>
                <div className="min-w-0 flex-1" />
                <div className="w-[34px]" />
            </div>
        );
    }

    if (line.nonPrinting) {
        return null;
    }

    return (
        <div
            className="group flex items-start gap-3 rounded-2xl px-2 transition-colors hover:bg-white/35"
            style={SCRIPT_LINE_VISIBILITY_STYLE}
        >
            <div className={`shrink-0 select-none pt-4 text-right text-[10px] font-black tracking-[0.2em] text-stone-400 transition-opacity ${showLineNumbers ? 'w-14 opacity-100' : 'w-0 overflow-hidden opacity-0'}`}>
                {showLineNumbers ? (line.lineNo || '') : ''}
            </div>
            <div className="min-w-0 flex-1">
                <div className={getScriptLineClassName(line.kind, line.dualLane || null, Boolean(line.nonPrinting))}>
                    {line.kind === 'slug' && (typeof line.sceneSeq === 'number' || line.sceneNumber) && (
                        <div className="mb-2 text-[0.62em] font-black uppercase tracking-[0.35em] text-stone-500/80">
                            {line.sceneNumber ? `Scene ${line.sceneNumber}` : `Scene ${line.sceneSeq}`}
                        </div>
                    )}
                    {(line.kind === 'note' || line.kind === 'section' || line.kind === 'synopsis') && (
                        <div className="mb-1 text-[0.58em] font-black uppercase tracking-[0.28em] text-stone-500">
                            {line.kind}
                        </div>
                    )}
                    {line.kind === 'lyrics' && (
                        <div className="mb-1 text-[0.52em] font-black uppercase tracking-[0.32em] text-rose-500/70">
                            Lyrics
                        </div>
                    )}
                    <div className="leading-[1.6]">{formatScriptLineText(line)}</div>
                </div>
            </div>
            <div className="pt-4">{sharedCopyButton}</div>
        </div>
    );
});

function formatScriptLineText(line: ScriptRenderLine) {
    if (line.kind === 'centered') {
        return line.content.replace(/^>\s*/, '').replace(/\s*<$/, '').trim();
    }
    if (line.kind === 'note') {
        return line.content
            .replace(/^\[\[/, '')
            .replace(/\]\]\s*$/, '')
            .replace(/^\/\*/, '')
            .replace(/\*\/\s*$/, '')
            .trim();
    }
    if (line.kind === 'section') {
        return line.content.replace(/^#{1,6}\s*/, '').trim();
    }
    if (line.kind === 'synopsis') {
        return line.content.replace(/^=\s*/, '').trim();
    }
    if (line.kind === 'slug' || line.kind === 'cue' || line.kind === 'transition') {
        return line.content
            .replace(/^\./, '')
            .replace(/^@\s*/, '')
            .replace(/\^\s*$/, '')
            .toUpperCase();
    }
    if (line.kind === 'lyrics') {
        return line.content.replace(/^~\s*/, '');
    }
    return line.content.replace(/^!\s*/, '');
}

function getScriptLineClassName(kind: ScriptRenderKind, dualLane: DualDialogueLane = null, nonPrinting = false): string {
    if (kind === 'dialogue' && dualLane) {
        return dualLane === 'right'
            ? 'ml-[50%] md:ml-[54%] w-[42%] text-[1em] text-stone-900'
            : 'ml-[2%] md:ml-[8%] w-[42%] text-[1em] text-stone-900';
    }

    if (kind === 'parenthetical' && dualLane) {
        return dualLane === 'right'
            ? 'ml-[54%] md:ml-[58%] w-[32%] text-[0.95em] italic text-stone-600'
            : 'ml-[10%] md:ml-[16%] w-[32%] text-[0.95em] italic text-stone-600';
    }

    if (kind === 'cue' && dualLane) {
        return dualLane === 'right'
            ? 'ml-[54%] md:ml-[58%] w-[30%] pt-3 text-center text-[0.95em] font-black uppercase tracking-[0.2em] text-stone-800'
            : 'ml-[12%] md:ml-[18%] w-[30%] pt-3 text-center text-[0.95em] font-black uppercase tracking-[0.2em] text-stone-800';
    }

    switch (kind) {
        case 'slug':
            return 'w-full max-w-[96%] pt-6 pb-3 text-[1em] font-black uppercase tracking-[0.16em] text-stone-900 border-t border-stone-200/50 mt-5 first:mt-0 first:border-0';
        case 'transition':
            return 'ml-auto w-full max-w-[92%] pt-3 pb-1 text-right text-[1em] font-black uppercase tracking-[0.16em] text-stone-700';
        case 'cue':
            return 'ml-[12%] md:ml-[30%] w-[76%] md:w-[40%] pt-4 pb-0 text-center text-[0.95em] font-black uppercase tracking-[0.2em] text-stone-800';
        case 'parenthetical':
            return 'ml-[10%] md:ml-[28%] w-[82%] md:w-[46%] pb-0 text-[0.95em] italic text-stone-600';
        case 'dialogue':
            return 'ml-[4%] md:ml-[20%] w-[92%] md:w-[60%] pb-1 text-[1em] text-stone-900';
        case 'centered':
            return 'mx-auto w-full max-w-[72%] py-4 text-center text-[1em] font-black uppercase tracking-[0.16em] text-stone-800';
        case 'note':
            return 'w-[96%] border border-amber-200/50 pl-4 py-3 text-[0.92em] italic text-amber-900/80 my-3 rounded-r-lg';
        case 'section':
            return 'w-[96%] py-4 text-[1.1em] font-black tracking-[0.22em] text-sky-900 border-b border-sky-100';
        case 'synopsis':
            return 'w-[96%] py-3 text-[0.92em] italic text-stone-600 bg-stone-50/50 px-4 rounded-xl my-1.5';
        case 'lyrics':
            return 'ml-[4%] md:ml-[20%] w-[92%] md:w-[60%] py-2 text-[1.05em] italic font-medium text-rose-900/80';
        case 'action':
            return 'w-[98%] md:w-[92%] py-1.5 text-[1em] leading-[1.6] text-stone-800';
        case 'other':
            return nonPrinting
                ? 'hidden'
                : 'w-[98%] md:w-[92%] py-1.5 text-[1em] text-stone-700';
        default:
            return 'text-[1em] text-stone-800';
    }
}
