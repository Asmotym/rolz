export interface DatabaseUser {
    discord_user_id?: string;
    username: string;
    avatar: string;
    rights_update?: boolean;
    rights_testing_ground?: boolean;
}

export interface DatabaseRoom {
    id: string;
    name: string;
    invite_code: string;
    password_hash?: string | null;
    password_salt?: string | null;
    created_by?: string | null;
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
    joined_at?: string;
    last_seen?: string;
}

export interface DatabaseRoomMessage {
    id: string;
    room_id: string;
    user_id: string | null;
    content: string | null;
    type: 'text' | 'dice';
    dice_notation?: string | null;
    dice_total?: number | null;
    dice_rolls?: number[] | null;
    created_at: string;
    username?: string | null;
    avatar?: string | null;
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
