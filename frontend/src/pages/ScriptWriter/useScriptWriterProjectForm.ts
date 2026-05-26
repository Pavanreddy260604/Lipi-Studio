import { useMemo, useState } from 'react';
import type { Bible } from '../../services/project.api';
import { projectApi } from '../../services/project.api';
import { DEFAULT_PROJECT_FORM, type ProjectForm } from './types';
import { getErrorMessage } from './utils';

interface UseScriptWriterProjectFormProps {
    activeProject: Bible | null;
    onProjectUpdated: (project: Bible) => void;
    setError: (message: string | null) => void;
}

export function useScriptWriterProjectForm({
    activeProject,
    onProjectUpdated,
    setError
}: UseScriptWriterProjectFormProps) {
    const [projectDrafts, setProjectDrafts] = useState<Record<string, ProjectForm>>({});

    const buildProjectForm = (project: Bible | null): ProjectForm => {
        if (!project) {
            return DEFAULT_PROJECT_FORM;
        }

        return {
            title: project.title || '',
            logline: project.logline || '',
            genre: project.genre || 'Drama',
            tone: project.tone || 'Cinematic',
            language: project.language || 'English',
            transliteration: Boolean(project.transliteration),
            assistantPreferences: {
                defaultMode: project.assistantPreferences?.defaultMode || 'ask',
                replyLanguage: project.assistantPreferences?.replyLanguage || '',
                transliteration: project.assistantPreferences?.transliteration,
                savedDirectives: project.assistantPreferences?.savedDirectives || []
            }
        };
    };

    const baseProjectForm = useMemo(
        () => buildProjectForm(activeProject),
        [activeProject]
    );

    const projectForm = activeProject
        ? projectDrafts[activeProject._id] ?? baseProjectForm
        : DEFAULT_PROJECT_FORM;
    const projectDirty = Boolean(activeProject) && JSON.stringify(projectForm) !== JSON.stringify(baseProjectForm);

    const handleProjectFormChange = <K extends keyof ProjectForm>(field: K, value: ProjectForm[K]) => {
        if (!activeProject) {
            return;
        }

        setProjectDrafts((prev) => ({
            ...prev,
            [activeProject._id]: {
                ...(prev[activeProject._id] ?? baseProjectForm),
                [field]: value
            }
        }));
    };

    const handleSaveProject = async () => {
        if (!activeProject) return;
        try {
            const updated = await projectApi.updateProject(activeProject._id, projectForm);
            onProjectUpdated(updated);
            setProjectDrafts((prev) => {
                const next = { ...prev };
                delete next[activeProject._id];
                return next;
            });
        } catch (err) {
            setError(getErrorMessage(err, 'Failed to update project'));
        }
    };

    return {
        projectForm,
        projectDirty,
        handleProjectFormChange,
        handleSaveProject
    };
}
