import { ensureDatabaseSetup } from '../core/database/schema';
import { insertRoom, listRooms, getRoomByInviteCode, getRoomById, touchRoom, updateRoomName } from '../core/database/tables/rooms.table';
import { upsertMember, countMembers, listMembers, getMember, updateMemberNickname } from '../core/database/tables/room-members.table';
import { insertMessage, listMessages, listDiceMessages } from '../core/database/tables/room-messages.table';
import { deleteRoomDice, getRoomDice, insertRoomDice, listRoomDices, updateRoomDice as updateRoomDiceRecord } from '../core/database/tables/room-dices.table';
import { getUser } from '../core/database/tables/users.table';
import type { DatabaseRoom, DatabaseRoomDice, DatabaseRoomMemberWithUser, DatabaseRoomMessage } from '../core/types/database.types';
import type { RoomDetails, RoomDice, RoomMemberDetails, RoomMessage } from '../core/types/data.types';
import { createRoomId, generateInviteCode } from '../core/utils/id';
import { hashPassword, verifyPassword } from '../core/utils/password';

const ROOM_NAME_MAX_LENGTH = 80;
const NICKNAME_MAX_LENGTH = 40;
const DICE_NOTATION_MAX_LENGTH = 64;
const DICE_DESCRIPTION_MAX_LENGTH = 255;
const DICE_NOTATION_REGEX = /^(\d+)?d(\d+)([+-]\d+)?$/i;

export type RoomsAction =
    | { action: 'list' }
    | { action: 'create'; payload: { name: string; password?: string | null; userId: string } }
    | { action: 'join'; payload: { inviteCode: string; password?: string | null; userId: string } }
    | { action: 'messages'; payload: { roomId: string; limit?: number; since?: string } }
    | { action: 'members'; payload: { roomId: string } }
    | { action: 'member'; payload: { roomId: string; userId: string } }
    | { action: 'updateRoom'; payload: { roomId: string; userId: string; name: string } }
    | { action: 'updateNickname'; payload: { roomId: string; userId: string; nickname?: string | null } }
    | { action: 'message'; payload: { roomId: string; userId: string; content?: string; type: 'text' | 'dice'; dice?: { notation: string; total: number; rolls: number[] } } }
    | { action: 'roomDices'; payload: { roomId: string; userId: string } }
    | { action: 'createDice'; payload: { roomId: string; userId: string; notation: string; description?: string | null } }
    | { action: 'updateDice'; payload: { roomId: string; userId: string; diceId: string; notation: string; description?: string | null } }
    | { action: 'deleteDice'; payload: { roomId: string; userId: string; diceId: string } };

export type RoomsActionResponse =
    | { rooms: RoomDetails[] }
    | { room: RoomDetails }
    | { roomId: string; messages: RoomMessage[] }
    | { roomId: string; members: RoomMemberDetails[] }
    | { member: RoomMemberDetails }
    | { message: RoomMessage }
    | { roomId: string; dices: RoomDice[] }
    | { dice: RoomDice }
    | { diceId: string };

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
        case 'member':
            return { member: await handleGetMember(payload.payload) };
        case 'updateRoom':
            return { room: await handleUpdateRoom(payload.payload) };
        case 'updateNickname':
            return { member: await handleUpdateNickname(payload.payload) };
        case 'message':
            return { message: await handleSendMessage(payload.payload) };
        case 'roomDices':
            return { roomId: payload.payload.roomId, dices: await handleListRoomDices(payload.payload) };
        case 'createDice':
            return { dice: await handleCreateRoomDice(payload.payload) };
        case 'updateDice':
            return { dice: await handleUpdateRoomDice(payload.payload) };
        case 'deleteDice':
            await handleDeleteRoomDice(payload.payload);
            return { diceId: payload.payload.diceId };
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
    if (trimmedName.length > ROOM_NAME_MAX_LENGTH) {
        throw new Error(`Room name is too long (max ${ROOM_NAME_MAX_LENGTH} characters)`);
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

async function handleGetMember(payload: { roomId: string; userId: string }): Promise<RoomMemberDetails> {
    if (!payload.roomId) throw new Error('Room id missing');
    if (!payload.userId) throw new Error('User id missing');

    const room = await getRoomById(payload.roomId);
    if (!room) throw new Error('Room not found');

    let member = await getMember(payload.roomId, payload.userId);
    if (!member) {
        await upsertMember(payload.roomId, payload.userId);
        member = await getMember(payload.roomId, payload.userId);
    }
    if (!member) throw new Error('Member not found');

    return mapMemberRecord(member);
}

async function handleUpdateRoom(payload: { roomId: string; userId: string; name: string }): Promise<RoomDetails> {
    if (!payload.roomId) throw new Error('Room id missing');
    if (!payload.userId) throw new Error('User id missing');

    const trimmedName = payload.name?.trim();
    if (!trimmedName) {
        throw new Error('Room name is required');
    }
    if (trimmedName.length > ROOM_NAME_MAX_LENGTH) {
        throw new Error(`Room name is too long (max ${ROOM_NAME_MAX_LENGTH} characters)`);
    }

    const room = await getRoomById(payload.roomId);
    if (!room) throw new Error('Room not found');
    if (!room.created_by || room.created_by !== payload.userId) {
        throw new Error('Only the room creator can rename this room');
    }

    const updated = await updateRoomName(payload.roomId, trimmedName);
    if (!updated) throw new Error('Failed to update room');

    const memberCount = await countMembers(payload.roomId);
    return mapRoomToSummary({ ...updated, member_count: memberCount });
}

async function handleUpdateNickname(payload: { roomId: string; userId: string; nickname?: string | null }): Promise<RoomMemberDetails> {
    if (!payload.roomId) throw new Error('Room id missing');
    if (!payload.userId) throw new Error('User id missing');

    const room = await getRoomById(payload.roomId);
    if (!room) throw new Error('Room not found');

    const normalizedNickname = payload.nickname?.trim() ?? '';
    if (normalizedNickname.length > NICKNAME_MAX_LENGTH) {
        throw new Error(`Nickname is too long (max ${NICKNAME_MAX_LENGTH} characters)`);
    }

    let member = await getMember(payload.roomId, payload.userId);
    if (!member) {
        await upsertMember(payload.roomId, payload.userId);
        member = await getMember(payload.roomId, payload.userId);
    }
    if (!member) throw new Error('Member not found');

    const nicknameValue = normalizedNickname.length > 0 ? normalizedNickname : null;
    await updateMemberNickname(payload.roomId, payload.userId, nicknameValue);

    const refreshed = await getMember(payload.roomId, payload.userId);
    if (!refreshed) throw new Error('Failed to update nickname');
    return mapMemberRecord(refreshed);
}

async function handleListRoomDices(payload: { roomId: string; userId: string }): Promise<RoomDice[]> {
    const { room } = await ensureRoomMembership(payload.roomId, payload.userId);
    const rows = await listRoomDices(room.id);
    return rows.map(mapRoomDiceRecord);
}

async function handleCreateRoomDice(payload: { roomId: string; userId: string; notation: string; description?: string | null }): Promise<RoomDice> {
    const { room } = await ensureRoomMembership(payload.roomId, payload.userId);
    const notation = normalizeDiceNotation(payload.notation);
    const description = normalizeDiceDescription(payload.description);
    const created = await insertRoomDice({
        room_id: room.id,
        created_by: payload.userId,
        notation,
        description,
    });
    return mapRoomDiceRecord(created);
}

async function handleUpdateRoomDice(payload: { roomId: string; userId: string; diceId: string; notation: string; description?: string | null }): Promise<RoomDice> {
    if (!payload.diceId) throw new Error('Dice id missing');
    const { room } = await ensureRoomMembership(payload.roomId, payload.userId);
    const existing = await getRoomDice(payload.diceId);
    if (!existing || existing.room_id !== room.id) {
        throw new Error('Dice not found');
    }
    const notation = normalizeDiceNotation(payload.notation);
    const description = normalizeDiceDescription(payload.description);
    const updated = await updateRoomDiceRecord(payload.diceId, { notation, description });
    if (!updated) throw new Error('Failed to update dice');
    return mapRoomDiceRecord(updated);
}

async function handleDeleteRoomDice(payload: { roomId: string; userId: string; diceId: string }): Promise<void> {
    if (!payload.diceId) throw new Error('Dice id missing');
    const { room } = await ensureRoomMembership(payload.roomId, payload.userId);
    const existing = await getRoomDice(payload.diceId);
    if (!existing || existing.room_id !== room.id) {
        throw new Error('Dice not found');
    }
    await deleteRoomDice(payload.diceId);
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

async function ensureRoomMembership(roomId: string, userId: string) {
    if (!roomId) throw new Error('Room id missing');
    if (!userId) throw new Error('User id missing');

    const room = await getRoomById(roomId);
    if (!room) throw new Error('Room not found');

    const member = await getMember(roomId, userId);
    if (!member) {
        throw new Error('You must join this room to manage dice');
    }

    return { room, member };
}

function normalizeDiceNotation(value: string): string {
    const trimmed = value?.trim().toLowerCase();
    if (!trimmed) {
        throw new Error('Dice notation is required');
    }
    if (trimmed.length > DICE_NOTATION_MAX_LENGTH) {
        throw new Error(`Dice notation is too long (max ${DICE_NOTATION_MAX_LENGTH} characters)`);
    }
    if (!DICE_NOTATION_REGEX.test(trimmed)) {
        throw new Error('Invalid dice notation');
    }
    return trimmed;
}

function normalizeDiceDescription(value?: string | null): string | null {
    const trimmed = value?.trim() ?? '';
    if (!trimmed) return null;
    if (trimmed.length > DICE_DESCRIPTION_MAX_LENGTH) {
        throw new Error(`Description is too long (max ${DICE_DESCRIPTION_MAX_LENGTH} characters)`);
    }
    return trimmed;
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

function mapRoomDiceRecord(record: DatabaseRoomDice): RoomDice {
    return {
        id: record.id,
        roomId: record.room_id,
        notation: record.notation,
        description: record.description ?? undefined,
        createdBy: record.created_by ?? undefined,
        createdAt: record.created_at ?? undefined,
        updatedAt: record.updated_at ?? undefined,
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
        createdAt: record.created_at,
        nickname: record.member_nickname ?? undefined
    };
}

function mapMemberRecord(record: DatabaseRoomMemberWithUser): RoomMemberDetails {
    return {
        userId: record.user_id,
        username: record.username ?? undefined,
        avatar: record.avatar ?? undefined,
        joinedAt: record.joined_at ?? undefined,
        lastSeen: record.last_seen ?? undefined,
        nickname: record.nickname ?? undefined
    };
}
