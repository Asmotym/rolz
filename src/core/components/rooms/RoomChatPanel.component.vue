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
          <v-menu
            v-model="membersMenu"
            :close-on-content-click="false"
            location="bottom"
            offset="8"
            max-width="420"
          >
            <template #activator="{ props: menuActivatorProps }">
              <v-chip
                v-bind="menuActivatorProps"
                variant="tonal"
                color="secondary"
                class="members-chip"
                :append-icon="membersMenu ? 'mdi-chevron-up' : 'mdi-chevron-down'"
                @click="handleMembersChipClick"
              >
                {{ room.memberCount ?? 0 }} members
              </v-chip>
            </template>

            <v-card class="members-popover pa-3" elevation="8">
              <div class="members-popover__header">
                <div>
                  <div class="text-subtitle-2">Room members</div>
                  <small class="text-medium-emphasis">
                    {{ members.length }} total
                    <span class="dot-separator" aria-hidden="true">•</span>
                    {{ onlineMembers.length }} online
                  </small>
                </div>
                <v-btn
                  icon="mdi-refresh"
                  variant="text"
                  size="small"
                  :disabled="membersLoading"
                  :loading="membersLoading"
                  @click="refreshMembers"
                />
              </div>

              <template v-if="membersError">
                <v-alert
                  type="error"
                  variant="tonal"
                  density="comfortable"
                  class="mb-3"
                >
                  {{ membersError }}
                </v-alert>
              </template>
              <template v-else>
                <v-progress-linear v-if="membersLoading" indeterminate color="secondary" class="mb-3" />

                <v-list v-else-if="members.length > 0" density="comfortable" class="members-popover__list">
                  <v-list-item
                    v-for="member in members"
                    :key="member.userId"
                    class="members-popover__item"
                  >
                    <template #prepend>
                      <v-avatar size="36" class="mr-3">
                        <template v-if="member.avatar">
                          <v-img :src="member.avatar" :alt="member.username || member.userId" />
                        </template>
                        <template v-else>
                          <v-icon>mdi-account</v-icon>
                        </template>
                      </v-avatar>
                    </template>
                    <v-list-item-title class="members-popover__name">
                      <span>{{ formatDisplayName(member.username, member.nickname) }}</span>
                      <span
                        v-if="member.isOnline"
                        class="member-online-pill"
                      >
                        <span class="member-online-pill__dot" aria-hidden="true" />
                        Connected
                      </span>
                    </v-list-item-title>
                    <v-list-item-subtitle class="text-caption">
                      <span>Joined {{ formatTimestamp(member.joinedAt) }}</span>
                      <span class="dot-separator" aria-hidden="true">•</span>
                      <span v-if="member.isOnline">Connected now</span>
                      <span v-else>Last seen {{ formatTimestamp(member.lastSeen) }}</span>
                    </v-list-item-subtitle>
                  </v-list-item>
                </v-list>

                <div v-else class="text-medium-emphasis text-caption">
                  No members yet. Invite a friend to get started.
                </div>
              </template>
            </v-card>
          </v-menu>
          <v-btn
            icon="mdi-cog"
            variant="text"
            :disabled="!room || !currentUser"
            :title="'Room settings'"
            @click="openSettingsPanel"
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
                        {{ formatDisplayName(message.username, message.nickname, 'Someone') }} rolled {{ message.diceNotation }} ({{ message.content }})
                      </span>
                      <span v-else class="font-weight-medium">
                        {{ formatDisplayName(message.username, message.nickname, 'Someone') }} rolled {{ message.diceNotation }}
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
            <h3 class="text-subtitle-1 mb-2">🎲 Dice Roll</h3>
            <template v-if="!currentUser">
              <v-alert type="info" variant="tonal" density="comfortable">
                Sign in to manage and roll this room's custom dice.
              </v-alert>
            </template>
            <template v-else>
              <v-progress-linear
                v-if="roomDicesLoading"
                indeterminate
                color="primary"
                class="mb-3"
              />
              <v-alert
                v-else-if="roomDicesError"
                type="error"
                variant="tonal"
                density="comfortable"
                class="mb-3"
              >
                {{ roomDicesError }}
                <template #append>
                  <v-btn variant="text" size="small" @click="ensureRoomDicesLoaded(true)">Retry</v-btn>
                </template>
              </v-alert>
              <v-alert v-else-if="customDices.length === 0" type="info" variant="tonal" density="comfortable">
                No room dice yet. Add one from Settings → Dices.
              </v-alert>
              <template v-else>
                <div class="custom-dice-chip-group">
                  <v-chip
                    v-for="dice in customDices"
                    :key="dice.id"
                    variant="tonal"
                    class="custom-dice-chip"
                    size="large"
                    @click="rollCustomDice(dice)"
                  >
                    <div class="custom-dice-chip__content">
                      <span class="custom-dice-chip__notation">{{ dice.notation }}</span>
                      <span v-if="dice.description" class="custom-dice-chip__description">{{ dice.description }}</span>
                    </div>
                  </v-chip>
                </div>
              </template>
            </template>
            <v-alert
              v-if="diceRollError"
              type="error"
              variant="tonal"
              density="comfortable"
              class="mt-3"
            >
              {{ diceRollError }}
            </v-alert>
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
  <v-dialog v-model="settingsDialog" max-width="520">
    <v-card>
      <v-card-title class="d-flex align-center justify-space-between">
        <span>Settings</span>
        <v-btn icon="mdi-close" variant="text" @click="closeSettingsPanel" />
      </v-card-title>
      <v-divider />
      <v-card-text>
        <v-alert
          v-if="settingsFeedback"
          :type="settingsFeedback.type"
          variant="tonal"
          density="comfortable"
          class="mb-4"
        >
          {{ settingsFeedback.message }}
        </v-alert>
        <v-tabs
          v-model="settingsTab"
          density="comfortable"
          align-tabs="start"
          class="mb-4"
        >
          <v-tab value="room">Room</v-tab>
          <v-tab value="dices">Dices</v-tab>
        </v-tabs>

        <v-window v-model="settingsTab">
          <v-window-item value="room">
            <section class="mb-6">
              <div class="text-subtitle-2 mb-2">Room details</div>
              <p class="text-caption text-medium-emphasis mb-3">
                {{ isRoomCreator ? 'You can rename this room for everyone.' : 'Only the creator can rename this room.' }}
              </p>
              <v-text-field
                v-model="roomNameInput"
                label="Room name"
                variant="outlined"
                density="comfortable"
                :counter="80"
                maxlength="80"
                :disabled="!isRoomCreator || settingsSaving"
                :error-messages="roomNameError ? [roomNameError] : []"
                hint="Max 80 characters"
                persistent-hint
              />
            </section>

            <v-divider class="my-4" />

            <section>
              <div class="text-subtitle-2 mb-2">My nickname</div>
              <p class="text-caption text-medium-emphasis mb-3">
                Set a display nickname for this room only. Leave blank to use your Discord username.
              </p>
              <v-alert
                v-if="memberSettingsError"
                type="error"
                variant="tonal"
                density="comfortable"
                class="mb-3"
              >
                {{ memberSettingsError }}
                <v-btn
                  variant="text"
                  size="small"
                  class="ml-2"
                  @click="ensureMemberSettingsLoaded(true)"
                >
                  Retry
                </v-btn>
              </v-alert>
              <v-progress-linear
                v-if="memberSettingsLoading"
                indeterminate
                color="primary"
                class="mb-3"
              />
              <v-text-field
                v-model="nicknameInput"
                label="Nickname"
                variant="outlined"
                density="comfortable"
                :counter="40"
                maxlength="40"
                :disabled="memberSettingsLoading || settingsSaving"
                :error-messages="nicknameError ? [nicknameError] : []"
                hint="Max 40 characters"
                persistent-hint
              />
              <div class="text-caption text-medium-emphasis mb-3">
                Preview: {{ nicknamePreview }}
              </div>
            </section>
          </v-window-item>

          <v-window-item value="dices">
            <section class="mb-6">
              <div class="text-subtitle-2 mb-2">Create a custom dice</div>
              <template v-if="!currentUser">
                <v-alert type="info" variant="tonal" density="comfortable">
                  Sign in to manage this room's dice.
                </v-alert>
              </template>
              <template v-else>
                <p class="text-caption text-medium-emphasis mb-3">
                  Provide a dice notation (e.g., 1d20+3) and optionally a description to remember what it is for.
                </p>
                <v-text-field
                  v-model="newDiceNotation"
                  label="Dice notation"
                  variant="outlined"
                  density="comfortable"
                  placeholder="e.g., 2d6+1"
                  :disabled="diceMutationLoading"
                  :error-messages="newDiceError ? [newDiceError] : []"
                />
                <v-text-field
                  v-model="newDiceDescription"
                  label="Description (optional)"
                  variant="outlined"
                  density="comfortable"
                  placeholder="e.g., Longsword attack"
                  :disabled="diceMutationLoading"
                  class="mt-3"
                />
                <v-alert
                  v-if="diceManagementError"
                  type="error"
                  variant="tonal"
                  density="comfortable"
                  class="mt-3"
                >
                  {{ diceManagementError }}
                </v-alert>
                <div class="d-flex flex-wrap gap-2 mt-3">
                    <v-btn
                      color="primary"
                      :disabled="diceMutationLoading"
                      :loading="diceMutationLoading"
                      @click="addCustomDice"
                    >
                    Add dice
                  </v-btn>
                  <v-btn variant="text" :disabled="diceMutationLoading" @click="clearNewDiceForm">
                    Clear
                  </v-btn>
                </div>
              </template>
            </section>

            <section>
              <div class="text-subtitle-2 mb-2">My dice</div>
              <template v-if="!currentUser">
                <p class="text-caption text-medium-emphasis">
                  Room dice are tied to your account access. Sign in to view them.
                </p>
              </template>
              <template v-else>
                <v-progress-linear
                  v-if="roomDicesLoading"
                  indeterminate
                  color="primary"
                  class="mb-3"
                />
                <v-alert
                  v-else-if="roomDicesError"
                  type="error"
                  variant="tonal"
                  density="comfortable"
                  class="mb-3"
                >
                  {{ roomDicesError }}
                  <template #append>
                    <v-btn variant="text" size="small" @click="ensureRoomDicesLoaded(true)">Retry</v-btn>
                  </template>
                </v-alert>
                <template v-else-if="customDices.length === 0">
                  <p class="text-caption text-medium-emphasis">
                    No custom dice yet. Use the form above to add one.
                  </p>
                </template>
                <template v-else>
                  <div class="custom-dice-list">
                    <v-card
                      v-for="dice in customDices"
                      :key="dice.id"
                      variant="tonal"
                      class="custom-dice-card mb-3"
                    >
                      <div v-if="editingDiceId !== dice.id" class="custom-dice-card__content">
                        <div>
                          <div class="text-subtitle-2">{{ dice.notation }}</div>
                          <div v-if="dice.description" class="text-body-2 text-medium-emphasis">
                            {{ dice.description }}
                          </div>
                        </div>
                        <div class="custom-dice-card__actions">
                          <v-btn
                            icon="mdi-pencil"
                            variant="text"
                            size="small"
                            :disabled="diceMutationLoading"
                            @click="startEditingDice(dice)"
                          />
                          <v-btn
                            icon="mdi-delete"
                            variant="text"
                            size="small"
                            color="error"
                            :disabled="diceMutationLoading"
                            @click="deleteCustomDice(dice.id)"
                          />
                        </div>
                      </div>
                      <div v-else>
                        <v-text-field
                          v-model="editDiceNotation"
                          label="Dice notation"
                          variant="outlined"
                          density="comfortable"
                          :disabled="diceMutationLoading"
                          :error-messages="editDiceError ? [editDiceError] : []"
                        />
                        <v-text-field
                          v-model="editDiceDescription"
                          label="Description (optional)"
                          variant="outlined"
                          density="comfortable"
                          class="mt-3"
                          :disabled="diceMutationLoading"
                        />
                        <div class="d-flex justify-end gap-2 mt-3">
                          <v-btn variant="text" :disabled="diceMutationLoading" @click="cancelEditingDice">Cancel</v-btn>
                          <v-btn
                            color="primary"
                            :disabled="diceMutationLoading"
                            :loading="diceMutationLoading"
                            @click="saveEditingDice"
                          >
                            Save
                          </v-btn>
                        </div>
                      </div>
                    </v-card>
                  </div>
                </template>
              </template>
            </section>
          </v-window-item>
        </v-window>
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="closeSettingsPanel">Close</v-btn>
        <v-btn
          color="primary"
          :disabled="settingsTab !== 'room' || settingsSaving || !hasPendingChanges"
          :loading="settingsSaving"
          @click="saveSettings"
        >
          Save
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import type { RoomDetails, RoomMemberDetails, RoomMessage, RoomDice } from 'netlify/core/types/data.types';
import type { DiscordUser } from 'netlify/core/types/discord.types';
import { parseDiceNotation, rollDiceNotation, type DiceRoll } from 'core/utils/dice.utils';
import { RoomsService } from 'core/services/rooms.service';
import { useRoomsStore } from 'core/stores/rooms.store';

const RESIZE_STORAGE_KEY = 'rolz-room-chat-width';
const DEFAULT_CHAT_PERCENT = 65;
const MIN_CHAT_WIDTH = 320;
const MIN_DICE_WIDTH = 280;
const DESKTOP_BREAKPOINT = 960;
const nonPassiveTouchOptions: AddEventListenerOptions = { passive: false };
const roomsStore = useRoomsStore();

type SettingsTab = 'room' | 'dices';
type CustomDice = RoomDice;

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
const membersMenu = ref(false);
const members = ref<RoomMemberDetails[]>([]);
const membersLoading = ref(false);
const membersError = ref<string | null>(null);
const membersLoadedRoomId = ref<string | null>(null);
const settingsDialog = ref(false);
const roomNameInput = ref('');
const roomNameError = ref<string | null>(null);
const currentNickname = ref<string | null>(null);
const nicknameInput = ref('');
const nicknameError = ref<string | null>(null);
const memberSettingsLoading = ref(false);
const memberSettingsError = ref<string | null>(null);
const memberSettingsLoadedRoomId = ref<string | null>(null);
const settingsSaving = ref(false);
const settingsFeedback = ref<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
const settingsTab = ref<SettingsTab>('room');
const customDices = ref<CustomDice[]>([]);
const newDiceNotation = ref('');
const newDiceDescription = ref('');
const newDiceError = ref<string | null>(null);
const editingDiceId = ref<string | null>(null);
const editDiceNotation = ref('');
const editDiceDescription = ref('');
const editDiceError = ref<string | null>(null);
const diceRollError = ref<string | null>(null);
const roomDicesLoading = ref(false);
const roomDicesError = ref<string | null>(null);
const roomDicesLoadedRoomId = ref<string | null>(null);
const diceMutationLoading = ref(false);
const diceManagementError = ref<string | null>(null);
let settingsFeedbackTimer: number | null = null;
let resizeRaf: number | null = null;
let pendingClientX: number | null = null;

const inviteLink = computed(() => {
  if (!props.room) return '';
  if (typeof window === 'undefined') return '';
  return `${window.location.origin}/rooms/${props.room.id}?invite=${props.room.inviteCode}`;
});

const onlineMembers = computed(() => members.value.filter((member) => member.isOnline));

const chatLayoutStyles = computed(() => ({
  '--chat-panel-width': `${chatWidth.value}%`,
  '--dice-panel-width': `${Math.max(0, 100 - chatWidth.value)}%`,
}));

const isRoomCreator = computed(() => {
  if (!props.room || !props.currentUser) return false;
  return props.room.createdBy === props.currentUser.id;
});

const normalizedRoomName = computed(() => roomNameInput.value.trim());
const currentRoomName = computed(() => props.room?.name?.trim() ?? '');
const roomNameDirty = computed(() => normalizedRoomName.value !== currentRoomName.value);

const normalizedNicknameInput = computed(() => nicknameInput.value.trim());
const currentNicknameNormalized = computed(() => currentNickname.value?.trim() ?? '');
const nicknameDirty = computed(() => normalizedNicknameInput.value !== currentNicknameNormalized.value);
const hasPendingChanges = computed(() => roomNameDirty.value || nicknameDirty.value);

const nicknamePreview = computed(() => {
  const baseName = props.currentUser?.username ?? 'Unknown Adventurer';
  return normalizedNicknameInput.value ? `${normalizedNicknameInput.value} (${baseName})` : baseName;
});

watch(
  () => props.room?.id,
  () => {
    messageText.value = '';
    scrollToBottom();
    resetMembersState();
    resetSettingsState();
  },
  { immediate: true }
);

watch(
  () => props.messages.length,
  () => nextTick(scrollToBottom)
);

watch(membersMenu, async (open) => {
  if (open) {
    await ensureMembersLoaded();
  }
});

watch(settingsDialog, async (open) => {
  if (open) {
    settingsTab.value = 'room';
    await initializeSettingsPanel();
  } else {
    clearSettingsFeedback();
  }
});

watch(
  () => ({ roomId: props.room?.id, userId: props.currentUser?.id }),
  async ({ roomId, userId }) => {
    resetCustomDiceState();
    if (roomId && userId) {
      await ensureRoomDicesLoaded(true);
    }
  },
  { immediate: true }
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

async function copyInviteLink() {
  if (!inviteLink.value) return;
  try {
    await navigator.clipboard.writeText(inviteLink.value);
  } catch (error) {
    console.error('Unable to copy invite link', error);
  }
}

async function ensureRoomDicesLoaded(force = false) {
  if (!props.room || !props.currentUser) return;
  if (!force && roomDicesLoadedRoomId.value === props.room.id) return;
  roomDicesLoading.value = true;
  roomDicesError.value = null;
  try {
    const dices = await RoomsService.fetchRoomDices(props.room.id, props.currentUser.id);
    customDices.value = dices;
    roomDicesLoadedRoomId.value = props.room.id;
  } catch (error) {
    roomDicesError.value = error instanceof Error ? error.message : 'Unable to load room dice';
  } finally {
    roomDicesLoading.value = false;
  }
}

function resetCustomDiceState() {
  customDices.value = [];
  newDiceNotation.value = '';
  newDiceDescription.value = '';
  newDiceError.value = null;
  diceRollError.value = null;
  roomDicesLoadedRoomId.value = null;
  roomDicesError.value = null;
  roomDicesLoading.value = false;
  diceMutationLoading.value = false;
  diceManagementError.value = null;
  cancelEditingDice();
}

function clearNewDiceForm() {
  newDiceNotation.value = '';
  newDiceDescription.value = '';
  newDiceError.value = null;
  diceManagementError.value = null;
}

async function addCustomDice() {
  if (!props.room || !props.currentUser) {
    newDiceError.value = 'You need to be in a room to add dice.';
    return;
  }
  const notation = newDiceNotation.value.trim().toLowerCase();
  const description = newDiceDescription.value.trim();
  if (!notation) {
    newDiceError.value = 'Dice notation is required.';
    return;
  }
  try {
    parseDiceNotation(notation);
  } catch {
    newDiceError.value = 'Enter a valid dice notation (e.g., 1d20+3).';
    return;
  }
  diceMutationLoading.value = true;
  diceManagementError.value = null;
  try {
    const created = await RoomsService.createRoomDice({
      roomId: props.room.id,
      userId: props.currentUser.id,
      notation,
      description: description || undefined,
    });
    customDices.value = [...customDices.value, created];
    roomDicesLoadedRoomId.value = props.room.id;
    clearNewDiceForm();
  } catch (error) {
    diceManagementError.value = error instanceof Error ? error.message : 'Unable to add dice.';
  } finally {
    diceMutationLoading.value = false;
  }
}

function startEditingDice(dice: CustomDice) {
  editingDiceId.value = dice.id;
  editDiceNotation.value = dice.notation;
  editDiceDescription.value = dice.description ?? '';
  editDiceError.value = null;
  diceManagementError.value = null;
}

function cancelEditingDice() {
  editingDiceId.value = null;
  editDiceNotation.value = '';
  editDiceDescription.value = '';
  editDiceError.value = null;
  diceManagementError.value = null;
}

async function saveEditingDice() {
  if (!editingDiceId.value || !props.room || !props.currentUser) return;
  const notation = editDiceNotation.value.trim().toLowerCase();
  const description = editDiceDescription.value.trim();
  if (!notation) {
    editDiceError.value = 'Dice notation is required.';
    return;
  }
  try {
    parseDiceNotation(notation);
  } catch {
    editDiceError.value = 'Enter a valid dice notation (e.g., 1d20+3).';
    return;
  }
  diceMutationLoading.value = true;
  diceManagementError.value = null;
  try {
    const updated = await RoomsService.updateRoomDice({
      roomId: props.room.id,
      userId: props.currentUser.id,
      diceId: editingDiceId.value,
      notation,
      description: description || undefined,
    });
    customDices.value = customDices.value.map((dice) => (dice.id === updated.id ? updated : dice));
    cancelEditingDice();
  } catch (error) {
    diceManagementError.value = error instanceof Error ? error.message : 'Unable to update dice.';
  } finally {
    diceMutationLoading.value = false;
  }
}

async function deleteCustomDice(id: string) {
  if (!props.room || !props.currentUser) return;
  if (typeof window !== 'undefined') {
    const confirmed = window.confirm('Delete this dice?');
    if (!confirmed) {
      return;
    }
  }
  diceMutationLoading.value = true;
  diceManagementError.value = null;
  try {
    await RoomsService.deleteRoomDice({
      roomId: props.room.id,
      userId: props.currentUser.id,
      diceId: id,
    });
    customDices.value = customDices.value.filter((dice) => dice.id !== id);
    if (editingDiceId.value === id) {
      cancelEditingDice();
    }
  } catch (error) {
    diceManagementError.value = error instanceof Error ? error.message : 'Unable to delete dice.';
  } finally {
    diceMutationLoading.value = false;
  }
}

function rollCustomDice(dice: CustomDice) {
  diceRollError.value = null;
  try {
    const roll = rollDiceNotation(dice.notation, {}, dice.description ?? undefined);
    emit('send-dice', roll);
  } catch (error) {
    diceRollError.value = error instanceof Error ? error.message : 'Unable to roll this dice.';
  }
}


function formatDisplayName(username?: string | null, nickname?: string | null, fallback = 'Unknown Adventurer') {
  const hasUsername = typeof username === 'string' && username.trim().length > 0;
  const base = hasUsername ? (username as string).trim() : fallback;
  const hasNickname = typeof nickname === 'string' && nickname.trim().length > 0;
  if (hasNickname) {
    const nick = (nickname as string).trim();
    return `${nick} (${base})`;
  }
  return base;
}

function openSettingsPanel() {
  if (!props.room || !props.currentUser) return;
  settingsDialog.value = true;
}

function closeSettingsPanel() {
  settingsDialog.value = false;
  settingsTab.value = 'room';
}

async function initializeSettingsPanel() {
  if (!props.room || !props.currentUser) return;
  roomNameInput.value = props.room.name ?? '';
  roomNameError.value = null;
  nicknameError.value = null;
  await ensureMemberSettingsLoaded();
}

async function ensureMemberSettingsLoaded(force = false) {
  if (!props.room || !props.currentUser) return;
  if (!force && memberSettingsLoadedRoomId.value === props.room.id) {
    nicknameInput.value = currentNickname.value ?? '';
    return;
  }
  memberSettingsLoading.value = true;
  memberSettingsError.value = null;
  try {
    const member = await RoomsService.fetchMember({
      roomId: props.room.id,
      userId: props.currentUser.id,
    });
    currentNickname.value = member.nickname ?? null;
    nicknameInput.value = member.nickname ?? '';
    memberSettingsLoadedRoomId.value = props.room.id;
  } catch (error) {
    memberSettingsError.value = error instanceof Error ? error.message : 'Unable to load your settings';
  } finally {
    memberSettingsLoading.value = false;
  }
}

function resetSettingsState() {
  roomNameInput.value = props.room?.name ?? '';
  roomNameError.value = null;
  nicknameError.value = null;
  currentNickname.value = null;
  nicknameInput.value = '';
  memberSettingsLoadedRoomId.value = null;
  memberSettingsError.value = null;
  memberSettingsLoading.value = false;
  settingsSaving.value = false;
  if (!props.room) {
    settingsDialog.value = false;
    clearSettingsFeedback();
  }
}

function clearSettingsFeedback() {
  settingsFeedback.value = null;
  if (settingsFeedbackTimer !== null && typeof window !== 'undefined') {
    window.clearTimeout(settingsFeedbackTimer);
    settingsFeedbackTimer = null;
  }
}

function showSettingsFeedback(type: 'success' | 'error' | 'info', message: string) {
  settingsFeedback.value = { type, message };
  if (typeof window === 'undefined') return;
  if (settingsFeedbackTimer !== null) {
    window.clearTimeout(settingsFeedbackTimer);
  }
  settingsFeedbackTimer = window.setTimeout(() => {
    settingsFeedback.value = null;
    settingsFeedbackTimer = null;
  }, 3500);
}

async function saveSettings() {
  if (!props.room || !props.currentUser) return;
  if (!hasPendingChanges.value) {
    showSettingsFeedback('info', 'No changes to save.');
    return;
  }

  settingsSaving.value = true;
  roomNameError.value = null;
  nicknameError.value = null;

  let anySuccess = false;
  let lastError: string | null = null;

  try {
    if (roomNameDirty.value) {
      if (!isRoomCreator.value) {
        roomNameError.value = 'Only the room creator can rename this room.';
        lastError = roomNameError.value;
      } else if (!normalizedRoomName.value) {
        roomNameError.value = 'Room name is required.';
        lastError = roomNameError.value;
      } else {
        try {
          await roomsStore.renameRoom({
            roomId: props.room.id,
            userId: props.currentUser.id,
            name: normalizedRoomName.value,
          });
          anySuccess = true;
        } catch (error) {
          roomNameError.value = error instanceof Error ? error.message : 'Unable to update room name.';
          lastError = roomNameError.value;
        }
      }
    }

    if (nicknameDirty.value) {
      try {
        const member = await roomsStore.updateNickname({
          roomId: props.room.id,
          userId: props.currentUser.id,
          nickname: normalizedNicknameInput.value || undefined,
        });
        currentNickname.value = member.nickname ?? null;
        nicknameInput.value = member.nickname ?? '';
        memberSettingsLoadedRoomId.value = props.room.id;
        anySuccess = true;
      } catch (error) {
        nicknameError.value = error instanceof Error ? error.message : 'Unable to update nickname.';
        lastError = nicknameError.value;
      }
    }

    if (anySuccess) {
      showSettingsFeedback('success', 'Settings saved.');
    } else if (lastError) {
      showSettingsFeedback('error', lastError);
    } else {
      showSettingsFeedback('info', 'No changes to save.');
    }
  } finally {
    settingsSaving.value = false;
  }
}
async function handleMembersChipClick() {
  if (!props.room) return;
  if (!membersMenu.value) {
    await ensureMembersLoaded();
  }
}

async function refreshMembers() {
  if (!props.room) return;
  await ensureMembersLoaded(true);
}

async function ensureMembersLoaded(force = false) {
  if (!props.room) return;
  if (!force && membersLoadedRoomId.value === props.room.id && members.value.length > 0) {
    return;
  }
  await fetchMembers(props.room.id);
}

async function fetchMembers(roomId: string) {
  membersLoading.value = true;
  membersError.value = null;
  try {
    const list = await RoomsService.fetchMembers(roomId);
    if (props.room?.id === roomId) {
      members.value = list;
      membersLoadedRoomId.value = roomId;
    }
  } catch (error) {
    if (props.room?.id === roomId) {
      membersError.value = error instanceof Error ? error.message : 'Unable to load members';
    }
  } finally {
    if (props.room?.id === roomId) {
      membersLoading.value = false;
    }
  }
}

function resetMembersState() {
  membersMenu.value = false;
  members.value = [];
  membersError.value = null;
  membersLoadedRoomId.value = null;
  membersLoading.value = false;
}

function formatTimestamp(value?: string | null) {
  if (!value) return 'Unknown date';
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
  clearSettingsFeedback();
});
</script>

<style scoped>
.room-chat-panel {
  min-height: 600px;
}

.members-chip {
  cursor: pointer;
}

.members-popover {
  min-width: 320px;
  max-width: 420px;
}

.members-popover__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.members-popover__list {
  max-height: 280px;
  overflow-y: auto;
}

.members-popover__item:not(:last-child) {
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.members-popover__name {
  display: flex;
  align-items: center;
  gap: 8px;
}

.member-online-pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 0.75rem;
  padding: 2px 8px;
  border-radius: 999px;
  background-color: rgba(76, 175, 80, 0.15);
  color: var(--v-theme-success, #4caf50);
  font-weight: 600;
}

.member-online-pill__dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background-color: currentColor;
  display: inline-block;
}

.dot-separator {
  margin: 0 6px;
  opacity: 0.6;
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

.custom-dice-chip-group {
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  gap: 8px;
}

.custom-dice-chip {
  cursor: pointer;
  text-transform: none;
  display: flex;
  text-align: left;
}

.custom-dice-chip__content {
  display: flex;
  flex-direction: row;
  align-items: center;
  line-height: 1.2;
  gap: 4px;
}

.custom-dice-chip__notation {
  font-weight: 600;
}

.custom-dice-chip__description {
  font-size: 0.78rem;
  opacity: 0.75;
  margin-top: 2px;
  white-space: normal;
  word-break: break-word;
}

.custom-dice-card {
  padding: 16px;
}

.custom-dice-card__content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.custom-dice-card__actions {
  display: flex;
  gap: 4px;
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
