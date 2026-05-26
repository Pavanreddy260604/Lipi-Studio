import { useState, useEffect, memo } from 'react';
import { X, Image as ImageIcon, MessageSquare, Info, Brain, Plus, Check, Trash2, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';
import type { IScene as Scene } from '../../../services/project.api';
import { projectApi } from '../../../services/project.api';

interface ArcEntry {
    characterId: string;
    characterName: string;
    sceneNumber: number;
    emotionalState: string;
    notes?: string;
}

interface ReferencePanelProps {
    activeScene: Scene | null;
    isOpen: boolean;
    onClose: () => void;
    // Arcs Data
    arcs: ArcEntry[];
    characters: Array<{ _id: string; name: string }>;
    onDefineArc: (entry: ArcEntry) => void;
    onRemoveArc: (characterId: string, sceneNumber: number) => void;
    onAiCheck: () => void;
    onUpdateScene: (updated: Scene) => void;
    defaultTab?: 'context' | 'arcs';
}

const ReferencePanelInner = ({
    activeScene,
    isOpen,
    onClose,
    arcs,
    characters,
    onDefineArc,
    onRemoveArc,
    onAiCheck,
    onUpdateScene,
    defaultTab,
}: ReferencePanelProps) => {
    const [activeTab, setActiveTab] = useState<'context' | 'arcs'>('context');

    useEffect(() => {
        if (defaultTab) {
            setActiveTab(defaultTab);
        }
    }, [defaultTab]);

    // Context form states
    const [newNote, setNewNote] = useState('');
    const [newImageUrl, setNewImageUrl] = useState('');
    const [isSavingNote, setIsSavingNote] = useState(false);
    const [isSavingImage, setIsSavingImage] = useState(false);

    // Arc form states
    const [selectedChar, setSelectedChar] = useState('');
    const [selectedEmotion, setSelectedEmotion] = useState('Determined');
    const [arcNotes, setArcNotes] = useState('');

    if (!isOpen) return null;

    const images = activeScene?.images || [];
    const notes = activeScene?.comments || [];
    const sceneNum = activeScene?.sequenceNumber || 1;

    // Filter arcs for the current scene
    const sceneArcs = arcs.filter(a => a.sceneNumber === sceneNum);

    const handleAddNote = async () => {
        if (!newNote.trim() || !activeScene) return;
        setIsSavingNote(true);
        try {
            const comment = {
                id: `c-${Date.now()}`,
                author: 'Writer',
                text: newNote.trim(),
                timestamp: Date.now(),
                resolved: false,
            };
            const updatedComments = [...(activeScene.comments || []), comment];
            const updated = await projectApi.updateScene(activeScene._id, { comments: updatedComments } as any);
            onUpdateScene(updated);
            setNewNote('');
        } catch (err) {
            console.error('Failed to add note:', err);
        } finally {
            setIsSavingNote(false);
        }
    };

    const handleAddImage = async () => {
        if (!newImageUrl.trim() || !activeScene) return;
        setIsSavingImage(true);
        try {
            const updatedImages = [...(activeScene.images || []), newImageUrl.trim()];
            const updated = await projectApi.updateScene(activeScene._id, { images: updatedImages } as any);
            onUpdateScene(updated);
            setNewImageUrl('');
        } catch (err) {
            console.error('Failed to add reference image:', err);
        } finally {
            setIsSavingImage(false);
        }
    };

    const handleRemoveNote = async (noteId: string) => {
        if (!activeScene) return;
        try {
            const updatedComments = (activeScene.comments || []).filter((c: any) => c.id !== noteId);
            const updated = await projectApi.updateScene(activeScene._id, { comments: updatedComments } as any);
            onUpdateScene(updated);
        } catch (err) {
            console.error('Failed to delete note:', err);
        }
    };

    const handleRemoveImage = async (urlToRemove: string) => {
        if (!activeScene) return;
        try {
            const updatedImages = (activeScene.images || []).filter((url: string) => url !== urlToRemove);
            const updated = await projectApi.updateScene(activeScene._id, { images: updatedImages } as any);
            onUpdateScene(updated);
        } catch (err) {
            console.error('Failed to delete image:', err);
        }
    };

    const handleDefineArcPoint = () => {
        if (!selectedChar || !activeScene) return;
        const char = characters.find(c => c._id === selectedChar || c.name === selectedChar);
        if (!char) return;
        onDefineArc({
            characterId: char._id,
            characterName: char.name,
            sceneNumber: sceneNum,
            emotionalState: selectedEmotion,
            notes: arcNotes || undefined,
        });
        setArcNotes('');
        setSelectedChar('');
    };

    const EMOTIONS = ['Joyful', 'Sad', 'Angry', 'Fearful', 'Hopeful', 'Determined', 'Conflicted', 'Peaceful', 'Heartbroken', 'Triumphant'];

    return (
        <div className="w-full h-full bg-surface-elevated flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-4 h-12 border-b border-subtle-8">
                <div className="flex items-center gap-2">
                    <Info size={16} className="text-accent" />
                    <span className="text-xs font-bold uppercase tracking-widest text-text-primary">Studio Inspector</span>
                </div>
                <button
                    onClick={onClose}
                    className="p-1.5 rounded-lg text-text-tertiary hover:text-text-secondary hover:bg-subtle-3 transition-colors focus-ring"
                >
                    <X size={16} />
                </button>
            </div>

            {/* Tab Navigation */}
            <div className="flex border-b border-subtle-8 bg-subtle-2 p-1 gap-1">
                <button
                    onClick={() => setActiveTab('context')}
                    className={`flex-1 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all focus-ring ${
                        activeTab === 'context'
                            ? 'bg-surface-page text-accent shadow-sm border border-subtle-8'
                            : 'text-text-tertiary hover:text-text-secondary hover:bg-subtle-3'
                    }`}
                >
                    Context Reference
                </button>
                <button
                    onClick={() => setActiveTab('arcs')}
                    className={`flex-1 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all focus-ring ${
                        activeTab === 'arcs'
                            ? 'bg-surface-page text-accent shadow-sm border border-subtle-8'
                            : 'text-text-tertiary hover:text-text-secondary hover:bg-subtle-3'
                    }`}
                >
                    Character Arcs
                </button>
            </div>

            {/* Content Container */}
            <div className="flex-1 overflow-y-auto p-4 space-y-6 scrollbar-hide">
                {activeTab === 'context' ? (
                    <>
                        {/* Notes Section */}
                        <section className="space-y-3">
                            <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-text-tertiary border-b border-subtle-8 pb-1.5">
                                <MessageSquare size={13} className="text-accent" />
                                <span>Scene Notes</span>
                            </div>

                            {/* Direct Add Note input */}
                            <div className="flex flex-col gap-1.5 bg-subtle-2 p-2 rounded-xl border border-subtle-8">
                                <textarea
                                    value={newNote}
                                    onChange={(e) => setNewNote(e.target.value)}
                                    placeholder="Write a scene note/feedback..."
                                    className="w-full h-14 p-2 text-xs bg-surface-page border border-subtle-8 rounded-lg text-text-primary placeholder:text-text-tertiary outline-none resize-none focus:border-accent/30"
                                />
                                <button
                                    onClick={handleAddNote}
                                    disabled={isSavingNote || !newNote.trim()}
                                    className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent text-white text-[10px] font-bold uppercase tracking-wider disabled:opacity-30 transition-opacity focus-ring"
                                >
                                    {isSavingNote ? 'Saving...' : <><Plus size={12} /> Add Note</>}
                                </button>
                            </div>

                            {notes.length > 0 ? (
                                <div className="space-y-2">
                                    {notes.map((c: any, i: number) => (
                                        <div key={c.id || i} className="group relative p-2.5 rounded-xl bg-subtle-2 border border-subtle-8 shadow-sm transition-all hover:border-subtle-20">
                                            <div className="flex items-center justify-between mb-1">
                                                <span className="text-[9px] font-bold text-accent uppercase tracking-wider">{c.author}</span>
                                                <span className="text-[8px] text-text-muted">{new Date(c.timestamp).toLocaleDateString()}</span>
                                            </div>
                                            <p className="text-xs text-text-secondary leading-relaxed pr-6">{c.text}</p>
                                            <button
                                                onClick={() => handleRemoveNote(c.id)}
                                                className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 p-1 rounded text-text-tertiary hover:text-status-error hover:bg-subtle-3 transition-all focus-ring"
                                                title="Delete note"
                                            >
                                                <Trash2 size={10} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center py-6 px-4 rounded-xl border border-dashed border-subtle-10 bg-subtle-2/50 text-center">
                                    <MessageSquare size={16} className="text-text-muted mb-1.5 opacity-20" />
                                    <p className="text-[10px] text-text-tertiary leading-relaxed">No notes yet. Create your first note above to guide the scene.</p>
                                </div>
                            )}
                        </section>

                        {/* Images Section */}
                        <section className="space-y-3">
                            <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-text-tertiary border-b border-subtle-8 pb-1.5">
                                <ImageIcon size={13} className="text-accent" />
                                <span>Reference Images</span>
                            </div>

                            {/* Direct Add Image URL */}
                            <div className="flex flex-col gap-1.5 bg-subtle-2 p-2 rounded-xl border border-subtle-8">
                                <input
                                    type="text"
                                    value={newImageUrl}
                                    onChange={(e) => setNewImageUrl(e.target.value)}
                                    placeholder="Paste image URL (jpg, png...)"
                                    className="w-full px-2 py-1.5 text-xs bg-surface-page border border-subtle-8 rounded-lg text-text-primary placeholder:text-text-tertiary outline-none focus:border-accent/30"
                                />
                                <button
                                    onClick={handleAddImage}
                                    disabled={isSavingImage || !newImageUrl.trim()}
                                    className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent text-white text-[10px] font-bold uppercase tracking-wider disabled:opacity-30 transition-opacity focus-ring"
                                >
                                    {isSavingImage ? 'Adding...' : <><Plus size={12} /> Add Image</>}
                                </button>
                            </div>

                            {images.length > 0 ? (
                                <div className="grid grid-cols-2 gap-2">
                                    {images.map((url: string, i: number) => (
                                        <div key={url || i} className="group relative aspect-square rounded-xl border border-subtle-8 overflow-hidden bg-subtle-2 shadow-sm transition-all hover:border-accent/40">
                                            <img 
                                                src={url} 
                                                alt={`Ref ${i+1}`} 
                                                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" 
                                                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} 
                                            />
                                            <button
                                                onClick={() => handleRemoveImage(url)}
                                                className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 p-1.5 rounded bg-black/40 text-white/80 hover:text-white hover:bg-black/60 transition-all focus-ring"
                                                title="Delete image"
                                            >
                                                <Trash2 size={10} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center py-6 px-4 rounded-xl border border-dashed border-subtle-10 bg-subtle-2/50 text-center">
                                    <ImageIcon size={16} className="text-text-muted mb-1.5 opacity-20" />
                                    <p className="text-[10px] text-text-tertiary leading-relaxed">No reference images yet. Add a URL to store visual cues.</p>
                                </div>
                            )}
                        </section>
                    </>
                ) : (
                    <>
                        {/* Character Arcs Section */}
                        <section className="space-y-4">
                            <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-text-tertiary border-b border-subtle-8 pb-1.5">
                                <span className="flex items-center gap-2">
                                    <Brain size={13} className="text-accent" />
                                    <span>Arc consistency</span>
                                </span>
                                <button
                                    onClick={onAiCheck}
                                    className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-accent/10 border border-accent/20 text-accent text-[9px] font-bold uppercase tracking-wider transition-colors hover:bg-accent hover:text-white focus-ring"
                                    title="Check screenplay consistency against character emotional targets"
                                >
                                    <Sparkles size={10} />
                                    AI Check
                                </button>
                            </div>

                            {/* Define Arc Point Form inside sidebar */}
                            <div className="flex flex-col gap-2 bg-subtle-2 p-3 rounded-xl border border-subtle-8 space-y-1">
                                <span className="text-[8px] font-bold uppercase tracking-wider text-text-tertiary">Define emotional target</span>
                                
                                <div className="flex flex-col gap-2">
                                    <select
                                        value={selectedChar}
                                        onChange={e => setSelectedChar(e.target.value)}
                                        className="w-full px-2 py-1.5 text-xs bg-surface-page border border-subtle-8 rounded-lg text-text-primary outline-none focus:border-accent/30 cursor-pointer"
                                    >
                                        <option value="">Select Character...</option>
                                        {characters.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
                                    </select>

                                    <div className="flex gap-2">
                                        <select
                                            value={selectedEmotion}
                                            onChange={e => setSelectedEmotion(e.target.value)}
                                            className="flex-1 px-2 py-1.5 text-xs bg-surface-page border border-subtle-8 rounded-lg text-text-primary outline-none focus:border-accent/30 cursor-pointer"
                                        >
                                            {EMOTIONS.map(e => <option key={e} value={e}>{e}</option>)}
                                        </select>
                                        <input
                                            type="text"
                                            disabled
                                            value={`Scene ${sceneNum}`}
                                            className="w-24 px-2 py-1.5 text-xs bg-subtle-3 border border-subtle-8 rounded-lg text-text-tertiary text-center font-bold"
                                        />
                                    </div>

                                    <textarea
                                        value={arcNotes}
                                        onChange={e => setArcNotes(e.target.value)}
                                        placeholder="Emotional cues or notes..."
                                        className="w-full h-12 p-2 text-xs bg-surface-page border border-subtle-8 rounded-lg text-text-primary placeholder:text-text-tertiary outline-none resize-none focus:border-accent/30"
                                    />

                                    <button
                                        onClick={handleDefineArcPoint}
                                        disabled={!selectedChar}
                                        className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent text-white text-[10px] font-bold uppercase tracking-wider disabled:opacity-30 transition-opacity focus-ring"
                                    >
                                        <Plus size={12} /> Set Emotional Target
                                    </button>
                                </div>
                            </div>

                            {/* Visual Timeline of Scene Arc Points */}
                            <div className="space-y-3">
                                <span className="text-[8px] font-bold uppercase tracking-wider text-text-tertiary">Active Emotional Targets</span>
                                
                                {sceneArcs.length > 0 ? (
                                    <div className="relative pl-4 border-l border-subtle-10 space-y-4">
                                        {sceneArcs.map((arc, i) => (
                                            <div key={`${arc.characterId}-${arc.sceneNumber}`} className="relative group">
                                                {/* Connecting dot */}
                                                <div 
                                                    className="absolute -left-[20.5px] top-1.5 w-2 h-2 rounded-full border border-surface-elevated flex-shrink-0"
                                                    style={{
                                                        backgroundColor: i % 2 === 0 ? 'var(--accent)' : 'var(--status-success)',
                                                    }}
                                                />
                                                
                                                <div className="p-2.5 rounded-xl bg-subtle-2 border border-subtle-8 shadow-sm">
                                                    <div className="flex items-center justify-between mb-1">
                                                        <span className="text-[10px] font-bold text-text-primary">{arc.characterName}</span>
                                                        <button
                                                            onClick={() => onRemoveArc(arc.characterId, arc.sceneNumber)}
                                                            className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-text-tertiary hover:text-status-error hover:bg-subtle-3 transition-all focus-ring"
                                                            title="Remove target"
                                                        >
                                                            <X size={10} />
                                                        </button>
                                                    </div>
                                                    <div className="flex items-center gap-1.5 text-xs text-accent font-semibold italic">
                                                        <span>{arc.emotionalState}</span>
                                                    </div>
                                                    {arc.notes && (
                                                        <p className="mt-1 text-[10px] text-text-tertiary leading-relaxed border-t border-subtle-8/40 pt-1">
                                                            {arc.notes}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center justify-center py-6 px-4 rounded-xl border border-dashed border-subtle-10 bg-subtle-2/50 text-center">
                                        <Brain size={16} className="text-text-muted mb-1.5 opacity-20" />
                                        <p className="text-[10px] text-text-tertiary leading-relaxed">No character emotional targets set for Scene {sceneNum}. Add targets above to enable AI Check.</p>
                                    </div>
                                )}
                            </div>
                        </section>
                    </>
                )}
            </div>

            {/* Footer Tip */}
            <div className="p-4 bg-subtle-2/30 border-t border-subtle-8">
                <div className="p-3 rounded-xl bg-accent/5 border border-accent/10 flex items-start gap-2">
                    <Sparkles size={14} className="text-accent flex-shrink-0 mt-0.5" />
                    <p className="text-[10px] text-accent/80 leading-relaxed font-medium">
                        {activeTab === 'context' ? (
                            <span><span className="font-bold">Scene Notes & Images</span> guide the style and dialogue. The AI reads them to keep output strictly on-brand.</span>
                        ) : (
                            <span>Define character emotional targets, then run <span className="font-bold">AI Check</span> to audit the current dialogue for consistent portrayal.</span>
                        )}
                    </p>
                </div>
            </div>
        </div>
    );
};

export const ReferencePanel = memo(ReferencePanelInner);
