import { Character } from '../models/Character';
import { Bible } from '../models/Bible';
import { aiServiceManager } from './aiManager/index.js';
import { JSONHelper } from './parser/jsonHelper.js';
import mongoose from 'mongoose';

function getLevenshteinDistance(a: string, b: string): number {
    const an = a ? a.length : 0;
    const bn = b ? b.length : 0;
    if (an === 0) return bn;
    if (bn === 0) return an;
    const matrix = Array.from({ length: an + 1 }, () => new Int32Array(bn + 1));
    for (let i = 0; i <= an; i++) matrix[i][0] = i;
    for (let j = 0; j <= bn; j++) matrix[0][j] = j;
    for (let i = 1; i <= an; i++) {
        for (let j = 1; j <= bn; j++) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            matrix[i][j] = Math.min(
                matrix[i - 1][j] + 1,
                matrix[i][j - 1] + 1,
                matrix[i - 1][j - 1] + cost
            );
        }
    }
    return matrix[an][bn];
}

function isSpellingVariant(proposed: string, existingNames: string[]): string | null {
    const upper = proposed.toUpperCase();
    if (existingNames.some(n => n.toUpperCase() === upper)) return upper;
    for (const existing of existingNames) {
        if (getLevenshteinDistance(upper, existing.toUpperCase()) <= 2) {
            return existing;
        }
    }
    return null;
}

const SKIP_NAMES_CORE = new Set(['A CROWD', 'THE CROWD', 'THE WIND', 'PEOPLE', 'EVERYONE', 'ALL', 'BOTH', 'MAN', 'WOMAN']);

export interface ProposedCharacter {
    name: string;
    age: number;
    role: 'protagonist' | 'antagonist' | 'supporting' | 'minor';
    traits: string[];
    motivation: string;
    voiceDescription: string;
    sampleLines: string[];
}

export class CastingDirectorService {
    /**
     * Scans screenplay text, extracts all speaking character names (uppercase headings),
     * and automatically creates cast profiles in the Show Bible if they don't exist yet!
     */
    async syncCharactersFromScreenplay(bibleId: string, screenplayText: string): Promise<string[]> {
        if (!bibleId || !screenplayText) return [];

        const matches = screenplayText.match(/(?:^\s{15,}([A-Z][A-Z\s\-]+)$)|(?:^([A-Z][A-Z\s\-]+):)/gm);
        if (!matches) return [];

        const commonSluglines = ['INT', 'EXT', 'DAY', 'NIGHT', 'LATER', 'CONTINUOUS', 'CUT', 'FADE', 'SCENE', 'ACT'];
        const extractedNames = new Set<string>();

        for (let rawMatch of matches) {
            let name = rawMatch.replace(/^\s+/, '').replace(/:$/, '').trim();
            if (name.length > 1 && name.length < 25 && !commonSluglines.some(s => name.startsWith(s))) {
                name = name.replace(/\(.*?\)/g, '').trim();
                if (name) {
                    extractedNames.add(name.toUpperCase());
                }
            }
        }

        if (extractedNames.size === 0) return [];

        const existingChars = await Character.find({ bibleId: new mongoose.Types.ObjectId(bibleId) }).lean();
        const existingNames = existingChars.map(c => c.name);

        const syncedNames: string[] = [];

        for (const name of extractedNames) {
            try {
                const normalizedName = name.trim().toUpperCase();
                if (SKIP_NAMES_CORE.has(normalizedName)) continue;

                const variantMatch = isSpellingVariant(name, existingNames);
                if (variantMatch) {
                    if (variantMatch.toUpperCase() !== normalizedName) {
                        console.log(`[CastingDirector] Auto-merged spelling variant "${name}" -> "${variantMatch}" (Levenshtein ≤ 2)`);
                    }
                    continue;
                }

                const exists = await Character.findOne({
                    bibleId: new mongoose.Types.ObjectId(bibleId),
                    name: { $regex: new RegExp(`^${normalizedName}$`, 'i') }
                });

                if (!exists) {
                    console.log(`[CastingDirector] New character detected in screenplay: ${name}. Generating profile...`);
                    
                    const contextSnippet = this.extractCharacterLinesSnippet(screenplayText, name);
                    const prompt = `You are a professional casting director.
We detected a new character named "${name}" in the screenplay text.
Here are some of their speaking lines/context in the scene:
"""
${contextSnippet}
"""

Please analyze their speaking style, role, and actions, and generate a professional cast profile in valid JSON format.
Ensure you return ONLY the JSON block. Do not include any explanation.

JSON Schema:
{
    "role": "protagonist" | "antagonist" | "supporting" | "minor",
    "voiceDescription": "string (a descriptive phrase of how they sound, e.g., 'Sharp, confident, speaks with formal cadence')",
    "sampleLines": ["string", "string"], (2 short lines of their dialogue from the text)
    "traits": ["string", "string"], (2 traits, e.g. 'Highly strategic', 'Impatient')
    "motivation": "string (their immediate goal or motivation)"
}`;

                    const rawResponse = await aiServiceManager.chat(prompt);
                    let cleanJson = rawResponse.trim();
                    if (cleanJson.startsWith('```')) {
                        const jsonMatch = cleanJson.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
                        if (jsonMatch) cleanJson = jsonMatch[1];
                    }

                    let profile = {
                        age: 30,
                        role: 'supporting' as any,
                        voiceDescription: 'Clear speaking voice',
                        sampleLines: [] as string[],
                        traits: [] as string[],
                        motivation: 'To participate in the scene'
                    };

                    try {
                        const parsed = JSONHelper.dirtyRepair(cleanJson);
                        if (parsed.role) profile.role = parsed.role;
                        if (parsed.voiceDescription) profile.voiceDescription = parsed.voiceDescription;
                        if (parsed.sampleLines) profile.sampleLines = parsed.sampleLines;
                        if (parsed.traits) profile.traits = parsed.traits;
                        if (parsed.motivation) profile.motivation = parsed.motivation;
                    } catch (parseErr: any) {
                        console.error(`[CastingDirector] Failed to parse generated profile JSON for ${name}:`, parseErr.message);
                    }

                    const newChar = new Character({
                        bibleId: new mongoose.Types.ObjectId(bibleId),
                        name,
                        role: profile.role,
                        voice: {
                            description: profile.voiceDescription,
                            sampleLines: profile.sampleLines
                        },
                        traits: profile.traits,
                        motivation: profile.motivation,
                        currentStatus: 'Stable'
                    });

                    await newChar.save();
                    console.log(`[CastingDirector] Successfully created profile for character: ${name}`);
                    
                    try {
                        const { loreSyncService } = await import('./loreSync.service.js');
                        await loreSyncService.syncCharacter(newChar);
                        console.log(`[CastingDirector] Successfully synchronized character ${name} with Lore Graph`);
                    } catch (loreErr: any) {
                        console.error(`[CastingDirector] Lore sync failed for ${name}:`, loreErr.message);
                    }

                    syncedNames.push(name);
                }
            } catch (err: any) {
                console.error(`[CastingDirector] Error syncing character ${name}:`, err.message);
            }
        }

        return syncedNames;
    }

    /**
     * Proactively scans all Story Resources of a Bible, discovers the dramatic characters,
     * and proposes full casting profiles in an ensemble list.
     */
    async generateProactiveCastingCall(bibleId: string): Promise<ProposedCharacter[]> {
        const bible = await Bible.findById(bibleId);
        if (!bible) throw new Error('BIBLE_NOT_FOUND');
        if (!bible.storyResources || bible.storyResources.length === 0) {
            throw new Error('STORY_RESOURCES_REQUIRED');
        }

        // Gather existing character names to avoid duplicates
        const existingChars = await Character.find({ bibleId });
        const existingNames = existingChars.map(c => c.name.toUpperCase());
        const ignoredNames = bible.ignoredCharacterNames || [];

        const aggregatedResources = bible.storyResources.map(r => `--- ${r.title} (${r.type}) ---\n${r.content}`).join('\n\n');

        const prompt = `You are a world-class Hollywood Casting Director and Character Architect.
Your task is to analyze the following STORY RESOURCES (Source Material) and discover all dramatic speaking characters who should be cast in the screenplay ensemble.

## EXISTING CAST (DO NOT RE-PROPOSE THESE):
${existingNames.length > 0 ? existingNames.join(', ') : 'None'}

## IGNORE LIST (DO NOT RE-PROPOSE THESE):
${ignoredNames.length > 0 ? ignoredNames.join(', ') : 'None'}

## STORY RESOURCES:
"""
${aggregatedResources}
"""

## INSTRUCTIONS:
1. Identify all core speaking characters who play a role in the plot (e.g. Julius, Marcus).
2. STRICTLY FILTER OUT Place names/Locations (e.g. STREET, HALLWAY, THE CASTLE).
3. STRICTLY FILTER OUT Generic Background Extra names (e.g. OLD MAN 2, COP 1, DRIVER 3). We only want real characters.
4. For each discovered character, generate a rich cast profile in standard JSON format:
   - "name": UPPERCASE name (e.g., "JULIUS")
   - "role": "protagonist" | "antagonist" | "supporting" | "minor"
   - "traits": exactly 3 vivid character traits
   - "motivation": their primary motivation or narrative objective
   - "voiceDescription": visual speech style description (e.g., "Deep, resonant, uses theatrical vocabulary")
   - "sampleLines": exactly 2 lines of dialogue showing how they sound in character (e.g., "I won't trade our lineage for silver, Marcus.")

Ensure you return ONLY a valid JSON array of objects matching the schema. No markup, no conversational filler.`;

        const rawResponse = await aiServiceManager.chat(prompt, {
            model: 'thinking',
            temperature: 0.2
        });

        let cleanJson = rawResponse.trim();
        if (cleanJson.startsWith('```')) {
            const jsonMatch = cleanJson.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
            if (jsonMatch) cleanJson = jsonMatch[1];
        }

        try {
            const parsed = JSONHelper.dirtyRepair(cleanJson);
            if (Array.isArray(parsed)) {
                // Perform quick sanitization/filtering of ignored names or empty results
                return parsed.filter(p => p && p.name && !existingNames.includes(p.name.toUpperCase()) && !ignoredNames.includes(p.name.toLowerCase()));
            }
            return [];
        } catch (err: any) {
            console.error('[CastingDirector] Failed to parse proactive casting JSON:', err.message, cleanJson);
            return [];
        }
    }

    /**
     * Audits a scene goal and instruction against existing cast to detect missing characters
     * that should be cast before scene generation/rewriting begins.
     */
    async auditSceneCast(bibleId: string, sceneGoal: string, instruction: string): Promise<{ existingCharactersUsed: string[], newCharactersNeeded: ProposedCharacter[] }> {
        const bible = await Bible.findById(bibleId);
        if (!bible) throw new Error('BIBLE_NOT_FOUND');

        const existingChars = await Character.find({ bibleId });
        const existingNames = existingChars.map(c => c.name.toUpperCase());
        const ignoredNames = bible.ignoredCharacterNames || [];
        const aggregatedResources = bible.storyResources ? bible.storyResources.map(r => `--- ${r.title} ---\n${r.content}`).join('\n\n') : '';

        const prompt = `You are a professional Screenplay Script Auditor.
Analyze the following scene goals, instructions, and existing characters to audit who is participating in this scene.

SCENE DRAMATIC GOAL: "${sceneGoal}"
USER INSTRUCTION / COMMAND: "${instruction}"

## APPROVED CAST:
${existingNames.length > 0 ? existingNames.join(', ') : 'None'}

## IGNORE LIST (DO NOT RECOMMEND):
${ignoredNames.length > 0 ? ignoredNames.join(', ') : 'None'}

## STORY CONTEXT SUMMARY:
"""
${aggregatedResources.slice(0, 8000)}
"""

## YOUR TASK:
1. Determine which characters are needed to appear or speak in this scene.
2. Separate them into two groups:
   - "existingCharactersUsed": Array of names matching members in the APPROVED CAST.
   - "newCharactersNeeded": Array of newly introduced characters who do NOT exist in the APPROVED CAST, but are necessary for this scene.
3. For each NEW character, generate their profile using the JSON schema below:
   - "name": UPPERCASE name (e.g. "CLARA")
   - "role": "protagonist" | "antagonist" | "supporting" | "minor"
   - "traits": exactly 3 vivid traits
   - "motivation": their narrative objective in this scene
   - "voiceDescription": how they sound
   - "sampleLines": exactly 2 voice dialogue sample lines

STRICT FILTERING: Do NOT list places/locations or generic extras (like OLD MAN 2 or COP 1) in "newCharactersNeeded". Return them in "existingCharactersUsed" if they match existing, or ignore them.

Return ONLY a valid JSON object of the following format. Do not include markdown tags:
{
  "existingCharactersUsed": ["NAME1", "NAME2"],
  "newCharactersNeeded": [
    {
      "name": "NAME",
      "role": "supporting",
      "traits": ["Trait1", "Trait2", "Trait3"],
      "motivation": "...",
      "voiceDescription": "...",
      "sampleLines": ["...", "..."]
    }
  ]
}`;

        const rawResponse = await aiServiceManager.chat(prompt, {
            model: 'thinking',
            temperature: 0.1
        });

        let cleanJson = rawResponse.trim();
        if (cleanJson.startsWith('```')) {
            const jsonMatch = cleanJson.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
            if (jsonMatch) cleanJson = jsonMatch[1];
        }

        try {
            const parsed = JSONHelper.dirtyRepair(cleanJson);
            const existingCharactersUsed = Array.isArray(parsed.existingCharactersUsed) ? parsed.existingCharactersUsed : [];
            let newCharactersNeeded = Array.isArray(parsed.newCharactersNeeded) ? parsed.newCharactersNeeded : [];
            
            // Clean up and filter
            newCharactersNeeded = newCharactersNeeded.filter((p: any) => p && p.name && !existingNames.includes(p.name.toUpperCase()) && !ignoredNames.includes(p.name.toLowerCase()));

            return {
                existingCharactersUsed,
                newCharactersNeeded
            };
        } catch (err: any) {
            console.error('[CastingDirector] Failed to parse scene cast audit JSON:', err.message, cleanJson);
            return {
                existingCharactersUsed: [],
                newCharactersNeeded: []
            };
        }
    }

    private extractCharacterLinesSnippet(screenplay: string, charName: string): string {
        const lines = screenplay.split('\n');
        const snippetLines: string[] = [];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (line.startsWith(charName)) {
                snippetLines.push(lines.slice(Math.max(0, i - 1), Math.min(lines.length, i + 3)).join('\n'));
                if (snippetLines.length >= 3) break;
            }
        }
        return snippetLines.join('\n\n---\n\n');
    }
}

export const castingDirectorService = new CastingDirectorService();
