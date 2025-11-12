import { query } from './client';
import { createLogger } from '../utils/logger';

const logger = createLogger('DatabaseSchema');
let initialized = false;

export async function ensureDatabaseSetup(): Promise<void> {
    if (initialized) return;

    logger.info('Ensuring database schema exists');

    await query(`
        CREATE TABLE IF NOT EXISTS users (
            discord_user_id VARCHAR(64) PRIMARY KEY,
            username VARCHAR(191) NOT NULL,
            avatar TEXT NOT NULL,
            rights_update TINYINT(1) DEFAULT 0,
            rights_testing_ground TINYINT(1) DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await query(`
        CREATE TABLE IF NOT EXISTS rooms (
            id CHAR(36) PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            invite_code VARCHAR(16) NOT NULL UNIQUE,
            password_hash VARCHAR(255),
            password_salt VARCHAR(255),
            created_by VARCHAR(64),
            archived_at TIMESTAMP NULL DEFAULT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            CONSTRAINT fk_rooms_created_by FOREIGN KEY (created_by) REFERENCES users(discord_user_id) ON DELETE SET NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await query(`
        ALTER TABLE rooms
        ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP NULL DEFAULT NULL
    `);

    await query(`
        CREATE TABLE IF NOT EXISTS room_members (
            id CHAR(36) PRIMARY KEY,
            room_id CHAR(36) NOT NULL,
            user_id VARCHAR(64) NOT NULL,
            nickname VARCHAR(80),
            joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY uniq_room_member (room_id, user_id),
            CONSTRAINT fk_members_room FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
            CONSTRAINT fk_members_user FOREIGN KEY (user_id) REFERENCES users(discord_user_id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await query(`
        ALTER TABLE room_members
        ADD COLUMN IF NOT EXISTS nickname VARCHAR(80)
    `);

    await query(`
        CREATE TABLE IF NOT EXISTS room_messages (
            id CHAR(36) PRIMARY KEY,
            room_id CHAR(36) NOT NULL,
            user_id VARCHAR(64),
            content TEXT,
            type VARCHAR(16) NOT NULL DEFAULT 'text',
            dice_notation VARCHAR(64),
            dice_total INT,
            dice_rolls JSON,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT fk_messages_room FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
            CONSTRAINT fk_messages_user FOREIGN KEY (user_id) REFERENCES users(discord_user_id) ON DELETE SET NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await query(`
        CREATE TABLE IF NOT EXISTS room_dices (
            id CHAR(36) PRIMARY KEY,
            room_id CHAR(36) NOT NULL,
            created_by VARCHAR(64),
            notation VARCHAR(64) NOT NULL,
            description VARCHAR(255),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            CONSTRAINT fk_room_dices_room FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
            CONSTRAINT fk_room_dices_user FOREIGN KEY (created_by) REFERENCES users(discord_user_id) ON DELETE SET NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await query(`
        CREATE TABLE IF NOT EXISTS user_api_keys (
            user_id VARCHAR(64) PRIMARY KEY,
            api_key_hash CHAR(64) NOT NULL,
            api_key_encrypted TEXT NOT NULL,
            last_used_at TIMESTAMP NULL DEFAULT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            CONSTRAINT fk_user_api_keys_user FOREIGN KEY (user_id) REFERENCES users(discord_user_id) ON DELETE CASCADE,
            UNIQUE KEY uniq_api_keys_hash (api_key_hash)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    initialized = true;
    logger.success('Database schema ready');
}
