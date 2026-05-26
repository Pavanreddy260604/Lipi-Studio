export interface AnalysisDetail {
    severity: 'info' | 'warning' | 'error';
    category: string;
    message: string;
    line?: number;
    suggestion?: string;
}

export interface DialogueRhythmReport {
    type: 'dialogue_rhythm';
    summary: string;
    score: number;
    grade: string;
    details: AnalysisDetail[];
    generatedAt: number;
}

export interface StructureReport {
    type: 'structure';
    summary: string;
    score: number;
    grade: string;
    details: AnalysisDetail[];
    generatedAt: number;
}
