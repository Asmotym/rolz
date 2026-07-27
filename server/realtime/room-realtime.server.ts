import type { Server } from 'http';
import { WebSocket, WebSocketServer } from 'ws';
import { DiscordClient } from '../core/discord/client';
import { isTrustedFrontendHost } from '../core/config/origins';
import { getMember, touchMember } from '../core/database/tables/room-members.table';
import { getUser } from '../core/database/tables/users.table';
import type { RoomRealtimeEvent } from '../core/types/data.types';
import { createLogger } from '../core/utils/logger';
import {
    createRoomRealtimeEvent,
    parseRoomRealtimeAuthentication,
    readRealtimeRoomId
} from './room-realtime.protocol';

const AUTHENTICATION_TIMEOUT_MS = 5_000;
const HEARTBEAT_INTERVAL_MS = 30_000;
const MAX_PAYLOAD_BYTES = 64 * 1024;
const logger = createLogger('RoomRealtime');
const discordClient = new DiscordClient();

interface AuthenticatedClient {
    roomId: string;
    userId: string;
    alive: boolean;
}

export interface RoomEventBroadcaster {
    broadcast(event: RoomRealtimeEvent): void;
    closeRoom(roomId: string, code?: number, reason?: string): void;
    closeMember(roomId: string, userId: string, code?: number, reason?: string): void;
}

class RoomRealtimeHub implements RoomEventBroadcaster {
    private readonly clients = new Map<string, Map<string, Set<WebSocket>>>();
    private readonly clientMetadata = new Map<WebSocket, AuthenticatedClient>();
    private server: WebSocketServer | null = null;
    private heartbeat: NodeJS.Timeout | null = null;

    attach(httpServer: Server): void {
        if (this.server) return;

        const webSocketServer = new WebSocketServer({
            noServer: true,
            maxPayload: MAX_PAYLOAD_BYTES,
            perMessageDeflate: false
        });
        this.server = webSocketServer;

        httpServer.on('upgrade', (request, socket, head) => {
            const roomId = readRealtimeRoomId(request.url, request.headers.host);
            if (!roomId) {
                rejectUpgrade(socket, 404, 'Not Found');
                return;
            }
            if (!isTrustedFrontendHost(request.headers.origin)) {
                rejectUpgrade(socket, 403, 'Forbidden');
                return;
            }

            webSocketServer.handleUpgrade(request, socket, head, (webSocket) => {
                this.handleConnection(webSocket, roomId);
            });
        });

        this.heartbeat = setInterval(() => this.runHeartbeat(), HEARTBEAT_INTERVAL_MS);
        this.heartbeat.unref();
    }

    broadcast(event: RoomRealtimeEvent): void {
        const roomClients = this.clients.get(event.roomId);
        if (!roomClients) return;
        const serialized = JSON.stringify(event);

        for (const sockets of roomClients.values()) {
            for (const socket of sockets) {
                if (socket.readyState !== WebSocket.OPEN) continue;
                socket.send(serialized, (error) => {
                    if (error) {
                        logger.warn('Failed to deliver room event', {
                            roomId: event.roomId,
                            eventType: event.type
                        });
                    }
                });
            }
        }
    }

    closeRoom(roomId: string, code = 4004, reason = 'Room unavailable'): void {
        const roomClients = this.clients.get(roomId);
        if (!roomClients) return;
        for (const sockets of roomClients.values()) {
            for (const socket of sockets) {
                socket.close(code, reason);
            }
        }
    }

    closeMember(roomId: string, userId: string, code = 4003, reason = 'Membership ended'): void {
        const sockets = this.clients.get(roomId)?.get(userId);
        if (!sockets) return;
        for (const socket of sockets) {
            socket.close(code, reason);
        }
    }

    private handleConnection(webSocket: WebSocket, roomId: string): void {
        let authenticated = false;
        const authenticationTimer = setTimeout(() => {
            if (!authenticated) {
                webSocket.close(4001, 'Authentication required');
            }
        }, AUTHENTICATION_TIMEOUT_MS);

        webSocket.once('message', async (data, isBinary) => {
            if (isBinary) {
                clearTimeout(authenticationTimer);
                webSocket.close(4002, 'Invalid authentication');
                return;
            }

            try {
                const authentication = parseRoomRealtimeAuthentication(data);
                if (!authentication) {
                    throw new Error('Invalid authentication frame');
                }

                const discordUser = await discordClient.getUserInfo({
                    tokenType: authentication.tokenType,
                    accessToken: authentication.accessToken,
                    expiresIn: 0,
                    expiresAt: 0,
                    scope: '',
                    state: ''
                });
                const [storedUser, member] = await Promise.all([
                    getUser(discordUser.id),
                    getMember(roomId, discordUser.id)
                ]);
                if (!storedUser || !member) {
                    webSocket.close(4003, 'Room access denied');
                    return;
                }

                authenticated = true;
                clearTimeout(authenticationTimer);
                await touchMember(roomId, discordUser.id);
                if (webSocket.readyState !== WebSocket.OPEN) return;
                this.register(webSocket, roomId, discordUser.id);
            } catch (error) {
                logger.warn('WebSocket authentication failed', {
                    roomId,
                    error: error instanceof Error ? error.name : 'UnknownError'
                });
                webSocket.close(4001, 'Authentication failed');
            }
        });

        webSocket.on('message', (_data, _isBinary) => {
            if (authenticated) {
                webSocket.close(4002, 'Client messages are not supported');
            }
        });
        webSocket.on('pong', () => {
            const metadata = this.clientMetadata.get(webSocket);
            if (metadata) metadata.alive = true;
        });
        webSocket.on('close', (code) => {
            clearTimeout(authenticationTimer);
            void this.unregister(webSocket, code);
        });
        webSocket.on('error', () => {
            const metadata = this.clientMetadata.get(webSocket);
            logger.warn('Room WebSocket error', {
                roomId: metadata?.roomId ?? roomId,
                userId: metadata?.userId,
                authenticated: Boolean(metadata)
            });
        });
    }

    private register(webSocket: WebSocket, roomId: string, userId: string): void {
        let roomClients = this.clients.get(roomId);
        if (!roomClients) {
            roomClients = new Map();
            this.clients.set(roomId, roomClients);
        }
        let userClients = roomClients.get(userId);
        const firstConnection = !userClients || userClients.size === 0;
        if (!userClients) {
            userClients = new Set();
            roomClients.set(userId, userClients);
        }
        userClients.add(webSocket);
        this.clientMetadata.set(webSocket, { roomId, userId, alive: true });

        const ready = createRoomRealtimeEvent(roomId, { type: 'connection.ready' });
        webSocket.send(JSON.stringify(ready));
        const now = new Date().toISOString();
        for (const connectedUserId of roomClients.keys()) {
            const presence = createRoomRealtimeEvent(roomId, {
                type: 'presence.updated',
                userId: connectedUserId,
                isOnline: true,
                lastSeen: now
            });
            webSocket.send(JSON.stringify(presence));
        }
        if (firstConnection) {
            this.broadcast(createRoomRealtimeEvent(roomId, {
                type: 'presence.updated',
                userId,
                isOnline: true,
                lastSeen: now
            }));
        }
        logger.info('Room WebSocket authenticated', {
            roomId,
            userId,
            connections: this.clientMetadata.size
        });
    }

    private async unregister(webSocket: WebSocket, code: number): Promise<void> {
        const metadata = this.clientMetadata.get(webSocket);
        if (!metadata) return;
        this.clientMetadata.delete(webSocket);

        const roomClients = this.clients.get(metadata.roomId);
        const userClients = roomClients?.get(metadata.userId);
        userClients?.delete(webSocket);
        const lastConnection = !userClients || userClients.size === 0;
        if (lastConnection) {
            roomClients?.delete(metadata.userId);
        }
        if (roomClients?.size === 0) {
            this.clients.delete(metadata.roomId);
        }

        if (lastConnection) {
            await touchMember(metadata.roomId, metadata.userId).catch(() => undefined);
            this.broadcast(createRoomRealtimeEvent(metadata.roomId, {
                type: 'presence.updated',
                userId: metadata.userId,
                isOnline: false,
                lastSeen: new Date().toISOString()
            }));
        }
        logger.info('Room WebSocket disconnected', {
            roomId: metadata.roomId,
            userId: metadata.userId,
            code,
            connections: this.clientMetadata.size
        });
    }

    private runHeartbeat(): void {
        for (const [socket, metadata] of this.clientMetadata) {
            if (!metadata.alive) {
                socket.terminate();
                continue;
            }
            metadata.alive = false;
            socket.ping();
        }
    }
}

function rejectUpgrade(socket: NodeJS.WritableStream, status: number, message: string): void {
    socket.write(`HTTP/1.1 ${status} ${message}\r\nConnection: close\r\n\r\n`);
    if ('destroy' in socket && typeof socket.destroy === 'function') {
        socket.destroy();
    }
}

export const roomRealtimeHub = new RoomRealtimeHub();
