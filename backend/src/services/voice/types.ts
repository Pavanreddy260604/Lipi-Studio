export interface IngestionResult {
    savedCount: number;
    skippedDuplicates: number;
    skippedShort: number;
    errorCount: number;
    characters: string[];
    sceneCount: number;
}
