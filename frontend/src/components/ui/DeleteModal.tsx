import { Modal } from './Modal';
import { Button } from './Button';
import { AlertTriangle } from 'lucide-react';

interface DeleteModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    description: string;
    isDeleting?: boolean;
}

export function DeleteModal({
    isOpen,
    onClose,
    onConfirm,
    title,
    description,
    isDeleting = false
}: DeleteModalProps) {
    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={title}
            size="sm"
        >
            <div className="flex flex-col gap-4">
                <div className="flex items-start gap-3 sm:gap-4 p-4 bg-status-error-soft border border-subtle-20 rounded-2xl">
                    <AlertTriangle className="text-status-error shrink-0 mt-0.5" size={22} />
                    <p className="text-sm text-text-secondary">
                        {description}
                    </p>
                </div>

                <div className="modal-action-row flex items-center justify-end gap-3 mt-2 sm:mt-4">
                    <Button
                        variant="secondary"
                        onClick={onClose}
                        disabled={isDeleting}
                        className="w-full sm:w-auto"
                    >
                        Cancel
                    </Button>
                    <Button
                        variant="danger"
                        onClick={onConfirm}
                        isLoading={isDeleting}
                        className="w-full sm:w-auto"
                    >
                        Delete
                    </Button>
                </div>
            </div>
        </Modal>
    );
}
