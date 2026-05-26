import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Character } from '../../services/character.api';
import { characterApi } from '../../services/character.api';
import { scriptWriterApi } from '../../services/scriptWriter.api';
import type { CharacterForm } from './types';
import { DEFAULT_CHARACTER_FORM } from './types';
import { getErrorMessage } from './utils';
import { toast } from '../../stores/toastStore';

interface UseScriptWriterCharactersProps {
    activeProjectId: string | null;
    setError: (message: string | null) => void;
}

export function useScriptWriterCharacters({ activeProjectId, setError }: UseScriptWriterCharactersProps) {
    const [characters, setCharacters] = useState<Character[]>([]);
    const [loadingCharacters, setLoadingCharacters] = useState(false);
    const [activeCharacterId, setActiveCharacterId] = useState<string | null>(null);
    const [characterForm, setCharacterForm] = useState<CharacterForm>(DEFAULT_CHARACTER_FORM);
    const [isSavingCharacter, setIsSavingCharacter] = useState(false);
    const [isGeneratingCharacter, setIsGeneratingCharacter] = useState(false);

    const [voiceStatus, setVoiceStatus] = useState<string | null>(null);
    const [isIngesting, setIsIngesting] = useState(false);
    const [ingestingCharacterIds, setIngestingCharacterIds] = useState<string[]>([]);

    const activeCharacter = useMemo(() => {
        if (!activeCharacterId) return null;
        return characters.find((character) => character._id === activeCharacterId) || null;
    }, [characters, activeCharacterId]);

    const loadCharacters = useCallback(async (projectId: string) => {
        setLoadingCharacters(true);
        try {
            const data = await characterApi.getCharacters(projectId);
            const filtered = (data || []).filter(Boolean);
            setCharacters(filtered);
            setActiveCharacterId((current) => current || filtered[0]?._id || null);
        } catch (err) {
            setError(getErrorMessage(err, 'Failed to load characters'));
        } finally {
            setLoadingCharacters(false);
        }
    }, [setError]);

    useEffect(() => {
        if (!activeProjectId) {
            setCharacters([]);
            setActiveCharacterId(null);
            setCharacterForm(DEFAULT_CHARACTER_FORM);
            setVoiceStatus(null);
            setIngestingCharacterIds([]);
            return;
        }
        setActiveCharacterId(null);
        setCharacterForm(DEFAULT_CHARACTER_FORM);
        setVoiceStatus(null);
        setIngestingCharacterIds([]);
        void loadCharacters(activeProjectId);
    }, [activeProjectId, loadCharacters]);

    useEffect(() => {
        if (!activeCharacter) return;
        setCharacterForm({
            name: activeCharacter.name || '',
            role: activeCharacter.role || 'supporting',
            voiceDescription: activeCharacter.voice?.description || '',
            voiceAccent: activeCharacter.voice?.accent || '',
            traits: (activeCharacter.traits || []).join(', '),
            motivation: activeCharacter.motivation || ''
        });
        // No longer tracking voiceCharacterId separately from activeCharacter
    }, [activeCharacter]);

    const handleCharacterSelect = (characterId: string | null) => {
        setActiveCharacterId(characterId);
    };

    const handleCharacterFormChange = (field: keyof CharacterForm, value: string) => {
        setCharacterForm((prev) => ({ ...prev, [field]: value }));
    };

    const handleCreateCharacter = async () => {
        if (!activeProjectId || !characterForm.name.trim()) return;
        setIsSavingCharacter(true);
        try {
            const created = await characterApi.createCharacter({
                bibleId: activeProjectId,
                name: characterForm.name,
                role: characterForm.role,
                voice: {
                    description: characterForm.voiceDescription,
                    accent: characterForm.voiceAccent
                },
                traits: characterForm.traits.split(',').map((t) => t.trim()).filter(Boolean),
                motivation: characterForm.motivation
            });
            setCharacters((prev) => [...prev, created]);
            setActiveCharacterId(created._id);
            toast.success('Character created successfully');
        } catch (err) {
            const msg = getErrorMessage(err, 'Failed to create character');
            setError(msg);
            toast.error(msg);
        } finally {
            setIsSavingCharacter(false);
        }
    };

    const handleUpdateCharacter = async () => {
        if (!activeCharacter) return;
        setIsSavingCharacter(true);
        try {
            const updated = await characterApi.updateCharacter(activeCharacter._id, {
                name: characterForm.name,
                role: characterForm.role,
                voice: {
                    description: characterForm.voiceDescription,
                    accent: characterForm.voiceAccent
                },
                traits: characterForm.traits.split(',').map((t) => t.trim()).filter(Boolean),
                motivation: characterForm.motivation
            });
            setCharacters((prev) => prev.map((character) => (character._id === updated._id ? updated : character)));
            toast.success('Character updated successfully');
        } catch (err) {
            const msg = getErrorMessage(err, 'Failed to update character');
            setError(msg);
            toast.error(msg);
        } finally {
            setIsSavingCharacter(false);
        }
    };

    const handleDeleteCharacter = async (characterId?: string) => {
        const idToDelete = characterId || activeCharacter?._id;
        if (!idToDelete) return;

        setIsSavingCharacter(true);
        try {
            await characterApi.deleteCharacter(idToDelete);
            setCharacters((prev) => prev.filter((character) => character._id !== idToDelete));
            if (activeCharacterId === idToDelete) {
                setActiveCharacterId(null);
                setCharacterForm(DEFAULT_CHARACTER_FORM);
            }
            toast.success('Character deleted successfully');
        } catch (err) {
            const msg = getErrorMessage(err, 'Failed to delete character');
            setError(msg);
            toast.error(msg);
        } finally {
            setIsSavingCharacter(false);
        }
    };

    const handleVoiceIngest = async (file: File, characterId?: string) => {
        if (!activeProjectId) return;

        // Prevent concurrent uploads for the same character if ID is provided
        if (characterId && ingestingCharacterIds.includes(characterId)) {
            if (import.meta.env.DEV) console.warn(`Already ingesting for character ${characterId}`);
            return;
        }

        setIsIngesting(true);
        if (characterId) {
            setIngestingCharacterIds(prev => [...prev, characterId]);
        }
        setVoiceStatus(null);

        try {
            const response = await scriptWriterApi.ingestVoiceSample(
                activeProjectId,
                file,
                characterId
            );
            const status = `Ingested ${response.count} samples.`;
            setVoiceStatus(status);
            toast.success(status);
            return response;
        } catch (err) {
            const errorMsg = getErrorMessage(err, 'Upload failed');
            setVoiceStatus(errorMsg);
            toast.error(errorMsg);
            throw err;
        } finally {
            setIsIngesting(false);
            if (characterId) {
                setIngestingCharacterIds(prev => prev.filter(id => id !== characterId));
            }
        }
    };

    const handleGenerateCharacterProfile = async (promptText: string, nameSuggestion?: string) => {
        if (!activeProjectId) return;
        setIsGeneratingCharacter(true);
        try {
            const result = await characterApi.generateCharacterProfile(
                activeProjectId,
                promptText,
                nameSuggestion
            );
            if (result && result.success && result.data) {
                const data = result.data;
                setCharacterForm({
                    name: data.name || nameSuggestion || '',
                    role: data.role || 'supporting',
                    voiceDescription: data.voiceDescription || '',
                    voiceAccent: data.voiceAccent || '',
                    traits: Array.isArray(data.traits) ? data.traits.join(', ') : '',
                    motivation: data.motivation || ''
                });
                toast.success('AI brainstormed character profile successfully!');
            } else {
                throw new Error('Invalid generation response');
            }
        } catch (err) {
            const msg = getErrorMessage(err, 'Failed to brainstorm character profile');
            setError(msg);
            toast.error(msg);
        } finally {
            setIsGeneratingCharacter(false);
        }
    };

    return {
        characters,
        loadCharacters,
        loadingCharacters,
        activeCharacterId,
        characterForm,
        isSavingCharacter,
        isGeneratingCharacter,
        voiceStatus,
        isIngesting,
        ingestingCharacterIds,
        handleCharacterSelect,
        handleCharacterFormChange,
        handleCreateCharacter,
        handleUpdateCharacter,
        handleDeleteCharacter,
        handleVoiceIngest,
        handleGenerateCharacterProfile
    };
}
