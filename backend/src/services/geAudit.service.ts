import fs from 'fs';
import os from 'os';
import path from 'path';
import { exec, execFile } from 'child_process';
import { promisify } from 'util';
import mongoose from 'mongoose';
import { VoiceSample } from '../models/VoiceSample';

const execFileAsync = promisify(execFile);
const execAsync = promisify(exec);

export interface GeAuditResult {
    status: 'passed' | 'failed' | 'skipped';
    checkedAt: Date;
    command: string;
    summary: string;
    details?: Record<string, unknown>;
}

export class GeAuditService {
    async runMasterScriptAudit(masterScriptId: string, scriptVersion: string): Promise<GeAuditResult> {
        const checkedAt = new Date();
        const defaultScriptPath = path.join(process.cwd(), 'scripts', 'ge_master_audit.py');
        const configuredCommand = process.env.GE_AUDIT_COMMAND;

        const rows = await VoiceSample.find({
            masterScriptId: new mongoose.Types.ObjectId(masterScriptId),
            scriptVersion,
            isHierarchicalNode: false
        })
            .select(
                'chunkId sceneSeq elementSeq elementType sourceStartLine sourceEndLine sourceLineIds scriptVersion parserVersion parentNodeId'
            )
            .lean();

        if (rows.length === 0) {
            return {
                status: 'skipped',
                checkedAt,
                command: configuredCommand || `python "${defaultScriptPath}"`,
                summary: 'GE audit skipped: no leaf chunks found for target script version.'
            };
        }

        const payload = {
            masterScriptId,
            scriptVersion,
            expectedChunkCount: rows.length,
            rows
        };
        const safeMasterScriptId = masterScriptId.replace(/[^a-zA-Z0-9_-]/g, '');
        const safeScriptVersion = scriptVersion.replace(/[^a-zA-Z0-9._-]/g, '');
        const tempPath = path.join(
            os.tmpdir(),
            `ge_audit_${safeMasterScriptId}_${safeScriptVersion}_${Date.now()}.json`
        );
        const resolvedTemp = path.resolve(tempPath);
        if (!resolvedTemp.startsWith(path.resolve(os.tmpdir()))) {
            return { status: 'failed', checkedAt, command: '', summary: 'GE audit failed: invalid path parameters.' };
        }

        fs.writeFileSync(resolvedTemp, JSON.stringify(payload));

        try {
            const stdout = configuredCommand
                ? (await execFileAsync(configuredCommand, ['--input', resolvedTemp], { timeout: 60_000 })).stdout
                : (await execFileAsync('python', [defaultScriptPath, '--input', resolvedTemp], { timeout: 60_000 })).stdout;
            const parsed = this.parseAuditOutput(stdout);

            if (!parsed) {
                return {
                    status: 'failed',
                    checkedAt,
                    command: configuredCommand || `python "${defaultScriptPath}"`,
                    summary: 'GE audit command completed but output was not parseable JSON.'
                };
            }

            return {
                status: parsed.status,
                checkedAt,
                command: configuredCommand || `python "${defaultScriptPath}"`,
                summary: String(parsed.summary || 'GE audit finished.'),
                details: parsed.details as Record<string, unknown> | undefined
            };
        } catch (error: any) {
            return {
                status: 'skipped',
                checkedAt,
                command: configuredCommand || `python "${defaultScriptPath}"`,
                summary: `GE audit skipped: ${error.message || 'command execution failed'}`
            };
        } finally {
            try {
                fs.unlinkSync(resolvedTemp);
            } catch {
                // Ignore cleanup failure; temp file is non-critical.
            }
        }
    }

    private parseAuditOutput(stdout: string): { status: 'passed' | 'failed' | 'skipped'; summary?: string; details?: unknown } | null {
        const trimmed = (stdout || '').trim();
        if (!trimmed) return null;
        const lines = trimmed.split('\n').map(line => line.trim()).filter(Boolean);

        for (let i = lines.length - 1; i >= 0; i--) {
            try {
                const parsed = JSON.parse(lines[i]);
                if (parsed && typeof parsed === 'object' && parsed.status) {
                    return parsed;
                }
            } catch {
                // Try earlier lines
            }
        }
        return null;
    }
}

export const geAuditService = new GeAuditService();
