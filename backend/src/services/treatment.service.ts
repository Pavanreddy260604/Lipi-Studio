import { Treatment, ITreatment } from '../models/Treatment';
import { Scene } from '../models/scene/index.js';
import { aiServiceManager } from './aiManager/index.js';
import { buildBeatSheetPrompt } from '../prompts/hollywood/index.js';
import { characterDiscoveryService } from './characterDiscovery/index.js';
import { projectContextService } from './projectContext/index.js';
import { JSONHelper } from './parser/jsonHelper.js';
import mongoose from 'mongoose';

export class TreatmentService {
    private isSequenceConflict(error: any): boolean {
        if (!error || typeof error !== 'object') return false;
        if (error.code !== 11000) return false;
        const keyPattern = error.keyPattern || {};
        if (keyPattern.bibleId && keyPattern.sequenceNumber) return true;
        return String(error.message || '').includes('bibleId_1_sequenceNumber_1');
    }

    /**
     * Generates a Beat Sheet (Treatment) from a logline using the AI Service Manager.
     * Returns the structured object (preview) but does not save it yet.
     */
    async generatePreview(logline: string, style: string = 'Save The Cat', sceneCount: number = 60, cast: any[] = [], bibleId?: string): Promise<any> {
        let prompt = buildBeatSheetPrompt(logline, style, sceneCount, cast);

        if (bibleId) {
            try {
                const projectCtx = await projectContextService.build(bibleId);
                const contextBlock = projectContextService.toPromptBlock(projectCtx);
                prompt = `${contextBlock}\n\n${prompt}`;
                if (process.env.NODE_ENV !== 'production') { console.log(`[TreatmentService] Injected project context for bible: ${bibleId}`); }
            } catch (err) {
                console.warn('[TreatmentService] Failed to load project context (falling back to baseline logline prompt):', err);
            }
        }

        if (process.env.NODE_ENV !== 'production') { console.log(`[TreatmentService] Generating beat sheet for: "${logline}"`); }

        try {
            // Use non-streaming chat with JSON mode enabled for reliability
            // Larger scene counts require more tokens (estimate ~150 per scene + prompt overhead)
            const maxTokens = Math.min(8192, Math.max(4000, sceneCount * 150));
            const response = await aiServiceManager.chat(prompt, { 
                model: 'deep',
                format: 'json',
                max_tokens: maxTokens,
                webSearch: false
            });

            // Trigger character discovery in background if bibleId is available
            if (bibleId) {
                characterDiscoveryService.discoverAndSave(bibleId, response).catch(err => {
                    console.error('[TreatmentService] Character discovery background error:', err);
                });
            }

            let jsonStr = response.trim();

            // Sanitize markdown if present (even in JSON mode models sometimes add it)
            jsonStr = jsonStr.replace(/^```json\s*/i, '').replace(/\s*```$/, '');

            // Find valid JSON boundaries
            const firstBrace = jsonStr.indexOf('{');
            const lastBrace = jsonStr.lastIndexOf('}');

            if (firstBrace !== -1 && lastBrace !== -1) {
                jsonStr = jsonStr.substring(firstBrace, lastBrace + 1);
            }

            try {
                const data = JSONHelper.dirtyRepair(jsonStr);
                // Defensive Check: Ensure the structure is { acts: [...] }
                if (Array.isArray(data)) {
                    return { acts: data };
                }
                if (!data.acts && Array.isArray(data.data)) {
                    return { acts: data.data };
                }
                return data;
            } catch (error) {
                console.error('[TreatmentService] JSON Parse Error:', error, 'Raw Output:', jsonStr);
                throw new Error('AI output was not valid JSON.');
            }
        } catch (error) {
            console.error('[TreatmentService] Failed to generate/parse Beat Sheet JSON:', error);
            throw new Error('AI failed to generate a valid Beat Sheet structure. Please try again.');
        }
    }

    /**
     * Saves a confirmed Treatment to database.
     */
    async saveTreatment(bibleId: string, logline: string, acts: any[], style: string = 'Save The Cat'): Promise<ITreatment> {
        // Validation Fallback: Ensure every beat has the required 'name' and 'description' fields
        const sanitizedActs = acts.map(act => ({
            ...act,
            name: act.name || 'Untitled Act',
            beats: (act.beats || []).map((beat: any) => ({
                ...beat,
                name: beat.name || beat.title || 'Untitled Beat',
                description: beat.description || beat.summary || beat.tactic || 'No description provided.'
            }))
        }));

        const treatment = await Treatment.create({
            bibleId: new mongoose.Types.ObjectId(bibleId),
            logline,
            style,
            acts: sanitizedActs
        });
        return treatment;
    }

    /**
     * Converts a Treatment into actual Scene documents.
     */
    async convertToScenes(treatmentId: string): Promise<{ count: number, scenes: any[] }> {
        const treatment = await Treatment.findById(treatmentId);
        if (!treatment) throw new Error('Treatment not found');

        const scenesCreated = [];
        let seq = 1;

        // Get current max sequence number to append
        const lastScene = await Scene.findOne({ bibleId: treatment.bibleId }).sort({ sequenceNumber: -1 });
        if (lastScene) seq = lastScene.sequenceNumber + 1;

        for (const act of treatment.acts) {
            for (const beat of act.beats) {
                const MAX_SEQUENCE_RETRIES = 5;
                let created: any = null;

                for (let attempt = 1; attempt <= MAX_SEQUENCE_RETRIES; attempt++) {
                    try {
                        created = await Scene.create({
                            bibleId: treatment.bibleId,
                            sequenceNumber: seq,
                            title: beat.title || beat.name,
                            slugline: beat.slugline || `EXT. ${beat.name.toUpperCase()} - DAY`,
                            summary: beat.description || beat.summary,
                            goal: `Execute beat: ${beat.name || beat.title}`,
                            status: 'planned'
                        });
                        seq += 1;
                        break;
                    } catch (error) {
                        if (this.isSequenceConflict(error) && attempt < MAX_SEQUENCE_RETRIES) {
                            seq += 1;
                            continue;
                        }
                        throw error;
                    }
                }

                if (!created) {
                    throw new Error(`Failed to allocate unique sequence for beat "${beat.name || beat.title || 'Untitled'}"`);
                }

                scenesCreated.push(created);
            }
        }

        return { count: scenesCreated.length, scenes: scenesCreated };
    }
}

export const treatmentService = new TreatmentService();
