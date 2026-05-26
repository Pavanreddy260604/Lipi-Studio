import { Button } from '../../components/ui/Button';
import { Menu, ChevronRight, Sparkles } from 'lucide-react';
import type { Bible, IScene as Scene } from '../../services/project.api';
import type { StudioMode } from './types';

interface StudioTopbarProps {
    activeProject: Bible | null;
    activeScene: Scene | null;
    onGenerate: () => void;
    onCritique: () => void;
    isGenerating: boolean;
    isCritiquing: boolean;
    onBackToDashboard: () => void;
    activeMode: StudioMode;
    onModeChange: (mode: StudioMode) => void;
    isExplorerOpen: boolean;
}

export function StudioTopbar({
    activeProject,
    activeScene,
    onGenerate,
    onCritique,
    isGenerating,
    isCritiquing,
    onBackToDashboard,
    activeMode,
    isExplorerOpen
}: StudioTopbarProps) {
    return (
        <div className="bg-surface-elevated border border-subtle-8 rounded-2xl flex items-center justify-between px-5 py-2 mx-3 mt-3">
            <div className="flex items-center gap-3 min-w-0">
                {!isExplorerOpen && (
                    <Button
                        variant="ghost"
                        className="p-1.5"
                        onClick={onBackToDashboard}
                        leftIcon={<Menu size={16} />}
                    />
                )}
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider min-w-0">
                    <span className="text-text-tertiary">Studio</span>
                    <ChevronRight size={10} className="text-text-tertiary" />
                    <span className="truncate text-text-secondary">{activeProject?.title || 'Project'}</span>
                    {activeScene?.slugline && (
                        <>
                            <ChevronRight size={10} className="text-text-tertiary" />
                            <span className="truncate text-accent">{activeScene.slugline}</span>
                        </>
                    )}
                </div>
            </div>

            <div className="flex items-center gap-2">
                {activeScene && (
                    <div className="flex items-center gap-2">
                        <Button
                            variant="secondary"
                            size="sm"
                            className="text-xs font-bold uppercase tracking-wider h-8 px-4"
                            onClick={onCritique}
                            disabled={isCritiquing || isGenerating}
                        >
                            {isCritiquing ? 'Analyzing...' : 'Critique'}
                        </Button>
                        <Button
                            variant="secondary"
                            size="sm"
                            className="text-xs font-bold uppercase tracking-wider h-8 px-4"
                            onClick={onGenerate}
                            disabled={isGenerating || isCritiquing}
                        >
                            <Sparkles size={12} className="mr-1.5" />
                            {isGenerating ? 'Generating...' : 'Generate'}
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );
}
