<template>
  <div class="rooms-sidebar">
    <v-card class="mb-4">
      <v-card-title class="d-flex justify-space-between align-center">
        <span class="text-subtitle-1">{{ t('rooms.sidebar.title') }}</span>
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
            {{ t('rooms.sidebar.empty') }}
          </div>
        </v-list>
      </v-card-text>
    </v-card>

    <v-card class="mb-4">
      <v-card-title class="text-subtitle-1">{{ t('rooms.sidebar.createTitle') }}</v-card-title>
      <v-card-text>
        <v-text-field
          v-model="createForm.name"
          :label="t('rooms.sidebar.roomName')"
          variant="outlined"
          density="comfortable"
          maxlength="80"
          class="mb-3"
        />
        <v-text-field
          v-model="createForm.password"
          type="password"
          :label="t('rooms.sidebar.passwordOptional')"
          variant="outlined"
          density="comfortable"
          :hint="t('rooms.sidebar.publicRoomHint')"
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
          {{ t('rooms.sidebar.create') }}
        </v-btn>
      </v-card-text>
    </v-card>

    <v-card>
      <v-card-title class="text-subtitle-1">{{ t('rooms.sidebar.joinTitle') }}</v-card-title>
      <v-card-text>
        <v-text-field
          v-model="joinForm.inviteCode"
          :label="t('rooms.sidebar.inviteCode')"
          variant="outlined"
          density="comfortable"
          class="mb-3"
        />
        <v-text-field
          v-model="joinForm.password"
          type="password"
          :label="t('rooms.sidebar.passwordIfNeeded')"
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
          {{ t('rooms.sidebar.join') }}
        </v-btn>
      </v-card-text>
    </v-card>
  </div>
</template>

<script setup lang="ts">
import { reactive } from 'vue';
import { useI18n } from 'vue-i18n';
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

const { t } = useI18n();

const createForm = reactive({
  name: '',
  password: '',
});

const joinForm = reactive({
  inviteCode: '',
  password: '',
});

function formatActivity(timestamp?: string | null) {
  if (!timestamp) return t('rooms.sidebar.noActivity');
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
