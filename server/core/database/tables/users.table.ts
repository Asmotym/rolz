import { execute, query } from '../client';
import type { DatabaseUser } from '../../types/database.types';
import { normalizeTheme, type AppTheme } from '../../types/theme.types';
import type { UserRole, UserSummary } from '../../types/data.types';

const USER_ROLES: UserRole[] = ['owner', 'admin', 'user'];

export function normalizeUserRole(role: unknown): UserRole {
    return USER_ROLES.includes(role as UserRole) ? role as UserRole : 'user';
}

export async function getUser(discordUserId: string): Promise<DatabaseUser | undefined> {
    const result = await query<DatabaseUser[]>(
        `SELECT discord_user_id, username, avatar, theme, role, rights_update, rights_testing_ground, created_at, updated_at
         FROM users
         WHERE discord_user_id = ?
         LIMIT 1`,
        [discordUserId]
    );
    if (!result[0]) return undefined;

    return {
        ...result[0],
        theme: normalizeTheme(result[0].theme),
        role: normalizeUserRole(result[0].role),
        rights_update: Boolean(result[0].rights_update),
        rights_testing_ground: Boolean(result[0].rights_testing_ground)
    };
}

export async function insertUser(user: DatabaseUser): Promise<void> {
    await execute(
        `INSERT INTO users (discord_user_id, username, avatar, theme, role, rights_update, rights_testing_ground)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE discord_user_id = discord_user_id`,
        [
            user.discord_user_id ?? null,
            user.username ?? null,
            user.avatar ?? null,
            normalizeTheme(user.theme),
            normalizeUserRole(user.role),
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
             role = COALESCE(?, role),
             rights_update = COALESCE(?, rights_update),
             rights_testing_ground = COALESCE(?, rights_testing_ground),
             updated_at = CURRENT_TIMESTAMP
         WHERE discord_user_id = ?`,
        [
            data.username ?? null,
            data.avatar ?? null,
            theme,
            typeof data.role === 'undefined' ? null : normalizeUserRole(data.role),
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

export async function listUsers(): Promise<UserSummary[]> {
    const rows = await query<DatabaseUser[]>(
        `SELECT discord_user_id, username, avatar, role, created_at, updated_at
         FROM users
         ORDER BY FIELD(role, 'owner', 'admin', 'user'), username ASC`
    );

    return rows.map((row) => ({
        id: row.discord_user_id ?? '',
        username: row.username,
        avatar: row.avatar,
        role: normalizeUserRole(row.role),
        createdAt: row.created_at,
        updatedAt: row.updated_at
    }));
}

export async function updateUserRole(discordUserId: string, role: UserRole): Promise<UserSummary | null> {
    await execute(
        `UPDATE users
         SET role = ?, updated_at = CURRENT_TIMESTAMP
         WHERE discord_user_id = ?`,
        [normalizeUserRole(role), discordUserId]
    );

    const user = await getUser(discordUserId);
    if (!user) return null;

    return {
        id: user.discord_user_id ?? discordUserId,
        username: user.username,
        avatar: user.avatar,
        role: normalizeUserRole(user.role),
        createdAt: user.created_at,
        updatedAt: user.updated_at
    };
}
