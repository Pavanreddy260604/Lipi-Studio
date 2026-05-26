import { useState, type CSSProperties, memo } from 'react';
import { Map, AlignLeft, Plus, Trash2, Edit3, ScrollText } from 'lucide-react';
import { motion } from 'framer-motion';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '../../../components/ui/Button';
import { 
    DndContext, 
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    type DragEndEvent
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
    useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import { useDialog } from '../../../hooks/useDialog';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { useScriptWriter } from '../../../contexts/ScriptWriterContext';
import type { IScene as Scene } from '../../../services/project.api';

interface StructurePanelProps {
    scenes: Scene[];
    loading?: boolean;
    onNewScene: (projectId: string) => void;
    onDeleteScene: (projectId: string, sceneId: string) => void;
    onUpdateScene?: (sceneId: string, updates: Partial<Scene>) => Promise<void>;
    onReorderScenes?: (reordered: Scene[]) => Promise<void>;
}

function SortableSceneItem({ 
    scene, 
    index,
    isActive,
    isEditing, 
    onSelect, 
    onContextMenu, 
    onDelete,
    editForm,
    setEditForm,
    handleSave,
    handleKeyDown,
    onCancel,
}: { 
    scene: Scene, 
    index: number,
    isActive: boolean, 
    isEditing: boolean, 
    onSelect: () => void,
    onContextMenu: (e: React.MouseEvent) => void,
    onDelete: () => void,
    editForm: any,
    setEditForm: any,
    handleSave: () => void,
    handleKeyDown: (e: React.KeyboardEvent) => void,
    onCancel: () => void,
}) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id: scene._id, disabled: isEditing });

    const baseStyle: CSSProperties & Record<string, string | number | undefined> = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 50 : 1,
        opacity: isDragging ? 0.5 : 1,
    };

    if (isActive) {
        baseStyle.background = 'color-mix(in oklch, var(--accent) 12%, transparent)';
    }
    if (isDragging) {
        baseStyle['--tw-ring-color'] = 'color-mix(in oklch, var(--accent) 40%, transparent)';
    }

    return (
        <div
            ref={setNodeRef}
            style={baseStyle}
            {...attributes}
            {...listeners}
            onClick={onSelect}
            onContextMenu={(e) => { e.preventDefault(); onContextMenu(e); }}
            className={`
                group flex items-start px-3 py-2.5 cursor-grab active:cursor-grabbing text-xs transition-[background-color,border-color,opacity] duration-120 active:scale-[0.98] relative rounded-xl mx-1
                ${isActive 
                    ? 'bg-accent/10 border border-accent/20' 
                    : 'hover:bg-subtle-2 text-text-secondary border border-transparent'
                }
                ${isEditing ? 'ring-1 ring-accent/30' : ''}
                ${isDragging ? 'shadow-xl ring-2 ring-accent/30 z-50 bg-surface-elevated' : ''}
            `}
        >
            <div className="flex-1 min-w-0">
                {isEditing ? (
                    <div className="flex flex-col gap-2.5 p-1.5 w-full bg-surface-elevated border border-subtle-8 rounded-xl" onClick={e => e.stopPropagation()}>
                        <div className="flex flex-col gap-0.5">
                            <span className="text-[8px] font-bold text-text-tertiary uppercase tracking-wider">Scene Title</span>
                            <input
                                autoFocus
                                className="w-full px-2 py-1 text-xs font-semibold bg-surface-page border border-subtle-8 rounded-lg text-text-primary outline-none focus:border-accent/30 focus-ring"
                                value={editForm.title}
                                onChange={e => setEditForm((p: any) => ({ ...p, title: e.target.value }))}
                                onKeyDown={handleKeyDown}
                                placeholder="Scene Title"
                            />
                        </div>
                        <div className="flex flex-col gap-0.5">
                            <span className="text-[8px] font-bold text-text-tertiary uppercase tracking-wider">Scene Syntax / Slugline</span>
                            <input
                                className="w-full px-2 py-1 text-[10px] font-mono bg-surface-page border border-subtle-8 rounded-lg text-text-primary outline-none focus:border-accent/30 focus-ring uppercase"
                                value={editForm.slugline}
                                onChange={e => setEditForm((p: any) => ({ ...p, slugline: e.target.value.toUpperCase() }))}
                                onKeyDown={handleKeyDown}
                                placeholder="e.g. INT. LOCATION - DAY"
                            />
                        </div>
                        <div className="flex gap-1.5 justify-end mt-1">
                            <button
                                type="button"
                                className="px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-text-secondary hover:text-text-primary hover:bg-subtle-2 rounded-lg transition-colors focus-ring"
                                onClick={onCancel}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                className="px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider bg-accent text-on-accent hover:bg-accent-hover rounded-lg transition-colors focus-ring"
                                onClick={handleSave}
                            >
                                Save
                            </button>
                        </div>
                    </div>
                ) : (
                    <>
                        <div className="flex items-center gap-2 min-w-0">
                            {/* Sequence number */}
                            <span className="text-[10px] font-mono text-text-tertiary select-none opacity-80 flex-shrink-0">
                                {String(index + 1).padStart(2, '0')}
                            </span>
                            
                            {/* Title / Slugline */}
                            {scene.title && scene.title !== scene.slugline ? (
                                <div className={`text-xs font-semibold truncate ${isActive ? 'text-accent' : 'text-text-primary'}`}>
                                    {scene.title}
                                </div>
                            ) : (
                                <div className={`text-[10px] font-mono tracking-wide uppercase truncate ${isActive ? 'text-accent font-semibold' : 'text-text-secondary'}`}>
                                    {scene.slugline || 'Untitled Scene'}
                                </div>
                            )}
                        </div>
                        
                        {/* Secondary line if custom title exists */}
                        {scene.title && scene.title !== scene.slugline && scene.slugline && (
                            <div className="text-[9px] text-text-tertiary truncate pl-[18px] mt-0.5 font-mono uppercase tracking-wide">
                                {scene.slugline}
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}

const StructurePanelInner = ({
    scenes = [],
    onNewScene,
    onDeleteScene,
    onUpdateScene,
    onReorderScenes
}: StructurePanelProps) => {
    const { uiState, toggleLeftPanel, activeProject, setActiveScene, activeScene, isGenerating, isCritiquing, isAiThinking, hasUnsavedChanges } = useScriptWriter();
    const navigate = useNavigate();
    const { projectId } = useParams();
    const { dialog, showConfirm, closeDialog } = useDialog();
    const { leftPanelOpen } = uiState;

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    const [editingSceneId, setEditingSceneId] = useState<string | null>(null);
    const [editForm, setEditForm] = useState({ title: '', slugline: '' });
    const [contextMenu, setContextMenu] = useState<{ sceneId: string; x: number; y: number } | null>(null);
    const [logEditScene, setLogEditScene] = useState<Scene | null>(null);
    const [logForm, setLogForm] = useState('');
    const [isSavingScene, setIsSavingScene] = useState(false);
    const [sceneSaveError, setSceneSaveError] = useState<string | null>(null);

    const handleContextMenu = (e: React.MouseEvent, scene: Scene) => {
        e.preventDefault();
        e.stopPropagation();
        setContextMenu({
            sceneId: scene._id,
            x: e.clientX,
            y: e.clientY
        });
    };

    const handleSave = async () => {
        if (!editingSceneId || !onUpdateScene) return;
        const trimmedTitle = editForm.title.trim();
        const trimmedSlugline = editForm.slugline.trim();
        if (!trimmedSlugline) {
            setSceneSaveError('Slugline cannot be empty.');
            return;
        }
        setIsSavingScene(true);
        setSceneSaveError(null);
        try {
            await onUpdateScene(editingSceneId, {
                title: trimmedTitle || undefined,
                slugline: trimmedSlugline,
            });
            setEditingSceneId(null);
        } catch (err) {
            setSceneSaveError(err instanceof Error ? err.message : 'Failed to rename scene');
        } finally {
            setIsSavingScene(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Escape') setEditingSceneId(null);
        if (e.key === 'Enter') { e.preventDefault(); void handleSave(); }
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (over && active.id !== over.id && onReorderScenes) {
            const oldIndex = scenes.findIndex(s => s._id === active.id);
            const newIndex = scenes.findIndex(s => s._id === over.id);
            const reordered = arrayMove(scenes, oldIndex, newIndex);
            void onReorderScenes(reordered);
        }
    };

    if (!leftPanelOpen) return null;

    return (
        <div className="flex flex-col h-full">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-subtle-8">
                <span className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider text-text-secondary">
                    <Map size={11} />
                    Structure
                </span>
                <div className="flex items-center gap-0.5">
                    <Button variant="ghost" size="sm" onClick={() => activeProject?._id && onNewScene(activeProject._id)} title="New Scene">
                        <Plus size={13} />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={toggleLeftPanel}>
                        <AlignLeft size={13} />
                    </Button>
                </div>
            </div>

            {sceneSaveError && (
                <p className="mx-2 mt-1 text-[10px] text-status-error bg-status-error/10 border border-status-error/20 rounded-lg px-2.5 py-1.5">
                    {sceneSaveError}
                </p>
            )}

            <div className="flex-1 min-h-0 overflow-y-auto p-2 scrollbar-hide">
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                    <SortableContext items={scenes.map(s => s._id)} strategy={verticalListSortingStrategy}>
                        <div className="flex flex-col gap-1">
                            {scenes.map((scene, idx) => (
                                <SortableSceneItem
                                    key={scene._id}
                                    scene={scene}
                                    index={idx}
                                    isActive={activeScene?._id === scene._id}
                                    isEditing={editingSceneId === scene._id}
                                    onSelect={() => {
                                        if (activeScene?._id === scene._id) return;
                                        if (isGenerating || isCritiquing || isAiThinking || hasUnsavedChanges) {
                                            const confirmed = window.confirm('You have an active process or unsaved changes. Leaving this scene may result in data loss. Continue?');
                                            if (!confirmed) return;
                                        }
                                        if (!editingSceneId && projectId) {
                                            navigate(`/script-writer/${projectId}/${scene._id}`);
                                        }
                                    }}
                                    onContextMenu={(e) => handleContextMenu(e, scene)}
                                    onDelete={() => {
                                        if (activeProject?._id) {
                                            showConfirm('Delete Scene', 'This cannot be undone.', 
                                                () => onDeleteScene(activeProject._id, scene._id));
                                        }
                                    }}
                                    editForm={editForm}
                                    setEditForm={setEditForm}
                                    handleSave={handleSave}
                                    handleKeyDown={handleKeyDown}
                                    onCancel={() => setEditingSceneId(null)}
                                />
                            ))}
                        </div>
                    </SortableContext>
                </DndContext>
            </div>

            <ConfirmDialog
                isOpen={dialog.isOpen && dialog.type === 'confirm'}
                onClose={closeDialog}
                onConfirm={dialog.onConfirm || (() => { })}
                title={dialog.title}
                description={dialog.description}
                variant="danger"
            />

            {/* Custom Dropdown Context Menu */}
            {contextMenu && (
                <>
                    <div 
                        className="fixed inset-0 z-[60]" 
                        onClick={() => setContextMenu(null)}
                        onContextMenu={(e) => { e.preventDefault(); setContextMenu(null); }}
                    />
                    <div 
                        style={{ left: contextMenu.x, top: contextMenu.y }}
                        className="fixed z-[70] bg-surface-elevated border border-subtle-8 rounded-lg shadow-2xl p-0.5 min-w-[125px] animate-in fade-in zoom-in-95 duration-100 flex flex-col gap-0.5"
                    >
                        <button
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => {
                                const scene = scenes.find(s => s._id === contextMenu.sceneId);
                                if (scene) {
                                    setSceneSaveError(null);
                                    setEditingSceneId(scene._id);
                                    setEditForm({ title: scene.title || '', slugline: scene.slugline || '' });
                                }
                                setContextMenu(null);
                            }}
                            className="w-full flex items-center gap-1.5 px-2 py-1 text-left text-[11px] text-text-secondary hover:text-text-primary hover:bg-subtle-2 rounded-md transition-colors focus-ring"
                        >
                            <Edit3 size={10} className="opacity-70 text-accent" />
                            <span>Rename</span>
                        </button>
                        <button
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => {
                                const scene = scenes.find(s => s._id === contextMenu.sceneId);
                                if (scene) {
                                    setSceneSaveError(null);
                                    setLogEditScene(scene);
                                    setLogForm(scene.summary || '');
                                }
                                setContextMenu(null);
                            }}
                            className="w-full flex items-center gap-1.5 px-2 py-1 text-left text-[11px] text-text-secondary hover:text-text-primary hover:bg-subtle-2 rounded-md transition-colors focus-ring"
                        >
                            <ScrollText size={10} className="opacity-70 text-accent" />
                            <span>Edit Scene Log</span>
                        </button>
                        <div className="h-px bg-subtle-8 my-0.5" />
                        <button
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => {
                                const scene = scenes.find(s => s._id === contextMenu.sceneId);
                                if (scene && activeProject?._id) {
                                    showConfirm('Delete Scene', 'This cannot be undone.', 
                                        () => onDeleteScene(activeProject._id, scene._id));
                                }
                                setContextMenu(null);
                            }}
                            className="w-full flex items-center gap-1.5 px-2 py-1 text-left text-[11px] text-status-error hover:bg-status-error/10 rounded-md transition-colors focus-ring"
                        >
                            <Trash2 size={10} className="opacity-70 text-status-error" />
                            <span>Delete</span>
                        </button>
                    </div>
                </>
            )}

            {/* Custom Scene Log Micro-Modal */}
            {logEditScene && (
                <>
                    <div 
                        className="fixed inset-0 z-[80] bg-black/75 animate-in fade-in duration-150"
                        onClick={() => setLogEditScene(null)}
                    />
                    <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[90] bg-surface-elevated border border-subtle-8 rounded-2xl p-5 shadow-2xl max-w-sm w-full animate-in zoom-in-95 duration-150 flex flex-col gap-4">
                        <div className="flex items-center justify-between border-b border-subtle-8 pb-3">
                            <div className="flex items-center gap-2 text-xs font-semibold text-text-primary">
                                <ScrollText size={13} className="text-accent" />
                                <span>Scene Log Editor</span>
                            </div>
                            <span className="text-[9px] font-mono text-text-tertiary uppercase truncate max-w-[150px]">
                                {logEditScene.slugline || 'Untitled Scene'}
                            </span>
                        </div>
                        
                        {sceneSaveError && (
                            <p className="text-[10px] text-status-error bg-status-error/10 border border-status-error/20 rounded-lg px-2.5 py-1.5">
                                {sceneSaveError}
                            </p>
                        )}

                        <div className="flex flex-col gap-1.5">
                            <label className="text-[10px] font-medium text-text-tertiary uppercase tracking-wide">Scene Summary / Logline</label>
                            <textarea
                                value={logForm}
                                onChange={e => setLogForm(e.target.value)}
                                placeholder="Describe the dramatic action, conflicts, and outcomes of this scene..."
                                rows={4}
                                className="w-full px-3 py-2 text-xs bg-surface-page border border-subtle-8 rounded-xl text-text-primary placeholder:text-text-tertiary outline-none focus:border-accent/30 resize-none leading-relaxed"
                            />
                        </div>
                        
                        <div className="flex justify-end gap-2 pt-2 border-t border-subtle-8">
                            <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => setLogEditScene(null)}
                            >
                                Cancel
                            </Button>
                            <Button 
                                variant="primary" 
                                size="sm"
                                disabled={isSavingScene || !logForm.trim()}
                                onClick={async () => {
                                    if (!onUpdateScene) return;
                                    const trimmedSummary = logForm.trim();
                                    if (!trimmedSummary) {
                                        setSceneSaveError('Scene summary cannot be empty.');
                                        return;
                                    }
                                    setIsSavingScene(true);
                                    setSceneSaveError(null);
                                    try {
                                        await onUpdateScene(logEditScene._id, { summary: trimmedSummary });
                                        setLogEditScene(null);
                                    } catch (err) {
                                        setSceneSaveError(err instanceof Error ? err.message : 'Failed to save scene log');
                                    } finally {
                                        setIsSavingScene(false);
                                    }
                                }}
                            >
                                {isSavingScene ? 'Saving...' : 'Save Changes'}
                            </Button>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export const StructurePanel = memo(StructurePanelInner);
