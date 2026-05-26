import { aiServiceManager } from '../aiManager/index.js';

export function normalizeText(text: string): string {
    return (text || '')
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n')
        .replace(/[ \t]+/g, ' ')
        .trim();
}

export class JSONHelper {
    static extractJson(text: string): string {
        const firstObj = text.indexOf('{');
        const firstArr = text.indexOf('[');
        let start = -1;
        if (firstObj !== -1 && firstArr !== -1) start = Math.min(firstObj, firstArr);
        else if (firstObj !== -1) start = firstObj;
        else start = firstArr;

        const lastObj = text.lastIndexOf('}');
        const lastArr = text.lastIndexOf(']');
        let end = -1;
        if (lastObj !== -1 && lastArr !== -1) end = Math.max(lastObj, lastArr);
        else if (lastObj !== -1) end = lastObj;
        else end = lastArr;

        // If there's an opening bracket/brace after the last closed bracket/brace,
        // it means the JSON structure is truncated mid-way and continues to the end of the text.
        const nextStartObj = lastObj !== -1 ? text.indexOf('{', lastObj + 1) : -1;
        const nextStartArr = lastArr !== -1 ? text.indexOf('[', lastArr + 1) : -1;
        if (nextStartObj !== -1 || nextStartArr !== -1) {
            end = text.length - 1;
        }

        if (start === -1 || end === -1 || start >= end) return text;
        let cleaned = text.substring(start, end + 1);
        cleaned = cleaned.replace(/^Here is the JSON output:\s*/i, '');
        return cleaned;
    }

    static repairJson(json: string): string {
        let fixed = json.trim();

        fixed = fixed.replace(/":\s*"(.*?)"(\s*[,}])\s*/gs, (match, content, suffix) => {
            if (content.includes('":') || /",\s*"\w+"\s*:/i.test(content)) return match;

            const escaped = content.replace(/\\*"/g, (m: string) => {
                const slashes = m.match(/\\*/)?.[0] || '';
                if (slashes.length % 2 === 0) return slashes + '\\"';
                return m;
            });
            return `": "${escaped}"${suffix}`;
        });

        fixed = fixed.replace(/([{,]\s*)'([^']+)'\s*:/g, '$1"$2":');
        fixed = fixed.replace(/([{,]\s*)([a-zA-Z0-9_]+)\s*:(?!\/)/g, (match, prefix, key) => {
            if (key === 'http' || key === 'https') return match;
            return `${prefix}"${key}":`;
        });

        fixed = fixed.replace(/"(?:[^"\\]|\\.)*"/g, (match) => {
            return match.replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t');
        });

        fixed = fixed.replace(/:\s*'([^']*)'(\s*[,}])/g, ': "$1"$2');
        fixed = fixed.replace(/\{(\s|,)+/g, '{');
        fixed = fixed.replace(/\[(\s|,)+/g, '[');
        fixed = fixed.replace(/(\s|,)+([}\]])/g, '$2');
        fixed = fixed.replace(/,(\s|,)+/g, ',');

        return fixed;
    }

    static closeBrackets(text: string): string {
        let inString = false;
        let escape = false;
        const stack: string[] = [];
        let repaired = '';

        for (let i = 0; i < text.length; i++) {
            const char = text[i];
            
            if (escape) {
                escape = false;
                repaired += char;
                continue;
            }
            if (char === '\\') {
                escape = true;
                repaired += char;
                continue;
            }
            if (char === '"') {
                inString = !inString;
                repaired += char;
                continue;
            }

            if (!inString) {
                if (char === '{') {
                    stack.push('}');
                    repaired += char;
                } else if (char === '[') {
                    stack.push(']');
                    repaired += char;
                } else if (char === '}') {
                    // Close any mismatched array bracket first
                    while (stack.length > 0 && stack[stack.length - 1] === ']') {
                        repaired += ']';
                        stack.pop();
                    }
                    if (stack.length > 0 && stack[stack.length - 1] === '}') {
                        stack.pop();
                        repaired += char;
                    }
                } else if (char === ']') {
                    // Close any mismatched object brace first
                    while (stack.length > 0 && stack[stack.length - 1] === '}') {
                        repaired += '}';
                        stack.pop();
                    }
                    if (stack.length > 0 && stack[stack.length - 1] === ']') {
                        stack.pop();
                        repaired += char;
                    }
                } else {
                    repaired += char;
                }
            } else {
                repaired += char;
            }
        }

        // Close any remaining items in the stack in correct reverse order
        if (inString) {
            repaired += '"';
        }
        while (stack.length > 0) {
            repaired += stack.pop();
        }

        return repaired;
    }

    static dirtyRepair(jsonText: string): any {
        let preRepaired = this.extractJson(jsonText).trim();
        if (!preRepaired) return [];
        // Correct missing closing braces in list objects where a comma is not preceded by '}'
        preRepaired = preRepaired.replace(/([^}\s\],])\s*,\s*\{/g, '$1\n},\n{');
        
        const closed = this.closeBrackets(preRepaired);
        try {
            return JSON.parse(closed);
        } catch (initialErr) {
            try {
                const repaired = this.repairJson(closed);
                return JSON.parse(repaired);
            } catch (e) {
                try {
                    const repaired = this.repairJson(closed);
                    const stripped = repaired.replace(/([{,]\s*)([a-zA-Z0-9_]+)\s*:(?!\/)/g, '$1"$2":');
                    return JSON.parse(stripped);
                } catch (lastErr) {
                    // ULTIMATE RESILIENT FALLBACK: Stack-based object extractor
                    try {
                        console.warn('[JSONHelper] Structured parse failed. Executing stack-based object-extraction fallback...');
                        
                        const objectMatches: string[] = [];
                        const stack: number[] = [];
                        
                        for (let i = 0; i < closed.length; i++) {
                            if (closed[i] === '{') {
                                stack.push(i);
                            } else if (closed[i] === '}') {
                                if (stack.length > 0) {
                                    const start = stack.pop()!;
                                    const chunk = closed.slice(start, i + 1);
                                    if ((chunk.includes('"name"') || chunk.includes('"title"') || chunk.includes('"slugline"') || chunk.includes('":')) && chunk.length < 2000) {
                                        objectMatches.push(chunk);
                                    }
                                }
                            }
                        }
                        
                        if (objectMatches.length > 0) {
                            const parsedObjects: any[] = [];
                            for (const objStr of objectMatches) {
                                try {
                                    parsedObjects.push(JSON.parse(objStr));
                                } catch (objErr) {
                                    try {
                                        const repairedObj = this.repairJson(objStr);
                                        parsedObjects.push(JSON.parse(repairedObj));
                                    } catch (objErr2) {
                                        try {
                                            const strippedObj = this.repairJson(objStr).replace(/([{,]\s*)([a-zA-Z0-9_]+)\s*:(?!\/)/g, '$1"$2":');
                                            parsedObjects.push(JSON.parse(strippedObj));
                                        } catch (objErr3) {
                                            // skip
                                        }
                                    }
                                }
                            }
                            
                            if (parsedObjects.length > 0) {
                                return parsedObjects;
                            }
                        }
                    } catch (fallbackErr) {
                        console.error('[JSONHelper] Ultimate stack-based fallback failed:', fallbackErr);
                    }
                    
                    throw lastErr;
                }
            }
        }
    }

    static async validateAndCorrect(raw: string, error: string): Promise<string | null> {
        const correctionPrompt = `The following JSON response from an LLM failed parsing.
        
        ERROR: ${error}
        RAW_TEXT:
        """
        ${raw}
        """

        TASK: Fix the JSON formatting. Ensure all quotes are escaped and all keys are quoted. Return ONLY valid JSON.`;

        try {
            return await aiServiceManager.chat(correctionPrompt, {
                provider: aiServiceManager.getProvider(),
                model: 'instant',
                temperature: 0,
                format: 'json'
            });
        } catch (err) {
            return null;
        }
    }

    static normalize(text: string): string {
        return normalizeText(text);
    }

    static flattenToString(val: any): string {
        if (val === null || val === undefined) return '';
        if (typeof val === 'string') return val;
        if (typeof val === 'object') {
            const content = val['script-edit'] || val['content'] || val['text'] || val['script'] || val['value'];
            if (content && typeof content === 'string') return content;
            return JSON.stringify(val);
        }
        return String(val);
    }
}
