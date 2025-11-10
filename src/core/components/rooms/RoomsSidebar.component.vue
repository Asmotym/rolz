<template>
  <div class="rooms-sidebar">
    <v-card class="mb-4">
      <v-card-title class="d-flex justify-space-between align-center">
        <span class="text-subtitle-1">Rooms</span>
        <v-chip v-if="rooms.length" size="small" color="primary" variant="flat">
          {{ rooms.length }}
        </v-chip>
      </v-card-title>
      <v-card-text class="pr-0">
        <v-skeleton-loader
          v-if="loading"
          type="list-item-avatar-two-line@3"
        />
        <v-list v-else density="compact" class="pr-0">
          <v-list-item
            v-for="room in rooms"
            :key="room.id"
            :active="room.id === selectedRoomId"
            @click="emit('select', room.id)"
            rounded="lg"
          >
            <template #prepend>
              <v-avatar size="32" color="primary" variant="tonal">
                <v-icon :icon="room.isProtected ? 'mdi-lock' : 'mdi-dice-multiple'"></v-icon>
              </v-avatar>
            </template>
            <div class="d-flex flex-column">
              <span class="text-body-1 font-weight-medium">
                {{ room.name }}
              </span>
              <small class="text-medium-emphasis">
                {{ formatActivity(room.lastActivity) }}
              </small>
            </div>
            <template #append>
              <v-chip size="small" color="secondary" variant="tonal">
                {{ room.memberCount ?? 0 }} 👥
              </v-chip>
            </template>
          </v-list-item>

          <div
            v-if="!rooms.length"
            class="text-medium-emphasis text-center py-6"
          >
            No rooms yet. Create one to get rolling.
          </div>
        </v-list>
      </v-card-text>
    </v-card>

    <v-card class="mb-4">
      <v-card-title class="text-subtitle-1">Create a room</v-card-title>
      <v-card-text>
        <v-text-field
          v-model="createForm.name"
          label="Room name"
          variant="outlined"
          density="comfortable"
          maxlength="80"
          class="mb-3"
        />
        <v-text-field
          v-model="createForm.password"
          type="password"
          label="Password (optional)"
          variant="outlined"
          density="comfortable"
          hint="Leave empty for a public room"
          persistent-hint
          class="mb-4"
        />
        <v-btn
          color="primary"
          block
          :loading="creating"
          :disabled="!createForm.name.trim()"
          @click="createRoom"
        >
          Create room
        </v-btn>
      </v-card-text>
    </v-card>

    <v-card>
      <v-card-title class="text-subtitle-1">Join via invite</v-card-title>
      <v-card-text>
        <v-text-field
          v-model="joinForm.inviteCode"
          label="Invite code"
          variant="outlined"
          density="comfortable"
          class="mb-3"
        />
        <v-text-field
          v-model="joinForm.password"
          type="password"
          label="Password (if needed)"
          variant="outlined"
          density="comfortable"
          class="mb-4"
        />
        <v-btn
          variant="tonal"
          color="secondary"
          block
          :loading="joining"
          :disabled="!joinForm.inviteCode.trim()"
          @click="joinRoom"
        >
          Join room
        </v-btn>
      </v-card-text>
    </v-card>
  </div>
</template>

<script setup lang="ts">
import { reactive } from 'vue';
import type { RoomDetails } from 'netlify/core/types/data.types';

defineProps<{
  rooms: RoomDetails[];
  selectedRoomId: string | null;
  loading: boolean;
  creating: boolean;
  joining: boolean;
}>();

const emit = defineEmits<{
  (event: 'select', roomId: string): void;
  (event: 'create', payload: { name: string; password?: string | null }): void;
  (event: 'join', payload: { inviteCode: string; password?: string | null }): void;
}>();

const createForm = reactive({
  name: '',
  password: '',
});

const joinForm = reactive({
  inviteCode: '',
  password: '',
});

function formatActivity(timestamp?: string | null) {
  if (!timestamp) return 'No activity yet';
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(timestamp));
  } catch {
    return timestamp;
  }
}

function createRoom() {
  const payload = {
    name: createForm.name.trim(),
    password: createForm.password.trim() || null,
  };
  emit('create', payload);
  createForm.name = '';
  createForm.password = '';
}

function joinRoom() {
  const payload = {
    inviteCode: joinForm.inviteCode.trim().toUpperCase(),
    password: joinForm.password.trim() || null,
  };
  emit('join', payload);
}
</script>

<style scoped>
.rooms-sidebar {
  position: sticky;
  top: 20px;
}
</style>
