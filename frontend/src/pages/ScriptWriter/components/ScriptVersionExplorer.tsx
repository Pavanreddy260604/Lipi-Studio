import { useState } from 'react';
import { motion } from 'framer-motion';
import { GitBranch, GitCommit, GitCompare, Plus, Clock, Check, Download } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import type { VersionSnapshot } from '../types';

interface ScriptVersionExplorerProps {
    snapshots: VersionSnapshot[];
    branches: string[];
    activeBranch: string;
    onSaveSnapshot: (label: string, description?: string) => void;
    onSwitchBranch: (branch: string) => void;
    onCreateBranch: (name: string) => void;
    onCompare: (snapshotA: string, snapshotB: string) => void;
    onRestore: (snapshotId: string) => void;
    loading?: boolean;
}

export function ScriptVersionExplorer({
    snapshots,
    branches,
    activeBranch,
    onSaveSnapshot,
    onSwitchBranch,
    onCreateBranch,
    onCompare,
    onRestore,
    loading,
}: ScriptVersionExplorerProps) {
    const [saveLabel, setSaveLabel] = useState('');
    const [saveDesc, setSaveDesc] = useState('');
    const [showSave, setShowSave] = useState(false);
    const [newBranchName, setNewBranchName] = useState('');
    const [showNewBranch, setShowNewBranch] = useState(false);
    const [compareA, setCompareA] = useState<string | null>(null);
    const [compareB, setCompareB] = useState<string | null>(null);

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
                    <GitBranch size={11} />
                    Versions
                </span>
                <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" onClick={() => setShowSave(!showSave)}>
                        <GitCommit size={11} />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setShowNewBranch(!showNewBranch)}>
                        <GitBranch size={11} />
                    </Button>
                </div>
            </div>

            {showSave && (
                <div className="p-3 border-b border-subtle-8 bg-subtle-2 flex flex-col gap-2">
                    <input
                        autoFocus
                        value={saveLabel}
                        onChange={e => setSaveLabel(e.target.value)}
                        placeholder="Snapshot label..."
                        className="w-full px-2 py-1.5 text-[10px] bg-surface-page border border-subtle-8 rounded-lg text-text-primary placeholder:text-text-tertiary outline-none focus:border-accent/30"
                        onKeyDown={e => {
                            if (e.key === 'Enter' && saveLabel.trim()) {
                                onSaveSnapshot(saveLabel.trim(), saveDesc.trim() || undefined);
                                setSaveLabel('');
                                setSaveDesc('');
                                setShowSave(false);
                            }
                        }}
                    />
                    <input
                        value={saveDesc}
                        onChange={e => setSaveDesc(e.target.value)}
                        placeholder="Description (optional)..."
                        className="w-full px-2 py-1.5 text-[9px] bg-surface-page border border-subtle-8 rounded-lg text-text-secondary placeholder:text-text-tertiary outline-none focus:border-accent/30"
                    />
                    <Button variant="primary" size="sm" onClick={() => {
                        if (saveLabel.trim()) {
                            onSaveSnapshot(saveLabel.trim(), saveDesc.trim() || undefined);
                            setSaveLabel('');
                            setSaveDesc('');
                            setShowSave(false);
                        }
                    }}>
                        Save Snapshot
                    </Button>
                </div>
            )}

            {showNewBranch && (
                <div className="p-3 border-b border-subtle-8 bg-subtle-2 flex flex-col gap-2">
                    <input
                        autoFocus
                        value={newBranchName}
                        onChange={e => setNewBranchName(e.target.value)}
                        placeholder="Branch name..."
                        className="w-full px-2 py-1.5 text-[10px] bg-surface-page border border-subtle-8 rounded-lg text-text-primary placeholder:text-text-tertiary outline-none focus:border-accent/30"
                        onKeyDown={e => {
                            if (e.key === 'Enter' && newBranchName.trim()) {
                                onCreateBranch(newBranchName.trim());
                                setNewBranchName('');
                                setShowNewBranch(false);
                            }
                        }}
                    />
                    <Button variant="primary" size="sm" onClick={() => {
                        if (newBranchName.trim()) {
                            onCreateBranch(newBranchName.trim());
                            setNewBranchName('');
                            setShowNewBranch(false);
                        }
                    }}>
                        Create Branch
                    </Button>
                </div>
            )}

            <div className="flex-1 overflow-y-auto p-3 scrollbar-hide">
                {branches.length > 0 && (
                    <div className="mb-4">
                        <span className="text-[8px] font-bold text-text-muted uppercase tracking-widest block mb-2">Branches</span>
                        <div className="flex flex-wrap gap-1">
                            {branches.map(b => (
                                <button
                                    key={b}
                                    onClick={() => onSwitchBranch(b)}
                                    className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[8px] font-bold uppercase transition-[color,background-color,border-color] duration-120 active:scale-[0.95] focus-ring ${b === activeBranch ? 'bg-accent/10 text-accent border border-accent/20' : 'text-text-muted hover:text-text-secondary hover:bg-subtle-3 border border-transparent'}`}
                                >
                                    <GitBranch size={8} />
                                    {b}
                                    {b === activeBranch && <Check size={8} />}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                <span className="text-[8px] font-bold text-text-muted uppercase tracking-widest block mb-2">Snapshots</span>
                {snapshots.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 gap-2">
                        <GitCommit size={16} className="text-text-muted" />
                        <p className="text-[9px] text-text-muted text-center max-w-[200px] leading-relaxed">
                            No snapshots yet. Save one to track your script's history.
                        </p>
                    </div>
                ) : (
                    <div className="flex flex-col gap-2">
                        {snapshots.map((snap, i) => (
                            <motion.div
                                key={snap.id}
                                initial={{ opacity: 0, y: 6 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1], delay: i * 0.04 }}
                                className="bg-subtle-2 border border-subtle-8 rounded-xl p-2.5 flex flex-col gap-1.5"
                            >
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-bold text-text-primary truncate">{snap.label}</span>
                                    <span className="text-[7px] font-mono text-text-muted flex-shrink-0 ml-2">{snap.branch}</span>
                                </div>
                                {snap.description && (
                                    <span className="text-[8px] text-text-tertiary">{snap.description}</span>
                                )}
                                <div className="flex items-center gap-2 text-[8px] text-text-muted">
                                    <Clock size={8} />
                                    {new Date(snap.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                    <span className="ml-auto">{snap.sceneCount} scenes</span>
                                </div>
                                <div className="flex items-center gap-1 mt-1 pt-1.5 border-t border-subtle-8">
                                    <Button variant="ghost" size="sm" onClick={() => onRestore(snap.id)} className="!text-[7px] flex-1">
                                        <Download size={8} /> Restore
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => {
                                            if (!compareA) {
                                                setCompareA(snap.id);
                                            } else if (compareA && compareA !== snap.id) {
                                                setCompareB(snap.id);
                                                onCompare(compareA, snap.id);
                                                setCompareA(null);
                                                setCompareB(null);
                                            }
                                        }}
                                        className={`!text-[7px] flex-1 ${compareA === snap.id ? 'text-accent' : ''}`}
                                    >
                                        <GitCompare size={8} /> {compareA === snap.id ? 'Selected' : 'Compare'}
                                    </Button>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
