export interface BackgroundTaskResult {
    taskName: string;
    success: boolean;
    details?: string;
    error?: string;
}

export const pendingTasks = new Map<string, Promise<BackgroundTaskResult>>();

export function addBackgroundTask(name: string, task: () => Promise<BackgroundTaskResult>): void {
    const promise = task().catch(err => ({
        taskName: name,
        success: false,
        error: err?.message || String(err),
    }));
    pendingTasks.set(name, promise);
}

export async function waitForBackgroundTasks(): Promise<BackgroundTaskResult[]> {
    if (pendingTasks.size === 0) return [];
    const entries = Array.from(pendingTasks.entries());
    pendingTasks.clear();
    const results = await Promise.allSettled(entries.map(([, p]) => p));
    return results.map((r, i) => {
        if (r.status === 'fulfilled') return r.value;
        return { taskName: entries[i][0], success: false, error: r.reason?.message || String(r.reason) };
    });
}

const gracefulShutdown = async () => {
    console.info('[ScriptGenerator] Draining pending background tasks...');
    await waitForBackgroundTasks();
    process.exit(0);
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);
