import React from 'react';

interface ProgressBarProps {
  progress: number; // 0 to 100
  label?: string;
  className?: string;
  showPercentage?: boolean;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({ 
  progress, 
  label, 
  className = '',
  showPercentage = true
}) => {
  return (
    <div className={`w-full ${className}`}>
      <div className="flex items-center justify-between mb-1.5 px-1">
        {label && (
          <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-text-secondary">
            {label}
          </span>
        )}
        {showPercentage && (
          <span className="text-[10px] font-mono font-medium text-text-disabled">
            {Math.round(progress)}%
          </span>
        )}
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-console-surface-2 border border-border-subtle relative">
        <div 
          className="absolute inset-0 bg-gradient-to-r from-transparent via-accent-primary/10 to-transparent blur-sm -translate-x-full animate-[shimmer_2s_infinite]"
          style={{ width: '200%' }}
        />
        
        <div 
          className="h-full rounded-full bg-gradient-to-r from-accent-dark via-accent-primary to-accent-primary transition-[width] duration-[250ms] ease-out relative shadow-[0_0_18px_var(--accent-soft)]"
          style={{ width: `${progress}%` }}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent skew-x-[-20deg] animate-[shimmer_1.5s_infinite] opacity-30" />
          
          <div className="absolute top-0 left-0 right-0 h-[1px] bg-white/20 rounded-full" />
        </div>
      </div>
    </div>
  );
};
