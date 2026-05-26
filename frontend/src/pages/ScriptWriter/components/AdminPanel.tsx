import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Database,
    Plus,
    RefreshCcw,
    CheckCircle2,
    Clock,
    AlertCircle,
    Tag,
    User,
    FileText,
    Search,
    Trash2,
    Eye
} from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Textarea } from '../../../components/ui/Textarea';
import { scriptWriterApi } from '../../../services/scriptWriter.api';
import type { IMasterScript } from '../../../services/scriptWriter.api';

export function AdminPanel() {
    const navigate = useNavigate();
    const [scripts, setScripts] = useState<IMasterScript[]>([]);
    const [loading, setLoading] = useState(true);
    const [isAdding, setIsAdding] = useState(false);
    const [isDeleting, setIsDeleting] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const [formData, setFormData] = useState({
        title: '',
        director: '',
        language: 'English',
        tags: '',
        rawContent: '',
        file: null as File | null
    });

    const fetchScripts = async (silent = false) => {
        try {
            if (!silent) setLoading(true);
            const data = await scriptWriterApi.getMasterScripts();
            setScripts(data);
        } catch (err) {
            console.error('Failed to fetch master scripts:', err);
        } finally {
            if (!silent) setLoading(false);
        }
    };

    useEffect(() => {
        fetchScripts();
    }, []);

    useEffect(() => {
        const hasProcessingScripts = scripts.some(s => s.status === 'processing' || s.status === 'validating');
        if (!hasProcessingScripts) return;

        const interval = setInterval(() => {
            fetchScripts(true);
        }, 1000);

        return () => clearInterval(interval);
    }, [scripts]);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            setSubmitting(true);
            const newScript = await scriptWriterApi.createMasterScript({
                ...formData,
                tags: formData.tags.split(',').map(t => t.trim()).filter(Boolean),
                file: formData.file || undefined
            });
            setIsAdding(false);
            setFormData({ title: '', director: '', language: 'English', tags: '', rawContent: '', file: null });

            if (newScript._id) {
                await scriptWriterApi.processMasterScript(newScript._id);
            }

            fetchScripts();
        } catch {
            alert('Failed to create script');
        } finally {
            setSubmitting(false);
        }
    };

    const handleProcess = async (id: string) => {
        try {
            await scriptWriterApi.processMasterScript(id);
            fetchScripts();
        } catch {
            alert('Processing failed');
        }
    };

    const handleDelete = async (id: string, title: string) => {
        if (!window.confirm(`Are you sure you want to delete "${title}"? This will remove all associated AI training data permanently.`)) return;

        try {
            setIsDeleting(id);
            await scriptWriterApi.deleteMasterScript(id);
            await fetchScripts();
        } catch {
            alert('Failed to delete script');
        } finally {
            setIsDeleting(null);
        }
    };

    const filteredScripts = scripts.filter(s =>
        s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.director.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.language?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'indexed': return <CheckCircle2 size={14} className="text-[var(--status-ok)]" />;
            case 'processing': return <RefreshCcw size={14} className="text-[var(--accent)] animate-spin" />;
            case 'validating': return <RefreshCcw size={14} className="text-[var(--status-warning)] animate-spin" />;
            case 'failed': return <AlertCircle size={14} className="text-[var(--status-error)]" />;
            default: return <Clock size={14} className="text-[var(--text-muted)]" />;
        }
    };

    const openReader = (script: IMasterScript) => {
        const params = new URLSearchParams();
        const preferredVersion = script.processingScriptVersion || script.activeScriptVersion;
        if (preferredVersion) {
            params.set('version', preferredVersion);
        }
        params.set('title', script.title);
        navigate(`/script-writer/master-script/${script._id}?${params.toString()}`);
    };

    const getGateTone = (status?: IMasterScript['gateStatus']) => {
        switch (status) {
            case 'passed':
                return 'bg-[var(--status-ok)]/10 border-[var(--status-ok)]/20 text-[var(--status-ok)]';
            case 'failed':
                return 'bg-[var(--status-error)]/10 border-[var(--status-error)]/20 text-[var(--status-error)]';
            default:
                return 'bg-[var(--status-warning)]/10 border-[var(--status-warning)]/20 text-[var(--status-warning)]';
        }
    };

    return (
        <div className="animate-fade-in">
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                    <div className="bg-[var(--surface-elevated)] border border-subtle-8 rounded-xl shadow-[var(--shadow-sm)] p-3" style={{ borderRadius: 'var(--radius-xl)' }}>
                        <Database style={{ color: 'var(--accent)' }} size={24} />
                    </div>
                    <div>
                        <h2 className="text-2xl font-black text-[var(--text-primary)] tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>Master Feed</h2>
                        <p className="text-[var(--text-muted)] text-xs font-bold uppercase tracking-widest">Global RAG Authority</p>
                    </div>
                </div>

                <Button
                    variant="primary"
                    onClick={() => setIsAdding(!isAdding)}
                >
                    {isAdding ? 'Cancel' : (
                        <><Plus size={16} /> Add Script</>
                    )}
                </Button>
            </div>

            <AnimatePresence mode="wait">
                {isAdding ? (
                    <motion.div
                        key="add-form"
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: 0.2 }}
                        className="bg-[var(--surface-elevated)] border border-subtle-8 rounded-xl shadow-[var(--shadow-md)] p-5"
                        style={{ borderRadius: 'var(--radius-xl)' }}
                    >
                         <form onSubmit={handleCreate} className="flex flex-col gap-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="flex flex-col gap-2">
                                    <label className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Script Title</label>
                                    <Input
                                        value={formData.title}
                                        onChange={e => setFormData({ ...formData, title: e.target.value })}
                                        placeholder="e.g. Inception"
                                        required
                                    />
                                </div>
                                <div className="flex flex-col gap-2">
                                    <label className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Director / Style</label>
                                    <Input
                                        value={formData.director}
                                        onChange={e => setFormData({ ...formData, director: e.target.value })}
                                        placeholder="e.g. Christopher Nolan"
                                        required
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="flex flex-col gap-2">
                                    <label className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Language</label>
                                    <Input
                                        value={formData.language}
                                        onChange={e => setFormData({ ...formData, language: e.target.value })}
                                        placeholder="e.g. Telugu, English, Hindi"
                                        required
                                    />
                                </div>
                                <div className="flex flex-col gap-2">
                                    <label className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Tags (Comma separated)</label>
                                    <Input
                                        value={formData.tags}
                                        onChange={e => setFormData({ ...formData, tags: e.target.value })}
                                        placeholder="Sci-Fi, Mind-Bending, Noir"
                                    />
                                </div>
                            </div>

                            <div className="flex flex-col gap-4 pt-2">
                                <div className="flex flex-col gap-4">
                                    <label className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Upload Script Document (PDF, DOCX, TXT, FOUNTAIN, SCRIPT)</label>
                                    <div className="relative">
                                        <input
                                            type="file"
                                            id="script-file"
                                            className="hidden"
                                            accept=".pdf,.docx,.txt,.md,.fountain,.script"
                                            onChange={e => {
                                                const file = e.target.files?.[0];
                                                if (file) setFormData({ ...formData, file, rawContent: '' });
                                            }}
                                        />
                                        <label
                                            htmlFor="script-file"
                                            className={`w-full flex items-center justify-between px-4 py-3 cursor-pointer ${formData.file ? 'border border-accent/50' : 'border border-subtle-8'}`}
                                            style={{ borderStyle: formData.file ? 'solid' : 'dashed', borderRadius: 'var(--radius-lg)' }}
                                        >
                                            <div className="flex items-center gap-3">
                                                <FileText size={18} className={formData.file ? 'text-[var(--accent)]' : 'text-[var(--text-muted)]'} />
                                                <span className={`text-sm font-medium ${formData.file ? 'text-[var(--accent)]' : 'text-[var(--text-tertiary)]'}`}>
                                                    {formData.file ? formData.file.name : 'Choose a file or drag it here...'}
                                                </span>
                                            </div>
                                            {formData.file && (
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        setFormData({ ...formData, file: null });
                                                    }}
                                                    className="p-1 rounded-md transition-colors"
                                                    style={{ color: 'var(--accent)' }}
                                                >
                                                    ✕
                                                </button>
                                            )}
                                        </label>
                                    </div>
                                </div>

                                {!formData.file && (
                                    <div className="flex flex-col gap-4 animate-fade-in">
                                        <div className="flex items-center gap-4 py-1">
                                            <div className="h-px bg-[var(--border-subtle)] flex-1"></div>
                                            <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest">OR PASTE TEXT</span>
                                            <div className="h-px bg-[var(--border-subtle)] flex-1"></div>
                                        </div>
                                        <Textarea
                                            rows={6}
                                            value={formData.rawContent}
                                            onChange={e => setFormData({ ...formData, rawContent: e.target.value })}
                                            placeholder="Paste script content here..."
                                            required={!formData.file}
                                        />
                                    </div>
                                )}
                            </div>

                            <div className="pt-2">
                                <Button variant="primary" type="submit" className="w-full" isLoading={submitting}>
                                    <Database size={16} /> Ingest & Index Script
                                </Button>
                            </div>
                        </form>
                    </motion.div>
                ) : (
                    <motion.div key="list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-4">
                        <div className="relative mb-6">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" size={18} />
                            <input
                                type="text"
                                placeholder="Search master scripts..."
                                className="w-full pl-12 pr-4 py-3.5"
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                            />
                        </div>

                        {loading ? (
                            <div className="flex flex-col items-center justify-center py-20 gap-3">
                                <RefreshCcw className="animate-spin" size={32} style={{ color: 'var(--accent)' }} />
                                <span className="text-[var(--text-muted)] font-bold uppercase tracking-widest text-[10px]">Syncing authority feed...</span>
                            </div>
                        ) : filteredScripts.length === 0 ? (
                            <div className="flex flex-col items-center justify-center text-center py-20 bg-[var(--surface-elevated)] border border-dashed border-subtle-8 rounded-xl shadow-[var(--shadow-sm)]" style={{ borderRadius: 'var(--radius-2xl)' }}>
                                <FileText size={48} className="mx-auto text-[var(--text-muted)] mb-4" />
                                <p className="text-[var(--text-tertiary)] font-bold">No master scripts found.</p>
                            </div>
                        ) : (
                            <div className="grid gap-4">
                                {filteredScripts.map((script, idx) => (
                                    <motion.div
                                        key={script._id}
                                        initial={{ opacity: 0, y: 8 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: idx * 0.03 }}
                                        className="bg-subtle-2 border border-subtle-8 rounded-xl group p-5 flex items-center justify-between"
                                        style={{ borderRadius: 'var(--radius-xl)' }}
                                    >
                                        <div className="flex items-center gap-5 min-w-0 flex-1">
                                            <div className="bg-[var(--surface-elevated)] border border-subtle-8 rounded-xl shadow-[var(--shadow-sm)] p-3 flex-shrink-0" style={{ borderRadius: 'var(--radius-lg)' }}>
                                                <FileText size={20} className="text-[var(--text-muted)] group-hover:text-[var(--accent)] transition-colors" />
                                            </div>
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2 mb-1 flex-wrap">
                                                    <h3 className="font-bold text-[var(--text-primary)] text-lg truncate">{script.title}</h3>
                                                    <span className="flex items-center gap-1.5 bg-[var(--surface-elevated)] border border-subtle-8 rounded px-2 py-0.5 text-[10px] font-black uppercase text-[var(--text-secondary)]">
                                                        {getStatusIcon(script.status)}
                                                        {script.status}
                                                    </span>
                                                    {script.gateStatus && (
                                                        <span className={`px-2 py-0.5 border rounded text-[10px] font-black uppercase ${getGateTone(script.gateStatus)}`}>
                                                            Gate {script.gateStatus}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-4 text-xs text-[var(--text-muted)] font-medium flex-wrap">
                                                    <span className="flex items-center gap-1"><User size={12} style={{ color: 'color-mix(in oklch, var(--accent) 50%, transparent)' }} /> {script.director}</span>
                                                    <span className="flex items-center gap-1 font-bold" style={{ color: 'var(--accent)' }}>{script.language || 'English'}</span>
                                                    <span className="flex items-center gap-1"><Tag size={12} style={{ color: 'color-mix(in oklch, var(--accent) 50%, transparent)' }} /> {Array.isArray(script.tags) ? script.tags.join(', ') : ''}</span>
                                                    <span className="flex items-center gap-1"><Clock size={12} className="text-[var(--text-muted)]" /> {new Date(script.createdAt).toLocaleDateString()}</span>
                                                </div>
                                                <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
                                                    {(script.processingScriptVersion || script.activeScriptVersion) && (
                                                        <span className="bg-[var(--surface-elevated)] border border-subtle-8 rounded px-2 py-0.5 text-[var(--text-secondary)]">
                                                            Version {script.processingScriptVersion || script.activeScriptVersion}
                                                        </span>
                                                    )}
                                                    {script.parserVersion && (
                                                        <span className="bg-[var(--surface-elevated)] border border-subtle-8 rounded px-2 py-0.5 text-[var(--text-secondary)]">
                                                            Parser {script.parserVersion}
                                                        </span>
                                                    )}
                                                    {script.processedChunks > 0 && (
                                                        <span className="bg-[var(--surface-elevated)] border border-subtle-8 rounded px-2 py-0.5 text-[var(--text-secondary)] group/tooltip relative cursor-help">
                                                            <Database size={10} />
                                                            {script.processedChunks} Structured Elements
                                                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-[var(--surface-elevated)] border border-subtle-8 rounded-xl shadow-[var(--shadow-md)] text-[9px] font-medium normal-case tracking-normal leading-tight opacity-0 pointer-events-none group-hover/tooltip:opacity-100 transition-opacity z-10" style={{ borderRadius: 'var(--radius-md)' }}>
                                                                High-granularity elements (dialogue, action, scenes) for precision RAG.
                                                            </div>
                                                        </span>
                                                    )}
                                                    {script.readerReady && (
                                                        <span className="bg-[var(--surface-elevated)] border border-subtle-8 rounded px-2 py-0.5 text-[var(--text-secondary)]">
                                                            Reader Ready
                                                        </span>
                                                    )}
                                                    {typeof script.ragReady === 'boolean' && (
                                                        <span className="bg-[var(--surface-elevated)] border border-subtle-8 rounded px-2 py-0.5 text-[var(--text-secondary)]">
                                                            {script.ragReady ? 'RAG Ready' : 'RAG Pending'}
                                                        </span>
                                                    )}
                                                </div>
                                                {script.lastValidationSummary && (
                                                    <p className="mt-2 max-w-2xl text-xs text-[var(--text-tertiary)]">
                                                        {script.lastValidationSummary}
                                                    </p>
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-3 flex-shrink-0 ml-4">
                                            {script.status !== 'processing' && script.status !== 'validating' && (
                                                <Button variant="secondary" size="sm" onClick={() => handleProcess(script._id)}>
                                                    {script.activeScriptVersion ? 'Reprocess' : 'Start Processing'}
                                                </Button>
                                            )}
                                            {(script.status === 'processing' || script.status === 'validating') && (
                                                <div className="flex flex-col items-end gap-1.5 w-48">
                                                    <div className={`flex items-center justify-between w-full text-[10px] font-black tracking-widest ${script.status === 'validating' ? 'text-[var(--status-warning)]' : 'text-[var(--accent)]'}`}>
                                                        <span>{script.status === 'validating' ? 'VALIDATING' : 'PROCESSING'}</span>
                                                        <span>{script.progress || 0}%</span>
                                                    </div>
                                                    <div className="w-full h-1.5 rounded-full bg-subtle-2 overflow-hidden">
                                                        <div
                                                            className={`h-full transition-all duration-500 ease-out rounded-full ${script.status === 'validating' ? 'bg-[var(--status-warning)]' : 'bg-[var(--accent)]'}`}
                                                            style={{ width: `${script.progress || 0}%` }}
                                                        />
                                                    </div>
                                                </div>
                                            )}
                                            {script.readerReady && (
                                                <Button
                                                    variant="primary"
                                                    size="sm"
                                                    onClick={() => openReader(script)}
                                                    style={{ background: 'var(--status-ok)', color: 'white' }}
                                                >
                                                    <Eye size={14} />
                                                    OPEN
                                                </Button>
                                            )}
                                            <button
                                                type="button"
                                                onClick={() => handleDelete(script._id, script.title)}
                                                disabled={isDeleting === script._id}
                                                className={`p-2 transition-colors focus-ring rounded-[var(--radius-md)] ${isDeleting === script._id
                                                    ? 'text-[var(--status-error)]/50 cursor-not-allowed'
                                                    : 'text-[var(--text-muted)] hover:text-[var(--status-error)] hover:bg-[var(--status-error)]/10'
                                                }`}
                                                title="Delete Script & Vector Data"
                                            >
                                                <Trash2 size={20} />
                                            </button>
                                        </div>
                                    </motion.div>
                                ))}
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
