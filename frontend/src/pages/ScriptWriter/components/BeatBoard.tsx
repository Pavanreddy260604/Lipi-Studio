import { useState, useMemo, memo } from 'react';
import { Plus, Map, Filter, ChevronDown, CheckCircle2, Clock, Edit3, Award } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '../../../components/ui/Button';
import { useScriptWriter } from '../../../contexts/ScriptWriterContext';
import type { BeatCard } from '../types';
import { STRUCTURAL_TEMPLATES } from '../types';
import type { IScene as Scene } from '../../../services/project.api';

interface BeatBoardProps {
    scenes: Scene[];
    loading?: boolean;
    onNewScene: (projectId: string) => void;
    onDeleteScene: (projectId: string, sceneId: string) => void;
    onReorderScenes: (reordered: Scene[]) => Promise<void>;
    onGenerateScene?: (sceneId: string) => void;
    beatTemplate?: string;
    onBeatTemplateChange?: (template: string) => void;
}

const STATUS_ICONS = {
    planned: Clock,
    drafted: Edit3,
    reviewed: CheckCircle2,
    final: Award,
} as const;

function BeatCard({ card, isActive, onSelect, onDelete, onGenerate }: {
    card: BeatCard;
    isActive: boolean;
    onSelect: () => void;
    onDelete: () => void;
    onGenerate?: () => void;
}) {
    const StatusIcon = STATUS_ICONS[card.status];
    const hasSummary = !!card.summary;
    return (
        <div
            onClick={onSelect}
            className={
                'flex-shrink-0 w-48 rounded-xl border cursor-pointer select-none ' +
                'transition-[border-color,background-color,transform] duration-150 active:scale-[0.97] group relative ' +
                (isActive
                    ? 'border-accent/40 bg-accent/8'
                    : 'border-subtle-8 bg-surface-elevated hover:border-subtle-10'
                )
            }
        >
            <div className="p-2.5 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                    <span className={'text-[9px] font-mono font-bold ' + (isActive ? 'text-accent' : 'text-text-tertiary')}>
                        #{card.sequenceNumber}
                    </span>
                    <StatusIcon size={11} className={card.status === 'final' ? 'text-status-success' : card.status === 'drafted' ? 'text-accent' : 'text-text-tertiary'} />
                </div>
                <div>
                    {card.title && card.title !== card.slugline ? (
                        <div className={'text-xs font-semibold truncate ' + (isActive ? 'text-accent' : 'text-text-primary')}>
                            {card.title}
                        </div>
                    ) : (
                        <div className={'text-[10px] font-mono tracking-wide uppercase truncate ' + (isActive ? 'text-accent font-semibold' : 'text-text-secondary')}>
                            {card.slugline || 'Untitled'}
                        </div>
                    )}
                    {card.beatLabel && (
                        <div className="text-[7px] font-bold uppercase tracking-wider text-accent/70 mt-0.5">{card.beatLabel}</div>
                    )}
                    {card.title && card.title !== card.slugline && card.slugline && (
                        <div className="text-[8px] font-mono text-text-tertiary truncate mt-0.5 tracking-wide uppercase">
                            {card.slugline}
                        </div>
                    )}
                </div>
                {hasSummary && (
                    <div className="text-[9px] text-text-tertiary line-clamp-2 leading-relaxed">
                        {card.summary}
                    </div>
                )}
                <div className="flex items-center gap-2 pt-1 border-t border-subtle-8 text-[7px] text-text-tertiary font-mono">
                    <span>{card.wordCount}w</span>
                    {card.hasCritique && (
                        <span className={card.status === 'final' ? 'text-status-success' : 'text-text-muted'}>
                            {card.critiqueScore}/100
                        </span>
                    )}
                    {card.notes && <span className="text-accent/60" title={card.notes}>📝</span>}
                </div>
            </div>
            <div className="opacity-0 group-hover:opacity-100 transition-opacity flex divide-x divide-subtle-8 border-t border-subtle-8">
                {onGenerate && (
                    <button onClick={(e) => { e.stopPropagation(); onGenerate(); }} className="flex-1 py-1 text-[7px] font-bold uppercase tracking-wider text-text-tertiary hover:text-accent transition-[color] duration-120 active:scale-[0.96] focus-ring">
                        Generate
                    </button>
                )}
                <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="flex-1 py-1 text-[7px] font-bold uppercase tracking-wider text-text-tertiary hover:text-status-error transition-[color] duration-120 active:scale-[0.96] focus-ring">
                    Delete
                </button>
            </div>
        </div>
    );
}

const BeatBoardInner = ({
    scenes,
    loading,
    onNewScene,
    onDeleteScene,
    onGenerateScene,
    beatTemplate,
    onBeatTemplateChange,
}: BeatBoardProps) => {
    const { activeProject, activeScene, setActiveScene, uiState, toggleBeatBoard, isGenerating, isCritiquing, isAiThinking, hasUnsavedChanges } = useScriptWriter();
    const navigate = useNavigate();
    const { projectId } = useParams();
    const { beatBoardOpen } = uiState;
    const [statusFilter, setStatusFilter] = useState<string | null>(null);
    const [showFilter, setShowFilter] = useState(false);

    const activeTemplate = beatTemplate || 'Save The Cat';
    const templateLabels = STRUCTURAL_TEMPLATES[activeTemplate] || STRUCTURAL_TEMPLATES['Save The Cat'];

    const cards: BeatCard[] = useMemo(() => scenes.map(s => ({
        sceneId: s._id,
        sequenceNumber: s.sequenceNumber,
        act: s.sequenceNumber <= 7 ? 1 : s.sequenceNumber <= 20 ? 2 : 3,
        beatLabel: templateLabels[s.sequenceNumber],
        title: s.title || '',
        slugline: s.slugline || '',
        summary: s.summary || '',
        status: s.status,
        characterCount: 0,
        wordCount: (s.content || '').trim() ? (s.content || '').trim().split(/\s+/).length : 0,
        hasCritique: !!s.critique,
        critiqueScore: s.critique?.score,
    })), [scenes, templateLabels]);

    const filtered = useMemo(() => {
        if (!statusFilter) return cards;
        return cards.filter(c => c.status === statusFilter);
    }, [cards, statusFilter]);

    const groupedByAct = useMemo(() => {
        const groups: Record<number, BeatCard[]> = {};
        filtered.forEach(c => {
            const act = c.act || 1;
            if (!groups[act]) groups[act] = [];
            groups[act].push(c);
        });
        return Object.entries(groups).map(([act, cards]) => ({ act: parseInt(act), cards }));
    }, [filtered]);

    const statusCounts = useMemo(() => ({
        planned: cards.filter(c => c.status === 'planned').length,
        drafted: cards.filter(c => c.status === 'drafted').length,
        reviewed: cards.filter(c => c.status === 'reviewed').length,
        final: cards.filter(c => c.status === 'final').length,
    }), [cards]);

    if (!beatBoardOpen) return null;

    return (
        <div className="border-b border-subtle-8 bg-surface-sidebar">
            <div className="flex items-center justify-between px-3 py-2">
                <div className="flex items-center gap-2">
                    <span className="flex items-center gap-1 text-[8px] font-bold uppercase tracking-wider text-text-secondary">
                        <Map size={10} />
                        Beat Board
                    </span>
                    <span className="text-[7px] text-text-tertiary font-mono">{scenes.length}</span>
                </div>
                <div className="flex items-center gap-1">
                    <div className="relative">
                        <button
                            onClick={() => setShowFilter(!showFilter)}
                            className="p-1.5 rounded-lg hover:bg-subtle-3 text-text-tertiary hover:text-text-secondary transition-[color,background-color] duration-120 active:scale-[0.94] focus-ring"
                            title="Filter by status"
                        >
                            <Filter size={11} />
                        </button>
                        {showFilter && (
                            <div className="absolute right-0 top-full mt-1 z-30 bg-surface-elevated border border-subtle-8 rounded-xl p-1.5 shadow-lg min-w-[180px] origin-top-right transition-[transform,opacity] duration-150">
                                <div className="text-[7px] font-bold text-text-tertiary uppercase tracking-wider px-2 py-1">Structure Template</div>
                                {onBeatTemplateChange && Object.keys(STRUCTURAL_TEMPLATES).map(t => (
                                    <button
                                        key={t}
                                        onClick={() => { onBeatTemplateChange(t); }}
                                        className={'w-full text-left px-2 py-1.5 text-[9px] rounded-lg transition-colors focus-ring ' + (activeTemplate === t ? 'bg-accent/10 text-accent font-bold' : 'text-text-secondary hover:bg-subtle-3')}
                                    >
                                        {t}
                                    </button>
                                ))}
                                <div className="border-t border-subtle-8 my-1" />
                                <div className="text-[7px] font-bold text-text-tertiary uppercase tracking-wider px-2 py-1">Status</div>
                                {[
                                    { key: null, label: 'All Scenes' },
                                    { key: 'planned', label: 'Planned (' + statusCounts.planned + ')' },
                                    { key: 'drafted', label: 'Drafted (' + statusCounts.drafted + ')' },
                                    { key: 'reviewed', label: 'Reviewed (' + statusCounts.reviewed + ')' },
                                    { key: 'final', label: 'Final (' + statusCounts.final + ')' },
                                ].map(opt => (
                                    <button
                                        key={opt.key || 'all'}
                                        onClick={() => { setStatusFilter(opt.key); setShowFilter(false); }}
                                        className={'w-full text-left px-2 py-1.5 text-[9px] rounded-lg transition-colors focus-ring ' + (statusFilter === opt.key ? 'bg-accent/10 text-accent font-bold' : 'text-text-secondary hover:bg-subtle-3')}
                                    >
                                        {opt.label}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                    {activeProject?._id && (
                        <Button variant="ghost" size="sm" onClick={() => onNewScene(activeProject._id)} title="New Scene">
                            <Plus size={13} />
                        </Button>
                    )}
                    <Button variant="ghost" size="sm" onClick={toggleBeatBoard}>
                        <ChevronDown size={12} />
                    </Button>
                </div>
            </div>

            <div className="overflow-x-auto scrollbar-hide pb-2 px-3">
                {loading ? (
                    <div className="flex gap-3">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="w-56 h-28 rounded-xl bg-subtle-3 animate-pulse flex-shrink-0" />
                        ))}
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="text-[10px] text-text-tertiary py-5 px-1 italic">
                        {cards.length === 0 ? 'No scenes yet. Create one to get started.' : 'No scenes match this filter.'}
                    </div>
                ) : (
                    <div className="flex gap-4">
                        {groupedByAct.map(group => (
                            <div key={group.act} className="flex flex-col gap-2">
                                <div className="flex items-center gap-2 px-1">
                                    <span className="text-[7px] font-bold uppercase tracking-wider" style={{ color: group.act === 1 ? 'var(--accent)' : group.act === 2 ? 'var(--status-success)' : 'var(--text-muted)' }}>
                                        Act {group.act}
                                    </span>
                                    <span className="h-px flex-1 bg-subtle-8" />
                                </div>
                                <div className="flex gap-2">
                                    {group.cards.map(card => (
                                        <BeatCard
                                            key={card.sceneId}
                                            card={card}
                                            isActive={activeScene?._id === card.sceneId}
                                            onSelect={() => {
                                                if (activeScene?._id === card.sceneId) return;
                                                if (isGenerating || isCritiquing || isAiThinking || hasUnsavedChanges) {
                                                    const confirmed = window.confirm('You have an active process or unsaved changes. Leaving this scene may result in data loss. Continue?');
                                                    if (!confirmed) return;
                                                }
                                                if (projectId) {
                                                    navigate(`/script-writer/${projectId}/${card.sceneId}`);
                                                }
                                            }}
                                            onDelete={() => activeProject?._id && onDeleteScene(activeProject._id, card.sceneId)}
                                            onGenerate={onGenerateScene ? () => onGenerateScene(card.sceneId) : undefined}
                                        />
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export const BeatBoard = memo(BeatBoardInner);
