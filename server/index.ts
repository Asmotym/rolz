import 'dotenv/config';
import express, { type NextFunction, type Request, type Response } from 'express';
import type { CorsOptions } from 'cors';
import { createLogger } from './core/utils/logger';
import { handleRoomsAction, type RoomsAction } from './services/rooms.service';
import { handleDiscordQuery, type DiscordQueryPayload } from './core/discord/discord-handler.core';
import { cors } from './middlewares/cors'

const logger = createLogger('Server');
const app = express();

app.use(cors);
app.use(express.json({ limit: '1mb' }));

app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
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
