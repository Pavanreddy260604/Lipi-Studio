import { Zap, Bot, Cloud, Sparkles } from 'lucide-react';

export type NormalizedChartConfig = {
    type: 'bar' | 'line' | 'area' | 'pie' | 'scatter' | 'radar';
    title: string;
    data: Array<Record<string, unknown>>;
    xAxisKey: string;
    dataKey: string;
};

const isObjectRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

const getFirstStringKey = (row: Record<string, unknown>) =>
    Object.keys(row).find((key) => typeof row[key] === 'string');

const getFirstNumericKey = (row: Record<string, unknown>) =>
    Object.keys(row).find((key) => typeof row[key] === 'number');

export const normalizeChartConfig = (input: unknown): NormalizedChartConfig | null => {
    if (!isObjectRecord(input)) return null;

    let candidate: Record<string, unknown> = input;
    if (isObjectRecord(candidate.pieChart)) {
        candidate = {
            type: 'pie',
            title: candidate.pieChart.title,
            data: Array.isArray(candidate.pieChart.slices) ? candidate.pieChart.slices : [],
            xAxisKey: 'label',
            dataKey: 'value'
        };
    } else if (isObjectRecord(candidate.barChart)) {
        candidate = {
            type: 'bar',
            title: candidate.barChart.title,
            data: Array.isArray(candidate.barChart.data) ? candidate.barChart.data : [],
            xAxisKey: 'label',
            dataKey: 'value'
        };
    } else if (isObjectRecord(candidate.lineChart)) {
        candidate = {
            type: 'line',
            title: candidate.lineChart.title,
            data: Array.isArray(candidate.lineChart.data) ? candidate.lineChart.data : [],
            xAxisKey: 'label',
            dataKey: 'value'
        };
    } else if (isObjectRecord(candidate.areaChart)) {
        candidate = {
            type: 'area',
            title: candidate.areaChart.title,
            data: Array.isArray(candidate.areaChart.data) ? candidate.areaChart.data : [],
            xAxisKey: 'label',
            dataKey: 'value'
        };
    }

    let type = typeof candidate.type === 'string' ? candidate.type.toLowerCase() : '';
    
    // Map unsupported chart types to closest supported equivalent
    const TYPE_MAP: Record<string, string> = {
        'histogram': 'bar', 'column': 'bar',
        'donut': 'pie', 'doughnut': 'pie',
        'bubble': 'bar',
        'spline': 'line', 'step': 'line',
    };
    if (TYPE_MAP[type]) type = TYPE_MAP[type];
    if (!['bar', 'line', 'area', 'pie', 'scatter', 'radar'].includes(type)) type = 'bar'; // fallback to bar

    const rawData = Array.isArray(candidate.data) ? candidate.data.filter(isObjectRecord) : [];
    if (rawData.length === 0) return null;

    const sample = rawData[0];
    const fallbackXAxisKey = type === 'pie' ? 'label' : (getFirstStringKey(sample) || 'label');
    const fallbackDataKey = getFirstNumericKey(sample) || 'value';
    const xAxisKey = typeof candidate.xAxisKey === 'string' ? candidate.xAxisKey : fallbackXAxisKey;
    const dataKey = typeof candidate.dataKey === 'string' ? candidate.dataKey : fallbackDataKey;

    const normalizedData = rawData.map((row, index) => {
        const labelValue = row[xAxisKey] ?? row.label ?? row.name ?? `Item ${index + 1}`;
        const rawMetric = row[dataKey] ?? row.value ?? row.count ?? row.amount;
        const numericMetric = typeof rawMetric === 'number' ? rawMetric : Number(rawMetric);

        if (!Number.isFinite(numericMetric)) {
            return null;
        }

        return {
            ...row,
            [xAxisKey]: typeof labelValue === 'string' ? labelValue : String(labelValue),
            [dataKey]: numericMetric
        };
    }).filter((row): row is Record<string, unknown> => Boolean(row));

    if (normalizedData.length === 0) return null;

    return {
        type: type as NormalizedChartConfig['type'],
        title: typeof candidate.title === 'string' && candidate.title.trim()
            ? candidate.title.trim()
            : 'Data Visualization',
        data: normalizedData,
        xAxisKey,
        dataKey
    };
};

export const normalizeTables = (text: string) => {
    const lines = text.split('\n');
    const normalized: string[] = [];

    for (const line of lines) {
        const hasTableMarker = /\|\s*:?-{3,}/.test(line);
        const hasRowBreaks = /\|\s+\|/.test(line);
        if (hasTableMarker && hasRowBreaks) {
            const firstPipe = line.indexOf('|');
            if (firstPipe > 0) {
                const prefix = line.slice(0, firstPipe).trim();
                if (prefix) normalized.push(prefix);
            }
            let tablePart = firstPipe >= 0 ? line.slice(firstPipe) : line;
            tablePart = tablePart.replace(/\|\s+\|/g, '|\n|');
            normalized.push(tablePart);
        } else {
            normalized.push(line);
        }
    }

    return normalized.join('\n');
};

export const getCodeId = (code: string, lang?: string) => {
    const seed = `${lang || 'text'}:${code.length}:${code.slice(0, 24)}`;
    return seed.replace(/\s+/g, '-');
};

export const getProviderIcon = (provider?: string, size = 14) => {
    switch (provider) {
        case 'Gemini': return <Sparkles size={size} className="text-accent-primary" />;
        case 'Local': return <Bot size={size} className="text-accent-primary" />;
        default: return <Cloud size={size} className="text-accent-primary" />;
    }
};

export const extractSources = (content: string) => {
    const sources = new Set<string>();
    // Match (Source: <filename>) or (Knowledge Base: <title>)
    const matches = content.matchAll(/\((Source|Knowledge Base): ([^)]+)\)/g);
    for (const match of matches) {
        sources.add(match[2].trim());
    }
    return Array.from(sources);
};

export const cleanContent = (content: string) => {
    return content
        .replace(/__PROGRESS__:.*\n?/g, '')
        .replace(/\[REPO_CARD:[\s\S]*?\]/g, '')
        .replace(/<\/?function[^>]*>/gi, '')
        .replace(/function=\w+>/gi, '')
        .trim();
};

export const extractProgress = (content: string) => {
    const lines = content.split('\n');
    const progress: string[] = [];
    for (const line of lines) {
        if (line.startsWith('__PROGRESS__:')) {
            progress.push(line.replace('__PROGRESS__:', '').trim());
        }
    }
    return progress;
};

export const extractLiveSections = (content: string) => {
    const sections: {
        thought?: string;
        research?: string;
        plan?: string;
        explanation?: string;
    } = {};

    const normalized = content.replace(/\r\n?/g, '\n');

    // Simple regex to find sections by label
    // These look for labels like RESEARCH_DISCLOSURE: or ### STEP 1: RESEARCH_DISCLOSURE
    const labels = {
        thought: /THOUGHT_PROCESS:|INTERNAL_MONOLOGUE:|###\s*(?:STEP\s*\d+\s*:)?\s*<?THOUGHT_PROCESS>?/i,
        research: /RESEARCH_DISCLOSURE:|###\s*(?:STEP\s*\d+\s*:)?\s*<?RESEARCH_DISCLOSURE>?/i,
        plan: /CREATIVE_PLAN:|SCENE_PLAN:|###\s*(?:STEP\s*\d+\s*:)?\s*<?(?:CREATIVE|SCENE)_PLAN>?/i,
        explanation: /AGENT_EXPLANATION:|NARRATIVE_CRAFT:|DIRECTOR_NOTE:|###\s*(?:STEP\s*\d+\s*:)?\s*<?(?:AGENT_EXPLANATION|NARRATIVE_CRAFT|DIRECTOR_NOTE)>?/i,
        script: /SCENE_SCRIPT:|###\s*(?:STEP\s*\d+\s*:)?\s*<?SCENE_SCRIPT>?/i
    };

    const sectionOrder = ['thought', 'research', 'plan', 'explanation', 'script'];
    const foundIndices: Array<{ key: string; index: number; labelLength: number }> = [];

    Object.entries(labels).forEach(([key, regex]) => {
        const match = normalized.match(regex);
        if (match && match.index !== undefined) {
            foundIndices.push({ key, index: match.index, labelLength: match[0].length });
        }
    });

    foundIndices.sort((a, b) => a.index - b.index);

    for (let i = 0; i < foundIndices.length; i++) {
        const current = foundIndices[i];
        const next = foundIndices[i + 1];
        
        if (current.key === 'script') continue; // Don't extract script as a thought section

        const start = current.index + current.labelLength;
        const end = next ? next.index : normalized.length;
        
        const text = normalized.slice(start, end).trim();
        if (text) {
            (sections as any)[current.key] = text;
        }
    }

    return sections;
};

export const robustParseJSON = (text: string) => {
    let cleaned = text.trim().replace(/\s*\|$/, '');
    
    // Strategy 1: Direct parse
    try { return JSON.parse(cleaned); } catch {
        // Try the more tolerant parsing strategies below.
    }

    // Strategy 2: Extract outermost JSON object
    const braceStart = cleaned.indexOf('{');
    const braceEnd = cleaned.lastIndexOf('}');
    if (braceStart !== -1 && braceEnd !== -1 && braceEnd > braceStart) {
        cleaned = cleaned.slice(braceStart, braceEnd + 1);
    }

    // Strategy 3: Fix truncated data arrays
    // If "data": is followed by non-array content (markdown, text, etc.), 
    // try to extract just the valid part
    const dataMatch = cleaned.match(/"data"\s*:\s*(\[[\s\S]*?\])(?:\s*[,}])/);
    if (!dataMatch) {
        // data array might be truncated - check if there's a partial array
        const partialData = cleaned.match(/"data"\s*:\s*\[[\s\S]*$/);
        if (partialData) {
            // Try to find valid array items and close the structure
            const arrayStart = cleaned.indexOf('"data"');
            if (arrayStart !== -1) {
                const beforeData = cleaned.substring(0, arrayStart);
                const fromData = cleaned.substring(arrayStart);
                
                // Find all complete objects { ... } in the array
                const objects: string[] = [];
                const objRegex = /\{[^{}]*\}/g;
                let match;
                const afterBracket = fromData.substring(fromData.indexOf('[') + 1);
                while ((match = objRegex.exec(afterBracket)) !== null) {
                    try {
                        JSON.parse(match[0]);
                        objects.push(match[0]);
                    } catch {
                        // Ignore malformed array items while reconstructing partial data.
                    }
                }
                
                if (objects.length > 0) {
                    // Reconstruct with valid objects
                    const reconstructed = beforeData + '"data": [' + objects.join(', ') + ']}';
                    try { return JSON.parse(reconstructed); } catch {
                        // Continue with the remaining fallback strategies.
                    }
                }
            }
        }
    }

    // Strategy 4: Remove trailing commas and parse
    try {
        const noTrailing = cleaned.replace(/,\s*([}\]])/g, '$1');
        return JSON.parse(noTrailing);
    } catch {
        // Continue with the next fallback strategy.
    }

    // Strategy 5: Fix unquoted keys
    try {
        const quotedKeys = cleaned
            .replace(/,\s*([}\]])/g, '$1')
            .replace(/([{,]\s*)([a-zA-Z0-9_]+)\s*:/g, '$1"$2":');
        return JSON.parse(quotedKeys);
    } catch {
        // Continue with the next fallback strategy.
    }

    // Strategy 6: Try to extract ANY valid JSON object from the text
    try {
        const jsonObjects = cleaned.match(/\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/g);
        if (jsonObjects) {
            for (const obj of jsonObjects) {
                try {
                    const parsed = JSON.parse(obj);
                    if (parsed.type || parsed.data) return parsed;
                } catch {
                    // Ignore non-JSON object-like fragments.
                }
            }
        }
    } catch {
        // If object extraction itself fails, report the parse failure below.
    }

    throw new Error('Could not parse JSON from AI output');
};
export const extractRepoCardData = (content: string) => {
    const match = content.match(/\[REPO_CARD:([\s\S]*?)\]/);
    if (!match) return null;
    try {
        return JSON.parse(match[1]);
    } catch {
        return null;
    }
};
