import { Sparkles, Copy, Loader2, FileText } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useState, useRef, useEffect } from 'react';
import { Button, Input, Textarea, Select, Stack, Card, Grid } from '../../components/ui';
import type { Bible } from '../../services/project.api';
import type { ScriptTemplates } from '../../services/scriptWriter.api';

interface GeneratorPanelProps {
    activeProject: Bible | null;
    scriptTemplates: ScriptTemplates | null;
    scriptIdea: string;
    onScriptIdeaChange: (value: string) => void;
    scriptFormat: string;
    onScriptFormatChange: (value: string) => void;
    scriptStyle: string;
    onScriptStyleChange: (value: string) => void;
    scriptOutput: string;
    onGenerateScript: () => void;
    isScriptGenerating: boolean;
    speedMode: boolean;
    onSpeedModeChange: (value: boolean) => void;
}

export function GeneratorPanel({
    activeProject,
    scriptTemplates,
    scriptIdea,
    onScriptIdeaChange,
    scriptFormat,
    onScriptFormatChange,
    scriptStyle,
    onScriptStyleChange,
    scriptOutput,
    onGenerateScript,
    isScriptGenerating,
    speedMode,
    onSpeedModeChange,
}: GeneratorPanelProps) {
    const [showOutput, setShowOutput] = useState(false);
    const outputRef = useRef<HTMLDivElement>(null);
    const outputVisible = showOutput || isScriptGenerating || Boolean(scriptOutput);

    useEffect(() => {
        if (outputRef.current) {
            outputRef.current.scrollTop = outputRef.current.scrollHeight;
        }
    }, [scriptOutput]);

    if (!activeProject) {
        return <div className="p-6 text-[10px] text-text-tertiary font-bold uppercase tracking-widest text-center">Select project to initiate.</div>;
    }

    return (
        <Stack gap={4} className="p-4">
            <Card className="p-5 bg-surface-elevated border-border-subtle shadow-xl flex flex-col gap-5">
                <Stack direction="horizontal" gap={2} align="center" className="text-accent">
                    {isScriptGenerating ? (
                        <Loader2 size={16} className="animate-spin" />
                    ) : (
                        <Sparkles size={16} />
                    )}
                    <span className="text-[10px] font-black uppercase tracking-[0.2em]">Inference Core</span>
                </Stack>

                <Stack gap={4}>
                    <Textarea
                        label="Story Idea / Prompt"
                        value={scriptIdea}
                        onChange={(e) => onScriptIdeaChange(e.target.value)}
                        placeholder="Describe the scene context..."
                        size="sm"
                        rows={5}
                    />

                    <Grid cols={1} gap={4}>
                        <Select 
                            label="Project Format"
                            value={scriptFormat} 
                            onChange={(value) => onScriptFormatChange(value)}
                            size="sm"
                            options={(scriptTemplates?.formats || []).map(f => ({ value: f.id, label: f.name }))}
                            placeholder="Select Format"
                        />
                        <Select 
                            label="Creative Style"
                            value={scriptStyle} 
                            onChange={(value) => onScriptStyleChange(value)}
                            size="sm"
                            options={(scriptTemplates?.styles || []).map(s => ({ value: s.id, label: s.name }))}
                            placeholder="Select Style"
                        />
                    </Grid>
                </Stack>

                <div className="bg-subtle-2 border border-border-subtle rounded-xl flex items-center justify-between p-3">
                    <Stack direction="horizontal" gap={3} align="center">
                        <div className={`p-2 rounded-lg transition-colors ${speedMode ? 'bg-accent text-black' : 'bg-subtle-3 text-muted'}`}>
                            <Sparkles size={14} />
                        </div>
                        <div>
                            <div className="text-[11px] font-black uppercase tracking-tight text-heading">Lightning Mode</div>
                            <div className="text-[9px] font-bold text-text-tertiary uppercase tracking-widest mt-0.5">Bypass RAG Layers</div>
                        </div>
                    </Stack>
                    <button 
                        onClick={() => onSpeedModeChange(!speedMode)}
                        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-all duration-200 focus-ring ${speedMode ? 'bg-accent' : 'bg-subtle-3'}`}
                    >
                        <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${speedMode ? 'translate-x-4' : 'translate-x-0'}`} />
                    </button>
                </div>

                <Button
                    variant="primary"
                    className="w-full text-[10px] font-black uppercase tracking-widest h-10"
                    onClick={() => {
                        setShowOutput(true);
                        onGenerateScript();
                    }}
                    disabled={isScriptGenerating || !scriptIdea.trim()}
                >
                    {isScriptGenerating ? 'Processing...' : 'Execute Generation'}
                </Button>
            </Card>

            <AnimatePresence>
                {outputVisible && (
                    <motion.div
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 12 }}
                    >
                        <Card className="p-4 bg-surface-elevated border-border-subtle shadow-xl flex flex-col gap-4">
                            <div className="flex justify-between items-center px-1">
                                <span className="text-[9px] font-black text-muted uppercase tracking-[0.2em]">Output Stream</span>
                                {scriptOutput && (
                                    <Button variant="ghost" size="sm" className="text-[9px] font-black uppercase" onClick={() => navigator.clipboard.writeText(scriptOutput)} leftIcon={<Copy size={10} />}>
                                        Copy
                                    </Button>
                                )}
                            </div>
                            <div
                                ref={outputRef}
                                className="text-[11px] font-mono leading-relaxed whitespace-pre-wrap max-h-[300px] overflow-y-auto text-secondary p-4 rounded-xl bg-subtle-1 border border-border-subtle scrollbar-hide"
                            >
                                {scriptOutput}
                                {isScriptGenerating && (
                                    <span className="inline-block w-1.5 h-4 ml-1 bg-accent animate-pulse align-middle" />
                                )}
                                {!scriptOutput && !isScriptGenerating && (
                                    <span className="text-text-tertiary italic opacity-50">Awaiting stream...</span>
                                )}
                            </div>
                        </Card>
                    </motion.div>
                )}
            </AnimatePresence>
        </Stack>
    );
}
