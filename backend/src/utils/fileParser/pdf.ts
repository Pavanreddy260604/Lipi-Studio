import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import type { ExtractedMasterScriptSource } from '../../types/masterScriptLayout';
import type { PendingSourceLine, PdfWord } from './types.js';
import { X_TO_COLUMN_RATIO } from './types.js';
import { buildSourceFromPendingLines } from './parser.js';

function estimateMedian(values: number[]): number {
    const filtered = values.filter(value => Number.isFinite(value) && value > 0).sort((left, right) => left - right);
    if (filtered.length === 0) {
        return 0;
    }
    const mid = Math.floor(filtered.length / 2);
    return filtered.length % 2 === 0
        ? (filtered[mid - 1] + filtered[mid]) / 2
        : filtered[mid];
}

function renderPdfLine(words: PdfWord[]): { rawText: string; xStart?: number; yTop?: number } {
    const sortedWords = [...words].sort((left, right) => left.x - right.x);
    let rendered = '';
    let prevRight = 0;

    sortedWords.forEach((word, index) => {
        const text = word.text.replace(/\u0000/g, '');
        if (text.length === 0) {
            return;
        }

        const targetColumn = Math.max(0, Math.round(word.x / X_TO_COLUMN_RATIO));
        if (index === 0) {
            rendered += ' '.repeat(targetColumn);
        } else if (rendered.length < targetColumn) {
            rendered += ' '.repeat(targetColumn - rendered.length);
        } else if (word.x - prevRight > 4 && !rendered.endsWith(' ')) {
            rendered += ' ';
        }

        rendered += text;
        prevRight = Math.max(prevRight, word.x + word.width);
    });

    return {
        rawText: rendered.replace(/\s+$/g, ''),
        xStart: sortedWords[0]?.x,
        yTop: sortedWords[0]?.y
    };
}

export class LayoutPDFReader {
    async loadData(buffer: Buffer): Promise<ExtractedMasterScriptSource> {
        const data = new Uint8Array(buffer);
        const loadingTask = pdfjs.getDocument({ data });
        const pdf = await loadingTask.promise;
        const pendingLines: PendingSourceLine[] = [];
        const warnings: string[] = [];

        for (let pageNo = 1; pageNo <= pdf.numPages; pageNo += 1) {
            const page = await pdf.getPage(pageNo);
            const textContent = await page.getTextContent();
            const items = (textContent.items as any[])
                .map(item => ({
                    text: typeof item.str === 'string' ? item.str : '',
                    x: Number(item.transform?.[4] || 0),
                    y: Number(item.transform?.[5] || 0),
                    width: Number(item.width || 0),
                    height: Number(item.height || 0)
                }))
                .filter(item => item.text.length > 0);

            if (items.length === 0) {
                warnings.push(`PDF page ${pageNo} contains no text items`);
                continue;
            }

            items.sort((left, right) => {
                if (Math.abs(left.y - right.y) < 2.5) {
                    return left.x - right.x;
                }
                return right.y - left.y;
            });

            const lineGroups: PdfWord[][] = [];
            for (const item of items) {
                const currentGroup = lineGroups[lineGroups.length - 1];
                if (!currentGroup) {
                    lineGroups.push([item]);
                    continue;
                }

                const groupY = currentGroup[0]?.y ?? item.y;
                const yTolerance = Math.max(2.5, Math.min(item.height || 0, 5));
                if (Math.abs(item.y - groupY) <= yTolerance) {
                    currentGroup.push(item);
                } else {
                    lineGroups.push([item]);
                }
            }

            const linePositions = lineGroups.map(group => group[0]?.y ?? 0);
            const lineGaps = linePositions
                .slice(1)
                .map((yTop, index) => Math.abs(linePositions[index] - yTop));
            const medianGap = estimateMedian(lineGaps) || 12;

            lineGroups.forEach((group, index) => {
                if (index > 0) {
                    const previousY = lineGroups[index - 1][0]?.y ?? 0;
                    const currentY = group[0]?.y ?? 0;
                    const gap = Math.abs(previousY - currentY);
                    const blankLineCount = gap > medianGap * 1.6
                        ? Math.max(0, Math.round(gap / medianGap) - 1)
                        : 0;

                    for (let count = 0; count < blankLineCount; count += 1) {
                        pendingLines.push({
                            pageNo,
                            rawText: ''
                        });
                    }
                }

                const rendered = renderPdfLine(group);
                pendingLines.push({
                    pageNo,
                    rawText: rendered.rawText,
                    xStart: rendered.xStart,
                    yTop: rendered.yTop
                });
            });
        }

        return buildSourceFromPendingLines('pdf', pendingLines, pdf.numPages, warnings);
    }
}
