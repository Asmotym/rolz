export interface RoomSummary {
    id: string;
    name: string;
    inviteCode: string;
    isProtected: boolean;
    memberCount: number;
    lastActivity?: string | null;
    archivedAt?: string | null;
    isArchived?: boolean;
    isCreator?: boolean;
}

export interface RoomDetails extends RoomSummary {
    createdBy?: string | null;
    createdAt?: string;
    rollAwardsEnabled?: boolean;
    rollAwardsWindow?: number | null;
}

export interface RoomMemberDetails {
    userId: string;
    username?: string;
    nickname?: string;
    avatar?: string;
    joinedAt?: string;
    lastSeen?: string;
    isOnline?: boolean;
}

export type RoomMessageType = 'text' | 'dice';

export interface RoomMessage {
    id: string;
    roomId: string;
    userId: string | null;
    username?: string;
    nickname?: string;
    avatar?: string;
    content?: string | null;
    type: RoomMessageType;
    diceNotation?: string | null;
    diceTotal?: number | null;
    diceRolls?: number[] | null;
    createdAt: string;
}

export interface RoomDice {
    id: string;
    roomId: string;
    notation: string;
    description?: string | null;
    categoryId?: string;
    categoryName?: string;
    createdBy?: string | null;
    createdAt?: string;
    updatedAt?: string;
}

export interface RoomDiceCategory {
    id: string;
    roomId: string;
    name: string;
    sortOrder?: number;
    isDefault?: boolean;
    createdBy?: string | null;
    createdAt?: string;
    updatedAt?: string;
}

export interface RoomRollAward {
    id: string;
    roomId: string;
    name: string;
    description?: string | null;
    diceResults: number[];
    diceNotations?: string[];
    diceNotation?: string | null;
    createdBy?: string | null;
    createdAt?: string;
    updatedAt?: string;
}
