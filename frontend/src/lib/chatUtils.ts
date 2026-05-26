export const TEXT_EXTENSIONS = new Set([
    '.txt', '.md', '.markdown', '.json', '.js', '.jsx', '.ts', '.tsx', '.py', '.css', '.scss', '.sass',
    '.html', '.htm', '.xml', '.csv', '.yml', '.yaml', '.toml', '.ini', '.conf', '.log', '.env',
    '.sql', '.sh', '.bash', '.zsh', '.ps1', '.bat', '.cmd',
    '.java', '.kt', '.swift', '.c', '.cpp', '.h', '.hpp', '.go', '.rs', '.rb', '.php', '.lua', '.r',
    '.xlsx', '.xls'
]);

export const TEXT_MIME_TYPES = new Set([
    'application/json',
    'application/javascript',
    'application/x-javascript',
    'application/typescript',
    'application/x-typescript',
    'application/xml',
    'text/xml',
    'text/markdown',
    'text/x-markdown',
    'text/csv',
    'application/csv',
    'application/x-yaml',
    'text/yaml',
    'text/x-yaml',
    'application/x-sh',
    'text/x-shellscript',
    'text/x-python',
    'application/x-python',
    'application/x-httpd-php',
    'text/x-java-source',
    'text/x-c',
    'text/x-c++',
    'text/x-go',
    'text/x-rust',
    'text/x-sql',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
]);

export const isTextLikeFile = (file: File) => {
    const type = (file.type || '').toLowerCase();
    const name = file.name.toLowerCase();
    const dotIndex = name.lastIndexOf('.');
    const ext = dotIndex !== -1 ? name.slice(dotIndex) : '';
    return type.startsWith('text/') || TEXT_MIME_TYPES.has(type) || (ext && TEXT_EXTENSIONS.has(ext));
};

export const isDocFile = (file: File) => {
    const type = (file.type || '').toLowerCase();
    return (
        type === 'application/pdf' ||
        type === 'application/msword' ||
        type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
        type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
        type === 'application/vnd.ms-excel'
    );
};
