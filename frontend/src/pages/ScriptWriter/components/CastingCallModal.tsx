import React, { useState, useEffect } from 'react';
import { ShieldAlert, UserPlus, X, Check, MapPin, Users, Ban, Sparkles, ChevronDown, ChevronUp, UserCheck, UserX } from 'lucide-react';
import { characterApi } from '../../../services/character.api';

export interface ProposedCharacter {
    name: string;
    role: 'protagonist' | 'antagonist' | 'supporting' | 'minor';
    traits: string[];
    motivation: string;
    voiceDescription: string;
    sampleLines: string[];
}

interface CastingCallModalProps {
    isOpen: boolean;
    proposedCharacters: ProposedCharacter[];
    onClose: () => void;
    onApprove: (approved: ProposedCharacter[], ignoredNames: string[], locations: string[], extras: string[]) => void;
    bibleId: string;
}

type Classification = 'none' | 'location' | 'extra' | 'ignore';

export function CastingCallModal({
    isOpen,
    proposedCharacters,
    onClose,
    onApprove,
    bibleId
}: CastingCallModalProps) {
    const [characters, setCharacters] = useState<ProposedCharacter[]>([]);
    const [selections, setSelections] = useState<Record<number, boolean>>({});
    const [classifications, setClassifications] = useState<Record<number, Classification>>({});
    const [savingIgnored, setSavingIgnored] = useState<Record<number, boolean>>({});
    const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

    useEffect(() => {
        if (isOpen) {
            setCharacters(proposedCharacters);
            const initialSels: Record<number, boolean> = {};
            const initialClass: Record<number, Classification> = {};
            proposedCharacters.forEach((char, idx) => {
                initialSels[idx] = true; // Default to approved
                initialClass[idx] = 'none';
            });
            setSelections(initialSels);
            setClassifications(initialClass);
            setExpandedIndex(null); // Reset expansions
        }
    }, [isOpen, proposedCharacters]);

    if (!isOpen) return null;

    const handleApprove = (idx: number) => {
        setSelections((prev) => ({ ...prev, [idx]: true }));
        setClassifications((prev) => ({ ...prev, [idx]: 'none' }));
    };

    const handleDecline = (idx: number) => {
        setSelections((prev) => ({ ...prev, [idx]: false }));
        setClassifications((prev) => ({ ...prev, [idx]: 'ignore' })); // Default to ignore/filter
        handleClassificationChange(idx, 'ignore');
    };

    const handleClassificationChange = async (idx: number, type: Classification) => {
        setClassifications((prev) => ({
            ...prev,
            [idx]: type
        }));

        const char = characters[idx];
        if (type === 'ignore' && bibleId && char) {
            setSavingIgnored((prev) => ({ ...prev, [idx]: true }));
            try {
                await characterApi.ignoreCharacter(bibleId, char.name);
                console.log(`[RLHF] Excluded noise character name from Show Bible: ${char.name}`);
            } catch (err) {
                console.error('[RLHF] Failed to save ignore constraint:', err);
            } finally {
                setSavingIgnored((prev) => ({ ...prev, [idx]: false }));
            }
        }
    };

    const handleFieldChange = (index: number, field: keyof ProposedCharacter, value: any) => {
        setCharacters((prev) => {
            const next = [...prev];
            next[index] = { ...next[index], [field]: value };
            return next;
        });
    };

    const handleSubmit = () => {
        const approved = characters.filter((c, idx) => selections[idx]);
        const ignoredNames: string[] = [];
        const locations: string[] = [];
        const extras: string[] = [];

        characters.forEach((c, idx) => {
            if (!selections[idx]) {
                const type = classifications[idx] || 'none';
                if (type === 'ignore') {
                    ignoredNames.push(c.name);
                } else if (type === 'location') {
                    locations.push(c.name);
                } else if (type === 'extra') {
                    extras.push(c.name);
                }
            }
        });

        onApprove(approved, ignoredNames, locations, extras);
    };

    const toggleExpand = (idx: number) => {
        setExpandedIndex((prev) => (prev === idx ? null : idx));
    };

    return (
        <div className="fixed inset-0 z-[999] flex items-center justify-center bg-surface-page/98 p-4 overflow-y-auto">
            <div className="w-full max-w-4xl bg-surface-elevated border border-subtle-8 rounded-[2rem] p-8 flex flex-col max-h-[90vh]">
                
                {/* Header */}
                <div className="flex items-start justify-between border-b border-subtle-8 pb-6 mb-6">
                    <div className="flex items-center gap-4">
                        <div className="p-3.5 bg-accent/10 border border-accent/25 rounded-2xl text-accent">
                            <UserPlus size={22} />
                        </div>
                        <div>
                            <h3 className="text-xl font-black font-serif text-heading tracking-tight italic uppercase">
                                PROACTIVE CASTING STUDIO
                            </h3>
                            <p className="text-xs text-text-tertiary mt-1 font-medium max-w-lg leading-relaxed">
                                Our Casting Agent audited your prompt and source material. Actively approve discovered cast profiles, decline noise names, or customize traits as needed.
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2.5 rounded-xl text-text-tertiary focus-ring"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Proposed List */}
                <div className="space-y-4 overflow-y-auto flex-1 pr-2 scrollbar-thin">
                    {characters.map((char, idx) => {
                        const approved = selections[idx];
                        const classification = classifications[idx] || 'none';
                        const isSaving = savingIgnored[idx];
                        const isExpanded = expandedIndex === idx;

                        return (
                            <div
                                key={idx}
                                className={`border rounded-[1.5rem] p-5 ${
                                    approved
                                        ? 'bg-subtle-2 border-subtle-8 shadow-sm'
                                        : 'bg-subtle-1 border-subtle-5 opacity-75'
                                }`}
                            >
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                    {/* Left: Check status + Name Input */}
                                    <div className="flex items-center gap-3">
                                        <div className="flex items-center gap-2">
                                            {/* Approve Button */}
                                            <button
                                                type="button"
                                                onClick={() => handleApprove(idx)}
                                                title="Approve Cast Member"
                                                className={`flex items-center justify-center p-2 rounded-xl border focus-ring ${
                                                    approved
                                                        ? 'bg-accent/15 border-accent/40 text-accent font-bold'
                                                        : 'bg-subtle-3 border-subtle-8 text-text-muted'
                                                }`}
                                            >
                                                <UserCheck size={14} />
                                                <span className="text-[9px] font-black uppercase tracking-wider ml-1.5 hidden sm:inline">Approve</span>
                                            </button>

                                            {/* Decline Button */}
                                            <button
                                                type="button"
                                                onClick={() => handleDecline(idx)}
                                                title="Decline / Classify Name"
                                                className={`flex items-center justify-center p-2 rounded-xl border focus-ring ${
                                                    !approved
                                                        ? 'bg-status-error/15 border-status-error/40 text-status-error font-bold'
                                                        : 'bg-subtle-3 border-subtle-8 text-text-muted'
                                                }`}
                                            >
                                                <UserX size={14} />
                                                <span className="text-[9px] font-black uppercase tracking-wider ml-1.5 hidden sm:inline">Decline</span>
                                            </button>
                                        </div>

                                        <input
                                            type="text"
                                            value={char.name}
                                            onChange={(e) => handleFieldChange(idx, 'name', e.target.value.toUpperCase())}
                                            className="bg-transparent border-b border-transparent hover:border-subtle-8 focus:border-accent text-sm font-black font-serif uppercase text-heading focus:outline-none px-1 py-0.5 w-[160px] ml-2"
                                            disabled={!approved}
                                            placeholder="CHARACTER NAME"
                                        />

                                        {approved && (
                                            <span className="text-[9px] font-black uppercase bg-accent/10 text-accent px-2 py-0.5 rounded-md tracking-wider">
                                                Cast Discovered
                                            </span>
                                        )}
                                    </div>

                                    {/* Right: Actions / Configurations */}
                                    <div>
                                        {approved ? (
                                            <div className="flex items-center gap-3">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[9px] font-black text-muted uppercase tracking-wider">Role:</span>
                                                    <select
                                                        value={char.role}
                                                        onChange={(e) => handleFieldChange(idx, 'role', e.target.value)}
                                                        className="bg-subtle-3 border border-subtle-8 rounded-xl px-2.5 py-1.5 text-[9px] text-text-secondary font-black uppercase tracking-wider focus:outline-none focus-ring"
                                                    >
                                                        <option value="protagonist">Protagonist</option>
                                                        <option value="antagonist">Antagonist</option>
                                                        <option value="supporting">Supporting</option>
                                                        <option value="minor">Minor</option>
                                                    </select>
                                                </div>

                                                {/* Expand/Collapse details button */}
                                                <button
                                                    type="button"
                                                    onClick={() => toggleExpand(idx)}
                                                    className="flex items-center gap-1 px-3 py-1.5 rounded-xl border border-subtle-8 bg-subtle-3 text-text-secondary text-[9px] font-black uppercase tracking-wider focus-ring"
                                                >
                                                    {isExpanded ? (
                                                        <>
                                                            Hide Details <ChevronUp size={11} className="ml-1" />
                                                        </>
                                                    ) : (
                                                        <>
                                                            Customize Profile <ChevronDown size={11} className="ml-1" />
                                                        </>
                                                    )}
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span className="text-[8px] font-black text-muted uppercase tracking-wider mr-1">Classify Noise Name:</span>
                                                <button
                                                    type="button"
                                                    onClick={() => handleClassificationChange(idx, 'location')}
                                                    className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl border text-[8px] font-black uppercase tracking-wider focus-ring ${
                                                        classification === 'location'
                                                            ? 'bg-status-warning/10 border-status-warning/30 text-status-warning'
                                                            : 'bg-subtle-3 border-subtle-8 text-text-muted'
                                                    }`}
                                                >
                                                    <MapPin size={10} /> Location / Setting
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleClassificationChange(idx, 'extra')}
                                                    className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl border text-[8px] font-black uppercase tracking-wider focus-ring ${
                                                        classification === 'extra'
                                                            ? 'bg-accent/10 border-accent/30 text-accent'
                                                            : 'bg-subtle-3 border-subtle-8 text-text-muted'
                                                    }`}
                                                >
                                                    <Users size={10} /> Background Extra
                                                </button>
                                                <button
                                                    type="button"
                                                    disabled={isSaving}
                                                    onClick={() => handleClassificationChange(idx, 'ignore')}
                                                    className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl border text-[8px] font-black uppercase tracking-wider focus-ring ${
                                                        classification === 'ignore'
                                                            ? 'bg-status-error/10 border-status-error/30 text-status-error'
                                                            : 'bg-subtle-3 border-subtle-8 text-text-muted'
                                                    }`}
                                                >
                                                    <Ban size={10} /> {isSaving ? 'Filtering...' : 'Filter/Ignore'}
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Expanded profile editing */}
                                {approved && isExpanded && (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-0 mt-4 pt-4 border-t border-subtle-5">
                                        <div className="space-y-3">
                                            <div>
                                                <label className="block text-[8px] font-black text-muted uppercase tracking-widest mb-1.5">Vivid Persona Traits (Comma Separated)</label>
                                                <input
                                                    type="text"
                                                    value={char.traits ? char.traits.join(', ') : ''}
                                                    onChange={(e) => handleFieldChange(idx, 'traits', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                                                    className="w-full bg-subtle-3 border border-subtle-8 rounded-xl px-3 py-2 text-xs font-semibold text-heading focus:outline-none focus-ring"
                                                    placeholder="Highly strategic, Unpredictable, Secretive"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[8px] font-black text-muted uppercase tracking-widest mb-1.5">Immediate Scene Goal / Motivation</label>
                                                <textarea
                                                    value={char.motivation || ''}
                                                    onChange={(e) => handleFieldChange(idx, 'motivation', e.target.value)}
                                                    rows={2}
                                                    className="w-full bg-subtle-3 border border-subtle-8 rounded-xl px-3 py-2 text-xs font-semibold text-heading focus:outline-none focus-ring font-serif italic"
                                                    placeholder="To retrieve the hidden manuscript at all costs."
                                                />
                                            </div>
                                        </div>

                                        <div className="space-y-3">
                                            <div>
                                                <label className="block text-[8px] font-black text-muted uppercase tracking-widest mb-1.5">Vocal Speech Profile & Accent</label>
                                                <input
                                                    type="text"
                                                    value={char.voiceDescription || ''}
                                                    onChange={(e) => handleFieldChange(idx, 'voiceDescription', e.target.value)}
                                                    className="w-full bg-subtle-3 border border-subtle-8 rounded-xl px-3 py-2 text-xs font-semibold text-heading focus:outline-none focus-ring"
                                                    placeholder="Deep, resonant, uses archaic theatrical vocabulary"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[8px] font-black text-muted uppercase tracking-widest mb-1.5">Casting Call Audition Dialogue Samples (One per line)</label>
                                                <textarea
                                                    value={char.sampleLines ? char.sampleLines.join('\n') : ''}
                                                    onChange={(e) => handleFieldChange(idx, 'sampleLines', e.target.value.split('\n').filter(Boolean))}
                                                    rows={2}
                                                    className="w-full bg-subtle-3 border border-subtle-8 rounded-xl px-3 py-2 text-xs font-serif text-heading focus:outline-none focus-ring leading-relaxed"
                                                    placeholder="I won't trade our lineage for silver, Marcus.&#10;Speak your mind, or let the shadow take you."
                                                />
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}

                    {characters.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-16 text-text-tertiary bg-subtle-2 border border-dashed border-subtle-8 rounded-[1.5rem]">
                            <Users size={32} className="opacity-30 mb-3" />
                            <p className="text-xs font-black uppercase tracking-widest text-muted">No proactive characters to audit</p>
                            <p className="text-[10px] text-text-tertiary mt-1">Casting Auditor determined that all characters exist in Show Bible.</p>
                        </div>
                    )}
                </div>

                {/* Footer Controls */}
                <div className="flex items-center justify-between border-t border-subtle-8 pt-6 mt-6">
                    <div className="flex items-center gap-2 text-text-tertiary">
                        <ShieldAlert size={14} className="text-accent" />
                        <span className="text-[9px] font-black uppercase tracking-widest">
                            Ensemble casting engine • RLHF active
                        </span>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest text-text-secondary focus-ring"
                        >
                            Abort Draft
                        </button>
                        <button
                            type="button"
                            onClick={() => onApprove([], proposedCharacters.map(c => c.name), [], [])}
                            className="px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest text-accent focus-ring"
                        >
                            Skip & Proceed
                        </button>
                        <button
                            type="button"
                            onClick={handleSubmit}
                            className="flex items-center gap-2 px-8 py-3 bg-accent text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-accent/15 focus-ring"
                        >
                            <Sparkles size={12} /> Proceed with Cast
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
}
