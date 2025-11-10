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

    <v-row>
      <v-col cols="12" md="4">
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
      <v-col cols="12" md="8">
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
import { useRoute } from 'vue-router';
import RoomsSidebar from './RoomsSidebar.component.vue';
import RoomChatPanel from './RoomChatPanel.component.vue';
import { useRoomsStore } from 'core/stores/rooms.store';
import { DiscordService } from 'modules/discord-auth/services/discord.service';
import type { DiceRoll } from 'core/utils/dice.utils';

const roomsStore = useRoomsStore();
const discordService = DiscordService.getInstance();
const route = useRoute();

const currentUser = computed(() => discordService.user.value);
const rooms = computed(() => roomsStore.rooms);
const selectedRoom = computed(() => roomsStore.selectedRoom);
const messages = computed(() => roomsStore.messages);

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
  () => discordService.user.value,
  async (user, previous) => {
    if (user && !previous) {
      await ensureRoomsLoaded();
      attemptInviteJoin();
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
    await roomsStore.createRoom({
      ...payload,
      userId: currentUser.value.id,
    });
    showFeedback('success', 'Room created successfully');
  } catch (error) {
    console.error(error);
  }
}

async function handleJoinRoom(payload: { inviteCode: string; password?: string | null }) {
  if (!currentUser.value) return;
  try {
    await roomsStore.joinRoom({
      ...payload,
      userId: currentUser.value.id,
    });
    showFeedback('success', 'Joined room');
  } catch (error) {
    console.error(error);
    throw error;
  }
}

async function handleSendMessage(content: string) {
  if (!currentUser.value || !roomsStore.selectedRoomId) return;
  const trimmed = content.trim();
  if (!trimmed) return;

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
  roomsStore.selectRoom(roomId).catch(console.error);
}
</script>

<style scoped>
.rooms-board {
  min-height: 60vh;
}
</style>
