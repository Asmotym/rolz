export interface DatabaseUser {
    discord_user_id?: string;
    username: string;
    avatar: string;
    rights_update?: boolean;
    rights_testing_ground?: boolean;
}

export interface DatabaseUserApiKey {
    user_id: string;
    api_key_hash: string;
    api_key_encrypted: string;
    created_at?: string;
    updated_at?: string;
    last_used_at?: string | null;
}

export interface DatabaseRoom {
    id: string;
    name: string;
    invite_code: string;
    password_hash?: string | null;
    password_salt?: string | null;
    created_by?: string | null;
    roll_awards_enabled?: number | boolean | null;
    roll_awards_window?: number | null;
    archived_at?: string | null;
    created_at?: string;
    updated_at?: string;
    member_count?: number;
    last_activity?: string | null;
}

export interface NewRoom {
    id: string;
    name: string;
    invite_code: string;
    password_hash?: string | null;
    password_salt?: string | null;
    created_by?: string | null;
}

export interface DatabaseRoomMember {
    id: string;
    room_id: string;
    user_id: string;
    nickname?: string | null;
    joined_at?: string;
    last_seen?: string;
}

export interface DatabaseRoomMemberWithUser extends DatabaseRoomMember {
    username?: string | null;
    avatar?: string | null;
}

export interface DatabaseRoomMessage {
    id: string;
    room_id: string;
    user_id: string | null;
    content: string | null;
    type: 'text' | 'dice';
    dice_notation?: string | null;
    dice_total?: number | null;
    dice_rolls?: number[] | string | null;
    created_at: string;
    username?: string | null;
    avatar?: string | null;
    member_nickname?: string | null;
}

export interface NewRoomMessage {
    id?: string;
    room_id: string;
    user_id: string;
    content?: string | null;
    type: 'text' | 'dice';
    dice_notation?: string | null;
    dice_total?: number | null;
    dice_rolls?: number[];
}

export interface DatabaseRoomDice {
    id: string;
    room_id: string;
    created_by?: string | null;
    category_id?: string | null;
    notation: string;
    description?: string | null;
    created_at?: string;
    updated_at?: string;
}

export interface NewRoomDice {
    id?: string;
    room_id: string;
    created_by?: string | null;
    category_id?: string | null;
    notation: string;
    description?: string | null;
}

export interface DatabaseRoomDiceCategory {
    id: string;
    room_id: string;
    created_by?: string | null;
    name: string;
    sort_order?: number | null;
    is_default?: number | boolean | null;
    created_at?: string;
    updated_at?: string;
}

export interface NewRoomDiceCategory {
    id?: string;
    room_id: string;
    created_by?: string | null;
    name: string;
    sort_order?: number;
    is_default?: number | boolean;
}

export interface DatabaseRoomRollAward {
    id: string;
    room_id: string;
    created_by?: string | null;
    name: string;
    dice_notation?: string | null;
    dice_results?: string | number[] | null;
    created_at?: string;
    updated_at?: string;
}

export interface NewRoomRollAward {
    id?: string;
    room_id: string;
    created_by?: string | null;
    name: string;
    dice_notation?: string | null;
    dice_results: string;
}
