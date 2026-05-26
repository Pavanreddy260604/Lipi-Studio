import crypto from 'crypto';

const ALGORITHM = 'aes-256-cbc';

const getValidatedEncryptionKey = (): string => {
    const key = process.env.ENCRYPTION_KEY;

    if (!key) {
        throw new Error('[encryption] ENCRYPTION_KEY environment variable is required.');
    }

    if (key.length !== 32) {
        throw new Error(
            `[encryption] ENCRYPTION_KEY must be exactly 32 characters. Got ${key.length}.`
        );
    }

    return key;
};

// Lazy initialize so it doesn't crash during build or loading before dotenv config
let ENCRYPTION_KEY_CACHE: string | null = null;
function getEncryptionKey(): string {
    if (!ENCRYPTION_KEY_CACHE) {
        ENCRYPTION_KEY_CACHE = getValidatedEncryptionKey();
    }
    return ENCRYPTION_KEY_CACHE;
}

export function encrypt(text: string) {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(key), iv);
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return {
        iv: iv.toString('hex'),
        encryptedData: encrypted.toString('hex'),
    };
}

export function decrypt(encryptedData: string, iv: string) {
    const key = getEncryptionKey();
    const decipher = crypto.createDecipheriv(
        ALGORITHM,
        Buffer.from(key),
        Buffer.from(iv, 'hex')
    );
    let decrypted = decipher.update(Buffer.from(encryptedData, 'hex'));
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
}
