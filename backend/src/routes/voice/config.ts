import multer from 'multer';
import path from 'path';

export const ALLOWED_EXTENSIONS = ['.pdf', '.txt', '.md', '.docx'];
export const ALLOWED_MIME_TYPES = [
    'application/pdf',
    'text/plain',
    'text/markdown',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
];

const fileFilter = (req: Express.Request, file: Express.Multer.File, callback: multer.FileFilterCallback) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const isAllowedExt = ALLOWED_EXTENSIONS.includes(ext);
    const isAllowedMime = ALLOWED_MIME_TYPES.includes(file.mimetype);
    const isOctetStream = file.mimetype === 'application/octet-stream';

    if (isAllowedMime || (isOctetStream && isAllowedExt)) {
        callback(null, true);
    } else {
        callback(new Error(`Invalid file type. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}`));
    }
};

export const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 10 * 1024 * 1024,
        files: 1
    },
    fileFilter: fileFilter
});

export const validateSourceParam = (source: unknown): string | null => {
    if (typeof source !== 'string') return null;
    const normalized = source.trim();
    if (normalized.length === 0 || normalized.length > 255) return null;
    if (normalized.includes('\0')) return null;
    return normalized;
};
