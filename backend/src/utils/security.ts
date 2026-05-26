import mongoose from 'mongoose';

/**
 * Escapes special regex characters in a string to prevent regex injection
 * when building dynamic RegExp from user input.
 */
export function escapeRegExp(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Validates and returns a MongoDB ObjectId string, or null if invalid.
 */
export function validateObjectId(id: unknown): string | null {
    if (typeof id !== 'string') return null;
    return mongoose.Types.ObjectId.isValid(id) ? id : null;
}

/**
 * Sanitizes user input before interpolation into LLM prompt templates.
 * Truncates to a max length and strips control characters.
 */
export function sanitizeForPrompt(input: string, maxLength = 10000): string {
    if (typeof input !== 'string') return '';
    // Strip control characters (except newlines and tabs which are common in text)
    const cleaned = input.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
    return cleaned.slice(0, maxLength);
}

/**
 * Redacts a secret value for safe logging — shows only first 4 chars.
 */
export function redactSecret(value: string, visibleChars = 4): string {
    if (!value || value.length <= visibleChars) return '***';
    return value.slice(0, visibleChars) + '***';
}

/**
 * Validates that a file path is within an allowed base directory
 * to prevent path traversal attacks.
 */
export function validatePath(userPath: string, baseDir: string): string | null {
    const path = require('path');
    const resolved = path.resolve(baseDir, userPath);
    if (!resolved.startsWith(path.resolve(baseDir))) return null;
    return resolved;
}
