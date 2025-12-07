import { ensureDatabaseSetup } from '../core/database/schema';
import {
    insertRoom,
    listRooms,
    listUserRooms,
    getRoomByInviteCode,
    getRoomById,
    touchRoom,
    updateRoomName,
    setRoomArchived,
    updateRollAwardsSettings
} from '../core/database/tables/rooms.table';
import { upsertMember, countMembers, listMembers, getMember, updateMemberNickname, removeMember, touchMember } from '../core/database/tables/room-members.table';
import { insertMessage, listMessages, listDiceMessages } from '../core/database/tables/room-messages.table';
import { deleteRoomDice, getRoomDice, insertRoomDice, listRoomDices, updateRoomDice as updateRoomDiceRecord } from '../core/database/tables/room-dices.table';
import {
    assignCategoryToUncategorizedDice,
    getNextDiceCategorySortOrder,
    insertRoomDiceCategory,
    listRoomDiceCategories,
    setDefaultRoomDiceCategory
} from '../core/database/tables/room-dice-categories.table';
import {
    deleteRoomRollAward,
    getRoomRollAward,
    insertRoomRollAward,
    listRoomRollAwards,
    updateRoomRollAward
} from '../core/database/tables/room-roll-awards.table';
import { getUser } from '../core/database/tables/users.table';
import type {
    DatabaseRoom,
    DatabaseRoomDice,
    DatabaseRoomDiceCategory,
    DatabaseRoomMemberWithUser,
    DatabaseRoomMessage,
    DatabaseRoomRollAward
} from '../core/types/database.types';
import type { RoomDetails, RoomDice, RoomDiceCategory, RoomMemberDetails, RoomMessage, RoomRollAward } from '../core/types/data.types';
import { createRoomId, generateInviteCode } from '../core/utils/id';
import { hashPassword, verifyPassword } from '../core/utils/password';

const ROOM_NAME_MAX_LENGTH = 80;
const NICKNAME_MAX_LENGTH = 40;
const DICE_NOTATION_MAX_LENGTH = 64;
const DICE_DESCRIPTION_MAX_LENGTH = 255;
const DICE_CATEGORY_NAME_MAX_LENGTH = 80;
const DICE_NOTATION_REGEX = /^(\d+)?d(\d+)([+-]\d+)?$/i;
const ONLINE_MEMBER_WINDOW_MS = 1000 * 60 * 2;
const DEFAULT_DICE_CATEGORY_NAME = 'General';
const ROLL_AWARD_NAME_MAX_LENGTH = 120;
const ROLL_AWARD_MAX_RESULTS = 20;
const ROLL_AWARD_MAX_DICE_NOTATIONS = 10;
const ROLL_AWARD_RESULT_MIN = 1;
const ROLL_AWARD_RESULT_MAX = 1000;
const ROLL_AWARD_WINDOW_OPTIONS = [10, 50, 100];
const ROLL_AWARD_DICE_NOTATION_REGEX = /^d([1-9]\d*)$/i;

export type RoomsAction =
    | { action: 'list' }
    | { action: 'create'; payload: { name: string; password?: string | null; userId: string } }
    | { action: 'join'; payload: { inviteCode: string; password?: string | null; userId: string } }
    | { action: 'userRooms'; payload: { userId: string } }
    | { action: 'messages'; payload: { roomId: string; userId?: string; limit?: number; since?: string; before?: string } }
    | { action: 'members'; payload: { roomId: string } }
    | { action: 'member'; payload: { roomId: string; userId: string } }
    | { action: 'updateRoom'; payload: { roomId: string; userId: string; name: string } }
    | { action: 'updateNickname'; payload: { roomId: string; userId: string; nickname?: string | null } }
    | { action: 'leaveRoom'; payload: { roomId: string; userId: string } }
    | { action: 'archiveRoom'; payload: { roomId: string; userId: string } }
    | { action: 'unarchiveRoom'; payload: { roomId: string; userId: string } }
    | { action: 'message'; payload: { roomId: string; userId: string; content?: string; type: 'text' | 'dice'; dice?: { notation: string; total: number; rolls: number[] } } }
    | { action: 'roomDices'; payload: { roomId: string; userId: string } }
    | { action: 'createDice'; payload: { roomId: string; userId: string; notation: string; description?: string | null; categoryId?: string | null } }
    | { action: 'updateDice'; payload: { roomId: string; userId: string; diceId: string; notation: string; description?: string | null; categoryId?: string | null } }
    | { action: 'deleteDice'; payload: { roomId: string; userId: string; diceId: string } }
    | { action: 'createDiceCategory'; payload: { roomId: string; userId: string; name: string } }
    | { action: 'rollAwards'; payload: { roomId: string } }
    | { action: 'setRollAwardsEnabled'; payload: { roomId: string; userId: string; enabled: boolean; windowSize?: number | null } }
    | { action: 'createRollAward'; payload: { roomId: string; userId: string; name: string; diceResults: number[]; diceNotation?: string | null; diceNotations?: string[] } }
    | { action: 'updateRollAward'; payload: { roomId: string; userId: string; awardId: string; name: string; diceResults: number[]; diceNotation?: string | null; diceNotations?: string[] } }
    | { action: 'deleteRollAward'; payload: { roomId: string; userId: string; awardId: string } };

export type RoomsActionResponse =
    | { rooms: RoomDetails[] }
    | { room: RoomDetails }
    | { roomId: string; messages: RoomMessage[] }
    | { roomId: string; members: RoomMemberDetails[] }
    | { member: RoomMemberDetails }
    | { message: RoomMessage }
    | { roomId: string; dices: RoomDice[]; categories: RoomDiceCategory[] }
    | { dice: RoomDice }
    | { diceId: string }
    | { roomId: string }
    | { category: RoomDiceCategory }
    | { roomId: string; rollAwards: RoomRollAward[]; enabled: boolean; windowSize: number | null }
    | { rollAwardsEnabled: { roomId: string; enabled: boolean; windowSize: number | null } }
    | { rollAward: RoomRollAward }
    | { rollAwardId: string };

export async function handleRoomsAction(payload: RoomsAction): Promise<RoomsActionResponse> {
    await ensureDatabaseSetup();

    switch (payload.action) {
        case 'list': {
            const rooms = await listRooms();
            return { rooms: rooms.map((room) => mapRoomToSummary(room)) };
        }
        case 'create':
            return { room: await handleCreateRoom(payload.payload) };
        case 'join':
            return { room: await handleJoinRoom(payload.payload) };
        case 'userRooms':
            return { rooms: await handleListUserRooms(payload.payload) };
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
        case 'leaveRoom':
            await handleLeaveRoom(payload.payload);
            return { roomId: payload.payload.roomId };
        case 'archiveRoom':
            return { room: await handleArchiveRoom(payload.payload) };
        case 'unarchiveRoom':
            return { room: await handleUnarchiveRoom(payload.payload) };
        case 'message':
            return { message: await handleSendMessage(payload.payload) };
        case 'roomDices': {
            const { dices, categories } = await handleListRoomDices(payload.payload);
            return { roomId: payload.payload.roomId, dices, categories };
        }
        case 'createDice':
            return { dice: await handleCreateRoomDice(payload.payload) };
        case 'updateDice':
            return { dice: await handleUpdateRoomDice(payload.payload) };
        case 'deleteDice':
            await handleDeleteRoomDice(payload.payload);
            return { diceId: payload.payload.diceId };
        case 'createDiceCategory':
            return { category: await handleCreateDiceCategory(payload.payload) };
        case 'rollAwards': {
            const { awards, enabled, windowSize } = await handleListRollAwards(payload.payload);
            return { roomId: payload.payload.roomId, rollAwards: awards, enabled, windowSize };
        }
        case 'setRollAwardsEnabled': {
            const result = await handleSetRollAwardsEnabled(payload.payload);
            return { rollAwardsEnabled: result };
        }
        case 'createRollAward':
            return { rollAward: await handleCreateRollAward(payload.payload) };
        case 'updateRollAward':
            return { rollAward: await handleUpdateRollAward(payload.payload) };
        case 'deleteRollAward':
            return { rollAwardId: await handleDeleteRollAward(payload.payload) };
        default:
            throw new Error('Unknown action');
    }
}

export async function listRoomsForUser(userId: string): Promise<RoomDetails[]> {
    await ensureDatabaseSetup();
    return handleListUserRooms({ userId });
}

export async function listRoomMembersForUser(params: { roomId: string; userId: string }): Promise<RoomMemberDetails[]> {
    const { roomId, userId } = params;
    if (!roomId) {
        throw new Error('Room id is required');
    }
    if (!userId) {
        throw new Error('User id is required');
    }

    await ensureDatabaseSetup();

    const room = await getRoomById(roomId);
    if (!room) {
        throw new Error('Room not found');
    }

    const member = await getMember(roomId, userId);
    if (!member) {
        throw new Error('You are not a member of this room');
    }

    const rows = await listMembers(roomId);
    return rows.map(mapMemberRecord);
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

    return mapRoomToSummary({ ...room, member_count: memberCount }, { currentUserId: payload.userId });
}

async function handleJoinRoom(payload: { inviteCode: string; password?: string | null; userId: string }): Promise<RoomDetails> {
    if (!payload.inviteCode?.trim()) throw new Error('Invite code is required');
    if (!payload.userId) throw new Error('User id is required');

    const room = await getRoomByInviteCode(payload.inviteCode.trim().toUpperCase());
    if (!room) throw new Error('Room not found');
    if (room.archived_at && room.created_by !== payload.userId) {
        throw new Error('This room is no longer available');
    }

    if (room.password_hash) {
        const providedPassword = payload.password?.trim();
        if (!providedPassword) throw new Error('Password required');
        const valid = verifyPassword(providedPassword, room.password_hash, room.password_salt);
        if (!valid) throw new Error('Invalid password');
    }

    await upsertMember(room.id, payload.userId);
    const memberCount = await countMembers(room.id);

    return mapRoomToSummary({ ...room, member_count: memberCount }, { currentUserId: payload.userId });
}

async function handleListUserRooms(payload: { userId: string }): Promise<RoomDetails[]> {
    if (!payload.userId) {
        throw new Error('User id is required');
    }

    const rooms = await listUserRooms(payload.userId);
    return rooms.map((room) => mapRoomToSummary(room, { currentUserId: payload.userId }));
}

async function handleLeaveRoom(payload: { roomId: string; userId: string }): Promise<void> {
    if (!payload.roomId) throw new Error('Room id missing');
    if (!payload.userId) throw new Error('User id missing');

    const room = await getRoomById(payload.roomId);
    if (!room) throw new Error('Room not found');
    if (room.created_by === payload.userId) {
        throw new Error('Room creators cannot leave their own room');
    }

    const member = await getMember(payload.roomId, payload.userId);
    if (!member) {
        throw new Error('You are not a member of this room');
    }

    await removeMember(payload.roomId, payload.userId);
}

async function handleArchiveRoom(payload: { roomId: string; userId: string }): Promise<RoomDetails> {
    if (!payload.roomId) throw new Error('Room id missing');
    if (!payload.userId) throw new Error('User id missing');

    const room = await getRoomById(payload.roomId);
    if (!room) throw new Error('Room not found');
    if (room.created_by !== payload.userId) {
        throw new Error('Only the room creator can delete this room');
    }

    const updated = await setRoomArchived(payload.roomId, true);
    if (!updated) {
        throw new Error('Failed to delete room');
    }

    const memberCount = await countMembers(payload.roomId);
    return mapRoomToSummary({ ...updated, member_count: memberCount }, { currentUserId: payload.userId });
}

async function handleUnarchiveRoom(payload: { roomId: string; userId: string }): Promise<RoomDetails> {
    if (!payload.roomId) throw new Error('Room id missing');
    if (!payload.userId) throw new Error('User id missing');

    const room = await getRoomById(payload.roomId);
    if (!room) throw new Error('Room not found');
    if (room.created_by !== payload.userId) {
        throw new Error('Only the room creator can restore this room');
    }

    const updated = await setRoomArchived(payload.roomId, false);
    if (!updated) {
        throw new Error('Failed to restore room');
    }

    const memberCount = await countMembers(payload.roomId);
    return mapRoomToSummary({ ...updated, member_count: memberCount }, { currentUserId: payload.userId });
}

async function handleListMessages(payload: {
    roomId: string;
    userId?: string;
    limit?: number;
    since?: string;
    before?: string;
}): Promise<RoomMessage[]> {
    if (!payload.roomId) throw new Error('Room id missing');
    const room = await getRoomById(payload.roomId);
    if (!room) throw new Error('Room not found');

    if (payload.userId) {
        await touchMember(payload.roomId, payload.userId);
    }

    const rows = await listMessages(payload.roomId, {
        limit: payload.limit,
        since: payload.since,
        before: payload.before
    });
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
    return mapRoomToSummary({ ...updated, member_count: memberCount }, { currentUserId: payload.userId });
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

async function handleListRoomDices(payload: { roomId: string; userId: string }): Promise<{ dices: RoomDice[]; categories: RoomDiceCategory[] }> {
    const { room } = await ensureRoomMembership(payload.roomId, payload.userId);
    const categoryRecords = await ensureDiceCategoriesForUser(room.id, payload.userId);
    const categories = categoryRecords.map(mapRoomDiceCategoryRecord);
    const categoryMap = new Map(categories.map((category) => [category.id, category]));
    const rows = await listRoomDices(room.id, payload.userId);
    const dices = rows.map((record) => mapRoomDiceRecord(record, categoryMap));
    return { dices, categories };
}

async function handleCreateRoomDice(payload: { roomId: string; userId: string; notation: string; description?: string | null; categoryId?: string | null }): Promise<RoomDice> {
    const { room } = await ensureRoomMembership(payload.roomId, payload.userId);
    const categoryRecords = await ensureDiceCategoriesForUser(room.id, payload.userId);
    const selectedCategory = selectDiceCategory(categoryRecords, payload.categoryId);
    const notation = normalizeDiceNotation(payload.notation);
    const description = normalizeDiceDescription(payload.description);
    const created = await insertRoomDice({
        room_id: room.id,
        created_by: payload.userId,
        category_id: selectedCategory?.id ?? null,
        notation,
        description,
    });
    const categoryMap = new Map(categoryRecords.map((record) => {
        const mapped = mapRoomDiceCategoryRecord(record);
        return [mapped.id, mapped] as const;
    }));
    return mapRoomDiceRecord(created, categoryMap);
}

async function handleUpdateRoomDice(payload: { roomId: string; userId: string; diceId: string; notation: string; description?: string | null; categoryId?: string | null }): Promise<RoomDice> {
    if (!payload.diceId) throw new Error('Dice id missing');
    const { room } = await ensureRoomMembership(payload.roomId, payload.userId);
    const existing = await getRoomDice(payload.diceId);
    if (!existing || existing.room_id !== room.id || existing.created_by !== payload.userId) {
        throw new Error('Dice not found');
    }
    const categoryRecords = await ensureDiceCategoriesForUser(room.id, payload.userId);
    const requestedCategoryId = payload.categoryId ?? existing.category_id ?? undefined;
    const selectedCategory = selectDiceCategory(categoryRecords, requestedCategoryId);
    const notation = normalizeDiceNotation(payload.notation);
    const description = normalizeDiceDescription(payload.description);
    const updated = await updateRoomDiceRecord(payload.diceId, {
        notation,
        description,
        category_id: selectedCategory?.id ?? null
    });
    if (!updated) throw new Error('Failed to update dice');
    const categoryMap = new Map(categoryRecords.map((record) => {
        const mapped = mapRoomDiceCategoryRecord(record);
        return [mapped.id, mapped] as const;
    }));
    return mapRoomDiceRecord(updated, categoryMap);
}

async function handleDeleteRoomDice(payload: { roomId: string; userId: string; diceId: string }): Promise<void> {
    if (!payload.diceId) throw new Error('Dice id missing');
    const { room } = await ensureRoomMembership(payload.roomId, payload.userId);
    const existing = await getRoomDice(payload.diceId);
    if (!existing || existing.room_id !== room.id || existing.created_by !== payload.userId) {
        throw new Error('Dice not found');
    }
    await deleteRoomDice(payload.diceId);
}

async function handleCreateDiceCategory(payload: { roomId: string; userId: string; name: string }): Promise<RoomDiceCategory> {
    const { room } = await ensureRoomMembership(payload.roomId, payload.userId);
    const normalizedName = normalizeDiceCategoryName(payload.name);
    await ensureDiceCategoriesForUser(room.id, payload.userId);
    const sortOrder = await getNextDiceCategorySortOrder(room.id, payload.userId);
    const created = await insertRoomDiceCategory({
        room_id: room.id,
        created_by: payload.userId,
        name: normalizedName,
        sort_order: sortOrder,
        is_default: false
    });
    return mapRoomDiceCategoryRecord(created);
}

async function handleListRollAwards(payload: { roomId: string }): Promise<{ awards: RoomRollAward[]; enabled: boolean; windowSize: number | null }> {
    if (!payload.roomId) throw new Error('Room id missing');
    const room = await getRoomById(payload.roomId);
    if (!room) throw new Error('Room not found');
    const rows = await listRoomRollAwards(room.id);
    const awards = rows.map(mapRollAwardRecord);
    return {
        awards,
        enabled: Boolean(room.roll_awards_enabled),
        windowSize: normalizeRollAwardWindowSize(room.roll_awards_window)
    };
}

async function handleSetRollAwardsEnabled(payload: { roomId: string; userId: string; enabled: boolean; windowSize?: number | null }): Promise<{ roomId: string; enabled: boolean; windowSize: number | null }> {
    if (!payload.roomId) throw new Error('Room id missing');
    if (!payload.userId) throw new Error('User id missing');
    const room = await getRoomById(payload.roomId);
    if (!room) throw new Error('Room not found');
    if (!room.created_by || room.created_by !== payload.userId) {
        throw new Error('Only the room creator can update this setting');
    }
    const windowSize = normalizeRollAwardWindowSize(
        'windowSize' in payload ? payload.windowSize ?? null : room.roll_awards_window
    );
    const updated = await updateRollAwardsSettings(room.id, { enabled: payload.enabled, windowSize });
    if (!updated) throw new Error('Failed to update setting');
    return {
        roomId: room.id,
        enabled: Boolean(updated.roll_awards_enabled),
        windowSize: normalizeRollAwardWindowSize(updated.roll_awards_window)
    };
}

async function handleCreateRollAward(payload: { roomId: string; userId: string; name: string; diceResults: number[]; diceNotation?: string | null; diceNotations?: string[] }): Promise<RoomRollAward> {
    if (!payload.roomId) throw new Error('Room id missing');
    if (!payload.userId) throw new Error('User id missing');
    const room = await getRoomById(payload.roomId);
    if (!room) throw new Error('Room not found');
    if (!room.created_by || room.created_by !== payload.userId) {
        throw new Error('Only the room creator can create awards');
    }
    if (!room.roll_awards_enabled) {
        throw new Error('Enable Roll Awards before creating entries');
    }
    const name = normalizeRollAwardName(payload.name);
    const diceNotations = normalizeRollAwardDiceNotations(payload.diceNotations ?? payload.diceNotation);
    const diceResults = normalizeRollAwardResults(payload.diceResults);
    const created = await insertRoomRollAward({
        room_id: room.id,
        created_by: payload.userId,
        name,
        dice_notation: serializeRollAwardDiceNotations(diceNotations),
        dice_results: JSON.stringify(diceResults)
    });
    return mapRollAwardRecord(created);
}

async function handleUpdateRollAward(payload: { roomId: string; userId: string; awardId: string; name: string; diceResults: number[]; diceNotation?: string | null; diceNotations?: string[] }): Promise<RoomRollAward> {
    if (!payload.roomId) throw new Error('Room id missing');
    if (!payload.userId) throw new Error('User id missing');
    if (!payload.awardId) throw new Error('Award id missing');
    const room = await getRoomById(payload.roomId);
    if (!room) throw new Error('Room not found');
    if (!room.created_by || room.created_by !== payload.userId) {
        throw new Error('Only the room creator can update awards');
    }
    if (!room.roll_awards_enabled) {
        throw new Error('Enable Roll Awards before editing entries');
    }
    const existing = await getRoomRollAward(payload.awardId);
    if (!existing || existing.room_id !== room.id) {
        throw new Error('Award not found');
    }
    const name = normalizeRollAwardName(payload.name);
    const diceNotations = normalizeRollAwardDiceNotations(payload.diceNotations ?? payload.diceNotation);
    const diceResults = normalizeRollAwardResults(payload.diceResults);
    const updated = await updateRoomRollAward({
        id: payload.awardId,
        name,
        dice_notation: serializeRollAwardDiceNotations(diceNotations),
        dice_results: JSON.stringify(diceResults)
    });
    return mapRollAwardRecord(updated);
}

async function handleDeleteRollAward(payload: { roomId: string; userId: string; awardId: string }): Promise<string> {
    if (!payload.roomId) throw new Error('Room id missing');
    if (!payload.userId) throw new Error('User id missing');
    if (!payload.awardId) throw new Error('Award id missing');
    const room = await getRoomById(payload.roomId);
    if (!room) throw new Error('Room not found');
    if (!room.created_by || room.created_by !== payload.userId) {
        throw new Error('Only the room creator can delete awards');
    }
    const existing = await getRoomRollAward(payload.awardId);
    if (!existing || existing.room_id !== room.id) {
        throw new Error('Award not found');
    }
    await deleteRoomRollAward(payload.awardId);
    return payload.awardId;
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

function normalizeDiceCategoryName(value: string): string {
    const trimmed = value?.trim() ?? '';
    if (!trimmed) {
        throw new Error('Category name is required');
    }
    if (trimmed.length > DICE_CATEGORY_NAME_MAX_LENGTH) {
        throw new Error(`Category name is too long (max ${DICE_CATEGORY_NAME_MAX_LENGTH} characters)`);
    }
    return trimmed;
}

function normalizeRollAwardName(value: string): string {
    const trimmed = value?.trim() ?? '';
    if (!trimmed) {
        throw new Error('Award name is required');
    }
    if (trimmed.length > ROLL_AWARD_NAME_MAX_LENGTH) {
        throw new Error(`Award name is too long (max ${ROLL_AWARD_NAME_MAX_LENGTH} characters)`);
    }
    return trimmed;
}

function normalizeRollAwardDiceNotations(value?: string | string[] | null): string[] {
    const source = Array.isArray(value) ? value : typeof value === 'string' ? value.split(/[,\s]+/) : [];
    const cleaned = source.map((entry) => entry.trim()).filter(Boolean);
    if (!cleaned.length) {
        return [];
    }
    const normalized = new Set<string>();
    for (const entry of cleaned) {
        if (entry.length > DICE_NOTATION_MAX_LENGTH) {
            throw new Error(`Dice notation filter is too long (max ${DICE_NOTATION_MAX_LENGTH} characters)`);
        }
        const match = entry.match(ROLL_AWARD_DICE_NOTATION_REGEX);
        if (!match) {
            throw new Error('Dice notation filter must look like d20 or d100');
        }
        normalized.add(`d${match[1]}`.toLowerCase());
        if (normalized.size > ROLL_AWARD_MAX_DICE_NOTATIONS) {
            throw new Error(`You can only specify up to ${ROLL_AWARD_MAX_DICE_NOTATIONS} dice notations.`);
        }
    }
    return Array.from(normalized);
}

function serializeRollAwardDiceNotations(notations: string[]): string | null {
    if (!notations.length) {
        return null;
    }
    const serialized = notations.join(',');
    if (serialized.length > DICE_NOTATION_MAX_LENGTH) {
        throw new Error(`Dice notation filter is too long (max ${DICE_NOTATION_MAX_LENGTH} characters combined).`);
    }
    return serialized;
}

function normalizeRollAwardResults(values: number[]): number[] {
    if (!Array.isArray(values) || values.length === 0) {
        throw new Error('Add at least one dice result');
    }
    if (values.length > ROLL_AWARD_MAX_RESULTS) {
        throw new Error(`Awards can only track up to ${ROLL_AWARD_MAX_RESULTS} results`);
    }
    const sanitized = values
        .map((value) => Number(value))
        .filter((value) => Number.isFinite(value))
        .map((value) => Math.floor(value));
    const filtered = sanitized.filter((value) => value >= ROLL_AWARD_RESULT_MIN && value <= ROLL_AWARD_RESULT_MAX);
    if (!filtered.length) {
        throw new Error(`Dice results must be between ${ROLL_AWARD_RESULT_MIN} and ${ROLL_AWARD_RESULT_MAX}`);
    }
    return Array.from(new Set(filtered));
}

function normalizeRollAwardWindowSize(value?: number | null): number | null {
    if (value === null || value === undefined) {
        return null;
    }
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
        return null;
    }
    const normalized = Math.floor(parsed);
    return ROLL_AWARD_WINDOW_OPTIONS.includes(normalized) ? normalized : null;
}

async function ensureDiceCategoriesForUser(roomId: string, userId: string): Promise<DatabaseRoomDiceCategory[]> {
    let categories = await listRoomDiceCategories(roomId, userId);
    if (!categories.length) {
        const created = await insertRoomDiceCategory({
            room_id: roomId,
            created_by: userId,
            name: DEFAULT_DICE_CATEGORY_NAME,
            sort_order: 0,
            is_default: true
        });
        categories = [created];
    }

    const hasDefault = categories.some((category) => isDefaultCategoryFlag(category.is_default));
    if (!hasDefault && categories.length > 0) {
        await setDefaultRoomDiceCategory(categories[0].id, roomId, userId);
        categories = await listRoomDiceCategories(roomId, userId);
    }

    const defaultCategory = categories.find((category) => isDefaultCategoryFlag(category.is_default));
    if (defaultCategory) {
        await assignCategoryToUncategorizedDice(roomId, userId, defaultCategory.id);
    }

    return categories;
}

function selectDiceCategory(categories: DatabaseRoomDiceCategory[], categoryId?: string | null): DatabaseRoomDiceCategory | undefined {
    if (categoryId) {
        const match = categories.find((category) => category.id === categoryId);
        if (!match) {
            throw new Error('Category not found');
        }
        return match;
    }
    return categories.find((category) => isDefaultCategoryFlag(category.is_default)) ?? categories[0];
}

function mapRoomDiceCategoryRecord(record: DatabaseRoomDiceCategory): RoomDiceCategory {
    const sortOrderValue = record.sort_order ?? undefined;
    const sortOrder = typeof sortOrderValue === 'string' ? Number(sortOrderValue) : sortOrderValue;
    return {
        id: record.id,
        roomId: record.room_id,
        name: record.name,
        sortOrder: Number.isFinite(sortOrder) ? Number(sortOrder) : undefined,
        isDefault: isDefaultCategoryFlag(record.is_default),
        createdBy: record.created_by ?? undefined,
        createdAt: record.created_at ?? undefined,
        updatedAt: record.updated_at ?? undefined
    };
}

function parseStoredDiceNotations(value?: string | null): string[] {
    if (!value) return [];
    try {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) {
            return normalizeRollAwardDiceNotations(parsed);
        }
    } catch {
        // ignore parse errors for legacy string values
    }
    try {
        return normalizeRollAwardDiceNotations(value);
    } catch {
        return [];
    }
}

function mapRollAwardRecord(record: DatabaseRoomRollAward): RoomRollAward {
    const normalizedNotations = parseStoredDiceNotations(record.dice_notation ?? null);
    return {
        id: record.id,
        roomId: record.room_id,
        name: record.name,
        diceResults: parseStoredDiceResults(record.dice_results),
        diceNotation: normalizedNotations[0],
        diceNotations: normalizedNotations.length ? normalizedNotations : undefined,
        createdBy: record.created_by ?? undefined,
        createdAt: record.created_at ?? undefined,
        updatedAt: record.updated_at ?? undefined
    };
}

function isDefaultCategoryFlag(value?: number | boolean | string | null): boolean {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value === 1;
    if (typeof value === 'string') return value === '1';
    return false;
}

function mapRoomToSummary(room: DatabaseRoom, options?: { currentUserId?: string }): RoomDetails {
    const lastActivity = room.last_activity ?? room.updated_at ?? room.created_at ?? null;
    const archivedAt = room.archived_at ?? null;
    const currentUserId = options?.currentUserId;
    const isCreator = currentUserId && room.created_by
        ? room.created_by === currentUserId
        : undefined;
    return {
        id: room.id,
        name: room.name,
        inviteCode: room.invite_code,
        isProtected: Boolean(room.password_hash),
        memberCount: room.member_count ?? 0,
        lastActivity,
        archivedAt,
        isArchived: Boolean(archivedAt),
        isCreator,
        createdBy: room.created_by,
        createdAt: room.created_at ?? undefined,
        rollAwardsEnabled: Boolean(room.roll_awards_enabled),
        rollAwardsWindow: normalizeRollAwardWindowSize(room.roll_awards_window)
    };
}

function mapRoomDiceRecord(record: DatabaseRoomDice, categories?: Map<string, RoomDiceCategory>): RoomDice {
    const categoryId = record.category_id ?? undefined;
    const category = categoryId && categories ? categories.get(categoryId) : undefined;
    return {
        id: record.id,
        roomId: record.room_id,
        notation: record.notation,
        description: record.description ?? undefined,
        categoryId,
        categoryName: category?.name,
        createdBy: record.created_by ?? undefined,
        createdAt: record.created_at ?? undefined,
        updatedAt: record.updated_at ?? undefined,
    };
}

function parseStoredDiceResults(value?: string | number[] | null): number[] {
    if (Array.isArray(value)) {
        return value
            .map((entry) => Number(entry))
            .filter((entry) => Number.isFinite(entry))
            .map((entry) => Math.floor(entry));
    }
    if (typeof value === 'string') {
        try {
            const parsed = JSON.parse(value);
            if (Array.isArray(parsed)) {
                return parsed
                    .map((entry) => Number(entry))
                    .filter((entry) => Number.isFinite(entry))
                    .map((entry) => Math.floor(entry));
            }
        } catch {
            return [];
        }
    }
    return [];
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

function calculateIsOnline(lastSeen?: string | null): boolean {
    if (!lastSeen) return false;
    const timestamp = new Date(lastSeen).getTime();
    if (Number.isNaN(timestamp)) return false;
    return Date.now() - timestamp <= ONLINE_MEMBER_WINDOW_MS;
}

function mapMemberRecord(record: DatabaseRoomMemberWithUser): RoomMemberDetails {
    return {
        userId: record.user_id,
        username: record.username ?? undefined,
        avatar: record.avatar ?? undefined,
        joinedAt: record.joined_at ?? undefined,
        lastSeen: record.last_seen ?? undefined,
        nickname: record.nickname ?? undefined,
        isOnline: calculateIsOnline(record.last_seen ?? undefined)
    };
}
