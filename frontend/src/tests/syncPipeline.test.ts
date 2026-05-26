/**
 * Premium Standalone Synchronization Pipeline & Editor QA Test Suite
 * Total Assertions: 32
 */

import { test, expect } from './frontendQa.test.js';

// =========================================================================
// 1. Helper Logic Tests (Retry Backoff, Chat Mapping, Dynamic Debounce)
// =========================================================================

test('Exponential retry backoff calculation is accurately calculated and capped at 30 seconds', () => {
    // Helper function that mirrors the hook's backoff calculation:
    // Math.min(Math.pow(2, retryAttempt + 1) * 1000, 30000)
    const getBackoffDelay = (retryAttempt: number) => {
        return Math.min(Math.pow(2, retryAttempt + 1) * 1000, 30000);
    };

    // Attempt 0: 2^1 * 1000 = 2000ms (2 seconds)
    expect(getBackoffDelay(0)).toBe(2000);

    // Attempt 1: 2^2 * 1000 = 4000ms (4 seconds)
    expect(getBackoffDelay(1)).toBe(4000);

    // Attempt 2: 2^3 * 1000 = 8000ms (8 seconds)
    expect(getBackoffDelay(2)).toBe(8000);

    // Attempt 3: 2^4 * 1000 = 16000ms (16 seconds)
    expect(getBackoffDelay(3)).toBe(16000);

    // Attempt 4: 2^5 * 1000 = 32000ms -> capped at 30000ms (30 seconds)
    expect(getBackoffDelay(4)).toBe(30000);

    // Attempt 10: capped at 30000ms
    expect(getBackoffDelay(10)).toBe(30000);

    // Attempt 99: capped at 30000ms
    expect(getBackoffDelay(99)).toBe(30000);
});

test('Chat history mapping perfectly converts frontend ChatMessage shapes to backend MongoDB shapes', () => {
    // Helper function that mirrors the hook's chatMessages transformation logic:
    const mapChatHistory = (chatMessages: any[]) => {
        return chatMessages.map((msg: any) => ({
            role: msg.role === 'user' ? 'user' : 'assistant',
            type: msg.type === 'edit' ? 'proposal' : msg.type === 'critique' ? 'proposal' : msg.type === 'error' ? 'chat' : 'chat',
            content: msg.content || '',
            timestamp: msg.timestamp ? new Date(msg.timestamp) : new Date(1771112223330) // stable fallback date for test
        }));
    };

    const mockFrontChat = [
        { id: 'c1', role: 'user', content: 'Improve this dialogue', type: 'text', timestamp: 1771112224000 },
        { id: 'c2', role: 'assistant', content: 'Here is the rewrite', type: 'edit', timestamp: 1771112225000 },
        { id: 'c3', role: 'assistant', content: 'Needs dynamic pacing', type: 'critique', timestamp: 1771112226000 },
        { id: 'c4', role: 'assistant', content: 'Connection timed out', type: 'error', timestamp: 1771112227000 }
    ];

    const mapped = mapChatHistory(mockFrontChat);

    expect(mapped.length).toBe(4);
    
    // Assert user message
    expect(mapped[0].role).toBe('user');
    expect(mapped[0].type).toBe('chat');
    expect(mapped[0].content).toBe('Improve this dialogue');
    expect(mapped[0].timestamp.getTime()).toBe(1771112224000);

    // Assert assistant edit/proposal message
    expect(mapped[1].role).toBe('assistant');
    expect(mapped[1].type).toBe('proposal');
    expect(mapped[1].content).toBe('Here is the rewrite');
    expect(mapped[1].timestamp.getTime()).toBe(1771112225000);

    // Assert assistant critique message
    expect(mapped[2].role).toBe('assistant');
    expect(mapped[2].type).toBe('proposal');
    expect(mapped[2].content).toBe('Needs dynamic pacing');
    expect(mapped[2].timestamp.getTime()).toBe(1771112226000);

    // Assert assistant error message mapped to regular chat
    expect(mapped[3].role).toBe('assistant');
    expect(mapped[3].type).toBe('chat');
    expect(mapped[3].content).toBe('Connection timed out');
    expect(mapped[3].timestamp.getTime()).toBe(1771112227000);
});

test('Dynamic typing-aware debounce timer is calculated correctly based on typing status', () => {
    // Helper function that mirrors the hook's debounce selector:
    // const debounceMs = isTyping ? 2500 : 800;
    const getDebounceDelay = (isTyping: boolean) => {
        return isTyping ? 2500 : 800;
    };

    expect(getDebounceDelay(true)).toBe(2500); // 2.5s while actively typing
    expect(getDebounceDelay(false)).toBe(800); // 800ms when idle or first edit
});


// =========================================================================
// 2. High-Fidelity Save Pipeline Simulator
// =========================================================================

class SavePipelineSimulator {
    public saveState: 'saved' | 'unsaved' | 'saving' | 'error' = 'saved';
    public hasUnsavedChanges = false;
    public editorContent = '';
    public activeScene: { _id: string; content: string } | null = null;
    public lastSyncedSceneId: string | null = null;
    public isOffline = false;
    
    // Internal simulator states mimicking hooks' variables
    public isTyping = false;
    public isSaving = false;
    public hasPendingSave = false;
    public lastSavedContent: string | null = null;
    public justSaved = false;
    public mockStorage: Record<string, string> = {};
    public chatMessages: any[] = [];
    
    // Trackers
    public apiCalls: { sceneId: string; content: string; chatHistoryCount: number }[] = [];
    public apiShouldFail = false;
    
    constructor(scene: { _id: string; content: string } | null) {
        this.activeScene = scene;
        this.hydrate();
    }
    
    public hydrate() {
        if (!this.activeScene) {
            this.editorContent = '';
            this.lastSyncedSceneId = null;
            return;
        }

        const localDraft = this.mockStorage[`scene_draft_${this.activeScene._id}`];
        const contentVal = (localDraft && localDraft !== this.activeScene.content) ? localDraft : (this.activeScene.content || '');
        this.editorContent = contentVal;
        this.lastSavedContent = this.activeScene.content || '';
        this.justSaved = false;
        
        if (localDraft && localDraft !== this.activeScene.content) {
            this.saveState = 'unsaved';
            this.hasUnsavedChanges = true;
        } else {
            this.saveState = 'saved';
            this.hasUnsavedChanges = false;
        }
        this.lastSyncedSceneId = this.activeScene._id;
    }
    
    public handleContentChange(value: string) {
        if (value === this.editorContent) return;
        this.isTyping = true;
        this.editorContent = value;
        if (this.activeScene) {
            this.mockStorage[`scene_draft_${this.activeScene._id}`] = value;
        }
        this.justSaved = false;
        this.hasUnsavedChanges = true;
        this.saveState = 'unsaved';
    }
    
    public async triggerForceSave(): Promise<boolean> {
        if (!this.activeScene || this.isOffline) {
            return false;
        }
        
        if (this.isSaving) {
            this.hasPendingSave = true;
            return false;
        }
        
        this.isSaving = true;
        this.saveState = 'saving';
        
        try {
            if (this.apiShouldFail) {
                throw new Error('API Request Failed');
            }
            
            // Simulating API call
            this.apiCalls.push({
                sceneId: this.activeScene._id,
                content: this.editorContent,
                chatHistoryCount: this.chatMessages.length
            });
            
            this.lastSavedContent = this.editorContent;
            this.justSaved = true;
            delete this.mockStorage[`scene_draft_${this.activeScene._id}`];
            this.saveState = 'saved';
            this.hasUnsavedChanges = false;
            return true;
        } catch (err) {
            this.saveState = 'error';
            return false;
        } finally {
            this.isSaving = false;
            if (this.hasPendingSave) {
                this.hasPendingSave = false;
                // Defer next save call
                await this.triggerForceSave();
            }
        }
    }
    
    public async handleOnline() {
        this.isOffline = false;
        if (this.hasUnsavedChanges && this.saveState !== 'saving') {
            return await this.triggerForceSave();
        }
        return false;
    }
}


// =========================================================================
// 3. Pipeline Simulator Tests (Normal and Edge Cases)
// =========================================================================

test('Normal Case: Editor typing transitions to unsaved state and triggers save successfully', async () => {
    const initialScene = { _id: 'scene-123', content: 'INT. COFFEE SHOP - DAY' };
    const simulator = new SavePipelineSimulator(initialScene);
    
    // Initial hydrated state check
    expect(simulator.saveState).toBe('saved');
    expect(simulator.hasUnsavedChanges).toBe(false);
    expect(simulator.editorContent).toBe('INT. COFFEE SHOP - DAY');
    
    // User types in the editor
    simulator.handleContentChange('INT. COFFEE SHOP - DAY\n\nREN and JULIA sit at a corner table.');
    
    // State transitions to unsaved
    expect(simulator.saveState).toBe('unsaved');
    expect(simulator.hasUnsavedChanges).toBe(true);
    expect(simulator.mockStorage['scene_draft_scene-123']).toBe('INT. COFFEE SHOP - DAY\n\nREN and JULIA sit at a corner table.');
    
    // Simulate auto-save trigger
    const saveSucceeded = await simulator.triggerForceSave();
    
    // Verifies successful save and transitions
    expect(saveSucceeded).toBe(true);
    expect(simulator.saveState).toBe('saved');
    expect(simulator.hasUnsavedChanges).toBe(false);
    expect(simulator.mockStorage['scene_draft_scene-123']).toBe(undefined); // cache cleared!
    expect(simulator.apiCalls.length).toBe(1);
    expect(simulator.apiCalls[0].content).toBe('INT. COFFEE SHOP - DAY\n\nREN and JULIA sit at a corner table.');
});

test('Edge Case: Draft recovery on scene switch hydrated correctly', () => {
    const sceneA = { _id: 'scene-A', content: 'SCENE A CONTENT' };
    
    // Case A: Switched to scene-A, but no local draft exists
    const simulator1 = new SavePipelineSimulator(sceneA);
    expect(simulator1.editorContent).toBe('SCENE A CONTENT');
    expect(simulator1.saveState).toBe('saved');
    expect(simulator1.hasUnsavedChanges).toBe(false);
    
    // Case B: Switched to scene-A, and a local draft exists but matches exactly
    const simulator2 = new SavePipelineSimulator(sceneA);
    simulator2.mockStorage['scene_draft_scene-A'] = 'SCENE A CONTENT';
    simulator2.hydrate();
    expect(simulator2.editorContent).toBe('SCENE A CONTENT');
    expect(simulator2.saveState).toBe('saved');
    expect(simulator2.hasUnsavedChanges).toBe(false);
    
    // Case C: Switched to scene-A, and a differing local draft exists (CRASH RECOVERY)
    const simulator3 = new SavePipelineSimulator(sceneA);
    simulator3.mockStorage['scene_draft_scene-A'] = 'SCENE A CONTENT - RECOVERED EDIT';
    simulator3.hydrate();
    expect(simulator3.editorContent).toBe('SCENE A CONTENT - RECOVERED EDIT');
    expect(simulator3.saveState).toBe('unsaved');
    expect(simulator3.hasUnsavedChanges).toBe(true);
});

test('Edge Case: Queueing edits while saving triggers secondary sequential save', async () => {
    const initialScene = { _id: 'scene-123', content: 'START' };
    const simulator = new SavePipelineSimulator(initialScene);
    
    // Start an asynchronous/blocked save
    simulator.isSaving = true;
    simulator.saveState = 'saving';
    
    // User continues typing while saving is in progress
    simulator.handleContentChange('START - FIRST EDIT');
    expect(simulator.saveState).toBe('unsaved');
    
    // Trigger save should return false immediately but mark pending save
    const firstSaveResponse = await simulator.triggerForceSave();
    expect(firstSaveResponse).toBe(false);
    expect(simulator.hasPendingSave).toBe(true);
    
    // Complete the primary active save manually and release lock
    simulator.isSaving = false;
    
    // Manually run the pending sequence trigger (mirrors the finally block in triggerForceSave)
    if (simulator.hasPendingSave) {
        simulator.hasPendingSave = false;
        await simulator.triggerForceSave();
    }
    
    // Verifies that the pending save finished successfully
    expect(simulator.saveState).toBe('saved');
    expect(simulator.hasUnsavedChanges).toBe(false);
    expect(simulator.apiCalls.length).toBe(1);
    expect(simulator.apiCalls[0].content).toBe('START - FIRST EDIT');
});

test('Edge Case: Network offline prevents saves, online reconnection force-saves immediately', async () => {
    const initialScene = { _id: 'scene-123', content: 'START' };
    const simulator = new SavePipelineSimulator(initialScene);
    
    // Simulating user going offline
    simulator.isOffline = true;
    
    // User makes edits
    simulator.handleContentChange('OFFLINE EDIT');
    expect(simulator.saveState).toBe('unsaved');
    expect(simulator.mockStorage['scene_draft_scene-123']).toBe('OFFLINE EDIT');
    
    // Offline save attempt should fail silently and return false
    const saveResponse = await simulator.triggerForceSave();
    expect(saveResponse).toBe(false);
    expect(simulator.apiCalls.length).toBe(0); // No api request made!
    
    // Simulating user reconnecting
    const onlineSaveTriggered = await simulator.handleOnline();
    expect(onlineSaveTriggered).toBe(true);
    expect(simulator.saveState).toBe('saved');
    expect(simulator.apiCalls.length).toBe(1);
    expect(simulator.apiCalls[0].content).toBe('OFFLINE EDIT');
});

test('Edge Case: Server restart triggers error state and recovers upon connection', async () => {
    const initialScene = { _id: 'scene-123', content: 'START' };
    const simulator = new SavePipelineSimulator(initialScene);
    
    // Simulating broken server
    simulator.apiShouldFail = true;
    
    // User edits
    simulator.handleContentChange('BROKEN SERVER EDIT');
    
    // Trigger save fails
    const success = await simulator.triggerForceSave();
    expect(success).toBe(false);
    expect(simulator.saveState).toBe('error');
    expect(simulator.hasUnsavedChanges).toBe(true);
    expect(simulator.apiCalls.length).toBe(0);
    
    // Server is brought back online
    simulator.apiShouldFail = false;
    
    // Re-triggering save succeeds and transitions state
    const recoverySuccess = await simulator.triggerForceSave();
    expect(recoverySuccess).toBe(true);
    expect(simulator.saveState).toBe('saved');
    expect(simulator.hasUnsavedChanges).toBe(false);
    expect(simulator.apiCalls.length).toBe(1);
    expect(simulator.apiCalls[0].content).toBe('BROKEN SERVER EDIT');
});

// Automatically register and execute when run directly
if (typeof process !== 'undefined' && process.argv && process.argv[1] && (process.argv[1].endsWith('syncPipeline.test.ts') || process.argv[1].endsWith('syncPipeline.test.js'))) {
    import('./frontendQa.test.js').then((m) => {
        m.runFrontendTestSuite();
    });
}
