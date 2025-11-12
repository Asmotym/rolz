import type { NextFunction, Request, Response } from 'express';
import { isTrustedFrontendHost } from '../core/config/origins';
import { recordApiKeyUsage, verifyApiKey } from '../services/api-keys.service';

function isRequestFromTrustedOrigin(req: Request): boolean {
    const origin = req.headers.origin as string | undefined;
    const referer = req.headers.referer as string | undefined;

    return isTrustedFrontendHost(origin) || isTrustedFrontendHost(referer);
}

function readApiKey(req: Request): string | null {
    const headerKey = req.header('x-api-key');
    if (headerKey) return headerKey.trim();

    const authHeader = req.header('authorization');
    if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
        return authHeader.slice(7).trim();
    }

    if (typeof req.query.apiKey === 'string') {
        return req.query.apiKey;
    }

    return null;
}

export async function requireApiKeyForUntrustedOrigins(req: Request, res: Response, next: NextFunction) {
    if (req.method === 'OPTIONS') {
        return next();
    }

    if (isRequestFromTrustedOrigin(req)) {
        return next();
    }

    const apiKey = readApiKey(req);
    if (!apiKey) {
        return res.status(401).json({ success: false, error: 'API key required for external requests' });
    }

    try {
        const match = await verifyApiKey(apiKey);
        if (!match) {
            return res.status(403).json({ success: false, error: 'Invalid API key' });
        }

        res.locals.apiKeyUserId = match.userId;
        await recordApiKeyUsage(match.userId);
        next();
    } catch (error) {
        next(error);
    }
}
