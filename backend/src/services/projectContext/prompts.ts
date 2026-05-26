import type { ActiveSceneBrief, ProjectContext } from './types.js';

export function buildMandatorySceneBrief(scene: ActiveSceneBrief): string {
    const lines = [
        '## ACTIVE SCENE — MANDATORY (DO NOT IGNORE)',
        'You MUST write for this scene only. Honor the slugline and scene log below.',
        '',
        `**Sequence #:** ${scene.sequenceNumber}`,
        `**Scene header (slugline):** ${scene.slugline}`,
    ];
    if (scene.title?.trim()) {
        lines.push(`**Scene title:** ${scene.title.trim()}`);
    }
    lines.push(
        `**Scene log / summary:** ${scene.summary || '(none — infer from project context)'}`,
        `**Dramatic goal:** ${scene.goal?.trim() || 'Advance the plot with clear conflict and change.'}`,
        '',
        'Rules:',
        '- Open with this slugline (or the same INT./EXT. header in the project language).',
        '- Every action and line of dialogue must serve the scene log and goal.',
        '- Do not skip to other scenes or substitute a different story beat.'
    );
    return lines.join('\n');
}

export function toPromptBlock(ctx: ProjectContext): string {
    const sections: string[] = [];

    if (ctx.activeScene) {
        sections.push(buildMandatorySceneBrief(ctx.activeScene));
    }

    if (ctx.storyResources.length > 0) {
        const resourceBlocks = ctx.storyResources.map(r =>
            `#### ${r.title} (${r.type})\n${r.content}`
        ).join('\n\n');
        sections.push(`### SOURCE MATERIAL / STORY RESOURCES (CRITICAL — MANDATORY REFERENCE)\n${resourceBlocks}`);
    }

    sections.push(`## FULL PROJECT CONTEXT
**Title:** ${ctx.project.title}
**Logline:** ${ctx.project.logline}
**Genre:** ${ctx.project.genre}
**Tone:** ${(ctx.project.tone || 'Cinematic').slice(0, 300)}
**Language:** ${ctx.project.language}${ctx.project.transliteration ? ' (Transliteration Enabled)' : ''}
**Target Scenes:** ${ctx.project.targetSceneCount}
**Visual Style:** ${(ctx.project.visualStyle || 'Not set').slice(0, 300)}
**Rules:** ${ctx.project.rules.length > 0 ? ctx.project.rules.slice(0, 10).join('; ') : 'None'}`);

    if (ctx.project.storySoFar && ctx.project.storySoFar !== 'The story is just beginning.') {
        sections.push(`### STORY SO FAR\n${ctx.project.storySoFar}`);
    }

    if (ctx.project.globalOutline.length > 0) {
        sections.push(`### GLOBAL OUTLINE\n${ctx.project.globalOutline.map((b, i) => `${i + 1}. ${typeof b === 'string' ? b : JSON.stringify(b)}`).join('\n')}`);
    }

    if (ctx.characters.length > 0) {
        const charLines = ctx.characters.map(c => {
            const parts = [`**${c.name.toUpperCase()}** (${c.role})`];
            if (c.motivation) parts.push(`Motivation: ${c.motivation}`);
            if (c.traits) parts.push(`Traits: ${c.traits}`);
            if (c.description) parts.push(`${c.description}`);
            return parts.join(' — ');
        }).join('\n');
        sections.push(`### CAST\n${charLines}`);
    }

    if (ctx.lore && (ctx.lore.entities.length > 0 || ctx.lore.relations.length > 0)) {
        const loreBlocks: string[] = [];
        const nonCharEntities = ctx.lore.entities.filter(e => e.type !== 'character');
        if (nonCharEntities.length > 0) {
            const entityLines = nonCharEntities
                .map(e => `- **${e.name.toUpperCase()}** (${e.type}): ${e.description || 'No description.'}`)
                .join('\n');
            loreBlocks.push(`#### WORLD ENTITIES (LOCATIONS, OBJECTS, FACTIONS)\n${entityLines}`);
        }
        if (ctx.lore.relations.length > 0) {
            const relationLines = ctx.lore.relations
                .map(r => `- ${r.source} -> ${r.type.toUpperCase()} -> ${r.target}${r.description ? ` (${r.description})` : ''}`)
                .join('\n');
            loreBlocks.push(`#### LORE RELATIONSHIPS & KNOWLEDGE GRAPH\n${relationLines}`);
        }
        if (loreBlocks.length > 0) {
            sections.push(`### WORLD BUILDING & LORE KNOWLEDGE BASE\n${loreBlocks.join('\n\n')}`);
        }
    }

    if (ctx.scenes.length > 0) {
        const limit = Math.min(ctx.scenes.length, 200);
        const sceneLines = ctx.scenes.slice(0, limit).map(s => {
            let line = `[${s.sequenceNumber}] ${s.slugline}`;
            if (s.title) line += ` — "${s.title}"`;
            if (s.summary) line += ` | ${s.summary}`;
            if (s.status !== 'planned') line += ` [${s.status}]`;
            return line;
        }).join('\n');
        let header = `### SCENE MAP (${ctx.scenes.length} total)`;
        if (ctx.scenes.length > limit) header += ` — showing first ${limit}`;
        sections.push(`${header}\n${sceneLines}`);
    }

    return sections.join('\n\n');
}
