import express from 'express';
import { treatmentService } from '../services/treatment.service';
import { beatOrchestratorService } from '../services/beat/index.js';
import { Treatment } from '../models/Treatment';
import { authenticate } from '../middleware/auth.js';
import { Bible } from '../models/Bible';
import { aiLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

router.use(authenticate);

async function assertBibleAccess(bibleId: string, userId?: string) {
    const bible = await Bible.findOne({ _id: bibleId, userId });
    if (!bible) throw new Error('ACCESS_DENIED');
    return bible;
}

async function assertTreatmentAccess(treatmentId: string, userId?: string) {
    const treatment = await Treatment.findById(treatmentId);
    if (!treatment) return null;
    await assertBibleAccess(treatment.bibleId.toString(), userId);
    return treatment;
}

// POST /api/treatment/generate
// Generate a Beat Sheet (Preview only)
router.post('/generate', aiLimiter, async (req, res) => {
    const { logline, style, sceneCount, cast, bibleId } = req.body;
    if (!bibleId || !logline) {
        return res.status(400).json({ error: 'Bible ID and Logline are required' });
    }

    try {
        await assertBibleAccess(bibleId, req.userId);
        const data = await treatmentService.generatePreview(logline, style, sceneCount, cast, bibleId);
        res.json({ success: true, data });
    } catch (error: any) {
        console.error('[TreatmentAPI] Generate Error:', error);
        if (error.message === 'ACCESS_DENIED') {
            res.status(403).json({ error: 'Access denied' });
        } else {
            res.status(500).json({ error: error.message || 'Generation failed' });
        }
    }
});

// POST /api/treatment/save
// Save a confirmed Treatment
router.post('/save', async (req, res) => {
    const { bibleId, logline, acts, style } = req.body;
    if (!bibleId || !acts) return res.status(400).json({ error: 'Bible ID and acts are required' });

    const validStyles = ['save_the_cat', 'heros_journey', 'three_act', 'tv_beat_sheet', 'five_act', 'story_circle', 'sequence_approach', 'indian_commercial', 'fictional_pulse'];
    if (style && !validStyles.includes(style)) {
        return res.status(400).json({ error: 'Invalid structure style' });
    }

    try {
        await assertBibleAccess(bibleId, req.userId);
        const treatment = await treatmentService.saveTreatment(bibleId, logline, acts, style);
        res.json({ success: true, data: treatment });
    } catch (error: any) {
        console.error('[TreatmentAPI] Save Error:', error);
        if (error.message === 'ACCESS_DENIED') {
            res.status(403).json({ error: 'Access denied' });
        } else {
            res.status(500).json({ error: error.message || 'Save failed' });
        }
    }
});

// GET /api/treatment/bible/:bibleId
// List treatments for a project
router.get('/bible/:bibleId', async (req, res) => {
    try {
        await assertBibleAccess(req.params.bibleId, req.userId);
        const treatments = await Treatment.find({ bibleId: req.params.bibleId }).sort({ createdAt: -1 });
        res.json({ success: true, data: treatments });
    } catch (error) {
        if ((error as Error).message === 'ACCESS_DENIED') {
            res.status(403).json({ error: 'Access denied' });
        } else {
            res.status(500).json({ error: 'Failed to fetch treatments' });
        }
    }
});

// POST /api/treatment/convert
// Convert Treatment to Scenes
router.post('/convert', async (req, res) => {
    const { treatmentId } = req.body;
    if (!treatmentId) return res.status(400).json({ error: 'Treatment ID is required' });

    try {
        await assertTreatmentAccess(treatmentId, req.userId);
        const result = await treatmentService.convertToScenes(treatmentId);
        res.json({ success: true, data: result });
    } catch (error: any) {
        console.error('[TreatmentAPI] Convert Error:', error);
        if (error.message === 'ACCESS_DENIED') {
            res.status(403).json({ error: 'Access denied' });
        } else {
            res.status(500).json({ error: error.message || 'Conversion failed' });
        }
    }
});

// ============================================
// SPECIALIZED BEAT AGENT (DIRECTOR) ENDPOINTS
// ============================================

// POST /api/treatment/agent/generate
// Generate high-level outline graph via the Director Agent (Streaming for high stability)
router.post('/agent/generate', aiLimiter, async (req, res) => {
    const { bibleId, logline, structureType, sceneCount, customInstructions, cast } = req.body;
    if (!bibleId || !logline) {
        return res.status(400).json({ error: 'Bible ID and Logline are required' });
    }

    try {
        await assertBibleAccess(bibleId, req.userId);

        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.setHeader('Transfer-Encoding', 'chunked');
        res.setHeader('Cache-Control', 'no-cache, no-transform');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('x-no-compression', 'true');
        res.socket?.setNoDelay(true);
        res.flushHeaders();

        const stream = beatOrchestratorService.generateOutlineGraph({
            bibleId,
            logline,
            structureType: structureType || 'save_the_cat',
            sceneCount: Number(sceneCount || 60),
            customInstructions,
            cast: cast || []
        });

        let clientDisconnected = false;
        const handleClose = () => {
            clientDisconnected = true;
        };
        req.on('close', handleClose);
        req.on('aborted', handleClose);

        try {
            for await (const chunk of stream) {
                if (clientDisconnected) {
                    console.log('[BeatAgentAPI] Client disconnected mid-stream, breaking generator.');
                    break;
                }
                res.write(chunk);
                if (typeof (res as any).flush === 'function') {
                    (res as any).flush();
                }
            }
        } finally {
            req.off('close', handleClose);
            req.off('aborted', handleClose);
        }

        res.end();
    } catch (error: any) {
        console.error('[BeatAgentAPI] Generate Error:', error);
        if (!res.headersSent) {
            res.status(500).json({ error: error.message || 'Beat Agent generation failed' });
        } else {
            res.end();
        }
    }
});

// PATCH /api/treatment/agent/card
// Asynchronously update a single beat card details in the outline
router.patch('/agent/card', async (req, res) => {
    const { bibleId, beatIdOrName, updateFields } = req.body;
    if (!bibleId || !beatIdOrName || !updateFields) {
        return res.status(400).json({ error: 'Bible ID, Beat ID/Name, and update fields are required' });
    }

    try {
        await assertBibleAccess(bibleId, req.userId);
        
        const updatePromise = beatOrchestratorService.updateBeatCard(bibleId, beatIdOrName, updateFields);
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Card update timed out')), 20000));
        const data = await Promise.race([updatePromise, timeoutPromise]);
        
        res.json({ success: true, data });
    } catch (error: any) {
        console.error('[BeatAgentAPI] Card Update Error:', error);
        res.status(500).json({ error: error.message || 'Card update failed' });
    }
});

// POST /api/treatment/agent/sync
// Sync the entire beat outline cards directly into planned scene records
router.post('/agent/sync', async (req, res) => {
    const { bibleId } = req.body;
    if (!bibleId) {
        return res.status(400).json({ error: 'Bible ID is required' });
    }

    try {
        await assertBibleAccess(bibleId, req.userId);
        
        const syncPromise = beatOrchestratorService.syncToScenes(bibleId);
        const timeoutPromise = new Promise<any[]>((_, reject) => setTimeout(() => reject(new Error('Sync operation timed out')), 30000));
        const scenes = await Promise.race([syncPromise, timeoutPromise]);
        
        res.json({ success: true, count: scenes.length, data: scenes });
    } catch (error: any) {
        console.error('[BeatAgentAPI] Sync Error:', error);
        res.status(500).json({ error: error.message || 'Synchronization to scenes failed' });
    }
});

export const treatmentRoutes = router;
