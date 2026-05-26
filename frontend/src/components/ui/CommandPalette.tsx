import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Search, X, Command, FileText, Settings, Home, BookOpen, MessageSquare, Code2, Briefcase, ChevronRight } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';
import { useChatStore } from '../../stores/chatStore';

interface CommandItem {
    id: string;
    label: string;
    icon: React.ReactNode;
    shortcut?: string;
    category: string;
    action: () => void;
}

interface CommandPaletteProps {
    isOpen: boolean;
    onClose: () => void;
}

export function CommandPalette({ isOpen, onClose }: CommandPaletteProps) {
    const [query, setQuery] = useState('');
    const [selectedIndex, setSelectedIndex] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);
    const navigate = useNavigate();
    const location = useLocation();

    const commands: CommandItem[] = useMemo(() => [
        // Navigation
        {
            id: 'nav-home',
            label: 'Home / Dashboard',
            icon: <Home size={18} />,
            shortcut: 'G H',
            category: 'Navigation',
            action: () => { navigate('/dashboard'); onClose(); }
        },
        {
            id: 'nav-dsa',
            label: 'DSA Practice',
            icon: <Code2 size={18} />,
            shortcut: 'G D',
            category: 'Navigation',
            action: () => { navigate('/dsa'); onClose(); }
        },
        {
            id: 'nav-interview',
            label: 'Interview Simulator',
            icon: <MessageSquare size={18} />,
            shortcut: 'G I',
            category: 'Navigation',
            action: () => { navigate('/interview'); onClose(); }
        },
        {
            id: 'nav-backend',
            label: 'Backend Learning',
            icon: <BookOpen size={18} />,
            shortcut: 'G B',
            category: 'Navigation',
            action: () => { navigate('/backend'); onClose(); }
        },
        {
            id: 'nav-chat',
            label: 'AI Chat',
            icon: <MessageSquare size={18} />,
            shortcut: 'G C',
            category: 'Navigation',
            action: () => { 
                onClose(); 
                if (!useChatStore.getState().isOpen) {
                    useChatStore.getState().toggleOpen();
                }
            }
        },
        {
            id: 'nav-projects',
            label: 'Projects',
            icon: <Briefcase size={18} />,
            shortcut: 'G P',
            category: 'Navigation',
            action: () => { navigate('/projects'); onClose(); }
        },
        {
            id: 'nav-flashcards',
            label: 'Flashcards',
            icon: <BookOpen size={18} />,
            category: 'Navigation',
            action: () => { navigate('/flashcards'); onClose(); }
        },
        {
            id: 'nav-settings',
            label: 'Settings',
            icon: <Settings size={18} />,
            shortcut: 'G S',
            category: 'Navigation',
            action: () => { navigate('/settings'); onClose(); }
        },
        // Actions
        {
            id: 'action-new-chat',
            label: 'New Chat',
            icon: <MessageSquare size={18} />,
            shortcut: 'N',
            category: 'Actions',
            action: () => { 
                onClose(); 
                useChatStore.getState().clearMessages();
                if (!useChatStore.getState().isOpen) {
                    useChatStore.getState().toggleOpen();
                }
            }
        },
        {
            id: 'action-new-project',
            label: 'New Project',
            icon: <FileText size={18} />,
            category: 'Actions',
            action: () => { navigate('/projects?new=true'); onClose(); }
        },
    ], [navigate, onClose]);

    const filteredCommands = useMemo(() => {
        if (!query) return commands;
        const lowerQuery = query.toLowerCase();
        return commands.filter(cmd => 
            cmd.label.toLowerCase().includes(lowerQuery) ||
            cmd.category.toLowerCase().includes(lowerQuery)
        );
    }, [commands, query]);

    // Keyboard navigation
    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                setSelectedIndex(prev => (prev + 1) % filteredCommands.length);
                break;
            case 'ArrowUp':
                e.preventDefault();
                setSelectedIndex(prev => (prev - 1 + filteredCommands.length) % filteredCommands.length);
                break;
            case 'Enter':
                e.preventDefault();
                filteredCommands[selectedIndex]?.action();
                break;
            case 'Escape':
                e.preventDefault();
                onClose();
                break;
        }
    }, [filteredCommands, selectedIndex, onClose]);

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

    // Global keyboard shortcut to open
    useKeyboardShortcuts([
        {
            key: 'k',
            ctrl: true,
            action: () => {
                if (!isOpen) {
                    // Need to expose open function - handled by parent
                }
            }
        },
        {
            key: 'Escape',
            action: () => {
                if (isOpen) onClose();
            }
        }
    ]);

    if (!isOpen) return null;

    const groupedCommands = filteredCommands.reduce((acc, cmd) => {
        if (!acc[cmd.category]) acc[cmd.category] = [];
        acc[cmd.category].push(cmd);
        return acc;
    }, {} as Record<string, CommandItem[]>);

    return (
        <div className="fixed inset-0 z-[200] flex items-start justify-center pt-[15vh]">
            {/* Backdrop */}
            <div 
                className="absolute inset-0 bg-black/80"
                onClick={onClose}
            />
            
            {/* Modal */}
            <div className="relative w-full max-w-xl bg-[var(--console-surface)] border border-[var(--border-subtle)] rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                {/* Search Input */}
                <div className="flex items-center gap-3 px-4 py-4 border-b border-[var(--border-subtle)]">
                    <Search size={20} className="text-[var(--text-muted)]" />
                    <input
                        ref={inputRef}
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Type a command or search..."
                        className="flex-1 bg-transparent text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none text-sm"
                    />
                    <div className="flex items-center gap-1 text-[10px] font-medium text-[var(--text-muted)] bg-[var(--console-surface-2)] px-2 py-1 rounded">
                        <Command size={10} />
                        <span>K</span>
                    </div>
                </div>

                {/* Results */}
                <div className="max-h-[50vh] overflow-y-auto py-2">
                    {Object.entries(groupedCommands).map(([category, items]) => (
                        <div key={category}>
                            <div className="px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
                                {category}
                            </div>
                            {items.map((cmd, idx) => {
                                const globalIdx = filteredCommands.indexOf(cmd);
                                const isSelected = globalIdx === selectedIndex;
                                
                                return (
                                    <button
                                        key={cmd.id}
                                        onClick={cmd.action}
                                        onMouseEnter={() => setSelectedIndex(globalIdx)}
                                        className={`
                                            w-full flex items-center gap-3 px-4 py-2.5 text-left
                                            transition-colors duration-75
                                            ${isSelected 
                                                ? 'bg-[var(--accent-primary)]/10 text-[var(--text-primary)]' 
                                                : 'text-[var(--text-secondary)] hover:bg-[var(--console-surface-2)]'
                                            }
                                        `}
                                    >
                                        <span className={isSelected ? 'text-[var(--accent-primary)]' : 'text-[var(--text-muted)]'}>
                                            {cmd.icon}
                                        </span>
                                        <span className="flex-1 text-sm font-medium">{cmd.label}</span>
                                        {cmd.shortcut && (
                                            <span className="text-[10px] text-[var(--text-muted)] font-mono">
                                                {cmd.shortcut}
                                            </span>
                                        )}
                                        {isSelected && (
                                            <ChevronRight size={14} className="text-[var(--accent-primary)]" />
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    ))}
                    
                    {filteredCommands.length === 0 && (
                        <div className="px-4 py-8 text-center text-[var(--text-muted)] text-sm">
                            No commands found for "{query}"
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-4 py-2 border-t border-[var(--border-subtle)] flex items-center gap-4 text-[10px] text-[var(--text-muted)]">
                    <span className="flex items-center gap-1">
                        <span className="font-mono">↑↓</span> Navigate
                    </span>
                    <span className="flex items-center gap-1">
                        <span className="font-mono">↵</span> Select
                    </span>
                    <span className="flex items-center gap-1">
                        <span className="font-mono">esc</span> Close
                    </span>
                </div>
            </div>
        </div>
    );
}

export default CommandPalette;
