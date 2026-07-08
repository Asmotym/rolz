import { execute, query } from '../client';
import type { DatabaseUser } from '../../types/database.types';
import { normalizeTheme, type AppTheme } from '../../types/theme.types';

export async function getUser(discordUserId: string): Promise<DatabaseUser | undefined> {
    const result = await query<DatabaseUser[]>(
        `SELECT discord_user_id, username, avatar, theme, rights_update, rights_testing_ground
         FROM users
         WHERE discord_user_id = ?
         LIMIT 1`,
        [discordUserId]
    );
    if (!result[0]) return undefined;

    return {
        ...result[0],
        theme: normalizeTheme(result[0].theme),
        rights_update: Boolean(result[0].rights_update),
        rights_testing_ground: Boolean(result[0].rights_testing_ground)
    };
}

export async function insertUser(user: DatabaseUser): Promise<void> {
    await execute(
        `INSERT INTO users (discord_user_id, username, avatar, theme, rights_update, rights_testing_ground)
         VALUES (?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE discord_user_id = discord_user_id`,
        [
            user.discord_user_id ?? null,
            user.username ?? null,
            user.avatar ?? null,
            normalizeTheme(user.theme),
            user.rights_update ?? false,
            user.rights_testing_ground ?? false
        ]
    );
}

export async function updateUser(discordUserId: string, data: Partial<DatabaseUser>): Promise<void> {
    const theme = typeof data.theme === 'undefined' ? null : normalizeTheme(data.theme);

    await execute(
        `UPDATE users
         SET
             username = COALESCE(?, username),
             avatar = COALESCE(?, avatar),
             theme = COALESCE(?, theme),
             rights_update = COALESCE(?, rights_update),
             rights_testing_ground = COALESCE(?, rights_testing_ground),
             updated_at = CURRENT_TIMESTAMP
         WHERE discord_user_id = ?`,
        [
            data.username ?? null,
            data.avatar ?? null,
            theme,
            data.rights_update ?? null,
            data.rights_testing_ground ?? null,
            discordUserId
        ]
    );
}

export async function updateUserTheme(discordUserId: string, theme: AppTheme): Promise<AppTheme> {
    const normalizedTheme = normalizeTheme(theme);
    await updateUser(discordUserId, { theme: normalizedTheme });
    return normalizedTheme;
}
