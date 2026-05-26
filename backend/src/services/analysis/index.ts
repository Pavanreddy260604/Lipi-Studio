import { Scene } from '../../models/scene/index.js';
import type { AnalysisDetail, DialogueRhythmReport, StructureReport } from './types.js';

export class AnalysisService {
    async analyzeDialogueRhythm(sceneId: string): Promise<DialogueRhythmReport> {
        const scene = await Scene.findById(sceneId);
        if (!scene || !scene.content) {
            return {
                type: 'dialogue_rhythm',
                summary: 'No content to analyze.',
                score: 0,
                grade: 'N/A',
                details: [{ severity: 'info', category: 'Content', message: 'Scene has no content to analyze.' }],
                generatedAt: Date.now(),
            };
        }

        const details: AnalysisDetail[] = [];
        const lines = scene.content.split('\n');
        let dialogueLineCount = 0;
        let actionLineCount = 0;
        let parentheticalCount = 0;
        let currentSpeaker = '';
        let consecutiveDialogueLines = 0;
        let maxConsecutiveDialogue = 0;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;

            if (/^[A-Z\s]{2,}$/.test(line) && line.length < 50 && !line.includes('.')) {
                if (currentSpeaker && currentSpeaker !== line) {
                    maxConsecutiveDialogue = Math.max(maxConsecutiveDialogue, consecutiveDialogueLines);
                    consecutiveDialogueLines = 0;
                }
                currentSpeaker = line;
                dialogueLineCount++;
                consecutiveDialogueLines++;
            } else if (/^\(/.test(line) && /\)$/.test(line)) {
                parentheticalCount++;
            } else {
                actionLineCount++;
            }
        }
        maxConsecutiveDialogue = Math.max(maxConsecutiveDialogue, consecutiveDialogueLines);

        if (actionLineCount === 0 && dialogueLineCount > 0) {
            details.push({
                severity: 'warning',
                category: 'Pacing',
                message: 'Scene is entirely dialogue with no action lines.',
                suggestion: 'Add action descriptions to ground the scene visually.',
            });
        }

        if (dialogueLineCount > 0 && actionLineCount / dialogueLineCount < 0.2) {
            details.push({
                severity: 'info',
                category: 'Balance',
                message: `Low action-to-dialogue ratio (${Math.round(actionLineCount / dialogueLineCount * 100)}%). Consider adding more visual storytelling.`,
                suggestion: 'Add action beats between dialogue exchanges.',
            });
        }

        if (maxConsecutiveDialogue > 20) {
            details.push({
                severity: 'warning',
                category: 'Pacing',
                message: `Very long dialogue stretch (${maxConsecutiveDialogue} consecutive lines without action).`,
                suggestion: 'Break up long dialogue passages with action or reactions.',
            });
        }

        if (parentheticalCount > 0 && parentheticalCount / dialogueLineCount > 0.3) {
            details.push({
                severity: 'warning',
                category: 'Formatting',
                message: 'Heavy parenthetical usage may indicate the dialogue is doing too much explaining.',
                suggestion: 'Let the dialogue speak for itself. Reserve parentheticals for essential tone cues.',
            });
        }

        if (details.length === 0) {
            details.push({
                severity: 'info',
                category: 'Rhythm',
                message: 'Dialogue rhythm looks balanced.',
                suggestion: 'Consider varying speech lengths for more natural flow.',
            });
        }

        const errors = details.filter(d => d.severity === 'error').length;
        const warnings = details.filter(d => d.severity === 'warning').length;
        const score = Math.max(0, Math.min(100, 100 - (errors * 20 + warnings * 10)));
        const grade = score >= 90 ? 'A' : score >= 80 ? 'B' : score >= 70 ? 'C' : score >= 60 ? 'D' : 'F';

        return {
            type: 'dialogue_rhythm',
            summary: details.length <= 1
                ? 'Dialogue rhythm is healthy with good pacing and variety.'
                : `Found ${details.length} areas to review. ${warnings} warnings, ${errors} issues.`,
            score,
            grade,
            details,
            generatedAt: Date.now(),
        };
    }

    async analyzeStructure(bibleId: string): Promise<StructureReport> {
        const scenes = await Scene.find({ bibleId }).sort({ sequenceNumber: 1 });
        const details: AnalysisDetail[] = [];

        if (scenes.length === 0) {
            return {
                type: 'structure',
                summary: 'No scenes to analyze.',
                score: 0,
                grade: 'N/A',
                details: [{ severity: 'info', category: 'Content', message: 'Project has no scenes yet.' }],
                generatedAt: Date.now(),
            };
        }

        const sluglinePattern = /^(INT\.|EXT\.|INT\.\/EXT\.|I\/E\.)\s+.+/i;
        const invalidSluglines = scenes.filter(s => !sluglinePattern.test(s.slugline));
        if (invalidSluglines.length > 0) {
            details.push({
                severity: 'warning',
                category: 'Formatting',
                message: `${invalidSluglines.length} scene(s) have invalid slugline format.`,
                suggestion: 'Sluglines should start with INT., EXT., or INT./EXT.',
            });
        }

        const sluglines = scenes.map(s => s.slugline.toLowerCase());
        const intScenes = sluglines.filter(s => s.startsWith('int.')).length;
        const extScenes = sluglines.filter(s => s.startsWith('ext.')).length;

        if (intScenes === 0 && extScenes > 0) {
            details.push({
                severity: 'info',
                category: 'Variety',
                message: 'All scenes are exterior (EXT.). Consider adding interior scenes for visual variety.',
            });
        } else if (extScenes === 0 && intScenes > 0) {
            details.push({
                severity: 'info',
                category: 'Variety',
                message: 'All scenes are interior (INT.). Consider adding exterior scenes for breathing room.',
            });
        }

        const noContent = scenes.filter(s => !s.content?.trim());
        if (noContent.length > 0) {
            details.push({
                severity: 'warning',
                category: 'Completeness',
                message: `${noContent.length} scene(s) have no content yet.`,
                suggestion: 'Generate or write content for empty scenes to complete the script.',
            });
        }

        const plannedCount = scenes.filter(s => s.status === 'planned').length;
        const draftedCount = scenes.filter(s => s.status === 'drafted').length;
        const reviewedCount = scenes.filter(s => s.status === 'reviewed').length;
        const finalCount = scenes.filter(s => s.status === 'final').length;

        if (plannedCount > scenes.length * 0.5) {
            details.push({
                severity: 'info',
                category: 'Progress',
                message: `${plannedCount}/${scenes.length} scenes are still in 'planned' status.`,
                suggestion: 'Focus on drafting planned scenes to move the project forward.',
            });
        }

        if (details.length === 0) {
            details.push({
                severity: 'info',
                category: 'Structure',
                message: 'Scene structure looks well-organized.',
                suggestion: 'Review act breaks and character arc points across scenes.',
            });
        }

        const errors = details.filter(d => d.severity === 'error').length;
        const warnings = details.filter(d => d.severity === 'warning').length;
        const score = Math.max(0, Math.min(100, 100 - (errors * 15 + warnings * 8)));
        const grade = score >= 90 ? 'A' : score >= 80 ? 'B' : score >= 70 ? 'C' : score >= 60 ? 'D' : 'F';

        return {
            type: 'structure',
            summary: `${scenes.length} scenes. ${draftedCount + reviewedCount + finalCount} written, ${plannedCount} planned.`,
            score,
            grade,
            details,
            generatedAt: Date.now(),
        };
    }
}

export const analysisService = new AnalysisService();
