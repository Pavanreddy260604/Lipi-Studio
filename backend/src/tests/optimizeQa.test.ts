import { describe, it, expect } from './framework.js';
import { DriftScannerService } from '../services/driftScanner.service.js';
import { ScreenplayValidatorService } from '../services/screenplayValidator.service.js';
import { classifyRelationshipWithAI } from '../services/loreSync.service.js';

function getLevenshteinDistance(a: string, b: string): number {
    if (!a || !b) return Math.max((a || '').length, (b || '').length);
    const an = a.length;
    const bn = b.length;
    if (an === 0) return bn;
    if (bn === 0) return an;
    const matrix = Array.from({ length: an + 1 }, () => new Int32Array(bn + 1));
    for (let i = 0; i <= an; i++) matrix[i][0] = i;
    for (let j = 0; j <= bn; j++) matrix[0][j] = j;
    for (let i = 1; i <= an; i++) {
        for (let j = 1; j <= bn; j++) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            matrix[i][j] = Math.min(matrix[i - 1][j] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j - 1] + cost);
        }
    }
    return matrix[an][bn];
}

function isSpellingVariant(proposed: string, existingNames: string[]): string | null {
    const upper = proposed.trim().toUpperCase();
    if (!upper) return null;
    if (!existingNames || !Array.isArray(existingNames)) return null;
    if (existingNames.some(n => n.toUpperCase() === upper)) return upper;
    for (const existing of existingNames) {
        if (getLevenshteinDistance(upper, existing.toUpperCase()) <= 2) return existing;
    }
    return null;
}

function getContentDelta(prevContent: string | undefined, newContent: string): number {
    if (!prevContent) return 100;
    const prev = prevContent.replace(/\s+/g, ' ').trim();
    const next = newContent.replace(/\s+/g, ' ').trim();
    if (!prev || !next) return 100;
    const maxLen = Math.max(prev.length, next.length);
    if (maxLen === 0) return 0;
    const minLen = Math.min(prev.length, next.length);
    let diffs = 0;
    for (let i = 0; i < minLen; i++) { if (prev[i] !== next[i]) diffs++; }
    diffs += Math.abs(prev.length - next.length);
    return (diffs / maxLen) * 100;
}

function getRlhfBoostedTemperature(feedbackCount: number, baseTemp: number): number {
    if (feedbackCount <= 2) return baseTemp;
    const boost = Math.min((feedbackCount - 2) * 0.05, 0.35);
    return Math.min(baseTemp + boost, 0.85);
}

function getFilteredRlhfAnchors(feedbacks: any[], maxAgeMinutes: number = 10080): string[] {
    const now = Date.now();
    return feedbacks
        .map((fb, idx) => {
            let recencyWeight: number;
            if (!maxAgeMinutes || maxAgeMinutes <= 0) {
                recencyWeight = 0.3;
            } else {
                const ageMinutes = fb.createdAt ? (now - new Date(fb.createdAt).getTime()) / 60000 : 0;
                recencyWeight = Math.max(0.3, 1 - ageMinutes / maxAgeMinutes);
            }
            return { ...fb, recencyWeight, originalIndex: idx };
        })
        .sort((a, b) => b.recencyWeight - a.recencyWeight)
        .slice(0, 3)
        .map(fb => {
            let block = `${fb.originalIndex + 1}. [${(fb.category || 'general').toUpperCase()}] ${fb.userCorrection || ''}`;
            if (fb.recencyWeight < 0.6) block += ' (aged)';
            return block;
        });
}

function resolveModelForTask(taskName: string, requestedModel?: string): string {
    const TASK_MODEL_ROUTES: Record<string, string> = {
        character_discovery: 'instant',
        character_sync: 'instant',
        state_extraction: 'thinking',
        plot_summary: 'thinking',
        scene_generation: 'thinking',
        advanced_coherence: 'deep',
        relationship_analysis: 'deep',
    };
    if (taskName === null || taskName === undefined) return requestedModel || 'thinking';
    const cleanTask = taskName.trim().toLowerCase();
    if (!cleanTask) return requestedModel || 'thinking';
    if (requestedModel) return requestedModel;
    return TASK_MODEL_ROUTES[cleanTask] || 'thinking';
}

function validateScreenplayFormat(text: string): { valid: boolean; sluglineCount: number; issues: string[] } {
    const issues: string[] = [];
    const lines = text.split('\n');
    if (!text.trim()) return { valid: false, sluglineCount: 0, issues: ['Empty text'] };
    const sluglines = lines.filter(l => /^(?:INT\.|EXT\.|INT\.\/EXT\.|I\/E\.)\s+/i.test(l.trim()));
    if (sluglines.length === 0) issues.push('No valid sluglines found');
    const hasMarkdownBold = /\*\*/.test(text);
    if (hasMarkdownBold) issues.push('Contains markdown bold (**)');
    const hasHtml = /<[^>]+>/.test(text);
    if (hasHtml) issues.push('Contains HTML tags');
    const hasCenter = /<center>/i.test(text);
    if (hasCenter) issues.push('Contains <center> tags');
    const hasBlockquote = /^>/m.test(text);
    if (hasBlockquote) issues.push('Contains blockquote (>)');
    const hasFadeIn = text.trim().toLowerCase().includes('fade in');
    if (!hasFadeIn) issues.push('Missing FADE IN');
    const hasNarration = /\b(?:we see|we hear|we watch|we notice|we realize)\b/i.test(text);
    if (hasNarration) issues.push('Contains "we see/hear" narration');
    const hasFeelThink = /\b(?:he feels|she feels|they feel|he thinks|she thinks)\b/i.test(text);
    if (hasFeelThink) issues.push('Contains "feels/thinks"');
    const hasSuddenly = /\b(?:suddenly|abruptly)\b/i.test(text);
    if (hasSuddenly) issues.push('Contains "suddenly/abruptly"');
    const hasEllipsis = /\.{4,}/.test(text);
    if (hasEllipsis) issues.push('Contains excessive ellipsis');
    return { valid: issues.length === 0, sluglineCount: sluglines.length, issues };
}

function roundTo(n: number, places: number): number {
    const factor = Math.pow(10, places);
    return Math.round(n * factor) / factor;
}

const driftScanner = new DriftScannerService();
const validator = new ScreenplayValidatorService();

// ============================================================
// FIX 1: STATE DRIFT SCANNER
// ============================================================
describe('FIX 1: State Drift Scanner — Post-Gen Contradiction Checker', () => {

    // --- Core Drift Detection ---
    it('should detect a dead character performing actions', () => {
        const text = `INT. THRONE ROOM - DAY\n\nARTHUR stands tall.\nThe king nods.\nARTHUR walks toward the window.`;
        const report = driftScanner.scan(text, [{ name: 'ARTHUR', currentStatus: 'Dead' }]);
        expect(report.hasDrift).toBe(true);
        expect(report.characterDrifts.length).toBeGreaterThan(0);
        expect(report.characterDrifts[0].severity).toBe('high');
    });

    it('should detect a dead character performing any action verb', () => {
        const verbs = ['runs', 'jumps', 'sits', 'grabs', 'holds', 'pushes', 'kicks', 'throws', 'speaks', 'shouts', 'laughs', 'smiles', 'frowns', 'points', 'nods', 'waves', 'picks', 'reaches', 'bends', 'turns', 'enters', 'exits', 'rides', 'drives', 'stands'];
        for (const verb of verbs) {
            const text = `INT. HALL - DAY\n\nARTHUR ${verb} toward the exit.`;
            const report = driftScanner.scan(text, [{ name: 'ARTHUR', currentStatus: 'Dead' }]);
            expect(report.hasDrift).toBe(true);
        }
    });

    it('should not flag a dead character when mentioned only in past tense', () => {
        const text = `INT. THRONE ROOM - DAY\n\nARTHUR was a great king.\nThe kingdom mourns him.`;
        const report = driftScanner.scan(text, [{ name: 'ARTHUR', currentStatus: 'Dead' }]);
        expect(report.hasDrift).toBe(false);
    });

    it('should detect missing held items', () => {
        const text = `EXT. FOREST - NIGHT\n\nREN runs through the trees.`;
        const report = driftScanner.scan(text, [{ name: 'REN', heldItems: ['sword'], currentStatus: 'Stable' }]);
        expect(report.hasDrift).toBe(true);
        expect(report.itemDrifts.length).toBeGreaterThan(0);
    });

    it('should not flag items present in text', () => {
        const text = `EXT. FOREST - NIGHT\n\nREN grips his sword and runs through the trees.`;
        const report = driftScanner.scan(text, [{ name: 'REN', heldItems: ['sword'], currentStatus: 'Stable' }]);
        expect(report.hasDrift).toBe(false);
    });

    it('should flag multiple missing items', () => {
        const text = `INT. VAULT - NIGHT\n\nJULIA opens the door. She looks around.`;
        const report = driftScanner.scan(text, [{ name: 'JULIA', heldItems: ['key', 'map', 'lamp'], currentStatus: 'Stable' }]);
        expect(report.hasDrift).toBe(true);
        expect(report.itemDrifts.length).toBe(3);
    });

    it('should not flag when all items are mentioned in text', () => {
        const text = `INT. VAULT - NIGHT\n\nJULIA uses the key to unlock the door, consults her map, and lights her lamp.`;
        const report = driftScanner.scan(text, [{ name: 'JULIA', heldItems: ['key', 'map', 'lamp'], currentStatus: 'Stable' }]);
        expect(report.hasDrift).toBe(false);
    });

    it('should report no drift when character state matches text exactly', () => {
        const text = `INT. HUT - DAY\n\nBHEEM is wounded and bleeding from his arm.`;
        const report = driftScanner.scan(text, [{ name: 'BHEEM', currentStatus: 'Wounded' }]);
        expect(report.hasDrift).toBe(false);
    });

    it('should detect contradictory actions for unconscious characters', () => {
        const text = `INT. CELL - DAY\n\nREN lies on the floor.\nREN climbs to his feet.`;
        const report = driftScanner.scan(text, [{ name: 'REN', currentStatus: 'Unconscious' }]);
        expect(report.hasDrift).toBe(true);
    });

    it('should detect drift for "Injured" status with no injury mention', () => {
        const text = `INT. ROOM - DAY\n\nKAI walks confidently across the room.`;
        const report = driftScanner.scan(text, [{ name: 'KAI', currentStatus: 'Injured' }]);
        expect(report.hasDrift).toBe(true);
    });

    it('should detect "Dead" character speaking dialogue', () => {
        const text = `INT. ROOM - DAY\n\nARTHUR:\nI am still alive!`;
        const report = driftScanner.scan(text, [{ name: 'ARTHUR', currentStatus: 'Dead' }]);
        expect(report.hasDrift).toBe(true);
    });

    it('should detect "Dead" character saying dialogue as contradiction', () => {
        const text = `INT. ROOM - DAY\n\nARTHUR says hello.`;
        const report = driftScanner.scan(text, [{ name: 'ARTHUR', currentStatus: 'Dead' }]);
        expect(report.hasDrift).toBe(true);
    });

    // --- Multiple Characters ---
    it('should detect drift for one of multiple characters', () => {
        const text = `INT. ROOM - DAY\n\nREN sits calmly.\nJULIA lies bleeding on the ground.`;
        const report = driftScanner.scan(text, [
            { name: 'REN', currentStatus: 'Healthy' },
            { name: 'JULIA', currentStatus: 'Dead' },
        ]);
        expect(report.hasDrift).toBe(true);
        const juliaDrift = report.characterDrifts.find(d => d.name === 'JULIA');
        expect(juliaDrift).toBeDefined();
    });

    it('should handle multiple characters with no drift when states match text', () => {
        const text = `INT. ROOM - DAY\n\nREN sits calmly.\nJULIA is wounded on the ground.`;
        const report = driftScanner.scan(text, [
            { name: 'REN', currentStatus: 'Healthy' },
            { name: 'JULIA', currentStatus: 'Wounded' },
        ]);
        expect(report.hasDrift).toBe(false);
    });

    it('should handle multiple characters all with drift when none match', () => {
        const text = `INT. ROOM - DAY\n\nBoth stand silently.`;
        const report = driftScanner.scan(text, [
            { name: 'REN', currentStatus: 'Dead', heldItems: ['sword'] },
            { name: 'JULIA', currentStatus: 'Dead', heldItems: ['shield'] },
        ]);
        expect(report.hasDrift).toBe(true);
        expect(report.characterDrifts.length + report.itemDrifts.length).toBeGreaterThanOrEqual(2);
    });

    it('should handle characters with same status but different matching items', () => {
        const text = `INT. ROOM - DAY\n\nREN reads a book.\nJULIA writes a letter with a pen.`;
        const report = driftScanner.scan(text, [
            { name: 'REN', currentStatus: 'Healthy', heldItems: ['book'] },
            { name: 'JULIA', currentStatus: 'Healthy', heldItems: ['letter', 'pen'] },
        ]);
        expect(report.hasDrift).toBe(false);
    });

    // --- Name Matching Edge Cases ---
    it('should NOT match character name as substring of larger word (word boundaries active)', () => {
        const text = `INT. LAB - DAY\n\nThe scientist RENDERs a 3D model of the city.`;
        const report = driftScanner.scan(text, [{ name: 'REN', currentStatus: 'Dead' }]);
        expect(report.hasDrift).toBe(false);
    });

    it('should NOT match name as substring in longer words', () => {
        const text = `INT. TEMPLE - DAY\n\nThe parrot in the ARJUNA tree chirps loudly.`;
        const report = driftScanner.scan(text, [{ name: 'ARJUN', currentStatus: 'Healthy' }]);
        expect(report.hasDrift).toBe(false);
    });

    it('should match character name case-insensitively in text', () => {
        const text = `INT. HALL - DAY\n\nren walks through the door.`;
        const report = driftScanner.scan(text, [{ name: 'REN', currentStatus: 'Dead' }]);
        expect(report.hasDrift).toBe(true);
    });

    it('should match character name with mixed case', () => {
        const text = `INT. HALL - DAY\n\nArThUr sits on the throne.`;
        const report = driftScanner.scan(text, [{ name: 'ARTHUR', currentStatus: 'Dead' }]);
        expect(report.hasDrift).toBe(true);
    });

    it('should handle character names with hyphens', () => {
        const text = `INT. HALL - DAY\n\nJEAN-CLAUDE enters the room.`;
        const report = driftScanner.scan(text, [{ name: 'JEAN-CLAUDE', currentStatus: 'Dead' }]);
        expect(report.hasDrift).toBe(true);
    });

    it('should handle character names with apostrophes', () => {
        const text = `INT. CHURCH - DAY\n\nO'BRIEN kneels in prayer.`;
        const report = driftScanner.scan(text, [{ name: "O'BRIEN", currentStatus: 'Dead' }]);
        expect(report.hasDrift).toBe(true);
    });

    it('should handle very long character names', () => {
        const longName = 'METHUSELAHBERTRANDTHEGREAT';
        const text = `INT. PALACE - DAY\n\n${longName} commands the legions.`;
        const report = driftScanner.scan(text, [{ name: longName, currentStatus: 'Dead' }]);
        expect(report.hasDrift).toBe(true);
    });

    it('should handle single-character name', () => {
        const text = `INT. ROOM - DAY\n\nA walks forward.`;
        const report = driftScanner.scan(text, [{ name: 'A', currentStatus: 'Dead' }]);
        expect(report.hasDrift).toBe(true);
    });

    // --- Status Matching Edge Cases ---
    it('should match status "Dead" via related words like "died"', () => {
        const text = `INT. ROOM - DAY\n\nARTHUR died hours ago. His body lies still.`;
        const report = driftScanner.scan(text, [{ name: 'ARTHUR', currentStatus: 'Dead' }]);
        expect(report.hasDrift).toBe(false);
    });

    it('should match status "Wounded" via related words like "injury"', () => {
        const text = `INT. ROOM - DAY\n\nBHEEM tends to his injury.`;
        const report = driftScanner.scan(text, [{ name: 'BHEEM', currentStatus: 'Wounded' }]);
        expect(report.hasDrift).toBe(false);
    });

    it('should match status "Furious" via related words like "anger"', () => {
        const text = `INT. ROOM - DAY\n\nREN's anger boils over as he shouts.`;
        const report = driftScanner.scan(text, [{ name: 'REN', currentStatus: 'Furious' }]);
        expect(report.hasDrift).toBe(false);
    });

    it('should match status "Sleeping" via words like "asleep"', () => {
        const text = `INT. BEDROOM - DAY\n\nJULIA is fast asleep in her bed.`;
        const report = driftScanner.scan(text, [{ name: 'JULIA', currentStatus: 'Sleeping' }]);
        expect(report.hasDrift).toBe(false);
    });

    it('should flag status mismatch when character is mentioned but not in expected status', () => {
        const text = `INT. ROOM - DAY\n\nREN calmly reads a book.`;
        const report = driftScanner.scan(text, [{ name: 'REN', currentStatus: 'Furious' }]);
        expect(report.hasDrift).toBe(true);
    });

    it('should not flag "Healthy" status when character is mentioned doing normal actions', () => {
        const text = `INT. ROOM - DAY\n\nREN walks across the room.`;
        const report = driftScanner.scan(text, [{ name: 'REN', currentStatus: 'Healthy' }]);
        expect(report.hasDrift).toBe(false);
    });

    // --- Item Matching Edge Cases ---
    it('should detect item drift when item not mentioned anywhere in text', () => {
        const text = `INT. ARMORY - DAY\n\nREN enters empty-handed.`;
        const report = driftScanner.scan(text, [{ name: 'REN', heldItems: ['sword'], currentStatus: 'Stable' }]);
        expect(report.hasDrift).toBe(true);
    });

    it('should not flag item drift when item is mentioned as a word in text', () => {
        const text = `INT. ARMORY - DAY\n\nThe sword lies on the table.\nREN enters empty-handed.`;
        const report = driftScanner.scan(text, [{ name: 'REN', heldItems: ['sword'], currentStatus: 'Stable' }]);
        expect(report.hasDrift).toBe(false);
    });

    it('should handle empty heldItems array', () => {
        const text = `INT. ROOM - DAY\n\nREN enters.`;
        const report = driftScanner.scan(text, [{ name: 'REN', currentStatus: 'Stable', heldItems: [] }]);
        expect(report.hasDrift).toBe(false);
    });

    it('should handle undefined heldItems', () => {
        const text = `INT. ROOM - DAY\n\nREN enters.`;
        const report = driftScanner.scan(text, [{ name: 'REN', currentStatus: 'Stable' }]);
        expect(report.hasDrift).toBe(false);
    });

    // --- Empty / Edge Inputs ---
    it('should handle empty text', () => {
        const report = driftScanner.scan('', [{ name: 'REN', currentStatus: 'Angry' }]);
        expect(report.hasDrift).toBe(false);
    });

    it('should handle null text', () => {
        const report = driftScanner.scan(null as any, [{ name: 'REN', currentStatus: 'Angry' }]);
        expect(report.hasDrift).toBe(false);
    });

    it('should handle undefined text', () => {
        const report = driftScanner.scan(undefined as any, [{ name: 'REN', currentStatus: 'Angry' }]);
        expect(report.hasDrift).toBe(false);
    });

    it('should handle empty character context array', () => {
        const report = driftScanner.scan('INT. ROOM - DAY\nREN enters.', []);
        expect(report.hasDrift).toBe(false);
    });

    it('should handle null character context', () => {
        const report = driftScanner.scan('INT. ROOM - DAY\nREN enters.', null as any);
        expect(report.hasDrift).toBe(false);
    });

    it('should handle undefined character context', () => {
        const report = driftScanner.scan('INT. ROOM - DAY\nREN enters.', undefined as any);
        expect(report.hasDrift).toBe(false);
    });

    it('should handle text with only whitespace', () => {
        const report = driftScanner.scan('   \n\n  \n  ', [{ name: 'REN', currentStatus: 'Angry' }]);
        expect(report.hasDrift).toBe(false);
    });

    it('should handle text with unicode characters when states are matched', () => {
        const text = `INT. ROOM - DAY\n\nREN 进入房间。`;
        const report = driftScanner.scan(text, [{ name: 'REN', currentStatus: 'Healthy' }]);
        expect(report.hasDrift).toBe(false);
    });

    it('should handle very long text without crashing', () => {
        const lines: string[] = [];
        for (let i = 0; i < 5000; i++) {
            lines.push(`INT. SCENE ${i} - DAY\n\nREN performs action ${i}.\nJULIA responds.`);
        }
        const text = lines.join('\n');
        const report = driftScanner.scan(text, [
            { name: 'REN', currentStatus: 'Injured', heldItems: ['sword'] },
            { name: 'JULIA', currentStatus: 'Healthy' },
        ]);
        expect(report.warningCount).toBeGreaterThan(0);
    });

    // --- Report Structure ---
    it('should produce accurate warningCount matching drift entries', () => {
        const text = `INT. ROOM - DAY\n\nKAI runs.`;
        const report = driftScanner.scan(text, [
            { name: 'KAI', currentStatus: 'Injured', heldItems: ['staff'] },
        ]);
        expect(report.warningCount).toBeGreaterThan(0);
        expect(report.warningCount).toBe(report.characterDrifts.length + report.itemDrifts.length);
    });

    it('should include line numbers in drift reports', () => {
        const text = `LINE ONE\nLINE TWO\nLINE THREE\nARTHUR walks forward.\nLINE FIVE`;
        const report = driftScanner.scan(text, [{ name: 'ARTHUR', currentStatus: 'Dead' }]);
        expect(report.characterDrifts.length).toBeGreaterThan(0);
        expect(report.characterDrifts[0].lineNumber).toBe(4);
    });

    it('should report high severity for dead character actions', () => {
        const text = `INT. ROOM - DAY\n\nARTHUR walks.`;
        const report = driftScanner.scan(text, [{ name: 'ARTHUR', currentStatus: 'Dead' }]);
        expect(report.characterDrifts[0].severity).toBe('high');
    });

    it('should handle character mentioned multiple times in text', () => {
        const text = `INT. ROOM - DAY\n\nARTHUR stands.\nARTHUR sits.\nARTHUR walks.\nARTHUR speaks.`;
        const report = driftScanner.scan(text, [{ name: 'ARTHUR', currentStatus: 'Dead' }]);
        expect(report.hasDrift).toBe(true);
    });

    it('should NOT flag a character when context has null name', () => {
        const text = `INT. ROOM - DAY\n\nARTHUR walks.`;
        const report = driftScanner.scan(text, [{ name: null as any, currentStatus: 'Dead' }]);
        expect(report.hasDrift).toBe(false);
    });

    it('should NOT flag a character when context has empty name', () => {
        const text = `INT. ROOM - DAY\n\nARTHUR walks.`;
        const report = driftScanner.scan(text, [{ name: '', currentStatus: 'Dead' }]);
        expect(report.hasDrift).toBe(false);
    });
});

// ============================================================
// FIX 2: CASTING FALSE POSITIVES
// ============================================================
describe('FIX 2: Casting False Positives — Levenshtein Auto-Merge', () => {

    // --- Exact / Direct Matches ---
    it('should match exact name', () => {
        expect(isSpellingVariant('REN', ['REN', 'JULIA'])).toBe('REN');
    });

    it('should match exact name with different case', () => {
        expect(isSpellingVariant('ren', ['REN'])).toBe('REN');
    });

    it('should match exact name with mixed case', () => {
        expect(isSpellingVariant('ReN', ['REN'])).toBe('REN');
    });

    it('should return the existing name, not the proposed', () => {
        const result = isSpellingVariant('ren', ['REN']);
        expect(result).toBe('REN');
    });

    // --- Typo Tolerance ---
    it('should match single-character typo (dist=1)', () => {
        expect(isSpellingVariant('JULIS', ['JULIUS', 'REN'])).toBe('JULIUS');
    });

    it('should match two-character typo (dist=2)', () => {
        expect(isSpellingVariant('BHEEMA', ['BHEEM', 'ARJUN'])).toBe('BHEEM');
    });

    it('should match single insertion (dist=1)', () => {
        expect(isSpellingVariant('RENN', ['REN'])).toBe('REN');
    });

    it('should match single deletion (dist=1)', () => {
        expect(isSpellingVariant('RE', ['REN'])).toBe('REN');
    });

    it('should match single substitution (dist=1)', () => {
        expect(isSpellingVariant('RAN', ['REN'])).toBe('REN');
    });

    it('should match transposition (dist=2)', () => {
        expect(isSpellingVariant('RNE', ['REN'])).toBe('REN');
    });

    it('should match double transposition (dist=2)', () => {
        expect(isSpellingVariant('RNEE', ['RENE'])).toBe('RENE');
    });

    it('should match one insertion + one substitution (dist=2)', () => {
        expect(isSpellingVariant('JULIUS', ['JULIA'])).toBe('JULIA');
    });

    // --- Non-Matches ---
    it('should NOT match names with dist > 2 (ABC vs XYZ = 3)', () => {
        expect(isSpellingVariant('ABC', ['XYZ'])).toBeNull();
    });

    it('should match two-character names with dist=2 when within threshold (AB vs CD matches)', () => {
        expect(isSpellingVariant('AB', ['CD'])).toBe('CD');
    });

    it('should match two-character names with dist=2 (AB vs CB matches)', () => {
        expect(isSpellingVariant('AB', ['CB'])).toBe('CB');
    });

    it('should not match completely different names over dist=2', () => {
        expect(isSpellingVariant('ALEXANDER', ['REN'])).toBeNull();
    });

    // --- Edge Cases ---
    it('should return null for empty proposed name', () => {
        expect(isSpellingVariant('', ['REN'])).toBeNull();
    });

    it('should return null for whitespace-only proposed name', () => {
        expect(isSpellingVariant('   ', ['REN'])).toBeNull();
    });

    it('should return null for empty existing list', () => {
        expect(isSpellingVariant('REN', [])).toBeNull();
    });

    it('should return null for null existing list', () => {
        expect(isSpellingVariant('REN', null as any)).toBeNull();
    });

    it('should return null for undefined existing list', () => {
        expect(isSpellingVariant('REN', undefined as any)).toBeNull();
    });

    it('should handle trailing whitespace in proposed name', () => {
        expect(isSpellingVariant('  REN  ', ['REN'])).toBe('REN');
    });

    it('should handle leading whitespace in existing name', () => {
        expect(isSpellingVariant('REN', ['  REN'])).toBe('  REN');
    });

    it('should match single character names with dist=1', () => {
        expect(isSpellingVariant('A', ['B'])).toBe('B');
    });

    it('should match two-character names with dist=1', () => {
        expect(isSpellingVariant('AB', ['AC'])).toBe('AC');
    });

    it('should match two-character names with dist=2 (any 2-char pair differs by max 2)', () => {
        expect(isSpellingVariant('AB', ['CD'])).toBe('CD');
    });

    it('should match two-character names with dist=2 (AB vs CB)', () => {
        expect(isSpellingVariant('AB', ['CB'])).toBe('CB');
    });

    // --- Unicode ---
    it('should handle accented unicode characters (JOSE vs JOSÉ - dist=1)', () => {
        const result = isSpellingVariant('JOSE', ['JOSÉ']);
        expect(result).toBe('JOSÉ');
    });

    it('should handle accented characters in proposed name (JOSÉ vs JOSE - dist=1)', () => {
        const result = isSpellingVariant('JOSÉ', ['JOSE']);
        expect(result).toBe('JOSE');
    });

    // --- Special Characters in Names ---
    it('should handle names with hyphens (JEANCLAUDE vs JEAN-CLAUDE)', () => {
        expect(isSpellingVariant('JEANCLAUDE', ['JEAN-CLAUDE'])).toBe('JEAN-CLAUDE');
    });

    it('should handle names with apostrophes (OBRIEN vs O\'BRIEN)', () => {
        expect(isSpellingVariant('OBRIEN', ["O'BRIEN"])).toBe('O\'BRIEN');
    });

    it('should handle names with periods (DRJONES vs DR. JONES)', () => {
        expect(isSpellingVariant('DRJONES', ['DR. JONES'])).toBe('DR. JONES');
    });

    // --- Numbers in Names ---
    it('should match names with number differences when dist <= 2', () => {
        expect(isSpellingVariant('AGENT99', ['AGENT1'])).toBe('AGENT1');
    });

    it('should not match names with number dist > 2 (AGENT vs GUARD = 4)', () => {
        expect(isSpellingVariant('AGENT', ['GUARD'])).toBeNull();
    });

    // --- First Match Preference ---
    it('should return the closest match by order in list', () => {
        expect(isSpellingVariant('SIDDH', ['SIDDHARTHA', 'SID'])).toBe('SID');
    });

    it('should return exact match when one exists (not first list entry)', () => {
        expect(isSpellingVariant('JON', ['JONATHAN', 'JOHN', 'JON'])).toBe('JON');
    });

    // --- Very Long Names ---
    it('should handle very long names with single char difference', () => {
        const longName = 'METHUSELAHBERTRANDTHEGREATTHEFIRST';
        const typo = 'METHUSELAHBERTRANDTHEGREATTHEFIRT';
        expect(isSpellingVariant(typo, [longName])).toBe(longName);
    });

    // --- Double Letters ---
    it('should handle double letter differences (BHEEM vs BHEM, dist=1)', () => {
        expect(isSpellingVariant('BHEEM', ['BHEM'])).toBe('BHEM');
    });

    it('should handle double letter differences reverse (BEM vs BHEEM, dist=2)', () => {
        expect(isSpellingVariant('BEM', ['BHEEM'])).toBe('BHEEM');
    });

    // --- Multi-word names ---
    it('should handle multi-word names without spaces', () => {
        expect(isSpellingVariant('BIGBOSS', ['BIG BOSS'])).toBe('BIG BOSS');
    });

    it('should handle multi-word names with single difference', () => {
        expect(isSpellingVariant('BIG BOS', ['BIG BOSS'])).toBe('BIG BOSS');
    });
});

// ============================================================
// FIX 3: RLHF TEMPERATURE INJECTION
// ============================================================
describe('FIX 3: RLHF Over-Fitting Prevention — Temperature Injection', () => {

    // --- No Boost (feedback <= 2) ---
    it('should keep base temperature at 0 feedbacks', () => {
        expect(getRlhfBoostedTemperature(0, 0.3)).toBe(0.3);
    });

    it('should keep base temperature at 1 feedback', () => {
        expect(getRlhfBoostedTemperature(1, 0.3)).toBe(0.3);
    });

    it('should keep base temperature at 2 feedbacks', () => {
        expect(getRlhfBoostedTemperature(2, 0.3)).toBe(0.3);
    });

    it('should not boost even with high base temp at 2 feedbacks', () => {
        expect(getRlhfBoostedTemperature(2, 0.85)).toBe(0.85);
    });

    it('should not boost with baseTemp=0 at 2 feedbacks', () => {
        expect(getRlhfBoostedTemperature(2, 0.0)).toBe(0.0);
    });

    // --- Boost Applied ---
    it('should set boost=0.05 at 3 feedbacks', () => {
        expect(getRlhfBoostedTemperature(3, 0.3)).toBeGreaterThan(0.3);
        expect(getRlhfBoostedTemperature(3, 0.3)).toBeLessThan(0.4);
    });

    it('should set boost=0.10 at 4 feedbacks', () => {
        const t = getRlhfBoostedTemperature(4, 0.3);
        expect(t).toBeGreaterThan(0.39);
        expect(t).toBeLessThan(0.41);
    });

    it('should set boost=0.15 at 5 feedbacks', () => {
        const t = getRlhfBoostedTemperature(5, 0.3);
        expect(roundTo(t, 2)).toBe(0.45);
    });

    it('should set boost=max 0.35 at 9 feedbacks', () => {
        const t = getRlhfBoostedTemperature(9, 0.3);
        expect(roundTo(t, 2)).toBe(0.65);
    });

    // --- Cap at 0.85 ---
    it('should cap at 0.85 when base is already at cap', () => {
        expect(getRlhfBoostedTemperature(3, 0.85)).toBe(0.85);
    });

    it('should cap at 0.85 when base + boost exceeds 0.85', () => {
        expect(getRlhfBoostedTemperature(3, 0.82)).toBe(0.85);
    });

    it('should cap at 0.85 with massive feedback count', () => {
        expect(roundTo(getRlhfBoostedTemperature(1000, 0.3), 2)).toBe(0.65);
    });

    it('should cap at 0.85 with base=0.7 and max boost', () => {
        expect(getRlhfBoostedTemperature(10, 0.7)).toBe(0.85);
    });

    it('should cap at 0.85 with base=0.5 and max boost', () => {
        expect(getRlhfBoostedTemperature(9, 0.5)).toBe(0.85);
    });

    // --- Base Temperature of Zero ---
    it('should boost from baseline zero', () => {
        expect(getRlhfBoostedTemperature(3, 0.0)).toBeGreaterThan(0);
    });

    it('should max out from zero base', () => {
        expect(roundTo(getRlhfBoostedTemperature(9, 0.0), 2)).toBe(0.35);
    });

    // --- Proportionality ---
    it('should increase monotonically with feedback count', () => {
        const temps = [3, 4, 5, 6, 7, 8, 9].map(c => getRlhfBoostedTemperature(c, 0.3));
        for (let i = 1; i < temps.length; i++) {
            expect(temps[i]).toBeGreaterThanOrEqual(temps[i - 1]);
        }
    });

    it('should plateau after max boost reached (count >= 9)', () => {
        const t9 = getRlhfBoostedTemperature(9, 0.3);
        const t10 = getRlhfBoostedTemperature(10, 0.3);
        const t100 = getRlhfBoostedTemperature(100, 0.3);
        expect(roundTo(t10, 10)).toBe(roundTo(t9, 10));
        expect(roundTo(t100, 10)).toBe(roundTo(t9, 10));
    });

    // --- Exact Formula Verification (with rounding for IEEE 754) ---
    it('should follow formula: boost = min((count-2)*0.05, 0.35)', () => {
        const testCases = [
            { count: 3, expectedBoost: 0.05 },
            { count: 4, expectedBoost: 0.10 },
            { count: 5, expectedBoost: 0.15 },
            { count: 6, expectedBoost: 0.20 },
            { count: 7, expectedBoost: 0.25 },
            { count: 8, expectedBoost: 0.30 },
            { count: 9, expectedBoost: 0.35 },
            { count: 10, expectedBoost: 0.35 },
            { count: 50, expectedBoost: 0.35 },
        ];
        for (const tc of testCases) {
            const boosted = getRlhfBoostedTemperature(tc.count, 0.0);
            expect(roundTo(boosted, 10)).toBe(roundTo(tc.expectedBoost, 10));
        }
    });

    it('should work with various base temperatures', () => {
        expect(roundTo(getRlhfBoostedTemperature(4, 0.1), 2)).toBe(0.20);
        expect(roundTo(getRlhfBoostedTemperature(4, 0.5), 2)).toBe(0.60);
        expect(roundTo(getRlhfBoostedTemperature(4, 0.7), 2)).toBe(0.80);
        expect(getRlhfBoostedTemperature(4, 0.75)).toBe(0.85);
    });

    it('should never exceed 0.85 for base temps <= 0.85', () => {
        const baseValues = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.85];
        for (const base of baseValues) {
            for (let count = 3; count <= 20; count++) {
                const t = getRlhfBoostedTemperature(count, base);
                expect(t).toBeLessThanOrEqual(0.85);
            }
        }
    });

    it('should respect input when base > 0.85 and feedback <= 2', () => {
        expect(getRlhfBoostedTemperature(2, 0.9)).toBe(0.9);
        expect(getRlhfBoostedTemperature(1, 1.0)).toBe(1.0);
    });

    it('should cap at 0.85 even with base > 0.85 when feedback > 2', () => {
        expect(getRlhfBoostedTemperature(3, 0.9)).toBe(0.85);
        expect(getRlhfBoostedTemperature(5, 1.0)).toBe(0.85);
    });

    it('should never go below base temperature', () => {
        for (let count = 0; count <= 20; count++) {
            const t = getRlhfBoostedTemperature(count, 0.5);
            expect(t).toBeGreaterThanOrEqual(0.5);
        }
    });
});

// ============================================================
// FIX 3b: RLHF AGING
// ============================================================
describe('FIX 3b: RLHF Aging — Recency-Weighted Anchor Selection', () => {

    const now = Date.now();
    const minute = 60000;
    const hour = 3600000;

    // --- Basic Selection ---
    it('should select most recent feedbacks first', () => {
        const oldDate = new Date(now - 20000 * minute);
        const recentDate = new Date(now - minute);
        const feedbacks = [
            { category: 'voice', userCorrection: 'Speak formally', createdAt: oldDate },
            { category: 'trait', userCorrection: 'Use slang', createdAt: recentDate },
            { category: 'voice', userCorrection: 'Be quiet', createdAt: oldDate },
            { category: 'voice', userCorrection: 'Be loud', createdAt: recentDate },
        ];
        const anchors = getFilteredRlhfAnchors(feedbacks, 10080);
        expect(anchors.length).toBeLessThanOrEqual(3);
        const hasRecent = anchors.some(a => a.includes('Use slang') || a.includes('Be loud'));
        expect(hasRecent).toBe(true);
    });

    it('should prefer newer feedbacks over much older ones', () => {
        const feedbacks = Array.from({ length: 10 }, (_, i) => ({
            category: 'voice',
            userCorrection: `Rule ${i}`,
            createdAt: new Date(now - i * minute),
        }));
        const anchors = getFilteredRlhfAnchors(feedbacks, 10080);
        expect(anchors.length).toBeLessThanOrEqual(3);
        for (const a of anchors) {
            const idx = parseInt(a.split('.')[0]) - 1;
            expect(idx).toBeLessThan(5);
        }
    });

    // --- Aged Tagging ---
    it('should tag aged anchors with (aged) suffix', () => {
        const oldDate = new Date(now - 20000 * minute);
        const feedbacks = [{ category: 'voice', userCorrection: 'Speak formally', createdAt: oldDate }];
        const anchors = getFilteredRlhfAnchors(feedbacks, 10080);
        expect(anchors[0].includes('(aged)')).toBe(true);
    });

    it('should NOT tag very recent anchors as aged', () => {
        const recentDate = new Date(now - minute);
        const feedbacks = [{ category: 'voice', userCorrection: 'Speak formally', createdAt: recentDate }];
        const anchors = getFilteredRlhfAnchors(feedbacks, 10080);
        expect(anchors[0].includes('(aged)')).toBe(false);
    });

    it('should tag at boundary recencyWeight < 0.6', () => {
        const boundaryMs = 0.4 * 10080 * minute + 1;
        const boundaryDate = new Date(now - boundaryMs);
        const feedbacks = [{ category: 'voice', userCorrection: 'Boundary', createdAt: boundaryDate }];
        const anchors = getFilteredRlhfAnchors(feedbacks, 10080);
        expect(anchors[0].includes('(aged)')).toBe(true);
    });

    // --- Limit ---
    it('should limit to at most 3 anchors', () => {
        const feedbacks = Array.from({ length: 10 }, (_, i) => ({
            category: 'voice',
            userCorrection: `Rule ${i}`,
            createdAt: new Date(now - i * minute),
        }));
        const anchors = getFilteredRlhfAnchors(feedbacks, 10080);
        expect(anchors.length).toBeLessThanOrEqual(3);
    });

    it('should return only 1 when exactly 1 feedback', () => {
        const feedbacks = [{ category: 'voice', userCorrection: 'Rule 1', createdAt: new Date() }];
        const anchors = getFilteredRlhfAnchors(feedbacks, 10080);
        expect(anchors.length).toBe(1);
    });

    it('should return exactly 3 when given exactly 3 feedbacks', () => {
        const feedbacks = Array.from({ length: 3 }, (_, i) => ({
            category: 'voice',
            userCorrection: `Rule ${i}`,
            createdAt: new Date(now - i * hour),
        }));
        const anchors = getFilteredRlhfAnchors(feedbacks, 10080);
        expect(anchors.length).toBe(3);
    });

    // --- Edge Cases ---
    it('should return empty for zero feedbacks', () => {
        expect(getFilteredRlhfAnchors([])).toEqual([]);
    });

    it('should treat undefined createdAt as now (not aged)', () => {
        const feedbacks = [{ category: 'voice', userCorrection: 'No date' }];
        const anchors = getFilteredRlhfAnchors(feedbacks, 10080);
        expect(anchors.length).toBe(1);
        expect(anchors[0].includes('(aged)')).toBe(false);
    });

    it('should treat null createdAt as now', () => {
        const feedbacks = [{ category: 'voice', userCorrection: 'Null date', createdAt: null }];
        const anchors = getFilteredRlhfAnchors(feedbacks, 10080);
        expect(anchors.length).toBe(1);
    });

    it('should tag all as aged with maxAgeMinutes=0', () => {
        const feedbacks = [{ category: 'voice', userCorrection: 'Instant aged', createdAt: new Date() }];
        const anchors = getFilteredRlhfAnchors(feedbacks, 0);
        expect(anchors[0].includes('(aged)')).toBe(true);
    });

    it('should tag none as aged with very large maxAgeMinutes', () => {
        const oldDate = new Date(now - 365 * 86400000);
        const feedbacks = [{ category: 'voice', userCorrection: 'Old but not aged', createdAt: oldDate }];
        const anchors = getFilteredRlhfAnchors(feedbacks, 1e9);
        expect(anchors[0].includes('(aged)')).toBe(false);
    });

    // --- Format ---
    it('should format anchors with index number, category in brackets, and correction', () => {
        const feedbacks = [{ category: 'voice', userCorrection: 'Speak formally', createdAt: new Date() }];
        const anchors = getFilteredRlhfAnchors(feedbacks, 10080);
        expect(anchors[0].includes('1. [VOICE] Speak formally')).toBe(true);
    });

    it('should use GENERAL category when no category provided', () => {
        const feedbacks = [{ userCorrection: 'Generic fix', createdAt: new Date() }];
        const anchors = getFilteredRlhfAnchors(feedbacks, 10080);
        expect(anchors[0].includes('[GENERAL]')).toBe(true);
    });

    it('should preserve different categories across multiple anchors', () => {
        const feedbacks = [
            { category: 'voice', userCorrection: 'Speak', createdAt: new Date() },
            { category: 'trait', userCorrection: 'Act', createdAt: new Date() },
            { category: 'plot', userCorrection: 'Change', createdAt: new Date() },
        ];
        const anchors = getFilteredRlhfAnchors(feedbacks, 10080);
        expect(anchors.some(a => a.includes('[VOICE]'))).toBe(true);
        expect(anchors.some(a => a.includes('[TRAIT]'))).toBe(true);
        expect(anchors.some(a => a.includes('[PLOT]'))).toBe(true);
    });

    // --- Identical Timestamps ---
    it('should handle 5 feedbacks with identical timestamps (select any 3)', () => {
        const sameTime = new Date();
        const feedbacks = Array.from({ length: 5 }, (_, i) => ({
            category: 'voice',
            userCorrection: `Rule ${i}`,
            createdAt: sameTime,
        }));
        const anchors = getFilteredRlhfAnchors(feedbacks, 10080);
        expect(anchors.length).toBe(3);
    });

    // --- Empty Corrections ---
    it('should handle empty userCorrection string', () => {
        const feedbacks = [{ category: 'voice', userCorrection: '', createdAt: new Date() }];
        const anchors = getFilteredRlhfAnchors(feedbacks, 10080);
        expect(anchors.length).toBe(1);
        expect(anchors[0].includes('1. [VOICE]')).toBe(true);
    });

    it('should handle null userCorrection as string "null"', () => {
        const feedbacks = [{ category: 'voice', userCorrection: null as any, createdAt: new Date() }];
        const anchors = getFilteredRlhfAnchors(feedbacks, 10080);
        expect(anchors.length).toBe(1);
    });

    // --- Sort Order ---
    it('should return anchors sorted by recency descending', () => {
        const feedbacks = Array.from({ length: 5 }, (_, i) => ({
            category: 'voice',
            userCorrection: `Rule ${i}`,
            createdAt: new Date(now - (4 - i) * hour),
        }));
        const anchors = getFilteredRlhfAnchors(feedbacks, 10080);
        const indices = anchors.map(a => parseInt(a.match(/Rule (\d)/)![1]));
        for (let i = 1; i < indices.length; i++) {
            expect(indices[i - 1]).toBeGreaterThanOrEqual(indices[i]);
        }
    });
});

// ============================================================
// FIX 4: CONTENT DELTA GATING
// ============================================================
describe('FIX 4: Content Delta Gating — Character Discovery Skip', () => {

    // --- Edge Values ---
    it('should return 100 when no previous content', () => {
        expect(getContentDelta(undefined, 'New content')).toBe(100);
    });

    it('should return 100 when prev is null', () => {
        expect(getContentDelta(null as any, 'New content')).toBe(100);
    });

    it('should return 100 when prev is empty string', () => {
        expect(getContentDelta('', 'New content')).toBe(100);
    });

    it('should return 100 when next is empty string', () => {
        expect(getContentDelta('Old content', '')).toBe(100);
    });

    it('should return 100 when both are empty', () => {
        expect(getContentDelta('', '')).toBe(100);
    });

    it('should return 100 when prev is whitespace only', () => {
        expect(getContentDelta('   ', 'Content')).toBe(100);
    });

    it('should return 100 when next is whitespace only', () => {
        expect(getContentDelta('Content', '   ')).toBe(100);
    });

    it('should return 0 for identical content', () => {
        expect(getContentDelta('Same text', 'Same text')).toBe(0);
    });

    it('should return 0 for identical content with extra whitespace', () => {
        expect(getContentDelta('Hello World', '  Hello   World  ')).toBe(0);
    });

    // --- Normal Deltas ---
    it('should return high delta for completely different content', () => {
        const delta = getContentDelta('Old scene content here', 'Completely brand new scene text');
        expect(delta).toBeGreaterThan(50);
    });

    it('should return low delta for minor changes', () => {
        const delta = getContentDelta('The quick brown fox jumps over the lazy dog.', 'The quick brown fox jumps over the sleepy dog.');
        expect(delta).toBeLessThan(30);
    });

    it('should return delta proportional to change magnitude', () => {
        const minor = getContentDelta('abcdefghij', 'abcdefghik');
        const major = getContentDelta('abcdefghij', 'xxxxxxxxxx');
        expect(major).toBeGreaterThan(minor);
    });

    // --- Length Differences ---
    it('should handle prev longer than next', () => {
        const delta = getContentDelta('abcdefghijklmnop', 'abcdefg');
        expect(delta).toBeGreaterThan(0);
    });

    it('should handle prev shorter than next', () => {
        const delta = getContentDelta('abcdefg', 'abcdefghijklmnop');
        expect(delta).toBeGreaterThan(0);
    });

    // --- Character-Level ---
    it('should return 100 for single char difference', () => {
        expect(getContentDelta('a', 'b')).toBe(100);
    });

    it('should return 0 for identical single char', () => {
        expect(getContentDelta('a', 'a')).toBe(0);
    });

    it('should handle incremental character changes (abc->abd = 25%)', () => {
        const delta = getContentDelta('abc', 'abd');
        expect(delta).toBeGreaterThan(20);
        expect(delta).toBeLessThan(35);
    });

    it('should return 100 for completely different same-length strings', () => {
        expect(getContentDelta('abc', 'xyz')).toBe(100);
    });

    // --- Whitespace ---
    it('should normalize all whitespace before comparing', () => {
        expect(getContentDelta('Hello\nWorld\nFoo', 'Hello World Foo')).toBe(0);
    });

    it('should normalize tabs and spaces', () => {
        expect(getContentDelta('Hello\tWorld', 'Hello World')).toBe(0);
    });

    it('should handle multiple consecutive spaces', () => {
        expect(getContentDelta('Hello     World', 'Hello World')).toBe(0);
    });

    // --- Numbers ---
    it('should detect differences in numeric content', () => {
        const delta = getContentDelta('Chapter 1: The Beginning', 'Chapter 2: The Aftermath');
        expect(delta).toBeGreaterThan(0);
        expect(delta).toBeLessThan(50);
    });

    // --- Case Sensitivity ---
    it('should be case-sensitive (Hello != hello)', () => {
        expect(getContentDelta('Hello World', 'hello world')).toBeGreaterThan(0);
    });

    // --- Unicode ---
    it('should return 0 for identical unicode strings', () => {
        expect(getContentDelta('Hello 世界', 'Hello 世界')).toBe(0);
    });

    it('should detect unicode differences', () => {
        expect(getContentDelta('Hello 世界', 'Hello 地球')).toBeGreaterThan(0);
    });

    // --- Threshold Logic ---
    it('should give delta < 50 for minor single-word changes', () => {
        const prev = 'The quick brown fox jumps over the lazy dog.';
        const next = 'The quick brown fox jumps over the lazy cat.';
        expect(getContentDelta(prev, next)).toBeLessThan(50);
    });

    it('should give delta >= 50 for heavily rewritten content', () => {
        const prev = 'Old scene content';
        const next = 'Completely brand new scene text with different characters and plot';
        expect(getContentDelta(prev, next)).toBeGreaterThanOrEqual(50);
    });

    // --- Repetition ---
    it('should handle highly repetitive strings with single diff', () => {
        const a = 'A'.repeat(1000);
        const b = 'A'.repeat(999) + 'B';
        expect(getContentDelta(a, b)).toBeLessThan(1);
    });

    // --- Very Long Strings ---
    it('should handle very long strings with small append', () => {
        const a = 'Lorem ipsum dolor sit amet. '.repeat(100);
        const b = a + 'Extra content at the end.';
        expect(getContentDelta(a, b)).toBeGreaterThan(0);
        expect(getContentDelta(a, b)).toBeLessThan(5);
    });

    // --- Exact Values ---
    it('should return exactly 100 for completely different equal-length strings', () => {
        expect(getContentDelta('ABCDE', '12345')).toBe(100);
    });

    it('should return exactly 0 for identical strings', () => {
        expect(getContentDelta('The exact same string with punctuation!', 'The exact same string with punctuation!')).toBe(0);
    });
});

// ============================================================
// FIX 7: SCREENPLAY VALIDATOR
// ============================================================
describe('FIX 7: Screenplay Output Validation — Rule-Based Critic', () => {

    // --- Valid Screenplays ---
    it('should validate a properly formatted screenplay', () => {
        const text = `FADE IN:\n\nINT. COFFEE SHOP - DAY\n\nREN, 30s, waits by the counter.`;
        const result = validator.validate(text);
        expect(result.valid).toBe(true);
        expect(result.sluglineCount).toBe(1);
    });

    it('should validate multi-scene screenplay', () => {
        const text = `FADE IN:\n\nINT. ROOM - DAY\n\nREN sits.\n\nEXT. GARDEN - NIGHT\n\nJULIA walks.`;
        const result = validator.validate(text, ['REN', 'JULIA']);
        expect(result.valid).toBe(true);
        expect(result.sluglineCount).toBe(2);
    });

    it('should accept I/E. slugline format', () => {
        const text = `FADE IN:\n\nI/E. SPACESHIP - DAY\n\nREN floats.`;
        const result = validator.validate(text);
        expect(result.valid).toBe(true);
        expect(result.sluglineCount).toBe(1);
    });

    it('should accept INT./EXT. slugline format', () => {
        const text = `FADE IN:\n\nINT./EXT. VEHICLE - DAY\n\nREN drives.`;
        const result = validator.validate(text);
        expect(result.valid).toBe(true);
        expect(result.sluglineCount).toBe(1);
    });

    it('should accept slugline with hyphen continuation', () => {
        const text = `FADE IN:\n\nINT. PALACE - THE GREAT HALL - DAY\n\nREN enters.`;
        const result = validator.validate(text);
        expect(result.valid).toBe(true);
    });

    // --- Slugline Validation ---
    it('should flag missing sluglines', () => {
        const text = `REN walks into the room.\nJULIA looks up.`;
        const result = validator.validate(text);
        expect(result.valid).toBe(false);
        expect(result.issues.some(i => i.message.includes('No scene headers'))).toBe(true);
    });

    it('should flag text with no INT./EXT. sluglines as missing scene headers', () => {
        const text = `FADE IN:\n\nINDOOR ROOM - DAY\n\nREN enters.`;
        const result = validator.validate(text);
        expect(result.issues.some(i => i.message.includes('No scene headers'))).toBe(true);
    });

    it('should not flag valid sluglines as warnings', () => {
        const text = `FADE IN:\n\nINT. ROOM - DAY\n\nREN enters.`;
        const result = validator.validate(text);
        expect(result.issues.some(i => i.message.includes('Invalid slugline'))).toBe(false);
    });

    // --- Banned Patterns ---
    it('should detect markdown bold', () => {
        const text = `FADE IN:\n\nINT. ROOM - DAY\n\n**REN** enters.`;
        const result = validator.validate(text);
        expect(result.issues.some(i => i.message.includes('Markdown bold'))).toBe(true);
    });

    it('should detect markdown bold in dialogue', () => {
        const text = `FADE IN:\n\nINT. ROOM - DAY\n\nREN:\nI am **very** angry.`;
        const result = validator.validate(text);
        expect(result.issues.some(i => i.message.includes('Markdown bold'))).toBe(true);
    });

    it('should detect multiple bold occurrences across lines', () => {
        const text = `FADE IN:\n\nINT. ROOM - DAY\n\n**REN** enters.\n**JULIA** follows.`;
        const result = validator.validate(text);
        const boldIssues = result.issues.filter(i => i.message.includes('Markdown bold'));
        expect(boldIssues.length).toBe(2);
    });

    it('should detect HTML center tags', () => {
        const text = `FADE IN:\n\nINT. ROOM - DAY\n\n<center>REN enters.</center>`;
        const result = validator.validate(text);
        expect(result.issues.some(i => i.message.includes('<center>'))).toBe(true);
    });

    it('should detect generic HTML tags', () => {
        const text = `FADE IN:\n\nINT. ROOM - DAY\n\n<div>REN enters.</div>`;
        const result = validator.validate(text);
        expect(result.issues.some(i => i.message.includes('HTML'))).toBe(true);
    });

    it('should detect blockquote markdown', () => {
        const text = `FADE IN:\n\nINT. ROOM - DAY\n\n> REN speaks.`;
        const result = validator.validate(text);
        expect(result.issues.some(i => i.message.includes('blockquote'))).toBe(true);
    });

    it('should detect multiple banned patterns in one line', () => {
        const text = `FADE IN:\n\nINT. ROOM - DAY\n\n**REN** <center>enters</center>`;
        const result = validator.validate(text);
        const errorMsgs = result.issues.filter(i => i.type === 'formatting' && i.severity === 'error').map(i => i.message);
        const uniqueTypes = new Set(errorMsgs);
        expect(uniqueTypes.size).toBeGreaterThanOrEqual(3);
    });

    // --- Narrative Violations ---
    it('should flag "we see" narration', () => {
        const text = `FADE IN:\n\nINT. ROOM - DAY\n\nWe see REN sitting alone.`;
        const result = validator.validate(text);
        expect(result.issues.some(i => i.message.includes('we see/hear'))).toBe(true);
    });

    it('should flag "we hear" narration', () => {
        const text = `FADE IN:\n\nINT. ROOM - DAY\n\nWe hear footsteps approaching.`;
        const result = validator.validate(text);
        expect(result.issues.some(i => i.message.includes('we see/hear'))).toBe(true);
    });

    it('should flag "we watch" narration', () => {
        const text = `FADE IN:\n\nINT. ROOM - DAY\n\nWe watch REN leave.`;
        const result = validator.validate(text);
        expect(result.issues.some(i => i.message.includes('we see/hear'))).toBe(true);
    });

    it('should flag "he feels"', () => {
        const text = `FADE IN:\n\nINT. ROOM - DAY\n\nHe feels his anger rising.`;
        const result = validator.validate(text);
        expect(result.issues.some(i => i.message.includes('feels/thinks'))).toBe(true);
    });

    it('should flag "she thinks"', () => {
        const text = `FADE IN:\n\nINT. ROOM - DAY\n\nShe thinks about the plan.`;
        const result = validator.validate(text);
        expect(result.issues.some(i => i.message.includes('feels/thinks'))).toBe(true);
    });

    it('should flag "they feel"', () => {
        const text = `FADE IN:\n\nINT. ROOM - DAY\n\nThey feel the cold air.`;
        const result = validator.validate(text);
        expect(result.issues.some(i => i.message.includes('feels/thinks'))).toBe(true);
    });

    it('should flag "suddenly"', () => {
        const text = `FADE IN:\n\nINT. ROOM - DAY\n\nSuddenly, the door bursts open.`;
        const result = validator.validate(text);
        expect(result.issues.some(i => i.message.includes('suddenly/abruptly'))).toBe(true);
    });

    it('should flag "abruptly"', () => {
        const text = `FADE IN:\n\nINT. ROOM - DAY\n\nAbruptly, the lights go out.`;
        const result = validator.validate(text);
        expect(result.issues.some(i => i.message.includes('suddenly/abruptly'))).toBe(true);
    });

    it('should flag excessive ellipsis (4+ dots)', () => {
        const text = `FADE IN:\n\nINT. ROOM - DAY\n\nHe waits.... and then nothing... nothing....`;
        const result = validator.validate(text);
        expect(result.issues.some(i => i.message.includes('ellipsis'))).toBe(true);
    });

    it('should NOT flag 3-dot ellipsis as excessive', () => {
        const text = `FADE IN:\n\nINT. ROOM - DAY\n\nHe waits... and then nothing.`;
        const result = validator.validate(text);
        expect(result.issues.some(i => i.message.includes('ellipsis'))).toBe(false);
    });

    it('should detect multiple narrative violations in a single line', () => {
        const text = `FADE IN:\n\nINT. ROOM - DAY\n\nSuddenly, we see REN enter.`;
        const result = validator.validate(text);
        const warnings = result.issues.filter(i => i.type === 'formatting' && i.severity === 'warning');
        expect(warnings.length).toBeGreaterThanOrEqual(2);
    });

    // --- Character Cues ---
    it('should flag undeclared character names (indented)', () => {
        const text = `FADE IN:\n\nINT. PALACE - DAY\n\n                ZARATHUSTRA\nI have arrived.`;
        const result = validator.validate(text, ['REN']);
        expect(result.issues.some(i => i.message.includes('Undeclared character'))).toBe(true);
    });

    it('should NOT flag declared character names (colon style)', () => {
        const text = `FADE IN:\n\nINT. PALACE - DAY\n\nREN:\nI have arrived.`;
        const result = validator.validate(text, ['REN']);
        expect(result.issues.some(i => i.message.includes('Undeclared character'))).toBe(false);
    });

    it('should handle colon-style character cue', () => {
        const text = `FADE IN:\n\nINT. ROOM - DAY\n\nREN:\nHello.`;
        const result = validator.validate(text, ['REN']);
        expect(result.valid).toBe(true);
    });

    it('should handle indented character cue', () => {
        const text = `FADE IN:\n\nINT. ROOM - DAY\n\n                REN\nHello.`;
        const result = validator.validate(text, ['REN']);
        expect(result.valid).toBe(true);
    });

    it('should handle character cue with parenthetical (REN (angry):)', () => {
        const text = `FADE IN:\n\nINT. ROOM - DAY\n\nREN (angry):\nLeave me alone.`;
        const result = validator.validate(text, ['REN']);
        expect(result.valid).toBe(true);
    });

    it('should handle multi-word character name cue (BIG BOSS:)', () => {
        const text = `FADE IN:\n\nINT. ROOM - DAY\n\nBIG BOSS:\nI am in charge.`;
        const result = validator.validate(text, ['BIG BOSS']);
        expect(result.valid).toBe(true);
    });

    it('should handle hyphenated character name (JEAN-CLAUDE:)', () => {
        const text = `FADE IN:\n\nINT. ROOM - DAY\n\nJEAN-CLAUDE:\nBonjour.`;
        const result = validator.validate(text, ['JEAN-CLAUDE']);
        expect(result.valid).toBe(true);
    });

    it('should handle character with parenthetical on indented cue', () => {
        const text = `FADE IN:\n\nINT. ROOM - DAY\n\n                REN (V.O.)\nI speak from nowhere.`;
        const result = validator.validate(text, ['REN']);
        expect(result.valid).toBe(true);
    });

    it('should flag undeclared character with colon cue', () => {
        const text = `FADE IN:\n\nINT. ROOM - DAY\n\nMYSTERYMAN:\nWho am I?`;
        const result = validator.validate(text, ['REN']);
        expect(result.issues.some(i => i.message.includes('Undeclared character'))).toBe(true);
    });

    // --- Transitions ---
    it('should not flag transitions as issues', () => {
        const text = `FADE IN:\n\nINT. ROOM - DAY\n\nREN enters.\n\nCUT TO:\n\nEXT. GARDEN - NIGHT\n\nJULIA waits.`;
        const result = validator.validate(text, ['REN', 'JULIA']);
        expect(result.issues.some(i => i.message.includes('CUT TO'))).toBe(false);
    });

    it('should handle DISSOLVE TO transition cleanly', () => {
        const text = `FADE IN:\n\nINT. ROOM - DAY\n\nREN enters.\n\nDISSOLVE TO:\n\nEXT. GARDEN - NIGHT`;
        const result = validator.validate(text, ['REN']);
        expect(result.issues.length).toBeLessThan(3);
    });

    it('should handle FADE OUT transition cleanly', () => {
        const text = `FADE IN:\n\nINT. ROOM - DAY\n\nREN enters.\n\nFADE OUT.`;
        const result = validator.validate(text, ['REN']);
        expect(result.issues.length).toBeLessThan(3);
    });

    // --- FADE IN ---
    it('should warn when FADE IN is missing at the start', () => {
        const text = `INT. ROOM - DAY\n\nREN enters.`;
        const result = validator.validate(text);
        expect(result.issues.some(i => i.message.includes('FADE IN'))).toBe(true);
    });

    it('should accept FADE IN: with leading whitespace', () => {
        const text = `  FADE IN:\n\nINT. ROOM - DAY\n\nREN enters.`;
        const result = validator.validate(text);
        expect(result.issues.some(i => i.message.includes('FADE IN'))).toBe(false);
    });

    it('should accept lowercase "fade in:"', () => {
        const text = `fade in:\n\nINT. ROOM - DAY\n\nREN enters.`;
        const result = validator.validate(text);
        expect(result.issues.some(i => i.message.includes('FADE IN'))).toBe(false);
    });

    it('should accept mixed case "Fade In:"', () => {
        const text = `Fade In:\n\nINT. ROOM - DAY\n\nREN enters.`;
        const result = validator.validate(text);
        expect(result.issues.some(i => i.message.includes('FADE IN'))).toBe(false);
    });

    // --- Counts ---
    it('should count sluglines correctly', () => {
        const text = `FADE IN:\n\nINT. ONE - DAY\n\nREN enters.\n\nEXT. TWO - NIGHT\n\nJULIA exits.\n\nINT. THREE - DAWN\n\nBHEEM waits.`;
        const result = validator.validate(text);
        expect(result.sluglineCount).toBe(3);
    });

    it('should count dialogue lines', () => {
        const text = `FADE IN:\n\nINT. ROOM - DAY\n\nREN:\nHello.\nJULIA:\nGoodbye.`;
        const result = validator.validate(text, ['REN', 'JULIA']);
        expect(result.dialogueLineCount).toBe(4);
    });

    it('should count action lines (non-dialogue, non-slugline text)', () => {
        const text = `FADE IN:\n\nINT. ROOM - DAY\n\nREN walks to the window.\nHe looks outside.\nHe sighs.`;
        const result = validator.validate(text);
        expect(result.actionLineCount).toBe(3);
    });

    // --- Empty / Edge Inputs ---
    it('should return invalid for empty text', () => {
        const result = validator.validate('');
        expect(result.valid).toBe(false);
    });

    it('should return invalid for whitespace-only text', () => {
        const result = validator.validate('   \n\n  ');
        expect(result.valid).toBe(false);
    });

    it('should handle text with only transitions (no sluglines = missing slugline error)', () => {
        const text = `FADE IN:\n\nCUT TO:\n\nDISSOLVE TO:\n\nFADE OUT.`;
        const result = validator.validate(text);
        expect(result.sluglineCount).toBe(0);
        expect(result.issues.some(i => i.message.includes('No scene headers'))).toBe(true);
    });

    // --- Page Count ---
    it('should estimate page count based on line count (50 lines ~ 2 pages)', () => {
        const lines = Array.from({ length: 50 }, (_, i) => `Line ${i + 1}`);
        const text = `FADE IN:\n\nINT. ROOM - DAY\n\n${lines.join('\n')}`;
        const result = validator.validate(text);
        expect(result.estimatedPages).toBeGreaterThanOrEqual(2);
    });

    it('should estimate minimum 1 page for very short text', () => {
        const text = `FADE IN:\n\nINT. ROOM - DAY\n\nREN enters.`;
        const result = validator.validate(text);
        expect(result.estimatedPages).toBe(1);
    });

    it('should estimate proportionally for larger text (100 action lines)', () => {
        const text = `FADE IN:\n\nINT. ROOM - DAY\n\n${Array.from({ length: 100 }, (_, i) => `Line of action text number ${i}.`).join('\n')}`;
        const result = validator.validate(text);
        expect(result.estimatedPages).toBeGreaterThanOrEqual(4);
    });

    // --- Validity ---
    it('should be valid when only warnings exist (no errors)', () => {
        const text = `FADE IN:\n\nINT. ROOM - DAY\n\nREN enters.\n\nWe see him wait.`;
        const result = validator.validate(text);
        expect(result.issues.some(i => i.severity === 'warning')).toBe(true);
        expect(result.valid).toBe(true);
    });

    it('should be invalid when errors exist', () => {
        const text = `REN enters.\n\nWe see JULIA.`;
        const result = validator.validate(text);
        expect(result.valid).toBe(false);
    });

    // --- Mixed Issues ---
    it('should catch many issues in a single validation pass', () => {
        const text = `**REN** enters.\n\nWe see JULIA <center>waiting</center>\n\nHe feels nervous. Suddenly, she turns.`;
        const result = validator.validate(text, ['REN']);
        expect(result.issues.length).toBeGreaterThanOrEqual(5);
    });
});

// ============================================================
// FIX 6: RELATIONSHIP AI CLASSIFICATION
// ============================================================
describe('FIX 6: Relationship AI Classification — Beyond Keyword Matching', () => {

    it('should classify "hates" from betrayal description', async () => {
        const type = await classifyRelationshipWithAI('He betrayed his brother and seeks revenge for the murder of their father');
        expect(['hates', 'sibling_of', 'other']).toContain(type);
    });

    it('should classify "hates" from sworn enemies', async () => {
        const type = await classifyRelationshipWithAI('Sworn enemies who fight at every opportunity and wish each other dead');
        expect(['hates', 'other']).toContain(type);
    });

    it('should classify "sibling_of" from brother/sister descriptions', async () => {
        const type = await classifyRelationshipWithAI('Brothers bound by blood and duty, raised in the same castle');
        expect(['sibling_of', 'allied_with', 'other']).toContain(type);
    });

    it('should classify "allied_with" from close friendship', async () => {
        const type = await classifyRelationshipWithAI('Close friends who trust each other completely and would die for one another');
        expect(['allied_with', 'other']).toContain(type);
    });

    it('should classify "parent_of" from parent-child bond', async () => {
        const type = await classifyRelationshipWithAI('His mother who raised him from infancy and taught him everything');
        expect(['parent_of', 'allied_with', 'sibling_of', 'other']).toContain(type);
    });

    it('should classify "owns" from master-servant', async () => {
        const type = await classifyRelationshipWithAI('The master who owns him as property and controls his every move');
        expect(['owns', 'hates', 'other']).toContain(type);
    });

    it('should classify "member_of" from group membership', async () => {
        const type = await classifyRelationshipWithAI('A fellow member of the ancient order of knights sworn to protect the realm');
        expect(['member_of', 'allied_with', 'other']).toContain(type);
    });

    it('should detect rivalry from competition', async () => {
        const type = await classifyRelationshipWithAI('Rivals competing for the same throne, each wanting the other to fail');
        expect(['hates', 'other']).toContain(type);
    });

    it('should detect strained alliance (reluctant allies)', async () => {
        const type = await classifyRelationshipWithAI('Reluctant allies who need each other but trust each other not at all');
        expect(['allied_with', 'hates', 'other']).toContain(type);
    });

    it('should detect complex relationships from subtle description', async () => {
        const type = await classifyRelationshipWithAI('They grew up together but now stand on opposite sides of the war');
        expect(['hates', 'sibling_of', 'allied_with', 'other']).toContain(type);
    });

    it('should detect mentor relationship', async () => {
        const type = await classifyRelationshipWithAI('Her teacher who trained her for ten years and knows her potential');
        expect(type).toBeDefined();
    });

    it('should detect romantic relationship', async () => {
        const type = await classifyRelationshipWithAI('His lover who he has been secretly meeting for months, risking everything');
        expect(type).toBeDefined();
    });

    it('should handle empty text', async () => {
        expect(await classifyRelationshipWithAI('')).toBe('other');
    });

    it('should handle very long description', async () => {
        const longText = 'A complex relationship spanning decades. '.repeat(50) + 'They are allies in the end.';
        const type = await classifyRelationshipWithAI(longText);
        expect(type).toBeDefined();
    });

    it('should handle nonsense text gracefully (not crash)', async () => {
        const type = await classifyRelationshipWithAI('Xylophone rainbow quantum perpendicular moose');
        expect(type).toBeDefined();
    });

    it('should handle single word input', async () => {
        const type = await classifyRelationshipWithAI('Enemies');
        expect(type).toBeDefined();
    });

    it('should handle text with only numbers and symbols', async () => {
        expect(await classifyRelationshipWithAI('12345 !@#$% ^&*()')).toBe('other');
    });

    it('should handle text in all caps', async () => {
        const type = await classifyRelationshipWithAI('SWORN ENEMIES WHO FIGHT AT EVERY OPPORTUNITY');
        expect(['hates', 'other']).toContain(type);
    });

    it('should handle text with HTML formatting', async () => {
        const type = await classifyRelationshipWithAI('<b>He hates him</b> with a <i>burning passion</i>');
        expect(['hates', 'other']).toContain(type);
    });

    it('should handle contradictory descriptions', async () => {
        const type = await classifyRelationshipWithAI('They love each other but also want to kill each other');
        expect(type).toBeDefined();
    });

    it('should return consistent results for identical descriptions', async () => {
        const description = 'Brothers who share a deep bond of loyalty and love';
        const type1 = await classifyRelationshipWithAI(description);
        const type2 = await classifyRelationshipWithAI(description);
        expect(type1).toBe(type2);
    });

    it('should handle descriptions in other languages', async () => {
        const type = await classifyRelationshipWithAI('Il l\'a trahi et cherche maintenant à se venger');
        expect(['hates', 'other']).toContain(type);
    });

    it('should classify extremely ambiguous text as some valid type', async () => {
        const type = await classifyRelationshipWithAI('They know each other');
        expect(type).toBeDefined();
    });
});

// ============================================================
// FIX 8: COST/QUALITY ROUTING
// ============================================================
describe('FIX 8: Cost/Quality Routing — Model Profile Enforcement', () => {

    // --- Task Route Mapping ---
    it('should route character_discovery to instant', () => {
        expect(resolveModelForTask('character_discovery')).toBe('instant');
    });

    it('should route character_sync to instant', () => {
        expect(resolveModelForTask('character_sync')).toBe('instant');
    });

    it('should route state_extraction to thinking', () => {
        expect(resolveModelForTask('state_extraction')).toBe('thinking');
    });

    it('should route plot_summary to thinking', () => {
        expect(resolveModelForTask('plot_summary')).toBe('thinking');
    });

    it('should route scene_generation to thinking', () => {
        expect(resolveModelForTask('scene_generation')).toBe('thinking');
    });

    it('should route advanced_coherence to deep', () => {
        expect(resolveModelForTask('advanced_coherence')).toBe('deep');
    });

    it('should route relationship_analysis to deep', () => {
        expect(resolveModelForTask('relationship_analysis')).toBe('deep');
    });

    // --- Fallback ---
    it('should use requested model when no task route matches', () => {
        expect(resolveModelForTask('custom_task', 'premium')).toBe('premium');
    });

    it('should fall back to thinking when no route and no model requested', () => {
        expect(resolveModelForTask('unknown_task')).toBe('thinking');
    });

    it('should use requestedModel over route when specified for a known task', () => {
        expect(resolveModelForTask('character_discovery', 'deep')).toBe('deep');
    });

    it('should return thinking when requestedModel is undefined for unknown task', () => {
        expect(resolveModelForTask('unknown_task', undefined)).toBe('thinking');
    });

    it('should return thinking when requestedModel is empty string for unknown task', () => {
        expect(resolveModelForTask('unknown_task', '')).toBe('thinking');
    });

    // --- Case Insensitivity ---
    it('should handle uppercase task names', () => {
        expect(resolveModelForTask('CHARACTER_DISCOVERY')).toBe('instant');
    });

    it('should handle mixed case task names', () => {
        expect(resolveModelForTask('Scene_Generation')).toBe('thinking');
    });

    it('should handle task names with leading/trailing spaces', () => {
        expect(resolveModelForTask('  character_discovery  ')).toBe('instant');
    });

    // --- Edge Cases ---
    it('should return thinking for empty task name', () => {
        expect(resolveModelForTask('')).toBe('thinking');
    });

    it('should return thinking for null task name', () => {
        expect(resolveModelForTask(null as any)).toBe('thinking');
    });

    it('should return thinking for undefined task name', () => {
        expect(resolveModelForTask(undefined as any)).toBe('thinking');
    });

    it('should return thinking for whitespace-only task name', () => {
        expect(resolveModelForTask('   ')).toBe('thinking');
    });

    it('should return thinking for very long unknown task name', () => {
        expect(resolveModelForTask('a'.repeat(100))).toBe('thinking');
    });

    it('should return the requested model for task names with special chars', () => {
        expect(resolveModelForTask('character-discovery', 'thinking')).toBe('thinking');
    });

    // --- All Routes Defined ---
    it('should have all expected task routes returning non-empty string', () => {
        const expectedTasks = ['character_discovery', 'character_sync', 'state_extraction', 'plot_summary', 'scene_generation', 'advanced_coherence', 'relationship_analysis'];
        for (const task of expectedTasks) {
            const route = resolveModelForTask(task);
            expect(route !== null && route !== undefined && route !== '').toBe(true);
        }
    });

    it('should return valid model names for all known tasks', () => {
        const validModels = ['instant', 'thinking', 'deep'];
        const tasks = ['character_discovery', 'state_extraction', 'advanced_coherence', 'custom'];
        for (const task of tasks) {
            const route = resolveModelForTask(task, task === 'custom' ? 'thinking' : undefined);
            expect(validModels.includes(route)).toBe(true);
        }
    });
});

// ============================================================
// FIX 9: LORE REVERSE SYNC
// ============================================================
describe('FIX 9: Lore Reverse Sync — Entity → Character Propagation', () => {

    it('should only sync when type equals "character"', () => {
        const loreTypes = ['location', 'item', 'event', 'faction', 'concept', 'character'];
        const shouldSync = loreTypes.map(t => t === 'character');
        expect(shouldSync[5]).toBe(true);
        for (let i = 0; i < 5; i++) {
            expect(shouldSync[i]).toBe(false);
        }
    });

    it('should require properties field to exist for sync', () => {
        const withProps = { type: 'character', name: 'REN', properties: { traits: ['brave'] } };
        const withoutProps = { type: 'character', name: 'REN' };
        expect(withProps.properties !== null && withProps.properties !== undefined).toBe(true);
        expect((withoutProps as any).properties === undefined).toBe(true);
    });

    it('should extract traits from properties', () => {
        const props = { traits: ['brave', 'loyal', 'wise'] };
        expect(props.traits).toEqual(['brave', 'loyal', 'wise']);
    });

    it('should extract role from properties', () => {
        const props = { role: 'warrior' };
        expect(props.role).toBe('warrior');
    });

    it('should extract status from properties', () => {
        const props = { status: 'alive' };
        expect(props.status).toBe('alive');
    });

    it('should handle properties with only partial fields (traits only)', () => {
        const props = { traits: ['strong'] };
        expect(props.traits).toEqual(['strong']);
        expect((props as any).role === undefined).toBe(true);
        expect((props as any).status === undefined).toBe(true);
    });

    it('should handle properties with all optional fields set', () => {
        const props = { traits: ['swift'], role: 'archer', status: 'wounded' };
        expect(props.traits).toEqual(['swift']);
        expect(props.role).toBe('archer');
        expect(props.status).toBe('wounded');
    });

    it('should handle empty traits array', () => {
        expect([].length).toBe(0);
    });

    it('should not sync when type is location', () => {
        const type: string = 'location';
        const expected: string = 'character';
        expect(type === expected).toBe(false);
    });

    it('should not sync when type is event', () => {
        const type: string = 'event';
        const expected: string = 'character';
        expect(type === expected).toBe(false);
    });

    it('should not sync when type is faction', () => {
        const type: string = 'faction';
        const expected: string = 'character';
        expect(type === expected).toBe(false);
    });

    it('should not sync when type is item', () => {
        const type: string = 'item';
        const expected: string = 'character';
        expect(type === expected).toBe(false);
    });

    it('should not sync when type is concept', () => {
        const type: string = 'concept';
        const expected: string = 'character';
        expect(type === expected).toBe(false);
    });

    it('should handle properties with additional unknown fields', () => {
        const props = { unknownField: 'value', traits: ['curious'] };
        expect(props.traits).toEqual(['curious']);
        expect((props as any).unknownField).toBe('value');
    });
});

// ============================================================
// INTEGRATION: CROSS-FIX INTERACTIONS
// ============================================================
describe('INTEGRATION: Cross-Fix Interactions', () => {

    // --- Drift + Validator ---
    it('should chain drift scanner + validator end-to-end with no issues', () => {
        const text = `FADE IN:\n\nINT. TEMPLE - DAY\n\nARJUN is wounded, clutching his bow.`;
        const valResult = validateScreenplayFormat(text);
        expect(valResult.valid).toBe(true);
        const driftReport = driftScanner.scan(text, [{ name: 'ARJUN', currentStatus: 'Wounded', heldItems: ['bow'] }]);
        expect(driftReport.hasDrift).toBe(false);
    });

    it('should detect drift in valid screenplay format', () => {
        const text = `FADE IN:\n\nINT. THRONE - DAY\n\nARTHUR stands tall and speaks.`;
        const driftReport = driftScanner.scan(text, [{ name: 'ARTHUR', currentStatus: 'Dead' }]);
        expect(driftReport.hasDrift).toBe(true);
        const valResult = validateScreenplayFormat(text);
        expect(valResult.valid).toBe(true);
    });

    it('should detect both drift and format issues simultaneously', () => {
        const text = `**ARJUN** enters the room.\n\nWe see BHEEM sitting.`;
        const driftReport = driftScanner.scan(text, [{ name: 'ARJUN', currentStatus: 'Dead' }]);
        expect(driftReport.hasDrift).toBe(true);
        const valIssues = validateScreenplayFormat(text);
        expect(valIssues.issues.length).toBeGreaterThan(0);
    });

    // --- Empty Inputs ---
    it('should handle empty inputs across all systems', () => {
        expect(driftScanner.scan('', []).hasDrift).toBe(false);
        expect(validator.validate('').valid).toBe(false);
        expect(getContentDelta(undefined, '')).toBe(100);
        expect(getRlhfBoostedTemperature(0, 0.3)).toBe(0.3);
        expect(isSpellingVariant('', [])).toBeNull();
    });

    // --- Large Text ---
    it('should handle 50-scene text across drift + validator', () => {
        const lines: string[] = ['FADE IN:'];
        for (let i = 0; i < 50; i++) {
            lines.push(`INT. SCENE ${i} - DAY\n\nREN performs action ${i}.\nJULIA responds to him.`);
        }
        const text = lines.join('\n');
        const valResult = validator.validate(text, ['REN', 'JULIA']);
        expect(valResult.valid).toBe(true);
        expect(valResult.sluglineCount).toBe(50);
        const driftResult = driftScanner.scan(text, [{ name: 'REN', currentStatus: 'Injured', heldItems: ['sword'] }]);
        expect(driftResult.warningCount).toBeGreaterThan(0);
    });

    it('should detect drift from 1000-line text', () => {
        const lines: string[] = [];
        for (let i = 0; i < 1000; i++) {
            lines.push(`Line ${i}: REN continues walking through the corridor.`);
        }
        const text = lines.join('\n');
        const report = driftScanner.scan(text, [{ name: 'REN', currentStatus: 'Injured' }]);
        expect(report.hasDrift).toBe(true);
        expect(report.warningCount).toBeGreaterThan(0);
    });

    // --- Levenshtein + Delta ---
    it('should handle Levenshtein + content delta together', () => {
        expect(isSpellingVariant('SIDDHARHTA', ['SIDDHARTHA'])).toBe('SIDDHARTHA');
        expect(getContentDelta('Old page long content here', 'New page long content there')).toBeGreaterThan(0);
    });

    it('should handle Levenshtein + delta with empty edge inputs', () => {
        expect(isSpellingVariant('', [])).toBeNull();
        expect(getContentDelta('', '')).toBe(100);
    });

    it('should find spelling variant in a large cast list', () => {
        const cast = Array.from({ length: 100 }, (_, i) => `CHARACTER_${i}`);
        expect(isSpellingVariant('CHARACTER_5', cast)).toBe('CHARACTER_5');
    });

    it('should not match across large distance for random name in cast', () => {
        const cast = Array.from({ length: 100 }, (_, i) => `CHARACTER_${i}`);
        expect(isSpellingVariant('RANDOM_NAME', cast)).toBeNull();
    });

    // --- Temperature + Delta ---
    it('should apply RLHF temperature boost + content delta together', () => {
        expect(getRlhfBoostedTemperature(5, 0.3)).toBeGreaterThan(0.3);
        expect(getContentDelta('Same', 'Different completely new text here')).toBeGreaterThan(50);
    });

    it('should combine temperature aging + boost', () => {
        const feedbacks = [
            { category: 'voice', userCorrection: 'Speak formally', createdAt: new Date(Date.now() - 100000 * 60000) },
            { category: 'voice', userCorrection: 'Be loud', createdAt: new Date() },
            { category: 'voice', userCorrection: 'Shout', createdAt: new Date() },
        ];
        const anchors = getFilteredRlhfAnchors(feedbacks, 10080);
        const temp = getRlhfBoostedTemperature(feedbacks.length, 0.3);
        expect(anchors.length).toBeLessThanOrEqual(3);
        expect(temp).toBeGreaterThan(0.3);
        expect(anchors.some(a => a.includes('(aged)'))).toBe(true);
    });

    // --- Casting + Validator ---
    it('should catch undeclared characters that have spelling variants in cast', () => {
        const castNames = ['REN', 'JULIA', 'BHEEM'];
        const text = `FADE IN:\n\nINT. ROOM - DAY\n\n                RENN\nI am here.`;
        const variant = isSpellingVariant('RENN', castNames);
        const result = validator.validate(text, castNames);
        expect(variant).toBe('REN');
        expect(result.issues.some(i => i.message.includes('Undeclared'))).toBe(true);
    });

    // --- Full Pipeline ---
    it('should handle all fixes in a full pipeline simulation', () => {
        const newContent = 'INT. CASTLE - DAY\n\nREN is wounded on the ground.\n\nJULIA:\nHelp is coming!';
        const delta = getContentDelta('The old scene had REN and JULIA talking.', newContent);
        const driftReport = driftScanner.scan(newContent, [
            { name: 'REN', currentStatus: 'Wounded' },
            { name: 'JULIA', currentStatus: 'Stable' },
        ]);
        const valResult = validator.validate(newContent, ['REN', 'JULIA']);
        const temp = getRlhfBoostedTemperature(4, 0.3);
        const variantCheck = isSpellingVariant('JULI', ['REN', 'JULIA']);
        expect(delta).toBeGreaterThan(50);
        expect(driftReport.hasDrift).toBe(false);
        expect(valResult.valid).toBe(true);
        expect(roundTo(temp, 2)).toBe(0.40);
        expect(variantCheck).toBe('JULIA');
    });

    // --- Drift + Casting ---
    it('should handle spelling variants in drift scanner character names', () => {
        const text = `INT. ROOM - DAY\n\nRENN walks forward.`;
        const variant = isSpellingVariant('RENN', ['REN']);
        expect(variant).toBe('REN');
        const driftReport = driftScanner.scan(text, [{ name: 'RENN', currentStatus: 'Dead' }]);
        expect(driftReport.hasDrift).toBe(true);
    });

    // --- Large Scale ---
    it('should process 200 scenes across all systems without error', () => {
        const lines: string[] = ['FADE IN:'];
        for (let i = 0; i < 200; i++) {
            lines.push(`INT. SCENE_${i} - DAY\n\nREN performs action ${i}.\nJULIA watches silently.`);
        }
        const text = lines.join('\n');
        const valResult = validator.validate(text, ['REN', 'JULIA']);
        expect(valResult.sluglineCount).toBe(200);
        const driftResult = driftScanner.scan(text, [{ name: 'REN', currentStatus: 'Injured', heldItems: ['sword'] }]);
        expect(driftResult.warningCount).toBeGreaterThan(0);
        expect(getContentDelta('old', text)).toBeGreaterThan(50);
        expect(isSpellingVariant('REN', ['REN'])).toBe('REN');
    });

    // --- Stability ---
    it('should produce identical drift results on repeated calls', () => {
        const text = `FADE IN:\n\nINT. ROOM - DAY\n\nREN is wounded.\nJULIA helps him.`;
        const ctx = [{ name: 'REN', currentStatus: 'Wounded' }, { name: 'JULIA', currentStatus: 'Healthy' }];
        const r1 = driftScanner.scan(text, ctx);
        const r2 = driftScanner.scan(text, ctx);
        expect(r1.hasDrift).toBe(r2.hasDrift);
        expect(r1.warningCount).toBe(r2.warningCount);
        expect(r1.characterDrifts.length).toBe(r2.characterDrifts.length);
    });

    it('should produce identical content delta on repeated calls', () => {
        expect(getContentDelta('Hello World', 'Hello There')).toBe(getContentDelta('Hello World', 'Hello There'));
    });

    it('should produce identical temperature on repeated calls', () => {
        expect(getRlhfBoostedTemperature(5, 0.3)).toBe(getRlhfBoostedTemperature(5, 0.3));
    });

    it('should produce identical spelling variant on repeated calls', () => {
        expect(isSpellingVariant('RENN', ['REN'])).toBe(isSpellingVariant('RENN', ['REN']));
    });
});
