import { sql } from './client';
import { createLogger } from '../utils/logger';

const logger = createLogger('DatabaseSchema');
let initialized = false;

export async function ensureDatabaseSetup(): Promise<void> {
    if (initialized) return;

    logger.info('Ensuring database schema exists');

    await sql`
        CREATE TABLE IF NOT EXISTS users (
            discord_user_id TEXT PRIMARY KEY,
            username TEXT NOT NULL,
            avatar TEXT NOT NULL,
            rights_update BOOLEAN DEFAULT FALSE,
            rights_testing_ground BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
        )
    `;

    await sql`
        CREATE TABLE IF NOT EXISTS rooms (
            id UUID PRIMARY KEY,
            name TEXT NOT NULL,
            invite_code TEXT UNIQUE NOT NULL,
            password_hash TEXT,
            password_salt TEXT,
            created_by TEXT REFERENCES users(discord_user_id) ON DELETE SET NULL,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
        )
    `;

    await sql`
        CREATE TABLE IF NOT EXISTS room_members (
            id UUID PRIMARY KEY,
            room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
            user_id TEXT REFERENCES users(discord_user_id) ON DELETE CASCADE,
            joined_at TIMESTAMPTZ DEFAULT NOW(),
            last_seen TIMESTAMPTZ DEFAULT NOW(),
            UNIQUE(room_id, user_id)
        )
    `;

    await sql`
        CREATE TABLE IF NOT EXISTS room_messages (
            id UUID PRIMARY KEY,
            room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
            user_id TEXT REFERENCES users(discord_user_id) ON DELETE SET NULL,
            content TEXT,
            type TEXT NOT NULL DEFAULT 'text',
            dice_notation TEXT,
            dice_total INTEGER,
            dice_rolls JSONB,
            created_at TIMESTAMPTZ DEFAULT NOW()
        )
    `;

    initialized = true;
    logger.success('Database schema ready');
}
