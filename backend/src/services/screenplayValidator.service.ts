export interface ValidationIssue {
    type: 'formatting' | 'continuity' | 'cast' | 'structure';
    severity: 'error' | 'warning';
    lineNumber: number;
    message: string;
}

export interface ValidationReport {
    valid: boolean;
    issues: ValidationIssue[];
    sluglineCount: number;
    dialogueLineCount: number;
    actionLineCount: number;
    estimatedPages: number;
}

export class ScreenplayValidatorService {
    private readonly VALID_SLUGLINE_REGEX = /^(?:INT\.|EXT\.|INT\.\/EXT\.|I\/E\.)\s+.+?(?:-{1,2}\s*(?:DAY|NIGHT|DAWN|DUSK|MORNING|AFTERNOON|EVENING|LATER|CONTINUOUS|MOMENTS? LATER|THE SAME TIME|SUNSET|SUNRISE|HOURS? LATER|MINUTES? LATER|DAYS? LATER|WEEKS? LATER|MONTHS? LATER|YEARS? LATER|FLASHBACK|CUT TO|FADE|DISSOLVE|MATCH CUT|SMASH CUT|JUMP CUT|TITLE|SUPER|INSERT|INTERCUT|SERIES OF SHOTS|MONTAGE|CREDITS|THE END|FADE OUT|FADE IN)|-{1,2}\s*.+)$/i;

    private readonly CHARACTER_CUE_INDENT = /^\s{15,}([A-Z][A-Z\s\-]+)$/;
    private readonly CHARACTER_CUE_COLON = /^([A-Z][A-Z\s\-]+):/;

    private readonly SLUGLINE_KEYWORDS = ['INT', 'EXT', 'I/E'];
    private readonly BANNED_PATTERNS = [
        { pattern: /\*\*/, message: 'Markdown bold (**) found in screenplay text. Use plain UPPERCASE for character cues.' },
        { pattern: /<center>/i, message: 'HTML <center> tags found. Use proper WGA indentation.' },
        { pattern: /^>/m, message: 'Markdown blockquote (>) found. Use proper WGA formatting.' },
        { pattern: /<[^>]+>/, message: 'Raw HTML tags found. Use plain text formatting.' },
    ];

    private readonly NARRATIVE_VIOLATIONS = [
        { pattern: /\b(?:he feels|she feels|they feel|he thinks|she thinks)\b/i, message: 'Using "feels/thinks" tells instead of shows. Replace with physical action.' },
        { pattern: /\b(?:suddenly|abruptly)\b/i, message: 'Avoid "suddenly/abruptly" — let action speak for itself.' },
        { pattern: /\b(?:we see|we hear|we watch|we notice|we realize)\b/i, message: 'Avoid "we see/hear" — write objective action lines.' },
        { pattern: /\.\.\.{2,}/, message: 'Excessive ellipsis (...) in action lines. Use sparingly.' },
    ];

    validate(text: string, castNames?: string[]): ValidationReport {
        const issues: ValidationIssue[] = [];
        const lines = text.split('\n');

        if (!text.trim()) {
            return { valid: false, issues: [{ type: 'formatting', severity: 'error', lineNumber: 1, message: 'Screenplay text is empty.' }], sluglineCount: 0, dialogueLineCount: 0, actionLineCount: 0, estimatedPages: 0 };
        }

        let sluglineCount = 0;
        let dialogueLineCount = 0;
        let actionLineCount = 0;
        let currentCharName = '';

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const lineNum = i + 1;

            for (const banned of this.BANNED_PATTERNS) {
                if (banned.pattern.test(line)) {
                    issues.push({ type: 'formatting', severity: 'error', lineNumber: lineNum, message: banned.message });
                }
            }

            for (const violation of this.NARRATIVE_VIOLATIONS) {
                if (violation.pattern.test(line)) {
                    issues.push({ type: 'formatting', severity: 'warning', lineNumber: lineNum, message: violation.message });
                }
            }

            if (this.isSlugline(line)) {
                sluglineCount++;
                currentCharName = '';
                const slugValid = this.VALID_SLUGLINE_REGEX.test(line.trim());
                if (!slugValid) {
                    issues.push({ type: 'formatting', severity: 'warning', lineNumber: lineNum, message: `Invalid slugline format: "${line.trim()}". Must start with INT./EXT. and include time of day.` });
                }
                continue;
            }

            if (this.isTransition(line)) {
                currentCharName = '';
                continue;
            }

            if (this.isCharacterCue(line)) {
                currentCharName = line.trim().replace(/\(.*?\)/g, '').replace(/:$/, '').trim();
                if (castNames && castNames.length > 0) {
                    const upperName = currentCharName.toUpperCase().replace(/\s*\(.*?\)/, '').trim();
                    if (!castNames.some(c => c.toUpperCase() === upperName)) {
                        issues.push({ type: 'cast', severity: 'warning', lineNumber: lineNum, message: `Undeclared character: "${currentCharName}". Not found in cast list.` });
                    }
                }
                dialogueLineCount++;
                continue;
            }

            if (this.isDialogue(line, currentCharName)) {
                dialogueLineCount++;
                currentCharName = '';
                continue;
            }

            const trimmed = line.trim();
            if (trimmed && !this.isParenthetical(line)) {
                actionLineCount++;
            }
        }

        if (sluglineCount === 0) {
            issues.push({ type: 'structure', severity: 'error', lineNumber: 1, message: 'No scene headers (sluglines) found. Screenplay must have at least one INT./EXT. heading.' });
        }

        if (!text.trim().startsWith('FADE IN:') && !text.trim().toLowerCase().includes('fade in')) {
            issues.push({ type: 'formatting', severity: 'warning', lineNumber: 1, message: 'Screenplay should begin with FADE IN:' });
        }

        const estimatedPages = Math.max(1, Math.round(lines.length / 25));
        const errorCount = issues.filter(i => i.severity === 'error').length;

        return {
            valid: errorCount === 0,
            issues,
            sluglineCount,
            dialogueLineCount,
            actionLineCount,
            estimatedPages,
        };
    }

    private isSlugline(line: string): boolean {
        const trimmed = line.trim();
        return this.VALID_SLUGLINE_REGEX.test(trimmed) || this.SLUGLINE_KEYWORDS.some(k => trimmed.startsWith(k + '.') || trimmed.startsWith(k + ' ') || trimmed.startsWith(k + '/'));
    }

    private isCharacterCue(line: string): boolean {
        const trimmed = line.trimEnd();
        return this.CHARACTER_CUE_INDENT.test(trimmed) || this.CHARACTER_CUE_COLON.test(trimmed);
    }

    private isDialogue(line: string, currentCharName?: string): boolean {
        if (!currentCharName) return false;
        return line.trim().length > 0 && !line.startsWith(' ') && line.trim().length < 80;
    }

    private isTransition(line: string): boolean {
        const trimmed = line.trim();
        return /^(?:CUT TO|DISSOLVE TO|FADE OUT|FADE IN|SMASH CUT|MATCH CUT|JUMP CUT|IRIS IN|IRIS OUT|WIPE TO|DISSOLVE TO|FADE TO BLACK|CUT TO BLACK)\s*:?$/i.test(trimmed);
    }

    private isParenthetical(line: string): boolean {
        return /^\s*\(.*\)\s*$/.test(line.trim());
    }
}

export const screenplayValidator = new ScreenplayValidatorService();
