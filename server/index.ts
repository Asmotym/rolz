import './sentry.ts';
import express, { type NextFunction, type Request, type Response } from 'express';
import { createLogger } from './core/utils/logger';
import { handleRoomsAction, listRoomDiceRolls, listRoomsForUser, listRoomMembersForUser, type RoomsAction } from './services/rooms.service';
import { handleDiscordQuery, type DiscordQueryPayload } from './core/discord/discord-handler.core';
import { cors } from './middlewares/cors';
import { requireApiKeyForUntrustedOrigins } from './middlewares/api-key';
import { generateUserApiKey, getUserApiKey, revokeUserApiKey } from './services/api-keys.service';
import * as Sentry from '@sentry/node';
import { query } from './core/database/client';
import { ensureDatabaseSetup } from './core/database/schema';
import { getUser } from './core/database/tables/users.table';
import { updateUserTheme } from './core/database/tables/users.table';
import { isAppTheme } from './core/types/theme.types';
import { listAdminUsers, updateUserRole } from './services/admin.service';
import { requireAdmin } from './services/roles.service';
import {
    archiveArticle,
    createArticle,
    createTag,
    getAdminArticle,
    getPublicArticle,
    listAdminArticles,
    listNewsArticles,
    listOwnerDrafts,
    listPublicArticles,
    listTags,
    previewMarkdown,
    removeDraft,
    removeTag,
    renameTag,
    saveDraft,
    setArticlePublication,
    updateArticle
} from './services/articles.service';
import {
    addSafeBreadcrumb,
    handleServerError,
    requestCorrelationMiddleware,
    sendErrorResponse,
    setAuthenticatedUser,
    type SafeSentryContext
} from './observability/server-observability';

const logger = createLogger('Server');
const app = express();

app.use(requestCorrelationMiddleware);
app.use(cors);
app.use(express.json({ limit: '1mb' }));

function sendHealthResponse(res: Response, statusCode: number, payload: Record<string, unknown>) {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(statusCode).json({
        ...payload,
        ...(statusCode >= 400 ? { requestId: res.locals.requestId as string | undefined } : {}),
        timestamp: new Date().toISOString()
    });
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

function respondWithServiceError(
    res: Response,
    error: unknown,
    operation: string,
    domainContext: SafeSentryContext = {}
) {
    return handleServerError(res.req, res, error, operation, domainContext);
}

function ensureSameUser(res: Response, userId: string): boolean {
    const apiKeyUserId = res.locals.apiKeyUserId as string | undefined;
    if (apiKeyUserId && apiKeyUserId !== userId) {
        sendErrorResponse(res, 403, 'API key does not belong to this user');
        return false;
    }
    return true;
}

async function readDiscordRequesterId(req: Request): Promise<string | null> {
    const authHeader = req.header('authorization');
    if (!authHeader?.toLowerCase().startsWith('bearer ')) {
        return null;
    }

    addSafeBreadcrumb('http.client', 'Discord requester verification started', {
        provider: 'discord',
        endpoint: '/users/@me'
    });
    const response = await fetch('https://discord.com/api/v10/users/@me', {
        headers: { Authorization: authHeader }
    });
    if (!response.ok) {
        addSafeBreadcrumb('http.client', 'Discord requester verification failed', {
            provider: 'discord',
            status: response.status
        });
        return null;
    }
    const user = await response.json() as { id?: unknown };
    return typeof user.id === 'string' ? user.id : null;
}

async function requireRequesterId(req: Request, res: Response): Promise<string | null> {
    const userId = await readDiscordRequesterId(req);
    if (!userId) {
        sendErrorResponse(res, 401, 'Discord authentication is required');
        return null;
    }
    setAuthenticatedUser(res, userId);
    return userId;
}

app.get('/api/users/:userId/api-key', async (req, res) => {
    const { userId } = req.params;
    if (!userId) {
        return sendErrorResponse(res, 400, 'User id is required');
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
        respondWithServiceError(res, error, 'api_key.fetch');
    }
});

app.post('/api/users/:userId/api-key', async (req, res) => {
    const { userId } = req.params;
    if (!userId) {
        return sendErrorResponse(res, 400, 'User id is required');
    }

    if (!ensureSameUser(res, userId)) {
        return;
    }

    try {
        const payload = await generateUserApiKey(userId);
        res.json({ success: true, data: payload });
    } catch (error) {
        respondWithServiceError(res, error, 'api_key.generate');
    }
});

app.delete('/api/users/:userId/api-key', async (req, res) => {
    const { userId } = req.params;
    if (!userId) {
        return sendErrorResponse(res, 400, 'User id is required');
    }

    if (!ensureSameUser(res, userId)) {
        return;
    }

    try {
        await revokeUserApiKey(userId);
        res.json({ success: true, data: { apiKey: null } });
    } catch (error) {
        respondWithServiceError(res, error, 'api_key.revoke');
    }
});

app.get('/api/users/:userId/preferences', async (req, res) => {
    const { userId } = req.params;
    if (!userId) {
        return sendErrorResponse(res, 400, 'User id is required');
    }

    if (!ensureSameUser(res, userId)) {
        return;
    }

    try {
        const user = await getUser(userId);
        if (!user) {
            return sendErrorResponse(res, 404, 'User not found');
        }

        res.json({ success: true, data: { theme: user.theme ?? 'dark' } });
    } catch (error) {
        respondWithServiceError(res, error, 'user_preferences.fetch');
    }
});

app.patch('/api/users/:userId/preferences', async (req, res) => {
    const { userId } = req.params;
    if (!userId) {
        return sendErrorResponse(res, 400, 'User id is required');
    }

    if (!ensureSameUser(res, userId)) {
        return;
    }

    if (!req.body || typeof req.body !== 'object') {
        return sendErrorResponse(res, 400, 'Request body is required');
    }

    const theme = (req.body as { theme?: unknown }).theme;
    if (!isAppTheme(theme)) {
        return sendErrorResponse(res, 400, 'Invalid theme preference');
    }

    try {
        const user = await getUser(userId);
        if (!user) {
            return sendErrorResponse(res, 404, 'User not found');
        }

        const savedTheme = await updateUserTheme(userId, theme);
        res.json({ success: true, data: { theme: savedTheme } });
    } catch (error) {
        respondWithServiceError(res, error, 'user_preferences.update', { theme });
    }
});

app.get('/api/articles', async (req, res) => {
    try {
        const articles = await listPublicArticles({
            search: req.query.search,
            tags: req.query.tags,
            limit: req.query.limit,
            offset: req.query.offset
        });
        res.json({ success: true, data: { articles } });
    } catch (error) {
        respondWithServiceError(res, error, 'article.list_public');
    }
});

app.get('/api/articles/news', async (req, res) => {
    try {
        const articles = await listNewsArticles(req.query.limit);
        res.json({ success: true, data: { articles } });
    } catch (error) {
        respondWithServiceError(res, error, 'article.list_news');
    }
});

app.get('/api/articles/tags', async (_req, res) => {
    try {
        const tags = await listTags();
        res.json({ success: true, data: { tags } });
    } catch (error) {
        respondWithServiceError(res, error, 'article_tag.list');
    }
});

app.get('/api/articles/:slug', async (req, res) => {
    try {
        const article = await getPublicArticle(req.params.slug);
        res.json({ success: true, data: { article } });
    } catch (error) {
        respondWithServiceError(res, error, 'article.fetch_public');
    }
});

app.get('/api/admin/users', async (req, res) => {
    const userId = await requireRequesterId(req, res);
    if (!userId) return;
    try {
        const users = await listAdminUsers(userId);
        res.json({ success: true, data: { users } });
    } catch (error) {
        respondWithServiceError(res, error, 'admin_user.list');
    }
});

app.patch('/api/admin/users/:targetUserId/role', async (req, res) => {
    const userId = await requireRequesterId(req, res);
    if (!userId) return;
    try {
        const user = await updateUserRole(userId, req.params.targetUserId, (req.body as { role?: unknown }).role);
        res.json({ success: true, data: { user } });
    } catch (error) {
        respondWithServiceError(res, error, 'admin_user.update_role');
    }
});

app.get('/api/admin/articles', async (req, res) => {
    const userId = await requireRequesterId(req, res);
    if (!userId) return;
    try {
        const articles = await listAdminArticles(userId, {
            search: req.query.search,
            tags: req.query.tags,
            statuses: req.query.statuses,
            archived: req.query.archived,
            limit: req.query.limit,
            offset: req.query.offset
        });
        res.json({ success: true, data: { articles } });
    } catch (error) {
        respondWithServiceError(res, error, 'article.list_admin');
    }
});

app.get('/api/admin/articles/detail/:articleId', async (req, res) => {
    const userId = await requireRequesterId(req, res);
    if (!userId) return;
    try {
        const article = await getAdminArticle(userId, req.params.articleId);
        res.json({ success: true, data: { article } });
    } catch (error) {
        respondWithServiceError(res, error, 'article.fetch_admin');
    }
});

app.post('/api/admin/articles', async (req, res) => {
    const userId = await requireRequesterId(req, res);
    if (!userId) return;
    try {
        const article = await createArticle(userId, req.body as { title?: unknown; introduction?: unknown; markdownSource?: unknown; tagIds?: unknown; status?: unknown; publishedAt?: unknown; draftId?: unknown });
        res.json({ success: true, data: { article } });
    } catch (error) {
        respondWithServiceError(res, error, 'article.create');
    }
});

app.patch('/api/admin/articles/:articleId', async (req, res) => {
    const userId = await requireRequesterId(req, res);
    if (!userId) return;
    try {
        const article = await updateArticle(userId, req.params.articleId, req.body as { title?: unknown; introduction?: unknown; markdownSource?: unknown; tagIds?: unknown });
        res.json({ success: true, data: { article } });
    } catch (error) {
        respondWithServiceError(res, error, 'article.update');
    }
});

app.post('/api/admin/articles/:articleId/publication', async (req, res) => {
    const userId = await requireRequesterId(req, res);
    if (!userId) return;
    try {
        const body = req.body as { published?: unknown; publishedAt?: unknown };
        const article = await setArticlePublication(userId, req.params.articleId, { published: body.published === true, publishedAt: body.publishedAt });
        res.json({ success: true, data: { article } });
    } catch (error) {
        respondWithServiceError(res, error, 'article.update_publication');
    }
});

app.post('/api/admin/articles/:articleId/archive', async (req, res) => {
    const userId = await requireRequesterId(req, res);
    if (!userId) return;
    try {
        const article = await archiveArticle(userId, req.params.articleId);
        res.json({ success: true, data: { article } });
    } catch (error) {
        respondWithServiceError(res, error, 'article.archive');
    }
});

app.post('/api/admin/articles/preview', async (req, res) => {
    const userId = await requireRequesterId(req, res);
    if (!userId) return;
    try {
        await requireAdmin(userId);
        const preview = previewMarkdown((req.body as { markdownSource?: unknown }).markdownSource);
        res.json({ success: true, data: preview });
    } catch (error) {
        respondWithServiceError(res, error, 'article.preview');
    }
});

app.post('/api/admin/articles/tags', async (req, res) => {
    const userId = await requireRequesterId(req, res);
    if (!userId) return;
    try {
        const tag = await createTag(userId, (req.body as { name?: unknown }).name);
        res.json({ success: true, data: { tag } });
    } catch (error) {
        respondWithServiceError(res, error, 'article_tag.create');
    }
});

app.patch('/api/admin/articles/tags/:tagId', async (req, res) => {
    const userId = await requireRequesterId(req, res);
    if (!userId) return;
    try {
        const tag = await renameTag(userId, req.params.tagId, (req.body as { name?: unknown }).name);
        res.json({ success: true, data: { tag } });
    } catch (error) {
        respondWithServiceError(res, error, 'article_tag.rename');
    }
});

app.delete('/api/admin/articles/tags/:tagId', async (req, res) => {
    const userId = await requireRequesterId(req, res);
    if (!userId) return;
    try {
        await removeTag(userId, req.params.tagId);
        res.json({ success: true, data: { tagId: req.params.tagId } });
    } catch (error) {
        respondWithServiceError(res, error, 'article_tag.delete');
    }
});

app.get('/api/admin/articles/drafts', async (req, res) => {
    const userId = await requireRequesterId(req, res);
    if (!userId) return;
    try {
        const drafts = await listOwnerDrafts(userId);
        res.json({ success: true, data: { drafts } });
    } catch (error) {
        respondWithServiceError(res, error, 'article_draft.list');
    }
});

app.post('/api/admin/articles/drafts', async (req, res) => {
    const userId = await requireRequesterId(req, res);
    if (!userId) return;
    try {
        const draft = await saveDraft(userId, req.body as { id?: unknown; title?: unknown; introduction?: unknown; markdownSource?: unknown; selectedTagIds?: unknown });
        res.json({ success: true, data: { draft } });
    } catch (error) {
        respondWithServiceError(res, error, 'article_draft.save');
    }
});

app.delete('/api/admin/articles/drafts/:draftId', async (req, res) => {
    const userId = await requireRequesterId(req, res);
    if (!userId) return;
    try {
        await removeDraft(userId, req.params.draftId);
        res.json({ success: true, data: { draftId: req.params.draftId } });
    } catch (error) {
        respondWithServiceError(res, error, 'article_draft.delete');
    }
});

app.get('/api/rooms', async (_req, res) => {
    const userId = res.locals.apiKeyUserId as string | undefined;
    if (!userId) {
        return sendErrorResponse(res, 401, 'API key is required to list rooms');
    }

    try {
        const rooms = await listRoomsForUser(userId);
        res.json({ success: true, data: { rooms } });
    } catch (error) {
        respondWithServiceError(res, error, 'room.list_for_user');
    }
});

app.post('/api/rooms', async (req, res) => {
    if (!req.body || typeof req.body !== 'object') {
        return sendErrorResponse(res, 400, 'Request body is required');
    }

    const payload = req.body as RoomsAction;
    if (!('action' in payload)) {
        return sendErrorResponse(res, 400, 'Missing action');
    }

    try {
        addSafeBreadcrumb('room.action', 'Room action selected', {
            action: payload.action,
            roomId: 'payload' in payload && 'roomId' in payload.payload ? payload.payload.roomId : undefined,
            userId: 'payload' in payload && 'userId' in payload.payload ? payload.payload.userId : undefined
        });
        const data = await handleRoomsAction(payload);
        res.json({ success: true, data });
    } catch (error) {
        respondWithServiceError(res, error, `room.action.${payload.action}`, {
            action: payload.action,
            roomId: 'payload' in payload && 'roomId' in payload.payload ? payload.payload.roomId : undefined,
            userId: 'payload' in payload && 'userId' in payload.payload ? payload.payload.userId : undefined
        });
    }
});

app.get('/api/rooms/:roomId/members', async (req, res) => {
    const { roomId } = req.params;
    const userId = res.locals.apiKeyUserId as string | undefined;

    if (!userId) {
        return sendErrorResponse(res, 401, 'API key is required to list room members');
    }
    if (!roomId) {
        return sendErrorResponse(res, 400, 'Room id is required');
    }

    try {
        const members = await listRoomMembersForUser({ roomId, userId });
        res.json({ success: true, data: { roomId, members } });
    } catch (error) {
        respondWithServiceError(res, error, 'room.members.list', { roomId, userId });
    }
});

app.post('/api/discord', async (req, res) => {
    if (!req.body || typeof req.body !== 'object') {
        return sendErrorResponse(res, 400, 'Request body is required');
    }

    const body = req.body as DiscordQueryPayload;
    const queryType = body.queryType ?? 'user';

    try {
        addSafeBreadcrumb('discord', 'Discord query selected', { queryType });
        const data = await handleDiscordQuery({ ...body, queryType });
        res.json({ success: true, data, queryType });
    } catch (error) {
        respondWithServiceError(res, error, 'discord.query', { queryType });
    }
});

app.get('/api/rooms/:roomId/dice-rolls', async (req, res) => {
    const { roomId } = req.params;
    const limit = typeof req.query.limit === 'string' ? Number(req.query.limit) : undefined;
    const since = typeof req.query.since === 'string' ? req.query.since : undefined;

    if (!roomId) {
        return sendErrorResponse(res, 400, 'Room id is required');
    }

    try {
        const diceRolls = await listRoomDiceRolls({ roomId, limit, since });
        res.json({ success: true, data: { roomId, diceRolls } });
    } catch (error) {
        respondWithServiceError(res, error, 'room.dice_rolls.list', { roomId, limit, since });
    }
});

// Keep Sentry's Express request isolation and normalized request metadata, while
// the application-owned handler below remains the single error capture point.
Sentry.setupExpressErrorHandler(app, { shouldHandleError: () => false });

app.use((error: unknown, req: Request, res: Response, _next: NextFunction) => {
    return handleServerError(req, res, error, 'http.unhandled');
});

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
        const sentryEventId = Sentry.captureException(error, {
            tags: { operation: 'server.startup' },
            contexts: {
                runtime: {
                    environment: process.env.ENVIRONMENT ?? process.env.NODE_ENV,
                    release: process.env.SENTRY_RELEASE
                }
            }
        });
        logger.error(`Failed to start server: ${message}`, { ...meta, sentryEventId });
        await Sentry.flush(2_000);
        process.exit(1);
    }
}

void startServer();

export { app };
