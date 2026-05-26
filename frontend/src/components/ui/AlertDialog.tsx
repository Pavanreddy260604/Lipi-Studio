import { Modal } from './Modal';
import { Button } from './Button';
import { Info } from 'lucide-react';

interface AlertDialogProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    description: string;
    buttonLabel?: string;
}

export function AlertDialog({
    isOpen,
    onClose,
    title,
    description,
    buttonLabel = 'OK'
}: AlertDialogProps) {
    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={title}
            size="sm"
        >
            <div className="flex flex-col gap-4">
                <div className="flex items-start gap-4 p-4 bg-subtle-5 border border-subtle-20 rounded-lg">
                    <Info className="text-text-tertiary shrink-0 mt-0.5" size={20} />
                    <p className="text-sm text-text-secondary">
                        {description}
                    </p>
                </div>

                <div className="mt-4 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end">
                    <Button
                        variant="primary"
                        onClick={onClose}
                        className="w-full sm:w-auto"
                    >
                        {buttonLabel}
                    </Button>
                </div>
            </div>
        </Modal>
    );
}
