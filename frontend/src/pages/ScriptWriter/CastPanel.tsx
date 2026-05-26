import { Plus, ArrowLeft } from 'lucide-react';
import { motion } from 'framer-motion';
import { useState, useEffect, useRef } from 'react';
import { Button } from '../../components/ui/Button';
import type { Bible } from '../../services/project.api';
import type { Character } from '../../services/character.api';
import type { CharacterForm } from './types';
import { CharacterEdit } from './components/cast/CharacterEdit';

interface CastPanelProps {
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
    isGeneratingCharacter?: boolean;
    onGenerateCharacterProfile?: (prompt: string, name?: string) => Promise<void> | void;
}

export function CastPanel({
    activeProject,
    characters,
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
    isIngesting,
    isGeneratingCharacter,
    onGenerateCharacterProfile
}: CastPanelProps) {
    const [focusedCharacter, setFocusedCharacter] = useState<string | null>(null);
    const [isCreatingNew, setIsCreatingNew] = useState(false);

    const prevActiveRef = useRef(activeCharacterId);
    useEffect(() => {
        if (activeCharacterId && activeCharacterId !== focusedCharacter && !isCreatingNew) {
            setFocusedCharacter(activeCharacterId);
        }
        prevActiveRef.current = activeCharacterId;
    }, [activeCharacterId, focusedCharacter, isCreatingNew]);

    if (!activeProject) {
        return (
            <div className="p-4 text-center text-[var(--text-tertiary)]">
                <p>Select a project to see cast.</p>
            </div>
        );
    }

    const editMode = focusedCharacter || isCreatingNew;

    if (editMode) {
        const editingCharacter = characters.find(c => c._id === focusedCharacter);

        return (
            <div className="p-4">
                <Button
                    variant="ghost"
                    className="w-full mb-4 text-[11px] font-bold uppercase tracking-wider"
                    onClick={() => {
                        setFocusedCharacter(null);
                        setIsCreatingNew(false);
                    }}
                    leftIcon={<ArrowLeft size={14} />}
                >
                    Back to List
                </Button>

                <CharacterEdit
                    isCreatingNew={isCreatingNew}
                    editingCharacter={editingCharacter}
                    characterForm={characterForm}
                    onBack={() => {
                        setFocusedCharacter(null);
                        setIsCreatingNew(false);
                    }}
                    onChange={onCharacterFormChange}
                    onSave={() => {
                        if (isCreatingNew) {
                            onCreateCharacter();
                            setIsCreatingNew(false);
                        } else {
                            onUpdateCharacter();
                        }
                    }}
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
                    isGeneratingCharacter={isGeneratingCharacter}
                    onGenerateCharacterProfile={onGenerateCharacterProfile}
                />
            </div>
        );
    }

    return (
        <div className="p-4 flex flex-col gap-4">
            <Button
                variant="primary"
                className="w-full text-[11px] font-bold uppercase tracking-wider"
                onClick={() => {
                    onCharacterFormChange('name', '');
                    setIsCreatingNew(true);
                }}
                leftIcon={<Plus size={14} />}
            >
                Create Character
            </Button>

            <div className="flex flex-col gap-4">
                {characters.map(char => (
                    <motion.div
                        key={char._id}
                        whileHover={{ scale: 1.01 }}
                        className="bg-subtle-2 border border-subtle-8 rounded-xl p-3 cursor-pointer focus-ring"
                        onClick={() => {
                            onCharacterSelect(char._id);
                            setFocusedCharacter(char._id);
                        }}
                    >
                        <div className="font-bold text-sm text-[var(--text-heading)]">{char.name}</div>
                        <div className="text-xs text-[var(--text-tertiary)] capitalize">{char.role}</div>
                    </motion.div>
                ))}
            </div>
        </div>
    );
}
