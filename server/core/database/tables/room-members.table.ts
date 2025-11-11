import { randomUUID } from 'crypto';
import { execute, query } from '../client';
import type { DatabaseRoomMember } from '../../types/database.types';

export async function upsertMember(roomId: string, userId: string): Promise<void> {
    await execute(
        `INSERT INTO room_members (id, room_id, user_id)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE last_seen = CURRENT_TIMESTAMP`,
        [randomUUID(), roomId, userId]
    );
}

export async function countMembers(roomId: string): Promise<number> {
    const rows = await query<Array<{ count: number | string }>>(
        'SELECT COUNT(*) AS count FROM room_members WHERE room_id = ?',
        [roomId]
    );
    return Number(rows[0]?.count ?? 0);
}

export async function getMembers(roomId: string): Promise<DatabaseRoomMember[]> {
    return query<DatabaseRoomMember[]>(
        'SELECT * FROM room_members WHERE room_id = ?',
        [roomId]
    );
}
