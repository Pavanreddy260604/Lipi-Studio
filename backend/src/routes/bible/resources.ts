import { Request, Response, NextFunction } from 'express';
import { assertBibleAccess } from './utils.js';

export async function addResource(req: Request, res: Response, _next: NextFunction) {
    const { title, content, type } = req.body;
    if (!content || typeof content !== 'string' || !content.trim()) return res.status(400).json({ error: 'Content is required' });
    try {
        const bible = await assertBibleAccess(req.params.id, req.userId);
        if (!bible.storyResources) bible.storyResources = [];
        if (bible.storyResources.length >= 20) return res.status(400).json({ error: 'Maximum 20 story resources per project' });
        bible.storyResources.push({ title: title || 'Untitled Resource', content: content.slice(0, 100000), type: type || 'notes', addedAt: new Date() } as any);
        await bible.save();
        res.json({ success: true, data: bible.storyResources });
    } catch (error) {
        if ((error as Error).message === 'ACCESS_DENIED') return res.status(403).json({ error: 'Access denied' });
        console.error('[BibleAPI] Add Resource Error:', error);
        res.status(500).json({ error: 'Failed to add resource' });
    }
}

export async function uploadResource(req: Request, res: Response, _next: NextFunction) {
    try {
        const multer = (await import('multer')).default;
        const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 }, fileFilter: (_req: any, file: any, cb: any) => { const allowed = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain']; if (allowed.includes(file.mimetype)) cb(null, true); else cb(new Error('Only PDF, DOCX, and TXT files are accepted')); } }).single('file');
        upload(req as any, res as any, async (err: any) => {
            if (err) return res.status(400).json({ error: err.message || 'Upload failed' });
            const file = (req as any).file;
            if (!file) return res.status(400).json({ error: 'No file uploaded' });
            try {
                const bible = await assertBibleAccess(req.params.id, req.userId);
                if (!bible.storyResources) bible.storyResources = [];
                if (bible.storyResources.length >= 20) return res.status(400).json({ error: 'Maximum 20 story resources per project' });
                let extractedText = '';
                if (file.mimetype === 'application/pdf') {
                    const pdfParse = (await import('pdf-parse')).default;
                    const parsed = await pdfParse(file.buffer);
                    extractedText = parsed.text;
                } else if (file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
                    const mammoth = await import('mammoth');
                    const result = await mammoth.extractRawText({ buffer: file.buffer });
                    extractedText = result.value;
                } else {
                    extractedText = file.buffer.toString('utf-8');
                }
                if (!extractedText.trim()) return res.status(400).json({ error: 'No text could be extracted from the file' });
                const resourceType = file.mimetype === 'application/pdf' ? 'novel_excerpt' : 'reference';
                bible.storyResources.push({ title: req.body.title || file.originalname || 'Uploaded Document', content: extractedText.slice(0, 100000), type: resourceType, sourceFilename: file.originalname, addedAt: new Date() } as any);
                await bible.save();
                res.json({ success: true, data: bible.storyResources, extractedChars: extractedText.length });
            } catch (innerError) {
                if ((innerError as Error).message === 'ACCESS_DENIED') return res.status(403).json({ error: 'Access denied' });
                console.error('[BibleAPI] Upload Resource Error:', innerError);
                res.status(500).json({ error: 'Failed to process uploaded file' });
            }
        });
    } catch (error) {
        console.error('[BibleAPI] Upload Setup Error:', error);
        res.status(500).json({ error: 'Upload system error' });
    }
}

export async function deleteResource(req: Request, res: Response, _next: NextFunction) {
    try {
        const bible = await assertBibleAccess(req.params.id, req.userId);
        if (!bible.storyResources) return res.status(404).json({ error: 'No resources found' });
        const resourceIndex = bible.storyResources.findIndex((r: any) => r._id?.toString() === req.params.resourceId);
        if (resourceIndex === -1) return res.status(404).json({ error: 'Resource not found' });
        bible.storyResources.splice(resourceIndex, 1);
        await bible.save();
        res.json({ success: true, data: bible.storyResources });
    } catch (error) {
        if ((error as Error).message === 'ACCESS_DENIED') return res.status(403).json({ error: 'Access denied' });
        console.error('[BibleAPI] Delete Resource Error:', error);
        res.status(500).json({ error: 'Failed to delete resource' });
    }
}

export async function listResources(req: Request, res: Response, _next: NextFunction) {
    try {
        const bible = await assertBibleAccess(req.params.id, req.userId);
        const resources = (bible.storyResources || []).map((r: any) => ({ _id: r._id, title: r.title, type: r.type, sourceFilename: r.sourceFilename, addedAt: r.addedAt, contentLength: r.content?.length || 0 }));
        res.json({ success: true, data: resources });
    } catch (error) {
        if ((error as Error).message === 'ACCESS_DENIED') return res.status(403).json({ error: 'Access denied' });
        res.status(500).json({ error: 'Failed to fetch resources' });
    }
}
