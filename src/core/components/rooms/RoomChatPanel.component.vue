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
        <div
          ref="chatLayout"
          class="chat-layout"
          :class="{ 'is-resizing': isResizing }"
          :style="chatLayoutStyles"
        >
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

          <div
            class="resize-handle"
            role="separator"
            aria-orientation="vertical"
            :aria-valuenow="Math.round(chatWidth)"
            aria-valuemin="30"
            aria-valuemax="80"
            @mousedown.prevent="startResize"
            @touchstart.prevent="startResize"
          >
            <span class="resize-grip" />
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
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import DiceRollerComponent from 'core/components/DiceRoller.component.vue';
import type { RoomDetails, RoomMessage } from 'netlify/core/types/data.types';
import type { DiscordUser } from 'netlify/core/types/discord.types';
import type { DiceRoll } from 'core/utils/dice.utils';

const RESIZE_STORAGE_KEY = 'rolz-room-chat-width';
const DEFAULT_CHAT_PERCENT = 65;
const MIN_CHAT_WIDTH = 320;
const MIN_DICE_WIDTH = 280;
const DESKTOP_BREAKPOINT = 960;
const nonPassiveTouchOptions: AddEventListenerOptions = { passive: false };

function loadInitialWidth() {
  if (typeof window === 'undefined') return DEFAULT_CHAT_PERCENT;
  const value = Number(window.localStorage.getItem(RESIZE_STORAGE_KEY));
  if (Number.isFinite(value) && value >= 30 && value <= 80) {
    return value;
  }
  return DEFAULT_CHAT_PERCENT;
}

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
const chatLayout = ref<HTMLElement | null>(null);
const chatWidth = ref(loadInitialWidth());
const isResizing = ref(false);
const layoutBounds = ref<{ left: number; width: number } | null>(null);
let resizeRaf: number | null = null;
let pendingClientX: number | null = null;

const inviteLink = computed(() => {
  if (!props.room) return '';
  if (typeof window === 'undefined') return '';
  return `${window.location.origin}/rooms/${props.room.id}?invite=${props.room.inviteCode}`;
});

const chatLayoutStyles = computed(() => ({
  '--chat-panel-width': `${chatWidth.value}%`,
  '--dice-panel-width': `${Math.max(0, 100 - chatWidth.value)}%`,
}));

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

function persistChatWidth(value: number) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(RESIZE_STORAGE_KEY, String(value));
}

function startResize(event: MouseEvent | TouchEvent) {
  if (!isDesktop() || !chatLayout.value) return;
  const bounds = chatLayout.value.getBoundingClientRect();
  if (bounds.width <= MIN_CHAT_WIDTH + MIN_DICE_WIDTH) return;
  isResizing.value = true;
  layoutBounds.value = { left: bounds.left, width: bounds.width };
  scheduleWidthUpdate(getClientX(event));
}

function handlePointerMove(event: MouseEvent | TouchEvent) {
  if (!isResizing.value) return;
  event.preventDefault();
  scheduleWidthUpdate(getClientX(event));
}

function stopResize() {
  if (!isResizing.value) return;
  isResizing.value = false;
  layoutBounds.value = null;
  pendingClientX = null;
  if (resizeRaf !== null) {
    cancelAnimationFrame(resizeRaf);
    resizeRaf = null;
  }
  persistChatWidth(chatWidth.value);
}

function getClientX(event: MouseEvent | TouchEvent) {
  if ('touches' in event) {
    const touch = event.touches[0];
    return touch ? touch.clientX : null;
  }
  return event.clientX;
}

function updateChatWidth(clientX: number | null) {
  if (clientX === null) return;
  const bounds = layoutBounds.value ?? chatLayout.value?.getBoundingClientRect();
  if (!bounds || bounds.width <= 0) return;

  const position = clientX - bounds.left;
  const maxChatWidth = bounds.width - MIN_DICE_WIDTH;
  const minChatWidth = Math.min(Math.max(MIN_CHAT_WIDTH, 0), maxChatWidth);
  const constrained = clamp(position, minChatWidth, maxChatWidth);
  const percent = (constrained / bounds.width) * 100;
  chatWidth.value = clamp(percent, 30, 80);
}

function scheduleWidthUpdate(clientX: number | null) {
  pendingClientX = clientX;
  if (resizeRaf !== null) return;
  resizeRaf = window.requestAnimationFrame(() => {
    resizeRaf = null;
    updateChatWidth(pendingClientX);
  });
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function isDesktop() {
  if (typeof window === 'undefined') return false;
  return window.innerWidth >= DESKTOP_BREAKPOINT;
}

function handleWindowResize() {
  if (!chatLayout.value) return;
  if (!isDesktop()) {
    stopResize();
    return;
  }
  layoutBounds.value = chatLayout.value.getBoundingClientRect();
  const bounds = layoutBounds.value;
  if (!bounds) return;
  const clientX = bounds.left + (chatWidth.value / 100) * bounds.width;
  updateChatWidth(clientX);
}

onMounted(() => {
  window.addEventListener('mousemove', handlePointerMove);
  window.addEventListener('mouseup', stopResize);
  window.addEventListener('touchmove', handlePointerMove, nonPassiveTouchOptions);
  window.addEventListener('touchend', stopResize);
  window.addEventListener('resize', handleWindowResize);
});

onUnmounted(() => {
  window.removeEventListener('mousemove', handlePointerMove);
  window.removeEventListener('mouseup', stopResize);
  window.removeEventListener('touchmove', handlePointerMove, nonPassiveTouchOptions);
  window.removeEventListener('touchend', stopResize);
  window.removeEventListener('resize', handleWindowResize);
});
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
  --chat-panel-width: 65%;
  --dice-panel-width: 35%;
  display: flex;
  flex-direction: column;
  gap: 24px;
  overflow: hidden;
}

.chat-layout.is-resizing {
  cursor: col-resize;
}

.chat-layout.is-resizing * {
  user-select: none;
}

.chat-section,
.dice-section {
  min-width: 0;
  width: 100%;
}

.dice-section :deep(.dice-roller),
.dice-section :deep(.v-card) {
  width: 100%;
  box-sizing: border-box;
}

.resize-handle {
  display: none;
  width: 12px;
  align-self: stretch;
  align-items: center;
  justify-content: center;
  cursor: col-resize;
  background-color: rgba(255, 255, 255, 0.2);
  border-radius: 4px;
}

.resize-grip {
  width: 4px;
  height: 48px;
  border-radius: 999px;
  background-color: rgba(255, 255, 255, 0.6);
  transition: background-color 0.2s ease;
}

.resize-handle:hover .resize-grip,
.chat-layout.is-resizing .resize-grip {
  background-color: rgba(255, 255, 255, 0.5);
}

@media (min-width: 960px) {
  .chat-layout {
    flex-direction: row;
    flex-wrap: nowrap;
    align-items: stretch;
    gap: 16px;
  }

  .chat-section {
    flex: 1 1 var(--chat-panel-width);
    min-width: 0;
  }

  .dice-section {
    flex: 0 1 var(--dice-panel-width);
    min-width: 240px;
  }

  .resize-handle {
    display: flex;
    flex: 0 0 12px;
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
