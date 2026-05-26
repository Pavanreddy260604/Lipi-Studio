import { useEffect, useState } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';
import { AlertTriangle, Info } from 'lucide-react';

interface ConfirmDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    description: string;
    confirmLabel?: string;
    cancelLabel?: string;
    variant?: 'danger' | 'primary';
    isLoading?: boolean;
    verificationText?: string;
    verificationLabel?: string;
    verificationPlaceholder?: string;
}

export function ConfirmDialog({
    isOpen,
    onClose,
    onConfirm,
    title,
    description,
    confirmLabel = 'Confirm',
    cancelLabel = 'Cancel',
    variant = 'primary',
    isLoading = false,
    verificationText,
    verificationLabel = 'Type the confirmation text to continue',
    verificationPlaceholder = ''
}: ConfirmDialogProps) {
    const [internalLoading, setInternalLoading] = useState(false);
    const [verificationInput, setVerificationInput] = useState('');
    const isVerificationRequired = Boolean(verificationText);
    const isVerificationValid = !isVerificationRequired || verificationInput.trim() === verificationText;

    useEffect(() => {
        if (!isOpen) {
            setVerificationInput('');
            setInternalLoading(false);
        }
    }, [isOpen]);

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={title}
            size="sm"
        >
            <div className="flex flex-col gap-4">
                <div className={`flex items-start gap-4 p-4 rounded-lg border ${variant === 'danger'
                    ? 'bg-status-error-soft border-status-error/20'
                    : 'bg-accent-soft border-accent-primary/20'
                    }`}>
                    {variant === 'danger' ? (
                        <AlertTriangle className="text-status-error shrink-0 mt-0.5" size={20} />
                    ) : (
                        <Info className="text-accent-primary shrink-0 mt-0.5" size={20} />
                    )}
                    <p className="text-sm text-text-primary">
                        {description}
                    </p>
                </div>

                {isVerificationRequired && (
                    <div className="flex flex-col gap-4">
                        <p className="text-xs text-text-secondary">
                            {verificationLabel}
                        </p>
                        <input
                            value={verificationInput}
                            onChange={(event) => setVerificationInput(event.target.value)}
                            placeholder={verificationPlaceholder || verificationText}
                            className="w-full px-3 py-2 rounded-lg border border-border-subtle bg-console-surface-2 text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-primary/30 focus:border-accent-primary"
                        />
                        <p className="text-xs text-text-secondary">
                            Confirmation text: <span className="font-semibold text-text-primary">{verificationText}</span>
                        </p>
                    </div>
                )}

                <div className="mt-4 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end">
                    <Button
                        variant="secondary"
                        onClick={onClose}
                        disabled={isLoading || internalLoading}
                        className="w-full sm:w-auto"
                    >
                        {cancelLabel}
                    </Button>
                    <Button
                        variant={variant === 'danger' ? 'danger' : 'primary'}
                        disabled={!isVerificationValid}
                        className="w-full sm:w-auto"
                        onClick={async () => {
                            setInternalLoading(true);
                            try {
                                await onConfirm();
                                onClose();
                            } catch (error) {
                                console.error('Confirmation action failed:', error);
                            } finally {
                                setInternalLoading(false);
                            }
                        }}
                        isLoading={isLoading || internalLoading}
                    >
                        {confirmLabel}
                    </Button>
                </div>
            </div>
        </Modal>
    );
}
