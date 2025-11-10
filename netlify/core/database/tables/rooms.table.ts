import { sql } from '../client';
import type { DatabaseRoom, NewRoom } from '../../types/database.types';

export async function insertRoom(room: NewRoom): Promise<DatabaseRoom> {
    const result = await sql<DatabaseRoom[]>`
        INSERT INTO rooms (id, name, invite_code, password_hash, password_salt, created_by)
        VALUES (${room.id}, ${room.name}, ${room.invite_code}, ${room.password_hash ?? null}, ${room.password_salt ?? null}, ${room.created_by ?? null})
        RETURNING *
    `;
    return result[0];
}

export async function getRoomByInviteCode(inviteCode: string): Promise<DatabaseRoom | undefined> {
    const result = await sql<DatabaseRoom[]>`
        SELECT * FROM rooms WHERE invite_code = ${inviteCode} LIMIT 1
    `;
    return result[0];
}

export async function getRoomById(roomId: string): Promise<DatabaseRoom | undefined> {
    const result = await sql<DatabaseRoom[]>`
        SELECT * FROM rooms WHERE id = ${roomId} LIMIT 1
    `;
    return result[0];
}

export async function listRooms(): Promise<DatabaseRoom[]> {
    const result = await sql<DatabaseRoom[]>`
        SELECT
            r.*,
            COALESCE(members.member_count, 0)::INT AS member_count,
            COALESCE(messages.last_activity, r.updated_at) AS last_activity
        FROM rooms r
        LEFT JOIN (
            SELECT room_id, COUNT(*) as member_count
            FROM room_members
            GROUP BY room_id
        ) members ON members.room_id = r.id
        LEFT JOIN (
            SELECT room_id, MAX(created_at) as last_activity
            FROM room_messages
            GROUP BY room_id
        ) messages ON messages.room_id = r.id
        ORDER BY last_activity DESC NULLS LAST
    `;
    return result;
}

export async function touchRoom(roomId: string): Promise<void> {
    await sql`
        UPDATE rooms SET updated_at = NOW() WHERE id = ${roomId}
    `;
}
