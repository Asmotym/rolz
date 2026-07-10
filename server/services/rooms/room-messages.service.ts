import { upsertMember, touchMember } from '../../core/database/tables/room-members.table';
import {
    getRoomBonusPointBalance,
    listRoomBonusPointRules,
    setRoomBonusPointBalance
} from '../../core/database/tables/room-bonus-points.table';
import { insertMessage, listDiceMessages, listMessages } from '../../core/database/tables/room-messages.table';
import { touchRoom } from '../../core/database/tables/rooms.table';
import { getUser } from '../../core/database/tables/users.table';
import type { RoomBonusPointRule, RoomMessage } from '../../core/types/data.types';
import { getDiceFaceInfo, getSelectedRawRoll } from '../../core/utils/bonus-point-dice';
import { mapBonusPointRuleRecord, mapMessageRecord } from './rooms.mappers';
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

export async function handleSendMessage(payload: { roomId: string; userId: string; content?: string; type: 'text' | 'dice'; dice?: { notation: string; total: number; rolls: number[] }; skipBonusPointRules?: boolean }): Promise<RoomMessage> {
    if (!payload.roomId) throw new Error('Room id missing');
    if (!payload.userId) throw new Error('User id missing');
    if (payload.type === 'text' && !payload.content?.trim()) {
        throw new Error('Message content missing');
    }
    if (payload.type === 'dice' && !payload.dice) {
        throw new Error('Dice payload missing');
    }

    const room = await requireRoom(payload.roomId);

    const author = await getUser(payload.userId);
    if (!author) throw new Error('Unknown user');

    await upsertMember(payload.roomId, payload.userId);

    const trimmedContent = payload.content?.trim();
    const diceNotation = payload.dice?.notation?.trim();
    const diceTotal = payload.dice ? Number(payload.dice.total) : undefined;
    const diceRolls = payload.dice ? payload.dice.rolls.map((roll) => Number(roll)) : undefined;
    if (payload.type === 'dice' && payload.dice) {
        if (room.bonus_points_enabled && !payload.skipBonusPointRules) {
            await awardBonusPointsForRoll({
                roomId: payload.roomId,
                userId: payload.userId,
                roomMax: Number(room.bonus_points_max ?? 0),
                notation: diceNotation ?? '',
                rolls: diceRolls ?? []
            });
        }
    }

    const saved = await insertMessage({
        room_id: payload.roomId,
        user_id: payload.userId,
        content: payload.type === 'text'
            ? trimmedContent ?? ''
            : trimmedContent ?? null,
        type: payload.type,
        dice_notation: diceNotation,
        dice_total: diceTotal,
        dice_rolls: diceRolls,
        bonus_point_rules_skipped: payload.type === 'dice' && payload.skipBonusPointRules ? 1 : 0
    });

    await touchRoom(payload.roomId);

    return mapMessageRecord(saved);
}

async function awardBonusPointsForRoll(payload: {
    roomId: string;
    userId: string;
    roomMax: number;
    notation: string;
    rolls: number[];
}): Promise<void> {
    const rules = (await listRoomBonusPointRules(payload.roomId)).map(mapBonusPointRuleRecord);
    const maxPoints = Math.max(0, Math.floor(payload.roomMax));
    if (maxPoints <= 0 || !rules.length) {
        return;
    }
    const currentBalance = await getRoomBonusPointBalance(payload.roomId, payload.userId);
    const earned = countMatchingBonusRules(rules, payload.notation, payload.rolls);
    const nextBalance = Math.min(maxPoints, currentBalance + earned);

    if (nextBalance !== currentBalance) {
        await setRoomBonusPointBalance(payload.roomId, payload.userId, nextBalance);
    }
}

function countMatchingBonusRules(rules: RoomBonusPointRule[], notation: string, rolls: number[]): number {
    const faceNotation = getDiceFaceInfo(notation)?.faceNotation ?? null;
    const selectedRoll = getSelectedRawRoll(notation, rolls);
    if (!faceNotation || !Number.isFinite(selectedRoll)) {
        return 0;
    }
    return rules.filter((rule) => (
        rule.diceNotation === faceNotation &&
        matchesBonusCondition(Number(selectedRoll), rule)
    )).length;
}

function matchesBonusCondition(value: number, rule: RoomBonusPointRule): boolean {
    if (rule.condition.operator === 'moreThan') {
        return value > rule.condition.threshold;
    }
    if (rule.condition.operator === 'lessThan') {
        return value < rule.condition.threshold;
    }
    return value >= rule.condition.threshold && value <= Number(rule.condition.thresholdMax);
}
