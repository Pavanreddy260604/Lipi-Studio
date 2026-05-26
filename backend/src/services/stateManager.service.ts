import { Character } from '../models/Character';
import { aiServiceManager } from './aiManager/index.js';
import { STATE_EXTRACTION_PROMPT } from '../prompts/hollywood/index.js';
import { loreSyncService } from './loreSync.service';
import { JSONHelper } from './parser/jsonHelper.js';

export class StateManagerService {
    public buildCharacterContext(characters: any[]): string {
        if (!characters || characters.length === 0) return 'No specific character data available.';
        return characters.map(c => {
            let bio = `- **${c.name.toUpperCase()}** (${c.role || 'supporting'})`;
            if (c.description) bio += `\n  Description: ${c.description}`;
            if (c.traits?.length) bio += ` | Traits: ${c.traits.join(', ')}`;
            if (c.motivation) bio += ` | Motivation: ${c.motivation}`;
            if (c.currentStatus) bio += ` | Status: ${c.currentStatus}`;
            
            if (c.voice) {
                let voiceInfo = '';
                if (c.voice.description) voiceInfo += `Voice: ${c.voice.description}. `;
                if (c.voice.accent) voiceInfo += `Accent: ${c.voice.accent}. `;
                if (c.voice.sampleLines?.length) voiceInfo += `Sample: "${c.voice.sampleLines[0]}"`;
                if (voiceInfo) bio += ` | ${voiceInfo.trim()}`;
            }

            if (c.relationships?.length) {
                bio += ` | Relationships: ${c.relationships.map((r: any) => `${r.targetCharName}: ${r.dynamic}`).join(', ')}`;
            }

            return bio;
        }).join('\n');
    }

    public async saveStateObject(parsedUpdates: any, characters: any[]): Promise<void> {
        if (!characters.length || !parsedUpdates) return;

        try {
            const updatesList = Array.isArray(parsedUpdates) ? parsedUpdates : (parsedUpdates.updates || []);
            
            const tasks = characters.map(async (char) => {
                const update = Array.isArray(updatesList) 
                    ? updatesList.find((u: any) => u.name?.toLowerCase() === char.name?.toLowerCase())
                    : updatesList[char.name];

                if (update) {
                    const status = update.newStatus || update.status || update.emotionalState;
                    if (status) char.currentStatus = status;
                    
                    if (Array.isArray(update.itemsGained)) {
                        char.heldItems = Array.from(new Set([...(char.heldItems || []), ...update.itemsGained]));
                    }
                    if (Array.isArray(update.itemsLost)) {
                        char.heldItems = (char.heldItems || []).filter((item: string) => !update.itemsLost.includes(item));
                    }
                    
                    if (Array.isArray(update.relationshipChanges)) {
                        const currentRels = char.relationships || [];
                        for (const relChange of update.relationshipChanges) {
                            const rawTarget = relChange.target || relChange.with;
                            if (!rawTarget || !relChange.change) continue;
                            const targetName = String(rawTarget).trim();
                            const dynamicText = relChange.change.trim();
                            
                            const matchIdx = currentRels.findIndex(
                                (r: any) => r.targetCharName.toUpperCase() === targetName.toUpperCase()
                            );
                            if (matchIdx >= 0) {
                                currentRels[matchIdx].dynamic = dynamicText;
                            } else {
                                currentRels.push({ targetCharName: targetName, dynamic: dynamicText });
                            }
                        }
                        char.relationships = currentRels;
                    }
                    
                    const updated = await Character.findByIdAndUpdate(char._id, {
                        currentStatus: char.currentStatus,
                        heldItems: char.heldItems,
                        relationships: char.relationships
                    }, { new: true });
                    if (updated) {
                        await loreSyncService.syncCharacter(updated);
                    }
                    if (process.env.NODE_ENV !== 'production') { console.info(`[StateManager] Applied state update for ${char.name}`); }
                }
            });

            await Promise.all(tasks);
        } catch (err) {
            console.error('[StateManager] Failed to save state object:', err);
        }
    }

    public async extractAndSaveState(content: string, characters: any[]): Promise<void> {
        if (!characters.length || !content) return;
        const characterNames = characters.map(c => c.name).join(', ');
        const prompt = STATE_EXTRACTION_PROMPT
            .replace('{{content}}', content)
            .replace('{{characters}}', characterNames);

        try {
            const response = await aiServiceManager.chat(prompt, { model: 'thinking', format: 'json', temperature: 0 });
            const cleanJson = response.replace(/```json/g, '').replace(/```/g, '').trim();
            const parsed = JSONHelper.dirtyRepair(cleanJson);
            const updatesList = Array.isArray(parsed) ? parsed : (parsed.updates || []);

            const tasks = characters.map(async (char) => {
                const update = Array.isArray(updatesList) 
                    ? updatesList.find((u: any) => u.name === char.name)
                    : updatesList[char.name];

                if (update) {
                    const status = update.newStatus || update.status;
                    if (status) char.currentStatus = status;
                    
                    if (Array.isArray(update.itemsGained)) {
                        char.heldItems = Array.from(new Set([...(char.heldItems || []), ...update.itemsGained]));
                    }
                    if (Array.isArray(update.itemsLost)) {
                        char.heldItems = (char.heldItems || []).filter((item: string) => !update.itemsLost.includes(item));
                    }
                    
                    if (Array.isArray(update.relationshipChanges)) {
                        const currentRels = char.relationships || [];
                        for (const relChange of update.relationshipChanges) {
                            const rawTarget = relChange.target || relChange.with;
                            if (!rawTarget || !relChange.change) continue;
                            const targetName = String(rawTarget).trim();
                            const dynamicText = relChange.change.trim();
                            
                            const matchIdx = currentRels.findIndex(
                                (r: any) => r.targetCharName.toUpperCase() === targetName.toUpperCase()
                            );
                            if (matchIdx >= 0) {
                                currentRels[matchIdx].dynamic = dynamicText;
                            } else {
                                currentRels.push({ targetCharName: targetName, dynamic: dynamicText });
                            }
                        }
                        char.relationships = currentRels;
                    }
                    
                    const updated = await Character.findByIdAndUpdate(char._id, {
                        currentStatus: char.currentStatus,
                        heldItems: char.heldItems,
                        relationships: char.relationships
                    }, { new: true });
                    if (updated) {
                        await loreSyncService.syncCharacter(updated);
                    }
                    if (process.env.NODE_ENV !== 'production') { console.log(`[StateManager] Updated state for ${char.name}`); }
                }
            });

            await Promise.all(tasks);
        } catch (err) {
            console.error('[StateManager] Failed to extract/save state:', err);
        }
    }
}

export const stateManagerService = new StateManagerService();
