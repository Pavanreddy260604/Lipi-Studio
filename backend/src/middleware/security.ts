import { Request, Response, NextFunction } from 'express';
import xss from 'xss';

/**
 * Recursively sanitizes objects, arrays, and strings to prevent XSS attacks.
 */
function sanitize(obj: any): any {
    if (typeof obj === 'string') {
        return xss(obj);
    }
    if (Array.isArray(obj)) {
        return obj.map(v => sanitize(v));
    }
    if (obj !== null && typeof obj === 'object') {
        const sanitizedObj: any = {};
        for (const key in obj) {
            sanitizedObj[key] = sanitize(obj[key]);
        }
        return sanitizedObj;
    }
    return obj;
}

export const xssSanitizer = (req: Request, _res: Response, next: NextFunction) => {
    if (req.body) req.body = sanitize(req.body);
    if (req.query) req.query = sanitize(req.query);
    if (req.params) req.params = sanitize(req.params);
    next();
};
