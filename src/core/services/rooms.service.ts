import { getApiUrl } from 'modules/discord-auth/utils/urls.utils';
import type { RoomDetails, RoomMemberDetails, RoomMessage, RoomDice, RoomDiceCategory } from 'netlify/core/types/data.types';

const ROOMS_ENDPOINT = getApiUrl('/rooms');

type RequestPayload = Record<string, unknown>;

interface ApiResponse<T> {
    success: boolean;
    data: T;
    error?: string;
}

function parseJson<T>(value: string): T | null {
    if (!value) return null;
    try {
        return JSON.parse(value) as T;
    } catch {
        return null;
    }
}

async function request<T>(body: RequestPayload): Promise<T> {
    const response = await fetch(ROOMS_ENDPOINT, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
    });

    const text = await response.text();
    const payload = parseJson<ApiResponse<T>>(text);

    if (!response.ok) {
        const fallbackMessage = payload?.error ?? (text.trim() || `Request failed with status ${response.status}`);
        throw new Error(fallbackMessage);
    }

    if (!payload) {
        throw new Error('Invalid server response');
    }

    if (!payload.success) {
        throw new Error(payload.error || 'Unknown error');
    }

    return payload.data;
}

export class RoomsService {
    static async fetchRooms(): Promise<RoomDetails[]> {
        const data = await request<{ rooms: RoomDetails[] }>({ action: 'list' });
        return data.rooms;
    }

    static async createRoom(payload: { name: string; password?: string | null; userId: string }): Promise<RoomDetails> {
        const data = await request<{ room: RoomDetails }>({
            action: 'create',
            payload
        });
        return data.room;
    }

    static async joinRoom(payload: { inviteCode: string; password?: string | null; userId: string }): Promise<RoomDetails> {
        const data = await request<{ room: RoomDetails }>({
            action: 'join',
            payload
        });
        return data.room;
    }

    static async fetchUserRooms(userId: string): Promise<RoomDetails[]> {
        const data = await request<{ rooms: RoomDetails[] }>({
            action: 'userRooms',
            payload: { userId }
        });
        return data.rooms;
    }

    static async fetchMessages(roomId: string, options?: { limit?: number; since?: string; userId?: string }): Promise<RoomMessage[]> {
        const data = await request<{ messages: RoomMessage[] }>({
            action: 'messages',
            payload: {
                roomId,
                limit: options?.limit,
                since: options?.since,
                userId: options?.userId
            }
        });
        return data.messages;
    }

    static async fetchMembers(roomId: string): Promise<RoomMemberDetails[]> {
        const data = await request<{ members: RoomMemberDetails[] }>({
            action: 'members',
            payload: { roomId }
        });
        return data.members;
    }

    static async fetchMember(payload: { roomId: string; userId: string }): Promise<RoomMemberDetails> {
        const data = await request<{ member: RoomMemberDetails }>({
            action: 'member',
            payload
        });
        return data.member;
    }

    static async updateRoom(payload: { roomId: string; userId: string; name: string }): Promise<RoomDetails> {
        const data = await request<{ room: RoomDetails }>({
            action: 'updateRoom',
            payload
        });
        return data.room;
    }

    static async updateNickname(payload: { roomId: string; userId: string; nickname?: string | null }): Promise<RoomMemberDetails> {
        const data = await request<{ member: RoomMemberDetails }>({
            action: 'updateNickname',
            payload
        });
        return data.member;
    }

    static async leaveRoom(payload: { roomId: string; userId: string }): Promise<void> {
        await request<{ roomId: string }>({
            action: 'leaveRoom',
            payload
        });
    }

    static async archiveRoom(payload: { roomId: string; userId: string }): Promise<RoomDetails> {
        const data = await request<{ room: RoomDetails }>({
            action: 'archiveRoom',
            payload
        });
        return data.room;
    }

    static async unarchiveRoom(payload: { roomId: string; userId: string }): Promise<RoomDetails> {
        const data = await request<{ room: RoomDetails }>({
            action: 'unarchiveRoom',
            payload
        });
        return data.room;
    }

    static async sendMessage(payload: { roomId: string; userId: string; content?: string; type: 'text' | 'dice'; dice?: { notation: string; total: number; rolls: number[] } }): Promise<RoomMessage> {
        const data = await request<{ message: RoomMessage }>({
            action: 'message',
            payload
        });
        return data.message;
    }

    static async fetchRoomDices(roomId: string, userId: string): Promise<{ dices: RoomDice[]; categories: RoomDiceCategory[] }> {
        const data = await request<{ roomId: string; dices: RoomDice[]; categories: RoomDiceCategory[] }>({
            action: 'roomDices',
            payload: { roomId, userId }
        });
        return { dices: data.dices, categories: data.categories };
    }

    static async createRoomDice(payload: { roomId: string; userId: string; notation: string; description?: string | null; categoryId?: string | null }): Promise<RoomDice> {
        const data = await request<{ dice: RoomDice }>({
            action: 'createDice',
            payload
        });
        return data.dice;
    }

    static async updateRoomDice(payload: { roomId: string; userId: string; diceId: string; notation: string; description?: string | null; categoryId?: string | null }): Promise<RoomDice> {
        const data = await request<{ dice: RoomDice }>({
            action: 'updateDice',
            payload
        });
        return data.dice;
    }

    static async deleteRoomDice(payload: { roomId: string; userId: string; diceId: string }): Promise<void> {
        await request<{ diceId: string }>({
            action: 'deleteDice',
            payload
        });
    }

    static async createDiceCategory(payload: { roomId: string; userId: string; name: string }): Promise<RoomDiceCategory> {
        const data = await request<{ category: RoomDiceCategory }>({
            action: 'createDiceCategory',
            payload
        });
        return data.category;
    }
}
