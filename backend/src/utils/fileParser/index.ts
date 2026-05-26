import * as path from 'path';
import mammoth from 'mammoth';
import type { ExtractedMasterScriptSource, MasterScriptSourceFormat } from '../../types/masterScriptLayout';
import { extractStructuredTextFromRawContent } from './parser.js';
import { LayoutPDFReader } from './pdf.js';

export const extractStructuredTextFromFile = async (
    fileBuffer: Buffer,
    mimetype: string,
    originalName: string
): Promise<ExtractedMasterScriptSource> => {
    const ext = path.extname(originalName).toLowerCase();

    try {
        if (
            mimetype === 'text/plain' ||
            mimetype === 'text/markdown' ||
            ext === '.txt' ||
            ext === '.md' ||
            ext === '.fountain' ||
            ext === '.script'
        ) {
            const rawContent = fileBuffer.toString('utf-8');
            const sourceFormat: MasterScriptSourceFormat =
                ext === '.md' ? 'md' :
                    ext === '.fountain' ? 'fountain' :
                        ext === '.script' ? 'script' :
                            ext === '.txt' ? 'txt' :
                                'raw_text';

            return extractStructuredTextFromRawContent(rawContent, sourceFormat);
        }

        if (mimetype === 'application/pdf' || ext === '.pdf') {
            const reader = new LayoutPDFReader();
            return reader.loadData(fileBuffer);
        }

        if (
            mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
            ext === '.docx'
        ) {
            const result = await mammoth.extractRawText({ buffer: fileBuffer });
            return extractStructuredTextFromRawContent(result.value, 'docx');
        }

        throw new Error(`Unsupported file type: ${mimetype || ext}. Please upload PDF, DOCX, TXT, MD, Fountain, or Script files.`);
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`[FileParser] Error extracting text from ${originalName}: ${message}`);
        throw new Error(`Failed to parse file: ${message}`);
    }
};

export const extractTextFromFile = async (
    fileBuffer: Buffer,
    mimetype: string,
    originalName: string
): Promise<string> => {
    const extracted = await extractStructuredTextFromFile(fileBuffer, mimetype, originalName);
    return extracted.rawContent;
};

export { extractStructuredTextFromRawContent } from './parser.js';
