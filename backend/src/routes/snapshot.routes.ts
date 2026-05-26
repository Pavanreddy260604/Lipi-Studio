import express from 'express';
import { versionControlService } from '../services/versionControl.service';
import { analysisService } from '../services/analysis/index.js';
import { Scene } from '../models/scene/index.js';
import { Bible } from '../models/Bible';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticate);

async function assertBibleAccess(bibleId: string, userId?: string) {
    const bible = await Bible.findOne({ _id: bibleId, userId });
    if (!bible) throw new Error('ACCESS_DENIED');
    return bible;
}

function handleAccessError(error: any, res: express.Response) {
    if ((error as Error).message === 'ACCESS_DENIED') {
        res.status(403).json({ error: 'Access denied' });
        return true;
    }
    return false;
}

// GET /api/script/snapshot/bible/:bibleId - List snapshots
router.get('/bible/:bibleId', async (req, res) => {
    try {
        await assertBibleAccess(req.params.bibleId, req.userId);
        const branch = req.query.branch as string | undefined;
        const snapshots = await versionControlService.listSnapshots(req.params.bibleId, branch);
        res.json({ success: true, data: snapshots });
    } catch (error) {
        if (!handleAccessError(error, res)) {
            res.status(500).json({ error: 'Failed to list snapshots' });
        }
    }
});

// POST /api/script/snapshot/bible/:bibleId - Save a snapshot
router.post('/bible/:bibleId', async (req, res) => {
    const { label, description, branch } = req.body;
    if (!label || typeof label !== 'string' || !label.trim()) {
        return res.status(400).json({ error: 'Snapshot label is required' });
    }
    try {
        await assertBibleAccess(req.params.bibleId, req.userId);
        const snapshot = await versionControlService.saveSnapshot(
            req.params.bibleId,
            label.trim(),
            description,
            branch || 'main',
        );
        res.json({ success: true, data: snapshot });
    } catch (error) {
        if (!handleAccessError(error, res)) {
            res.status(500).json({ error: 'Failed to save snapshot' });
        }
    }
});

// GET /api/script/snapshot/:id - Get snapshot details
router.get('/:id', async (req, res) => {
    try {
        const snapshot = await versionControlService.getSnapshot(req.params.id);
        if (!snapshot) return res.status(404).json({ error: 'Snapshot not found' });
        res.json({ success: true, data: snapshot });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch snapshot' });
    }
});

// POST /api/script/snapshot/:id/restore - Restore from snapshot
router.post('/:id/restore', async (req, res) => {
    try {
        const result = await versionControlService.restoreSnapshot(req.params.id);
        res.json({ success: true, data: result });
    } catch (error) {
        res.status(500).json({ error: 'Failed to restore snapshot' });
    }
});

// DELETE /api/script/snapshot/:id - Delete a snapshot
router.delete('/:id', async (req, res) => {
    try {
        await versionControlService.deleteSnapshot(req.params.id);
        res.json({ success: true, message: 'Snapshot deleted' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete snapshot' });
    }
});

// GET /api/script/snapshot/bible/:bibleId/branches - List branches
router.get('/bible/:bibleId/branches', async (req, res) => {
    try {
        await assertBibleAccess(req.params.bibleId, req.userId);
        const branches = await versionControlService.listBranches(req.params.bibleId);
        res.json({ success: true, data: branches });
    } catch (error) {
        if (!handleAccessError(error, res)) {
            res.status(500).json({ error: 'Failed to list branches' });
        }
    }
});

// POST /api/script/analyze/dialogue/:sceneId - Analyze dialogue rhythm
router.post('/analyze/dialogue/:sceneId', async (req, res) => {
    try {
        const scene = await Scene.findById(req.params.sceneId);
        if (!scene) return res.status(404).json({ error: 'Scene not found' });
        await assertBibleAccess(scene.bibleId.toString(), req.userId);
        const report = await analysisService.analyzeDialogueRhythm(req.params.sceneId);
        res.json({ success: true, data: report });
    } catch (error) {
        if (!handleAccessError(error, res)) {
            res.status(500).json({ error: 'Failed to analyze dialogue' });
        }
    }
});

// POST /api/script/analyze/structure/:bibleId - Analyze structure
router.post('/analyze/structure/:bibleId', async (req, res) => {
    try {
        await assertBibleAccess(req.params.bibleId, req.userId);
        const report = await analysisService.analyzeStructure(req.params.bibleId);
        res.json({ success: true, data: report });
    } catch (error) {
        if (!handleAccessError(error, res)) {
            res.status(500).json({ error: 'Failed to analyze structure' });
        }
    }
});

export const snapshotRoutes = router;
