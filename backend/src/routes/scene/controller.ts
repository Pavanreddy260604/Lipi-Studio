import { Request, Response, NextFunction } from 'express';
import { Scene } from '../../models/scene/index.js';
import { assertBibleAccess, assertSceneAccess, handleAccessError, isSequenceConflict } from './utils.js';
import { sanitizeScreenplayContent } from '../../utils/screenplayFormatting/index.js';

export async function listScenesByBible(req: Request, res: Response, _next: NextFunction) {
    try {
        await assertBibleAccess(req.params.bibleId, req.userId);
        const scenes = await Scene.find({ bibleId: req.params.bibleId }).sort({ sequenceNumber: 1 });
        res.json({ success: true, data: scenes });
    } catch (error) {
        console.error('[SceneAPI] List Error:', error);
        if (!handleAccessError(error, res)) res.status(500).json({ error: 'Failed to fetch scenes' });
    }
}

export async function createScene(req: Request, res: Response, _next: NextFunction) {
    const { bibleId, slugline, summary, sequenceNumber } = req.body;
    if (!bibleId || typeof bibleId !== 'string') return res.status(400).json({ error: 'Bible ID is required and must be a string' });
    if (!slugline || typeof slugline !== 'string' || slugline.trim().length === 0) return res.status(400).json({ error: 'Slugline is required and cannot be empty' });
    if (!/^(?:INT\.|EXT\.|INT\.\/EXT\.|I\/E\.)\s[^\r\n]+$/i.test(slugline.trim())) return res.status(400).json({ error: 'Invalid slugline format. Expected format: "INT. LOCATION - TIME" or "EXT. LOCATION - TIME"' });
    if (sequenceNumber !== undefined && (!Number.isInteger(sequenceNumber) || sequenceNumber < 1)) return res.status(400).json({ error: 'Sequence number must be a positive integer' });
    if (summary && typeof summary === 'string' && summary.length > 2000) return res.status(400).json({ error: 'Summary must be less than 2000 characters' });
    try {
        await assertBibleAccess(bibleId, req.userId);
        const createScene = async (seq: number) => Scene.create({ bibleId, sequenceNumber: seq, slugline: slugline.trim(), summary: summary?.trim() || '', status: 'planned', content: '' });
        if (sequenceNumber !== undefined) {
            try {
                const newScene = await createScene(sequenceNumber);
                return res.json({ success: true, data: newScene });
            } catch (error) {
                if (isSequenceConflict(error)) return res.status(409).json({ error: `Sequence number ${sequenceNumber} already exists for this project` });
                throw error;
            }
        }
        for (let attempt = 1; attempt <= 5; attempt++) {
            const lastScene = await Scene.findOne({ bibleId }).sort({ sequenceNumber: -1 }).select('sequenceNumber').lean();
            const nextSequence = (lastScene?.sequenceNumber || 0) + 1;
            try {
                const newScene = await createScene(nextSequence);
                return res.json({ success: true, data: newScene });
            } catch (error) {
                if (isSequenceConflict(error) && attempt < 5) continue;
                if (isSequenceConflict(error)) return res.status(409).json({ error: 'Could not allocate a unique scene sequence. Please retry.' });
                throw error;
            }
        }
        return res.status(409).json({ error: 'Could not allocate a unique scene sequence. Please retry.' });
    } catch (error) {
        console.error('[SceneAPI] Create Error:', error);
        if (!handleAccessError(error, res)) res.status(500).json({ error: 'Failed to create scene' });
    }
}

export async function updateScene(req: Request, res: Response, _next: NextFunction) {
    try {
        await assertSceneAccess(req.params.id, req.userId);
        const allowedFields = [
            'title',
            'slugline',
            'summary',
            'goal',
            'content',
            'status',
            'sequenceNumber',
            'feedback',
            'charactersInvolved',
            'mentionedItems',
            'critique',
            'lastCritiqueContent',
            'highScore',
            'pendingContent',
            'lastInstruction',
            'assistantChatHistory',
        ];
        const updateData: Record<string, unknown> = {};
        for (const field of allowedFields) { if (req.body[field] !== undefined) updateData[field] = req.body[field]; }
        if (typeof updateData.content === 'string') updateData.content = sanitizeScreenplayContent(updateData.content);
        if (typeof updateData.pendingContent === 'string') updateData.pendingContent = sanitizeScreenplayContent(updateData.pendingContent);
        if (updateData.status && !['planned', 'drafted', 'reviewed', 'final'].includes(updateData.status as string)) {
            return res.status(400).json({ error: 'Invalid status value' });
        }
        if (updateData.sequenceNumber !== undefined) {
            const seq = updateData.sequenceNumber;
            if (!Number.isInteger(seq) || (seq as number) < 1) {
                return res.status(400).json({ error: 'Sequence number must be a positive integer' });
            }
        }
        if (updateData.slugline === '' || updateData.summary === '') {
            return res.status(400).json({ error: 'slugline and summary cannot be empty' });
        }
        if (typeof updateData.slugline === 'string' && !/^(?:INT\.|EXT\.|INT\.\/EXT\.|I\/E\.)\s[^\r\n]+$/i.test(updateData.slugline.trim())) {
            return res.status(400).json({ error: 'Invalid slugline format. Expected format: "INT. LOCATION - TIME" or "EXT. LOCATION - TIME"' });
        }
        const updatedScene = await Scene.findByIdAndUpdate(req.params.id, { $set: updateData }, { new: true, runValidators: true });
        if (updatedScene && updateData.content && typeof updateData.content === 'string') {
            const { castingDirectorService } = await import('../../services/castingDirector.service.js');
            castingDirectorService.syncCharactersFromScreenplay(updatedScene.bibleId.toString(), updateData.content).catch(err => console.error(`[SceneAPI] Casting sync failed:`, err.message));
                const { characterDiscoveryService } = await import('../../services/characterDiscovery/index.js');
            characterDiscoveryService.discoverAndSave(updatedScene.bibleId.toString(), updateData.content).catch(err => console.error(`[SceneAPI] Character discovery sync failed:`, err.message));
        }
        res.json({ success: true, data: updatedScene });
    } catch (error) {
        if (!handleAccessError(error, res)) res.status(500).json({ error: 'Failed to update scene' });
    }
}

export async function deleteScene(req: Request, res: Response, _next: NextFunction) {
    try {
        const scene = await assertSceneAccess(req.params.id, req.userId);
        if (!scene) return res.status(404).json({ error: 'Scene not found' });
        const deletedScene = await Scene.findByIdAndDelete(req.params.id);
        res.json({ success: true, message: 'Scene deleted', data: deletedScene });
    } catch (error) {
        console.error('[SceneAPI] Delete Error:', error);
        if (!handleAccessError(error, res)) res.status(500).json({ error: 'Failed to delete scene' });
    }
}
