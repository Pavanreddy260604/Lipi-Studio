import mongoose from 'mongoose';
import { IngestionManifest } from '../../models/IngestionManifest';
import { MasterScript, IMasterScript } from '../../models/MasterScript';
import { MasterScriptSourceLine } from '../../models/MasterScriptSourceLine';
import { VoiceSample } from '../../models/VoiceSample';
import { vectorService } from '../vector/index.js';
import { MasterScriptValidationReport } from '../../models/MasterScriptValidationReport';
import { extractStructuredTextFromRawContent } from '../../utils/fileParser/index.js';
import type { ExtractedMasterScriptSource, MasterScriptSourceLayoutLine } from '../../types/masterScriptLayout';
import { createScriptVersion, buildTitlePageSummary, applySourceMetadata } from './helpers.js';

export { createScriptVersion };

export async function prepareManifest(scriptId: mongoose.Types.ObjectId, scriptVersion: string) {
    let manifest = await IngestionManifest.findOne({
        jobType: 'master_script', targetId: scriptId, scriptVersion
    });
    if (!manifest) manifest = new IngestionManifest({ jobType: 'master_script', targetId: scriptId, scriptVersion });
    manifest.status = 'processing';
    manifest.gateStatus = 'pending';
    manifest.geAuditStatus = undefined;
    manifest.totalChunks = 0;
    manifest.successfulChunks = 0;
    manifest.failedChunks = 0;
    manifest.readerReady = manifest.readerReady || false;
    manifest.ragReady = false;
    manifest.errorLogs = [];
    await manifest.save();
    return manifest;
}

export async function resetVersionArtifacts(
    scriptId: mongoose.Types.ObjectId,
    scriptVersion: string,
    options: { preserveSourceLines?: boolean } = {}
): Promise<void> {
    try {
        await vectorService.deleteSamplesByMasterScriptVersion(scriptId.toString(), scriptVersion);
    } catch (error) {
        if (process.env.NODE_ENV !== 'production') console.warn(`[AdminService] Failed to clear vector data for ${scriptId.toString()} @ ${scriptVersion}:`, error);
    }
    await Promise.all([
        VoiceSample.deleteMany({ masterScriptId: scriptId, scriptVersion }),
        ...(options.preserveSourceLines ? [] : [MasterScriptSourceLine.deleteMany({ masterScriptId: scriptId, scriptVersion })]),
        MasterScriptValidationReport.deleteMany({ masterScriptId: scriptId, scriptVersion })
    ]);
}

export async function ensureSourceLayoutForVersion(
    script: IMasterScript,
    scriptVersion: string,
    manifest: any
): Promise<ExtractedMasterScriptSource> {
    const existingLines = await readSourceLines(script._id, scriptVersion);
    if (existingLines.length > 0) {
        return {
            sourceFormat: (manifest.sourceFormat || script.sourceFormat || 'raw_text') as any,
            layoutVersion: manifest.layoutVersion || script.layoutVersion || 'ms-layout-v1',
            rawContent: existingLines.map(line => line.rawText).join('\n'),
            pageCount: manifest.pageCount || script.pageCount || Math.max(1, ...existingLines.map(line => line.pageNo)),
            warnings: manifest.ingestWarnings || script.ingestWarnings || [],
            lines: existingLines
        };
    }

    const extractedSource = buildSourceFromScriptInput(script.rawContent, (script.sourceFormat || 'raw_text') as any);

    if (extractedSource.lines.length > 0) {
        await MasterScriptSourceLine.insertMany(
            extractedSource.lines.map(line => ({
                masterScriptId: script._id, scriptVersion,
                lineNo: line.lineNo, pageNo: line.pageNo, pageLineNo: line.pageLineNo,
                rawText: line.rawText, isBlank: line.isBlank, indentColumns: line.indentColumns,
                lineHash: line.lineHash, lineId: line.lineId, sourceKind: line.sourceKind,
                xStart: line.xStart, yTop: line.yTop
            }))
        );
    }

    script.rawContent = extractedSource.rawContent;
    applySourceMetadata(script, extractedSource);
    manifest.sourceFormat = extractedSource.sourceFormat;
    manifest.pageCount = extractedSource.pageCount;
    manifest.layoutVersion = extractedSource.layoutVersion;
    manifest.ingestWarnings = extractedSource.warnings;
    manifest.readerReady = extractedSource.lines.length > 0;
    manifest.titlePage = buildTitlePageSummary(extractedSource.lines);

    return extractedSource;
}

export async function readSourceLines(
    masterScriptId: string | mongoose.Types.ObjectId,
    scriptVersion: string
): Promise<MasterScriptSourceLayoutLine[]> {
    const sourceLines = await MasterScriptSourceLine.find({ masterScriptId, scriptVersion }).sort({ lineNo: 1 }).lean();
    return sourceLines.map((line: any) => ({
        lineNo: line.lineNo, pageNo: line.pageNo || 1, pageLineNo: line.pageLineNo || line.lineNo,
        rawText: line.rawText || '', isBlank: Boolean(line.isBlank), indentColumns: line.indentColumns || 0,
        lineHash: line.lineHash, lineId: line.lineId, sourceKind: line.sourceKind || 'body',
        xStart: line.xStart, yTop: line.yTop
    }));
}

function buildSourceFromScriptInput(rawContent?: string, sourceFormat: string = 'raw_text'): ExtractedMasterScriptSource {
    if (!rawContent || rawContent.trim().length === 0) throw new Error('Script content is required');
    return extractStructuredTextFromRawContent(rawContent, sourceFormat as any);
}
