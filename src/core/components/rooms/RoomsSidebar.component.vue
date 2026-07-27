<template>
  <div class="rooms-sidebar">
    <RoomsList
      class="mb-4"
      :rooms="rooms"
      :selected-room-id="selectedRoomId"
      :loading="loading"
      @select="emit('select', $event)"
    />

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
import RoomsList from './RoomsList.component.vue';

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

@media (max-width: 959px) {
  .rooms-sidebar {
    position: static;
  }
}
</style>
