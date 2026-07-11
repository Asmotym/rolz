import type { AppTheme } from './theme.types';
import type { UserRole } from './data.types';

export type DiscordAuth = {
    tokenType: string;
    accessToken: string;
    expiresIn: number;
    scope: string;
    state: string;
}

export interface DiscordUser {
    id: string;
    username: string;
    avatar: string;
    theme?: AppTheme;
    role?: UserRole;
}
