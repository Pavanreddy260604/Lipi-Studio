import { User } from '../../models/User.js';
import type { Bible } from '../../models/Bible.js';

export async function getUserInterestsForBible(bible?: { userId?: string } | null) {
    if (!bible?.userId) return null;
    const user = await User.findById(bible.userId).lean();
    return user?.scriptInterests || null;
}

export function stripDeep(obj: any, maxDepth = 2, currentDepth = 0): any {
    if (currentDepth >= maxDepth) return typeof obj === 'string' ? obj : '[Nested Data]';
    if (Array.isArray(obj)) return obj.map(item => stripDeep(item, maxDepth, currentDepth + 1));
    if (typeof obj === 'object' && obj !== null) {
        const result: any = {};
        for (const key in obj) if (key !== 'children' && key !== 'tactics') result[key] = stripDeep(obj[key], maxDepth, currentDepth + 1);
        return result;
    }
    return obj;
}
