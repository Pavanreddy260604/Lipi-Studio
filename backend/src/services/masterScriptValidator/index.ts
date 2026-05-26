import mongoose from 'mongoose';
import { MasterScriptSourceLine } from '../../models/MasterScriptSourceLine';
import { MasterScriptValidationReport } from '../../models/MasterScriptValidationReport';
import { VoiceSample } from '../../models/VoiceSample';
import type { ValidationRunResult } from './types.js';

export class MasterScriptValidatorService {
    async validateScriptVersion(
        masterScriptId: string,
        scriptVersion: string
    ): Promise<ValidationRunResult> {
        const scriptObjectId = new mongoose.Types.ObjectId(masterScriptId);
        const sourceLines = await MasterScriptSourceLine.find({
            masterScriptId: scriptObjectId,
            scriptVersion
        })
            .sort({ lineNo: 1 })
            .lean();

        const chunks = await VoiceSample.find({
            masterScriptId: scriptObjectId,
            scriptVersion,
            isHierarchicalNode: false
        })
            .sort({ sceneSeq: 1, elementSeq: 1, chunkIndex: 1 })
            .lean();

        const parentIds = Array.from(
            new Set(
                chunks
                    .map(chunk => chunk.parentNodeId?.toString())
                    .filter((v): v is string => !!v)
            )
        );
        const parents = await VoiceSample.find({
            _id: { $in: parentIds },
            masterScriptId: scriptObjectId,
            scriptVersion,
            isHierarchicalNode: true
        })
            .select('_id sceneSeq chunkId')
            .lean();
        const parentMap = new Map(parents.map(parent => [parent._id.toString(), parent]));

        const sourceByLineId = new Map(sourceLines.map(line => [line.lineId, line]));
        const sourceNormalized = this.normalizeForComparison(sourceLines.map(line => line.rawText));

        const lineUsage = new Map<string, number>();
        const extraLines: { lineNo: number; lineId?: string; detail?: string }[] = [];
        const missingLines: { lineNo: number; lineId?: string; detail?: string }[] = [];
        const layoutMismatches: { lineNo: number; lineId?: string; detail?: string }[] = [];
        const classificationMismatches: { lineNo: number; lineId?: string; detail?: string }[] = [];
        const orderMismatches: { sceneSeq: number; elementSeq: number; detail: string }[] = [];
        const hierarchyMismatches: { chunkId?: string; detail: string }[] = [];

        let prevScene = Number.MIN_SAFE_INTEGER;
        let prevElement = Number.MIN_SAFE_INTEGER;
        const reconstructedLines: string[] = [];
        let previousPageNo = 0;
        let previousPageLineNo = 0;
        let seenBodySection = false;
        const cueIndentBySpeaker = new Map<string, number>();

        for (const sourceLine of sourceLines) {
            const pageNo = sourceLine.pageNo || 1;
            const pageLineNo = sourceLine.pageLineNo || sourceLine.lineNo;

            if (pageNo < previousPageNo || (pageNo === previousPageNo && pageLineNo <= previousPageLineNo)) {
                layoutMismatches.push({
                    lineNo: sourceLine.lineNo,
                    lineId: sourceLine.lineId,
                    detail: 'Source line page order regressed'
                });
            }

            if (sourceLine.sourceKind !== 'title_page') {
                seenBodySection = true;
            } else if (seenBodySection) {
                layoutMismatches.push({
                    lineNo: sourceLine.lineNo,
                    lineId: sourceLine.lineId,
                    detail: 'Title page line appeared after screenplay body started'
                });
            }

            previousPageNo = pageNo;
            previousPageLineNo = pageLineNo;
        }

        for (const chunk of chunks) {
            const sceneSeq = chunk.sceneSeq ?? -1;
            const elementSeq = chunk.elementSeq ?? -1;

            if (sceneSeq < prevScene) {
                orderMismatches.push({
                    sceneSeq,
                    elementSeq,
                    detail: 'Scene sequence regressed in chunk order'
                });
            }
            if (sceneSeq === prevScene && elementSeq <= prevElement) {
                orderMismatches.push({
                    sceneSeq,
                    elementSeq,
                    detail: 'Element sequence is not strictly increasing within scene'
                });
            }
            prevScene = sceneSeq;
            prevElement = elementSeq;

            if (!chunk.parentNodeId) {
                hierarchyMismatches.push({
                    chunkId: chunk.chunkId,
                    detail: 'Leaf chunk missing parentNodeId'
                });
            } else {
                const parent = parentMap.get(chunk.parentNodeId.toString());
                if (!parent) {
                    hierarchyMismatches.push({
                        chunkId: chunk.chunkId,
                        detail: 'Leaf chunk references non-existent scene parent'
                    });
                } else if ((parent.sceneSeq ?? -1) !== sceneSeq) {
                    hierarchyMismatches.push({
                        chunkId: chunk.chunkId,
                        detail: 'Leaf chunk sceneSeq does not match parent sceneSeq'
                    });
                }
            }

            if ((chunk.sourceStartLine ?? 0) > (chunk.sourceEndLine ?? 0)) {
                hierarchyMismatches.push({
                    chunkId: chunk.chunkId,
                    detail: 'sourceStartLine is greater than sourceEndLine'
                });
            }

            const sourceLineIds = Array.isArray(chunk.sourceLineIds) ? chunk.sourceLineIds : [];
            const firstSourceLine = sourceByLineId.get(sourceLineIds[0]);
            const cueKey = chunk.speaker ? `${sceneSeq}:${chunk.speaker}` : null;

            if (chunk.chunkType === 'cue' && cueKey && firstSourceLine) {
                cueIndentBySpeaker.set(cueKey, firstSourceLine.indentColumns || 0);
            }

            if (
                cueKey &&
                firstSourceLine &&
                (chunk.chunkType === 'dialogue' || chunk.chunkType === 'parenthetical')
            ) {
                const cueIndent = cueIndentBySpeaker.get(cueKey);
                if (typeof cueIndent === 'number' && cueIndent >= 18) {
                    const minDialogueIndent = Math.max(0, cueIndent - 12);
                    if ((firstSourceLine.indentColumns || 0) < minDialogueIndent && !firstSourceLine.isBlank) {
                        classificationMismatches.push({
                            lineNo: firstSourceLine.lineNo,
                            lineId: firstSourceLine.lineId,
                            detail: `Chunk ${chunk.chunkId || ''} looks like action/page prose but was classified as ${chunk.chunkType}`
                        });
                    }
                }
            }

            for (const lineId of sourceLineIds) {
                const sourceLine = sourceByLineId.get(lineId);
                if (!sourceLine) {
                    extraLines.push({
                        lineNo: -1,
                        lineId,
                        detail: 'Chunk references unknown source line id'
                    });
                    continue;
                }
                lineUsage.set(lineId, (lineUsage.get(lineId) || 0) + 1);
                reconstructedLines.push(sourceLine.rawText);

                if (sourceLine.sourceKind === 'title_page' && (chunk.sceneSeq ?? 0) !== 0) {
                    layoutMismatches.push({
                        lineNo: sourceLine.lineNo,
                        lineId: sourceLine.lineId,
                        detail: 'Title page line was assigned to a screenplay scene'
                    });
                }

                if (sourceLine.sourceKind === 'title_page' && chunk.chunkType !== 'other') {
                    layoutMismatches.push({
                        lineNo: sourceLine.lineNo,
                        lineId: sourceLine.lineId,
                        detail: 'Title page line was classified as a structured screenplay element'
                    });
                }

                if (sourceLine.sourceKind === 'page_marker' && !chunk.nonPrinting) {
                    layoutMismatches.push({
                        lineNo: sourceLine.lineNo,
                        lineId: sourceLine.lineId,
                        detail: 'Page marker line must remain non-printing in structured chunks'
                    });
                }
            }
        }

        for (const sourceLine of sourceLines) {
            const usage = lineUsage.get(sourceLine.lineId) || 0;
            if (usage === 0) {
                missingLines.push({
                    lineNo: sourceLine.lineNo,
                    lineId: sourceLine.lineId,
                    detail: 'Source line not covered by any chunk'
                });
            } else if (usage > 1) {
                extraLines.push({
                    lineNo: sourceLine.lineNo,
                    lineId: sourceLine.lineId,
                    detail: `Source line covered ${usage} times`
                });
            }
        }

        const reconstructedNormalized = this.normalizeForComparison(reconstructedLines);
        const reconstructionMismatch = sourceNormalized !== reconstructedNormalized;
        if (reconstructionMismatch) {
            hierarchyMismatches.push({
                detail: 'Normalized reconstructed text differs from normalized source text'
            });
        }

        const passed =
            missingLines.length === 0 &&
            extraLines.length === 0 &&
            layoutMismatches.length === 0 &&
            classificationMismatches.length === 0 &&
            orderMismatches.length === 0 &&
            hierarchyMismatches.length === 0 &&
            !reconstructionMismatch;

        const summary = passed
            ? `Validation passed for scriptVersion=${scriptVersion}. ${chunks.length} chunks, ${sourceLines.length} source lines.`
            : `Validation failed for scriptVersion=${scriptVersion}. missing=${missingLines.length}, extra=${extraLines.length}, layout=${layoutMismatches.length}, classification=${classificationMismatches.length}, order=${orderMismatches.length}, hierarchy=${hierarchyMismatches.length}, reconstructionMismatch=${reconstructionMismatch}.`;

        const report = await MasterScriptValidationReport.findOneAndUpdate(
            { masterScriptId: scriptObjectId, scriptVersion },
            {
                $set: {
                    status: passed ? 'passed' : 'failed',
                    missingLines,
                    extraLines,
                    layoutMismatches,
                    classificationMismatches,
                    orderMismatches,
                    reconstructionMismatch,
                    hierarchyMismatches,
                    summary
                }
            },
            { upsert: true, new: true }
        );

        if (!report) {
            throw new Error('Failed to persist validation report');
        }

        return { passed, report };
    }

    private normalizeForComparison(lines: string[]): string {
        const normalizedLines = lines.map(line =>
            (line || '')
                .normalize('NFKC')
                .replace(/\r/g, '')
                .replace(/[ \t]+$/g, '')
        );
        return normalizedLines.join('\n');
    }
}

export const masterScriptValidatorService = new MasterScriptValidatorService();

export type { ValidationRunResult } from './types.js';
