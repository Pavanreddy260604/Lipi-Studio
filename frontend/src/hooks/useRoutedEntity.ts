import { useEffect, useRef, useState } from 'react';

interface RoutedEntity {
    _id?: string;
}

export function useRoutedEntity<T extends RoutedEntity>(
    id: string | undefined,
    fetchEntity: (entityId: string) => Promise<T>,
    notFoundMessage: string
) {
    const [entity, setEntity] = useState<T | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    const requestRef = useRef(0);
    const fetchEntityRef = useRef(fetchEntity);

    useEffect(() => {
        fetchEntityRef.current = fetchEntity;
    }, [fetchEntity]);

    useEffect(() => {
        const requestId = ++requestRef.current;

        if (!id || id === 'new') {
            setEntity(null);
            setError('');
            setIsLoading(false);
            return;
        }

        setEntity(null);
        setError('');
        setIsLoading(true);

        fetchEntityRef.current(id)
            .then((result) => {
                if (requestRef.current !== requestId) {
                    return;
                }
                setEntity(result);
                setError('');
            })
            .catch((err) => {
                if (requestRef.current !== requestId) {
                    return;
                }
                console.error('Failed to fetch routed entity:', err);
                setEntity(null);
                setError(notFoundMessage);
            })
            .finally(() => {
                if (requestRef.current === requestId) {
                    setIsLoading(false);
                }
            });
    }, [id, notFoundMessage]);

    const isTransitioning = Boolean(id) && id !== 'new' && (!entity || (entity._id && entity._id !== id)) && !error;

    return {
        entity,
        setEntity,
        isLoading,
        error,
        isTransitioning
    };
}
