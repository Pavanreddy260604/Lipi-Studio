import type { Bible, IScene as Scene } from '../../services/project.api';
import type { SaveState } from './types';

interface StudioStatusbarProps {
    projectCount: number;
    activeProject: Bible | null;
    activeScene: Scene | null;
    error: string | null;
    isOffline?: boolean;
    onRetrySave?: () => void;
    saveState?: SaveState;
}

export function StudioStatusbar({
    projectCount,
    activeProject,
    activeScene,
    error,
    isOffline,
    onRetrySave,
    saveState
}: StudioStatusbarProps) {
    return (
        <div className="flex items-center justify-between bg-surface-elevated border border-subtle-8 rounded-2xl px-4 mx-3 mb-3 text-[11px] font-medium select-none h-8">
            <div className="hidden sm:flex items-center gap-4">
                <span className="text-text-tertiary">
                    <span className="tabular-nums text-text-secondary font-bold">{projectCount.toString().padStart(2, '0')}</span>
                    <span className="ml-1">projects</span>
                </span>
                
                {activeProject && (
                    <span className="flex items-center gap-1.5">
                        <span className="w-1 h-1 rounded-full bg-accent/60" />
                        <span className="text-text-secondary truncate max-w-[150px]">{activeProject.title}</span>
                    </span>
                )}
                
                {activeScene && (
                    <span className="flex items-center gap-1.5">
                        <span className="w-1 h-1 rounded-full bg-text-tertiary/50" />
                        <span className="text-text-tertiary truncate max-w-[150px]">{activeScene.slugline || activeScene.title}</span>
                    </span>
                )}
            </div>

            <div className="flex items-center">
                {isOffline ? (
                    <span className="flex items-center gap-1.5 text-[10px] font-bold text-text-tertiary/70 uppercase tracking-wider bg-subtle-2 px-2 py-0.5 rounded-lg border border-subtle-8">
                        <span className="w-1.5 h-1.5 rounded-full bg-text-tertiary/40 animate-pulse" />
                        Offline (Paused)
                    </span>
                ) : saveState === 'saving' ? (
                    <span className="flex items-center gap-1.5 text-xs text-status-warning/75">
                        <span className="w-1.5 h-1.5 rounded-full bg-status-warning animate-pulse" />
                        Saving changes...
                    </span>
                ) : saveState === 'unsaved' ? (
                    <span className="flex items-center gap-1.5 text-xs text-status-warning/60">
                        <span className="w-1.5 h-1.5 rounded-full bg-status-warning" />
                        Unsaved changes
                    </span>
                ) : error || saveState === 'error' ? (
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-status-error uppercase tracking-wider truncate max-w-[200px]">
                            Error: {error || 'Failed to save'}
                        </span>
                        {onRetrySave && (
                            <button
                                onClick={onRetrySave}
                                className="px-2 py-0.5 rounded bg-subtle-3 hover:bg-subtle-5 text-status-error text-[9px] font-bold uppercase tracking-wider border border-subtle-10 transition-all active:scale-95 focus-ring"
                            >
                                Retry
                            </button>
                        )}
                    </div>
                ) : (
                    <span className="flex items-center gap-1.5 text-xs text-status-success/60">
                        <span className="w-1.5 h-1.5 rounded-full bg-status-success" />
                        All changes saved
                    </span>
                )}
            </div>
        </div>
    );
}

