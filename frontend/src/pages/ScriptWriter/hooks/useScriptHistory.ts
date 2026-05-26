import { useState, useCallback, useEffect } from 'react';
import { scriptWriterApi } from '../../../services/scriptWriter.api';
import type { ScriptHistoryItem, IScriptDetail } from '../../../services/scriptWriter.api';
import { getErrorMessage } from '../utils';

export function useScriptHistory(setError: (msg: string | null) => void) {
    const [scriptHistory, setScriptHistory] = useState<ScriptHistoryItem[]>([]);
    const [activeHistoryId, setActiveHistoryId] = useState<string | null>(null);

    const loadScriptHistory = useCallback(async () => {
        try {
            const history = await scriptWriterApi.getHistory();
            setScriptHistory(history);
        } catch (err) {
            setError(getErrorMessage(err, 'Failed to load script history'));
        }
    }, [setError]);

    const handleScriptHistorySelect = useCallback(async (scriptId: string, onOutput: (content: string) => void) => {
        setActiveHistoryId(scriptId);
        try {
            const detail: IScriptDetail = await scriptWriterApi.getScript(scriptId);
            onOutput(detail.content || '');
        } catch (err) {
            setError(getErrorMessage(err, 'Failed to load script'));
        }
    }, [setError]);

    useEffect(() => {
        void loadScriptHistory();
    }, [loadScriptHistory]);

    return {
        scriptHistory,
        activeHistoryId,
        setActiveHistoryId,
        loadScriptHistory,
        handleScriptHistorySelect
    };
}
