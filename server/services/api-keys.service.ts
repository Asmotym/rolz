import { ensureDatabaseSetup } from '../core/database/schema';
import { getUser } from '../core/database/tables/users.table';
import {
    deleteUserApiKey,
    getApiKeyByHash,
    getApiKeyForUser,
    updateApiKeyUsage,
    upsertApiKey
} from '../core/database/tables/user-api-keys.table';
import { decryptApiKey, encryptApiKey, generateApiKey, hashApiKey } from '../core/utils/api-key';
import { createLogger } from '../core/utils/logger';

const logger = createLogger('ApiKeysService');

export interface UserApiKeyPayload {
    apiKey: string;
    createdAt?: string;
    lastUsedAt?: string | null;
}

export async function getUserApiKey(userId: string): Promise<UserApiKeyPayload | null> {
    if (!userId) throw new Error('User id is required');

    await ensureDatabaseSetup();
    const record = await getApiKeyForUser(userId);
    if (!record) {
        return null;
    }

    try {
        const apiKey = decryptApiKey(record.api_key_encrypted);
        return {
            apiKey,
            createdAt: record.created_at,
            lastUsedAt: record.last_used_at ?? null
        };
    } catch (error) {
        logger.error(`Failed to decrypt API key for user ${userId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        throw new Error('Unable to retrieve API key');
    }
}

export async function generateUserApiKey(userId: string): Promise<UserApiKeyPayload> {
    if (!userId) throw new Error('User id is required');

    await ensureDatabaseSetup();
    const user = await getUser(userId);
    if (!user) {
        throw new Error('Unknown user');
    }

    const apiKey = generateApiKey();
    const record = {
        user_id: userId,
        api_key_hash: hashApiKey(apiKey),
        api_key_encrypted: encryptApiKey(apiKey)
    };

    await upsertApiKey(record);
    logger.info(`Generated API key for user ${userId}`);

    const stored = await getApiKeyForUser(userId);

    return {
        apiKey,
        createdAt: stored?.created_at,
        lastUsedAt: stored?.last_used_at ?? null
    };
}

export async function revokeUserApiKey(userId: string): Promise<void> {
    if (!userId) throw new Error('User id is required');

    await ensureDatabaseSetup();
    await deleteUserApiKey(userId);
    logger.info(`Revoked API key for user ${userId}`);
}

export async function verifyApiKey(apiKey: string): Promise<{ userId: string } | null> {
    if (!apiKey) return null;

    await ensureDatabaseSetup();
    const hash = hashApiKey(apiKey);
    const record = await getApiKeyByHash(hash);

    if (!record) {
        return null;
    }

    return { userId: record.user_id };
}

export async function recordApiKeyUsage(userId: string): Promise<void> {
    if (!userId) return;
    await updateApiKeyUsage(userId);
}
