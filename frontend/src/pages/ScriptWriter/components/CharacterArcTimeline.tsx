import { useState } from 'react';
import { motion } from 'framer-motion';
import { User, Check, X, ChevronLeft, ChevronRight, Brain } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import type { CharacterArcPoint } from '../types';

interface CharacterArcTimelineProps {
    arcs: CharacterArcPoint[];
    characters: Array<{ _id: string; name: string }>;
    onApprove: (pointId: string) => void;
    onReject: (pointId: string) => void;
    onModify: (pointId: string, notes: string) => void;
    loading?: boolean;
}

export function CharacterArcTimeline({
    arcs,
    characters,
    onApprove,
    onReject,
    onModify,
    loading,
}: CharacterArcTimelineProps) {
    const [activeCharacterId, setActiveCharacterId] = useState<string | null>(null);
    const [editNotes, setEditNotes] = useState<Record<string, string>>({});

    const characterArcs = activeCharacterId
        ? arcs.filter(a => a.characterId === activeCharacterId)
        : arcs;

    const pendingCount = arcs.filter(a => a.status === 'suggested').length;

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full p-6">
                <div className="w-5 h-5 rounded-full border-2 border-border-strong border-t-accent animate-spin" />
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full">
            <div className="flex items-center justify-between px-3 py-2 border-b border-subtle-8">
                <span className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-widest text-text-secondary">
                    <Brain size={11} />
                    Character Arcs
                </span>
                {pendingCount > 0 && (
                    <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: 'oklch(var(--accent) / 0.15)', color: 'var(--accent)' }}>
                        {pendingCount} pending
                    </span>
                )}
            </div>

            {characters.length > 0 && (
                <div className="flex gap-1 p-2 border-b border-subtle-8 overflow-x-auto scrollbar-hide">
                    <button
                        onClick={() => setActiveCharacterId(null)}
                        className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[8px] font-bold uppercase transition-colors focus-ring ${!activeCharacterId ? 'bg-accent/10 text-accent' : 'text-text-muted hover:text-text-secondary hover:bg-subtle-3'}`}
                    >
                        All
                    </button>
                    {characters.map(ch => (
                        <button
                            key={ch._id}
                            onClick={() => setActiveCharacterId(ch._id)}
                            className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[8px] font-bold uppercase transition-colors focus-ring ${activeCharacterId === ch._id ? 'bg-accent/10 text-accent' : 'text-text-muted hover:text-text-secondary hover:bg-subtle-3'}`}
                        >
                            <User size={9} />
                            {ch.name}
                        </button>
                    ))}
                </div>
            )}

            <div className="flex-1 overflow-y-auto p-3 scrollbar-hide">
                {characterArcs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 gap-2">
                        <Brain size={20} className="text-text-muted" />
                        <p className="text-[9px] text-text-muted text-center max-w-[200px] leading-relaxed">
                            {arcs.length === 0
                                ? 'Character arcs will appear here after scene generation.'
                                : 'No arcs for this character yet.'}
                        </p>
                    </div>
                ) : (
                    <div className="relative">
                        <div className="absolute left-3 top-0 bottom-0 w-px bg-subtle-8" />
                        <div className="flex flex-col gap-4">
                            {characterArcs.map((arc, i) => (
                                <motion.div
                                    key={`${arc.sceneId}-${arc.characterId}`}
                                    initial={{ opacity: 0, y: 6 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1], delay: i * 0.04 }}
                                    className="relative pl-8">
                                    <div className={`absolute left-1.5 top-1.5 w-[9px] h-[9px] rounded-full border-2 ${arc.status === 'approved' ? 'border-status-success bg-status-success/20' : arc.status === 'suggested' ? 'border-accent bg-accent/20' : 'border-text-muted bg-subtle-3'}`} />

                                    <div className="bg-subtle-2 border border-subtle-8 rounded-xl p-2.5">
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-[9px] font-bold text-text-secondary">
                                                Scene {arc.sceneNumber}
                                            </span>
                                            <span className={`text-[8px] font-bold uppercase px-1.5 py-0.5 rounded-md ${arc.status === 'approved' ? 'text-status-success bg-status-success/10' : arc.status === 'suggested' ? 'text-accent bg-accent/10' : 'text-text-muted bg-subtle-3'}`}>
                                                {arc.status}
                                            </span>
                                        </div>
                                        <div className="text-[9px] text-text-muted truncate mb-1">{arc.sceneTitle}</div>
                                        <div className="text-[10px] text-text-primary font-medium leading-relaxed">
                                            {arc.characterName}: <span className="italic">{arc.emotionalState}</span>
                                        </div>

                                        {arc.status === 'suggested' && (
                                            <div className="flex items-center gap-1 mt-2 pt-2 border-t border-subtle-8">
                                                <Button variant="ghost" size="sm" onClick={() => onApprove(`${arc.sceneId}-${arc.characterId}`)} className="flex-1 !text-[8px]">
                                                    <Check size={9} /> Approve
                                                </Button>
                                                <Button variant="ghost" size="sm" onClick={() => onReject(`${arc.sceneId}-${arc.characterId}`)} className="flex-1 !text-[8px] !text-status-error">
                                                    <X size={9} /> Reject
                                                </Button>
                                            </div>
                                        )}

                                        {arc.status === 'approved' && (
                                            <button
                                                onClick={() => {
                                                    const key = `${arc.sceneId}-${arc.characterId}`;
                                                    const notes = prompt('Edit notes for this arc point:', editNotes[key] || arc.notes || '');
                                                    if (notes !== null) {
                                                        setEditNotes(prev => ({ ...prev, [key]: notes }));
                                                        onModify(key, notes);
                                                    }
                                                }}
                                                className="mt-2 text-[8px] text-text-muted hover:text-accent transition-colors focus-ring"
                                            >
                                                + Add note
                                            </button>
                                        )}
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
