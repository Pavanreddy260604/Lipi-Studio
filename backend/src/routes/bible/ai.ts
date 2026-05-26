import { Request, Response, NextFunction } from 'express';
import { scriptGenerator } from '../../services/generator/index.js';
import { assertBibleAccess, formatAssistantContext } from './utils.js';

export async function projectAssistant(req: Request, res: Response, _next: NextFunction) {
    const { instruction, language, target, currentContext, currentContent, model, transliteration, mode } = req.body;
    if (!instruction || typeof instruction !== 'string' || !instruction.trim()) return res.status(400).json({ error: 'Instruction is required' });
    try {
        await assertBibleAccess(req.params.id, req.userId);
        const normalizedTarget = target === 'selection' ? 'selection' : 'scene';
        const rawSelection = req.body.selection;
        const selection = rawSelection && typeof rawSelection.text === 'string' && rawSelection.text.trim()
            ? { text: rawSelection.text, start: typeof rawSelection.start === 'number' ? rawSelection.start : undefined, end: typeof rawSelection.end === 'number' ? rawSelection.end : undefined, lineStart: typeof rawSelection.lineStart === 'number' ? rawSelection.lineStart : undefined, lineEnd: typeof rawSelection.lineEnd === 'number' ? rawSelection.lineEnd : undefined, lineCount: typeof rawSelection.lineCount === 'number' ? rawSelection.lineCount : undefined, charCount: typeof rawSelection.charCount === 'number' ? rawSelection.charCount : undefined, preview: typeof rawSelection.preview === 'string' ? rawSelection.preview : undefined }
            : null;
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.setHeader('Cache-Control', 'no-cache, no-transform');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('x-no-compression', 'true');
        res.socket?.setNoDelay(true);
        res.flushHeaders();
        
        const effectiveContent = typeof currentContent === 'string' ? currentContent : formatAssistantContext(currentContext);
        const stream = scriptGenerator.assistProject(req.params.id, instruction, { language, mode: mode || 'ask', target: normalizedTarget, currentContent: effectiveContent, selection, model, transliteration });
        
        let clientDisconnected = false;
        const handleClose = () => {
            clientDisconnected = true;
        };
        req.on('close', handleClose);
        req.on('aborted', handleClose);

        try {
            for await (const chunk of stream) {
                if (clientDisconnected) {
                    console.log('[BibleAPI] Client disconnected mid-stream from assistant, breaking generator.');
                    break;
                }
                res.write(chunk);
                if (typeof (res as any).flush === 'function') (res as any).flush();
            }
        } finally {
            req.off('close', handleClose);
            req.off('aborted', handleClose);
        }
        res.end();
    } catch (error) {
        if ((error as Error).message === 'ACCESS_DENIED') return res.status(403).json({ error: 'Access denied' });
        console.error('[BibleAPI] Assistant Error:', error);
        if (!res.headersSent) res.status(500).json({ error: 'Assistant request failed' });
        else res.end();
    }
}

export async function generateBeatSheet(req: Request, res: Response, _next: NextFunction) {
    const { structureType, targetSceneCount, customInstructions } = req.body;
    if (!structureType) return res.status(400).json({ error: 'structureType is required' });
    if (targetSceneCount && Number(targetSceneCount) > 300) {
        return res.status(400).json({ error: 'Maximum scene count cannot exceed 300' });
    }
    try {
        await assertBibleAccess(req.params.id, req.userId);
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.setHeader('Transfer-Encoding', 'chunked');
        res.setHeader('Cache-Control', 'no-cache, no-transform');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('x-no-compression', 'true');
        res.socket?.setNoDelay(true);
        res.flushHeaders();
        const { storyPlannerService } = await import('../../services/storyPlanner/index.js');
        const stream = storyPlannerService.generateFullBeatSheet({ bibleId: req.params.id, structureType, targetSceneCount: targetSceneCount ? Number(targetSceneCount) : undefined, customInstructions });
        
        let clientDisconnected = false;
        const handleClose = () => {
            clientDisconnected = true;
        };
        req.on('close', handleClose);
        req.on('aborted', handleClose);

        try {
            for await (const chunk of stream) {
                if (clientDisconnected) {
                    console.log('[BibleAPI] Client disconnected mid-stream from beat sheet, breaking generator.');
                    break;
                }
                res.write(chunk);
                if (typeof (res as any).flush === 'function') (res as any).flush();
            }
        } finally {
            req.off('close', handleClose);
            req.off('aborted', handleClose);
        }
        res.end();
    } catch (error) {
        if ((error as Error).message === 'ACCESS_DENIED') return res.status(403).json({ error: 'Access denied' });
        console.error('[BibleAPI] Beat Sheet Error:', error);
        if (!res.headersSent) res.status(500).json({ error: 'Beat sheet generation failed' });
        else res.end();
    }
}

export async function listStructures(_req: Request, res: Response, _next: NextFunction) {
    try {
        const { BEAT_SHEET_STRUCTURES } = await import('../../services/storyPlanner/index.js');
        res.json({ success: true, data: BEAT_SHEET_STRUCTURES });
    } catch {
        res.status(500).json({ error: 'Failed to fetch structures' });
    }
}
