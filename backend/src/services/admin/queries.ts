import mongoose from 'mongoose';
import { MasterScript, IMasterScript } from '../../models/MasterScript';
import { MasterScriptSourceLine } from '../../models/MasterScriptSourceLine';
import { MasterScriptValidationReport } from '../../models/MasterScriptValidationReport';
import { VoiceSample } from '../../models/VoiceSample';
import { IngestionManifest } from '../../models/IngestionManifest';
import { vectorService } from '../vector/index.js';
import { extractStructuredTextFromRawContent } from '../../utils/fileParser/index.js';
import type { ExtractedMasterScriptSource } from '../../types/masterScriptLayout';
import type { CreateMasterScriptInput } from './types.js';
import { createScriptVersion, buildTitlePageSummary, applySourceMetadata } from './helpers.js';
import { readSourceLines } from './processing.js';

export async function getAllMasterScripts(userId: string) {
    return MasterScript.find({ userId }).sort({ createdAt: -1 });
}

export async function createMasterScript(userId: string, data: CreateMasterScriptInput) {
    const { extractedSource: providedSource, ...scriptData } = data;
    const extractedSource = providedSource || buildSourceFromScriptInput(scriptData.rawContent, scriptData.sourceFormat as any);
    const scriptVersion = createScriptVersion();
    const script = new MasterScript({
        userId, ...scriptData,
        rawContent: extractedSource.rawContent,
        processingScriptVersion: scriptVersion,
        readerReady: extractedSource.lines.length > 0,
        ragReady: false, gateStatus: 'pending',
        progress: extractedSource.lines.length > 0 ? 5 : 0,
        processedChunks: 0,
        lastValidationSummary: `Layout extracted for ${scriptVersion}`
    });
    applySourceMetadata(script, extractedSource);
    await script.save();

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

    await IngestionManifest.findOneAndUpdate(
        { jobType: 'master_script', targetId: script._id, scriptVersion },
        {
            $set: {
                status: 'pending', sourceFormat: extractedSource.sourceFormat,
                pageCount: extractedSource.pageCount, layoutVersion: extractedSource.layoutVersion,
                readerReady: extractedSource.lines.length > 0, ragReady: false,
                ingestWarnings: extractedSource.warnings, gateStatus: 'pending',
                geAuditStatus: undefined, totalChunks: 0, successfulChunks: 0,
                failedChunks: 0, titlePage: buildTitlePageSummary(extractedSource.lines), errorLogs: []
            }
        },
        { upsert: true, new: true }
    );
    return script;
}

export async function getMasterScriptChunks(scriptId: string, scriptVersion?: string) {
    const filter: Record<string, unknown> = { masterScriptId: scriptId };
    filter.scriptVersion = scriptVersion || await resolveScriptVersion(scriptId);
    return VoiceSample.find(filter as any)
        .select(['_id', 'content', 'speaker', 'chunkType', 'chunkIndex', 'sceneSeq', 'elementSeq', 'sourceStartLine', 'sourceEndLine', 'dualDialogue', 'sceneNumber', 'nonPrinting', 'isHierarchicalNode', 'chunkId'].join(' '))
        .sort({ isHierarchicalNode: 1, sceneSeq: 1, elementSeq: 1, chunkIndex: 1, createdAt: 1 }).lean();
}

export async function getMasterScriptReconstructedScript(scriptId: string, scriptVersion?: string) {
    const resolvedScriptVersion = await resolveScriptVersion(scriptId, scriptVersion);
    const sourceLines = await readSourceLines(scriptId, resolvedScriptVersion);
    if (sourceLines.length === 0) throw new Error(`No source lines found for script version ${resolvedScriptVersion}`);

    const parserMeta = await VoiceSample.findOne({ masterScriptId: scriptId, scriptVersion: resolvedScriptVersion }).select('parserVersion').lean();
    const manifest = await IngestionManifest.findOne({ targetId: scriptId as any, scriptVersion: resolvedScriptVersion }).lean();

    return {
        scriptVersion: resolvedScriptVersion,
        parserVersion: parserMeta?.parserVersion,
        sourceFormat: manifest?.sourceFormat,
        pageCount: manifest?.pageCount || Math.max(1, ...sourceLines.map((line: any) => line.pageNo || 1)),
        layoutVersion: manifest?.layoutVersion,
        readerReady: manifest?.readerReady ?? true,
        ragReady: manifest?.ragReady ?? false,
        warnings: manifest?.ingestWarnings || [],
        lineCount: sourceLines.length,
        content: sourceLines.map((line: any) => line.rawText || '').join('\n'),
        lines: sourceLines.map((line: any) => ({
            lineNo: line.lineNo, pageNo: line.pageNo || 1, pageLineNo: line.pageLineNo || line.lineNo,
            rawText: line.rawText || '', isBlank: Boolean(line.isBlank), indentColumns: line.indentColumns || 0,
            lineHash: line.lineHash, lineId: line.lineId, sourceKind: line.sourceKind || 'body',
            xStart: line.xStart, yTop: line.yTop
        })),
        titlePage: manifest?.titlePage || {}
    };
}

export async function getMasterScriptValidationReport(scriptId: string, scriptVersion?: string) {
    const filter: Record<string, unknown> = { masterScriptId: scriptId };
    if (scriptVersion) filter.scriptVersion = scriptVersion;
    const query = MasterScriptValidationReport.findOne(filter as any);
    if (!scriptVersion) query.sort({ createdAt: -1 });
    return query.lean();
}

export async function deleteMasterScript(scriptId: string): Promise<void> {
    const script = await MasterScript.findById(scriptId);
    if (!script) throw new Error('Master script not found');
    if (process.env.NODE_ENV !== 'production') console.log(`[AdminService] Deleting Master Script: ${script.title}`);
    try { await vectorService.deleteSamplesByMasterScriptId(scriptId); } catch (err) { console.error(`[AdminService] Error deleting vectors for script ${scriptId}:`, err); }
    await Promise.all([
        VoiceSample.deleteMany({ masterScriptId: scriptId }),
        MasterScriptSourceLine.deleteMany({ masterScriptId: scriptId }),
        MasterScriptValidationReport.deleteMany({ masterScriptId: scriptId }),
        IngestionManifest.deleteMany({ targetId: scriptId, jobType: 'master_script' })
    ]);
    await MasterScript.findByIdAndDelete(scriptId);
    if (process.env.NODE_ENV !== 'production') console.log(`[AdminService] Successfully deleted script: ${script.title}`);
}

export async function resolveScriptVersion(scriptId: string, scriptVersion?: string): Promise<string> {
    if (scriptVersion) return scriptVersion;
    const script = await MasterScript.findById(scriptId).select('activeScriptVersion processingScriptVersion');
    if (!script) throw new Error('Master script not found');
    const resolved = script.processingScriptVersion || script.activeScriptVersion;
    if (!resolved) throw new Error('No script version available');
    return resolved;
}

function buildSourceFromScriptInput(rawContent?: string, sourceFormat: string = 'raw_text'): ExtractedMasterScriptSource {
    if (!rawContent || rawContent.trim().length === 0) throw new Error('Script content is required');
    return extractStructuredTextFromRawContent(rawContent, sourceFormat as any);
}
