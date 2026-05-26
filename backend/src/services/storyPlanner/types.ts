export type BeatSheetStructure =
    | 'save_the_cat'
    | 'three_act'
    | 'five_act'
    | 'heros_journey'
    | 'story_circle'
    | 'sequence'
    | 'indian_commercial'
    | 'tv_beat_sheet'
    | 'fictional_pulse';

export interface FullBeatSheetParams {
    bibleId: string;
    structureType: BeatSheetStructure;
    targetSceneCount?: number;
    customInstructions?: string;
}
