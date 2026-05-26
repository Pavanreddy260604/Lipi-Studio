import { ChildProcessWithoutNullStreams, spawn, spawnSync } from 'child_process';
import * as path from 'path';
import type { PendingRequest } from './types.js';

export class LocalTransformersEmbeddingService {
    private worker: ChildProcessWithoutNullStreams | null = null;
    private workerStdoutBuffer = '';
    private nextRequestId = 1;
    private pending = new Map<number, PendingRequest>();
    private readonly configuredPythonBin = (process.env.TRANSFORMERS_PYTHON_BIN || '').trim();
    private readonly maxRetries = this.parsePositiveInt(process.env.TRANSFORMERS_EMBED_MAX_RETRIES, 2);
    private readonly requestTimeoutMs = this.parsePositiveInt(process.env.TRANSFORMERS_EMBED_TIMEOUT_MS, 300_000);
    private readonly workerScriptPath = path.join(process.cwd(), 'scripts', 'transformers_embed_worker.py');
    private resolvedPythonLaunch: { command: string; argsPrefix: string[] } | null = null;

    async generateEmbedding(text: string): Promise<number[]> {
        let lastError: unknown;

        for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
            try {
                await this.ensureWorker();
                return await this.requestEmbedding(text);
            } catch (error: any) {
                const message = this.normalizeProcessError(error);
                lastError = new Error(message);
                console.warn(
                    `[LocalTransformersEmbedding] Attempt ${attempt}/${this.maxRetries} failed: ${message}`
                );

                if (this.isDependencyError(message)) {
                    throw error;
                }

                await this.restartWorker();
            }
        }

        throw new Error(
            `Local Transformers embedding failed after retries: ${this.extractErrorMessage(lastError)}`
        );
    }

    private async ensureWorker(): Promise<void> {
        if (this.worker && !this.worker.killed) {
            return;
        }

        this.workerStdoutBuffer = '';
        const launch = this.resolvePythonLaunch();
        const pythonArgs = [...launch.argsPrefix, '-u', this.workerScriptPath];

        this.worker = spawn(launch.command, pythonArgs, {
            stdio: ['pipe', 'pipe', 'pipe'],
            cwd: process.cwd(),
            env: { ...process.env }
        });

        this.worker.stdout.setEncoding('utf8');
        this.worker.stderr.setEncoding('utf8');

        this.worker.stdout.on('data', chunk => {
            this.handleWorkerStdout(chunk);
        });

        this.worker.stderr.on('data', chunk => {
            const message = String(chunk).trim();
            if (message) {
                console.warn(`[LocalTransformersWorker][stderr] ${message}`);
            }
        });

        this.worker.on('exit', (code, signal) => {
            const reason = `Local transformers worker exited (code=${code ?? 'null'}, signal=${signal ?? 'null'})`;
            this.failPending(new Error(reason));
            this.worker = null;
        });

        this.worker.on('error', error => {
            this.failPending(new Error(`Local transformers worker process error: ${error.message}`));
            this.worker = null;
        });
    }

    private handleWorkerStdout(chunk: string): void {
        this.workerStdoutBuffer += chunk;
        let newlineIndex = this.workerStdoutBuffer.indexOf('\n');

        while (newlineIndex >= 0) {
            const line = this.workerStdoutBuffer.slice(0, newlineIndex).trim();
            this.workerStdoutBuffer = this.workerStdoutBuffer.slice(newlineIndex + 1);

            if (line) {
                this.handleWorkerLine(line);
            }

            newlineIndex = this.workerStdoutBuffer.indexOf('\n');
        }
    }

    private handleWorkerLine(line: string): void {
        let payload: any;
        try {
            payload = JSON.parse(line);
        } catch {
            console.warn(`[LocalTransformersWorker] Non-JSON output ignored: ${line}`);
            return;
        }

        if (payload?.type === 'ready') {
            console.log(`[LocalTransformersWorker] Ready model=${payload.model || 'unknown'}`);
            return;
        }

        const id = Number(payload?.id);
        if (!Number.isInteger(id)) {
            console.warn(`[LocalTransformersWorker] Response without valid id: ${line}`);
            return;
        }

        const pending = this.pending.get(id);
        if (!pending) {
            return;
        }

        clearTimeout(pending.timeout);
        this.pending.delete(id);

        if (payload.error) {
            pending.reject(new Error(String(payload.error)));
            return;
        }

        const embedding = payload.embedding;
        if (!Array.isArray(embedding) || embedding.length === 0) {
            pending.reject(new Error('Worker returned empty embedding.'));
            return;
        }

        const numeric = embedding.map((value: unknown) => Number(value));
        if (numeric.some(value => !Number.isFinite(value))) {
            pending.reject(new Error('Worker returned embedding with non-finite values.'));
            return;
        }

        pending.resolve(numeric);
    }

    private requestEmbedding(text: string): Promise<number[]> {
        if (!this.worker || this.worker.killed || !this.worker.stdin.writable) {
            throw new Error('Local transformers worker is not available.');
        }

        const id = this.nextRequestId++;
        const payload = JSON.stringify({ id, text }) + '\n';

        return new Promise<number[]>((resolve, reject) => {
            const timeout = setTimeout(() => {
                this.pending.delete(id);
                reject(new Error(`Local transformers worker timed out after ${this.requestTimeoutMs}ms`));
            }, this.requestTimeoutMs);

            this.pending.set(id, { resolve, reject, timeout });

            this.worker!.stdin.write(payload, error => {
                if (!error) return;
                clearTimeout(timeout);
                this.pending.delete(id);
                reject(new Error(`Failed to write request to local transformers worker: ${error.message}`));
            });
        });
    }

    private async restartWorker(): Promise<void> {
        if (!this.worker) {
            return;
        }

        const proc = this.worker;
        this.worker = null;

        try {
            proc.kill();
        } catch {
        }
    }

    private failPending(error: Error): void {
        for (const [id, pending] of this.pending.entries()) {
            clearTimeout(pending.timeout);
            pending.reject(error);
            this.pending.delete(id);
        }
    }

    private parsePositiveInt(raw: string | undefined, fallback: number): number {
        const parsed = Number(raw);
        if (!Number.isFinite(parsed) || parsed <= 0) {
            return fallback;
        }
        return Math.floor(parsed);
    }

    private isDependencyError(message: string): boolean {
        const m = (message || '').toLowerCase();
        return (
            m.includes('no module named') ||
            m.includes('modulenotfounderror') ||
            m.includes('importerror')
        );
    }

    private normalizeProcessError(error: unknown): string {
        const code = (error as any)?.code;
        const message = (error as any)?.message ? String((error as any).message) : String(error || 'unknown');
        const launch = this.resolvePythonLaunch();
        const binary = launch.command;

        if (code === 'ENOENT') {
            return `Python executable '${binary}' not found. Set TRANSFORMERS_PYTHON_BIN to a valid Python binary.`;
        }
        if (code === 'EPERM') {
            return `Failed to execute Python '${binary}' (EPERM). Set TRANSFORMERS_PYTHON_BIN to an explicit path like C:\\\\Python312\\\\python.exe`;
        }

        return message;
    }

    private resolvePythonLaunch(): { command: string; argsPrefix: string[] } {
        if (this.resolvedPythonLaunch) {
            return this.resolvedPythonLaunch;
        }

        const candidates: Array<{ command: string; argsPrefix: string[]; probeArgs: string[] }> = [];
        if (this.configuredPythonBin) {
            candidates.push({ command: this.configuredPythonBin, argsPrefix: [], probeArgs: ['--version'] });
        }
        candidates.push({ command: 'python', argsPrefix: [], probeArgs: ['--version'] });
        if (process.platform === 'win32') {
            candidates.push({ command: 'py', argsPrefix: ['-3'], probeArgs: ['-3', '--version'] });
        }
        candidates.push({ command: 'python3', argsPrefix: [], probeArgs: ['--version'] });

        for (const candidate of candidates) {
            try {
                const probe = spawnSync(candidate.command, candidate.probeArgs, { stdio: 'ignore' });
                if (!probe.error && probe.status === 0) {
                    this.resolvedPythonLaunch = { command: candidate.command, argsPrefix: candidate.argsPrefix };
                    return this.resolvedPythonLaunch;
                }
            } catch {
            }
        }

        const fallback = this.configuredPythonBin || 'python';
        this.resolvedPythonLaunch = { command: fallback, argsPrefix: [] };
        return this.resolvedPythonLaunch;
    }

    private extractErrorMessage(error: unknown): string {
        if (typeof (error as any)?.message === 'string' && (error as any).message.trim()) {
            return (error as any).message;
        }
        return String(error || 'unknown');
    }
}

export const localTransformersEmbeddingService = new LocalTransformersEmbeddingService();
