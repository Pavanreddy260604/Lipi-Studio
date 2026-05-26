import { useState } from 'react';
import { X, User, Brain, Plus, Check, AlertTriangle } from 'lucide-react';
import { Button } from '../../../components/ui/Button';

interface ArcEntry {
    characterId: string;
    characterName: string;
    sceneNumber: number;
    emotionalState: string;
    notes?: string;
}

interface CharacterArcPanelProps {
    arcs: ArcEntry[];
    characters: Array<{ _id: string; name: string }>;
    isOpen: boolean;
    onClose: () => void;
    onDefineArc: (entry: ArcEntry) => void;
    onRemoveArc: (characterId: string, sceneNumber: number) => void;
    onAiCheck: () => void;
}

const EMOTIONS = ['Joyful', 'Sad', 'Angry', 'Fearful', 'Hopeful', 'Determined', 'Conflicted', 'Peaceful', 'Heartbroken', 'Triumphant'];

export function CharacterArcPanel({ arcs, characters, isOpen, onClose, onDefineArc, onRemoveArc, onAiCheck }: CharacterArcPanelProps) {
    const [selectedChar, setSelectedChar] = useState('');
    const [selectedScene, setSelectedScene] = useState(1);
    const [selectedEmotion, setSelectedEmotion] = useState('Determined');
    const [notes, setNotes] = useState('');

    if (!isOpen) return null;

    const distinctChars = [...new Set(arcs.map(a => a.characterName))];
    const distinctScenes = [...new Set(arcs.map(a => a.sceneNumber))].sort((a, b) => a - b);

    const handleAdd = () => {
        if (!selectedChar) return;
        const char = characters.find(c => c._id === selectedChar || c.name === selectedChar);
        if (!char) return;
        onDefineArc({
            characterId: char._id,
            characterName: char.name,
            sceneNumber: selectedScene,
            emotionalState: selectedEmotion,
            notes: notes || undefined,
        });
        setNotes('');
    };

    return (
        <div className="absolute inset-0 z-30 bg-bg-app/95 flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-subtle-8 bg-surface-elevated">
                <span className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-wider text-text-secondary">
                    <Brain size={12} />
                    Character Arcs
                </span>
                <div className="flex items-center gap-2">
                    <Button variant="secondary" size="sm" onClick={onAiCheck} className="text-[8px]">
                        <Check size={10} className="mr-1" />
                        AI Check
                    </Button>
                    <button onClick={onClose} className="p-1 rounded-lg hover:bg-subtle-3 text-text-tertiary transition-colors focus-ring">
                        <X size={14} />
                    </button>
                </div>
            </div>

            <div className="p-4 border-b border-subtle-8 bg-subtle-2 space-y-2">
                <span className="text-[7px] font-bold uppercase tracking-wider text-text-tertiary">Define Arc Point</span>
                <div className="flex gap-2 flex-wrap">
                    <select
                        value={selectedChar}
                        onChange={e => setSelectedChar(e.target.value)}
                        className="px-2 py-1 text-[9px] bg-surface-page border border-subtle-8 rounded-lg text-text-primary outline-none focus:border-accent/30"
                    >
                        <option value="">Character...</option>
                        {characters.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
                    </select>
                    <input
                        type="number"
                        min={1}
                        value={selectedScene}
                        onChange={e => setSelectedScene(parseInt(e.target.value) || 1)}
                        className="w-16 px-2 py-1 text-[9px] bg-surface-page border border-subtle-8 rounded-lg text-text-primary outline-none focus:border-accent/30"
                        placeholder="Scene"
                    />
                    <select
                        value={selectedEmotion}
                        onChange={e => setSelectedEmotion(e.target.value)}
                        className="px-2 py-1 text-[9px] bg-surface-page border border-subtle-8 rounded-lg text-text-primary outline-none focus:border-accent/30"
                    >
                        {EMOTIONS.map(e => <option key={e} value={e}>{e}</option>)}
                    </select>
                    <input
                        value={notes}
                        onChange={e => setNotes(e.target.value)}
                        className="flex-1 min-w-[120px] px-2 py-1 text-[9px] bg-surface-page border border-subtle-8 rounded-lg text-text-primary placeholder:text-text-tertiary outline-none focus:border-accent/30"
                        placeholder="Notes (optional)"
                    />
                    <button
                        onClick={handleAdd}
                        disabled={!selectedChar}
                        className="px-2 py-1 rounded-lg bg-accent text-white text-[8px] font-bold uppercase disabled:opacity-30 transition-opacity focus-ring"
                    >
                        <Plus size={12} />
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 scrollbar-hide">
                {arcs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full gap-3">
                        <Brain size={24} className="text-text-tertiary/30" />
                        <p className="text-[10px] text-text-tertiary text-center max-w-[240px] leading-relaxed">
                            Define each character's emotional state scene by scene. Then run <strong>AI Check</strong> to verify consistency against your scenes.
                        </p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {characters.filter(c => arcs.some(a => a.characterId === c._id)).map(char => {
                            const charArcs = arcs.filter(a => a.characterId === char._id).sort((a, b) => a.sceneNumber - b.sceneNumber);
                            return (
                                <div key={char._id} className="space-y-1.5">
                                    <div className="flex items-center gap-2">
                                        <User size={11} className="text-accent" />
                                        <span className="text-[10px] font-bold text-text-primary">{char.name}</span>
                                        <span className="text-[7px] text-text-tertiary font-mono">{charArcs.length} points</span>
                                    </div>
                                    <div className="space-y-1 ml-4">
                                        {charArcs.map((arc, i) => (
                                            <div key={`${arc.characterId}-${arc.sceneNumber}`} className="flex items-center gap-2 text-[9px] text-text-secondary group">
                                                <span className="text-text-tertiary font-mono w-8 flex-shrink-0">S{arc.sceneNumber}</span>
                                                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{
                                                    backgroundColor: i === 0 ? 'var(--accent)' : i === charArcs.length - 1 ? 'var(--status-success)' : 'var(--text-tertiary)',
                                                }} />
                                                <span className="italic font-medium">{arc.emotionalState}</span>
                                                {arc.notes && <span className="text-text-tertiary truncate">— {arc.notes}</span>}
                                                <button
                                                    onClick={() => onRemoveArc(arc.characterId, arc.sceneNumber)}
                                                    className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-text-tertiary hover:text-status-error transition-all focus-ring"
                                                >
                                                    <X size={9} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
