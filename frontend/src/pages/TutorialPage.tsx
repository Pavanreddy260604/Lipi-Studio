import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  GraduationCap,
  Sparkles,
  Brain,
  Zap,
  ShieldAlert,
  Keyboard,
  ArrowRight,
  BookOpen,
  MousePointerClick,
  CheckCircle2,
  FileText
} from 'lucide-react';

interface TutorialTab {
  id: string;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  title: string;
  subtitle: string;
  accent: string;
}

const TUTORIAL_TABS: TutorialTab[] = [
  {
    id: 'start',
    label: 'Getting Started',
    icon: BookOpen,
    title: 'Welcome to Lipi Studio',
    subtitle: 'Learn the core interface and how to draft your first screenplay project statefully.',
    accent: 'var(--accent)'
  },
  {
    id: 'rag',
    label: 'Story Bible & RAG',
    icon: Brain,
    title: 'The AI Story Bible & RAG',
    subtitle: 'Learn how Retrieval-Augmented Generation automatically injects character lore and world rules into LLM contexts.',
    accent: '#3b82f6'
  },
  {
    id: 'assistant',
    label: 'AI Assistant',
    icon: Sparkles,
    title: 'Co-Pilot & Scene Generator',
    subtitle: 'Master the scene generator, dialouge voice aligner, and standard inline prompts.',
    accent: '#8b5cf6'
  },
  {
    id: 'critique',
    label: 'Style & Continuity',
    icon: ShieldAlert,
    title: 'Stateful Continuity Auditor',
    subtitle: 'Discover how the system statefully audits WGA script layouts and flags narrative anomalies in real time.',
    accent: '#f43f5e'
  },
  {
    id: 'shortcuts',
    label: 'Shortcuts',
    icon: Keyboard,
    title: 'Pro Keyboard Shortcuts',
    subtitle: 'Fly through the editor with zero mouse clicks. Command list optimized for speed.',
    accent: '#10b981'
  }
];

export function TutorialPage() {
  const [activeTab, setActiveTab] = useState('start');
  const [completedSteps, setCompletedSteps] = useState<string[]>([]);

  const toggleStep = (stepId: string) => {
    setCompletedSteps(prev =>
      prev.includes(stepId) ? prev.filter(id => id !== stepId) : [...prev, stepId]
    );
  };

  const activeTabInfo = TUTORIAL_TABS.find(t => t.id === activeTab) || TUTORIAL_TABS[0];

  return (
    <div
      className="min-h-screen font-sans pb-12"
      style={{
        background: 'var(--surface-page)',
        color: 'var(--text-primary)',
        transition: 'background-color 0.2s, color 0.2s'
      }}
    >
      {/* Header Panel */}
      <header
        className="px-6 py-5 flex items-center justify-between border-b"
        style={{
          borderColor: 'var(--border-subtle)',
          background: 'var(--surface-sidebar)'
        }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
          >
            <GraduationCap size={18} />
          </div>
          <div>
            <h1 className="text-xs font-black uppercase tracking-[0.25em] flex items-center gap-2">
              Lipi Studio Academy <span className="text-[10px]" style={{ color: 'var(--accent)' }}>//</span> Interactive Guide
            </h1>
            <p className="text-[10px] text-text-tertiary font-mono">MASTER THE FUTURE OF STATEFUL AI SCREENWRITING</p>
          </div>
        </div>
        <div className="text-[10px] font-mono tracking-widest text-text-tertiary uppercase bg-subtle-8 px-2.5 py-1 rounded-lg">
          Academy V1.0
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 mt-8">
        {/* Navigation Tabs Grid */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2.5 mb-8">
          {TUTORIAL_TABS.map((tab) => {
            const isActive = tab.id === activeTab;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="flex flex-col items-start p-4 rounded-2xl border text-left transition-all duration-200 active:scale-[0.98] focus-ring relative overflow-hidden group"
                style={{
                  background: isActive ? 'var(--surface-elevated)' : 'var(--surface-sidebar)',
                  borderColor: isActive ? tab.accent : 'var(--border-subtle)',
                  boxShadow: isActive ? 'var(--shadow-md)' : 'none'
                }}
              >
                {isActive && (
                  <motion.div
                    className="absolute top-0 left-0 right-0 h-1"
                    style={{ background: tab.accent }}
                    layoutId="tabGlowLine"
                  />
                )}
                <div
                  className="p-2 rounded-xl mb-3 transition-colors duration-200"
                  style={{
                    background: isActive ? `${tab.accent}15` : 'var(--surface-page)',
                    color: isActive ? tab.accent : 'var(--text-tertiary)'
                  }}
                >
                  <tab.icon size={20} />
                </div>
                <span className="text-[11px] font-black uppercase tracking-wider block text-text-secondary group-hover:text-text-heading">
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>

        {/* Dynamic Detail Body */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          
          {/* Main Content Area */}
          <div className="lg:col-span-2 flex flex-col gap-6">
            <div
              className="p-8 rounded-3xl border flex flex-col gap-3 relative overflow-hidden"
              style={{
                borderColor: 'var(--border-subtle)',
                background: 'var(--surface-elevated)'
              }}
            >
              <div className="absolute top-0 right-0 w-[300px] h-[300px] rounded-full blur-[150px] opacity-10 pointer-events-none" style={{ background: activeTabInfo.accent }} />
              
              <span className="text-[9px] font-black uppercase tracking-[0.25em]" style={{ color: activeTabInfo.accent }}>
                MODULE {TUTORIAL_TABS.findIndex(t => t.id === activeTab) + 1} OF {TUTORIAL_TABS.length}
              </span>
              <h2 className="text-2xl font-bold tracking-tight">{activeTabInfo.title}</h2>
              <p className="text-sm leading-relaxed text-text-secondary font-medium">
                {activeTabInfo.subtitle}
              </p>
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.2 }}
                className="flex flex-col gap-6"
              >
                {/* Getting Started Content */}
                {activeTab === 'start' && (
                  <div className="flex flex-col gap-4">
                    <div className="p-6 rounded-3xl border flex flex-col gap-3" style={{ borderColor: 'var(--border-subtle)', background: 'var(--surface-elevated)' }}>
                      <h3 className="text-sm font-bold flex items-center gap-2">
                        <span className="flex-center w-5 h-5 rounded-md text-[10px] font-bold" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>1</span>
                        Project Creation & Workspace
                      </h3>
                      <p className="text-xs text-text-secondary leading-relaxed">
                        To write, click <strong>Create Bible</strong> in the Project Dashboard. Lipi Studio uses a &quot;Story Bible&quot; approach: character profiles, magic systems, rules, and notes are indexed statefully so your writing remains aligned to your lore.
                      </p>
                    </div>

                    <div className="p-6 rounded-3xl border flex flex-col gap-3" style={{ borderColor: 'var(--border-subtle)', background: 'var(--surface-elevated)' }}>
                      <h3 className="text-sm font-bold flex items-center gap-2">
                        <span className="flex-center w-5 h-5 rounded-md text-[10px] font-bold" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>2</span>
                        Screenplay Editor & Auto-Save
                      </h3>
                      <p className="text-xs text-text-secondary leading-relaxed">
                        The center space is a Monaco editor, fully WGA-formatted. You don&apos;t have to worry about manual saving: **every single keystroke is backed up instantly** to `localStorage` and continuously synced to our secure server in the background. Switch scenes freely without confirmation popups.
                      </p>
                    </div>

                    <div className="p-6 rounded-3xl border flex flex-col gap-3" style={{ borderColor: 'var(--border-subtle)', background: 'var(--surface-elevated)' }}>
                      <h3 className="text-sm font-bold flex items-center gap-2">
                        <span className="flex-center w-5 h-5 rounded-md text-[10px] font-bold" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>3</span>
                        The Left Structure Panel & Beat Board
                      </h3>
                      <p className="text-xs text-text-secondary leading-relaxed">
                        Drag-and-drop scenes in the left panel to re-order your acts cleanly. Slide up the bottom **Beat Board** to map act beats. This allows you to plan your script linearly while your AI tools analyze beats statefully.
                      </p>
                    </div>
                  </div>
                )}

                {/* RAG & Story Bible Content */}
                {activeTab === 'rag' && (
                  <div className="flex flex-col gap-4">
                    <div className="p-6 rounded-3xl border flex flex-col gap-3" style={{ borderColor: 'var(--border-subtle)', background: 'var(--surface-elevated)' }}>
                      <h3 className="text-sm font-bold flex items-center gap-2" style={{ color: '#3b82f6' }}>
                        <Brain size={16} />
                        How does RAG work in Lipi Studio?
                      </h3>
                      <p className="text-xs text-text-secondary leading-relaxed">
                        Standard AIs forget details or hallucinate character facts. Lipi Studio uses **Retrieval-Augmented Generation (RAG)**. When you run prompts or edit dialogue, the system scans your Story Bible, converts character bios and lore cards into vectors using Voyage AI, and fetches only the relevant facts to feed into Google Gemini in real time.
                      </p>
                    </div>

                    <div className="p-6 rounded-3xl border flex flex-col gap-3" style={{ borderColor: 'var(--border-subtle)', background: 'var(--surface-elevated)' }}>
                      <h3 className="text-sm font-bold">Creating Dense Lore Nodes</h3>
                      <p className="text-xs text-text-secondary leading-relaxed">
                        To get the best out of RAG, populate your **Project Bible** with highly detailed character sheets, item properties, or places. Instead of massive prompts, the RAG engine will intelligently select the right sheets on the fly depending on who is speaking or which scene is active.
                      </p>
                    </div>
                  </div>
                )}

                {/* AI Assistant Content */}
                {activeTab === 'assistant' && (
                  <div className="flex flex-col gap-4">
                    <div className="p-6 rounded-3xl border flex flex-col gap-3" style={{ borderColor: 'var(--border-subtle)', background: 'var(--surface-elevated)' }}>
                      <h3 className="text-sm font-bold flex items-center gap-2" style={{ color: '#8b5cf6' }}>
                        <Sparkles size={16} />
                        The Right Assistant Panel
                      </h3>
                      <p className="text-xs text-text-secondary leading-relaxed">
                        The assistant panel is your command center. You can chat with your Bible directly, trigger real-time script proposals, or ask Gemini to write dialogue that aligns to character speaking styles using **In-Context Aligned Feedback Loops**.
                      </p>
                    </div>

                    <div className="p-6 rounded-3xl border flex flex-col gap-3" style={{ borderColor: 'var(--border-subtle)', background: 'var(--surface-elevated)' }}>
                      <h3 className="text-sm font-bold">Generating & Dialogue Fixes</h3>
                      <p className="text-xs text-text-secondary leading-relaxed">
                        Click **Generate** in the top bar to draft content based on active act beats. Use the inline command tool to rewrite specific passages. If dialogue sounds out of character, select it and request an assisted alignment edit!
                      </p>
                    </div>
                  </div>
                )}

                {/* Style & Continuity Auditor Content */}
                {activeTab === 'critique' && (
                  <div className="flex flex-col gap-4">
                    <div className="p-6 rounded-3xl border flex flex-col gap-3" style={{ borderColor: 'var(--border-subtle)', background: 'var(--surface-elevated)' }}>
                      <h3 className="text-sm font-bold flex items-center gap-2" style={{ color: '#f43f5e' }}>
                        <ShieldAlert size={16} />
                        Continuous Screenplay Validation
                      </h3>
                      <p className="text-xs text-text-secondary leading-relaxed">
                        Our stateful **Continuity Auditor** monitors WGA margin styles, action cues, and character states. Click **Critique** in the top bar to trigger a complete structural analysis.
                      </p>
                    </div>

                    <div className="p-6 rounded-3xl border flex flex-col gap-3" style={{ borderColor: 'var(--border-subtle)', background: 'var(--surface-elevated)' }}>
                      <h3 className="text-sm font-bold">Continuous State Drift Check</h3>
                      <p className="text-xs text-text-secondary leading-relaxed">
                        The auditor tracks character states (e.g. Alive vs. Dead). If a character is marked as **Dead** in your character database, but they perform physical actions (e.g. <em>&quot;Sarah walks into the room&quot;</em>), the auditor immediately flags this high-severity continuity violation!
                      </p>
                    </div>
                  </div>
                )}

                {/* Shortcuts Content */}
                {activeTab === 'shortcuts' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-6 rounded-3xl border flex flex-col gap-3" style={{ borderColor: 'var(--border-subtle)', background: 'var(--surface-elevated)' }}>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-text-tertiary">Standard Editor Actions</h4>
                      <div className="flex flex-col gap-2 font-mono text-xs">
                        <div className="flex justify-between border-b border-subtle-8 py-1.5">
                          <span>Focus Search</span>
                          <span className="bg-subtle-10 px-2 py-0.5 rounded text-accent">Ctrl + K</span>
                        </div>
                        <div className="flex justify-between border-b border-subtle-8 py-1.5">
                          <span>Inline AI Command</span>
                          <span className="bg-subtle-10 px-2 py-0.5 rounded text-accent">Ctrl + Space</span>
                        </div>
                        <div className="flex justify-between border-b border-subtle-8 py-1.5">
                          <span>Format Script Line</span>
                          <span className="bg-subtle-10 px-2 py-0.5 rounded text-accent">Tab</span>
                        </div>
                      </div>
                    </div>

                    <div className="p-6 rounded-3xl border flex flex-col gap-3" style={{ borderColor: 'var(--border-subtle)', background: 'var(--surface-elevated)' }}>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-text-tertiary">Quick Panel Toggles</h4>
                      <div className="flex flex-col gap-2 font-mono text-xs">
                        <div className="flex justify-between border-b border-subtle-8 py-1.5">
                          <span>Toggle Left Panel</span>
                          <span className="bg-subtle-10 px-2 py-0.5 rounded text-accent">Ctrl + [</span>
                        </div>
                        <div className="flex justify-between border-b border-subtle-8 py-1.5">
                          <span>Toggle Right Panel</span>
                          <span className="bg-subtle-10 px-2 py-0.5 rounded text-accent">Ctrl + ]</span>
                        </div>
                        <div className="flex justify-between border-b border-subtle-8 py-1.5">
                          <span>Toggle Beat Board</span>
                          <span className="bg-subtle-10 px-2 py-0.5 rounded text-accent">Ctrl + B</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Interactive Sidebar Checklist */}
          <div className="flex flex-col gap-6">
            <div
              className="p-6 rounded-3xl border flex flex-col gap-4"
              style={{
                borderColor: 'var(--border-subtle)',
                background: 'var(--surface-sidebar)'
              }}
            >
              <div className="flex flex-col gap-1">
                <span className="text-[9px] font-black uppercase tracking-[0.25em]" style={{ color: activeTabInfo.accent }}>
                  ACADEMY CHECKLIST
                </span>
                <h3 className="text-lg font-bold">Interactive Tour Tasks</h3>
                <p className="text-xs text-text-tertiary leading-relaxed">
                  Mark off tasks as you learn to complete your Lipi Studio training!
                </p>
              </div>

              <div className="w-full h-px bg-subtle-8" />

              <div className="flex flex-col gap-3">
                {[
                  { id: 'create', label: 'Create a Project Story Bible', desc: 'Set up a new screenplay repository' },
                  { id: 'lore', label: 'Define 2 Character Lore Cards', desc: 'Add status and voice profiles' },
                  { id: 'write', label: 'Write 100 words in Monaco', desc: 'Watch background auto-save sync' },
                  { id: 'gen', label: 'Trigger AI Dialogue Alignment', desc: 'Stream Gemini script dialogue edits' },
                  { id: 'scan', label: 'Run Continuity Critique Scan', desc: 'Check WGA formats and state drifts' }
                ].map((task) => {
                  const isDone = completedSteps.includes(task.id);
                  return (
                    <button
                      key={task.id}
                      onClick={() => toggleStep(task.id)}
                      className="flex items-start gap-3 w-full text-left p-2.5 rounded-xl transition-all duration-150 hover:bg-subtle-8 active:scale-[0.98] focus-ring group"
                    >
                      <div className="mt-0.5 shrink-0">
                        {isDone ? (
                          <CheckCircle2 size={16} className="text-accent" />
                        ) : (
                          <div className="w-4 h-4 rounded-md border border-subtle-20 group-hover:border-accent transition-colors" />
                        )}
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span
                          className="text-xs font-semibold leading-none mb-1 transition-all"
                          style={{
                            textDecoration: isDone ? 'line-through' : 'none',
                            color: isDone ? 'var(--text-tertiary)' : 'var(--text-primary)'
                          }}
                        >
                          {task.label}
                        </span>
                        <span className="text-[10px] text-text-tertiary truncate">
                          {task.desc}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="w-full h-px bg-subtle-8" />

              {/* Progress Tracker */}
              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between items-center text-[10px] font-bold">
                  <span className="text-text-tertiary uppercase tracking-wider">Progress</span>
                  <span style={{ color: activeTabInfo.accent }}>
                    {Math.round((completedSteps.length / 5) * 100)}% Complete
                  </span>
                </div>
                <div className="w-full h-1.5 bg-subtle-8 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: activeTabInfo.accent }}
                    initial={{ width: 0 }}
                    animate={{ width: `${(completedSteps.length / 5) * 100}%` }}
                    transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                  />
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
