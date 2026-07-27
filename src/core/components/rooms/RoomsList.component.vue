<template>
  <v-card>
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
          rounded="lg"
          @click="emit('select', room.id)"
        >
          <template #prepend>
            <v-avatar size="32" color="primary" variant="tonal">
              <v-icon :icon="room.isProtected ? 'mdi-lock' : 'mdi-dice-multiple'" />
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
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import type { RoomDetails } from 'netlify/core/types/data.types';

defineProps<{
  rooms: RoomDetails[];
  selectedRoomId: string | null;
  loading: boolean;
}>();

const emit = defineEmits<{
  (event: 'select', roomId: string): void;
}>();

const { t } = useI18n();

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
</script>
