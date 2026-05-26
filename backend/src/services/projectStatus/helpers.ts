import type { StatusSceneInput, SceneStatus } from './types.js';

export function toId(value: unknown): string {
    if (value && typeof value === 'object' && 'toString' in value) {
        return String(value);
    }
    return String(value || '');
}

export function toIso(value?: Date | string | null): string | undefined {
    if (!value) return undefined;
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

export function countWords(content: string): number {
    const trimmed = content.trim();
    return trimmed ? trimmed.split(/\s+/).length : 0;
}

export function calculateProgress(totalScenes: number, targetSceneCount: number): number {
    if (targetSceneCount <= 0) return totalScenes > 0 ? 100 : 0;
    return Math.min(100, Math.round((totalScenes / targetSceneCount) * 100));
}

export function critiqueIsStale(scene: StatusSceneInput): boolean {
    if (!scene.critique) return false;
    if (typeof scene.lastCritiqueContent !== 'string') return false;
    return (scene.content || '') !== scene.lastCritiqueContent;
}

export function uniqueBranches(branches: string[]): string[] {
    const clean = branches.map(branch => branch.trim()).filter(Boolean);
    return clean.length > 0 ? Array.from(new Set(clean)) : ['main'];
}
