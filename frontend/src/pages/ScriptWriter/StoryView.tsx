import { Brain, Sparkles, Save, Wand2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button, Input, Textarea, Select, Stack, Card, Grid, Section } from '../../components/ui';
import type { Bible } from '../../services/project.api';
import type { Act, Treatment } from '../../services/treatment.api';

interface StoryViewProps {
    activeProject: Bible | null;
    treatments: Treatment[];
    treatmentPreview: Act[] | null;
    treatmentLogline: string;
    treatmentStyle: string;
    onTreatmentLoglineChange: (value: string) => void;
    onTreatmentStyleChange: (value: string) => void;
    onGenerateTreatment: () => void;
    onSaveTreatment: () => void;
    onConvertTreatment: (id: string) => void;
    treatmentLoading: boolean;
}

export function StoryView({
    activeProject,
    treatments,
    treatmentPreview,
    treatmentLogline,
    treatmentStyle,
    onTreatmentLoglineChange,
    onTreatmentStyleChange,
    onGenerateTreatment,
    onSaveTreatment,
    onConvertTreatment,
    treatmentLoading
}: StoryViewProps) {
    if (!activeProject) {
        return (
            <Stack align="center" justify="center" className="h-full gap-6 animate-fade-in">
                <div className="bg-subtle-2 border border-border-subtle rounded-3xl p-8 shadow-inner">
                    <Brain size={64} strokeWidth={1} className="text-text-tertiary opacity-30" />
                </div>
                <div className="text-center">
                    <h2 className="text-xl font-black text-heading uppercase tracking-widest">Story Architecture</h2>
                    <p className="text-sm text-text-tertiary mt-2">Select a project to begin structural planning.</p>
                </div>
            </Stack>
        );
    }

    return (
        <div className="p-8 h-full overflow-y-auto scrollbar-hide">
            <Stack gap={8} className="w-full max-w-[1440px] mx-auto pb-20 transition-all duration-300 px-4 md:px-8 xl:px-12">
                <Card className="p-8 bg-surface-elevated border-border-subtle shadow-xl animate-fade-in">
                    <Stack gap={6}>
                        <div>
                            <h2 className="text-2xl font-black text-heading uppercase tracking-tighter">Treatment Blueprint</h2>
                            <p className="text-sm text-text-tertiary mt-1">Orchestrate high-level story beats using professional frameworks.</p>
                        </div>

                        <Stack gap={4}>
                            <Textarea
                                label="Logline / Story Concept"
                                value={treatmentLogline}
                                onChange={(e) => onTreatmentLoglineChange(e.target.value)}
                                placeholder="Describe the core story arc..."
                                rows={4}
                            />

                            <Select
                                label="Story Framework"
                                value={treatmentStyle}
                                onChange={(value) => onTreatmentStyleChange(value)}
                                options={[
                                    { value: 'save_the_cat', label: 'Save The Cat' },
                                    { value: 'heros_journey', label: "Hero's Journey" },
                                    { value: 'three_act', label: 'Three Act Structure' },
                                    { value: 'tv_beat_sheet', label: 'TV Beat Sheet' },
                                    { value: 'five_act', label: 'Five Act Structure' },
                                    { value: 'story_circle', label: 'Story Circle (Harmon)' },
                                    { value: 'sequence_approach', label: '8-Sequence Approach' },
                                    { value: 'indian_commercial', label: 'Indian Commercial Cinema' },
                                    { value: 'fictional_pulse', label: 'Fictional Pulse (Action)' },
                                ]}
                            />
                        </Stack>

                        <div className="flex gap-3 pt-2">
                            <Button
                                variant="primary"
                                className="flex-1 h-12 text-sm font-black uppercase tracking-widest"
                                onClick={onGenerateTreatment}
                                disabled={treatmentLoading || !treatmentLogline.trim()}
                                leftIcon={<Sparkles size={18} />}
                            >
                                {treatmentLoading ? 'GENERATING...' : 'GENERATE TREATMENT'}
                            </Button>
                            <Button
                                variant="secondary"
                                className="flex-1 h-12 text-sm font-black uppercase tracking-widest"
                                onClick={onSaveTreatment}
                                disabled={!treatmentPreview || treatmentLoading}
                                leftIcon={<Save size={18} />}
                            >
                                SAVE BLUEPRINT
                            </Button>
                        </div>
                    </Stack>
                </Card>

                {treatmentPreview && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                    >
                        <Stack gap={4}>
                            <h3 className="text-sm font-black uppercase tracking-[0.3em] text-muted px-2">Generated Structure</h3>
                            <Grid cols={3} gap={4}>
                                {treatmentPreview.map((act, index) => (
                                    <Card key={index} className="p-5 bg-surface-elevated border-border-subtle hover:border-accent/30 transition-all">
                                        <Stack gap={4}>
                                            <div className="text-xs font-black uppercase tracking-widest text-accent border-b border-border-subtle pb-2">{act.name}</div>
                                            <ul className="flex flex-col gap-4">
                                                {act.beats.map((beat, beatIndex) => (
                                                    <li key={beatIndex} className="flex flex-col gap-1">
                                                        <span className="text-[11px] font-black text-heading uppercase tracking-tight">{beat.name}</span>
                                                        <span className="text-[10px] leading-relaxed text-text-tertiary">{beat.description}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </Stack>
                                    </Card>
                                ))}
                            </Grid>
                        </Stack>
                    </motion.div>
                )}

                {treatments.length > 0 && (
                    <Stack gap={4}>
                        <h3 className="text-sm font-black uppercase tracking-[0.3em] text-muted px-2">Saved Treatments</h3>
                        <Grid cols={2} gap={4}>
                            {treatments.map((treatment) => (
                                <Card key={treatment._id} className="p-4 bg-subtle-2 border-border-subtle flex items-center justify-between">
                                    <Stack gap={1} className="min-w-0">
                                        <div className="text-sm font-bold text-heading truncate">{treatment.logline || 'Untitled'}</div>
                                        <div className="text-[9px] font-black uppercase tracking-widest text-text-tertiary">
                                            {treatment.acts.length} acts &bull; {treatment.style}
                                        </div>
                                    </Stack>
                                    <Button
                                        variant="secondary"
                                        size="sm"
                                        className="text-[10px] font-black uppercase tracking-widest border-accent/20 text-accent hover:bg-accent/5"
                                        onClick={() => onConvertTreatment(treatment._id)}
                                        disabled={treatmentLoading}
                                        leftIcon={<Wand2 size={14} />}
                                    >
                                        Convert
                                    </Button>
                                </Card>
                            ))}
                        </Grid>
                    </Stack>
                )}
            </Stack>
        </div>
    );
}
