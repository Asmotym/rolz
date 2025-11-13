<template>
  <div
    v-for="message in messages"
    :key="message.id"
    class="message-row"
    :class="{ 'is-self': message.userId === currentUserId }"
  >
    <v-avatar size="36" class="mr-3">
      <template v-if="message.avatar">
        <v-img :src="message.avatar" :alt="formatDisplayName(message.username, message.nickname)" />
      </template>
      <template v-else>
        <v-icon>mdi-account</v-icon>
      </template>
    </v-avatar>
    <div class="message-content">
      <div class="message-meta">
        <span class="text-subtitle-2">{{ formatDisplayName(message.username, message.nickname) }}</span>
        <small class="text-medium-emphasis">{{ formatTimestamp(message.createdAt) }}</small>
      </div>
      <div v-if="message.type === 'text'">
        {{ message.content || '...' }}
      </div>
      <div v-else class="dice-message pa-3">
        <div class="d-flex align-center gap-2 mb-1">
          <v-icon color="amber" class="mr-2">mdi-dice-multiple</v-icon>
          <span v-if="message.content" class="font-weight-medium">
            {{ formatDisplayName(message.username, message.nickname, 'Someone') }} rolled
            {{ message.diceNotation }} ({{ message.content }})
          </span>
          <span v-else class="font-weight-medium">
            {{ formatDisplayName(message.username, message.nickname, 'Someone') }} rolled
            {{ message.diceNotation }}
          </span>
        </div>
        <div class="text-body-2">
          Result: <strong>{{ message.diceTotal }}</strong>
        </div>
        <div class="text-caption">
          Rolls: {{ (message.diceRolls || []).join(', ') }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { RoomMessage } from 'netlify/core/types/data.types';
import { formatDisplayName, formatTimestamp } from 'core/utils/room-formatting.utils';

defineProps<{
  messages: RoomMessage[];
  currentUserId: string | null;
}>();
</script>

<style scoped>
.message-row {
  display: flex;
  margin-bottom: 16px;
}

.message-row.is-self {
  flex-direction: row-reverse;
  text-align: right;
}

.message-row.is-self .mr-3 {
  margin-right: 0;
  margin-left: 12px;
}

.message-row.is-self .message-content {
  background-color: rgba(103, 80, 164, 0.1);
}

.message-content {
  background-color: rgba(255, 255, 255, 0.05);
  border-radius: 12px;
  padding: 12px;
  flex: 1;
}

.message-meta {
  display: flex;
  justify-content: space-between;
  margin-bottom: 4px;
}

.dice-message {
  background-color: rgba(255, 193, 7, 0.08);
  border-radius: 12px;
}
</style>
