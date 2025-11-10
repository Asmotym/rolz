import { randomUUID } from 'crypto';
import { sql } from '../client';
import type { DatabaseRoomMessage, NewRoomMessage } from '../../types/database.types';

export async function insertMessage(message: NewRoomMessage): Promise<DatabaseRoomMessage> {
    const result = await sql<DatabaseRoomMessage[]>`
        WITH inserted AS (
            INSERT INTO room_messages (
                id,
                room_id,
                user_id,
                content,
                type,
                dice_notation,
                dice_total,
                dice_rolls
            )
            VALUES (
                ${message.id ?? randomUUID()},
                ${message.room_id},
                ${message.user_id},
                ${message.content ?? null},
                ${message.type},
                ${message.dice_notation ?? null},
                ${message.dice_total ?? null},
                ${message.dice_rolls ? JSON.stringify(message.dice_rolls) : null}
            )
            RETURNING *
        )
        SELECT inserted.*, u.username, u.avatar
        FROM inserted
        LEFT JOIN users u ON u.discord_user_id = inserted.user_id
    `;
    return result[0];
}

export async function listMessages(roomId: string, options?: { limit?: number; since?: string }): Promise<DatabaseRoomMessage[]> {
    const limit = options?.limit ?? 50;
    if (options?.since) {
        const result = await sql<DatabaseRoomMessage[]>`
            SELECT rm.*, u.username, u.avatar
            FROM room_messages rm
            LEFT JOIN users u ON u.discord_user_id = rm.user_id
            WHERE rm.room_id = ${roomId} AND rm.created_at > ${options.since}
            ORDER BY rm.created_at ASC
            LIMIT ${limit}
        `;
        return result;
    }

    const result = await sql<DatabaseRoomMessage[]>`
        SELECT rm.*, u.username, u.avatar
        FROM room_messages rm
        LEFT JOIN users u ON u.discord_user_id = rm.user_id
        WHERE rm.room_id = ${roomId}
        ORDER BY rm.created_at DESC
        LIMIT ${limit}
    `;
    return result;
}
