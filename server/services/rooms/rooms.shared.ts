import { getRoomById } from '../../core/database/tables/rooms.table';
import { NotFoundError } from '../../core/errors/http-errors';
import type { DatabaseRoom } from '../../core/types/database.types';

export async function requireRoom(roomId: string): Promise<DatabaseRoom> {
    const room = await getRoomById(roomId);
    if (!room) {
        throw new NotFoundError('Room not found');
    }
    return room;
}
