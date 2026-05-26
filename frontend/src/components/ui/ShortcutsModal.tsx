import { Modal } from './Modal';
import { Keyboard } from 'lucide-react';
import { SHORTCUTS } from '../../hooks/useKeyboardShortcuts';

interface ShortcutsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export function ShortcutsModal({ isOpen, onClose }: ShortcutsModalProps) {
    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Keyboard Shortcuts"
            size="md"
        >
            <div className="flex flex-col gap-4">
                <div className="flex items-center gap-3 p-4 rounded-lg bg-accent-soft border border-accent-soft text-accent mb-6">
                    <Keyboard size={24} />
                    <p className="text-sm">
                        Use these shortcuts to navigate the app quickly.
                    </p>
                </div>

                <div className="flex flex-col gap-4">
                    {Object.entries(SHORTCUTS).map(([key, config]: [string, any]) => (
                        <div key={key} className="flex items-center justify-between p-3 rounded-lg bg-subtle-5 border border-subtle-5 hover:border-subtle-10 transition-colors">
                            <span className="text-text-secondary font-medium">{config.description}</span>
                            <div className="flex items-center gap-1.5">
                                {config.ctrl && (
                                    <kbd className="px-2 py-1 text-xs font-mono font-semibold text-text-tertiary bg-subtle-10 rounded-md border border-subtle-10 shadow-sm">
                                        Ctrl
                                    </kbd>
                                )}
                                <kbd className="px-2 py-1 text-xs font-mono font-semibold text-text-tertiary bg-subtle-10 rounded-md border border-subtle-10 shadow-sm min-w-[1.5rem] text-center uppercase">
                                    {config.key}
                                </kbd>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </Modal>
    );
}
