<template>
  <v-card class="room-chat-panel">
    <template v-if="room">
      <v-card-title class="d-flex justify-space-between align-center flex-wrap gap-2">
        <div>
          <div class="text-h6">{{ room.name }}</div>
          <small class="text-medium-emphasis">
            Invite code: {{ room.inviteCode }}
          </small>
        </div>
        <div class="d-flex align-center gap-2">
          <v-chip variant="tonal" color="secondary">
            {{ room.memberCount ?? 0 }} members
          </v-chip>
          <v-btn
            icon="mdi-content-copy"
            variant="text"
            :disabled="!inviteLink"
            :title="'Copy invite link'"
            @click="copyInviteLink"
          />
        </div>
      </v-card-title>

      <v-divider />

      <v-card-text>
        <div class="chat-layout">
          <div class="chat-section">
            <div ref="messageContainer" class="messages-container">
              <div
                v-for="message in messages"
                :key="message.id"
                class="message-row"
                :class="{ 'is-self': message.userId === currentUser?.id }"
              >
                <v-avatar size="36" class="mr-3">
                  <template v-if="message.avatar">
                    <v-img :src="message.avatar" :alt="message.username" />
                  </template>
                  <template v-else>
                    <v-icon>mdi-account</v-icon>
                  </template>
                </v-avatar>
                <div class="message-content">
                  <div class="message-meta">
                    <span class="text-subtitle-2">{{ message.username || 'Unknown Adventurer' }}</span>
                    <small class="text-medium-emphasis">{{ formatTimestamp(message.createdAt) }}</small>
                  </div>
                  <div v-if="message.type === 'text'">
                    {{ message.content || '...' }}
                  </div>
                  <div v-else class="dice-message pa-3">
                    <div class="d-flex align-center gap-2 mb-1">
                      <v-icon color="amber">mdi-dice-multiple</v-icon>
                      <span class="font-weight-medium">
                        {{ message.username || 'Someone' }} rolled {{ message.diceNotation }}
                      </span>
                    </div>
                    <div class="text-body-2">
                      Result: <strong>{{ message.diceTotal }}</strong>
                    </div>
                    <div class="text-caption">
                      Rolls: {{ (message.diceRolls || []).join(', ') }}
                    </div>
                    <div v-if="message.content" class="text-caption mt-1">
                      {{ message.content }}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div class="chat-input mt-4">
              <v-text-field
                v-model="messageText"
                label="Send a message"
                variant="outlined"
                density="comfortable"
                @keyup.enter="sendMessage"
                :disabled="sending"
              >
                <template #append-inner>
                  <v-btn
                    icon="mdi-send"
                    variant="text"
                    :disabled="!messageText.trim()"
                    :loading="sending"
                    @click="sendMessage"
                  />
                </template>
              </v-text-field>
            </div>
          </div>

          <div class="dice-section">
            <h3 class="text-subtitle-1 mb-2">Quick dice roll</h3>
            <DiceRollerComponent @rolled="forwardDiceRoll" />
          </div>
        </div>
      </v-card-text>
    </template>
    <template v-else>
      <v-card-text class="text-center py-12">
        <v-icon size="48" color="primary" class="mb-4">mdi-dice-5</v-icon>
        <div class="text-h6 mb-2">Select or create a room</div>
        <p class="text-body-2 text-medium-emphasis">
          Pick a room from the list on the left or create a new one to start chatting and rolling dice.
        </p>
      </v-card-text>
    </template>
  </v-card>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import DiceRollerComponent from 'core/components/DiceRoller.component.vue';
import type { RoomDetails, RoomMessage } from 'netlify/core/types/data.types';
import type { DiscordUser } from 'netlify/core/types/discord.types';
import type { DiceRoll } from 'core/utils/dice.utils';

const props = defineProps<{
  room: RoomDetails | null;
  messages: RoomMessage[];
  sending: boolean;
  currentUser: DiscordUser | null;
}>();

const emit = defineEmits<{
  (event: 'send-message', message: string): void;
  (event: 'send-dice', roll: DiceRoll): void;
}>();

const messageText = ref('');
const messageContainer = ref<HTMLElement | null>(null);

const inviteLink = computed(() => {
  if (!props.room) return '';
  if (typeof window === 'undefined') return '';
  return `${window.location.origin}?invite=${props.room.inviteCode}`;
});

watch(
  () => props.room?.id,
  () => {
    messageText.value = '';
    scrollToBottom();
  }
);

watch(
  () => props.messages.length,
  () => nextTick(scrollToBottom)
);

function scrollToBottom() {
  if (!messageContainer.value) return;
  messageContainer.value.scrollTop = messageContainer.value.scrollHeight;
}

function sendMessage() {
  if (!messageText.value.trim()) return;
  emit('send-message', messageText.value);
  messageText.value = '';
}

function forwardDiceRoll(roll: DiceRoll) {
  emit('send-dice', roll);
}

async function copyInviteLink() {
  if (!inviteLink.value) return;
  try {
    await navigator.clipboard.writeText(inviteLink.value);
  } catch (error) {
    console.error('Unable to copy invite link', error);
  }
}

function formatTimestamp(value: string) {
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(new Date(value));
  } catch {
    return value;
  }
}
</script>

<style scoped>
.room-chat-panel {
  min-height: 600px;
}

.messages-container {
  max-height: 360px;
  overflow-y: auto;
  padding-right: 8px;
}

.chat-layout {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.chat-section {
  flex: 2;
}

.dice-section {
  flex: 1;
}

@media (min-width: 960px) {
  .chat-layout {
    flex-direction: row;
    align-items: flex-start;
  }

  .dice-section {
    max-width: 360px;
  }
}

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
