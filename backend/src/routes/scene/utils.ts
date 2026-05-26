import { Scene } from '../../models/scene/index.js';
import { Bible } from '../../models/Bible.js';

export async function assertBibleAccess(bibleId: string, userId?: string) {
    const bible = await Bible.findOne({ _id: bibleId, userId });
    if (!bible) throw new Error('ACCESS_DENIED');
    return bible;
}

export async function assertSceneAccess(sceneId: string, userId?: string) {
    const scene = await Scene.findById(sceneId);
    if (!scene) return null;
    await assertBibleAccess(scene.bibleId.toString(), userId);
    return scene;
}

export function handleAccessError(error: any, res: any): boolean {
    if ((error as Error).message === 'ACCESS_DENIED') {
        res.status(403).json({ error: 'Access denied' });
        return true;
    }
    return false;
}

export function isSequenceConflict(error: any): boolean {
    if (!error || typeof error !== 'object') return false;
    const e = error as any;
    if (e.code !== 11000) return false;
    const keyPattern = e.keyPattern || {};
    if (keyPattern.bibleId && keyPattern.sequenceNumber) return true;
    return String(e.message || '').includes('bibleId_1_sequenceNumber_1');
}
