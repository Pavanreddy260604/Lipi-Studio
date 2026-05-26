import { useState } from 'react';
import { Plus, FolderOpen, Clock, FileText, Loader2, Trash2, Calendar, Layout, Sparkles, Database, X, ArrowLeft, Moon, Sun, Settings as SettingsIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button, Page, Card, Stack, Grid, Badge, Input, Select } from '../../components/ui';
import { AdminPanel } from './components/AdminPanel';
import { useDialog } from '../../hooks/useDialog';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import type { Bible } from '../../services/project.api';
import type { ProjectForm } from './types';
import { shouldOfferTransliteration } from './utils';
import { cn } from '../../lib/utils';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { useThemeStore } from '../../stores/themeStore';

type DashboardFilter = 'all' | 'recent' | 'admin';

interface ProjectDashboardProps {
    projects: Bible[];
    loadingProjects: boolean;
    onProjectSelect: (projectId: string) => void;
    isCreatingProject: boolean;
    creatingProject: boolean;
    newProjectForm: ProjectForm;
    onNewProjectClick: () => void;
    onNewProjectCancel: () => void;
    onNewProjectFieldChange: <K extends keyof ProjectForm>(field: K, value: ProjectForm[K]) => void;
    onNewProjectSubmit: () => void;
    onProjectDelete?: (projectId: string) => void;
}

export function ProjectDashboard({
    projects,
    loadingProjects,
    onProjectSelect,
    isCreatingProject,
    creatingProject,
    newProjectForm,
    onNewProjectClick,
    onNewProjectCancel,
    onNewProjectFieldChange,
    onNewProjectSubmit,
    onProjectDelete
}: ProjectDashboardProps) {
    const navigate = useNavigate();
    const { dialog, showConfirm, closeDialog } = useDialog();
    const [filter, setFilter] = useState<DashboardFilter>('all');
    const { user } = useAuthStore();
    const { effectiveTheme, toggleTheme } = useThemeStore();
    const filterTabs: Array<{ id: DashboardFilter; label: string; icon: typeof Layout }> = [
        { id: 'all', label: 'All Projects', icon: Layout },
        { id: 'recent', label: 'Recent', icon: Clock },
        { id: 'admin', label: 'Master Feed', icon: Database }
    ];

    const projectsList = Array.isArray(projects) ? projects.filter(Boolean) : [];
    
    const sortedProjects = [...projectsList].sort((a, b) => {
        try {
            return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
        } catch (e) {
            return 0;
        }
    });

    const displayedProjects = filter === 'recent' ? sortedProjects.slice(0, 6) : sortedProjects;

    return (
        <Page
            isLoading={loadingProjects && projects.length === 0}
            kicker="Lipi.Studio"
            title={<>Project <span className="text-accent">Root</span></>}
            subtitle="Manage active manuscripts and narrative architectures. Select a sequence to begin inference."
            action={
                <div className="flex items-center gap-3">
                    <button
                        onClick={toggleTheme}
                        className="flex items-center justify-center rounded-xl border border-subtle-8 hover:border-accent/20 transition-all focus-ring"
                        style={{
                            width: '40px',
                            height: '40px',
                            backgroundColor: 'var(--surface-elevated)',
                            color: 'var(--text-secondary)',
                        }}
                        title={`Switch to ${effectiveTheme === 'dark' ? 'light' : 'dark'} mode`}
                        aria-label={`Switch to ${effectiveTheme === 'dark' ? 'light' : 'dark'} mode`}
                    >
                        {effectiveTheme === 'dark' ? <Moon size={16} /> : <Sun size={16} />}
                    </button>

                    <button
                        onClick={() => navigate('/settings')}
                        className="shrink-0 flex items-center justify-center rounded-xl transition-all focus-ring overflow-hidden"
                        style={{
                            width: '40px',
                            height: '40px',
                            backgroundColor: 'var(--accent)',
                            color: 'var(--text-on-accent, #fff)',
                        }}
                        title={user?.name || 'Profile'}
                        aria-label="Profile"
                    >
                        <span className="text-xs font-black">{user?.name?.charAt(0).toUpperCase() || 'U'}</span>
                    </button>
                    <Button
                        variant="secondary"
                        onClick={onNewProjectClick}
                        leftIcon={<Plus size={16} />}
                        className="text-[10px] font-black uppercase tracking-widest"
                    >
                        Initialize Script
                    </Button>
                </div>
            }
        >
            <Stack gap={12}>
                {/* Filter Tabs */}
                <Card className="p-4 bg-subtle-2 border-subtle-8">
                    <div className="flex flex-wrap items-center justify-between gap-6">
                        <div className="flex flex-nowrap items-center gap-1.5 p-1 bg-subtle-3 border border-subtle-8 rounded-2xl overflow-x-auto scrollbar-hide">
                            {filterTabs.map((tab) => (
                                <button
                                    key={tab.id}
                                    onClick={() => setFilter(tab.id)}
                                    className={cn(
                                        "flex items-center gap-2 rounded-xl px-5 py-2.5 text-[9px] font-black uppercase tracking-widest transition-all whitespace-nowrap focus-ring",
                                        filter === tab.id
                                            ? 'text-accent bg-subtle-4 border border-accent/20 shadow-sm'
                                            : 'text-muted hover:text-heading hover:bg-subtle-2'
                                    )}
                                >
                                    <tab.icon size={14} />
                                    {tab.label}
                                </button>
                            ))}
                        </div>

                        <div className="flex items-center gap-3 px-4 py-2 text-[10px] font-black text-muted uppercase tracking-widest bg-subtle-3 border border-subtle-8 rounded-xl">
                            <div className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
                            {projects.length} ACTIVE_RECORDS
                        </div>
                    </div>
                </Card>

                {/* Dynamic Content */}
                <AnimatePresence mode="wait">
                    {filter === 'admin' ? (
                        <motion.div key="admin" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
                            <AdminPanel />
                        </motion.div>
                    ) : loadingProjects ? (
                        <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center py-24 gap-4">
                            <Loader2 size={40} className="animate-spin text-accent" />
                            <p className="text-[10px] font-black text-muted uppercase tracking-[0.3em]">Synchronizing Manifest...</p>
                        </motion.div>
                    ) : displayedProjects.length === 0 ? (
                        <motion.div key="empty" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center justify-center py-32 text-center gap-8 bg-subtle-2 border-dashed rounded-[3rem]">
                            <div className="w-20 h-20 bg-accent/5 border border-accent/10 rounded-[2.5rem] flex items-center justify-center text-accent/40">
                                <FolderOpen size={32} />
                            </div>
                            <Stack gap={2} align="center">
                                <h3 className="text-xl font-black text-heading uppercase tracking-tight">Archives Empty</h3>
                                <p className="text-sm text-secondary font-medium max-w-sm mx-auto leading-relaxed">No project records found in the active matrix. Initialize a new sequence to begin production.</p>
                            </Stack>
                            <Button
                                variant="primary"
                                onClick={onNewProjectClick}
                                className="px-10 h-12 text-[10px] font-black uppercase tracking-widest"
                                leftIcon={<Plus size={16} />}
                            >
                                Initialize Script
                            </Button>
                        </motion.div>
                    ) : (
                        <Grid cols={1} gap={8} className="md:grid-cols-2 lg:grid-cols-3">
                            {displayedProjects.map((project, index) => (
                                <motion.div
                                    key={project._id}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: index * 0.05, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                                    className="group"
                                >
                                    <Card
                                        onClick={() => onProjectSelect(project._id)}
                                        className="p-8 bg-surface-elevated border-subtle-8 hover:border-accent/40 transition-all shadow-md group-hover:shadow-xl cursor-pointer relative overflow-hidden h-full flex flex-col"
                                    >
                                        <div className="absolute inset-0 bg-gradient-to-br from-accent/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                        
                                        <Stack gap={8} className="relative z-10 flex-1">
                                            <div className="flex items-start justify-between">
                                                <Stack direction="horizontal" gap={4} align="center">
                                                    <div className="p-3.5 bg-subtle-2 border border-subtle-8 rounded-2xl group-hover:border-accent/20 transition-colors">
                                                        <FileText size={20} className="text-muted group-hover:text-accent transition-colors" />
                                                    </div>
                                                    <Badge variant="secondary" className="text-[9px] font-black uppercase tracking-widest px-3">
                                                        {project.genre.toUpperCase()}
                                                    </Badge>
                                                </Stack>

                                                {onProjectDelete && (
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            showConfirm(
                                                                'Purge Project',
                                                                `Execute permanent deletion of "${project.title}"? This operation cannot be undone.`,
                                                                () => onProjectDelete(project._id)
                                                            );
                                                        }}
                                                        className="p-2 opacity-0 group-hover:opacity-100 hover:bg-status-error/10 text-muted hover:text-status-error rounded-xl transition-all"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                )}
                                            </div>

                                            <Stack gap={4} className="flex-1">
                                                <h3 className="text-xl font-black text-heading tracking-tight leading-tight group-hover:text-accent transition-colors">
                                                    {project.title}
                                                </h3>
                                                {project.logline ? (
                                                    <p className="text-sm text-secondary font-medium leading-relaxed italic line-clamp-3">
                                                        &ldquo;{project.logline}&rdquo;
                                                    </p>
                                                ) : (
                                                    <p className="text-xs text-muted italic">No logline provided yet...</p>
                                                )}
                                            </Stack>

                                            <div className="flex items-center justify-between border-t border-subtle-8 pt-6 mt-4">
                                                <div className="flex items-center gap-2 text-[9px] font-black text-muted uppercase tracking-widest">
                                                    <Calendar size={12} className="text-accent" />
                                                    {new Date(project.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                                                </div>
                                                <div className="text-[10px] font-black text-accent uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-all flex items-center gap-1.5 translate-x-2 group-hover:translate-x-0">
                                                    OPEN STUDIO <Plus size={14} />
                                                </div>
                                            </div>
                                        </Stack>
                                    </Card>
                                </motion.div>
                            ))}
                        </Grid>
                    )}
                </AnimatePresence>
            </Stack>

            {/* Create Project Modal Overlay */}
            <AnimatePresence>
                {isCreatingProject && (
                    <motion.div
                        key="create-modal"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center p-4"
                        onClick={onNewProjectCancel}
                    >
                        <div className="absolute inset-0 bg-surface-page/90" />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="bg-surface-elevated border border-subtle-8 rounded-[2.5rem] shadow-2xl w-full max-w-xl overflow-hidden relative"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="p-8 sm:p-12">
                                <Stack gap={10}>
                                    <Stack gap={2}>
                                        <div className="flex items-center justify-between">
                                            <h2 className="text-2xl font-black text-heading uppercase tracking-tight italic">
                                                Begin New Story
                                            </h2>
                                            <button onClick={onNewProjectCancel} className="p-2 hover:bg-subtle-3 rounded-xl transition-colors text-muted">
                                                <X size={20} />
                                            </button>
                                        </div>
                                        <p className="text-[10px] font-black text-muted uppercase tracking-widest">Define the core parameters of your next sequence.</p>
                                    </Stack>

                                    <Stack gap={6}>
                                        <Stack gap={2}>
                                            <label className="text-[9px] font-black text-muted uppercase tracking-widest px-1">Project Identity</label>
                                            <Input
                                                className="bg-subtle-2 h-14"
                                                value={newProjectForm.title}
                                                onChange={(e) => onNewProjectFieldChange('title', e.target.value)}
                                                placeholder="e.g. The Last Horizon"
                                                autoFocus
                                            />
                                        </Stack>

                                        <Grid cols={1} gap={4} className="sm:grid-cols-2">
                                            <Stack gap={2}>
                                                <label className="text-[9px] font-black text-muted uppercase tracking-widest px-1">Primary Genre</label>
                                                <Select
                                                    value={newProjectForm.genre}
                                                    onChange={(v) => onNewProjectFieldChange('genre', v)}
                                                    options={[
                                                        { value: 'drama', label: 'Drama' },
                                                        { value: 'comedy', label: 'Comedy' },
                                                        { value: 'action', label: 'Action' },
                                                        { value: 'thriller', label: 'Thriller' },
                                                        { value: 'horror', label: 'Horror' },
                                                        { value: 'sci-fi', label: 'Sci-Fi' },
                                                        { value: 'romance', label: 'Romance' },
                                                        { value: 'documentary', label: 'Documentary' },
                                                    ]}
                                                    className="bg-subtle-2 h-14"
                                                />
                                            </Stack>
                                            <Stack gap={2}>
                                                <label className="text-[9px] font-black text-muted uppercase tracking-widest px-1">Target Language</label>
                                                <Select
                                                    value={newProjectForm.language}
                                                    onChange={(v) => onNewProjectFieldChange('language', v)}
                                                    options={[
                                                        { value: 'English', label: 'English' },
                                                        { value: 'Telugu', label: 'Telugu' },
                                                        { value: 'Hindi', label: 'Hindi' },
                                                        { value: 'Tamil', label: 'Tamil' },
                                                        { value: 'Kannada', label: 'Kannada' },
                                                        { value: 'Malayalam', label: 'Malayalam' },
                                                        { value: 'Spanish', label: 'Spanish' },
                                                        { value: 'French', label: 'French' },
                                                        { value: 'German', label: 'German' },
                                                    ]}
                                                    className="bg-subtle-2 h-14 font-black text-accent"
                                                />
                                            </Stack>
                                        </Grid>

                                        {shouldOfferTransliteration(newProjectForm.language || 'English') && (
                                            <Card className="p-4 bg-accent/5 border-accent/20 flex items-center justify-between">
                                                <Stack gap={1}>
                                                    <div className="text-[9px] font-black uppercase tracking-widest text-accent">Phonetic Transliteration</div>
                                                    <div className="text-[8px] text-muted font-bold uppercase">Use English alphabet for native dialogue</div>
                                                </Stack>
                                                <button
                                                    onClick={() => onNewProjectFieldChange('transliteration', !newProjectForm.transliteration)}
                                                    className={cn(
                                                        "relative inline-flex h-5 w-10 items-center rounded-full transition-all",
                                                        newProjectForm.transliteration ? 'bg-accent' : 'bg-subtle-8'
                                                    )}
                                                >
                                                    <span className={cn(
                                                        "inline-block h-3.5 w-3.5 transform rounded-full bg-surface-page transition-transform",
                                                        newProjectForm.transliteration ? 'translate-x-6' : 'translate-x-0.5'
                                                    )} />
                                                </button>
                                            </Card>
                                        )}

                                        <Stack gap={2}>
                                            <label className="text-[9px] font-black text-muted uppercase tracking-widest px-1">Target Node Count</label>
                                            <Input
                                                type="number"
                                                className="bg-subtle-2 h-14"
                                                value={newProjectForm.targetSceneCount || ''}
                                                onChange={(e) => onNewProjectFieldChange('targetSceneCount', parseInt(e.target.value) || 0)}
                                                placeholder="e.g. 40"
                                            />
                                        </Stack>

                                        <Stack gap={2}>
                                            <Stack gap={2}>
                                                <label className="text-[9px] font-black text-muted uppercase tracking-widest px-1">Sequence Hook / Logline (Required)</label>
                                                <textarea
                                                    className="w-full px-5 py-4 bg-subtle-2 border border-subtle-8 rounded-2xl text-heading font-serif italic text-sm placeholder:text-muted/20 focus:outline-none focus:border-accent transition-colors min-h-[120px]"
                                                    value={newProjectForm.logline}
                                                    onChange={(e) => onNewProjectFieldChange('logline', e.target.value)}
                                                    placeholder="In a world where..."
                                                />
                                            </Stack>

                                            <Stack gap={2}>
                                                <label className="text-[9px] font-black text-muted uppercase tracking-widest px-1">Initial Story Resource / Source Material (Required)</label>
                                                
                                                {newProjectForm.selectedResourceFile ? (
                                                    <div className="flex items-center justify-between px-5 py-4 bg-bg-panel border border-border-strong rounded-2xl">
                                                        <div className="flex items-center gap-3">
                                                            <div className="p-2 bg-subtle-5 rounded-lg text-accent">
                                                                <FileText size={18} />
                                                            </div>
                                                            <div>
                                                                <div className="text-xs font-semibold text-heading">{newProjectForm.selectedResourceFile.name}</div>
                                                                <div className="text-[10px] text-text-tertiary">
                                                                    {(newProjectForm.selectedResourceFile.size / 1024).toFixed(1)} KB • Reference File Uploaded
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <button 
                                                            type="button"
                                                            onClick={() => onNewProjectFieldChange('selectedResourceFile', null)}
                                                            className="text-xs font-bold text-text-muted hover:text-accent transition-colors px-3 py-1 bg-subtle-3 hover:bg-subtle-5 rounded-xl animate-fade-in"
                                                        >
                                                            Remove
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <Stack gap={2}>
                                                        <div className="flex gap-2">
                                                            <Input
                                                                className="bg-subtle-2 h-14 flex-1"
                                                                value={newProjectForm.initialResourceTitle || ''}
                                                                onChange={(e) => onNewProjectFieldChange('initialResourceTitle', e.target.value)}
                                                                placeholder="e.g. Source Novel Excerpt, Background Lore, Scene Outline"
                                                            />
                                                            <label className="flex items-center justify-center px-6 h-14 bg-subtle-3 border border-subtle-8 hover:border-accent hover:bg-subtle-5 rounded-2xl cursor-pointer text-[10px] font-black text-heading uppercase tracking-widest transition-colors select-none">
                                                                Upload Reference File
                                                                <input
                                                                    type="file"
                                                                    accept=".pdf,.docx,.txt"
                                                                    className="hidden"
                                                                    onChange={(e) => {
                                                                        const file = e.target.files?.[0] || null;
                                                                        if (file) {
                                                                            onNewProjectFieldChange('selectedResourceFile', file);
                                                                            onNewProjectFieldChange('initialResourceTitle', file.name.replace(/\.[^/.]+$/, ""));
                                                                        }
                                                                    }}
                                                                />
                                                            </label>
                                                        </div>
                                                        <textarea
                                                            className="w-full px-5 py-4 bg-subtle-2 border border-subtle-8 rounded-2xl text-heading font-serif italic text-sm placeholder:text-muted/20 focus:outline-none focus:border-accent transition-colors min-h-[120px] mt-2"
                                                            value={newProjectForm.initialResourceContent || ''}
                                                            onChange={(e) => onNewProjectFieldChange('initialResourceContent', e.target.value)}
                                                            placeholder="Paste your source material content here (up to 100K characters) to seed the screenplay generation engine."
                                                        />
                                                    </Stack>
                                                )}
                                            </Stack>
                                        </Stack>
                                    </Stack>
 
                                    <Stack direction="horizontal" gap={4} className="pt-4">
                                        <Button
                                            variant="secondary"
                                            className="flex-1 h-14 text-[10px] font-black uppercase tracking-widest"
                                            onClick={onNewProjectCancel}
                                        >
                                            Abort
                                        </Button>
                                        <Button
                                            variant="primary"
                                            className="flex-[2] h-14 text-[10px] font-black uppercase tracking-widest"
                                            onClick={onNewProjectSubmit}
                                            disabled={creatingProject || !newProjectForm.title.trim() || !newProjectForm.logline.trim() || !(newProjectForm.selectedResourceFile || newProjectForm.initialResourceContent?.trim())}
                                            isLoading={creatingProject}
                                            leftIcon={<Sparkles size={16} />}
                                        >
                                            Commence Production
                                        </Button>
                                    </Stack>
                                </Stack>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            <ConfirmDialog
                isOpen={dialog.isOpen && dialog.type === 'confirm'}
                onClose={closeDialog}
                onConfirm={dialog.onConfirm || (() => { })}
                title={dialog.title}
                description={dialog.description}
                variant="danger"
                confirmLabel="Purge Project"
            />
        </Page>
    );
}
