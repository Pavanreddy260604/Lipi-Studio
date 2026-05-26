import { useEffect, useMemo, useRef, useState, forwardRef, useImperativeHandle, memo } from 'react';
import { ListTree, Loader2, Sparkles, AlertCircle, CheckCircle2, PenTool, Shield, Brain } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAutoResize } from '../../hooks/useAutoResize';
import { AIAssistantOverlay } from '../../components/script/AIAssistantOverlay';
import { useScriptWriter } from '../../contexts/ScriptWriterContext';
import { MODE_CONFIG, ENTER_TRANSITIONS, TAB_TRANSITIONS, MODE_SHORTCUT, type ScreenplayMode } from './constants';
import type { Bible, IScene as Scene } from '../../services/project.api';
import type { EditorSelection, SaveState } from './types';
import '../../studio.css';
import { debounce } from '../../lib/utils';

interface StudioEditorProps {
  activeProject: Bible | null;
  activeScene: Scene | null;
  editorContent: string;
  editorSelection: EditorSelection | null;
  onContentChange: (value: string) => void;
  onSelectionChange: (selection: EditorSelection | null) => void;
  saveState?: SaveState;
  onSave?: () => void;
  wordCount: number;
  sceneCount: number;
  characterCount: number;
  isGenerating?: boolean;
  generationProgress?: number;
  isCritiquing?: boolean;
  onFocus?: () => void;
  onBlur?: () => void;
  isLoading?: boolean;
  onRetrySave?: () => void;
  isAiThinking?: boolean;
  aiStatus?: string;
  aiProgress?: number;
  onAiCommand?: (command: string, prompt: string) => void;
}

export interface StudioEditorHandle {
  applyMode: (mode: ScreenplayMode, lang?: string) => void;
}

function formatLine(line: string, mode: ScreenplayMode, lang?: string) {
  // Strip any pre-existing language tag from the start of the line (e.g. [[lang:te]])
  const clean = line.trimStart().replace(/^\[\[lang:[a-z]{2}\]\]/i, '').trimStart();
  const transformed = MODE_CONFIG[mode].uppercase ? clean.toUpperCase() : clean;
  const langTag = lang ? `[[lang:${lang}]]` : '';
  return `${' '.repeat(MODE_CONFIG[mode].indent)}${langTag}${transformed}`;
}

function estimatePages(content: string) {
  const lines = content.split('\n').length;
  return Math.max(1, Math.ceil(lines / 55));
}

function getCurrentLineRange(source: string, cursor: number) {
  const lineStart = source.lastIndexOf('\n', Math.max(0, cursor - 1)) + 1;
  const lineEndRaw = source.indexOf('\n', cursor);
  const lineEnd = lineEndRaw === -1 ? source.length : lineEndRaw;
  return { lineStart, lineEnd };
}

function detectModeAtCursor(source: string, cursor: number): ScreenplayMode {
  const { lineStart, lineEnd } = getCurrentLineRange(source, cursor);
  const line = source.slice(lineStart, lineEnd);
  const trimmed = line.trimStart();
  
  if (!trimmed) return 'action';
  
  const indent = line.length - trimmed.length;

  if (/^(INT\.|EXT\.|INT\/EXT\.|EXT\/INT\.|EST\.)/i.test(trimmed)) return 'slug';
  if (/TO:$/i.test(trimmed)) return 'transition';
  if (/^\(.*\)$/.test(trimmed)) return 'parenthetical';

  if (indent >= 35) return 'transition';
  if (indent >= 20) return 'character';
  if (indent >= 14) return 'parenthetical';
  if (indent >= 8) return 'dialogue';
  
  return 'action';
}

function collectSmartTypeEntries(source: string) {
  const scene = new Set<string>();
  const chars = new Set<string>();
  const transitions = new Set<string>();

  source.split('\n').forEach((line) => {
    let trimmed = line.trim();
    if (!trimmed) return;

    // Strip language tag prior to validation (e.g. [[lang:hi]])
    trimmed = trimmed.replace(/^\[\[lang:[a-z]{2}\]\]/i, '').trim();
    if (!trimmed) return;

    if (/^(INT\.|EXT\.|INT\/EXT\.|EXT\/INT\.|EST\.)/i.test(trimmed)) {
      scene.add(trimmed.toUpperCase());
    }

    if (/TO:$/.test(trimmed.toUpperCase())) {
      transitions.add(trimmed.toUpperCase());
    }

    if (/^[A-Z0-9 .,'()\-]{2,36}$/.test(trimmed) && !trimmed.includes(':') && !trimmed.startsWith('(')) {
      chars.add(trimmed.toUpperCase());
    }
  });

  return { scene, chars, transitions };
}

const StudioEditorInner = forwardRef<StudioEditorHandle, StudioEditorProps>(({
  activeScene,
  editorContent,
  editorSelection,
  onContentChange,
  onSelectionChange,
  saveState,
  onSave,
  wordCount,
  isGenerating = false,
  generationProgress = 0,
  isCritiquing = false,
  onFocus,
  onBlur,
  isLoading = false,
  isAiThinking = false,
  aiStatus = '',
  aiProgress = 0,
  onAiCommand,
}, ref) => {
  const { uiState, setScreenplayMode, setRightPanelTool } = useScriptWriter();
  const [localVal, setLocalVal] = useState(editorContent);
  const lastSentValueRef = useRef(editorContent);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced parent content change update
  const onContentChangeDebounced = (val: string) => {
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    typingTimeoutRef.current = setTimeout(() => {
      lastSentValueRef.current = val;
      onContentChange(val);
    }, 150);
  };

  // Sync with parent state changes only (external updates like AI or scene change)
  useEffect(() => {
    if (editorContent !== lastSentValueRef.current) {
      setLocalVal(editorContent);
      lastSentValueRef.current = editorContent;
    }
  }, [editorContent]);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);
  const mode = uiState.screenplayMode;
  const lineLanguage = uiState.lineLanguage;

  const [smartTypeOpen, setSmartTypeOpen] = useState(false);
  const [aiAssistantOpen, setAiAssistantOpen] = useState(false);
  const [critiqueStep, setCritiqueStep] = useState(0);

  useEffect(() => {
    if (!isCritiquing) {
      setCritiqueStep(0);
      return;
    }
    const interval = setInterval(() => {
      setCritiqueStep(prev => (prev < 3 ? prev + 1 : prev));
    }, 1800);
    return () => clearInterval(interval);
  }, [isCritiquing]);

  const getGenerationStep = (progress: number) => {
    if (progress < 25) return 'Analyzing show bible lore & outlining beats...';
    if (progress < 50) return 'Establishing sluglines & backdrop context...';
    if (progress < 75) return 'Drafting dialogue rhythms & parentheticals...';
    if (progress < 95) return 'Injecting subtext & formatting rules...';
    return 'Polishing scene beats & finalizing formatting...';
  };
  const [smartTypeOptions, setSmartTypeOptions] = useState<string[]>([]);
  const [smartTypeIndex, setSmartTypeIndex] = useState(0);
  const bodyRef = useRef<HTMLDivElement>(null);
  const textareaRef = useAutoResize(localVal);

  const smartTypeEntries = useMemo(() => collectSmartTypeEntries(localVal), [localVal]);

  const syncSelection = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const { selectionStart, selectionEnd, value } = textarea;
    if (selectionStart === selectionEnd) {
      onSelectionChange(null);
      return;
    }

    const selectedText = value.slice(selectionStart, selectionEnd);
    if (!selectedText.trim()) {
      onSelectionChange(null);
      return;
    }

    const beforeSelection = value.slice(0, selectionStart);
    const selectedLines = selectedText.split('\n');
    const lineStart = beforeSelection.split('\n').length;
    const lineEnd = lineStart + selectedLines.length - 1;
    const preview = selectedText.replace(/\s+/g, ' ').trim().slice(0, 140);

    onSelectionChange({
      start: selectionStart,
      end: selectionEnd,
      text: selectedText,
      lineStart,
      lineEnd,
      lineCount: selectedLines.length,
      charCount: selectedText.length,
      preview,
    });
  };

  const applyModeToSelection = (targetMode: ScreenplayMode, langOverride?: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.focus();

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const source = textarea.value;
    const activeLang = langOverride !== undefined ? langOverride : lineLanguage;

    if (start === end) {
      const lineStart = source.lastIndexOf('\n', start - 1) + 1;
      const lineEndRaw = source.indexOf('\n', start);
      const lineEnd = lineEndRaw === -1 ? source.length : lineEndRaw;
      const line = source.slice(lineStart, lineEnd);
      if (!line.trim()) return;
      const formatted = formatLine(line, targetMode, activeLang);
      const next = `${source.slice(0, lineStart)}${formatted}${source.slice(lineEnd)}`;
      if (next === source) return;
      setLocalVal(next);
      lastSentValueRef.current = next;
      onContentChange(next);
      requestAnimationFrame(() => {
        textarea.focus();
        const nextCaret = lineStart + formatted.length;
        textarea.setSelectionRange(nextCaret, nextCaret);
      });
      return;
    }

    // Expand selection to full lines to prevent partial word or spacing corruption
    const expandedStart = source.lastIndexOf('\n', start - 1) + 1;
    const lineEndRaw = source.indexOf('\n', end);
    const expandedEnd = lineEndRaw === -1 ? source.length : lineEndRaw;

    const selected = source.slice(expandedStart, expandedEnd);
    if (!selected.trim()) return;
    const formatted = selected
      .split('\n')
      .map((line) => formatLine(line, targetMode, activeLang))
      .join('\n');

    const next = `${source.slice(0, expandedStart)}${formatted}${source.slice(expandedEnd)}`;
    if (next === source) return;
    setLocalVal(next);
    lastSentValueRef.current = next;
    onContentChange(next);
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(expandedStart, expandedStart + formatted.length);
      syncSelection();
    });
  };

  const applyModeRef = useRef(applyModeToSelection);
  applyModeRef.current = applyModeToSelection;

  useImperativeHandle(ref, () => ({
    applyMode: (mode: ScreenplayMode, lang?: string) => applyModeRef.current(mode, lang)
  }), []);

  const cycleMode = () => {
    const nextMode = TAB_TRANSITIONS[mode];
    setScreenplayMode(nextMode);
    applyModeToSelection(nextMode);
  };

  const updateSmartType = (source: string, cursor: number, modeOverride?: ScreenplayMode) => {
    const activeMode = modeOverride ?? mode;
    if (!['slug', 'character', 'transition'].includes(activeMode)) {
      setSmartTypeOpen(false);
      return;
    }

    const { lineStart, lineEnd } = getCurrentLineRange(source, cursor);
    const line = source.slice(lineStart, lineEnd).trimStart();
    if (!line.trim()) {
      setSmartTypeOpen(false);
      return;
    }

    const needle = line.toUpperCase();
    const sourceEntries = source === localVal ? smartTypeEntries : collectSmartTypeEntries(source);
    const bucket =
      activeMode === 'slug'
        ? sourceEntries.scene
        : activeMode === 'character'
          ? sourceEntries.chars
          : sourceEntries.transitions;

    const options = Array.from(bucket)
      .filter((entry) => entry.startsWith(needle) && entry !== needle)
      .slice(0, 6);

    if (options.length === 0) {
      setSmartTypeOpen(false);
      return;
    }

    setSmartTypeOptions(options);
    setSmartTypeIndex(0);
    setSmartTypeOpen(true);
  };

  const applySmartType = (value?: string) => {
    const textarea = textareaRef.current;
    if (!textarea || !smartTypeOpen) return;

    const source = textarea.value;
    const cursor = textarea.selectionStart;
    const { lineStart, lineEnd } = getCurrentLineRange(source, cursor);
    const selectedValue = value ?? smartTypeOptions[smartTypeIndex];
    if (!selectedValue) return;

    const formatted = formatLine(selectedValue, mode);
    const next = `${source.slice(0, lineStart)}${formatted}${source.slice(lineEnd)}`;
    setLocalVal(next);
    lastSentValueRef.current = next;
    onContentChange(next);
    setSmartTypeOpen(false);
    requestAnimationFrame(() => {
      const nextCaret = lineStart + formatted.length;
      textarea.setSelectionRange(nextCaret, nextCaret);
    });
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((event.ctrlKey || event.metaKey) && MODE_SHORTCUT[event.key]) {
      event.preventDefault();
      const shortcutMode = MODE_SHORTCUT[event.key];
      setScreenplayMode(shortcutMode);
      applyModeToSelection(shortcutMode);
      setSmartTypeOpen(false);
      return;
    }

    if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
      event.preventDefault();
      event.stopPropagation();
      setAiAssistantOpen(true);
      setRightPanelTool(null); // Also open the right sidebar AI tab!
      return;
    }

    if (smartTypeOpen) {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setSmartTypeIndex((prev) => (prev + 1) % smartTypeOptions.length);
        return;
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setSmartTypeIndex((prev) => (prev - 1 + smartTypeOptions.length) % smartTypeOptions.length);
        return;
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        setSmartTypeOpen(false);
        return;
      }
      if (event.key === 'Tab') {
        event.preventDefault();
        applySmartType();
        return;
      }
      if (event.key === 'Enter') {
        event.preventDefault();
        applySmartType();
        return;
      }
    }

    if (event.key === 'Tab') {
      event.preventDefault();
      cycleMode();
      return;
    }

    if (event.key === 'Enter') {
      const textarea = textareaRef.current;
      if (!textarea) return;

      event.preventDefault();
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const nextMode = event.shiftKey ? mode : ENTER_TRANSITIONS[mode];
      const prefix = ' '.repeat(MODE_CONFIG[nextMode].indent);
      const next = `${textarea.value.slice(0, start)}\n${prefix}${textarea.value.slice(end)}`;
      setLocalVal(next);
      lastSentValueRef.current = next;
      onContentChange(next);
      if (!event.shiftKey) setScreenplayMode(nextMode);
      setSmartTypeOpen(false);

      requestAnimationFrame(() => {
        const caret = start + 1 + prefix.length;
        textarea.setSelectionRange(caret, caret);
      });
    }
  };

  useEffect(() => {
    if (activeScene && textareaRef.current) {
      if (bodyRef.current) bodyRef.current.scrollTop = 0;
      textareaRef.current.focus();
    }
  }, [activeScene, textareaRef]);

  return (
    <div className="flex flex-col h-full overflow-hidden relative studio-desk">
      {/* Non-Blocking Floating Action UIs */}
      <AnimatePresence>
        {isGenerating && (
          <motion.div
            initial={{ opacity: 0, y: 15, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 15, scale: 0.96 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="absolute bottom-6 right-6 z-50 flex items-center gap-2.5 rounded-full border px-4 py-2 transition-all duration-300 shadow-lg animate-fade-in"
            style={{ 
              background: 'oklch(var(--accent) / 0.05)', 
              borderColor: 'oklch(var(--accent) / 0.15)',
            }}
          >
            <span className="relative flex h-1.5 w-1.5 flex-shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--accent)] opacity-75" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[var(--accent)]" />
            </span>
            <span className="text-[10px] font-bold text-accent uppercase tracking-[0.15em] leading-none">
              {aiStatus || getGenerationStep(generationProgress)}
            </span>
          </motion.div>
        )}

        {isCritiquing && (
          <motion.div
            initial={{ opacity: 0, y: 15, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 15, scale: 0.96 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="absolute bottom-6 right-6 z-50 flex items-center gap-2.5 rounded-full border px-4 py-2 transition-all duration-300 shadow-lg animate-fade-in"
            style={{ 
              background: 'oklch(var(--accent) / 0.05)', 
              borderColor: 'oklch(var(--accent) / 0.15)',
            }}
          >
            <span className="relative flex h-1.5 w-1.5 flex-shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--accent)] opacity-75" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[var(--accent)]" />
            </span>
            <span className="text-[10px] font-bold text-accent uppercase tracking-[0.15em] leading-none">
              {critiqueStep === 3 ? 'Finalizing scorecard...' : 'Analyzing script beats...'}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      <div ref={bodyRef} className="flex-1 min-h-0 overflow-y-auto scrollbar-hide">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-full gap-4">
            <Loader2 className="w-6 h-6 animate-spin text-accent/30" />
            <span className="text-xs font-bold uppercase tracking-wider text-white/40">Loading...</span>
          </div>
        ) : activeScene ? (
          <div className="relative py-8 px-4 min-h-full w-full flex flex-col items-center">
            <div className="script-page-stack">
              <div className="script-page">
                <textarea
                  ref={textareaRef}
                  className="script-textarea"
                  value={localVal}
                  onChange={(e) => {
                    const val = e.target.value;
                    setLocalVal(val);
                    onContentChangeDebounced(val);
                    updateSmartType(val, e.target.selectionStart);
                  }}
                  onSelect={syncSelection}
                  onKeyUp={(e) => {
                    syncSelection();
                    const target = e.currentTarget;
                    const newMode = detectModeAtCursor(target.value, target.selectionStart);
                    setScreenplayMode(newMode);
                    updateSmartType(target.value, target.selectionStart, newMode);
                  }}
                  onMouseUp={(e) => {
                    syncSelection();
                    const target = e.currentTarget;
                    setScreenplayMode(detectModeAtCursor(target.value, target.selectionStart));
                  }}
                  onKeyDown={handleKeyDown}
                  onFocus={onFocus}
                  onBlur={() => {
                    setSmartTypeOpen(false);
                    onSelectionChange(null);
                    onBlur?.();
                  }}
                  placeholder="BEGIN SEQUENCE..."
                  spellCheck={false}
                />
                <span className="script-page-number">1.</span>
              </div>
            </div>

            <AnimatePresence>
              {smartTypeOpen && smartTypeOptions.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: -4, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -4, scale: 0.97 }}
                  transition={{ duration: 0.15, ease: [0.23, 1, 0.32, 1] }}
                  className="absolute z-50 bg-white border border-stone-200 rounded-xl shadow-lg w-64"
                  style={{ fontFamily: 'var(--script-font, "Courier Prime", "Courier New", Courier, monospace)' }}
                >
                  <div className="text-[10px] font-medium text-stone-400 uppercase tracking-wider px-3 py-1.5 border-b border-stone-200 bg-stone-50">
                    Autocomplete
                  </div>
                  <div className="max-h-48 overflow-y-auto scrollbar-hide">
                    {smartTypeOptions.map((option, index) => (
                      <button
                        key={`${option}-${index}`}
                        type="button"
                        className={`w-full text-left px-3 py-1.5 text-xs tracking-wide uppercase border-b border-stone-100 last:border-0 transition-colors focus-ring ${
                          index === smartTypeIndex ? 'bg-stone-800 text-white' : 'text-stone-600 hover:bg-stone-100'
                        }`}
                        onMouseDown={(e) => {
                          e.preventDefault();
                        }}
                        onClick={() => {
                          applySmartType(option);
                        }}
                        onMouseEnter={() => setSmartTypeIndex(index)}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ) : (
          <div className="flex h-full items-center justify-center p-12">
            <div className="bg-neutral-900/90 border border-white/10 rounded-2xl max-w-xs w-full p-8 text-center flex flex-col gap-5 shadow-xl">
              <div className="flex justify-center">
                <div className="bg-white/5 border border-white/10 rounded-2xl p-3 shadow-sm text-accent">
                  <ListTree size={22} className="opacity-80" />
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <h3 className="text-sm font-semibold text-white">Select a Scene</h3>
                <p className="text-xs text-white/50 leading-relaxed">Choose a scene from the structure panel on the left to begin drafting your screenplay.</p>
              </div>
              <div className="pt-4 border-t border-white/10 grid grid-cols-2 gap-3">
                <div className="text-left">
                  <span className="block text-[10px] font-medium text-white/40 uppercase tracking-wide mb-1">Cycle Mode</span>
                  <kbd className="px-1.5 py-0.5 bg-white/5 border border-white/10 text-[10px] font-mono text-white/70 rounded-md">TAB</kbd>
                </div>
                <div className="text-left">
                  <span className="block text-[10px] font-medium text-white/40 uppercase tracking-wide mb-1">Assistant</span>
                  <kbd className="px-1.5 py-0.5 bg-white/5 border border-white/10 text-[10px] font-mono text-white/70 rounded-md">⌘K</kbd>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <AIAssistantOverlay
        isOpen={aiAssistantOpen}
        onClose={() => {
          setAiAssistantOpen(false);
          textareaRef.current?.focus();
        }}
        onCommand={(cmd, prompt) => {
          onAiCommand?.(cmd, prompt);
          setAiAssistantOpen(false);
          textareaRef.current?.focus();
        }}
        isThinking={isAiThinking}
        status={aiStatus}
        progress={aiProgress}
      />
    </div>
  );
});

export const StudioEditor = memo(StudioEditorInner);
