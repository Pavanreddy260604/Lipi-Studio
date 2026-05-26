import { Users, UserPlus } from 'lucide-react';
import { useState } from 'react';
import type { Bible } from '../../services/project.api';
import type { Character } from '../../services/character.api';
import type { CharacterForm } from './types';
import { CastList } from './components/cast/CastList';
import { CharacterEdit } from './components/cast/CharacterEdit';
import { Card, Stack, Button } from '../../components/ui';

interface CastViewProps {
    activeProject: Bible | null;
    characters: Character[];
    loadingCharacters: boolean;
    activeCharacterId: string | null;
    characterForm: CharacterForm;
    onCharacterSelect: (id: string) => void;
    onCharacterFormChange: (field: keyof CharacterForm, value: string) => void;
    onCreateCharacter: () => void;
    onUpdateCharacter: () => void;
    onDeleteCharacter: () => void;
    isSavingCharacter: boolean;
    voiceFile: File | null;
    onVoiceFileChange: (file: File | null) => void;
    voiceCharacterId: string | null;
    onVoiceCharacterChange: (id: string | null) => void;
    onVoiceIngest: () => void;
    voiceStatus: string | null;
    isIngesting: boolean;
}

export function CastView({
    activeProject,
    characters,
    loadingCharacters,
    activeCharacterId,
    characterForm,
    onCharacterSelect,
    onCharacterFormChange,
    onCreateCharacter,
    onUpdateCharacter,
    onDeleteCharacter,
    isSavingCharacter,
    voiceFile,
    onVoiceFileChange,
    onVoiceCharacterChange,
    onVoiceIngest,
    voiceStatus,
    isIngesting
}: CastViewProps) {
    const [focusedCharacter, setFocusedCharacter] = useState<string | null>(null);
    const [isCreatingNew, setIsCreatingNew] = useState(false);

    if (!activeProject) {
        return (
            <div className="flex flex-col items-center justify-center h-full gap-8 p-12 text-center">
                <Card className="p-12 bg-subtle-2 border-subtle-8 shadow-sm flex flex-col items-center gap-8">
                    <div className="w-16 h-16 rounded-[1.5rem] bg-subtle-3 border border-subtle-8 flex items-center justify-center text-muted">
                        <Users size={32} />
                    </div>
                    <Stack gap={2}>
                        <h2 className="text-xl font-black text-heading uppercase tracking-tight italic">Cast Manager</h2>
                        <p className="text-sm text-secondary font-medium max-w-[32ch] mx-auto leading-relaxed">Select a project record from the matrix to initialize the character database.</p>
                    </Stack>
                </Card>
            </div>
        );
    }

    const editMode = focusedCharacter || isCreatingNew;

    if (editMode) {
        const editingCharacter = characters.find(c => c._id === focusedCharacter);

        return (
            <CharacterEdit
                isCreatingNew={isCreatingNew}
                editingCharacter={editingCharacter}
                characterForm={characterForm}
                onBack={() => {
                    setFocusedCharacter(null);
                    setIsCreatingNew(false);
                }}
                onChange={onCharacterFormChange}
                onSave={isCreatingNew ? onCreateCharacter : onUpdateCharacter}
                onDelete={() => {
                    onDeleteCharacter();
                    setFocusedCharacter(null);
                }}
                isSaving={isSavingCharacter}
                voiceFile={voiceFile}
                onVoiceFileChange={(file) => {
                    onVoiceFileChange(file);
                    if (focusedCharacter) onVoiceCharacterChange(focusedCharacter);
                }}
                onVoiceIngest={onVoiceIngest}
                voiceStatus={voiceStatus}
                isIngesting={isIngesting}
            />
        );
    }

    return (
        <CastList
            characters={characters}
            loadingCharacters={loadingCharacters}
            activeCharacterId={activeCharacterId}
            onSelectCharacter={(id) => {
                onCharacterSelect(id);
                setFocusedCharacter(id);
            }}
            onAddCharacter={() => {
                onCharacterFormChange('name', '');
                onCharacterFormChange('role', 'supporting');
                onCharacterFormChange('voiceDescription', '');
                onCharacterFormChange('voiceAccent', '');
                onCharacterFormChange('traits', '');
                onCharacterFormChange('motivation', '');
                setIsCreatingNew(true);
            }}
        />
    );
}
