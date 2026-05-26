export type AIProvider = 'gemini' | 'ollama' | 'mistral';

export const SCRIPT_WRITER_PATTERNS = {
    STOP_WORDS: ['[END]', '---', 'STORY_CONTEXT_SUMMARY:', 'SCENE_PLAN:', 'SCENE_SCRIPT:', 'CHARACTER_MEMORY_UPDATE:', 'PLOT_STATE_UPDATE:'],
    SEARCH_MARKER: '<<<SEARCH>>>',
    REPLACE_MARKER: '<<<REPLACE>>>',
    JSON_BLOCK: /```json\n?([\s\S]*?)\n?```/i
};
