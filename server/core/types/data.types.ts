export type UserRole = 'owner' | 'admin' | 'user';

export interface UserSummary {
    id: string;
    username: string;
    avatar: string;
    role: UserRole;
    createdAt?: string;
    updatedAt?: string;
}

export type ArticleStatus = 'draft' | 'unpublished' | 'published';

export interface ArticleTag {
    id: string;
    name: string;
    slug: string;
    createdBy?: string | null;
    createdAt?: string;
    updatedAt?: string;
}

export interface ArticleSummary {
    id: string;
    slug: string;
    title: string;
    introduction: string;
    excerpt: string;
    status: ArticleStatus;
    authorId?: string | null;
    authorName?: string | null;
    publishedAt?: string | null;
    archivedAt?: string | null;
    createdAt?: string;
    updatedAt?: string;
    tags: ArticleTag[];
}

export interface ArticleDetails extends ArticleSummary {
    markdownSource?: string;
    sanitizedHtml: string;
}

export interface ArticleDraft {
    id: string;
    ownerId: string;
    title?: string | null;
    introduction?: string | null;
    markdownSource: string;
    selectedTagIds: string[];
    createdAt?: string;
    updatedAt?: string;
}

export type RoomCriticalRuleOperator = 'moreThan' | 'lessThan';

export interface RoomCriticalRule {
    threshold: number;
    operator: RoomCriticalRuleOperator;
    color: string;
}

export type RoomBonusPointConditionOperator = 'moreThan' | 'lessThan' | 'between';
export type RoomBonusPointAdjustmentSign = '+' | '-';

export interface RoomBonusPointCondition {
    operator: RoomBonusPointConditionOperator;
    threshold: number;
    thresholdMax?: number | null;
}

export interface RoomBonusPointSpendAdjustment {
    sign: RoomBonusPointAdjustmentSign;
    amount: number;
}

export interface RoomBonusPointSettings {
    roomId: string;
    enabled: boolean;
    maxPointsPerUser: number;
    allowExtremeSpend: boolean;
}

export interface RoomBonusPointRule {
    id: string;
    roomId: string;
    name: string;
    diceNotation: string;
    condition: RoomBonusPointCondition;
    spendAdjustment: RoomBonusPointSpendAdjustment;
    createdBy?: string | null;
    createdAt?: string;
    updatedAt?: string;
}

export interface RoomBonusPointBalance {
    roomId: string;
    userId: string;
    points: number;
    username?: string;
    nickname?: string;
    avatar?: string;
}

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
    criticals?: RoomCriticalRule[];
    bonusPointSettings?: RoomBonusPointSettings;
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
    pointUsed?: boolean;
    diceBaseTotal?: number | null;
    bonusPointAdjustment?: number | null;
    bonusPointsUsed?: number;
    bonusPointRuleUsed?: { id: string; name: string } | null;
    bonusPointRulesSkipped?: boolean;
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
