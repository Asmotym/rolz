<template>
  <v-dialog v-model="open" max-width="520">
    <v-card>
      <v-card-title class="d-flex align-center justify-space-between">
        <span>Settings</span>
        <v-btn icon="mdi-close" variant="text" @click="open = false" />
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
                  Sign in to manage your dice for this room.
                </v-alert>
              </template>
              <template v-else>
                <p class="text-caption text-medium-emphasis mb-3">
                  Provide a dice notation (e.g., 1d20+3) and optionally a description to remember what it is for.
                </p>
                <v-text-field
                  v-model="diceManager.newDiceNotation.value"
                  label="Dice notation"
                  variant="outlined"
                  density="comfortable"
                  placeholder="e.g., 2d6+1"
                  :disabled="diceManager.diceMutationLoading.value"
                  :error-messages="diceManager.newDiceError.value ? [diceManager.newDiceError.value] : []"
                />
                <v-text-field
                  v-model="diceManager.newDiceDescription.value"
                  label="Description (optional)"
                  variant="outlined"
                  density="comfortable"
                  placeholder="e.g., Longsword attack"
                  :disabled="diceManager.diceMutationLoading.value"
                  class="mt-3"
                />
                <v-select
                  v-model="diceManager.newDiceCategoryId.value"
                  :items="diceManager.diceCategories.value"
                  item-title="name"
                  item-value="id"
                  label="Category"
                  variant="outlined"
                  density="comfortable"
                  class="mt-3"
                  :disabled="diceManager.diceMutationLoading.value || diceManager.roomDicesLoading.value"
                  :loading="diceManager.roomDicesLoading.value"
                  :hint="diceManager.roomDicesLoading.value ? 'Loading categories…' : 'Group similar dice together'"
                  persistent-hint
                />
                <div class="mt-4">
                  <div class="text-subtitle-2 mb-2">Need a new category?</div>
                  <v-text-field
                    v-model="diceManager.newCategoryName.value"
                    label="Category name"
                    variant="outlined"
                    density="comfortable"
                    placeholder="e.g., Attacks"
                    :disabled="diceManager.categoryMutationLoading.value"
                    :error-messages="diceManager.newCategoryError.value ? [diceManager.newCategoryError.value] : []"
                  />
                  <v-alert
                    v-if="diceManager.categoryManagementError.value"
                    type="error"
                    variant="tonal"
                    density="comfortable"
                    class="mt-2"
                  >
                    {{ diceManager.categoryManagementError.value }}
                  </v-alert>
                  <div class="d-flex flex-wrap gap-2 mt-3">
                    <v-btn
                      color="primary"
                      :disabled="diceManager.categoryMutationLoading.value"
                      :loading="diceManager.categoryMutationLoading.value"
                      @click="diceManager.addDiceCategory"
                    >
                      Create category
                    </v-btn>
                    <v-btn
                      variant="text"
                      :disabled="diceManager.categoryMutationLoading.value"
                      @click="diceManager.newCategoryName.value = ''"
                    >
                      Clear
                    </v-btn>
                  </div>
                </div>
                <v-alert
                  v-if="diceManager.diceManagementError.value"
                  type="error"
                  variant="tonal"
                  density="comfortable"
                  class="mt-3"
                >
                  {{ diceManager.diceManagementError.value }}
                </v-alert>
                <div class="d-flex flex-wrap gap-2 mt-3">
                  <v-btn
                    color="primary"
                    :disabled="diceManager.diceMutationLoading.value"
                    :loading="diceManager.diceMutationLoading.value"
                    @click="diceManager.addCustomDice"
                  >
                    Add dice
                  </v-btn>
                  <v-btn
                    variant="text"
                    :disabled="diceManager.diceMutationLoading.value"
                    @click="diceManager.clearNewDiceForm"
                  >
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
                  v-if="diceManager.roomDicesLoading.value"
                  indeterminate
                  color="primary"
                  class="mb-3"
                />
                <v-alert
                  v-else-if="diceManager.roomDicesError.value"
                  type="error"
                  variant="tonal"
                  density="comfortable"
                  class="mb-3"
                >
                  {{ diceManager.roomDicesError.value }}
                  <template #append>
                    <v-btn variant="text" size="small" @click="diceManager.ensureRoomDicesLoaded(true)">Retry</v-btn>
                  </template>
                </v-alert>
                <template v-else-if="diceManager.customDices.value.length === 0">
                  <p class="text-caption text-medium-emphasis">
                    You haven't saved any dice for this room yet. Use the form above to add one.
                  </p>
                </template>
                <template v-else>
                  <div class="custom-dice-list">
                    <v-card
                      v-for="dice in diceManager.customDices.value"
                      :key="dice.id"
                      variant="tonal"
                      class="custom-dice-card mb-3"
                    >
                      <div v-if="diceManager.editingDiceId.value !== dice.id" class="custom-dice-card__content">
                        <div>
                          <div class="text-subtitle-2">{{ dice.notation }}</div>
                          <div v-if="dice.description" class="text-body-2 text-medium-emphasis">
                            {{ dice.description }}
                          </div>
                          <div class="text-caption text-medium-emphasis mt-1">
                            Category: {{ dice.categoryName ?? 'General' }}
                          </div>
                        </div>
                        <div class="custom-dice-card__actions">
                          <v-btn
                            icon="mdi-pencil"
                            variant="text"
                            size="small"
                            :disabled="diceManager.diceMutationLoading.value"
                            @click="diceManager.startEditingDice(dice)"
                          />
                          <v-btn
                            icon="mdi-delete"
                            variant="text"
                            size="small"
                            color="error"
                            :disabled="diceManager.diceMutationLoading.value"
                            @click="diceManager.deleteCustomDice(dice.id)"
                          />
                        </div>
                      </div>
                      <div v-else>
                        <v-text-field
                          v-model="diceManager.editDiceNotation.value"
                          label="Dice notation"
                          variant="outlined"
                          density="comfortable"
                          :disabled="diceManager.diceMutationLoading.value"
                          :error-messages="diceManager.editDiceError.value ? [diceManager.editDiceError.value] : []"
                        />
                        <v-text-field
                          v-model="diceManager.editDiceDescription.value"
                          label="Description (optional)"
                          variant="outlined"
                          density="comfortable"
                          class="mt-3"
                          :disabled="diceManager.diceMutationLoading.value"
                        />
                        <v-select
                          v-model="diceManager.editDiceCategoryId.value"
                          :items="diceManager.diceCategories.value"
                          item-title="name"
                          item-value="id"
                          label="Category"
                          variant="outlined"
                          density="comfortable"
                          class="mt-3"
                          :disabled="diceManager.diceMutationLoading.value || diceManager.roomDicesLoading.value"
                        />
                        <div class="d-flex justify-end gap-2 mt-3">
                          <v-btn
                            variant="text"
                            :disabled="diceManager.diceMutationLoading.value"
                            @click="diceManager.cancelEditingDice"
                          >
                            Cancel
                          </v-btn>
                          <v-btn
                            color="primary"
                            :disabled="diceManager.diceMutationLoading.value"
                            :loading="diceManager.diceMutationLoading.value"
                            @click="diceManager.saveEditingDice"
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
        <v-btn variant="text" @click="open = false">Close</v-btn>
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
import { computed, inject, onUnmounted, ref, watch } from 'vue';
import type { RoomDetails } from 'netlify/core/types/data.types';
import type { DiscordUser } from 'netlify/core/types/discord.types';
import { RoomsService } from 'core/services/rooms.service';
import { useRoomsStore } from 'core/stores/rooms.store';
import { RoomDiceManagerKey, type RoomDiceManager } from 'core/composables/useRoomDiceManager';

type SettingsTab = 'room' | 'dices';

const props = defineProps<{
  room: RoomDetails | null;
  currentUser: DiscordUser | null;
  initialTab?: SettingsTab;
}>();

const open = defineModel<boolean>('open', { default: false });
const roomsStore = useRoomsStore();
const diceManager = inject<RoomDiceManager>(RoomDiceManagerKey);

if (!diceManager) {
  throw new Error('RoomSettingsDialog must be used within a provider of RoomDiceManager.');
}

const settingsTab = ref<SettingsTab>('room');
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
let settingsFeedbackTimer: number | null = null;

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
    resetSettingsState();
  }
);

watch(open, async (dialogOpen) => {
  if (dialogOpen) {
    settingsTab.value = props.initialTab ?? 'room';
    await initializeSettingsPanel();
  } else {
    clearSettingsFeedback();
  }
});

watch(
  () => props.initialTab,
  (tab) => {
    if (!open.value) return;
    settingsTab.value = tab ?? 'room';
  }
);

watch(
  () => props.room,
  (room) => {
    if (!room) {
      open.value = false;
    }
  }
);

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
    open.value = false;
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

onUnmounted(() => {
  clearSettingsFeedback();
});
</script>

<style scoped>
.custom-dice-list {
  margin-top: 12px;
  max-height: 320px;
  overflow-y: auto;
  padding-right: 6px;
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
</style>
