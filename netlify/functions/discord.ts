import type { Handler } from '@netlify/functions';
import { discordHandler } from '../core/discord/discord-handler.core';

export const handler: Handler = async (event) => {
    return discordHandler(event);
};
