import { normalizeText } from './jsonHelper.js';

export function applySurgicalPatch(original: string, assistantOutput: string): string {
    if (!assistantOutput.includes('<<<SEARCH>>>') || !assistantOutput.includes('<<<REPLACE>>>')) {
        return assistantOutput;
    }

    const markerRegex = /<<<SEARCH>>>\s*([\s\S]*?)\s*<<<REPLACE>>>\s*([\s\S]*?)(?=\s*<<<SEARCH>>>|\s*```|$)/g;
    let patchedContent = original || '';
    const matches = Array.from(assistantOutput.matchAll(markerRegex));

    if (matches.length === 0) return assistantOutput;

    for (const match of matches) {
        const searchContent = (match[1] || '').trim();
        const replaceContent = (match[2] || '').trim();

        const isPlaceholder = !searchContent ||
                             searchContent === '"""' ||
                             searchContent === '""' ||
                             searchContent.replace(/[\n\r\s]/g, '') === '""""""' ||
                             searchContent === 'EMPTY_SCRIPT' ||
                             searchContent === '...';

        if (isPlaceholder) {
            if (!patchedContent) {
                patchedContent = replaceContent;
            } else {
                patchedContent = replaceContent + '\n\n' + patchedContent;
            }
            continue;
        }

        if (patchedContent.includes(searchContent)) {
            patchedContent = patchedContent.replace(searchContent, replaceContent);
            continue;
        }

        const normOriginal = normalizeText(patchedContent);
        const normSearch = normalizeText(searchContent);

        if (normOriginal.includes(normSearch)) {
            const searchLines = searchContent.split('\n').filter(l => l.trim());
            if (searchLines.length > 0) {
                const firstLine = searchLines[0].trim();
                const lastLine = searchLines[searchLines.length - 1].trim();

                const firstIdx = patchedContent.indexOf(firstLine);
                const lastIdx = patchedContent.lastIndexOf(lastLine);

                if (firstIdx !== -1 && lastIdx !== -1 && lastIdx >= firstIdx) {
                    const targetRange = patchedContent.slice(firstIdx, lastIdx + lastLine.length);
                    if (normalizeText(targetRange).includes(normSearch)) {
                        patchedContent = patchedContent.replace(targetRange, replaceContent);
                        continue;
                    }
                }
            }
        }

        console.warn('[ParserService] Patch failed to apply:', searchContent.slice(0, 50) + '...');
    }

    return patchedContent;
}

export function applySimplePatch(original: string, patch: string): string {
    if (!patch) return original;
    if (!patch.includes('<<<SEARCH>>>') && !patch.includes('<<<REPLACE>>>')) {
        if (!original) return patch;
        return patch;
    }
    return applySurgicalPatch(original, patch);
}
