import mongoose from 'mongoose';
import { Treatment, ITreatment } from '../../models/Treatment.js';
import { Scene } from '../../models/scene/index.js';
import { generateOutlineGraph as generateOutline } from './generate.js';
import { GenerateOutlineParams } from './types.js';

export class BeatOrchestratorService {
    async *generateOutlineGraph(params: GenerateOutlineParams): AsyncGenerator<string, void, unknown> {
        yield* generateOutline(params);
    }

    async updateBeatCard(
        bibleId: string,
        beatIdOrName: string,
        updateFields: {
            title?: string;
            slugline?: string;
            description?: string;
            summary?: string;
        }
    ): Promise<ITreatment> {
        const treatment = await Treatment.findOne({ bibleId: new mongoose.Types.ObjectId(bibleId) });
        if (!treatment) throw new Error('Beat Outline not found for this project.');

        let found = false;
        for (const act of treatment.acts) {
            for (const beat of act.beats) {
                const isMatch = (beat as any)._id?.toString() === beatIdOrName || beat.name === beatIdOrName;
                if (isMatch) {
                    if (updateFields.title !== undefined) beat.title = updateFields.title;
                    if (updateFields.slugline !== undefined) beat.slugline = updateFields.slugline;
                    if (updateFields.description !== undefined) beat.description = updateFields.description;
                    if (updateFields.summary !== undefined) beat.summary = updateFields.summary;
                    found = true;
                    break;
                }
            }
            if (found) break;
        }

        if (!found) throw new Error(`Beat card matching "${beatIdOrName}" was not found.`);

        await treatment.save();
        return treatment;
    }

    async syncToScenes(bibleId: string): Promise<any[]> {
        const treatment = await Treatment.findOne({ bibleId: new mongoose.Types.ObjectId(bibleId) });
        if (!treatment) throw new Error('No outline treatment exists to sync.');

        const scenesCreated = [];
        let seq = 1;

        await Scene.deleteMany({ bibleId: treatment.bibleId, status: 'planned' });

        const lastScene = await Scene.findOne({ bibleId: treatment.bibleId }).sort({ sequenceNumber: -1 });
        if (lastScene) seq = lastScene.sequenceNumber + 1;

        const allCharacters = await mongoose.model('Character').find({ bibleId: treatment.bibleId }).select('_id name').lean();

        for (const act of treatment.acts) {
            for (const beat of act.beats) {
                const scanText = `${beat.title || beat.name} ${beat.description}`.toLowerCase();
                const matchedIds = allCharacters
                    .filter((c: any) => c.name && scanText.includes(c.name.toLowerCase()))
                    .map((c: any) => c._id);

                const created = await Scene.create({
                    bibleId: treatment.bibleId,
                    sequenceNumber: seq,
                    title: beat.title || beat.name,
                    slugline: beat.slugline || `EXT. ${beat.name.toUpperCase().replace(/\s+/g, '_')} - DAY`,
                    summary: beat.description,
                    goal: `Execute beat: ${beat.name}`,
                    charactersInvolved: matchedIds,
                    status: 'planned'
                });
                seq += 1;
                scenesCreated.push(created);
            }
        }

        return scenesCreated;
    }
}

export const beatOrchestratorService = new BeatOrchestratorService();
