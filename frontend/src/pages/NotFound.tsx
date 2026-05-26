import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Home, ArrowLeft, SearchX } from 'lucide-react';
import { useEffect } from 'react';
import { Button, Page, Stack } from '../components/ui';

export function NotFound() {
    useEffect(() => {
        document.title = '404 - Grid Disconnected — Lipi Studio';
        return () => { document.title = 'Lipi Studio'; };
    }, []);

    return (
        <Page kicker="Network.Anomaly" title="Link Severed" subtitle="The requested resource identifier does not exist in the active matrix.">
            <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="max-w-md w-full"
                >
                    <Stack gap={10} align="center">
                        <div className="relative">
                            <div className="text-[12rem] font-black text-accent/5 select-none tracking-tighter">404</div>
                            <div className="absolute inset-0 flex items-center justify-center">
                                <SearchX size={80} className="text-accent/20" />
                            </div>
                        </div>

                        <Stack gap={4}>
                            <h1 className="text-2xl font-black text-heading uppercase tracking-tight">Resource Not Found</h1>
                            <p className="text-sm text-secondary font-medium leading-relaxed max-w-[32ch]">
                                The grid coordinate you entered has no associated data packets. The link may have expired or been purged.
                            </p>
                        </Stack>

                        <Stack direction="horizontal" gap={4} className="w-full">
                            <Button
                                variant="primary"
                                className="flex-1 h-12 text-[10px] font-black uppercase tracking-widest"
                                onClick={() => window.location.href = '/'}
                                leftIcon={<Home size={16} />}
                            >
                                Dashboard
                            </Button>
                            <Button
                                variant="secondary"
                                className="flex-1 h-12 text-[10px] font-black uppercase tracking-widest"
                                onClick={() => window.history.back()}
                                leftIcon={<ArrowLeft size={16} />}
                            >
                                Go Back
                            </Button>
                        </Stack>
                    </Stack>
                </motion.div>
            </div>
        </Page>
    );
}
