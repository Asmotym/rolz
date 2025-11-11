import { sql } from '../client';
import type { DatabaseUser } from '../../types/database.types';

export async function getUser(discordUserId: string): Promise<DatabaseUser | undefined> {
    const result = await sql<DatabaseUser[]>`
        SELECT discord_user_id, username, avatar, rights_update, rights_testing_ground
        FROM users
        WHERE discord_user_id = ${discordUserId}
        LIMIT 1
    `;
    return result[0];
}

export async function insertUser(user: DatabaseUser): Promise<void> {
    await sql`
        INSERT INTO users (discord_user_id, username, avatar, rights_update, rights_testing_ground)
        VALUES (${user.discord_user_id ?? null}, ${user.username ?? null}, ${user.avatar ?? null}, ${user.rights_update ?? false}, ${user.rights_testing_ground ?? false})
        ON CONFLICT (discord_user_id) DO NOTHING
    `;
}

export async function updateUser(discordUserId: string, data: Partial<DatabaseUser>): Promise<void> {
    await sql`
        UPDATE users
        SET
            username = COALESCE(${data.username ?? null}, username),
            avatar = COALESCE(${data.avatar ?? null}, avatar),
            rights_update = COALESCE(${data.rights_update ?? null}, rights_update),
            rights_testing_ground = COALESCE(${data.rights_testing_ground ?? null}, rights_testing_ground),
            updated_at = NOW()
        WHERE discord_user_id = ${discordUserId}
    `;
}
