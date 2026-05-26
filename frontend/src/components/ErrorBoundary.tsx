import React, { Component, type ReactNode } from 'react';
import { cn } from '../lib/utils';

interface ErrorBoundaryProps {
    children: ReactNode;
    fallback?: ReactNode;
}

interface ErrorBoundaryState {
    hasError: boolean;
    error: Error | null;
}

/**
 * Error Boundary Component
 * Catches JavaScript errors anywhere in the child component tree and displays a fallback UI
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
    constructor(props: ErrorBoundaryProps) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): ErrorBoundaryState {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        if (import.meta.env.DEV) {
            console.error('ErrorBoundary caught an error:', error, errorInfo);
        }
    }

    render() {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback;
            }

            const isStorageError =
                this.state.error?.name === 'SecurityError' ||
                this.state.error?.message?.includes('storage') ||
                this.state.error?.message?.includes('Access to storage is not allowed');

            return (
                <div className="min-h-screen flex items-center justify-center p-6 bg-bg-base">
                    <div className="max-w-md w-full text-center p-8 rounded-2xl bg-bg-elevated border border-border">
                        <div className={cn(
                            "w-16 h-16 mx-auto mb-6 rounded-full flex items-center justify-center",
                            isStorageError ? "bg-[var(--accent-soft)]" : "bg-[var(--status-error-soft)]"
                        )}>
                            {isStorageError ? (
                                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--brand-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                                    <path d="M7 11V7a5 5 0 0110 0v4" />
                                </svg>
                            ) : (
                                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--status-error)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <circle cx="12" cy="12" r="10" />
                                    <line x1="12" y1="8" x2="12" y2="12" />
                                    <line x1="12" y1="16" x2="12.01" y2="16" />
                                </svg>
                            )}
                        </div>
                        <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-2">
                            {isStorageError ? 'Storage Access Blocked' : 'Something went wrong'}
                        </h2>
                        <p className="text-sm mb-6 text-[var(--text-secondary)]">
                            {isStorageError
                                ? 'Your browser is blocking access to local storage. This is often caused by "Block third-party cookies" or "Incognito Mode" settings. Please enable storage for this site to continue.'
                                : 'An unexpected error occurred. Please try refreshing the page.'}
                        </p>
                        <div className="flex flex-col gap-3">
                            <button
                                onClick={() => window.location.reload()}
                                className="px-6 py-3 rounded-xl font-medium transition-all text-white focus-ring"
                                    style={{ backgroundColor: 'var(--accent)' }}
                            >
                                Refresh Page
                            </button>
                            {isStorageError && (
                                <p className="text-[10px] text-[var(--text-tertiary)]">
                                    Tip: Visit <code>chrome://settings/cookies</code> and add <code>localhost</code> to "Allowed to use cookies"
                                </p>
                            )}
                        </div>
                        {import.meta.env.DEV && this.state.error && (
                            <details className="mt-6 text-left">
                                <summary className="cursor-pointer text-sm mb-2 text-[var(--text-tertiary)]">
                                    Error Details
                                </summary>
                                <pre className={cn(
                                    "text-xs p-3 rounded-lg overflow-auto bg-[var(--console-surface)]",
                                    isStorageError ? "text-[var(--accent-primary)]" : "text-[var(--status-error)]"
                                )}>
                                    {this.state.error.name}: {this.state.error.message}
                                    {'\n\n'}
                                    {this.state.error.stack}
                                </pre>
                            </details>
                        )}
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
