import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Command } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { STUDIO_COMMANDS, type StudioCommand, type CommandGroup } from '../types';

interface CommandPaletteProps {
    isOpen: boolean;
    onClose: () => void;
    onCommand: (command: StudioCommand) => void;
    hasActiveScene: boolean;
    hasSelection: boolean;
    isAiBusy?: boolean;
}

const GROUP_LABELS: Record<CommandGroup, string> = {
    write: 'Writing',
    edit: 'Editing',
    analyze: 'Analysis',
    structure: 'Structure',
    character: 'Characters',
    version: 'Version Control',
    export: 'Export',
    system: 'System & Views',
};

export function CommandPalette({ isOpen, onClose, onCommand, hasActiveScene, hasSelection, isAiBusy }: CommandPaletteProps) {
    const [query, setQuery] = useState('');
    const [selectedIndex, setSelectedIndex] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLDivElement>(null);

    const filtered = useMemo(() => {
        const q = query.toLowerCase().trim();
        let commands = STUDIO_COMMANDS;

        if (!hasActiveScene) {
            commands = commands.filter(c => !c.requiresScene);
        }
        if (!hasSelection) {
            commands = commands.filter(c => !c.requiresSelection);
        }

        if (!q) return commands;

        return commands.filter(c =>
            c.label.toLowerCase().includes(q) ||
            c.description.toLowerCase().includes(q) ||
            c.group.toLowerCase().includes(q) ||
            c.action.toLowerCase().includes(q)
        );
    }, [query, hasActiveScene, hasSelection]);

    useEffect(() => {
        if (isOpen) {
            setQuery('');
            setSelectedIndex(0);
            setTimeout(() => inputRef.current?.focus(), 50);
        }
    }, [isOpen]);

    useEffect(() => {
        setSelectedIndex(0);
    }, [query]);

    const executeCommand = useCallback((command: StudioCommand) => {
        if (isAiBusy) return;
        onCommand(command);
        onClose();
    }, [onCommand, onClose, isAiBusy]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Escape') {
            onClose();
            return;
        }
        if (isAiBusy) return; // Prevent navigation or select while busy
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSelectedIndex(i => Math.min(i + 1, filtered.length - 1));
            return;
        }
        if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSelectedIndex(i => Math.max(i - 1, 0));
            return;
        }
        if (e.key === 'Enter') {
            e.preventDefault();
            if (filtered[selectedIndex]) {
                executeCommand(filtered[selectedIndex]);
            }
            return;
        }
    };

    const grouped = useMemo(() => {
        const groups: Record<string, StudioCommand[]> = {};
        filtered.forEach(c => {
            if (!groups[c.group]) groups[c.group] = [];
            groups[c.group].push(c);
        });
        return groups;
    }, [filtered]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]" onClick={onClose}>
            <div className="fixed inset-0 bg-[var(--overlay)]" />
            <div
                className="relative w-full max-w-lg bg-surface-elevated border border-subtle-8 rounded-2xl shadow-2xl overflow-hidden animate-fade-in"
                onClick={e => e.stopPropagation()}
                style={{ borderRadius: 'var(--radius-3xl)' }}
            >
                {isAiBusy && (
                    <div className="bg-accent/5 border-b border-subtle-8 px-4 py-2 flex items-center gap-2 text-[10px] font-semibold text-accent animate-pulse">
                        <span className="w-1.5 h-1.5 rounded-full bg-accent animate-ping" />
                        AI is actively working. Command executions are temporarily locked.
                    </div>
                )}
                <div className="flex items-center gap-3 px-4 py-3 border-b border-subtle-8">
                    <Command size={14} className="text-text-muted flex-shrink-0" />
                    <input
                        ref={inputRef}
                        type="text"
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        onKeyDown={handleKeyDown}
                        disabled={isAiBusy}
                        placeholder={isAiBusy ? "AI operation in progress..." : "Search commands..."}
                        className="flex-1 bg-transparent text-xs text-text-primary placeholder:text-text-tertiary outline-none font-medium"
                    />
                    <kbd className="text-[8px] text-text-muted font-mono border border-subtle-8 rounded-md px-1.5 py-0.5">ESC</kbd>
                </div>

                <div ref={listRef} className="max-h-[320px] overflow-y-auto p-2 scrollbar-hide">
                    {filtered.length === 0 ? (
                        <div className="py-6 text-center text-[10px] text-text-muted italic">
                            No commands match "{query}"
                        </div>
                    ) : (
                        Object.entries(grouped).map(([group, commands]) => (
                            <div key={group} className="mb-2 last:mb-0">
                                <div className="px-2 py-1.5 text-[8px] font-bold uppercase tracking-widest text-text-muted">
                                    {GROUP_LABELS[group as CommandGroup] || group}
                                </div>
                                {commands.map((cmd, i) => {
                                    const globalIndex = filtered.indexOf(cmd);
                                    return (
                                        <button
                                            key={cmd.id}
                                            disabled={isAiBusy}
                                            onClick={() => executeCommand(cmd)}
                                            onMouseEnter={() => !isAiBusy && setSelectedIndex(globalIndex)}
                                            className={cn(
                                                'w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left transition-[color,background-color] duration-120 active:scale-[0.98] focus-ring',
                                                isAiBusy
                                                    ? 'opacity-40 cursor-not-allowed text-text-muted'
                                                    : selectedIndex === globalIndex
                                                    ? 'bg-accent/10 text-accent'
                                                    : 'text-text-secondary hover:bg-subtle-3'
                                            )}
                                            style={!isAiBusy && selectedIndex === globalIndex ? { background: 'oklch(var(--accent) / 0.1)', color: 'var(--accent)' } : undefined}
                                        >
                                            <div className="flex-1 min-w-0">
                                                <div className="text-[11px] font-bold truncate">
                                                    {cmd.label}
                                                </div>
                                                <div className="text-[9px] text-text-tertiary truncate mt-0.5">
                                                    {cmd.description}
                                                </div>
                                            </div>
                                            {cmd.shortcut && (
                                                <kbd className="text-[8px] text-text-muted font-mono border border-subtle-8 rounded-md px-1.5 py-0.5 flex-shrink-0">
                                                    {cmd.shortcut}
                                                </kbd>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
