import { Request, Response, NextFunction } from 'express';
import { Scene } from '../../models/scene/index.js';
import { Bible } from '../../models/Bible.js';
import mongoose from 'mongoose';
import { scriptGenerator } from '../../services/generator/index.js';
import { criticService } from '../../services/critic.service.js';
import { assertBibleAccess, assertSceneAccess, handleAccessError } from './utils.js';
import { sanitizeScreenplayContent } from '../../utils/screenplayFormatting/index.js';

export async function generateContent(req: Request, res: Response, _next: NextFunction) {
    const { style, format, characterIds, sceneLength, language } = req.body;
    try {
        const scene = await Scene.findById(req.params.id).populate('bibleId');
        if (!scene) return res.status(404).json({ error: 'Scene not found' });
        await assertBibleAccess((scene.bibleId as any)._id.toString(), req.userId);
        const validatedStyle = ['classic', 'tarantino', 'nolan', 'sorkin', 'wes_anderson', 'fincher'].includes(style) ? style : 'classic';
        const validatedFormat = ['film', 'tv', 'short'].includes(format) ? format : 'film';
        const validatedLength = ['short', 'medium', 'long'].includes(sceneLength) ? sceneLength : 'medium';
        if (characterIds && !Array.isArray(characterIds)) return res.status(400).json({ error: 'characterIds must be an array' });
        let previousContext = '';
        if (scene.sequenceNumber > 1) {
            const prevScene = await Scene.findOne({ bibleId: (scene.bibleId as any)._id, sequenceNumber: scene.sequenceNumber - 1 });
            if (prevScene) {
                const ctx = prevScene.summary || (prevScene.content ? prevScene.content.slice(0, 500) : 'No previous content');
                previousContext = `In the previous scene (${prevScene.slugline || 'Unknown'}): ${ctx}`;
                if (scene.previousSceneSummary !== previousContext) { scene.previousSceneSummary = previousContext; await scene.save(); }
            }
        }
        const promptIdea = `Generate the full dialogue and action for ONLY the active scene described in the mandatory scene brief above.`;
        const request = {
            userId: req.userId || 'anonymous',
            idea: promptIdea,
            format: validatedFormat,
            style: validatedStyle,
            bibleId: (scene.bibleId as any)._id.toString(),
            sceneId: scene._id.toString(),
            sceneSequenceNumber: scene.sequenceNumber,
            sceneSlugline: scene.slugline || '',
            sceneSummary: scene.summary || '',
            sceneGoal: scene.goal || '',
            characterIds,
            previousContext,
            sceneLength: validatedLength,
            language: language || 'English',
            era: req.body.era
        };
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.setHeader('Cache-Control', 'no-cache, no-transform');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('x-no-compression', 'true');
        res.socket?.setNoDelay(true);
        res.flushHeaders();
        let fullContent = '';
        let clientDisconnected = false;
        const handleClose = () => {
            clientDisconnected = true;
        };
        req.on('close', handleClose);
        req.on('aborted', handleClose);

        try {
            for await (const chunk of scriptGenerator.generateScript(request)) {
                if (clientDisconnected) {
                    console.log('[SceneAPI] Client disconnected mid-stream from content generator, breaking loop.');
                    break;
                }
                res.write(chunk);
                if (typeof (res as any).flush === 'function') (res as any).flush();
                fullContent += chunk;
            }
        } finally {
            req.off('close', handleClose);
            req.off('aborted', handleClose);
        }
        scene.pendingContent = sanitizeScreenplayContent(fullContent);
        scene.status = 'drafted';
        await scene.save();
        await scriptGenerator.waitForBackgroundTasks();
        res.end();
    } catch (error) {
        console.error('[SceneAPI] Generate Error:', error);
        if (!handleAccessError(error, res)) { if (!res.headersSent) res.status(500).json({ error: 'Generation failed' }); else res.end(); }
    }
}

export async function critiqueScene(req: Request, res: Response, _next: NextFunction) {
    try {
        const scene = await assertSceneAccess(req.params.id, req.userId);
        if (!scene) return res.status(404).json({ error: 'Scene not found' });
        const bible = await Bible.findOne({ _id: scene.bibleId });
        const genre = bible?.genre || 'General';
        const language = (bible as any)?.language || 'English';
        const rules = (bible as any)?.rules || [];
        const contentToCritique = req.body.content || scene.content;
        if (!contentToCritique) return res.status(400).json({ error: 'Scene has no content to critique' });
        const result = await criticService.evaluateScene(contentToCritique, scene.goal || scene.summary, genre, language, rules);
        scene.critique = result;
        scene.status = 'reviewed';
        const currentBest = scene.highScore?.critique?.score || 0;
        const newScore = result.score || 0;
        if (newScore >= currentBest) { scene.highScore = { content: contentToCritique, critique: result, savedAt: new Date() }; }
        await scene.save();
        res.json({ success: true, data: result, isNewBest: newScore >= currentBest, highScore: scene.highScore?.critique?.score || 0 });
    } catch (error) {
        console.error('[SceneAPI] Critique Error:', error);
        if (!handleAccessError(error, res)) res.status(500).json({ error: 'Critique failed' });
    }
}

export async function fixScene(req: Request, res: Response, _next: NextFunction) {
    try {
        const scene = await assertSceneAccess(req.params.id, req.userId);
        if (!scene) return res.status(404).json({ error: 'Scene not found' });
        if (!scene.critique) return res.status(400).json({ error: 'Scene must be analyzed before applying fixes' });
        const originalContent = req.body.content || scene.content;
        const { instruction } = req.body;
        if (!originalContent) return res.status(400).json({ error: 'Scene has no content to fix' });
        const startTime = Date.now();
        const currentBestScore = scene.highScore?.critique?.score || scene.critique?.score || 0;
        const bible = await mongoose.model('Bible').findById(scene.bibleId).lean();
        const genre = (bible as any)?.genre || 'General';
        const language = (bible as any)?.language || 'English';
        const rules = (bible as any)?.rules || [];
        let bestAttempt: { content: string; critique: any } | null = null;
        try {
            const attempt1Content = await scriptGenerator.reviseSceneBatch(originalContent, scene.critique, scene.goal || scene.summary, false, currentBestScore, language, scene.bibleId, scene._id, instruction);
            const attempt1Critique = await criticService.evaluateScene(attempt1Content, scene.goal || scene.summary, genre, language, rules);
            bestAttempt = { content: attempt1Content, critique: attempt1Critique };
            if (attempt1Critique.score <= currentBestScore && currentBestScore < 95) {
                const attempt2Content = await scriptGenerator.reviseSceneBatch(originalContent, attempt1Critique, scene.goal || scene.summary, true, currentBestScore, language, scene.bibleId, scene._id, instruction);
                const attempt2Critique = await criticService.evaluateScene(attempt2Content, scene.goal || scene.summary, genre, language, rules);
                if (attempt2Critique.score > attempt1Critique.score) bestAttempt = { content: attempt2Content, critique: attempt2Critique };
            }
            const auditNotes = await scriptGenerator.generateAuditNotes(originalContent, bestAttempt.content);
            res.json({ success: true, data: { content: bestAttempt.content, critique: bestAttempt.critique, auditNotes, isSuperior: bestAttempt.critique.score > currentBestScore, benchmarkScore: currentBestScore, latencyMs: Date.now() - startTime } });
        } catch (chainError) {
            console.error('[SceneAPI] Audit Chain failed midway:', chainError);
            if (bestAttempt) return res.json({ success: true, data: { content: bestAttempt.content, critique: bestAttempt.critique, auditNotes: 'Note: Professional audit was interrupted due to high latency, however a quality revision was still successfully prepared.', isSuperior: bestAttempt.critique.score >= currentBestScore, benchmarkScore: currentBestScore, isPartial: true } });
            throw chainError;
        }
    } catch (error) {
        console.error('[SceneAPI] Fix Error:', error);
        if (!handleAccessError(error, res)) { if (!res.headersSent) res.status(500).json({ error: 'Failed to apply fixes' }); else res.end(); }
    }
}

export async function commitEdit(req: Request, res: Response, _next: NextFunction) {
    try {
        const scene = await assertSceneAccess(req.params.id, req.userId);
        if (!scene) return res.status(404).json({ error: 'Scene not found' });
        const success = await scriptGenerator.commitAssistedEdit(req.params.id);
        res.json({ success: true, data: { success } });
    } catch (error) {
        if (!handleAccessError(error, res)) res.status(500).json({ success: false, error: 'Commit failed', data: null });
    }
}

export async function assistedEdit(req: Request, res: Response, _next: NextFunction) {
    const { instruction, language, mode, target, currentContent, model, transliteration, selection } = req.body;
    if (!instruction) return res.status(400).json({ error: 'Instruction is required' });
    try {
        const scene = await Scene.findById(req.params.id);
        if (!scene) return res.status(404).json({ error: 'Scene not found' });
        await assertBibleAccess(scene.bibleId.toString(), req.userId);
        const normalizedTarget = target === 'selection' ? 'selection' : 'scene';
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.setHeader('Cache-Control', 'no-cache, no-transform');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('x-no-compression', 'true');
        res.socket?.setNoDelay(true);
        res.flushHeaders();
        const stream = scriptGenerator.assistedEdit(req.params.id, instruction, { language, mode: mode || 'agent', target: normalizedTarget, currentContent: typeof currentContent === 'string' ? currentContent : undefined, model, transliteration, selection: selection || undefined });
        
        let clientDisconnected = false;
        const handleClose = () => {
            clientDisconnected = true;
        };
        req.on('close', handleClose);
        req.on('aborted', handleClose);

        try {
            for await (const chunk of stream) {
                if (clientDisconnected) {
                    console.log('[SceneAPI] Client disconnected mid-stream from assisted edit, breaking loop.');
                    break;
                }
                res.write(chunk);
                if (typeof (res as any).flush === 'function') (res as any).flush();
            }
        } finally {
            req.off('close', handleClose);
            req.off('aborted', handleClose);
        }
        await scriptGenerator.waitForBackgroundTasks();
        res.end();
    } catch (error) {
        console.error('[SceneAssistant] Edit Error:', error);
        if (!handleAccessError(error, res)) { if (!res.headersSent) res.status(500).json({ error: 'Edit failed' }); else res.end(); }
    }
}
