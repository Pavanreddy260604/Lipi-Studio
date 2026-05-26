import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ChunkViewerModal } from './components/ChunkViewerModal';

export function MasterScriptReaderPage() {
    const navigate = useNavigate();
    const { scriptId } = useParams<{ scriptId: string }>();
    const [searchParams] = useSearchParams();
    const handleClose = () => {
        if (window.history.length > 1) {
            navigate(-1);
            return;
        }

        navigate('/script-writer');
    };

    if (!scriptId) {
        return (
            <div className="min-h-screen bg-[var(--surface-page)] text-[var(--text-primary)] flex items-center justify-center">
                Missing master script id.
            </div>
        );
    }

    return (
        <ChunkViewerModal
            isOpen
            mode="page"
            onClose={handleClose}
            scriptId={scriptId}
            scriptTitle={searchParams.get('title') || 'Master Script'}
            scriptVersion={searchParams.get('version') || undefined}
        />
    );
}
