<template>
  <div class="rooms-board">
    <v-alert
      v-if="roomsStore.errorMessage"
      type="error"
      variant="tonal"
      class="mb-4"
    >
      {{ roomsStore.errorMessage }}
    </v-alert>
    <v-alert
      v-else-if="feedback"
      :type="feedback.type"
      variant="tonal"
      class="mb-4"
    >
      {{ feedback.message }}
    </v-alert>

    <v-row class="justify-center" style="height: 100%;">
      <v-col v-if="!selectedRoom" cols="12" md="6">
        <RoomsSidebar
          :rooms="rooms"
          :selected-room-id="roomsStore.selectedRoomId"
          :loading="roomsStore.loadingRooms"
          :creating="roomsStore.creatingRoom"
          :joining="roomsStore.joiningRoom"
          @select="handleSelectRoom"
          @create="handleCreateRoom"
          @join="handleJoinRoom"
        />
      </v-col>
      <v-col v-if="selectedRoom" cols="12" style="height: 100%;">
        <RoomChatPanel
          :room="selectedRoom"
          :messages="messages"
          :sending="roomsStore.sendingMessage"
          :current-user="currentUser"
          @send-message="handleSendMessage"
          @send-dice="handleDiceRoll"
        />
      </v-col>
    </v-row>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { isNavigationFailure, useRoute, useRouter } from 'vue-router';
import RoomsSidebar from './RoomsSidebar.component.vue';
import RoomChatPanel from './RoomChatPanel.component.vue';
import { useRoomsStore } from 'core/stores/rooms.store';
import { DiscordService } from 'modules/discord-auth/services/discord.service';
import type { DiceRoll } from 'core/utils/dice.utils';
import { parseInlineDiceCommand, rollDiceNotation } from 'core/utils/dice.utils';
import { HomeRoutes } from 'core/routes';

const roomsStore = useRoomsStore();
const discordService = DiscordService.getInstance();
const route = useRoute();
const router = useRouter();

const currentUser = computed(() => discordService.user.value);
const rooms = computed(() => roomsStore.rooms);
const selectedRoom = computed(() => roomsStore.selectedRoom);
const messages = computed(() => roomsStore.messages);
const routeRoomId = computed(() => {
  const param = route.params.roomId;
  if (Array.isArray(param)) {
    return param[0] ?? null;
  }
  return param ? String(param) : null;
});

const feedback = ref<{ type: 'success' | 'info'; message: string } | null>(null);
const pendingInvite = ref<string | null>(null);

const clearFeedback = () => {
  feedback.value = null;
};

function showFeedback(type: 'success' | 'info', message: string) {
  feedback.value = { type, message };
  setTimeout(clearFeedback, 4000);
}

async function ensureRoomsLoaded() {
  try {
    await roomsStore.fetchRooms();
  } catch (error) {
    console.error(error);
  }
}

onMounted(async () => {
  await ensureRoomsLoaded();
  attemptInviteJoin();
});

onUnmounted(() => {
  roomsStore.teardown();
});

watch(
  routeRoomId,
  async (roomId) => {
    if (roomId && !currentUser.value) {
      navigateHome();
      return;
    }
    await roomsStore.selectRoom(roomId, currentUser.value?.id ?? null);
  },
  { immediate: true }
);

watch(
  () => discordService.user.value,
  async (user, previous) => {
    if (user && !previous) {
      await ensureRoomsLoaded();
      attemptInviteJoin();
    } else if (!user && previous) {
      await roomsStore.selectRoom(null);
      navigateHome();
    }
  }
);

watch(
  () => route.query.invite,
  (value) => {
    if (typeof value === 'string' && value.trim().length > 0) {
      pendingInvite.value = value.trim().toUpperCase();
      attemptInviteJoin();
    }
  },
  { immediate: true }
);

async function attemptInviteJoin() {
  if (!pendingInvite.value || !currentUser.value) return;
  try {
    await handleJoinRoom({ inviteCode: pendingInvite.value });
    showFeedback('success', 'Joined room via invite link');
  } catch (error) {
    console.error(error);
  } finally {
    pendingInvite.value = null;
  }
}

async function handleCreateRoom(payload: { name: string; password?: string | null }) {
  if (!currentUser.value) return;
  try {
    const room = await roomsStore.createRoom({
      ...payload,
      userId: currentUser.value.id,
    });
    if (room) {
      navigateToRoom(room.id);
    }
    showFeedback('success', 'Room created successfully');
  } catch (error) {
    console.error(error);
  }
}

async function handleJoinRoom(payload: { inviteCode: string; password?: string | null }) {
  if (!currentUser.value) return;
  try {
    const room = await roomsStore.joinRoom({
      ...payload,
      userId: currentUser.value.id,
    });
    if (room) {
      navigateToRoom(room.id);
    }
    showFeedback('success', 'Joined room');
    return room;
  } catch (error) {
    console.error(error);
    throw error;
  }
}

async function handleSendMessage(content: string) {
  if (!currentUser.value || !roomsStore.selectedRoomId) return;
  const trimmed = content.trim();
  if (!trimmed) return;

  const inlineDice = parseInlineDiceCommand(trimmed);
  if (inlineDice) {
    try {
      const roll = rollDiceNotation(inlineDice.notation, undefined, inlineDice.description);
      await roomsStore.sendDiceRoll({
        roomId: roomsStore.selectedRoomId,
        userId: currentUser.value.id,
        roll,
      });
    } catch (error) {
      console.error(error);
    }
    return;
  }

  try {
    await roomsStore.sendChatMessage({
      roomId: roomsStore.selectedRoomId,
      userId: currentUser.value.id,
      content: trimmed,
    });
  } catch (error) {
    console.error(error);
  }
}

async function handleDiceRoll(roll: DiceRoll) {
  if (!currentUser.value || !roomsStore.selectedRoomId) return;
  try {
    await roomsStore.sendDiceRoll({
      roomId: roomsStore.selectedRoomId,
      userId: currentUser.value.id,
      roll,
    });
  } catch (error) {
    console.error(error);
  }
}

function handleSelectRoom(roomId: string) {
  navigateToRoom(roomId);
}

function navigateToRoom(roomId: string) {
  router.push({ name: HomeRoutes.Room, params: { roomId } }).catch((error) => {
    if (!isNavigationFailure(error)) {
      console.error(error);
    }
  });
}

function navigateHome() {
  router.push({ name: HomeRoutes.Base }).catch((error) => {
    if (!isNavigationFailure(error)) {
      console.error(error);
    }
  });
}
</script>

<style scoped>
.rooms-board {
  min-height: 60vh;
  height: 100%;
}
</style>
