import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Command, ArrowRight, X, Brain, Wand2, MessageSquareText } from 'lucide-react';
import { cn } from '../../lib/utils';

interface AIAssistantOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  onCommand: (command: string, prompt: string) => void;
  anchorPosition?: { x: number; y: number };
  isThinking?: boolean;
  status?: string;
  progress?: number;
}

const SUGGESTIONS = [
  { id: 'expand', label: 'Enrich Scene', icon: Wand2, description: 'Deepen sensory detail and narrative texture' },
  { id: 'dialogue', label: 'Refine Dialogue', icon: MessageSquareText, description: 'Sharpen character voice and natural flow' },
  { id: 'action', label: 'Intensify Action', icon: Sparkles, description: 'Heighten the impact of physical sequences' },
  { id: 'rewrite', label: 'Custom Instruction', icon: Brain, description: 'Describe a specific shift in tone or content' },
];

const spring = { duration: 0.1, ease: 'easeOut' as const };

export function AIAssistantOverlay({ isOpen, onClose, onCommand, isThinking = false, status = '', progress = 0 }: AIAssistantOverlayProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [isOpen]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % SUGGESTIONS.length);
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + SUGGESTIONS.length) % SUGGESTIONS.length);
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      if (query.trim()) {
        onCommand('custom', query);
      } else {
        onCommand(SUGGESTIONS[selectedIndex].id, '');
      }
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-surface-overlay/80 z-[100]"
            onClick={onClose}
          />

          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={spring}
            className="fixed left-1/2 top-[20%] -translate-x-1/2 w-full max-w-[560px] z-[101] border border-subtle-20 bg-surface-elevated shadow-[20px_20px_60px_rgba(0,0,0,0.5)]"
          >
            <div className="flex flex-col">
              <div className="flex items-center gap-4 px-4 h-14 border-b border-subtle-20 bg-surface-elevated">
                <Command size={16} className="text-accent" />
                <input
                  ref={inputRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="INFERENCE DIRECTIVE..."
                  className="flex-1 bg-transparent border-none outline-none text-text-primary placeholder:text-text-placeholder text-[13px] font-mono uppercase tracking-widest"
                />
                <div className="flex items-center gap-3">
                    <div className="text-[9px] font-bold text-text-placeholder uppercase tracking-widest border border-subtle-20 px-2 py-0.5">CMD K</div>
                    <button onClick={onClose} className="text-text-placeholder hover:text-text-primary transition-colors">
                        <X size={16} />
                    </button>
                </div>
              </div>

              {isThinking && (
                <div className="p-8 flex flex-col items-center justify-center border-b border-subtle-20 bg-subtle-5 relative overflow-hidden min-h-[120px]">
                  <div 
                    className="flex items-center gap-2.5 rounded-full border px-4 py-2 transition-all duration-300 shadow-sm animate-fade-in"
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
                      {status || 'Connecting to AI...'}
                    </span>
                  </div>
                </div>
              )}

              <div className="p-0">
                <div className="px-4 py-3 text-[9px] font-black text-text-placeholder uppercase tracking-[0.2em] bg-surface-elevated border-b border-subtle-10">
                  Tactical Sequences
                </div>
                <div className={cn("flex flex-col divide-y divide-subtle-10", isThinking && "opacity-40 pointer-events-none grayscale")}>
                  {SUGGESTIONS.map((item, index) => {
                    const active = index === selectedIndex;
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.id}
                        className={cn(
                          "w-full flex items-center gap-4 px-4 py-4 transition-colors text-left",
                          active ? "bg-text-heading text-surface-page" : "bg-surface-page text-text-secondary hover:bg-surface-hover"
                        )}
                        onClick={() => onCommand(item.id, '')}
                        onMouseEnter={() => setSelectedIndex(index)}
                      >
                        <div className={cn(
                          "w-10 h-10 flex items-center justify-center shrink-0 border",
                          active ? "border-surface-page/20" : "border-subtle-20 bg-surface-elevated"
                        )}>
                          <Icon size={18} />
                        </div>
                        <div className="flex-1">
                          <div className="text-[11px] font-black uppercase tracking-widest">{item.label}</div>
                          <div className={cn("text-[10px] font-bold uppercase tracking-tight opacity-50", active ? "text-surface-page" : "text-text-placeholder")}>
                            {item.description}
                          </div>
                        </div>
                        {active && <ArrowRight size={14} className="opacity-50" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="px-4 py-3 bg-surface-elevated border-t border-subtle-20 flex items-center justify-between text-[9px] text-text-placeholder font-bold uppercase tracking-widest">
                <div className="flex items-center gap-6">
                  <span className="flex items-center gap-2"><kbd className="bg-surface-page border border-subtle-20 px-1.5 py-0.5">↑↓</kbd> NAVIGATE</span>
                  <span className="flex items-center gap-2"><kbd className="bg-surface-page border border-subtle-20 px-1.5 py-0.5">ENTER</kbd> EXECUTE</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-1 h-1 bg-accent" />
                    <span>L-OS ENGINE 0.4.1</span>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
