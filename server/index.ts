import 'dotenv/config';
import express, { type NextFunction, type Request, type Response } from 'express';
import { createLogger } from './core/utils/logger';
import { handleRoomsAction, listRoomDiceRolls, type RoomsAction } from './services/rooms.service';
import { handleDiscordQuery, type DiscordQueryPayload } from './core/discord/discord-handler.core';
import { cors } from './middlewares/cors';
import { requireApiKeyForUntrustedOrigins } from './middlewares/api-key';
import { generateUserApiKey, getUserApiKey, revokeUserApiKey } from './services/api-keys.service';

const logger = createLogger('Server');
const app = express();

app.use(cors);
app.use(express.json({ limit: '1mb' }));
app.use('/api', requireApiKeyForUntrustedOrigins);

app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

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
        logger.error(`Failed to fetch API key: ${error instanceof Error ? error.message : 'Unknown error'}`);
        res.status(400).json({ success: false, error: error instanceof Error ? error.message : 'Unable to fetch API key' });
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
        logger.error(`Failed to generate API key: ${error instanceof Error ? error.message : 'Unknown error'}`);
        res.status(400).json({ success: false, error: error instanceof Error ? error.message : 'Unable to generate API key' });
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
        logger.error(`Failed to revoke API key: ${error instanceof Error ? error.message : 'Unknown error'}`);
        res.status(400).json({ success: false, error: error instanceof Error ? error.message : 'Unable to revoke API key' });
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
        logger.error(`Rooms endpoint failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        res.status(400).json({ success: false, error: error instanceof Error ? error.message : 'Unexpected error' });
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
        logger.error(`Discord endpoint failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        res.status(400).json({ success: false, error: error instanceof Error ? error.message : 'Unexpected error' });
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
        logger.error(`Dice rolls endpoint failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        res.status(400).json({ success: false, error: error instanceof Error ? error.message : 'Unexpected error' });
    }
});

app.use((error: Error, _req: Request, res: Response, _next: NextFunction) => {
    if (error instanceof SyntaxError) {
        logger.warn(`Invalid JSON payload: ${error.message}`);
        return res.status(400).json({ success: false, error: 'Invalid JSON payload' });
    }

    logger.error(`Unhandled error: ${error.message}`);
    return res.status(500).json({ success: false, error: 'Internal server error' });
});

const port = Number(process.env.PORT ?? process.env.BACKEND_PORT ?? 8888);
const host = process.env.HOST ?? '0.0.0.0';

app.listen(port, host, () => {
    const displayHost = host === '0.0.0.0' ? 'localhost' : host;
    logger.success(`API server listening on http://${displayHost}:${port}`);
});

export { app };
