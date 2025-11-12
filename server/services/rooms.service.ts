import { ensureDatabaseSetup } from '../core/database/schema';
import { insertRoom, listRooms, getRoomByInviteCode, getRoomById, touchRoom } from '../core/database/tables/rooms.table';
import { upsertMember, countMembers, listMembers } from '../core/database/tables/room-members.table';
import { insertMessage, listMessages, listDiceMessages } from '../core/database/tables/room-messages.table';
import { getUser } from '../core/database/tables/users.table';
import type { DatabaseRoom, DatabaseRoomMemberWithUser, DatabaseRoomMessage } from '../core/types/database.types';
import type { RoomDetails, RoomMemberDetails, RoomMessage } from '../core/types/data.types';
import { createRoomId, generateInviteCode } from '../core/utils/id';
import { hashPassword, verifyPassword } from '../core/utils/password';

export type RoomsAction =
    | { action: 'list' }
    | { action: 'create'; payload: { name: string; password?: string | null; userId: string } }
    | { action: 'join'; payload: { inviteCode: string; password?: string | null; userId: string } }
    | { action: 'messages'; payload: { roomId: string; limit?: number; since?: string } }
    | { action: 'members'; payload: { roomId: string } }
    | { action: 'message'; payload: { roomId: string; userId: string; content?: string; type: 'text' | 'dice'; dice?: { notation: string; total: number; rolls: number[] } } };

export type RoomsActionResponse =
    | { rooms: RoomDetails[] }
    | { room: RoomDetails }
    | { roomId: string; messages: RoomMessage[] }
    | { roomId: string; members: RoomMemberDetails[] }
    | { message: RoomMessage };

export async function handleRoomsAction(payload: RoomsAction): Promise<RoomsActionResponse> {
    await ensureDatabaseSetup();

    switch (payload.action) {
        case 'list': {
            const rooms = await listRooms();
            return { rooms: rooms.map(mapRoomToSummary) };
        }
        case 'create':
            return { room: await handleCreateRoom(payload.payload) };
        case 'join':
            return { room: await handleJoinRoom(payload.payload) };
        case 'messages':
            return { roomId: payload.payload.roomId, messages: await handleListMessages(payload.payload) };
        case 'members':
            return { roomId: payload.payload.roomId, members: await handleListMembers(payload.payload) };
        case 'message':
            return { message: await handleSendMessage(payload.payload) };
        default:
            throw new Error('Unknown action');
    }
}

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

async function handleListMembers(payload: { roomId: string }): Promise<RoomMemberDetails[]> {
    if (!payload.roomId) throw new Error('Room id missing');
    const room = await getRoomById(payload.roomId);
    if (!room) throw new Error('Room not found');

    const rows = await listMembers(payload.roomId);
    return rows.map(mapMemberRecord);
}

const DEFAULT_DICE_LIMIT = 50;
const MAX_DICE_LIMIT = 200;

function sanitizeDiceLimit(limit?: number): number {
    const parsed = Number(limit);
    if (!Number.isFinite(parsed)) return DEFAULT_DICE_LIMIT;
    return Math.min(Math.max(Math.floor(parsed), 1), MAX_DICE_LIMIT);
}

export async function listRoomDiceRolls(payload: { roomId: string; limit?: number; since?: string }): Promise<RoomMessage[]> {
    await ensureDatabaseSetup();

    if (!payload.roomId) throw new Error('Room id missing');
    const room = await getRoomById(payload.roomId);
    if (!room) throw new Error('Room not found');

    const limit = sanitizeDiceLimit(payload.limit);
    const rows = await listDiceMessages(payload.roomId, { limit, since: payload.since });
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

    const trimmedContent = payload.content?.trim();
    const diceNotation = payload.dice?.notation?.trim();
    const diceTotal = payload.dice ? Number(payload.dice.total) : undefined;
    const diceRolls = payload.dice ? payload.dice.rolls.map((roll) => Number(roll)) : undefined;

    const saved = await insertMessage({
        room_id: payload.roomId,
        user_id: payload.userId,
        content: payload.type === 'text'
            ? trimmedContent ?? ''
            : trimmedContent ?? null,
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
    let diceRolls: number[] | undefined;
    if (Array.isArray(record.dice_rolls)) {
        diceRolls = record.dice_rolls as number[];
    } else if (typeof record.dice_rolls === 'string') {
        try {
            const parsed = JSON.parse(record.dice_rolls);
            diceRolls = Array.isArray(parsed) ? parsed.map((value) => Number(value)) : undefined;
        } catch {
            diceRolls = undefined;
        }
    }

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

function mapMemberRecord(record: DatabaseRoomMemberWithUser): RoomMemberDetails {
    return {
        userId: record.user_id,
        username: record.username ?? undefined,
        avatar: record.avatar ?? undefined,
        joinedAt: record.joined_at ?? undefined,
        lastSeen: record.last_seen ?? undefined
    };
}
