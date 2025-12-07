import { query } from './client';
import { createLogger } from '../utils/logger';

const logger = createLogger('DatabaseSchema');
let initialized = false;

async function columnExists(table: string, column: string): Promise<boolean> {
    const result = await query<{ count: number }[]>(
        `
        SELECT COUNT(*) AS count
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = ?
          AND COLUMN_NAME = ?
        `,
        [table, column]
    );
    return Boolean(result[0]?.count);
}

async function indexExists(table: string, indexName: string): Promise<boolean> {
    const result = await query<{ count: number }[]>(
        `
        SELECT COUNT(*) AS count
        FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = ?
          AND INDEX_NAME = ?
        `,
        [table, indexName]
    );
    return Boolean(result[0]?.count);
}

export async function ensureDatabaseSetup(): Promise<void> {
    if (initialized) {
        await ensureRollAwardDiceNotationColumn();
        return;
    }

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
            roll_awards_enabled TINYINT(1) DEFAULT 0,
            roll_awards_window INT NULL,
            archived_at TIMESTAMP NULL DEFAULT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            CONSTRAINT fk_rooms_created_by FOREIGN KEY (created_by) REFERENCES users(discord_user_id) ON DELETE SET NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    if (!(await columnExists('rooms', 'archived_at'))) {
        await query(`
            ALTER TABLE rooms
            ADD COLUMN archived_at TIMESTAMP NULL DEFAULT NULL
        `);
    }

    if (!(await columnExists('rooms', 'roll_awards_enabled'))) {
        await query(`
            ALTER TABLE rooms
            ADD COLUMN roll_awards_enabled TINYINT(1) DEFAULT 0
        `);
    }

    if (!(await columnExists('rooms', 'roll_awards_window'))) {
        await query(`
            ALTER TABLE rooms
            ADD COLUMN roll_awards_window INT NULL
        `);
    }

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

    if (!(await columnExists('room_members', 'nickname'))) {
        await query(`
            ALTER TABLE room_members
            ADD COLUMN nickname VARCHAR(80)
        `);
    }

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
        CREATE TABLE IF NOT EXISTS room_dice_categories (
            id CHAR(36) PRIMARY KEY,
            room_id CHAR(36) NOT NULL,
            created_by VARCHAR(64),
            name VARCHAR(80) NOT NULL,
            sort_order INT DEFAULT 0,
            is_default TINYINT(1) DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            CONSTRAINT fk_dice_categories_room FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
            CONSTRAINT fk_dice_categories_user FOREIGN KEY (created_by) REFERENCES users(discord_user_id) ON DELETE SET NULL,
            UNIQUE KEY uniq_dice_category (room_id, created_by, name)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await query(`
        CREATE TABLE IF NOT EXISTS room_dices (
            id CHAR(36) PRIMARY KEY,
            room_id CHAR(36) NOT NULL,
            created_by VARCHAR(64),
            category_id CHAR(36),
            notation VARCHAR(64) NOT NULL,
            description VARCHAR(255),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            CONSTRAINT fk_room_dices_room FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
            CONSTRAINT fk_room_dices_user FOREIGN KEY (created_by) REFERENCES users(discord_user_id) ON DELETE SET NULL,
            CONSTRAINT fk_room_dices_category FOREIGN KEY (category_id) REFERENCES room_dice_categories(id) ON DELETE SET NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    if (!(await columnExists('room_dices', 'category_id'))) {
        await query(`
            ALTER TABLE room_dices
            ADD COLUMN category_id CHAR(36) NULL
        `);
    }

    if (!(await indexExists('room_dices', 'idx_room_dices_category'))) {
        await query(`
            CREATE INDEX idx_room_dices_category ON room_dices (category_id)
        `);
    }

    const existingCategoryConstraint = await query<{ constraint_name: string }[]>(
        `
        SELECT CONSTRAINT_NAME AS constraint_name
        FROM information_schema.KEY_COLUMN_USAGE
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'room_dices'
          AND CONSTRAINT_NAME = 'fk_room_dices_category'
        LIMIT 1
        `
    );

    if (existingCategoryConstraint.length === 0) {
        await query(`
            ALTER TABLE room_dices
            ADD CONSTRAINT fk_room_dices_category FOREIGN KEY (category_id)
            REFERENCES room_dice_categories(id) ON DELETE SET NULL
        `);
    }

    await query(`
        CREATE TABLE IF NOT EXISTS room_roll_awards (
            id CHAR(36) PRIMARY KEY,
            room_id CHAR(36) NOT NULL,
            created_by VARCHAR(64),
            name VARCHAR(120) NOT NULL,
            dice_notation VARCHAR(64) NULL,
            dice_results JSON NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            CONSTRAINT fk_roll_awards_room FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
            CONSTRAINT fk_roll_awards_user FOREIGN KEY (created_by) REFERENCES users(discord_user_id) ON DELETE SET NULL,
            INDEX idx_roll_awards_room (room_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await ensureRollAwardDiceNotationColumn();

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

async function ensureRollAwardDiceNotationColumn(): Promise<void> {
    if (!(await columnExists('room_roll_awards', 'dice_notation'))) {
        await query(`
            ALTER TABLE room_roll_awards
            ADD COLUMN dice_notation VARCHAR(64) NULL AFTER name
        `);
    }
}
