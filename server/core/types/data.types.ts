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
    createdBy?: string | null;
    createdAt?: string;
    updatedAt?: string;
}
