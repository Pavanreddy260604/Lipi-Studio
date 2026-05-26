import { Users, Plus } from 'lucide-react';
import { motion } from 'framer-motion';
import type { Character } from '../../../../services/character.api';
import { Button } from '../../../../components/ui/Button';

interface CastListProps {
    characters: Character[];
    loadingCharacters: boolean;
    activeCharacterId: string | null;
    onAddCharacter: () => void;
    onSelectCharacter: (id: string) => void;
}

export function CastList({
    characters,
    loadingCharacters,
    activeCharacterId,
    onAddCharacter,
    onSelectCharacter
}: CastListProps) {
    return (
        <div className="h-full p-6 overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h2 className="text-xl font-bold text-[var(--text-primary)]">Cast</h2>
                    <p className="text-sm text-[var(--text-tertiary)]">{characters.length} character{characters.length !== 1 ? 's' : ''}</p>
                </div>
                <Button variant="primary" size="sm" onClick={onAddCharacter}>
                    <Plus size={16} />
                    Add Character
                </Button>
            </div>

            {loadingCharacters ? (
                <div className="text-center py-12 text-[var(--text-tertiary)]">Loading cast...</div>
            ) : characters.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4">
                    <div className="bg-[var(--surface-elevated)] border border-subtle-8 rounded-xl shadow-[var(--shadow-sm)] p-4" style={{ borderRadius: 'var(--radius-xl)' }}>
                        <Users size={48} strokeWidth={1} className="text-[var(--text-muted)]" />
                    </div>
                    <p className="text-[var(--text-secondary)]">No characters yet. Add your first character to get started.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {characters.map((character, index) => (
                        <button
                            key={character._id}
                            className={`bg-subtle-2 border border-subtle-8 rounded-xl w-full min-h-[64px] text-left p-4 transition-all duration-200 ease-smooth hover:bg-subtle-3 focus-ring animate-slide-up ${
                                activeCharacterId === character._id
                                    ? 'ring-2 ring-accent border-accent bg-subtle-3'
                                    : ''
                            }`}
                            style={{ borderRadius: 'var(--radius-xl)', animationDelay: `${index * 40}ms`, animationFillMode: 'both' }}
                            onClick={() => onSelectCharacter(character._id)}
                        >
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg flex-shrink-0 bg-accent/10 text-accent">
                                    {character.name.charAt(0).toUpperCase()}
                                </div>
                                <div className="min-w-0">
                                    <div className="font-bold text-[var(--text-primary)] truncate">{character.name}</div>
                                    <div className="text-xs text-[var(--text-tertiary)] capitalize">{character.role}</div>
                                </div>
                            </div>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
