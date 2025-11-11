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
    const rows = await sql<Array<{ count: string }>>`
        SELECT COUNT(*)::text AS count FROM room_members WHERE room_id = ${roomId}
    `;
    return Number(rows[0]?.count ?? 0);
}

export async function getMembers(roomId: string): Promise<DatabaseRoomMember[]> {
    return sql<DatabaseRoomMember[]>`
        SELECT * FROM room_members WHERE room_id = ${roomId}
    `;
}
