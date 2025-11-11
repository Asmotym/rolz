import type { DiscordAuth } from "../types/discord.types";
import { DiscordClient } from "./client";
import { ensureDatabaseSetup } from "../database/schema";
import { getUser, insertUser, updateUser } from "../database/tables/users.table";
import { createLogger } from "../utils/logger";

const logger = createLogger('DiscordHandler');
const discordClient = new DiscordClient();

export type DiscordQueryType = 'user';

export type DiscordQueryPayload = DiscordAuth & {
    queryType?: DiscordQueryType;
};

export async function handleDiscordQuery(payload: DiscordQueryPayload) {
    const queryType = payload.queryType ?? 'user';
    logger.info(`Processing ${logger.highlight(queryType)} query`);

    switch (queryType) {
        case 'user':
            return handleUserQuery(payload);
        default:
            throw new Error(`Unknown query type: ${queryType}`);
    }
}

async function handleUserQuery(auth: DiscordAuth) {
    if (!auth.tokenType || !auth.accessToken) {
        throw new Error('Missing Discord authentication tokens');
    }

    await ensureDatabaseSetup();
    logger.info('Fetching Discord user info');

    const discordUser = await discordClient.getUserInfo(auth);
    logger.success(`Retrieved Discord user: ${logger.highlight(discordUser.username)} (${logger.highlight(discordUser.id)})`);

    const existingUser = await getUser(discordUser.id);
    if (existingUser === undefined) {
        logger.info('User not found in database, creating new user');
        await insertUser({
            discord_user_id: discordUser.id,
            username: discordUser.username,
            avatar: discordUser.avatar,
        });
    } else {
        logger.info('User found in database, updating user info');
        await updateUser(discordUser.id, {
            username: discordUser.username,
            avatar: discordUser.avatar,
        });
    }

    return discordUser;
}
