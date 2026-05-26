import assert from 'node:assert/strict';
import { buildProjectStatusSummary } from '../src/services/projectStatus.service';

const now = new Date('2026-05-18T10:00:00.000Z');

const baseProject = {
    _id: 'project-1',
    title: 'Monsoon Draft',
    logline: 'A composer returns home to finish an unfinished score.',
    genre: 'Drama',
    tone: 'Measured',
    language: 'English',
    targetSceneCount: 4,
    storyResources: [{ _id: 'resource-1' }],
    assistantPreferences: { defaultMode: 'ask', savedDirectives: [] },
    createdAt: now,
    updatedAt: now,
};

const sceneA = {
    _id: 'scene-1',
    sequenceNumber: 1,
    title: 'Arrival',
    slugline: 'INT. TRAIN STATION - NIGHT',
    summary: 'The composer arrives and avoids a call.',
    goal: 'Show avoidance.',
    content: 'INT. TRAIN STATION - NIGHT\n\nRain lashes the empty platform.',
    status: 'drafted',
    updatedAt: new Date('2026-05-18T10:05:00.000Z'),
    critique: undefined,
    highScore: undefined,
    assistantChatHistory: [
        { role: 'user', type: 'chat', content: 'Make this quieter.', timestamp: new Date('2026-05-18T10:06:00.000Z') },
        { role: 'assistant', type: 'proposal', status: 'pending', content: 'Try less dialogue.', timestamp: new Date('2026-05-18T10:07:00.000Z') },
    ],
};

const sceneB = {
    _id: 'scene-2',
    sequenceNumber: 2,
    title: 'Old Room',
    slugline: 'INT. CHILDHOOD ROOM - DAWN',
    summary: 'He opens a box of notes.',
    goal: 'Reveal history.',
    content: 'INT. CHILDHOOD ROOM - DAWN\n\nHe opens the warped box.\n\nMOTHER\nYou came back.',
    status: 'reviewed',
    updatedAt: new Date('2026-05-18T10:10:00.000Z'),
    critique: {
        score: 82,
        grade: 'B',
        summary: 'Strong mood.',
        formattingIssues: [],
        dialogueIssues: [],
        pacingIssues: ['Entry is slow.'],
        suggestions: ['Tighten the opening image.'],
    },
    lastCritiqueContent: 'older draft',
    highScore: {
        content: 'best draft',
        critique: {
            score: 86,
            grade: 'B+',
            summary: 'Best version.',
            formattingIssues: [],
            dialogueIssues: [],
            pacingIssues: [],
            suggestions: [],
        },
        savedAt: new Date('2026-05-18T10:11:00.000Z'),
    },
    assistantChatHistory: [],
};

const summary = buildProjectStatusSummary({
    project: baseProject,
    scenes: [sceneA, sceneB],
    characterCount: 3,
    treatmentCount: 1,
    snapshotCount: 2,
    latestSnapshotAt: new Date('2026-05-18T10:12:00.000Z'),
    branches: ['main', 'polish'],
});

assert.equal(summary.project.id, 'project-1');
assert.equal(summary.readiness.hasLogline, true);
assert.equal(summary.readiness.hasScenes, true);
assert.equal(summary.readiness.hasDraftedContent, true);
assert.equal(summary.readiness.hasCharacters, true);
assert.equal(summary.readiness.hasStoryResources, true);
assert.equal(summary.pipeline.totalScenes, 2);
assert.equal(summary.pipeline.draftedScenes, 1);
assert.equal(summary.pipeline.reviewedScenes, 1);
assert.equal(summary.pipeline.emptyScenes, 0);
assert.equal(summary.quality.reviewedScenes, 1);
assert.equal(summary.quality.staleCritiqueScenes, 1);
assert.equal(summary.quality.averageScore, 82);
assert.equal(summary.quality.bestScore, 86);
assert.equal(summary.assistant.totalMessages, 2);
assert.equal(summary.assistant.pendingProposals, 1);
assert.equal(summary.snapshots.count, 2);
assert.deepEqual(summary.snapshots.branches, ['main', 'polish']);
assert.equal(summary.export.ready, true);
assert.deepEqual(summary.export.formats, ['fountain', 'txt', 'json', 'pdf']);
assert.equal(summary.nextActions[0].id, 'review-stale-critiques');
assert.match(summary.syncToken, /^project-1:/);

const emptySummary = buildProjectStatusSummary({
    project: { ...baseProject, logline: '', storyResources: [], targetSceneCount: 3 },
    scenes: [],
    characterCount: 0,
    treatmentCount: 0,
    snapshotCount: 0,
    latestSnapshotAt: null,
    branches: [],
});

assert.equal(emptySummary.readiness.hasLogline, false);
assert.equal(emptySummary.pipeline.totalScenes, 0);
assert.equal(emptySummary.export.ready, false);
assert.deepEqual(emptySummary.export.blockers, ['Add at least one drafted scene before exporting.']);
assert.equal(emptySummary.nextActions[0].id, 'add-logline');

console.log('project status summary contract passed');
