import express from 'express';
import mongoose from 'mongoose';
import { scriptGenerator } from '../services/generator/index.js';
import type { ScriptRequest } from '../services/generator/types.js';
import { intentService } from '../services/intent.service';
import { FORMAT_TEMPLATES, STYLE_PROMPTS } from '../prompts/hollywood/index.js';
import { Script } from '../models/Script';
import { Bible } from '../models/Bible';
import { Character } from '../models/Character';
import { authenticate } from '../middleware/auth.js';
import { aiLimiter, aiCritiqueLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

// All script routes require authentication
router.use(authenticate);

// GET /api/script/templates - List available formats and styles
router.get('/templates', (req, res) => {
    // Convert maps to arrays for frontend consumption
    const formats = Object.entries(FORMAT_TEMPLATES).map(([id, data]) => ({
        id,
        name: data.name,
        description: data.duration
    }));

    const styles = Object.entries(STYLE_PROMPTS).map(([id, data]) => ({
        id,
        name: data.name,
        description: (data as any).characteristics?.join(', ') || 'Standard style'
    }));

    res.json({
        success: true,
        data: {
            formats,
            styles
        }
    });
});

// GET /api/script/history - List user scripts
router.get('/history', async (req, res) => {
    const userId = req.userId;

    try {
        const scripts = await Script.find({ userId, isDeleted: false })
            .select('title prompt format style status createdAt metadata')
            .sort({ createdAt: -1 })
            .limit(20);

        res.json({
            success: true,
            data: scripts
        });
    } catch (error) {
        console.error('[API] Fetch history error:', error);
        res.status(500).json({ error: 'Failed to fetch history' });
    }
});

// GET /api/script/history/:id - Get single script
router.get('/history/:id', async (req, res) => {
    try {
        const script = await Script.findById(req.params.id);

        if (!script || script.userId.toString() !== req.userId) {
            return res.status(404).json({ error: 'Script not found' });
        }

        res.json({
            success: true,
            data: script
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch script' });
    }
});

// POST /api/script/generate - Serialize and stream the script
router.post('/generate', aiLimiter, async (req, res) => {
    const request: ScriptRequest = { ...req.body, userId: req.userId as string };

    // Basic Validation
    if (!request.userId) {
        return res.status(400).json({ error: 'User ID is required' });
    }
    if (!request.idea) {
        return res.status(400).json({ error: 'Idea is required' });
    }
    if (!request.format || !FORMAT_TEMPLATES[request.format]) {
        return res.status(400).json({ error: 'Invalid format' });
    }
    if (!request.style || !STYLE_PROMPTS[request.style]) {
        return res.status(400).json({ error: 'Invalid style' });
    }
    if (request.bibleId && typeof request.bibleId !== 'string') {
        return res.status(400).json({ error: 'bibleId must be a string' });
    }
    if (request.bibleId && !mongoose.Types.ObjectId.isValid(request.bibleId)) {
        return res.status(400).json({ error: 'Invalid bibleId format' });
    }
    if (request.characterIds !== undefined) {
        if (!Array.isArray(request.characterIds)) {
            return res.status(400).json({ error: 'characterIds must be an array of strings' });
        }
        if (request.characterIds.some((id) => typeof id !== 'string' || !mongoose.Types.ObjectId.isValid(id))) {
            return res.status(400).json({ error: 'characterIds must contain valid IDs only' });
        }
        request.characterIds = Array.from(new Set(request.characterIds));
    }

    // Enforce project/character ownership to prevent cross-tenant data access.
    try {
        if (request.bibleId) {
            const bible = await Bible.findOne({ _id: request.bibleId, userId: request.userId })
                .select('_id')
                .lean();
            if (!bible) {
                return res.status(403).json({ error: 'Access denied for the selected project' });
            }
        }

        if (request.characterIds && request.characterIds.length > 0) {
            if (!request.bibleId) {
                return res.status(400).json({ error: 'bibleId is required when characterIds are provided' });
            }

            const characterCount = await Character.countDocuments({
                _id: { $in: request.characterIds },
                bibleId: request.bibleId
            });

            if (characterCount !== request.characterIds.length) {
                return res.status(403).json({ error: 'One or more characters are outside this project' });
            }
        }
    } catch (error) {
        console.error('[API] Scope validation error:', error);
        return res.status(500).json({ error: 'Failed to validate generation scope' });
    }

    // Set headers for simple text streaming
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('x-no-compression', 'true');
    res.socket?.setNoDelay(true);
    res.flushHeaders();

    try {
        console.log(`[API] Generating script: ${request.format}/${request.style} for user ${request.userId}`);

        let clientDisconnected = false;
        const handleClose = () => {
            clientDisconnected = true;
        };
        req.on('close', handleClose);
        req.on('aborted', handleClose);

        try {
            for await (const chunk of scriptGenerator.generateScript(request)) {
                if (clientDisconnected) {
                    console.log('[ScriptAPI] Client disconnected mid-stream, breaking generator.');
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

        await scriptGenerator.waitForBackgroundTasks();

        res.end();
    } catch (error: any) {
        console.error('[API] Generation error:', error);
        // If headers haven't been sent (unlikely given streaming), send 500
        if (!res.headersSent) {
            res.status(500).json({ error: 'Generation failed' });
        } else {
            // If streaming started, we can't change status, but we can end the stream
            res.write('\n\n[ERROR: Generation interrupted]');
            res.end();
        }
    }
});

// POST /api/script/assistant/classify - High-performance AI intent classification
router.post('/assistant/classify', async (req, res) => {
    const { instruction, context } = req.body;

    if (!instruction) {
        return res.status(400).json({ error: 'Instruction is required' });
    }

    try {
        const result = await intentService.classifyIntentElite(instruction, {
            hasScene: Boolean(context?.hasScene),
            hasSelection: Boolean(context?.hasSelection),
            currentMode: context?.currentMode || 'ask'
        });

        res.json({
            success: true,
            data: result
        });
    } catch (error) {
        console.error('[API] Classification error:', error);
        res.status(500).json({ error: 'Classification failed' });
    }
});

export const scriptRoutes = router;
