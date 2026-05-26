export type ScreenplayLineKind = 'blank' | 'cue' | 'parenthetical' | 'dialogue' | 'slug' | 'transition' | 'action';

export const STRUCTURED_SECTION_LABELS = [
    'STORY_CONTEXT_SUMMARY',
    'SCENE_PLAN',
    'SCENE_SCRIPT',
    'CHARACTER_MEMORY_UPDATE',
    'PLOT_STATE_UPDATE',
    'NARRATIVE_CRAFT',
    'RESEARCH_DISCLOSURE',
    'CREATIVE_PLAN',
    'AGENT_EXPLANATION'
] as const;
