import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';
import { createLogger } from './logger';

const logger = createLogger('ApiKeyUtils');
const DEFAULT_SECRET = 'rolz-dev-api-key-secret-change-me-now';
const IV_LENGTH = 12;

function resolveSecret(): Buffer {
    const rawSecret = process.env.API_KEY_ENCRYPTION_SECRET
        || process.env.API_KEY_SECRET
        || DEFAULT_SECRET;

    if (rawSecret === DEFAULT_SECRET) {
        logger.warn('Using default API key encryption secret. Set API_KEY_ENCRYPTION_SECRET in production.');
    }

    return createHash('sha256').update(rawSecret).digest();
}

const ENCRYPTION_KEY = resolveSecret().subarray(0, 32);

function toBase64Url(buffer: Buffer): string {
    return buffer
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
}

export function generateApiKey(): string {
    const randomSegment = toBase64Url(randomBytes(32));
    return `rolz_${randomSegment}`;
}

export function hashApiKey(key: string): string {
    return createHash('sha256').update(key).digest('hex');
}

export function encryptApiKey(key: string): string {
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);
    const encrypted = Buffer.concat([cipher.update(key, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();

    return [
        iv.toString('base64'),
        encrypted.toString('base64'),
        authTag.toString('base64')
    ].join('.');
}

export function decryptApiKey(payload: string): string {
    const [ivPart, encryptedPart, authTagPart] = payload.split('.');
    if (!ivPart || !encryptedPart || !authTagPart) {
        throw new Error('Invalid encrypted API key payload');
    }

    const iv = Buffer.from(ivPart, 'base64');
    const encrypted = Buffer.from(encryptedPart, 'base64');
    const authTag = Buffer.from(authTagPart, 'base64');

    const decipher = createDecipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return decrypted.toString('utf8');
}
