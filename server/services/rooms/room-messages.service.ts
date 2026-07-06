import { upsertMember, touchMember } from '../../core/database/tables/room-members.table';
import { insertMessage, listDiceMessages, listMessages } from '../../core/database/tables/room-messages.table';
import { touchRoom } from '../../core/database/tables/rooms.table';
import { getUser } from '../../core/database/tables/users.table';
import type { RoomMessage } from '../../core/types/data.types';
import { mapMessageRecord } from './rooms.mappers';
import { sanitizeDiceLimit } from './rooms.normalizers';
import { requireRoom } from './rooms.shared';

export async function handleListMessages(payload: {
    roomId: string;
    userId?: string;
    limit?: number;
    since?: string;
    before?: string;
}): Promise<RoomMessage[]> {
    if (!payload.roomId) throw new Error('Room id missing');
    await requireRoom(payload.roomId);

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

export async function listRoomDiceRolls(payload: { roomId: string; limit?: number; since?: string }): Promise<RoomMessage[]> {
    if (!payload.roomId) throw new Error('Room id missing');
    await requireRoom(payload.roomId);

    const limit = sanitizeDiceLimit(payload.limit);
    const rows = await listDiceMessages(payload.roomId, { limit, since: payload.since });
    return rows.map(mapMessageRecord);
}

export async function handleSendMessage(payload: { roomId: string; userId: string; content?: string; type: 'text' | 'dice'; dice?: { notation: string; total: number; rolls: number[] } }): Promise<RoomMessage> {
    if (!payload.roomId) throw new Error('Room id missing');
    if (!payload.userId) throw new Error('User id missing');
    if (payload.type === 'text' && !payload.content?.trim()) {
        throw new Error('Message content missing');
    }
    if (payload.type === 'dice' && !payload.dice) {
        throw new Error('Dice payload missing');
    }

    await requireRoom(payload.roomId);

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
