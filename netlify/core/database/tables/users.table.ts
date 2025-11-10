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
        VALUES (${user.discord_user_id}, ${user.username}, ${user.avatar}, ${user.rights_update ?? false}, ${user.rights_testing_ground ?? false})
        ON CONFLICT (discord_user_id) DO NOTHING
    `;
}

export async function updateUser(discordUserId: string, data: Partial<DatabaseUser>): Promise<void> {
    const fields = Object.entries(data).filter(([, value]) => value !== undefined);
    if (fields.length === 0) return;

    const setFragments: string[] = [];
    const values: unknown[] = [];

    fields.forEach(([key, value], index) => {
        setFragments.push(`${key} = $${index + 1}`);
        values.push(value);
    });
    values.push(discordUserId);

    const query = `
        UPDATE users
        SET ${setFragments.join(', ')}, updated_at = NOW()
        WHERE discord_user_id = $${fields.length + 1}
    `;

    await sql(query, values as never);
}
