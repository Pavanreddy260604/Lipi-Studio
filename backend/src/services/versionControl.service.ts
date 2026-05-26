import { ScriptSnapshot } from '../models/ScriptSnapshot';
import { Scene } from '../models/scene/index.js';
import { Bible } from '../models/Bible';
import mongoose from 'mongoose';

export class VersionControlService {
    async saveSnapshot(
        bibleId: string,
        label: string,
        description?: string,
        branch: string = 'main',
    ) {
        const scenes = await Scene.find({ bibleId }).sort({ sequenceNumber: 1 });
        const bible = await Bible.findById(bibleId);
        if (!bible) throw new Error('Bible not found');

        const sceneSnapshots = scenes.map(s => ({
            sceneId: s._id,
            sequenceNumber: s.sequenceNumber,
            title: s.title || '',
            slugline: s.slugline,
            content: s.content || '',
            summary: s.summary || '',
        }));

        const totalWords = scenes.reduce((acc, s) => acc + ((s.content || '').trim().split(/\s+/).filter(Boolean).length), 0);
        const allContent = scenes.map(s => s.content || '').join(' ');
        const characterCount = allContent.replace(/\s/g, '').length;

        return ScriptSnapshot.create({
            bibleId: typeof bibleId === 'string' ? new mongoose.Types.ObjectId(bibleId) : bibleId,
            label,
            description,
            branch,
            sceneSnapshots,
            metadata: {
                sceneCount: scenes.length,
                wordCount: totalWords,
                characterCount,
            },
        });
    }

    async listSnapshots(bibleId: string, branch?: string) {
        const filter: any = { bibleId: new mongoose.Types.ObjectId(bibleId) };
        if (branch) filter.branch = branch;
        return ScriptSnapshot.find(filter)
            .sort({ createdAt: -1 })
            .select('label description branch metadata createdAt')
            .lean();
    }

    async getSnapshot(snapshotId: string) {
        return ScriptSnapshot.findById(snapshotId);
    }

    async restoreSnapshot(snapshotId: string) {
        const snapshot = await ScriptSnapshot.findById(snapshotId);
        if (!snapshot) throw new Error('Snapshot not found');

        const scenes = await Scene.find({ bibleId: snapshot.bibleId });
        const snapshotSceneIds = new Set(snapshot.sceneSnapshots.map(s => s.sceneId.toString()));

        for (const snapScene of snapshot.sceneSnapshots) {
            await Scene.findByIdAndUpdate(snapScene.sceneId, {
                title: snapScene.title,
                slugline: snapScene.slugline,
                content: snapScene.content,
                summary: snapScene.summary,
            });
        }

        // Delete scenes created after the snapshot
        const scenesToDelete = scenes
            .filter(s => !snapshotSceneIds.has(s._id.toString()))
            .map(s => s._id);
        if (scenesToDelete.length > 0) {
            await Scene.deleteMany({ _id: { $in: scenesToDelete } });
        }

        return { restored: snapshot.sceneSnapshots.length, removed: scenesToDelete.length };
    }

    async listBranches(bibleId: string) {
        const branches = await ScriptSnapshot.distinct('branch', { bibleId: new mongoose.Types.ObjectId(bibleId) });
        return branches.length > 0 ? branches : ['main'];
    }

    async deleteSnapshot(snapshotId: string) {
        return ScriptSnapshot.findByIdAndDelete(snapshotId);
    }
}

export const versionControlService = new VersionControlService();
