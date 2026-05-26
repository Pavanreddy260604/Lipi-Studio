import { Trash2, ChevronLeft, UploadCloud, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';
import { useState } from 'react';
import type { Character } from '../../../../services/character.api';
import { characterApi } from '../../../../services/character.api';
import type { CharacterForm } from '../../types';
import { Button } from '../../../../components/ui/Button';
import { CharacterLogPanel } from '../CharacterLogPanel';

interface CharacterEditProps {
    isCreatingNew: boolean;
    editingCharacter?: Character;
    characterForm: CharacterForm;
    onBack: () => void;
    onChange: (field: keyof CharacterForm, value: string) => void;
    onSave: () => void;
    onDelete: () => void;
    isSaving: boolean;

    // Voice Props
    voiceFile: File | null;
    onVoiceFileChange: (file: File | null) => void;
    onVoiceIngest: () => void;
    voiceStatus: string | null;
    isIngesting: boolean;

    // AI Brainstorm Props
    isGeneratingCharacter?: boolean;
    onGenerateCharacterProfile?: (prompt: string, name?: string) => Promise<void> | void;
}

export function CharacterEdit({
    isCreatingNew,
    editingCharacter,
    characterForm,
    onBack,
    onChange,
    onSave,
    onDelete,
    isSaving,
    voiceFile,
    onVoiceFileChange,
    onVoiceIngest,
    voiceStatus,
    isIngesting,
    isGeneratingCharacter,
    onGenerateCharacterProfile
}: CharacterEditProps) {
    const [aiPrompt, setAiPrompt] = useState('');
    const [heroError, setHeroError] = useState<string | null>(null);

    return (
        <motion.div
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.2 }}
            className="p-6"
        >
            <Button variant="ghost" size="sm" onClick={onBack} className="mb-6">
                <ChevronLeft size={18} />
                Back to Cast
            </Button>

            <div className="bg-surface-elevated border border-subtle-8 rounded-2xl shadow-[var(--shadow-md)] p-6 flex flex-col gap-4">
                <h2 className="text-xl font-bold text-[var(--text-primary)]">{isCreatingNew ? 'New Character' : `Edit: ${editingCharacter?.name || ''}`}</h2>

                {isCreatingNew && (
                    <div className="bg-subtle-3 border border-subtle-8 rounded-xl p-4 flex flex-col gap-3 mb-4">
                        <div className="flex items-center gap-2 text-xs font-bold text-text-secondary uppercase tracking-wider">
                            <Sparkles size={14} style={{ color: 'var(--accent)' }} />
                            <span>AI Character Architect</span>
                        </div>
                        <p className="text-[10px] text-text-tertiary">Enter an archetype or prompt to brainstorm a complete character profile with AI.</p>
                        <div className="flex gap-2">
                            <input
                                className="flex-1 px-3 py-2 text-xs bg-surface-page border border-subtle-8 rounded-lg text-text-primary placeholder:text-text-tertiary outline-none focus:border-accent/30"
                                placeholder="e.g. A cynical noir detective seeking redemption..."
                                value={aiPrompt}
                                onChange={(e) => setAiPrompt(e.target.value)}
                            />
                            <Button
                                variant="secondary"
                                size="sm"
                                disabled={isGeneratingCharacter || !aiPrompt.trim()}
                                onClick={async () => {
                                    if (onGenerateCharacterProfile) {
                                        await onGenerateCharacterProfile(aiPrompt, characterForm.name);
                                    }
                                }}
                            >
                                {isGeneratingCharacter ? 'Brainstorming...' : 'Brainstorm Profile'}
                            </Button>
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="flex flex-col gap-4">
                        <h3 className="text-sm font-bold text-[var(--text-secondary)] uppercase tracking-wider">Basic Info</h3>
                        <div className="flex flex-col gap-4">
                            <div className="flex flex-col gap-4">
                                <label className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest">Name</label>
                                <input
                                    className="w-full px-4 py-3 text-sm bg-subtle-2 border border-subtle-8 rounded-md focus-ring min-h-[44px]"
                                    value={characterForm.name}
                                    onChange={(e) => onChange('name', e.target.value)}
                                    placeholder="Character name"
                                />
                            </div>
                            <div className="flex flex-col gap-4">
                                <label className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest">Role</label>
                                <select
                                    className="w-full px-4 py-3 text-sm cursor-pointer bg-subtle-2 border border-subtle-8 rounded-md focus-ring min-h-[44px]"
                                    value={characterForm.role}
                                    onChange={(e) => onChange('role', e.target.value)}
                                >
                                    <option value="protagonist">Protagonist</option>
                                    <option value="antagonist">Antagonist</option>
                                    <option value="supporting">Supporting</option>
                                    <option value="minor">Minor</option>
                                </select>
                            </div>

                            {!isCreatingNew && editingCharacter && (
                                <div className="flex flex-col gap-2 mt-2">
                                    <div className="flex items-center gap-3 bg-subtle-2 border border-subtle-8 rounded-xl p-3.5">
                                        <input
                                            type="checkbox"
                                            id="isHero"
                                            checked={Boolean(editingCharacter.isHero)}
                                            onChange={async (e) => {
                                                setHeroError(null);
                                                try {
                                                    const res = await characterApi.updateCharacter(editingCharacter._id, {
                                                        isHero: e.target.checked
                                                    });
                                                    // Trigger direct save to refresh the local cache
                                                    onSave();
                                                } catch (err: any) {
                                                    setHeroError(err.message || 'Another character in this film is already declared the Hero.');
                                                }
                                            }}
                                            className="w-4 h-4 rounded text-accent bg-subtle-3 border-subtle-8 focus:ring-accent cursor-pointer"
                                        />
                                        <label htmlFor="isHero" className="text-[10px] font-bold text-text-primary uppercase tracking-wider cursor-pointer">
                                            ⭐ Primary Story Hero (Flaws & Wound compilation active)
                                        </label>
                                    </div>
                                    {heroError && (
                                        <div className="text-[9px] text-red-500 font-bold bg-red-500/10 border border-red-500/20 px-3 py-1.5 rounded-lg">
                                            {heroError}
                                        </div>
                                    )}
                                </div>
                            )}

                            <div className="flex flex-col gap-4">
                                <label className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest">Traits (comma separated)</label>
                                <input
                                    className="w-full px-4 py-3 text-sm bg-subtle-2 border border-subtle-8 rounded-md focus-ring min-h-[44px]"
                                    value={characterForm.traits}
                                    onChange={(e) => onChange('traits', e.target.value)}
                                    placeholder="e.g. Brooding, Sarcastic, Loyal"
                                />
                            </div>
                            <div className="flex flex-col gap-4">
                                <label className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest">Motivation</label>
                                <textarea
                                    className="w-full px-4 py-3 text-sm resize-none bg-subtle-2 border border-subtle-8 rounded-md focus-ring min-h-[44px]"
                                    rows={3}
                                    value={characterForm.motivation}
                                    onChange={(e) => onChange('motivation', e.target.value)}
                                    placeholder="What drives this character?"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-col gap-4">
                        <h3 className="text-sm font-bold text-[var(--text-secondary)] uppercase tracking-wider">Voice & Dialogue</h3>
                        <div className="flex flex-col gap-4">
                            <div className="flex flex-col gap-4">
                                <label className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest">Voice Description</label>
                                <textarea
                                    className="w-full px-4 py-3 text-sm resize-none bg-subtle-2 border border-subtle-8 rounded-md focus-ring min-h-[44px]"
                                    rows={3}
                                    value={characterForm.voiceDescription}
                                    onChange={(e) => onChange('voiceDescription', e.target.value)}
                                    placeholder="e.g. Gruff, uses simple words, Brooklyn accent"
                                />
                            </div>
                            <div className="flex flex-col gap-4">
                                <label className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest">Accent</label>
                                <input
                                    className="w-full px-4 py-3 text-sm bg-subtle-2 border border-subtle-8 rounded-md focus-ring min-h-[44px]"
                                    value={characterForm.voiceAccent}
                                    onChange={(e) => onChange('voiceAccent', e.target.value)}
                                    placeholder="e.g. Southern, British, etc."
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {!isCreatingNew && (
                    <div className="bg-surface-elevated border border-subtle-8 rounded-xl shadow-[var(--shadow-sm)] p-6 flex flex-col gap-4">
                        <h3 className="text-sm font-bold text-[var(--text-secondary)] uppercase tracking-wider">Voice Training (RAG)</h3>
                        <p className="text-xs text-[var(--text-tertiary)]">Upload screenplay PDFs or text files to train this character&apos;s voice.</p>
                        <div className="flex gap-2">
                            <input
                                type="file"
                                accept=".pdf,.txt"
                                onChange={(e) => onVoiceFileChange(e.target.files?.[0] || null)}
                                className="flex-1 px-4 py-2 text-xs bg-subtle-2 border border-subtle-8 rounded-md min-h-[44px] focus-ring"
                            />
                            <Button variant="secondary" size="sm" onClick={onVoiceIngest} disabled={!voiceFile || isIngesting}>
                                <UploadCloud size={16} />
                                {isIngesting ? 'Uploading...' : 'Ingest'}
                            </Button>
                        </div>
                        {voiceStatus && <div className="text-xs font-bold" style={{ color: 'var(--accent)' }}>{voiceStatus}</div>}
                    </div>
                )}

                {!isCreatingNew && editingCharacter && (
                    <CharacterLogPanel
                        character={editingCharacter}
                        onUpdateCharacter={() => {
                            // Call onSave to trigger list refresh
                            onSave();
                        }}
                    />
                )}

                <div className="flex gap-3 pt-4 border-t border-[var(--border-subtle)]">
                    <Button variant="primary" className="flex-1" onClick={onSave} disabled={isSaving || !characterForm.name.trim()}>
                        {isSaving ? 'Saving...' : isCreatingNew ? 'Create Character' : 'Save Changes'}
                    </Button>
                    {!isCreatingNew && (
                        <Button variant="danger" onClick={onDelete} disabled={isSaving}>
                            <Trash2 size={16} />
                            Delete
                        </Button>
                    )}
                </div>
            </div>
        </motion.div>
    );
}
