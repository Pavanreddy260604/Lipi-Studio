import { useMemo } from 'react';
import { ChevronDown, ChevronRight, FileText, Loader2, PanelRight, Plus } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button, SearchInput, Input, Textarea } from '../../components/ui';
import type { Bible, IScene as Scene } from '../../services/project.api';
import type { ProjectForm } from './types';

interface StudioExplorerProps {
    projects: Bible[];
    loadingProjects: boolean;
    expandedProjects: Record<string, boolean>;
    loadingScenes: Record<string, boolean>;
    projectScenes: Record<string, Scene[]>;
    activeProjectId: string | null;
    activeSceneId: string | null;
    searchTerm: string;
    onSearchChange: (value: string) => void;
    onProjectToggle: (projectId: string) => void;
    onSceneSelect: (scene: Scene, projectId: string) => void;
    onNewScene: (projectId: string | null) => void;
    isCreatingProject: boolean;
    creatingProject: boolean;
    newProjectForm: ProjectForm;
    onNewProjectClick: () => void;
    onNewProjectCancel: () => void;
    onNewProjectFieldChange: <K extends keyof ProjectForm>(field: K, value: ProjectForm[K]) => void;
    onNewProjectSubmit: () => void;
    getScenes: (projectId: string) => Scene[];
    onCollapse: () => void;
}

export function StudioExplorer({
    projects,
    loadingProjects,
    expandedProjects,
    loadingScenes,
    projectScenes,
    activeProjectId,
    activeSceneId,
    searchTerm,
    onSearchChange,
    onProjectToggle,
    onSceneSelect,
    onNewScene,
    isCreatingProject,
    creatingProject,
    newProjectForm,
    onNewProjectClick,
    onNewProjectCancel,
    onNewProjectFieldChange,
    onNewProjectSubmit,
    getScenes,
    onCollapse
}: StudioExplorerProps) {
    const scenesByProject = useMemo(() => {
        const map: Record<string, Scene[]> = {};
        for (const project of projects) {
            map[project._id] = getScenes(project._id) || [];
        }
        return map;
    }, [projects, getScenes]);

    return (
        <div className="flex flex-col h-full">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-subtle)]">
                <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                    <PanelRight size={14} /> Explorer
                </div>
                <Button
                    variant="ghost"
                    className="p-1"
                    onClick={onCollapse}
                    leftIcon={<PanelRight size={14} className="rotate-180" />}
                />
            </div>
            <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-4">
                <div className="flex flex-col gap-4">
                    {!isCreatingProject ? (
                        <Button
                            variant="primary"
                            className="w-full text-[11px] font-bold uppercase tracking-wider"
                            onClick={onNewProjectClick}
                            leftIcon={<Plus size={14} />}
                        >
                            New Script
                        </Button>
                    ) : (
                        <div className="bg-[var(--surface-elevated)] border border-subtle-8 rounded-2xl shadow-[var(--shadow-md)] p-3 flex flex-col gap-4 w-full max-w-md mx-auto">
                            <Input
                                label="Title"
                                value={newProjectForm.title}
                                onChange={(event) => onNewProjectFieldChange('title', event.target.value)}
                                size="sm"
                                placeholder="Project Title"
                            />
                            <Textarea
                                label="Logline (Required)"
                                value={newProjectForm.logline}
                                onChange={(event) => onNewProjectFieldChange('logline', event.target.value)}
                                size="sm"
                                rows={2}
                                placeholder="Core narrative arc..."
                            />
                            <Input
                                label="Genre"
                                value={newProjectForm.genre}
                                onChange={(event) => onNewProjectFieldChange('genre', event.target.value)}
                                size="sm"
                                placeholder="E.g., Cyberpunk"
                            />
                            <Input
                                label="Tone"
                                value={newProjectForm.tone}
                                onChange={(event) => onNewProjectFieldChange('tone', event.target.value)}
                                size="sm"
                                placeholder="E.g., Gritty, Mechanical"
                            />
                            <div className="flex gap-2 pt-1">
                                <Button variant="secondary" className="flex-1 text-[10px] font-bold uppercase" onClick={onNewProjectCancel}>
                                    Cancel
                                </Button>
                                <Button variant="primary" className="flex-1 text-[10px] font-bold uppercase" onClick={onNewProjectSubmit} disabled={creatingProject || !newProjectForm.title.trim() || !newProjectForm.logline.trim()}>
                                    {creatingProject ? 'Creating...' : 'Create'}
                                </Button>
                            </div>
                        </div>
                    )}
                    <Button
                        variant="secondary"
                        className="w-full text-[11px] font-bold uppercase tracking-wider"
                        onClick={() => onNewScene(activeProjectId)}
                        disabled={!activeProjectId}
                        leftIcon={<FileText size={14} />}
                    >
                        Add Scene
                    </Button>
                </div>

                <SearchInput
                    placeholder="Search scenes"
                    value={searchTerm}
                    onChange={(event) => onSearchChange(event.target.value)}
                    className="h-8 min-h-0 rounded-lg text-xs"
                />

                {loadingProjects ? (
                    <div className="flex flex-col items-center justify-center py-10 gap-2 text-[var(--text-tertiary)]">
                        <Loader2 size={18} className="animate-spin" style={{ color: 'var(--accent)' }} />
                        <p className="text-[10px] font-bold uppercase tracking-widest">Loading projects...</p>
                    </div>
                ) : projects.length === 0 ? (
                    <div className="text-center py-10 text-[10px] text-[var(--text-tertiary)] font-medium">No projects yet. Create your first script.</div>
                ) : (
                    <div className="flex flex-col gap-4">
                        {projects.map((project) => {
                            const isExpanded = !!expandedProjects[project._id];
                            const scenes = scenesByProject[project._id] || [];
                            return (
                                <div key={project._id}>
                                    <button
                                        className={`w-full flex items-center gap-2 px-3 py-2 rounded-[var(--radius-md)] text-xs font-bold uppercase tracking-wider transition-all focus-ring ${
                                            activeProjectId === project._id
                                                ? 'bg-[var(--accent-soft)]' : 'text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-heading)]'
                                        }`}
                                        style={activeProjectId === project._id ? { color: 'var(--accent)' } : {}}
                                        onClick={() => onProjectToggle(project._id)}
                                    >
                                        {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                                        <span className="truncate">{project.title}</span>
                                    </button>

                                    <AnimatePresence>
                                        {isExpanded && (
                                            <motion.div
                                                key={`scenes-${project._id}`}
                                                initial={{ height: 0, opacity: 0 }}
                                                animate={{ height: 'auto', opacity: 1 }}
                                                exit={{ height: 0, opacity: 0 }}
                                                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                                                className="overflow-hidden"
                                            >
                                                <div className="pl-4 mt-1 flex flex-col gap-4">
                                                    {loadingScenes[project._id] ? (
                                                        <div className="flex items-center gap-2 px-3 py-2 text-[10px] text-[var(--text-tertiary)]">
                                                            <Loader2 size={10} className="animate-spin" />
                                                            Loading scenes...
                                                        </div>
                                                    ) : scenes.length === 0 ? (
                                                        <div className="px-3 py-2 text-[10px] text-[var(--text-tertiary)] italic">No scenes yet.</div>
                                                    ) : (
                                                        scenes.map((scene) => (
                                                            <button
                                                                key={scene._id}
                                                                className={`w-full flex items-start gap-2 px-3 py-2 rounded-[var(--radius-md)] transition-all focus-ring ${
                                                                    activeSceneId === scene._id
                                                                        ? 'text-[var(--accent)] border-subtle-20'
                                                                        : 'text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-heading)] border-subtle-5 border-transparent'
                                                                }`}
                                                                style={activeSceneId === scene._id ? { borderColor: 'var(--accent)' } : {}}
                                                                onClick={() => onSceneSelect(scene, project._id)}
                                                            >
                                                                <FileText size={12} className="mt-0.5 flex-shrink-0" />
                                                                <div className="min-w-0 flex-1 text-left">
                                                                    <div className="text-[11px] font-bold truncate" style={activeSceneId === scene._id ? { color: 'var(--accent)' } : {}}>
                                                                        {scene.title || scene.slugline || 'Untitled Scene'}
                                                                    </div>
                                                                    <div className="text-[9px] text-[var(--text-tertiary)] truncate mt-0.5">{scene.summary || 'Add a summary for this scene.'}</div>
                                                                </div>
                                                                <span className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${
                                                                    scene.status === 'final' ? 'bg-[var(--status-success)]' :
                                                                    scene.status === 'drafted' ? 'bg-[var(--status-warning)]' :
                                                                    scene.status === 'reviewed' ? 'bg-[var(--accent)]' :
                                                                    'bg-[var(--text-tertiary)]'
                                                                }`} />
                                                            </button>
                                                        ))
                                                    )}
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            );
                        })}
                    </div>
                )}

                {projectScenes[activeProjectId || '']?.length === 0 && activeProjectId && !loadingScenes[activeProjectId] && (
                    <div className="text-center py-6 text-[10px] text-[var(--text-tertiary)] font-medium">Add your first scene to start writing.</div>
                )}
            </div>
        </div>
    );
}
