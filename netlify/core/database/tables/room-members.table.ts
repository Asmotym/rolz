import { randomUUID } from 'crypto';
import { sql } from '../client';
import type { DatabaseRoomMember } from '../../types/database.types';

export async function upsertMember(roomId: string, userId: string): Promise<void> {
    await sql`
        INSERT INTO room_members (id, room_id, user_id)
        VALUES (${randomUUID()}, ${roomId}, ${userId})
        ON CONFLICT (room_id, user_id) DO UPDATE SET last_seen = NOW()
    `;
}

export async function countMembers(roomId: string): Promise<number> {
    const result = await sql<{ count: string }[]>`
        SELECT COUNT(*)::text AS count FROM room_members WHERE room_id = ${roomId}
    `;
    return Number(result[0]?.count ?? 0);
}

export async function getMembers(roomId: string): Promise<DatabaseRoomMember[]> {
    const result = await sql<DatabaseRoomMember[]>`
        SELECT * FROM room_members WHERE room_id = ${roomId}
    `;
    return result;
}
