import { execute, query } from '../client';
import type { DatabaseRoom, NewRoom } from '../../types/database.types';

export async function insertRoom(room: NewRoom): Promise<DatabaseRoom> {
    await execute(
        `INSERT INTO rooms (id, name, invite_code, password_hash, password_salt, created_by)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [room.id, room.name, room.invite_code, room.password_hash ?? null, room.password_salt ?? null, room.created_by ?? null]
    );

    const createdRoom = await getRoomById(room.id);
    if (!createdRoom) {
        throw new Error('Failed to insert room');
    }
    return createdRoom;
}

export async function getRoomByInviteCode(inviteCode: string): Promise<DatabaseRoom | undefined> {
    const rows = await query<DatabaseRoom[]>(
        'SELECT * FROM rooms WHERE invite_code = ? LIMIT 1',
        [inviteCode]
    );
    return rows[0];
}

export async function getRoomById(roomId: string): Promise<DatabaseRoom | undefined> {
    const rows = await query<DatabaseRoom[]>(
        'SELECT * FROM rooms WHERE id = ? LIMIT 1',
        [roomId]
    );
    return rows[0];
}

export async function listRooms(): Promise<DatabaseRoom[]> {
    const rows = await query<DatabaseRoom[]>(
        `SELECT
            r.*,
            IFNULL(members.member_count, 0) AS member_count,
            IFNULL(messages.last_activity, r.updated_at) AS last_activity
        FROM rooms r
        LEFT JOIN (
            SELECT room_id, COUNT(*) AS member_count
            FROM room_members
            GROUP BY room_id
        ) members ON members.room_id = r.id
        LEFT JOIN (
            SELECT room_id, MAX(created_at) AS last_activity
            FROM room_messages
            GROUP BY room_id
        ) messages ON messages.room_id = r.id
        WHERE r.archived_at IS NULL
        ORDER BY last_activity IS NULL, last_activity DESC`
    );

    return rows.map((row) => ({
        ...row,
        member_count: typeof row.member_count === 'string' ? Number(row.member_count) : row.member_count
    }));
}

export async function listUserRooms(userId: string): Promise<DatabaseRoom[]> {
    const rows = await query<DatabaseRoom[]>(
        `SELECT
            r.*,
            IFNULL(members.member_count, 0) AS member_count,
            IFNULL(messages.last_activity, r.updated_at) AS last_activity
        FROM rooms r
        INNER JOIN room_members rm ON rm.room_id = r.id AND rm.user_id = ?
        LEFT JOIN (
            SELECT room_id, COUNT(*) AS member_count
            FROM room_members
            GROUP BY room_id
        ) members ON members.room_id = r.id
        LEFT JOIN (
            SELECT room_id, MAX(created_at) AS last_activity
            FROM room_messages
            GROUP BY room_id
        ) messages ON messages.room_id = r.id
        WHERE r.archived_at IS NULL OR r.created_by = ?
        ORDER BY r.archived_at IS NULL DESC, last_activity IS NULL, last_activity DESC`,
        [userId, userId]
    );

    return rows.map((row) => ({
        ...row,
        member_count: typeof row.member_count === 'string' ? Number(row.member_count) : row.member_count
    }));
}

export async function touchRoom(roomId: string): Promise<void> {
    await execute('UPDATE rooms SET updated_at = CURRENT_TIMESTAMP WHERE id = ?', [roomId]);
}

export async function updateRoomName(roomId: string, name: string): Promise<DatabaseRoom | undefined> {
    await execute(
        'UPDATE rooms SET name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [name, roomId]
    );
    return getRoomById(roomId);
}

export async function setRoomArchived(roomId: string, archived: boolean): Promise<DatabaseRoom | undefined> {
    await execute(
        'UPDATE rooms SET archived_at = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [archived ? new Date() : null, roomId]
    );
    return getRoomById(roomId);
}
