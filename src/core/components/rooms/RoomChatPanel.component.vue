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
            <div ref="messageContainer" class="messages-container" @scroll.passive="handleScroll">
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
            <v-card flat class="dice-panel-card" color="transparent">
              <v-tabs
                v-model="diceSidebarTab"
                density="comfortable"
                color="primary"
                class="mb-2"
              >
                <v-tab value="dices">Dices</v-tab>
                <v-tab value="rollAwards">Roll Awards</v-tab>
              </v-tabs>

              <v-window v-model="diceSidebarTab">
                <v-window-item value="dices">
                  <RoomDicePanel :current-user="currentUser" @manage-dice="openDiceSettings" />
                </v-window-item>
                <v-window-item value="rollAwards">
                  <RoomRollAwardsPanel
                    :room="room"
                    :messages="messages"
                    :current-user="currentUser"
                    @manage-awards="openRollAwardsSettings"
                  />
                </v-window-item>
              </v-window>
            </v-card>
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
import { RoomRollAwardsManagerKey, useRoomRollAwardsManager } from 'core/composables/useRoomRollAwardsManager';
import { type DiceRoll } from 'core/utils/dice.utils';
import { ROOM_MESSAGES_PAGE_SIZE } from 'core/stores/rooms.store';
import RoomMembersMenu from './RoomMembersMenu.component.vue';
import RoomMessagesList from './RoomMessagesList.component.vue';
import RoomDicePanel from './RoomDicePanel.component.vue';
import RoomRollAwardsPanel from './RoomRollAwardsPanel.component.vue';
import RoomSettingsDialog from './RoomSettingsDialog.component.vue';

const RESIZE_STORAGE_KEY = 'rolz-room-chat-width';
const DEFAULT_CHAT_PERCENT = 65;
const MIN_CHAT_WIDTH = 320;
const MIN_DICE_WIDTH = 280;
const DESKTOP_BREAKPOINT = 960;
const nonPassiveTouchOptions: AddEventListenerOptions = { passive: false };
type SettingsTab = 'room' | 'dices' | 'rollAwards';
const TOP_SCROLL_THRESHOLD = 60;
const BOTTOM_SCROLL_THRESHOLD = 120;
type PrependAdjustment = { previousHeight: number; previousTop: number; startLength: number };

const props = defineProps<{
  room: RoomDetails | null;
  messages: RoomMessage[];
  sending: boolean;
  currentUser: DiscordUser | null;
  historyLoading: boolean;
  canLoadOlder: boolean;
}>();

const emit = defineEmits<{
  (event: 'send-message', message: string): void;
  (event: 'send-dice', roll: DiceRoll): void;
  (event: 'load-older'): void;
  (event: 'trim-history'): void;
}>();

const messageText = ref('');
const messageContainer = ref<HTMLElement | null>(null);
const messageInput = ref<{ focus: () => void } | null>(null);
const shouldStickToBottom = ref(true);
const pendingPrependScrollAdjustment = ref<PrependAdjustment | null>(null);
const chatLayout = ref<HTMLElement | null>(null);
const chatWidth = ref(loadInitialWidth());
const isResizing = ref(false);
const layoutBounds = ref<{ left: number; width: number } | null>(null);
const settingsDialog = ref(false);
const settingsPanelTab = ref<SettingsTab>('room');
const diceSidebarTab = ref<'dices' | 'rollAwards'>('dices');
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

const rollAwardsManager = useRoomRollAwardsManager(
  () => props.room,
  () => props.currentUser
);

provide(RoomRollAwardsManagerKey, rollAwardsManager);

let hasMounted = false;

watch(
  () => props.room?.id,
  () => {
    messageText.value = '';
    shouldStickToBottom.value = true;
    pendingPrependScrollAdjustment.value = null;
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
  (_length, previousLength) => nextTick(() => adjustScrollAfterMessagesChange(previousLength ?? 0))
);

watch(
  () => props.historyLoading,
  (loading, wasLoading) => {
    if (!loading && wasLoading && pendingPrependScrollAdjustment.value) {
      if (props.messages.length === pendingPrependScrollAdjustment.value.startLength) {
        pendingPrependScrollAdjustment.value = null;
      }
    }
  }
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
  shouldStickToBottom.value = true;
}

function adjustScrollAfterMessagesChange(previousLength: number) {
  if (!messageContainer.value) return;
  if (pendingPrependScrollAdjustment.value) {
    const { previousHeight, previousTop } = pendingPrependScrollAdjustment.value;
    const heightDelta = messageContainer.value.scrollHeight - previousHeight;
    messageContainer.value.scrollTop = previousTop + heightDelta;
    pendingPrependScrollAdjustment.value = null;
    return;
  }
  if (shouldStickToBottom.value || previousLength === 0) {
    scrollToBottom();
    if (shouldStickToBottom.value && props.messages.length > ROOM_MESSAGES_PAGE_SIZE) {
      emit('trim-history');
    }
  }
}

function requestOlderMessages() {
  if (!props.canLoadOlder || props.historyLoading) return;
  if (messageContainer.value) {
    pendingPrependScrollAdjustment.value = {
      previousHeight: messageContainer.value.scrollHeight,
      previousTop: messageContainer.value.scrollTop,
      startLength: props.messages.length,
    };
  }
  emit('load-older');
}

function handleScroll() {
  if (!messageContainer.value) return;
  const { scrollTop, scrollHeight, clientHeight } = messageContainer.value;
  const distanceFromBottom = scrollHeight - (scrollTop + clientHeight);
  shouldStickToBottom.value = distanceFromBottom < BOTTOM_SCROLL_THRESHOLD;

  if (scrollTop <= TOP_SCROLL_THRESHOLD) {
    requestOlderMessages();
  } else if (shouldStickToBottom.value && props.messages.length > ROOM_MESSAGES_PAGE_SIZE) {
    emit('trim-history');
  }
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

function openRollAwardsSettings() {
  openSettingsPanel('rollAwards');
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
  nextTick(scrollToBottom);
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

.dice-panel-card {
  width: 100%;
  background-color: transparent;
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
