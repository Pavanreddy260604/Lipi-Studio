export interface DriftReport {
    hasDrift: boolean;
    characterDrifts: {
        name: string;
        field: string;
        expected: string;
        found: string;
        lineNumber: number;
        severity: 'low' | 'medium' | 'high';
    }[];
    itemDrifts: {
        name: string;
        item: string;
        expectedPresence: boolean;
        foundPresence: boolean;
        severity: 'medium' | 'high';
    }[];
    warningCount: number;
}

function escapeRegex(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export class DriftScannerService {
    private readonly STATUS_PATTERNS = [
        { regex: /\b(?:wounded|bleeding|injured|hurt|injury|lacerated|stabbed|shot)\b/i, status: 'Wounded' },
        { regex: /\b(?:dead|killed|dies|deadly|died|death|deceased|lifeless)\b/i, status: 'Dead' },
        { regex: /\b(?:angry|furious|enraged|anger|seething|livid|irate)\b/i, status: 'Furious' },
        { regex: /\b(?:unconscious|knocked out|passed out|unresponsive)\b/i, status: 'Unconscious' },
        { regex: /\b(?:fear|terrified|scared|frightened|horrified|petrified)\b/i, status: 'Terrified' },
        { regex: /\b(?:happy|joyful|delighted|joy|ecstatic|cheerful)\b/i, status: 'Joyful' },
        { regex: /\b(?:asleep|sleeping|resting|sleep|slumber)\b/i, status: 'Sleeping' },
    ];

    private readonly HEALTHY_STATUSES = new Set(['healthy', 'stable', 'alive', 'fine', 'normal']);

    private readonly PAST_TENSE_PREFIX_PATTERN = /\b(?:was|had been|used to be)\s+/i;

    scan(text: string, characterContext: { name: string; currentStatus?: string; heldItems?: string[] }[]): DriftReport {
        const report: DriftReport = {
            hasDrift: false,
            characterDrifts: [],
            itemDrifts: [],
            warningCount: 0,
        };

        if (!text || !characterContext?.length) return report;

        const lines = text.split('\n');

        for (const char of characterContext) {
            if (!char.name) continue;
            const nameUpper = char.name.toUpperCase();
            const charMentions = this.findCharacterMentionLines(lines, char.name);

            if (char.currentStatus && char.currentStatus !== 'Stable') {
                const expectedStatus = char.currentStatus.toLowerCase();
                if (this.HEALTHY_STATUSES.has(expectedStatus)) continue;
                const statusFound = charMentions.some(ln =>
                    this.STATUS_PATTERNS.some(sp => {
                        if (sp.status.toLowerCase() === expectedStatus && sp.regex.test(ln.text)) return true;
                        return false;
                    })
                );
                if (!statusFound && charMentions.length > 0) {
                    const onlyPastTense = charMentions.every(ln => this.PAST_TENSE_PREFIX_PATTERN.test(ln.text));
                    if (!onlyPastTense) {
                        report.characterDrifts.push({
                            name: char.name,
                            field: 'currentStatus',
                            expected: char.currentStatus,
                            found: 'Not mentioned in text',
                            lineNumber: charMentions[0].lineNum,
                            severity: 'high',
                        });
                        report.hasDrift = true;
                    }
                }
            }

            if (char.heldItems?.length) {
                for (const item of char.heldItems) {
                    const itemEscaped = escapeRegex(item.toLowerCase());
                    const itemPattern = new RegExp(`\\b${itemEscaped}\\b`, 'i');
                    const foundInText = lines.some(l => itemPattern.test(l));
                    if (!foundInText) {
                        report.itemDrifts.push({
                            name: char.name,
                            item,
                            expectedPresence: true,
                            foundPresence: false,
                            severity: 'medium',
                        });
                        report.hasDrift = true;
                    }
                }
            }

            const contradictions = this.findDirectContradictions(lines, char.name, char.currentStatus);
            report.characterDrifts.push(...contradictions);
            if (contradictions.length > 0) report.hasDrift = true;
        }

        report.warningCount = report.characterDrifts.length + report.itemDrifts.length;
        return report;
    }

    private findCharacterMentionLines(lines: string[], displayName: string): { lineNum: number; text: string }[] {
        const mentions: { lineNum: number; text: string }[] = [];
        const escaped = escapeRegex(displayName);
        const namePattern = new RegExp(`\\b${escaped}\\b`, 'i');
        for (let i = 0; i < lines.length; i++) {
            if (namePattern.test(lines[i])) {
                mentions.push({ lineNum: i + 1, text: lines[i].trim() });
            }
        }
        return mentions;
    }

    private findDirectContradictions(lines: string[], displayName: string, currentStatus?: string): DriftReport['characterDrifts'] {
        const drifts: DriftReport['characterDrifts'] = [];
        if (!currentStatus || currentStatus === 'Stable') return drifts;

        const escaped = escapeRegex(displayName);
        const actionVerbs = ['walks', 'runs', 'speaks', 'says', 'grabs', 'moves', 'picks', 'opens', 'climbs', 'jumps', 'sits', 'stands', 'enters', 'exits', 'rides', 'drives', 'holds', 'throws', 'kicks', 'pushes', 'pulls', 'reaches', 'bends', 'turns', 'laughs', 'smiles', 'frowns', 'points', 'nods', 'waves'];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const isPastTense = this.PAST_TENSE_PREFIX_PATTERN.test(line);
            if (isPastTense) continue;

            if (currentStatus === 'Dead' || currentStatus === 'Unconscious') {
                const actionPattern = new RegExp(`${escaped}\\s+(?:${actionVerbs.join('|')})`, 'i');
                const actionMatch = line.match(new RegExp(`${escaped}\\s+(?:${actionVerbs.join('|')})`, 'i'));
                if (actionMatch) {
                    drifts.push({
                        name: displayName,
                        field: 'currentStatus',
                        expected: currentStatus,
                        found: `Character performs action: "${line.trim()}"`,
                        lineNumber: i + 1,
                        severity: 'high',
                    });
                }
            }
        }

        return drifts;
    }
}

export const driftScannerService = new DriftScannerService();
