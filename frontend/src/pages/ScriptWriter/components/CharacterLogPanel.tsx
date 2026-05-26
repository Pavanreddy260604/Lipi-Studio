import React, { useState } from 'react';
import { Plus, Trash2, Calendar, Edit2, Check, X } from 'lucide-react';
import { characterApi, type Character } from '../../../services/character.api';
import { baseApi } from '../../../services/base.api';

interface CharacterLogPanelProps {
    character: Character;
    onUpdateCharacter: (updated: Character) => void;
}

export function CharacterLogPanel({ character, onUpdateCharacter }: CharacterLogPanelProps) {
    const [logs, setLogs] = useState<{ sceneNumber: number; event: string }[]>(character.historyLogs || []);
    const [newSceneNum, setNewSceneNum] = useState<number | ''>('');
    const [newEventDesc, setNewEventDesc] = useState('');
    const [editingIdx, setEditingIdx] = useState<number | null>(null);
    const [editSceneNum, setEditSceneNum] = useState<number | ''>('');
    const [editEventDesc, setEditEventDesc] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleAddLog = async (e: React.FormEvent) => {
        e.preventDefault();
        if (newSceneNum === '' || !newEventDesc.trim()) return;

        const newLog = { sceneNumber: Number(newSceneNum), event: newEventDesc.trim() };
        const updatedLogs = [...logs, newLog].sort((a, b) => a.sceneNumber - b.sceneNumber);
        
        setIsSaving(true);
        setError(null);
        try {
            const res = await characterApi.updateCharacter(character._id, {
                historyLogs: updatedLogs
            });
            setLogs(updatedLogs);
            onUpdateCharacter(res);
            setNewSceneNum('');
            setNewEventDesc('');
        } catch (err: any) {
            setError(err.message || 'Failed to add log entry');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteLog = async (index: number) => {
        const deletedEvent = logs[index];
        const updatedLogs = logs.filter((_, idx) => idx !== index);
        setIsSaving(true);
        setError(null);
        try {
            const res = await characterApi.updateCharacter(character._id, {
                historyLogs: updatedLogs
            });
            setLogs(updatedLogs);
            onUpdateCharacter(res);

            // Log forget event instructions to RLHF global feedback
            if (deletedEvent) {
                try {
                    await baseApi.request('/script/character/feedback', {
                        method: 'POST',
                        body: JSON.stringify({
                            bibleId: character.bibleId,
                            mistakeContext: `Deletion of historical timeline event: "${deletedEvent.event}" for ${character.name}`,
                            userCorrection: `Important: Ignore the event "${deletedEvent.event}" for ${character.name}. This event never happened and should be completely forgotten in future scene drafts.`,
                            category: 'global_casting'
                        })
                    });
                } catch (err) {
                    console.error('Failed to log forget instruction:', err);
                }
            }
        } catch (err: any) {
            setError(err.message || 'Failed to delete log entry');
        } finally {
            setIsSaving(false);
        }
    };

    const startEditing = (idx: number) => {
        setEditingIdx(idx);
        setEditSceneNum(logs[idx].sceneNumber);
        setEditEventDesc(logs[idx].event);
    };

    const handleSaveEdit = async (index: number) => {
        if (editSceneNum === '' || !editEventDesc.trim()) return;

        const updatedLogs = [...logs];
        updatedLogs[index] = { sceneNumber: Number(editSceneNum), event: editEventDesc.trim() };
        updatedLogs.sort((a, b) => a.sceneNumber - b.sceneNumber);

        setIsSaving(true);
        setError(null);
        try {
            const res = await characterApi.updateCharacter(character._id, {
                historyLogs: updatedLogs
            });
            setLogs(updatedLogs);
            onUpdateCharacter(res);
            setEditingIdx(null);
        } catch (err: any) {
            setError(err.message || 'Failed to save edits');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="bg-surface-elevated border border-subtle-8 rounded-2xl shadow-[var(--shadow-sm)] p-5 flex flex-col gap-4 mt-6">
            <div className="flex items-center justify-between border-b border-subtle-8 pb-3">
                <div className="flex items-center gap-2">
                    <Calendar size={15} className="text-accent" />
                    <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider font-serif">
                        Character History Logs
                    </h3>
                </div>
                {isSaving && <span className="text-[9px] text-accent animate-pulse font-mono font-bold uppercase">Saving...</span>}
            </div>

            {error && (
                <div className="text-[10px] text-red-500 bg-red-500/10 border border-red-500/20 p-2.5 rounded-lg">
                    {error}
                </div>
            )}

            {/* Event List */}
            <div className="relative pl-4 border-l border-subtle-8 space-y-5 my-2">
                {logs.map((log, idx) => {
                    const isEditing = editingIdx === idx;
                    return (
                        <div key={idx} className="relative group">
                            {/* Dot indicator */}
                            <div className="absolute -left-[20.5px] top-1.5 w-2 h-2 rounded-full bg-accent border border-surface-elevated" />

                            {isEditing ? (
                                <div className="flex flex-col gap-2 bg-subtle-2 border border-subtle-8 rounded-lg p-2.5">
                                    <div className="flex items-center gap-2">
                                        <span className="text-[9px] font-mono text-text-tertiary">SCENE</span>
                                        <input
                                            type="number"
                                            value={editSceneNum}
                                            onChange={(e) => setEditSceneNum(e.target.value === '' ? '' : Number(e.target.value))}
                                            className="w-16 bg-surface-page border border-subtle-8 rounded px-1.5 py-0.5 text-[10px] text-text-primary focus:outline-none focus-ring"
                                        />
                                    </div>
                                    <textarea
                                        value={editEventDesc}
                                        onChange={(e) => setEditEventDesc(e.target.value)}
                                        rows={2}
                                        className="w-full bg-surface-page border border-subtle-8 rounded px-2 py-1 text-[10px] text-text-primary focus:outline-none focus-ring resize-none"
                                    />
                                    <div className="flex items-center justify-end gap-1.5 mt-1">
                                        <button
                                            type="button"
                                            onClick={() => setEditingIdx(null)}
                                            className="p-1 rounded text-text-tertiary hover:text-text-secondary hover:bg-subtle-3 focus-ring"
                                        >
                                            <X size={12} />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleSaveEdit(idx)}
                                            className="p-1 rounded bg-accent text-white hover:opacity-90 focus-ring"
                                        >
                                            <Check size={12} />
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex-1">
                                        <div className="text-[8px] font-mono font-bold text-accent uppercase tracking-wider">
                                            Scene {log.sceneNumber}
                                        </div>
                                        <p className="text-[10px] text-text-secondary mt-0.5 font-sans leading-relaxed">
                                            {log.event}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                            type="button"
                                            onClick={() => startEditing(idx)}
                                            className="p-1 rounded text-text-tertiary hover:text-text-secondary hover:bg-subtle-2 focus-ring"
                                            title="Edit Log"
                                        >
                                            <Edit2 size={10} />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleDeleteLog(idx)}
                                            className="p-1 rounded text-text-tertiary hover:text-red-500 hover:bg-subtle-2 focus-ring"
                                            title="Delete Log"
                                        >
                                            <Trash2 size={10} />
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}

                {logs.length === 0 && (
                    <p className="text-[10px] text-text-tertiary italic my-2">No historical events logged yet.</p>
                )}
            </div>

            {/* Add Log Form */}
            <form onSubmit={handleAddLog} className="border-t border-subtle-8 pt-4 mt-2 flex flex-col gap-2">
                <div className="flex items-center gap-2">
                    <span className="text-[9px] font-mono font-bold text-text-secondary uppercase">Add Event in Scene:</span>
                    <input
                        type="number"
                        placeholder="Scene #"
                        value={newSceneNum}
                        onChange={(e) => setNewSceneNum(e.target.value === '' ? '' : Number(e.target.value))}
                        className="w-20 bg-subtle-2 border border-subtle-8 rounded px-2.5 py-1 text-[10px] text-text-primary focus:outline-none focus-ring"
                        required
                    />
                </div>
                <div className="flex gap-2">
                    <input
                        type="text"
                        placeholder="e.g. Lost their key ring during the chase..."
                        value={newEventDesc}
                        onChange={(e) => setNewEventDesc(e.target.value)}
                        className="flex-1 bg-subtle-2 border border-subtle-8 rounded px-3 py-1.5 text-[10px] text-text-primary placeholder:text-text-tertiary focus:outline-none focus-ring"
                        required
                    />
                    <button
                        type="submit"
                        disabled={newSceneNum === '' || !newEventDesc.trim() || isSaving}
                        className="p-1.5 bg-accent text-white rounded-lg flex items-center justify-center transition-all hover:opacity-90 active:scale-[0.96] focus-ring disabled:opacity-50"
                    >
                        <Plus size={14} />
                    </button>
                </div>
            </form>
        </div>
    );
}
