import { randomUUID } from 'crypto';
import { execute, query } from '../client';
import type { DatabaseRoomMessage, NewRoomMessage } from '../../types/database.types';

export async function insertMessage(message: NewRoomMessage): Promise<DatabaseRoomMessage> {
    const id = message.id ?? randomUUID();

    await execute(
        `INSERT INTO room_messages (
            id,
            room_id,
            user_id,
            content,
            type,
            dice_notation,
            dice_total,
            dice_rolls
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            id,
            message.room_id,
            message.user_id,
            message.content ?? null,
            message.type,
            message.dice_notation ?? null,
            message.dice_total ?? null,
            message.dice_rolls ? JSON.stringify(message.dice_rolls) : null
        ]
    );

    const rows = await query<DatabaseRoomMessage[]>(
        `SELECT rm.*, u.username, u.avatar, members.nickname AS member_nickname
         FROM room_messages rm
         LEFT JOIN users u ON u.discord_user_id = rm.user_id
         LEFT JOIN room_members members ON members.room_id = rm.room_id AND members.user_id = rm.user_id
         WHERE rm.id = ?
         LIMIT 1`,
        [id]
    );

    if (!rows[0]) {
        throw new Error('Failed to insert message');
    }

    return rows[0];
}

export async function listMessages(roomId: string, options?: { limit?: number; since?: string }): Promise<DatabaseRoomMessage[]> {
    const limit = options?.limit ?? 50;
    if (options?.since) {
        return query<DatabaseRoomMessage[]>(
            `SELECT rm.*, u.username, u.avatar, members.nickname AS member_nickname
             FROM room_messages rm
             LEFT JOIN users u ON u.discord_user_id = rm.user_id
             LEFT JOIN room_members members ON members.room_id = rm.room_id AND members.user_id = rm.user_id
             WHERE rm.room_id = ? AND rm.created_at > ?
             ORDER BY rm.created_at ASC
             LIMIT ?`,
            [roomId, options.since, limit]
        );
    }

    return query<DatabaseRoomMessage[]>(
        `SELECT rm.*, u.username, u.avatar, members.nickname AS member_nickname
         FROM room_messages rm
         LEFT JOIN users u ON u.discord_user_id = rm.user_id
         LEFT JOIN room_members members ON members.room_id = rm.room_id AND members.user_id = rm.user_id
         WHERE rm.room_id = ?
         ORDER BY rm.created_at DESC
         LIMIT ?`,
        [roomId, limit]
    );
}

export async function listDiceMessages(roomId: string, options?: { limit?: number; since?: string }): Promise<DatabaseRoomMessage[]> {
    const limit = options?.limit ?? 50;

    if (options?.since) {
        return query<DatabaseRoomMessage[]>(
            `SELECT rm.*, u.username, u.avatar, members.nickname AS member_nickname
             FROM room_messages rm
             LEFT JOIN users u ON u.discord_user_id = rm.user_id
             LEFT JOIN room_members members ON members.room_id = rm.room_id AND members.user_id = rm.user_id
             WHERE rm.room_id = ? AND rm.type = 'dice' AND rm.created_at > ?
             ORDER BY rm.created_at ASC
             LIMIT ?`,
            [roomId, options.since, limit]
        );
    }

    return query<DatabaseRoomMessage[]>(
        `SELECT rm.*, u.username, u.avatar, members.nickname AS member_nickname
         FROM room_messages rm
         LEFT JOIN users u ON u.discord_user_id = rm.user_id
         LEFT JOIN room_members members ON members.room_id = rm.room_id AND members.user_id = rm.user_id
         WHERE rm.room_id = ? AND rm.type = 'dice'
         ORDER BY rm.created_at DESC
         LIMIT ?`,
        [roomId, limit]
    );
}
