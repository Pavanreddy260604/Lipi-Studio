import { useState, useCallback, useEffect } from 'react';
import { scriptWriterApi } from '../../../services/scriptWriter.api';
import type { ScriptTemplates } from '../../../services/scriptWriter.api';
import { getErrorMessage } from '../utils';

export function useScriptTemplates(setError: (msg: string | null) => void) {
    const [scriptTemplates, setScriptTemplates] = useState<ScriptTemplates | null>(null);
    const [scriptFormat, setScriptFormat] = useState('');
    const [scriptStyle, setScriptStyle] = useState('');

    const loadTemplates = useCallback(async () => {
        try {
            const templates = await scriptWriterApi.getTemplates();
            setScriptTemplates(templates);
            if (templates.formats.length > 0) setScriptFormat(templates.formats[0].id);
            if (templates.styles.length > 0) setScriptStyle(templates.styles[0].id);
        } catch (err) {
            setError(getErrorMessage(err, 'Failed to load templates'));
        }
    }, [setError]);

    useEffect(() => {
        void loadTemplates();
    }, [loadTemplates]);

    return {
        scriptTemplates,
        scriptFormat,
        setScriptFormat,
        scriptStyle,
        setScriptStyle,
        loadTemplates
    };
}
