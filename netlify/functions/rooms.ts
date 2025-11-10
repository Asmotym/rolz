import type { Handler } from '@netlify/functions';
import { ensureDatabaseSetup } from '../core/database/schema';
import { insertRoom, listRooms, getRoomByInviteCode, getRoomById, touchRoom } from '../core/database/tables/rooms.table';
import { upsertMember, countMembers } from '../core/database/tables/room-members.table';
import { insertMessage, listMessages } from '../core/database/tables/room-messages.table';
import { getUser } from '../core/database/tables/users.table';
import type { DatabaseRoom, DatabaseRoomMessage } from '../core/types/database.types';
import type { RoomDetails, RoomMessage } from '../core/types/data.types';
import { createRoomId, generateInviteCode } from '../core/utils/id';
import { hashPassword, verifyPassword } from '../core/utils/password';
import { createLogger } from '../core/utils/logger';

const logger = createLogger('RoomsFunction');
const headers = {
    'Access-Control-Allow-Origin': process.env.FRONTEND_URL || '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Credentials': 'true'
};

type RoomsAction =
    | { action: 'list' }
    | { action: 'create'; payload: { name: string; password?: string | null; userId: string } }
    | { action: 'join'; payload: { inviteCode: string; password?: string | null; userId: string } }
    | { action: 'messages'; payload: { roomId: string; limit?: number; since?: string } }
    | { action: 'message'; payload: { roomId: string; userId: string; content?: string; type: 'text' | 'dice'; dice?: { notation: string; total: number; rolls: number[] } } };

export const handler: Handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ success: false, error: 'Method not allowed' })
        };
    }

    try {
        await ensureDatabaseSetup();

        if (!event.body) {
            return { statusCode: 400, headers, body: JSON.stringify({ success: false, error: 'Missing body' }) };
        }

        const payload = JSON.parse(event.body) as RoomsAction;

        switch (payload.action) {
            case 'list': {
                const rooms = await listRooms();
                return successResponse({ rooms: rooms.map(mapRoomToSummary) });
            }
            case 'create':
                return successResponse({ room: await handleCreateRoom(payload.payload) });
            case 'join':
                return successResponse({ room: await handleJoinRoom(payload.payload) });
            case 'messages':
                return successResponse({ roomId: payload.payload.roomId, messages: await handleListMessages(payload.payload) });
            case 'message':
                return successResponse({ message: await handleSendMessage(payload.payload) });
            default:
                return { statusCode: 400, headers, body: JSON.stringify({ success: false, error: 'Unknown action' }) };
        }
    } catch (error) {
        logger.error(error instanceof Error ? error.message : 'Unknown error');
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unexpected error' })
        };
    }
};

async function handleCreateRoom(payload: { name: string; password?: string | null; userId: string }): Promise<RoomDetails> {
    if (!payload.name?.trim()) {
        throw new Error('Room name is required');
    }
    if (!payload.userId) {
        throw new Error('User id is required');
    }

    const creator = await getUser(payload.userId);
    if (!creator) {
        throw new Error('Unknown user');
    }

    const inviteCode = await generateUniqueInviteCode();
    const roomId = createRoomId();
    const trimmedName = payload.name.trim();
    if (trimmedName.length > 80) {
        throw new Error('Room name is too long (max 80 characters)');
    }

    const normalizedPassword = payload.password?.trim();
    if (normalizedPassword && normalizedPassword.length < 4) {
        throw new Error('Password must be at least 4 characters long');
    }

    const passwordData = normalizedPassword ? hashPassword(normalizedPassword) : undefined;

    const room = await insertRoom({
        id: roomId,
        name: trimmedName,
        invite_code: inviteCode,
        password_hash: passwordData?.hash ?? null,
        password_salt: passwordData?.salt ?? null,
        created_by: payload.userId
    });

    await upsertMember(room.id, payload.userId);
    const memberCount = await countMembers(room.id);

    return mapRoomToSummary({ ...room, member_count: memberCount });
}

async function handleJoinRoom(payload: { inviteCode: string; password?: string | null; userId: string }): Promise<RoomDetails> {
    if (!payload.inviteCode?.trim()) throw new Error('Invite code is required');
    if (!payload.userId) throw new Error('User id is required');

    const room = await getRoomByInviteCode(payload.inviteCode.trim().toUpperCase());
    if (!room) throw new Error('Room not found');

    if (room.password_hash) {
        const providedPassword = payload.password?.trim();
        if (!providedPassword) throw new Error('Password required');
        const valid = verifyPassword(providedPassword, room.password_hash, room.password_salt);
        if (!valid) throw new Error('Invalid password');
    }

    await upsertMember(room.id, payload.userId);
    const memberCount = await countMembers(room.id);

    return mapRoomToSummary({ ...room, member_count: memberCount });
}

async function handleListMessages(payload: { roomId: string; limit?: number; since?: string }): Promise<RoomMessage[]> {
    if (!payload.roomId) throw new Error('Room id missing');
    const room = await getRoomById(payload.roomId);
    if (!room) throw new Error('Room not found');

    const rows = await listMessages(payload.roomId, { limit: payload.limit, since: payload.since });
    return rows.map(mapMessageRecord);
}

async function handleSendMessage(payload: { roomId: string; userId: string; content?: string; type: 'text' | 'dice'; dice?: { notation: string; total: number; rolls: number[] } }): Promise<RoomMessage> {
    if (!payload.roomId) throw new Error('Room id missing');
    if (!payload.userId) throw new Error('User id missing');
    if (payload.type === 'text' && !payload.content?.trim()) {
        throw new Error('Message content missing');
    }
    if (payload.type === 'dice' && !payload.dice) {
        throw new Error('Dice payload missing');
    }

    const room = await getRoomById(payload.roomId);
    if (!room) throw new Error('Room not found');

    const author = await getUser(payload.userId);
    if (!author) throw new Error('Unknown user');

    await upsertMember(payload.roomId, payload.userId);

    const diceNotation = payload.dice?.notation?.trim();
    const diceTotal = payload.dice ? Number(payload.dice.total) : undefined;
    const diceRolls = payload.dice ? payload.dice.rolls.map((roll) => Number(roll)) : undefined;

    const saved = await insertMessage({
        room_id: payload.roomId,
        user_id: payload.userId,
        content: payload.type === 'text' ? payload.content?.trim() ?? '' : `Rolled ${payload.dice?.notation}`,
        type: payload.type,
        dice_notation: diceNotation,
        dice_total: diceTotal,
        dice_rolls: diceRolls
    });

    await touchRoom(payload.roomId);

    return mapMessageRecord(saved);
}

async function generateUniqueInviteCode(): Promise<string> {
    for (let attempt = 0; attempt < 10; attempt++) {
        const code = generateInviteCode().toUpperCase();
        const existing = await getRoomByInviteCode(code);
        if (!existing) return code;
    }
    throw new Error('Failed to generate invite code, please retry');
}

function mapRoomToSummary(room: DatabaseRoom): RoomDetails {
    const lastActivity = room.last_activity ?? room.updated_at ?? room.created_at ?? null;
    return {
        id: room.id,
        name: room.name,
        inviteCode: room.invite_code,
        isProtected: Boolean(room.password_hash),
        memberCount: room.member_count ?? 0,
        lastActivity,
        createdBy: room.created_by,
        createdAt: room.created_at ?? undefined
    };
}

function mapMessageRecord(record: DatabaseRoomMessage): RoomMessage {
    const diceRolls = Array.isArray(record.dice_rolls)
        ? (record.dice_rolls as number[])
        : undefined;

    const diceTotal = record.dice_total !== null && record.dice_total !== undefined
        ? Number(record.dice_total)
        : undefined;

    return {
        id: record.id,
        roomId: record.room_id,
        userId: record.user_id,
        username: record.username ?? undefined,
        avatar: record.avatar ?? undefined,
        content: record.content ?? undefined,
        type: record.type,
        diceNotation: record.dice_notation ?? undefined,
        diceTotal,
        diceRolls,
        createdAt: record.created_at
    };
}

function successResponse(data: Record<string, unknown>) {
    return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, data })
    };
}
