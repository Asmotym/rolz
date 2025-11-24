<template>
  <v-card class="room-chat-panel">
    <template v-if="room">
      <v-card-title class="d-flex justify-space-between align-center flex-wrap gap-2">
        <div>
          <div class="text-h6">{{ room.name }}</div>
          <div class="text-medium-emphasis d-flex align-center gap-2">
            <small>Invite code: {{ displayedInviteCode }}</small>
            <v-btn
              variant="text"
              size="x-small"
              :icon="showInviteCode ? 'mdi-eye-off' : 'mdi-eye'"
              :disabled="!room?.inviteCode"
              :title="showInviteCode ? 'Hide invite code' : 'Show invite code'"
              :aria-label="showInviteCode ? 'Hide invite code' : 'Show invite code'"
              @click="toggleInviteVisibility"
            />
          </div>
        </div>
        <div class="d-flex align-center gap-2">
          <RoomMembersMenu :room="room" />
          <v-btn
            icon="mdi-cog"
            variant="text"
            :disabled="!room || !currentUser"
            :title="'Room settings'"
            @click="openSettingsPanel()"
          />
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

      <v-card-text style="height: 90%;">
        <div
          ref="chatLayout"
          class="chat-layout"
          :class="{ 'is-resizing': isResizing }"
          :style="chatLayoutStyles"
        >
          <div class="chat-section">
            <div ref="messageContainer" class="messages-container">
              <RoomMessagesList
                :messages="messages"
                :current-user-id="currentUser?.id ?? null"
              />
            </div>

            <div class="chat-input mt-4">
              <v-text-field
                ref="messageInput"
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
            <RoomDicePanel :current-user="currentUser" @manage-dice="openDiceSettings" />
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
  <RoomSettingsDialog
    v-model:open="settingsDialog"
    :room="room"
    :current-user="currentUser"
    :initial-tab="settingsPanelTab"
  />
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, provide, ref, watch } from 'vue';
import type { RoomDetails, RoomMessage } from 'netlify/core/types/data.types';
import type { DiscordUser } from 'netlify/core/types/discord.types';
import { RoomDiceManagerKey, useRoomDiceManager } from 'core/composables/useRoomDiceManager';
import { type DiceRoll } from 'core/utils/dice.utils';
import RoomMembersMenu from './RoomMembersMenu.component.vue';
import RoomMessagesList from './RoomMessagesList.component.vue';
import RoomDicePanel from './RoomDicePanel.component.vue';
import RoomSettingsDialog from './RoomSettingsDialog.component.vue';

const RESIZE_STORAGE_KEY = 'rolz-room-chat-width';
const DEFAULT_CHAT_PERCENT = 65;
const MIN_CHAT_WIDTH = 320;
const MIN_DICE_WIDTH = 280;
const DESKTOP_BREAKPOINT = 960;
const nonPassiveTouchOptions: AddEventListenerOptions = { passive: false };
type SettingsTab = 'room' | 'dices';

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
const messageInput = ref<{ focus: () => void } | null>(null);
const chatLayout = ref<HTMLElement | null>(null);
const chatWidth = ref(loadInitialWidth());
const isResizing = ref(false);
const layoutBounds = ref<{ left: number; width: number } | null>(null);
const settingsDialog = ref(false);
const settingsPanelTab = ref<SettingsTab>('room');
let resizeRaf: number | null = null;
let pendingClientX: number | null = null;

const inviteLink = computed(() => {
  if (!props.room || typeof window === 'undefined') return '';
  return `${window.location.origin}/rooms/${props.room.id}?invite=${props.room.inviteCode}`;
});

const showInviteCode = ref(false);
const maskedInviteCode = computed(() => {
  const code = props.room?.inviteCode ?? '';
  return code ? '*'.repeat(code.length) : '';
});
const displayedInviteCode = computed(() => {
  if (!props.room) return '';
  return showInviteCode.value ? props.room.inviteCode : maskedInviteCode.value;
});

const chatLayoutStyles = computed(() => ({
  '--chat-panel-width': `${chatWidth.value}%`,
  '--dice-panel-width': `${Math.max(0, 100 - chatWidth.value)}%`,
}));

const diceManager = useRoomDiceManager(
  () => props.room,
  () => props.currentUser,
  (roll) => {
    emit('send-dice', roll);
    focusMessageInput();
  }
);

provide(RoomDiceManagerKey, diceManager);

let hasMounted = false;

watch(
  () => props.room?.id,
  () => {
    messageText.value = '';
    scrollToBottom();
    if (!props.room) {
      settingsDialog.value = false;
    } else {
      focusMessageInput();
    }
    showInviteCode.value = false;
  },
  { immediate: true }
);

watch(
  () => props.messages.length,
  () => nextTick(scrollToBottom)
);

watch(
  () => props.sending,
  (isSending, wasSending) => {
    if (!isSending && wasSending) {
      focusMessageInput();
    }
  }
);

function loadInitialWidth() {
  if (typeof window === 'undefined') return DEFAULT_CHAT_PERCENT;
  const value = Number(window.localStorage.getItem(RESIZE_STORAGE_KEY));
  if (Number.isFinite(value) && value >= 30 && value <= 80) {
    return value;
  }
  return DEFAULT_CHAT_PERCENT;
}

function scrollToBottom() {
  if (!messageContainer.value) return;
  messageContainer.value.scrollTop = messageContainer.value.scrollHeight;
}

function sendMessage() {
  if (!messageText.value.trim()) return;
  emit('send-message', messageText.value);
  messageText.value = '';
  focusMessageInput();
}

async function copyInviteLink() {
  if (!inviteLink.value) return;
  try {
    await navigator.clipboard.writeText(inviteLink.value);
  } catch (error) {
    console.error('Unable to copy invite link', error);
  }
}

function toggleInviteVisibility() {
  if (!props.room?.inviteCode) return;
  showInviteCode.value = !showInviteCode.value;
}

function openSettingsPanel(tab: SettingsTab = 'room') {
  if (!props.room || !props.currentUser) return;
  settingsPanelTab.value = tab;
  settingsDialog.value = true;
}

function openDiceSettings() {
  openSettingsPanel('dices');
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

function focusMessageInput() {
  if (!props.room || !hasMounted) return;
  nextTick(() => {
    messageInput.value?.focus();
  });
}

onMounted(() => {
  hasMounted = true;
  window.addEventListener('mousemove', handlePointerMove);
  window.addEventListener('mouseup', stopResize);
  window.addEventListener('touchmove', handlePointerMove, nonPassiveTouchOptions);
  window.addEventListener('touchend', stopResize);
  window.addEventListener('resize', handleWindowResize);
  focusMessageInput();
});

onUnmounted(() => {
  hasMounted = false;
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
  height: 100%;
  display: flex;
  flex-direction: column;
}

.messages-container {
  /* max-height: 360px; */
  overflow-y: auto;
  padding-right: 8px;
  height: 100%;
}

.chat-layout {
  --chat-panel-width: 65%;
  --dice-panel-width: 35%;
  display: flex;
  flex-direction: column;
  gap: 24px;
  overflow: hidden;
  height: 100%;
}

.chat-layout.is-resizing {
  cursor: col-resize;
}

.chat-layout.is-resizing * {
  user-select: none;
}

.chat-section {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.chat-section,
.dice-section {
  min-width: 0;
  width: 100%;
}

.dice-section :deep(.dice-panel),
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

@media (max-width: 960px) {
  .chat-section {
    height: 80%;
  }
  .dice-section {
    overflow: auto;
  }
}
</style>
