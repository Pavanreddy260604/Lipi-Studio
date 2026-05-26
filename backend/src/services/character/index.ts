import { Character, ICharacter } from '../../models/Character';
import { VoiceSample } from '../../models/VoiceSample';
import mongoose from 'mongoose';
import { loreSyncService } from '../loreSync.service';
import { aiServiceManager } from '../aiManager/index.js';
import { Bible } from '../../models/Bible';
import { JSONHelper } from '../parser/jsonHelper.js';
import { CHARACTER_BRAINSTORM_PROMPT } from './prompts.js';
import { escapeRegExp } from '../../utils/security.js';

export class CharacterService {

    async generateCharacterProfile(bibleId: string, promptText?: string, nameSuggestion?: string): Promise<any> {
        const bible = await Bible.findById(bibleId);
        if (!bible) throw new Error('Bible not found');

        const existingCharacters = await Character.find({ bibleId });
        const existingCastText = existingCharacters.length > 0
            ? existingCharacters.map(c => `${c.name} (${c.role})`).join(', ')
            : 'None yet';

        let prompt = CHARACTER_BRAINSTORM_PROMPT
            .replace('{{logline}}', bible.logline || bible.title || 'A screenplay')
            .replace('{{genre}}', bible.genre || 'Drama')
            .replace('{{tone}}', bible.tone || 'Cinematic')
            .replace('{{existing_cast}}', existingCastText)
            .replace('{{prompt}}', promptText || 'A compelling new character');

        if (nameSuggestion?.trim()) {
            prompt += `\n\nSTRICT REQUIREMENT: The character's name MUST be "${nameSuggestion.trim().toUpperCase()}".`;
        }

        try {
            if (process.env.NODE_ENV !== 'production') {
                console.log(`[CharacterService] Generating profile with prompt: ${promptText || 'None'}`);
            }

            const response = await aiServiceManager.chat(prompt, {
                model: 'thinking',
                format: 'json'
            });

            const extracted = JSONHelper.extractJson(response);
            const parsed = JSONHelper.dirtyRepair(extracted);
            return parsed;
        } catch (err) {
            console.error('[CharacterService] Brainstorm failed:', err);
            throw new Error('Failed to brainstorm character profile using AI.');
        }
    }

    async createCharacter(data: Partial<ICharacter>): Promise<ICharacter> {
        if (data.name && data.bibleId) {
            const existing = await Character.findOne({
                bibleId: data.bibleId,
                name: { $regex: new RegExp(`^${escapeRegExp(data.name.trim())}$`, 'i') }
            });
            if (existing) {
                throw new Error(`A character named "${data.name}" already exists in this project.`);
            }
        }
        const character = new Character(data);
        const saved = await character.save();
        await loreSyncService.syncCharacter(saved);
        return saved;
    }

    async getCharactersByBible(bibleId: string): Promise<ICharacter[]> {
        return await Character.find({ bibleId }).sort({ name: 1 });
    }

    async getCharacter(id: string): Promise<ICharacter | null> {
        return await Character.findById(id);
    }

    async updateCharacter(id: string, updates: Partial<ICharacter>): Promise<ICharacter | null> {
        if (updates.name) {
            const character = await Character.findById(id);
            if (character && updates.name.toLowerCase() !== character.name.toLowerCase()) {
                const existing = await Character.findOne({
                    bibleId: character.bibleId,
                    name: { $regex: new RegExp(`^${escapeRegExp(updates.name.trim())}$`, 'i') },
                    _id: { $ne: id }
                });
                if (existing) {
                    throw new Error(`A character named "${updates.name}" already exists in this project.`);
                }
            }
        }
        const updated = await Character.findByIdAndUpdate(id, updates, { new: true });
        if (updated) {
            await loreSyncService.syncCharacter(updated);
        }
        return updated;
    }

    async deleteCharacter(id: string): Promise<boolean> {
        const character = await Character.findById(id);
        if (character) {
            await loreSyncService.deleteCharacterSync(character.bibleId as any, character.name);
        }

        const session = await mongoose.startSession();

        try {
            session.startTransaction();

            const result = await Character.findByIdAndDelete(id).session(session);
            if (!result) {
                await session.abortTransaction();
                return false;
            }

            await VoiceSample.updateMany(
                { characterId: id },
                { $unset: { characterId: "" } }
            ).session(session);

            await session.commitTransaction();
            return true;
        } catch (error) {
            await session.abortTransaction().catch(() => undefined);

            if (this.isTransactionUnsupported(error)) {
                const result = await Character.findByIdAndDelete(id);
                if (!result) return false;
                await VoiceSample.updateMany(
                    { characterId: id },
                    { $unset: { characterId: "" } }
                );
                return true;
            }

            throw error;
        } finally {
            session.endSession();
        }
    }

    private isTransactionUnsupported(error: unknown): boolean {
        if (!(error instanceof Error)) return false;
        return (
            error.message.includes('Transaction numbers are only allowed on a replica set member') ||
            error.message.includes('Transaction support is not available')
        );
    }
}

export const characterService = new CharacterService();
