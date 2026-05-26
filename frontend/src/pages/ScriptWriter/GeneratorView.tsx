import { Sparkles, History, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';
import { Button, Card, Stack, Grid, Badge, Select } from '../../components/ui';
import type { Bible } from '../../services/project.api';
import type { Character } from '../../services/character.api';
import type { ScriptHistoryItem, ScriptTemplates } from '../../services/scriptWriter.api';
import { cn } from '../../lib/utils';

interface GeneratorViewProps {
    activeProject: Bible | null;
    scriptTemplates: ScriptTemplates | null;
    scriptIdea: string;
    onScriptIdeaChange: (value: string) => void;
    scriptFormat: string;
    onScriptFormatChange: (value: string) => void;
    scriptStyle: string;
    onScriptStyleChange: (value: string) => void;
    scriptOutput: string;
    scriptHistory: ScriptHistoryItem[];
    activeHistoryId: string | null;
    onScriptHistorySelect: (id: string) => void;
    onGenerateScript: () => void;
    isScriptGenerating: boolean;
    characters: Character[];
    selectedScriptCharacterIds: string[];
    onToggleScriptCharacter: (id: string) => void;
}

export function GeneratorView({
    activeProject,
    scriptTemplates,
    scriptIdea,
    onScriptIdeaChange,
    scriptFormat,
    onScriptFormatChange,
    scriptStyle,
    onScriptStyleChange,
    scriptOutput,
    scriptHistory,
    activeHistoryId,
    onScriptHistorySelect,
    onGenerateScript,
    isScriptGenerating,
    characters,
    selectedScriptCharacterIds,
    onToggleScriptCharacter
}: GeneratorViewProps) {
    const [historyOpen, setHistoryOpen] = useState(false);

    if (!activeProject) {
        return (
            <div className="flex flex-col items-center justify-center h-full gap-8 p-12 text-center">
                <Card className="p-12 bg-subtle-2 border-subtle-8 shadow-sm flex flex-col items-center gap-8">
                    <div className="w-16 h-16 rounded-[1.5rem] bg-subtle-3 border border-subtle-8 flex items-center justify-center text-muted">
                        <Sparkles size={32} />
                    </div>
                    <Stack gap={2}>
                        <h2 className="text-xl font-black text-heading uppercase tracking-tight italic">Script Generator</h2>
                        <p className="text-sm text-secondary font-medium max-w-[32ch] mx-auto leading-relaxed">Select a project record from the matrix to initialize the generation engine.</p>
                    </Stack>
                </Card>
            </div>
        );
    }

    return (
        <div className="flex flex-col lg:flex-row h-full gap-6 p-6 overflow-hidden">
            {/* Input Panel */}
            <Card className="flex-1 lg:w-2/5 p-8 sm:p-10 bg-surface-elevated border-subtle-8 shadow-xl flex flex-col gap-10 overflow-y-auto">
                <Stack gap={2}>
                    <div className="flex items-center gap-3 text-accent">
                        <Sparkles size={20} />
                        <h2 className="text-sm font-black text-heading uppercase tracking-widest">Inference Parameters</h2>
                    </div>
                    <p className="text-[10px] font-black text-muted uppercase tracking-[0.3em]">Configure script generation engine</p>
                </Stack>

                <Stack gap={8}>
                    <Stack gap={4}>
                        <label className="text-[10px] font-black text-muted uppercase tracking-widest px-1">Manuscript Objective</label>
                        <textarea
                            className="w-full px-5 py-4 text-sm font-medium resize-none bg-subtle-2 border border-subtle-8 rounded-[1.5rem] text-body placeholder:text-muted/20 focus:outline-none focus:border-accent transition-colors min-h-[160px]"
                            value={scriptIdea}
                            onChange={(e) => onScriptIdeaChange(e.target.value)}
                            placeholder="Describe the narrative arc, thematic intensity, and cognitive objectives..."
                        />
                    </Stack>

                    <Grid cols={2} gap={4}>
                        <Stack gap={2}>
                            <label className="text-[9px] font-black text-muted uppercase tracking-widest px-1">Sequence Format</label>
                            <Select
                                value={scriptFormat}
                                onChange={onScriptFormatChange}
                                options={(scriptTemplates?.formats || []).map(f => ({ value: f.id, label: f.name.toUpperCase() }))}
                                className="bg-subtle-3 h-12 text-[10px] font-black"
                            />
                        </Stack>
                        <Stack gap={2}>
                            <label className="text-[9px] font-black text-muted uppercase tracking-widest px-1">Inference Style</label>
                            <Select
                                value={scriptStyle}
                                onChange={onScriptStyleChange}
                                options={(scriptTemplates?.styles || []).map(s => ({ value: s.id, label: s.name.toUpperCase() }))}
                                className="bg-subtle-3 h-12 text-[10px] font-black"
                            />
                        </Stack>
                    </Grid>

                    {characters.length > 0 && (
                        <Stack gap={4}>
                            <label className="text-[9px] font-black text-muted uppercase tracking-widest px-1">Actor Integration (RAG)</label>
                            <div className="flex flex-wrap gap-2">
                                {characters.map((c) => (
                                    <button
                                        key={c._id}
                                        className={cn(
                                            "text-[9px] font-black uppercase tracking-widest px-4 py-2 rounded-xl border transition-all focus-ring",
                                            selectedScriptCharacterIds.includes(c._id)
                                                ? 'bg-accent/10 text-accent border-accent/20'
                                                : 'bg-subtle-3 text-muted border-subtle-8 hover:border-accent/40'
                                        )}
                                        onClick={() => onToggleScriptCharacter(c._id)}
                                    >
                                        {c.name}
                                    </button>
                                ))}
                            </div>
                        </Stack>
                    )}

                    <Button
                        variant="primary"
                        className="w-full h-14 text-[10px] font-black uppercase tracking-[0.2em] shadow-lg shadow-accent/10"
                        onClick={onGenerateScript}
                        disabled={isScriptGenerating || !scriptIdea.trim()}
                        isLoading={isScriptGenerating}
                        leftIcon={<Sparkles size={18} />}
                    >
                        Execute Generation
                    </Button>
                </Stack>

                {/* History Section */}
                <div className="mt-auto bg-subtle-2 border border-subtle-8 rounded-[1.5rem] overflow-hidden">
                    <button
                        className="w-full flex items-center justify-between px-6 py-4 text-[9px] font-black text-muted uppercase tracking-widest hover:bg-subtle-3 transition-colors focus-ring"
                        onClick={() => setHistoryOpen(!historyOpen)}
                    >
                        <div className="flex items-center gap-3">
                            <History size={16} className="text-accent" />
                            <span>Sequence Log ({scriptHistory.length})</span>
                        </div>
                        <motion.div
                            animate={{ rotate: historyOpen ? 180 : 0 }}
                            transition={{ duration: 0.2 }}
                        >
                            <ChevronDown size={16} />
                        </motion.div>
                    </button>
                    <AnimatePresence>
                        {historyOpen && (
                            <motion.div
                                initial={{ height: 0 }}
                                animate={{ height: 'auto' }}
                                exit={{ height: 0 }}
                                className="overflow-hidden"
                            >
                                <div className="border-t border-subtle-8 max-h-[240px] overflow-y-auto scrollbar-hide">
                                    {scriptHistory.length === 0 ? (
                                        <div className="px-6 py-8 text-center text-[9px] font-black text-muted uppercase tracking-widest italic opacity-40">No entries in log</div>
                                    ) : (
                                        scriptHistory.map((item) => (
                                            <button
                                                key={item._id}
                                                className={cn(
                                                    "w-full text-left px-6 py-4 border-b border-subtle-8 last:border-0 transition-all focus-ring",
                                                    activeHistoryId === item._id
                                                        ? 'bg-accent/5' : 'hover:bg-subtle-3'
                                                )}
                                                onClick={() => onScriptHistorySelect(item._id)}
                                            >
                                                <div className={cn(
                                                    "text-[10px] font-black uppercase tracking-tight truncate mb-1",
                                                    activeHistoryId === item._id ? 'text-accent' : 'text-heading'
                                                )}>
                                                    {item.title || item.prompt}
                                                </div>
                                                <div className="text-[9px] font-bold text-muted uppercase tracking-widest">
                                                    {item.format} &bull; {item.style}
                                                </div>
                                            </button>
                                        ))
                                    )}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </Card>

            {/* Output Panel */}
            <Card className="flex-1 lg:w-3/5 p-8 sm:p-10 bg-surface-elevated border-subtle-8 shadow-xl flex flex-col overflow-hidden">
                <div className="flex items-center justify-between mb-8 border-b border-subtle-8 pb-6">
                    <Stack gap={1}>
                        <span className="text-[10px] font-black text-muted uppercase tracking-[0.3em]">Neural Output Buffer</span>
                        <h2 className="text-xs font-black text-heading uppercase tracking-widest">Generated Protocol</h2>
                    </Stack>
                    {isScriptGenerating && (
                        <div className="flex items-center gap-2 bg-accent/10 px-4 py-2 rounded-xl border border-accent/20">
                            <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
                            <span className="text-[9px] font-black text-accent uppercase tracking-widest">Streaming Inference</span>
                        </div>
                    )}
                </div>
                
                <div className="flex-1 overflow-y-auto font-mono text-sm text-secondary bg-subtle-2 border border-subtle-8 rounded-[1.5rem] p-8 whitespace-pre-wrap leading-relaxed shadow-inner">
                    {scriptOutput || (
                        <div className="flex flex-col items-center justify-center h-full text-center gap-6 opacity-30 select-none grayscale">
                            <div className="p-8 border border-subtle-8 rounded-[2rem] border-dashed">
                                <Sparkles size={48} className="mx-auto mb-4" />
                                <Stack gap={2}>
                                    <p className="text-[10px] font-black uppercase tracking-widest">Awaiting Command Input</p>
                                    <p className="text-[9px] font-bold uppercase max-w-[24ch] mx-auto">Initialize generation to populate output buffer.</p>
                                </Stack>
                            </div>
                        </div>
                    )}
                </div>
            </Card>
        </div>
    );
}
