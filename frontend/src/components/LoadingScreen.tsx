import React from 'react';

export function LoadingScreen() {
  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ background: 'var(--console-bg, #0b0f14)' }}
    >
      <div className="flex flex-col items-center gap-4">
        <div
          className="w-12 h-12 rounded-full border-2 border-t-transparent animate-spin"
          style={{ borderColor: 'var(--border-subtle, #333)', borderTopColor: 'var(--brand-primary, #3b82f6)' }}
        />
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-text-tertiary">Hydrating Workspace</p>
      </div>
    </div>
  );
}
