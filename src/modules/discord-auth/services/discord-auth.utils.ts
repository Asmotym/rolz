import type { DiscordAuth } from 'netlify/core/types/discord.types';

const EXPIRY_SAFETY_WINDOW_MS = 30_000;

export function createDiscordAuth(
    params: URLSearchParams,
    now = Date.now()
): DiscordAuth | null {
    const tokenType = params.get('token_type');
    const accessToken = params.get('access_token');
    const expiresIn = Number(params.get('expires_in'));
    const scope = params.get('scope') ?? '';
    const state = params.get('state') ?? '';

    if (
        tokenType?.toLowerCase() !== 'bearer'
        || !accessToken
        || !Number.isFinite(expiresIn)
        || expiresIn <= 0
        || !state
    ) {
        return null;
    }

    return {
        tokenType: 'Bearer',
        accessToken,
        expiresIn,
        expiresAt: now + expiresIn * 1_000,
        scope,
        state
    };
}

export function isDiscordAuthExpired(auth: DiscordAuth, now = Date.now()): boolean {
    return auth.expiresAt <= now + EXPIRY_SAFETY_WINDOW_MS;
}
