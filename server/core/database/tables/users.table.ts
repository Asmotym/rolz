import { execute, query } from '../client';
import type { DatabaseUser } from '../../types/database.types';

export async function getUser(discordUserId: string): Promise<DatabaseUser | undefined> {
    const result = await query<DatabaseUser[]>(
        `SELECT discord_user_id, username, avatar, rights_update, rights_testing_ground
         FROM users
         WHERE discord_user_id = ?
         LIMIT 1`,
        [discordUserId]
    );
    if (!result[0]) return undefined;

    return {
        ...result[0],
        rights_update: Boolean(result[0].rights_update),
        rights_testing_ground: Boolean(result[0].rights_testing_ground)
    };
}

export async function insertUser(user: DatabaseUser): Promise<void> {
    await execute(
        `INSERT INTO users (discord_user_id, username, avatar, rights_update, rights_testing_ground)
         VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE discord_user_id = discord_user_id`,
        [
            user.discord_user_id ?? null,
            user.username ?? null,
            user.avatar ?? null,
            user.rights_update ?? false,
            user.rights_testing_ground ?? false
        ]
    );
}

export async function updateUser(discordUserId: string, data: Partial<DatabaseUser>): Promise<void> {
    await execute(
        `UPDATE users
         SET
             username = COALESCE(?, username),
             avatar = COALESCE(?, avatar),
             rights_update = COALESCE(?, rights_update),
             rights_testing_ground = COALESCE(?, rights_testing_ground),
             updated_at = CURRENT_TIMESTAMP
         WHERE discord_user_id = ?`,
        [
            data.username ?? null,
            data.avatar ?? null,
            data.rights_update ?? null,
            data.rights_testing_ground ?? null,
            discordUserId
        ]
    );
}
