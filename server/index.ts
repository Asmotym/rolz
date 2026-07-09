import './sentry.ts';
import 'dotenv/config';
import express, { type NextFunction, type Request, type Response } from 'express';
import { createLogger } from './core/utils/logger';
import { handleRoomsAction, listRoomDiceRolls, listRoomsForUser, listRoomMembersForUser, type RoomsAction } from './services/rooms.service';
import { handleDiscordQuery, type DiscordQueryPayload } from './core/discord/discord-handler.core';
import { cors } from './middlewares/cors';
import { requireApiKeyForUntrustedOrigins } from './middlewares/api-key';
import { generateUserApiKey, getUserApiKey, revokeUserApiKey } from './services/api-keys.service';
import { sentry } from './middlewares/sentry'
import * as Sentry from '@sentry/node'
import { DatabaseUnavailableError } from './core/database/errors';
import { query } from './core/database/client';
import { HttpError } from './core/errors/http-errors';
import { ensureDatabaseSetup } from './core/database/schema';
import { getUser } from './core/database/tables/users.table';
import { updateUserTheme } from './core/database/tables/users.table';
import { isAppTheme } from './core/types/theme.types';

const logger = createLogger('Server');
const app = express();

app.use(cors);
app.use(express.json({ limit: '1mb' }));

function sendHealthResponse(res: Response, statusCode: number, payload: Record<string, unknown>) {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(statusCode).json({ ...payload, timestamp: new Date().toISOString() });
}

app.get('/health', (_req, res) => {
    return sendHealthResponse(res, 200, { status: 'ok' });
});

app.get('/ready', async (_req, res) => {
    try {
        await query('SELECT 1 AS ok');
        return sendHealthResponse(res, 200, {
            status: 'ready',
            dependencies: {
                database: 'ok'
            }
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unexpected database readiness failure';
        const meta = error instanceof Error ? { stack: error.stack } : undefined;
        logger.warn(`Readiness check failed: ${message}`, meta);

        return sendHealthResponse(res, 503, {
            status: 'unavailable',
            dependencies: {
                database: 'unavailable'
            },
            error: message
        });
    }
});

app.use('/api', requireApiKeyForUntrustedOrigins);

function respondWithServiceError(res: Response, error: unknown, context: string) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    const meta = error instanceof Error ? { stack: error.stack } : undefined;
    if (error instanceof DatabaseUnavailableError) {
        logger.error(`${context} - database unavailable: ${message}`, meta);
        return res.status(503).json({ success: false, error: message });
    }

    if (error instanceof HttpError) {
        const log = error.status >= 500 ? logger.error : logger.warn;
        log(`${context}: ${message}`, meta);
        return res.status(error.status).json({ success: false, error: message });
    }

    logger.error(`${context}: ${message}`, meta);
    return res.status(400).json({ success: false, error: message });
}

function ensureSameUser(res: Response, userId: string): boolean {
    const apiKeyUserId = res.locals.apiKeyUserId as string | undefined;
    if (apiKeyUserId && apiKeyUserId !== userId) {
        res.status(403).json({ success: false, error: 'API key does not belong to this user' });
        return false;
    }
    return true;
}

app.get('/api/users/:userId/api-key', async (req, res) => {
    const { userId } = req.params;
    if (!userId) {
        return res.status(400).json({ success: false, error: 'User id is required' });
    }

    if (!ensureSameUser(res, userId)) {
        return;
    }

    try {
        const payload = await getUserApiKey(userId);
        res.json({
            success: true,
            data: {
                apiKey: payload?.apiKey ?? null,
                createdAt: payload?.createdAt ?? null,
                lastUsedAt: payload?.lastUsedAt ?? null
            }
        });
    } catch (error) {
        respondWithServiceError(res, error, 'Failed to fetch API key');
    }
});

app.post('/api/users/:userId/api-key', async (req, res) => {
    const { userId } = req.params;
    if (!userId) {
        return res.status(400).json({ success: false, error: 'User id is required' });
    }

    if (!ensureSameUser(res, userId)) {
        return;
    }

    try {
        const payload = await generateUserApiKey(userId);
        res.json({ success: true, data: payload });
    } catch (error) {
        respondWithServiceError(res, error, 'Failed to generate API key');
    }
});

app.delete('/api/users/:userId/api-key', async (req, res) => {
    const { userId } = req.params;
    if (!userId) {
        return res.status(400).json({ success: false, error: 'User id is required' });
    }

    if (!ensureSameUser(res, userId)) {
        return;
    }

    try {
        await revokeUserApiKey(userId);
        res.json({ success: true, data: { apiKey: null } });
    } catch (error) {
        respondWithServiceError(res, error, 'Failed to revoke API key');
    }
});

app.get('/api/users/:userId/preferences', async (req, res) => {
    const { userId } = req.params;
    if (!userId) {
        return res.status(400).json({ success: false, error: 'User id is required' });
    }

    if (!ensureSameUser(res, userId)) {
        return;
    }

    try {
        const user = await getUser(userId);
        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        res.json({ success: true, data: { theme: user.theme ?? 'dark' } });
    } catch (error) {
        respondWithServiceError(res, error, 'Failed to fetch user preferences');
    }
});

app.patch('/api/users/:userId/preferences', async (req, res) => {
    const { userId } = req.params;
    if (!userId) {
        return res.status(400).json({ success: false, error: 'User id is required' });
    }

    if (!ensureSameUser(res, userId)) {
        return;
    }

    if (!req.body || typeof req.body !== 'object') {
        return res.status(400).json({ success: false, error: 'Request body is required' });
    }

    const theme = (req.body as { theme?: unknown }).theme;
    if (!isAppTheme(theme)) {
        return res.status(400).json({ success: false, error: 'Invalid theme preference' });
    }

    try {
        const user = await getUser(userId);
        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        const savedTheme = await updateUserTheme(userId, theme);
        res.json({ success: true, data: { theme: savedTheme } });
    } catch (error) {
        respondWithServiceError(res, error, 'Failed to update user preferences');
    }
});

app.get('/api/rooms', async (_req, res) => {
    const userId = res.locals.apiKeyUserId as string | undefined;
    if (!userId) {
        return res.status(401).json({ success: false, error: 'API key is required to list rooms' });
    }

    try {
        const rooms = await listRoomsForUser(userId);
        res.json({ success: true, data: { rooms } });
    } catch (error) {
        respondWithServiceError(res, error, 'Rooms listing failed');
    }
});

app.post('/api/rooms', async (req, res) => {
    if (!req.body || typeof req.body !== 'object') {
        return res.status(400).json({ success: false, error: 'Request body is required' });
    }

    const payload = req.body as RoomsAction;
    if (!('action' in payload)) {
        return res.status(400).json({ success: false, error: 'Missing action' });
    }

    try {
        const data = await handleRoomsAction(payload);
        res.json({ success: true, data });
    } catch (error) {
        respondWithServiceError(res, error, 'Rooms endpoint failed');
    }
});

app.get('/api/rooms/:roomId/members', async (req, res) => {
    const { roomId } = req.params;
    const userId = res.locals.apiKeyUserId as string | undefined;

    if (!userId) {
        return res.status(401).json({ success: false, error: 'API key is required to list room members' });
    }
    if (!roomId) {
        return res.status(400).json({ success: false, error: 'Room id is required' });
    }

    try {
        const members = await listRoomMembersForUser({ roomId, userId });
        res.json({ success: true, data: { roomId, members } });
    } catch (error) {
        respondWithServiceError(res, error, 'Room members endpoint failed');
    }
});

app.post('/api/discord', async (req, res) => {
    if (!req.body || typeof req.body !== 'object') {
        return res.status(400).json({ success: false, error: 'Request body is required' });
    }

    const body = req.body as DiscordQueryPayload;
    const queryType = body.queryType ?? 'user';

    try {
        const data = await handleDiscordQuery({ ...body, queryType });
        res.json({ success: true, data, queryType });
    } catch (error) {
        respondWithServiceError(res, error, 'Discord endpoint failed');
    }
});

app.get('/api/rooms/:roomId/dice-rolls', async (req, res) => {
    const { roomId } = req.params;
    const limit = typeof req.query.limit === 'string' ? Number(req.query.limit) : undefined;
    const since = typeof req.query.since === 'string' ? req.query.since : undefined;

    if (!roomId) {
        return res.status(400).json({ success: false, error: 'Room id is required' });
    }

    try {
        const diceRolls = await listRoomDiceRolls({ roomId, limit, since });
        res.json({ success: true, data: { roomId, diceRolls } });
    } catch (error) {
        respondWithServiceError(res, error, 'Dice rolls endpoint failed');
    }
});

app.use((error: Error, _req: Request, res: Response, _next: NextFunction) => {
    if (error instanceof SyntaxError) {
        logger.warn(`Invalid JSON payload: ${error.message}`);
        return res.status(400).json({ success: false, error: 'Invalid JSON payload' });
    }

    if (error instanceof DatabaseUnavailableError) {
        logger.error(`Database unavailable during request: ${error.message}`, { stack: error.stack });
        return res.status(503).json({ success: false, error: error.message });
    }

    logger.error(`Unhandled error: ${error.message}`);
    return res.status(500).json({ success: false, error: 'Internal server error' });
});

Sentry.setupExpressErrorHandler(app);
app.use(sentry)

const port = Number(process.env.PORT ?? process.env.BACKEND_PORT ?? 8888);
const host = process.env.HOST ?? '0.0.0.0';

async function startServer() {
    try {
        await ensureDatabaseSetup();
        app.listen(port, host, () => {
            const displayHost = host === '0.0.0.0' ? 'localhost' : host;
            logger.success(`API server listening on http://${displayHost}:${port}`);
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error during startup';
        const meta = error instanceof Error ? { stack: error.stack } : undefined;
        logger.error(`Failed to start server: ${message}`, meta);
        process.exit(1);
    }
}

void startServer();

export { app };
