import { Character } from '../../models/Character';
import { loreSyncService } from '../loreSync.service';
import { aiServiceManager } from '../aiManager/index.js';
import { CHARACTER_DISCOVERY_PROMPT } from '../../prompts/hollywood/index.js';
import { JSONHelper } from '../parser/jsonHelper.js';
import mongoose from 'mongoose';
import { enrichExistingCharacter } from './enricher.js';
import { escapeRegExp } from '../../utils/security.js';

const SKIP_NAMES = new Set(['A CROWD', 'THE CROWD', 'THE WIND', 'PEOPLE']);

export class CharacterDiscoveryService {
    async discoverAndSave(bibleId: string, text: string): Promise<number> {
        if (!mongoose.Types.ObjectId.isValid(bibleId)) return 0;
        if (process.env.NODE_ENV !== 'production') { console.log(`[CharacterDiscovery] Scanning text for bibleId ${bibleId}...`); }

        try {
            const existingCharacters = await Character.find({ bibleId });
            const existingNames = existingCharacters.map(c => c.name.toUpperCase());

            const prompt = CHARACTER_DISCOVERY_PROMPT
                .replace('{{existing_cast}}', existingNames.length > 0 ? existingNames.join(', ') : 'Cast is unknown. Report only CLEARLY named human/agent characters in the text.')
                .replace('{{story_text}}', text);

            const response = await aiServiceManager.chat(prompt, { model: 'instant', format: 'json', temperature: 0.1 });

            let charactersData: any[] = [];
            try {
                const cleanJson = response.replace(/^```json\s*/i, '').replace(/\s*```$/, '').trim();
                const parsed = JSONHelper.dirtyRepair(cleanJson);
                if (Array.isArray(parsed)) {
                    charactersData = parsed;
                } else if (parsed && typeof parsed === 'object') {
                    const wrappedArray = parsed.characters || parsed.cast || parsed.entities || Object.values(parsed).find(Array.isArray);
                    if (Array.isArray(wrappedArray)) {
                        charactersData = wrappedArray;
                    }
                }
            } catch (e) {
                if (process.env.NODE_ENV !== 'production') { console.warn('[CharacterDiscovery] Failed to parse AI JSON response:', e); }
                return 0;
            }

            if (charactersData.length === 0) {
                if (process.env.NODE_ENV !== 'production') { console.warn('[CharacterDiscovery] AI did not return a populated array of characters.'); }
                return 0;
            }

            let addedCount = 0;
            let updatedCount = 0;

            for (const charData of charactersData) {
                if (!charData.name) continue;
                const normalizedName = charData.name.trim().toUpperCase();
                if (SKIP_NAMES.has(normalizedName)) continue;

                const aiRole = (charData.role || '').toLowerCase();
                let role: 'protagonist' | 'antagonist' | 'supporting' | 'minor' = 'supporting';
                if (aiRole === 'protagonist') role = 'protagonist';
                else if (aiRole === 'antagonist') role = 'antagonist';
                else if (aiRole === 'minor' || aiRole === 'incidental') role = 'minor';

                let existingChar = existingCharacters.find(c => c.name.toUpperCase() === normalizedName);

                if (!existingChar) {
                    const queryId = typeof bibleId === 'string' ? new mongoose.Types.ObjectId(bibleId) : bibleId;
                    const dbChar = await Character.findOne({
                        bibleId: queryId,
                        name: { $regex: new RegExp(`^${escapeRegExp(normalizedName)}$`, 'i') }
                    });
                    if (dbChar) {
                        existingChar = dbChar as any;
                    }
                }

                if (!existingChar) {
                    if (role === 'minor') {
                        if (process.env.NODE_ENV !== 'production') { console.log(`[CharacterDiscovery] Skipping minor character: ${charData.name}`); }
                        continue;
                    }

                    const newChar = await Character.create({
                        bibleId: typeof bibleId === 'string' ? new mongoose.Types.ObjectId(bibleId) : bibleId,
                        name: charData.name.trim(),
                        role: role,
                        age: typeof charData.age === 'number' ? charData.age : undefined,
                        motivation: charData.motivation || '',
                        traits: Array.isArray(charData.traits) ? charData.traits.filter(Boolean) : [],
                        voice: {
                            description: charData.voiceDescription || `Discovered from story generation.`,
                            sampleLines: charData.sampleDialogue ? [charData.sampleDialogue] : [],
                            accent: charData.accent || undefined
                        },
                        currentStatus: charData.currentStatus || 'Stable',
                        heldItems: Array.isArray(charData.heldItems) ? charData.heldItems.filter(Boolean) : [],
                        relationships: Array.isArray(charData.relationships) ? charData.relationships : []
                    });

                    await loreSyncService.syncCharacter(newChar);
                    addedCount++;
                    if (process.env.NODE_ENV !== 'production') { console.log(`[CharacterDiscovery] Added new character: ${charData.name}`); }
                } else {
                    const result = await enrichExistingCharacter(existingChar, charData);
                    if (result === 'updated') {
                        updatedCount++;
                        if (process.env.NODE_ENV !== 'production') { console.log(`[CharacterDiscovery] Enriched existing character: ${existingChar.name}`); }
                    }
                }
            }

            if (process.env.NODE_ENV !== 'production') {
                console.log(`[CharacterDiscovery] Scanning finished. Added: ${addedCount}, Enriched: ${updatedCount}`);
            }

            return addedCount + updatedCount;
        } catch (err) {
            console.error('[CharacterDiscovery] Fatal error during discovery:', err);
            return 0;
        }
    }
}

export const characterDiscoveryService = new CharacterDiscoveryService();
