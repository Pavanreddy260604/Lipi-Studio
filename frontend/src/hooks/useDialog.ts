import { useState, useCallback } from 'react';

export type DialogType = 'alert' | 'confirm';

interface DialogState {
    isOpen: boolean;
    type: DialogType;
    title: string;
    description: string;
    onConfirm?: () => void | Promise<void>;
}

export function useDialog() {
    const [dialog, setDialog] = useState<DialogState>({
        isOpen: false,
        type: 'alert',
        title: '',
        description: '',
    });

    const showAlert = useCallback((title: string, description: string) => {
        setDialog({
            isOpen: true,
            type: 'alert',
            title,
            description,
        });
    }, []);

    const showConfirm = useCallback((title: string, description: string, onConfirm: () => void) => {
        setDialog({
            isOpen: true,
            type: 'confirm',
            title,
            description,
            onConfirm,
        });
    }, []);

    const closeDialog = useCallback(() => {
        setDialog(prev => ({ ...prev, isOpen: false }));
    }, []);

    return {
        dialog,
        showAlert,
        showConfirm,
        closeDialog
    };
}
