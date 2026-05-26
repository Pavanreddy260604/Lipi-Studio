
import { Router } from 'express';
import os from 'os';
import mongoose from 'mongoose';
import { adminService } from '../services/admin/index.js';
import multer from 'multer';
import {
    extractStructuredTextFromFile,
    extractStructuredTextFromRawContent
} from '../utils/fileParser/index.js';
import { MasterScript } from '../models/MasterScript';
import { User } from '../models/User';
import { Bible } from '../models/Bible';
import { Scene } from '../models/scene/model';
import { authenticate, requireAdmin } from '../middleware/auth';

const router = Router();

// Apply authentication to all admin master script routes
router.use(authenticate);

// Middleware to verify that the master script belongs to the authenticated user
const verifyScriptOwnership = async (req: any, res: any, next: any) => {
    try {
        const script = await MasterScript.findOne({ _id: req.params.id, userId: req.userId });
        if (!script) {
            return res.status(404).json({ success: false, error: 'Master script not found or access denied' });
        }
        next();
    } catch (err: any) {
        res.status(500).json({ success: false, error: err.message });
    }
};

// Configure multer for memory storage (file buffer)
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

/**
 * @route   GET /api/script/admin/master-scripts
 * @desc    Get all professional master scripts
 */
router.get('/master-scripts', async (req, res) => {
    try {
        const scripts = await adminService.getAllMasterScripts(req.userId!);
        res.json({ success: true, data: scripts });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * @route   GET /api/script/admin/master-scripts/:id/chunks
 * @desc    Get all indexed chunks for a specific master script
 */
router.get('/master-scripts/:id/chunks', verifyScriptOwnership, async (req, res) => {
    try {
        const scriptVersion = typeof req.query.scriptVersion === 'string' ? req.query.scriptVersion : undefined;
        const chunks = await adminService.getMasterScriptChunks(req.params.id, scriptVersion);
        res.json({ success: true, data: chunks });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * @route   GET /api/script/admin/master-scripts/:id/reconstructed
 * @desc    Get the exact reconstructed script text for a specific version
 */
router.get('/master-scripts/:id/reconstructed', verifyScriptOwnership, async (req, res) => {
    try {
        const scriptVersion = typeof req.query.scriptVersion === 'string' ? req.query.scriptVersion : undefined;
        const reconstructed = await adminService.getMasterScriptReconstructedScript(req.params.id, scriptVersion);
        res.json({ success: true, data: reconstructed });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * @route   GET /api/script/admin/master-scripts/:id/validation-report
 * @desc    Get latest (or version-scoped) validation report for a master script
 */
router.get('/master-scripts/:id/validation-report', verifyScriptOwnership, async (req, res) => {
    try {
        const scriptVersion = typeof req.query.scriptVersion === 'string' ? req.query.scriptVersion : undefined;
        const report = await adminService.getMasterScriptValidationReport(req.params.id, scriptVersion);
        res.json({ success: true, data: report });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * @route   POST /api/script/admin/master-scripts
 * @desc    Upload a new master script (Pending status) - Accepts multipart form data
 */
router.post('/master-scripts', upload.single('file'), async (req, res) => {
    try {
        const { title, director, language, tags, rawContent } = req.body;
        let extractedSource = rawContent
            ? extractStructuredTextFromRawContent(String(rawContent), 'raw_text')
            : undefined;
        let normalizedTags: string[] = [];

        // If a file was uploaded, parse its content and override manual rawContent
        if (req.file) {
            console.log(`[AdminAPI] Received file upload: ${req.file.originalname} (${req.file.mimetype})`);
            extractedSource = await extractStructuredTextFromFile(req.file.buffer, req.file.mimetype, req.file.originalname);
        }

        if (Array.isArray(tags)) {
            normalizedTags = tags.map(value => String(value).trim()).filter(Boolean);
        } else if (typeof tags === 'string' && tags.trim().length > 0) {
            try {
                const parsed = JSON.parse(tags);
                normalizedTags = Array.isArray(parsed)
                    ? parsed.map(value => String(value).trim()).filter(Boolean)
                    : [];
            } catch {
                normalizedTags = tags.split(',').map((value: string) => value.trim()).filter(Boolean);
            }
        }

        if (!extractedSource || extractedSource.rawContent.trim().length === 0) {
            return res.status(400).json({ error: 'Script content is required (either via file upload or raw text)' });
        }

        // Reconstruct the script data
        const scriptData = {
            title,
            director,
            language,
            tags: normalizedTags,
            rawContent: extractedSource.rawContent,
            extractedSource
        };

        const script = await adminService.createMasterScript(req.userId!, scriptData);
        res.status(201).json({ success: true, data: script });
    } catch (error: any) {
        console.error('[AdminAPI] Master script creation failed:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * @route   POST /api/script/admin/master-scripts/:id/process
 * @desc    Trigger AI ingestion/indexing of a master script
 */
router.post('/master-scripts/:id/process', verifyScriptOwnership, async (req, res) => {
    try {
        const script = await MasterScript.findById(req.params.id).select('status processingScriptVersion gateStatus');
        if (!script) {
            return res.status(404).json({ success: false, error: 'Master script not found' });
        }
        if (script.status === 'processing') {
            return res.status(202).json({
                success: true,
                data: {
                    message: 'Ingestion already in progress',
                    scriptId: req.params.id,
                    scriptVersion: script.processingScriptVersion || null,
                    gateStatus: script.gateStatus || 'pending'
                }
            });
        }

        const runInfo = await adminService.startMasterScriptProcessing(req.params.id);

        res.status(202).json({
            success: true,
            data: {
                message: 'Ingestion started in background',
                scriptId: req.params.id,
                scriptVersion: runInfo.scriptVersion,
                gateStatus: runInfo.gateStatus
            }
        });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * @route   POST /api/script/admin/master-scripts/:id/audit
 * @desc    Trigger a Great Expectations audit for a script version
 */
router.post('/master-scripts/:id/audit', verifyScriptOwnership, async (req, res) => {
    try {
        const scriptVersion = typeof req.body?.scriptVersion === 'string' ? req.body.scriptVersion : undefined;
        const result = await adminService.runGeAudit(req.params.id, scriptVersion);
        res.json({ success: true, data: result });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * @route   DELETE /api/script/admin/master-scripts/:id
 * @desc    Delete a master script and all associated embeddings/data
 */
router.delete('/master-scripts/:id', verifyScriptOwnership, async (req, res) => {
    try {
        await adminService.deleteMasterScript(req.params.id);
        res.json({ success: true, data: { message: 'Master script deleted successfully' } });
    } catch (error: any) {
        console.error('[AdminAPI] Failed to delete script %s:', req.params.id, error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * @route   GET /api/script/admin/metrics
 * @desc    Return server metrics (CPU, memory, uptime, Node, MongoDB)
 */
router.get('/metrics', requireAdmin, async (_req, res) => {
    try {
        const cpus = os.cpus();
        const loadAvg = os.loadavg();
        const totalMem = os.totalmem();
        const freeMem = os.freemem();
        const usedMem = totalMem - freeMem;
        const memPercent = Math.round((usedMem / totalMem) * 100);

        const mongoState = mongoose.connection.readyState;
        const stateMap: Record<number, string> = {
            0: 'disconnected',
            1: 'connected',
            2: 'connecting',
            3: 'disconnecting',
        };

        res.json({
            success: true,
            data: {
                hostname: os.hostname(),
                platform: os.platform(),
                arch: os.arch(),
                uptime: os.uptime(),
                cpu: {
                    model: cpus[0]?.model || 'unknown',
                    count: cpus.length,
                    speed: cpus[0]?.speed || 0,
                    loadAverage: {
                        '1m': loadAvg[0],
                        '5m': loadAvg[1],
                        '15m': loadAvg[2],
                    },
                },
                memory: {
                    total: totalMem,
                    free: freeMem,
                    used: usedMem,
                    usagePercent: memPercent,
                },
                node: {
                    version: process.version,
                    pid: process.pid,
                    uptime: process.uptime(),
                    memoryUsage: process.memoryUsage(),
                },
                mongo: {
                    state: stateMap[mongoState] || 'unknown',
                },
            },
        });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * @route   GET /api/script/admin/users
 * @desc    List all users with basic stats — admin only
 */
router.get('/users', requireAdmin, async (_req, res) => {
    try {
        const users = await User.find({}).select('name email role createdAt emailVerified').sort({ createdAt: -1 }).lean();

        const enriched = await Promise.all(users.map(async (u) => {
            const projectCount = await Bible.countDocuments({ userId: u._id });
            const sceneCount = await Scene.countDocuments({ userId: u._id });
            return { ...u, projectCount, sceneCount };
        }));

        res.json({ success: true, data: enriched });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * @route   GET /api/script/admin/users/:id
 * @desc    Get user detail with activity breakdown — admin only
 */
router.get('/users/:id', requireAdmin, async (req, res) => {
    try {
        const user = await User.findById(req.params.id).select('-passwordHash -geminiApiKey -encryptionIV').lean();
        if (!user) return res.status(404).json({ success: false, error: 'User not found' });

        const projects = await Bible.find({ userId: user._id }).select('title genre logline targetSceneCount createdAt updatedAt').sort({ updatedAt: -1 }).lean();
        const projectIds = projects.map(p => p._id);
        const sceneCount = await Scene.countDocuments({ userId: user._id });
        const scenesByProject = await Scene.aggregate([
            { $match: { bibleId: { $in: projectIds } } },
            { $group: { _id: '$bibleId', count: { $sum: 1 } } },
        ]);

        const projectsWithCounts = projects.map(p => ({
            ...p,
            sceneCount: scenesByProject.find(s => s._id.toString() === p._id.toString())?.count || 0,
        }));

        res.json({
            success: true,
            data: {
                user,
                projects: projectsWithCounts,
                totalProjects: projects.length,
                totalScenes: sceneCount,
            },
        });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

export default router;
