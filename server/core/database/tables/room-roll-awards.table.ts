import { randomUUID } from 'crypto';
import { execute, query } from '../client';
import type { DatabaseRoomRollAward, NewRoomRollAward } from '../../types/database.types';

export async function listRoomRollAwards(roomId: string): Promise<DatabaseRoomRollAward[]> {
    return query<DatabaseRoomRollAward[]>(
        'SELECT * FROM room_roll_awards WHERE room_id = ? ORDER BY created_at ASC',
        [roomId]
    );
}

export async function getRoomRollAward(id: string): Promise<DatabaseRoomRollAward | undefined> {
    const rows = await query<DatabaseRoomRollAward[]>(
        'SELECT * FROM room_roll_awards WHERE id = ? LIMIT 1',
        [id]
    );
    return rows[0];
}

export async function insertRoomRollAward(award: NewRoomRollAward): Promise<DatabaseRoomRollAward> {
    const id = award.id ?? randomUUID();

    await execute(
        `INSERT INTO room_roll_awards (id, room_id, created_by, name, dice_results)
         VALUES (?, ?, ?, ?, ?)` ,
        [id, award.room_id, award.created_by ?? null, award.name, award.dice_results]
    );

    const created = await getRoomRollAward(id);
    if (!created) {
        throw new Error('Failed to insert roll award');
    }
    return created;
}

export async function deleteRoomRollAward(id: string): Promise<void> {
    await execute('DELETE FROM room_roll_awards WHERE id = ?', [id]);
}
