import { Scene } from '../models/scene/index.js';
import { Bible } from '../models/Bible';
import PDFDocument from 'pdfkit';

export class ExportService {

    async compileProject(bibleId: string, format: 'fountain' | 'txt' | 'json'): Promise<string> {
        // Validate bibleId
        if (!bibleId || typeof bibleId !== 'string') {
            throw new Error('Invalid bible ID provided');
        }

        const bible = await Bible.findById(bibleId);
        const scenes = await Scene.find({ bibleId }).sort({ sequenceNumber: 1 });

        if (!bible) throw new Error('Bible not found');

        if (format === 'json') {
            return JSON.stringify({ bible, scenes }, null, 2);
        }

        let output = '';

        // Title Page (Fountain Standard)
        // Sanitize title to prevent injection in output
        const sanitizedTitle = this.sanitizeFountainText(bible.title || 'Untitled');
        output += `Title: ${sanitizedTitle}\n`;
        output += `Credit: Written by\n`;
        output += `Author: Screenwriter AI\n`;
        output += `Draft date: ${new Date().toLocaleDateString()}\n`;
        output += `Contact: \n`;
        output += `\n`; // End Title Page
        output += `\n`;

        // Scenes
        for (const scene of scenes) {
            output += `\n`; // Space before scene header
            // Sanitize slugline
            const sanitizedSlugline = this.sanitizeFountainText(scene.slugline || 'INT. UNKNOWN - TIME');
            output += `${sanitizedSlugline.toUpperCase()}\n`;

            if (scene.content) {
                // Remove existing FADE IN/sluglines if they are redundant in the content
                // But generally users might have edited them.
                // For safety, we just append the content.
                // ideally we strip the first line if it matches the slugline to avoid double headers
                let cleanContent = scene.content.trim();
                const lines = cleanContent.split('\n');
                if (lines.length > 0 && lines[0].includes(scene.slugline)) {
                    cleanContent = lines.slice(1).join('\n').trim();
                }

                // Sanitize content
                const sanitizedContent = this.sanitizeFountainText(cleanContent);
                output += `\n${sanitizedContent}\n`;
            } else {
                // If no content, just print the summary as a note
                const sanitizedSummary = this.sanitizeFountainText(scene.summary || 'No summary');
                output += `\n[[Scene Summary: ${sanitizedSummary}]]\n`;
            }
        }

        return output;
    }

    async generatePDF(bibleId: string): Promise<Buffer> {
        // Compile raw text first
        const rawContent = await this.compileProject(bibleId, 'txt');
        const lines = rawContent.split('\n');

        return new Promise((resolve, reject) => {
            try {
                // PDFKit Setup: Courier 12pt is Hollywood standard
                const doc = new PDFDocument({
                    margin: 72, // 1 inch all around base margin
                    size: 'LETTER',
                    font: 'Courier' // Standard screenplay font
                });

                const buffers: Buffer[] = [];
                doc.on('data', buffers.push.bind(buffers));
                doc.on('end', () => {
                    const pdfData = Buffer.concat(buffers);
                    resolve(pdfData);
                });
                doc.on('error', reject);

                // Start rendering lines
                doc.fontSize(12);

                for (let i = 0; i < lines.length; i++) {
                    const line = lines[i];
                    if (!line.trim()) {
                        doc.moveDown();
                        continue;
                    }

                    // Basic formatting heuristics:
                    // 1. Scene Headings (INT./EXT. usually ALL CAPS and left-aligned)
                    // 2. Character names (ALL CAPS, usually centered or indented ~3.5 inches)
                    // 3. Dialogue (indented ~2.5 inches, right margin ~6.0 inches)
                    // 4. Parentheticals (indented ~3.1 inches)
                    // 5. Action (flush left: 1.5 inches usually, we'll use base margin)

                    const isSceneHeading = /^(INT\.|EXT\.|INT\.\/EXT\.|I\/E\.)/i.test(line.trim());
                    // Rough heuristic for Character Name: ALL CAPS, short, usually followed by dialogue next line
                    const isPotentiallyCharacter = line === line.toUpperCase() && line.trim().length > 0 && line.trim().length < 40 && !isSceneHeading && !line.startsWith('Title:') && !line.startsWith('Credit:') && !line.startsWith('Author:') && !line.startsWith('Draft date:') && !line.startsWith('Contact:');

                    const isParenthetical = line.trim().startsWith('(') && line.trim().endsWith(')');

                    if (line.startsWith('Title:') || line.startsWith('Credit:') || line.startsWith('Author:') || line.startsWith('Draft date:') || line.startsWith('Contact:')) {
                        // Title Page Elements
                        doc.text(line.trim(), { align: 'center' });
                    } else if (isSceneHeading) {
                        // Scene Heading: Flush Left, uppercase
                        doc.text(line.trim().toUpperCase(), 108 /* 1.5 inch */, doc.y);
                    } else if (isPotentiallyCharacter) {
                        // Character: Centered or roughly 3.5 inches from left (252 pts)
                        doc.text(line.trim(), 252, doc.y);
                    } else if (isParenthetical) {
                        // Parenthetical: roughly 3.1 inches from left (223 pts)
                        doc.text(line.trim(), 223, doc.y, { width: 150 });
                    } else {
                        // Action or Dialogue
                        // If it follows a character or parenthetical, it's likely dialogue
                        let isDialogue = false;
                        if (i > 0) {
                            const prevLine = lines[i - 1].trim();
                            const prevIsCharacter = prevLine === prevLine.toUpperCase() && prevLine.length > 0 && prevLine.length < 40 && !/^(INT\.|EXT\.)/i.test(prevLine);
                            const prevIsParenthetical = prevLine.startsWith('(') && prevLine.endsWith(')');
                            if (prevIsCharacter || prevIsParenthetical) {
                                isDialogue = true;
                            }
                        }

                        if (isDialogue) {
                            // Dialogue: roughly 2.5 inches from left (180 pts), max width ~330 pts
                            doc.text(line.trim(), 180, doc.y, { width: 330 });
                        } else {
                            // Action: Flush left at 1.5 inches (108 pts), max width ~432 pts
                            doc.text(line.trim(), 108, doc.y, { width: 432 });
                        }
                    }
                }

                doc.end();
            } catch (err) {
                reject(err);
            }
        });
    }

    /**
     * Sanitize text for Fountain format output.
     * Prevents potential injection issues and ensures clean output.
     */
    private sanitizeFountainText(text: string): string {
        if (!text || typeof text !== 'string') {
            return '';
        }
        // Remove any potentially dangerous characters while preserving formatting
        // Limit length to prevent abuse
        const MAX_LENGTH = 50000;
        const sanitized = text
            .replace(/\0/g, '') // Remove null bytes
            .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, ''); // Remove control characters

        return sanitized.length > MAX_LENGTH
            ? sanitized.slice(0, MAX_LENGTH) + '\n[Content truncated due to length]'
            : sanitized;
    }
}

export const exportService = new ExportService();
