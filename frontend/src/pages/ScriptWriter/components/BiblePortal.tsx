import { useState, useRef, useEffect } from 'react';
import { Users, FileText, Globe, Save, Sparkles, X, Brain, Trash2, TrendingUp, Activity, EyeOff, ShieldCheck, Ban, Plus, Upload, Trash, BookOpen, Anchor, FileUp, Settings, Loader2, Pencil, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useDialog } from '../../../hooks/useDialog';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { Button } from '../../../components/ui/Button';
import { characterApi } from '../../../services/character.api';
import type { Bible } from '../../../services/project.api';
import type { Character } from '../../../services/character.api';
import type { CharacterForm } from '../types';

interface BiblePortalProps {
    activeProject: Bible | null;
    characters: Character[];
    onUpdateProject?: (id: string, updates: Partial<Bible>) => Promise<unknown> | void;
    onDeleteProject?: (id: string) => Promise<unknown> | void;
    characterForm?: CharacterForm;
    isSavingCharacter?: boolean;
    onCreateCharacter?: () => Promise<void>;
    onUpdateCharacter?: () => Promise<void>;
    onDeleteCharacter?: (id?: string) => Promise<void>;
    onCharacterSelect?: (id: string | null) => void;
    activeCharacterId?: string | null;
    onCharacterFormChange?: (field: keyof CharacterForm, value: string) => void;
    ingestingCharacterIds?: string[];
    voiceStatus?: string | null;
    onVoiceIngest?: (file: File, characterId?: string) => Promise<unknown>;
    isGeneratingCharacter?: boolean;
    onGenerateCharacterProfile?: (prompt: string, name?: string) => Promise<unknown> | void;
    onTriggerProactiveCasting?: () => void;
    isCastingScan?: boolean;
}

export function BiblePortal({
    activeProject,
    characters,
    onUpdateProject,
    onDeleteProject,
    characterForm,
    isSavingCharacter,
    onCreateCharacter,
    onUpdateCharacter,
    onDeleteCharacter,
    onCharacterSelect,
    activeCharacterId,
    onCharacterFormChange,
    ingestingCharacterIds = [],
    voiceStatus,
    onVoiceIngest,
    isGeneratingCharacter,
    onGenerateCharacterProfile,
    onTriggerProactiveCasting,
    isCastingScan = false,
}: BiblePortalProps) {
    const { dialog, showConfirm, closeDialog } = useDialog();
    const [titleDrafts, setTitleDrafts] = useState<Record<string, string>>({});
    const [isAddingCharacter, setIsAddingCharacter] = useState(false);
    const [uploadingCharacterId, setUploadingCharacterId] = useState<string | null>(null);
    const [aiPrompt, setAiPrompt] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [resources, setResources] = useState<any[]>([]);
    const [showAddResource, setShowAddResource] = useState(false);
    const [newResourceTitle, setNewResourceTitle] = useState('');
    const [newResourceContent, setNewResourceContent] = useState('');
    const [newResourceType, setNewResourceType] = useState<string>('synopsis');
    const resourceFileInputRef = useRef<HTMLInputElement>(null);

    if (!activeProject) return null;

    const title = titleDrafts[activeProject._id] ?? activeProject.title ?? '';

    useEffect(() => {
        if (activeProject?._id) {
            import('../../../services/project.api').then(({ projectApi }) => {
                projectApi.getResources(activeProject._id).then(setResources).catch(() => {});
            });
        }
    }, [activeProject?._id]);

    const handleAddTextResource = async () => {
        if (!newResourceContent.trim()) return;
        try {
            const { projectApi } = await import('../../../services/project.api');
            const result = await projectApi.addResource(activeProject._id, {
                title: newResourceTitle || 'Untitled Resource',
                content: newResourceContent,
                type: newResourceType
            });
            setResources(result);
            setNewResourceTitle('');
            setNewResourceContent('');
            setShowAddResource(false);
        } catch {}
    };

    const handleResourceFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
            const { projectApi } = await import('../../../services/project.api');
            const result = await projectApi.uploadResource(activeProject._id, file);
            setResources(result.data);
        } catch {}
        if (resourceFileInputRef.current) resourceFileInputRef.current.value = '';
    };

    const handleDeleteResource = async (resourceId: string) => {
        try {
            const { projectApi } = await import('../../../services/project.api');
            const result = await projectApi.deleteResource(activeProject._id, resourceId);
            setResources(result);
        } catch {}
    };

    const handleFileUploadRequest = (characterId: string) => {
        setUploadingCharacterId(characterId);
        fileInputRef.current?.click();
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        await onVoiceIngest?.(file, uploadingCharacterId || undefined);
        setUploadingCharacterId(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    return (
        <div className="flex-1 w-full overflow-y-auto p-6 sm:p-8 scrollbar-hide bg-surface">
            <input type="file" ref={fileInputRef} className="hidden" accept=".txt,.pdf" onChange={handleFileChange} />
            <input type="file" ref={resourceFileInputRef} className="hidden" accept=".pdf,.docx,.txt" onChange={handleResourceFileChange} />

            <div className="w-full max-w-[1600px] mx-auto flex flex-col gap-8">

                {/* Minimal Header */}
                <header className="flex items-center justify-between pb-4 border-b border-subtle-8">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center">
                            <BookOpen size={14} className="text-accent" />
                        </div>
                        <div>
                            <h1 className="text-lg font-bold text-heading tracking-tight">{activeProject.title}</h1>
                            <p className="text-[10px] text-text-tertiary font-medium">
                                {activeProject.genre || 'Drama'} &middot; {activeProject.tone || 'Cinematic'}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {onTriggerProactiveCasting && (
                            <Button
                                variant="secondary"
                                size="sm"
                                onClick={onTriggerProactiveCasting}
                                disabled={isCastingScan}
                                className="text-[10px] uppercase font-bold flex items-center gap-1.5"
                            >
                                {isCastingScan ? (
                                    <Loader2 size={11} className="animate-spin" />
                                ) : (
                                    <Search size={11} className="text-accent" />
                                )}
                                <span>{isCastingScan ? 'Scanning...' : 'Scan Resources'}</span>
                            </Button>
                        )}
                        <Button
                            variant="primary"
                            size="sm"
                            onClick={() => {
                                onCharacterSelect?.(null);
                                setIsAddingCharacter(true);
                            }}
                            className="text-[10px] uppercase font-bold flex items-center gap-1.5"
                        >
                            <Plus size={11} />
                            <span>Add Character</span>
                        </Button>
                    </div>
                </header>

                <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                    {/* Left Column: Logline & Resources */}
                    <div className="lg:col-span-1 flex flex-col gap-6">
                        {/* Logline */}
                        <section className="bg-surface-elevated border border-subtle-8 rounded-xl p-4">
                            <p className="text-xs text-text-secondary leading-relaxed italic font-serif select-all">
                                &ldquo;{activeProject.logline || 'No logline set for this project.'}&rdquo;
                            </p>
                        </section>

                        {/* Story Resources */}
                        <section className="flex flex-col gap-3">
                            <div className="flex items-center justify-between">
                                <h3 className="text-[10px] font-bold text-text-tertiary uppercase tracking-wider flex items-center gap-1.5">
                                    <Anchor size={11} className="text-accent" />
                                    Sources
                                </h3>
                                <div className="flex gap-1">
                                    <button
                                        onClick={() => setShowAddResource(!showAddResource)}
                                        className="text-[9px] font-bold uppercase tracking-wider text-accent border border-subtle-10 hover:bg-subtle-2 rounded-lg px-2 py-1 transition-all focus-ring flex items-center gap-1"
                                    >
                                        <Plus size={9} /> Text
                                    </button>
                                    <button
                                        onClick={() => resourceFileInputRef.current?.click()}
                                        className="text-[9px] font-bold uppercase tracking-wider text-accent border border-subtle-10 hover:bg-subtle-2 rounded-lg px-2 py-1 transition-all focus-ring flex items-center gap-1"
                                    >
                                        <FileUp size={9} /> File
                                    </button>
                                </div>
                            </div>

                            <AnimatePresence>
                                {showAddResource && (
                                    <motion.div
                                        initial={{ opacity: 0, y: -6 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -6 }}
                                        className="bg-surface-elevated border border-accent/20 rounded-xl p-3 flex flex-col gap-2.5"
                                    >
                                        <input
                                            className="w-full px-2.5 py-1.5 text-[11px] bg-surface border border-subtle-8 rounded-lg text-text-primary placeholder:text-text-tertiary outline-none focus:border-accent/40"
                                            placeholder="Title..."
                                            value={newResourceTitle}
                                            onChange={(e) => setNewResourceTitle(e.target.value)}
                                        />
                                        <select
                                            className="w-full px-2.5 py-1.5 text-[11px] bg-surface border border-subtle-8 rounded-lg text-text-primary outline-none focus:border-accent/40 cursor-pointer"
                                            value={newResourceType}
                                            onChange={(e) => setNewResourceType(e.target.value)}
                                        >
                                            <option value="synopsis">Synopsis</option>
                                            <option value="novel_excerpt">Novel Excerpt</option>
                                            <option value="treatment">Treatment</option>
                                            <option value="reference">Reference</option>
                                            <option value="notes">Notes</option>
                                            <option value="other">Other</option>
                                        </select>
                                        <textarea
                                            className="w-full px-2.5 py-1.5 text-[11px] bg-surface border border-subtle-8 rounded-lg text-text-primary placeholder:text-text-tertiary outline-none focus:border-accent/40 resize-none font-mono"
                                            rows={4}
                                            placeholder="Paste source material..."
                                            value={newResourceContent}
                                            onChange={(e) => setNewResourceContent(e.target.value)}
                                        />
                                        <div className="flex justify-end gap-1.5">
                                            <Button variant="secondary" size="sm" onClick={() => setShowAddResource(false)}>Cancel</Button>
                                            <Button variant="primary" size="sm" disabled={!newResourceContent.trim()} onClick={handleAddTextResource}>Save</Button>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            <div className="flex flex-col gap-2 max-h-[300px] overflow-y-auto pr-1">
                                {resources.map((res) => (
                                    <div key={res._id} className="bg-surface-elevated border border-subtle-8 rounded-xl p-3 flex flex-col gap-1.5 group hover:border-accent/30 transition-all relative">
                                        <button
                                            onClick={() => handleDeleteResource(res._id!)}
                                            className="absolute top-2 right-2 p-1 rounded-md text-text-tertiary hover:text-status-error hover:bg-subtle-3 opacity-0 group-hover:opacity-100 transition-opacity focus-ring"
                                            title="Delete"
                                        >
                                            <Trash2 size={10} />
                                        </button>
                                        <h4 className="text-[11px] font-bold text-text-primary truncate pr-5">{res.title}</h4>
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="text-[7px] font-bold uppercase tracking-wider text-accent bg-accent/5 px-1.5 py-0.5 border border-accent/10 rounded">{res.type}</span>
                                            {res.contentLength && (
                                                <span className="text-[8px] text-text-tertiary font-mono">{Math.round(res.contentLength / 1000)}K chars</span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                                {resources.length === 0 && !showAddResource && (
                                    <div className="text-center py-8 bg-surface-elevated border border-dashed border-subtle-8 rounded-xl">
                                        <p className="text-[10px] text-text-tertiary max-w-[180px] mx-auto leading-relaxed">
                                            No sources uploaded. Add text or PDFs to anchor AI generations.
                                        </p>
                                    </div>
                                )}
                            </div>
                        </section>
                    </div>

                    {/* Right Column: Cast Directory */}
                    <div className="lg:col-span-3 flex flex-col gap-6">
                        {/* Character Registration Form */}
                        <AnimatePresence>
                            {isAddingCharacter && characterForm && (
                                <motion.div
                                    initial={{ opacity: 0, y: -6, scale: 0.98 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, y: -6, scale: 0.98 }}
                                    transition={{ duration: 0.15 }}
                                    className="bg-surface-elevated border border-accent/20 rounded-xl p-5 flex flex-col gap-4"
                                >
                                    <div className="flex justify-between items-center pb-3 border-b border-subtle-8">
                                        <div className="flex items-center gap-2 text-accent">
                                            <Sparkles size={14} />
                                            <h3 className="text-[11px] font-bold uppercase tracking-wider">
                                                {activeCharacterId ? 'Edit Character' : 'Register Character'}
                                            </h3>
                                        </div>
                                        <button
                                            onClick={() => { setIsAddingCharacter(false); onCharacterSelect?.(null); }}
                                            className="p-1 hover:bg-subtle-3 rounded-lg transition-colors focus-ring"
                                        >
                                            <X size={14} className="text-text-tertiary" />
                                        </button>
                                    </div>

                                    {!activeCharacterId && (
                                        <div className="bg-subtle-2 border border-subtle-8 rounded-xl p-3 flex flex-col gap-2.5">
                                            <div className="flex items-center gap-1.5 text-[10px] font-bold text-text-secondary uppercase tracking-wider">
                                                <Sparkles size={12} className="text-accent" />
                                                <span>AI Character Architect</span>
                                            </div>
                                            <p className="text-[10px] text-text-tertiary">Describe a character and AI will generate a full profile.</p>
                                            <div className="flex gap-2">
                                                <input
                                                    className="flex-1 px-2.5 py-1.5 text-[11px] bg-surface border border-subtle-8 rounded-lg text-text-primary placeholder:text-text-tertiary outline-none focus:border-accent/40"
                                                    placeholder="e.g. A weary noir detective seeking redemption..."
                                                    value={aiPrompt}
                                                    onChange={(e) => setAiPrompt(e.target.value)}
                                                />
                                                <Button
                                                    variant="secondary"
                                                    size="sm"
                                                    disabled={isGeneratingCharacter || !aiPrompt.trim()}
                                                    onClick={async () => {
                                                        if (onGenerateCharacterProfile) {
                                                            await onGenerateCharacterProfile(aiPrompt, characterForm?.name);
                                                        }
                                                    }}
                                                >
                                                    {isGeneratingCharacter ? 'Generating...' : 'Brainstorm'}
                                                </Button>
                                            </div>
                                        </div>
                                    )}

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <div className="flex flex-col gap-2">
                                            <label className="text-[9px] font-bold text-text-tertiary uppercase tracking-wider">Name</label>
                                            <input
                                                className="w-full px-3 py-2 text-[11px] bg-surface border border-subtle-8 rounded-lg text-text-primary placeholder:text-text-tertiary outline-none focus:border-accent/40"
                                                value={characterForm.name}
                                                onChange={(e) => onCharacterFormChange?.('name', e.target.value)}
                                                placeholder="Character name"
                                            />
                                            <label className="text-[9px] font-bold text-text-tertiary uppercase tracking-wider">Role</label>
                                            <select
                                                className="w-full px-3 py-2 text-[11px] bg-surface border border-subtle-8 rounded-lg text-text-primary outline-none focus:border-accent/40 cursor-pointer"
                                                value={characterForm.role}
                                                onChange={(e) => onCharacterFormChange?.('role', e.target.value)}
                                            >
                                                <option value="protagonist">Protagonist</option>
                                                <option value="antagonist">Antagonist</option>
                                                <option value="supporting">Supporting</option>
                                                <option value="cameo">Cameo</option>
                                            </select>
                                        </div>
                                        <div className="flex flex-col gap-2">
                                            <label className="text-[9px] font-bold text-text-tertiary uppercase tracking-wider">Traits</label>
                                            <input
                                                className="w-full px-3 py-2 text-[11px] bg-surface border border-subtle-8 rounded-lg text-text-primary placeholder:text-text-tertiary outline-none focus:border-accent/40"
                                                value={characterForm.traits}
                                                onChange={(e) => onCharacterFormChange?.('traits', e.target.value)}
                                                placeholder="Brave, Cunning, Impulsive..."
                                            />
                                            <label className="text-[9px] font-bold text-text-tertiary uppercase tracking-wider">Motivation</label>
                                            <textarea
                                                className="w-full px-3 py-2 text-[11px] bg-surface border border-subtle-8 rounded-lg text-text-primary placeholder:text-text-tertiary outline-none focus:border-accent/40 resize-none font-serif"
                                                rows={2}
                                                value={characterForm.motivation}
                                                onChange={(e) => onCharacterFormChange?.('motivation', e.target.value)}
                                                placeholder="What drives this character?"
                                            />
                                        </div>
                                    </div>

                                    <div className="pt-3 flex justify-end gap-2 border-t border-subtle-8">
                                        <Button variant="secondary" size="sm" onClick={() => { setIsAddingCharacter(false); onCharacterSelect?.(null); }}>Cancel</Button>
                                        <Button
                                            variant="primary"
                                            size="sm"
                                            disabled={isSavingCharacter || !characterForm.name.trim()}
                                            onClick={async () => {
                                                if (activeCharacterId) {
                                                    await onUpdateCharacter?.();
                                                } else {
                                                    await onCreateCharacter?.();
                                                }
                                                setIsAddingCharacter(false);
                                                onCharacterSelect?.(null);
                                            }}
                                        >
                                            {isSavingCharacter ? 'Saving...' : (activeCharacterId ? 'Update' : 'Register')}
                                        </Button>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Cast List */}
                        <div className="flex flex-col gap-3">
                            {characters.map(char => (
                                <motion.div
                                    key={char._id}
                                    initial={{ opacity: 0, y: 6 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="bg-surface-elevated border border-subtle-8 rounded-xl p-4 hover:border-accent/20 transition-all"
                                >
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="flex items-start gap-3 flex-1 min-w-0">
                                            <div className="w-9 h-9 rounded-lg bg-accent/8 border border-accent/15 flex items-center justify-center flex-shrink-0 mt-0.5">
                                                <span className="text-[11px] font-bold text-accent uppercase">
                                                    {char.name ? char.name.charAt(0) : '?'}
                                                </span>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <h4 className="text-sm font-bold text-text-primary truncate">{char.name}</h4>
                                                    <span className="text-[8px] font-bold uppercase tracking-wider text-accent bg-accent/5 px-2 py-0.5 border border-accent/10 rounded flex-shrink-0">
                                                        {char.role}
                                                    </span>
                                                </div>
                                                <p className="text-[11px] text-text-secondary leading-relaxed line-clamp-2 font-serif">
                                                    {char.motivation || 'No motivation defined yet.'}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-1 flex-shrink-0">
                                            <button
                                                onClick={() => { onCharacterSelect?.(char._id); setIsAddingCharacter(true); }}
                                                className="p-1.5 rounded-lg text-text-tertiary hover:text-accent hover:bg-subtle-3 transition-colors focus-ring"
                                                title="Edit character"
                                            >
                                                <Pencil size={12} />
                                            </button>
                                            <button
                                                onClick={() => {
                                                    showConfirm(
                                                        'Delete Character',
                                                        `Are you sure you want to delete "${char.name}"? This cannot be undone.`,
                                                        () => onDeleteCharacter?.(char._id)
                                                    );
                                                }}
                                                className="p-1.5 rounded-lg text-text-tertiary hover:text-status-error hover:bg-subtle-3 transition-colors focus-ring"
                                                title="Delete character"
                                            >
                                                <X size={12} />
                                            </button>
                                        </div>
                                    </div>

                                    <div className="mt-3 pt-3 border-t border-subtle-8 flex items-center justify-between">
                                        <span className="text-[9px] font-bold text-text-tertiary uppercase tracking-wider">Voice &amp; Knowledge</span>
                                        <div className="flex items-center gap-2">
                                            {ingestingCharacterIds.includes(char._id) && (
                                                <span className="text-[9px] font-bold uppercase tracking-widest text-accent flex items-center gap-1">
                                                    <Loader2 size={9} className="animate-spin" />
                                                    Ingesting
                                                </span>
                                            )}
                                            {voiceStatus && uploadingCharacterId === char._id && !ingestingCharacterIds.includes(char._id) && (
                                                <span className="text-[9px] text-status-success font-bold uppercase tracking-wider">{voiceStatus}</span>
                                            )}
                                            <Button variant="secondary" size="sm" disabled={ingestingCharacterIds.includes(char._id)} className="text-[9px] uppercase tracking-wider font-bold py-1 h-7">
                                                Sources
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => handleFileUploadRequest(char._id)}
                                                disabled={ingestingCharacterIds.includes(char._id)}
                                                className="text-[9px] uppercase tracking-wider font-bold py-1 h-7 text-accent border border-accent/10 hover:bg-accent/5 rounded-lg px-2.5"
                                            >
                                                + Voice
                                            </Button>
                                        </div>
                                    </div>
                                </motion.div>
                            ))}

                            {characters.length === 0 && (
                                <div className="py-16 text-center bg-surface-elevated border border-dashed border-subtle-8 rounded-xl">
                                    <Users size={28} className="mx-auto text-text-muted mb-3" />
                                    <p className="text-xs text-text-tertiary font-medium">No characters registered yet.</p>
                                    <Button
                                        variant="primary"
                                        size="sm"
                                        onClick={() => {
                                            onCharacterSelect?.(null);
                                            setIsAddingCharacter(true);
                                        }}
                                        className="mt-4"
                                    >
                                        <Plus size={12} className="mr-1" />
                                        Add Your First Character
                                    </Button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Bottom: Settings */}
                <section className="pt-6 border-t border-subtle-8 mt-2">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="md:col-span-2 bg-surface-elevated border border-subtle-8 rounded-xl p-4 flex flex-col gap-3">
                            <label className="text-[9px] font-bold text-text-tertiary uppercase tracking-wider">Project Title</label>
                            <div className="flex gap-2">
                                <input
                                    className="flex-1 px-3 py-1.5 text-sm bg-surface border border-subtle-8 rounded-lg text-text-primary placeholder:text-text-tertiary outline-none focus:border-accent/40 font-bold"
                                    value={title}
                                    onChange={(e) => setTitleDrafts(prev => ({ ...prev, [activeProject._id]: e.target.value }))}
                                    placeholder="Project title"
                                />
                                <Button variant="secondary" size="sm" onClick={() => onUpdateProject?.(activeProject._id, { title })}>
                                    Update
                                </Button>
                            </div>
                        </div>

                        <div className="bg-surface-elevated border border-status-error/15 rounded-xl p-4 flex flex-col justify-between gap-3">
                            <div>
                                <h4 className="text-status-error text-[10px] font-bold uppercase tracking-wider mb-1">Danger Zone</h4>
                                <p className="text-text-tertiary text-[10px] leading-relaxed">Permanently delete this project and all its data.</p>
                            </div>
                            <Button
                                variant="danger"
                                size="sm"
                                onClick={() => {
                                    showConfirm(
                                        'Delete Project',
                                        `Are you sure you want to delete "${activeProject.title}"? All scenes, characters, and resources will be permanently lost.`,
                                        () => onDeleteProject?.(activeProject._id)
                                    );
                                }}
                            >
                                Delete Project
                            </Button>
                        </div>
                    </div>
                </section>
            </div>

            <ConfirmDialog
                isOpen={dialog.isOpen && dialog.type === 'confirm'}
                onClose={closeDialog}
                onConfirm={dialog.onConfirm || (() => {})}
                title={dialog.title}
                description={dialog.description}
                variant="danger"
            />
        </div>
    );
}
