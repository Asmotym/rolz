import { defineStore } from 'pinia';
import type { RoomDetails, RoomMessage } from 'netlify/core/types/data.types';
import type { DiceRoll } from 'core/utils/dice.utils';
import { RoomsService } from 'core/services/rooms.service';

interface LiveTimer {
    id: number | null;
}

const ensureAscending = (items: RoomMessage[]): RoomMessage[] => {
    return [...items].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
};

export const useRoomsStore = defineStore('rooms', {
    state: () => ({
        rooms: [] as RoomDetails[],
        selectedRoomId: null as string | null,
        messages: [] as RoomMessage[],
        loadingRooms: false,
        creatingRoom: false,
        joiningRoom: false,
        sendingMessage: false,
        lastMessageAt: null as string | null,
        live: { id: null } as LiveTimer,
        errorMessage: null as string | null,
    }),
    getters: {
        selectedRoom(state): RoomDetails | null {
            return state.rooms.find((room) => room.id === state.selectedRoomId) ?? null;
        },
    },
    actions: {
        setError(message: string | null) {
            this.errorMessage = message;
        },
        async fetchRooms() {
            this.loadingRooms = true;
            this.setError(null);
            try {
                const rooms = await RoomsService.fetchRooms();
                this.rooms = rooms.sort(sortRoomsByActivity);
            } catch (error) {
                this.setError(error instanceof Error ? error.message : 'Unable to load rooms');
                throw error;
            } finally {
                this.loadingRooms = false;
            }
        },
        async createRoom(payload: { name: string; password?: string | null; userId: string }) {
            this.creatingRoom = true;
            this.setError(null);
            try {
                const room = await RoomsService.createRoom(payload);
                this.upsertRoom(room);
                this.selectRoom(room.id);
                return room;
            } catch (error) {
                this.setError(error instanceof Error ? error.message : 'Unable to create room');
                throw error;
            } finally {
                this.creatingRoom = false;
            }
        },
        async joinRoom(payload: { inviteCode: string; password?: string | null; userId: string }) {
            this.joiningRoom = true;
            this.setError(null);
            try {
                const room = await RoomsService.joinRoom(payload);
                this.upsertRoom(room);
                this.selectRoom(room.id);
                return room;
            } catch (error) {
                this.setError(error instanceof Error ? error.message : 'Unable to join room');
                throw error;
            } finally {
                this.joiningRoom = false;
            }
        },
        async selectRoom(roomId: string | null) {
            if (roomId === this.selectedRoomId) {
                return;
            }

            this.selectedRoomId = roomId;
            this.messages = [];
            this.lastMessageAt = null;

            if (!roomId) {
                this.stopLiveUpdates();
                return;
            }

            await this.loadMessages(roomId);
            this.startLiveUpdates(roomId);
        },
        async loadMessages(roomId: string) {
            try {
                const messages = await RoomsService.fetchMessages(roomId);
                this.messages = ensureAscending(messages);
                this.lastMessageAt = this.messages.length > 0 ? this.messages[this.messages.length - 1].createdAt : null;
            } catch (error) {
                this.setError(error instanceof Error ? error.message : 'Unable to load messages');
            }
        },
        async refreshMessages(roomId: string) {
            if (!this.lastMessageAt) {
                await this.loadMessages(roomId);
                return;
            }

            try {
                const updates = await RoomsService.fetchMessages(roomId, { since: this.lastMessageAt });
                if (updates.length === 0) return;
                this.appendMessages(updates);
            } catch (error) {
                console.error(error);
            }
        },
        async sendChatMessage(payload: { roomId: string; userId: string; content: string }) {
            this.sendingMessage = true;
            this.setError(null);
            try {
                const message = await RoomsService.sendMessage({
                    roomId: payload.roomId,
                    userId: payload.userId,
                    content: payload.content,
                    type: 'text',
                });
                this.appendMessages([message]);
            } catch (error) {
                this.setError(error instanceof Error ? error.message : 'Unable to send message');
                throw error;
            } finally {
                this.sendingMessage = false;
            }
        },
        async sendDiceRoll(payload: { roomId: string; userId: string; roll: DiceRoll }) {
            this.sendingMessage = true;
            this.setError(null);
            try {
                const message = await RoomsService.sendMessage({
                    roomId: payload.roomId,
                    userId: payload.userId,
                    type: 'dice',
                    dice: {
                        notation: payload.roll.dice,
                        total: payload.roll.total,
                        rolls: payload.roll.rolls,
                    },
                    content: payload.roll.description,
                });
                this.appendMessages([message]);
            } catch (error) {
                this.setError(error instanceof Error ? error.message : 'Unable to send dice result');
                throw error;
            } finally {
                this.sendingMessage = false;
            }
        },
        appendMessages(messages: RoomMessage[]) {
            const dedup = new Map(this.messages.map((message) => [message.id, message]));
            for (const message of messages) {
                dedup.set(message.id, message);
            }
            this.messages = ensureAscending(Array.from(dedup.values()));
            const last = this.messages[this.messages.length - 1];
            this.lastMessageAt = last ? last.createdAt : this.lastMessageAt;
            if (messages.length > 0) {
                const latest = messages[messages.length - 1];
                this.bumpRoomActivity(latest.roomId, latest.createdAt);
            }
        },
        upsertRoom(room: RoomDetails) {
            const existingIndex = this.rooms.findIndex((current) => current.id === room.id);
            if (existingIndex !== -1) {
                this.rooms[existingIndex] = room;
            } else {
                this.rooms.push(room);
            }
            this.rooms = [...this.rooms].sort(sortRoomsByActivity);
        },
        startLiveUpdates(roomId: string) {
            if (typeof window === 'undefined') return;
            this.stopLiveUpdates();
            this.live.id = window.setInterval(() => {
                if (this.selectedRoomId === roomId) {
                    this.refreshMessages(roomId);
                }
            }, 3500);
        },
        stopLiveUpdates() {
            if (this.live.id) {
                clearInterval(this.live.id);
                this.live.id = null;
            }
        },
        bumpRoomActivity(roomId: string, activity: string) {
            const room = this.rooms.find((current) => current.id === roomId);
            if (!room) return;
            room.lastActivity = activity;
            this.rooms = [...this.rooms].sort(sortRoomsByActivity);
        },
        teardown() {
            this.stopLiveUpdates();
            this.selectedRoomId = null;
            this.messages = [];
            this.lastMessageAt = null;
        },
    },
});

function sortRoomsByActivity(a: RoomDetails, b: RoomDetails) {
    const aDate = a.lastActivity ? new Date(a.lastActivity).getTime() : 0;
    const bDate = b.lastActivity ? new Date(b.lastActivity).getTime() : 0;
    return bDate - aDate;
}
