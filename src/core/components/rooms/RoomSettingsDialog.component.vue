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
          <v-tab value="rollAwards">Roll Awards</v-tab>
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
            <v-expansion-panels v-model="dicePanelsOpen" class="mb-6" variant="accordion">
              <v-expansion-panel value="custom" color="blue-grey-darken-4" bg-color="blue-grey-darken-3">
                <v-expansion-panel-title>Create a custom dice</v-expansion-panel-title>
                <v-expansion-panel-text>
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
                </v-expansion-panel-text>
              </v-expansion-panel>

              <v-expansion-panel value="categories" color="blue-grey-darken-4" bg-color="blue-grey-darken-3">
                <v-expansion-panel-title>Dice categories</v-expansion-panel-title>
                <v-expansion-panel-text>
                  <template v-if="!currentUser">
                    <v-alert type="info" variant="tonal" density="comfortable">
                      Sign in to manage categories for this room.
                    </v-alert>
                  </template>
                  <template v-else>
                    <p class="text-caption text-medium-emphasis mb-3">
                      Group similar dice together by creating categories you can reuse.
                    </p>
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
                  </template>
                </v-expansion-panel-text>
              </v-expansion-panel>
            </v-expansion-panels>

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

          <v-window-item value="rollAwards">
            <section class="mb-6">
              <div class="text-subtitle-2 mb-2">Roll Awards</div>
              <p class="text-caption text-medium-emphasis mb-3">
                Track iconic dice results and automatically highlight the players who roll them most often.
              </p>
              <v-alert
                v-if="!isRoomCreator"
                type="info"
                variant="tonal"
                density="comfortable"
                class="mb-3"
              >
                Only the room creator can enable and edit Roll Awards.
              </v-alert>
              <v-switch
                :model-value="rollAwardsEnabled"
                :disabled="!canManageRollAwards || rollAwardsManager.toggleLoading.value"
                inset
                density="comfortable"
                color="primary"
                class="mb-2"
                @update:model-value="handleRollAwardsToggle"
              >
                <template #label>
                  <span>Enable Roll Awards for this room</span>
                </template>
              </v-switch>
              <v-select
                v-if="rollAwardsEnabled"
                v-model="rollAwardsWindowSelection"
                :items="ROLL_AWARD_WINDOW_OPTIONS"
                item-title="title"
                item-value="value"
                label="Count results from"
                variant="outlined"
                density="comfortable"
                class="mb-3"
                :disabled="!canManageRollAwards || rollAwardsManager.toggleLoading.value"
              />
              <v-text-field
                v-if="rollAwardsEnabled && rollAwardsWindowSelection === 'custom'"
                v-model="customRollAwardsWindow"
                type="number"
                label="Number of rolls"
                variant="outlined"
                density="comfortable"
                :min="CUSTOM_ROLL_WINDOW_MIN"
                :max="CUSTOM_ROLL_WINDOW_MAX"
                class="mb-3"
                :disabled="!canManageRollAwards || rollAwardsManager.toggleLoading.value"
                :error-messages="customRollAwardsWindowError ? [customRollAwardsWindowError] : []"
              />
              <div
                v-if="rollAwardsEnabled"
                class="d-flex flex-wrap align-center gap-2 mb-4"
              >
                <v-btn
                  color="primary"
                  size="small"
                  :disabled="
                    !canManageRollAwards ||
                    rollAwardsWindowSaving ||
                    !rollAwardsWindowDirty ||
                    Boolean(customRollAwardsWindowError) ||
                    (rollAwardsWindowSelection === 'custom' && !customRollAwardsWindow.trim())
                  "
                  :loading="rollAwardsWindowSaving"
                  @click="saveRollAwardsWindowSetting"
                >
                  Save Changes
                </v-btn>
                <span class="text-caption text-medium-emphasis ml-4">
                  Changes apply after saving.
                </span>
              </div>
              <v-alert
                v-if="rollAwardsManager.toggleError.value"
                type="error"
                density="comfortable"
                variant="tonal"
                class="mb-4"
              >
                {{ rollAwardsManager.toggleError.value }}
              </v-alert>
            </section>

            <template v-if="rollAwardsEnabled">
              <v-progress-linear
                v-if="rollAwardsManager.awardsLoading.value"
                indeterminate
                color="primary"
                class="mb-4"
              />
              <v-alert
                v-else-if="rollAwardsManager.awardsError.value"
                type="error"
                variant="tonal"
                density="comfortable"
                class="mb-4"
              >
                {{ rollAwardsManager.awardsError.value }}
                <template #append>
                  <v-btn variant="text" size="small" @click="rollAwardsManager.ensureAwardsLoaded(true)">Retry</v-btn>
                </template>
              </v-alert>
              <template v-else>
                <v-expansion-panels v-model="rollAwardsPanelsOpen" variant="accordion">
                  <v-expansion-panel value="create" color="blue-grey-darken-4" bg-color="blue-grey-darken-3">
                    <v-expansion-panel-title>Create a Roll Award</v-expansion-panel-title>
                    <v-expansion-panel-text>
                      <div class="text-caption text-medium-emphasis mb-3">
                        Add the dice results that should count toward this award, then give it a descriptive name. Optionally filter it to a specific dice notation.
                      </div>
                      <div class="d-flex flex-column gap-3">
                        <v-alert
                          v-if="isEditingRollAward"
                          type="info"
                          density="comfortable"
                          variant="tonal"
                          class="mb-2"
                        >
                          Editing existing award. Changes will update "{{ newRollAwardName || 'this award' }}".
                        </v-alert>
                        <div class="roll-award-number-row mb-4">
                          <v-number-input
                            ref="addRollAwardNumberInput"
                            label="Dice result"
                            variant="outlined"
                            density="comfortable"
                            control-variant="stacked"
                            :model-value="newRollAwardNumber"
                            :min="ROLL_AWARD_RESULT_MIN"
                            :max="ROLL_AWARD_RESULT_MAX"
                            :step="1"
                            :hide-details="true"
                            :disabled="!canManageRollAwards || rollAwardsManager.awardMutationLoading.value"
                            class="roll-award-number-input"
                            @keyup="updateNewRollAwardNumber"
                            @keyup.enter.prevent="addRollAwardNumber"
                          />
                          <v-btn
                            color="primary"
                            icon="mdi-plus"
                            class="roll-award-number-btn"
                            :disabled="!canManageRollAwards || rollAwardsManager.awardMutationLoading.value"
                            :aria-label="'Add dice result'"
                            @click="addRollAwardNumber"
                          />
                        </div>
                        <div
                          v-if="newRollAwardNumbers.length > 0"
                          class="d-flex flex-wrap gap-2 mb-4"
                        >
                          <v-chip
                            v-for="value in newRollAwardNumbers"
                            :key="value"
                            closable
                            color="primary"
                            variant="tonal"
                            class="mb-2 mr-2"
                            @click:close="removeRollAwardNumber(value)"
                          >
                            {{ value }}
                          </v-chip>
                        </div>
                        <v-text-field
                          v-model="newRollAwardDiceNotation"
                          label="Dice notation filter (optional)"
                          variant="outlined"
                          density="comfortable"
                          placeholder="d100"
                          hint="Only count rolls rolled with this die size (e.g., d100). Leave blank to include all dice."
                          persistent-hint
                          :disabled="!canManageRollAwards || rollAwardsManager.awardMutationLoading.value"
                        />
                        <v-text-field
                          v-model="newRollAwardName"
                          label="Award name"
                          variant="outlined"
                          density="comfortable"
                          placeholder="e.g., Natural 20 Champion"
                          :disabled="!canManageRollAwards || rollAwardsManager.awardMutationLoading.value"
                        />
                        <div class="text-caption text-medium-emphasis mb-2">
                          Players who total the most tracked results automatically own this award.
                        </div>
                        <v-alert
                          v-if="newRollAwardError"
                          type="error"
                          density="comfortable"
                          variant="tonal"
                          class="mb-4"
                        >
                          {{ newRollAwardError }}
                        </v-alert>
                        <v-alert
                          v-else-if="rollAwardsManager.awardMutationError.value"
                          type="error"
                          density="comfortable"
                          variant="tonal"
                        >
                          {{ rollAwardsManager.awardMutationError.value }}
                        </v-alert>
                        <div class="d-flex flex-wrap gap-2">
                          <v-btn
                            color="primary"
                            :disabled="!canManageRollAwards || rollAwardsManager.awardMutationLoading.value"
                            :loading="rollAwardsManager.awardMutationLoading.value"
                            @click="handleSaveRollAward"
                          >
                            {{ isEditingRollAward ? 'Update award' : 'Save award' }}
                          </v-btn>
                          <v-btn
                            variant="text"
                            :disabled="rollAwardsManager.awardMutationLoading.value"
                            @click="clearRollAwardForm"
                          >
                            {{ isEditingRollAward ? 'Cancel edit' : 'Clear' }}
                          </v-btn>
                        </div>
                      </div>
                    </v-expansion-panel-text>
                  </v-expansion-panel>
                  <v-expansion-panel value="list" color="blue-grey-darken-4" bg-color="blue-grey-darken-3">
                    <v-expansion-panel-title>
                      <span>Existing awards</span>
                      <v-chip class="ml-2">{{ rollAwardsManager.awards.value.length }}</v-chip>
                    </v-expansion-panel-title>
                    <v-expansion-panel-text>
                      <template v-if="rollAwardsManager.awards.value.length > 0">
                        <v-list density="comfortable">
                          <v-list-item
                            v-for="award in rollAwardsManager.awards.value"
                            :key="award.id"
                            class="roll-awards-list-item"
                          >
                            <v-list-item-title class="d-flex justify-space-between">
                              <span class="d-flex align-center">{{ award.name }}</span>
                              <div class="d-flex align-center">
                                <v-btn
                                  icon="mdi-pencil"
                                  variant="text"
                                  color="primary"
                                  size="small"
                                  class="mr-1"
                                  :disabled="!canManageRollAwards || rollAwardsManager.awardMutationLoading.value"
                                  @click="startEditingRollAward(award)"
                                />
                                <v-btn
                                  icon="mdi-delete"
                                  variant="text"
                                  color="error"
                                  size="small"
                                  :disabled="!canManageRollAwards || rollAwardsManager.awardMutationLoading.value"
                                  @click="rollAwardsManager.deleteAward(award.id)"
                                />
                              </div>
                            </v-list-item-title>
                            <div class="d-flex flex-wrap gap-2 mb-2">
                              <v-chip
                                v-for="value in award.diceResults"
                                :key="`${award.id}-${value}`"
                                size="small"
                                variant="tonal"
                                color="secondary"
                                class="mr-2"
                              >
                                {{ value }}
                              </v-chip>
                            </div>
                            <div class="text-caption text-medium-emphasis mb-1">
                              <span v-if="award.diceNotation">Only counts rolls using {{ award.diceNotation }}</span>
                              <span v-else>Counts every dice notation</span>
                            </div>
                          </v-list-item>
                        </v-list>
                      </template>
                      <p v-else class="text-caption text-medium-emphasis">
                        No awards created yet. Use the form above to add your first Roll Award.
                      </p>
                    </v-expansion-panel-text>
                  </v-expansion-panel>
                </v-expansion-panels>
              </template>
            </template>
            <v-alert
              v-else
              type="info"
              variant="tonal"
              density="comfortable"
            >
              Roll Awards are currently disabled. Toggle the switch above to start configuring them.
            </v-alert>
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
import { computed, inject, onUnmounted, ref, watch, useTemplateRef } from 'vue';
import type { RoomDetails, RoomRollAward } from 'netlify/core/types/data.types';
import type { DiscordUser } from 'netlify/core/types/discord.types';
import { RoomsService } from 'core/services/rooms.service';
import { useRoomsStore } from 'core/stores/rooms.store';
import { RoomDiceManagerKey, type RoomDiceManager } from 'core/composables/useRoomDiceManager';
import { RoomRollAwardsManagerKey, type RoomRollAwardsManager } from 'core/composables/useRoomRollAwardsManager';

type SettingsTab = 'room' | 'dices' | 'rollAwards';

const props = defineProps<{
  room: RoomDetails | null;
  currentUser: DiscordUser | null;
  initialTab?: SettingsTab;
}>();

const open = defineModel<boolean>('open', { default: false });
const roomsStore = useRoomsStore();
const diceManager = inject<RoomDiceManager>(RoomDiceManagerKey);
const injectedRollAwardsManager = inject<RoomRollAwardsManager>(RoomRollAwardsManagerKey);

if (!diceManager) {
  throw new Error('RoomSettingsDialog must be used within a provider of RoomDiceManager.');
}

if (!injectedRollAwardsManager) {
  throw new Error('RoomSettingsDialog must be used within a provider of RoomRollAwardsManager.');
}

const rollAwardsManager = injectedRollAwardsManager;

const settingsTab = ref<SettingsTab>('room');
const dicePanelsOpen = ref<(string | number)[]>([]);
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
const rollAwardsPanelsOpen = ref<(string | number)[]>(['create']);
const newRollAwardNumber = ref<number>(1);
const newRollAwardNumbers = ref<number[]>([]);
const newRollAwardName = ref('');
const newRollAwardDiceNotation = ref('');
const newRollAwardError = ref<string | null>(null);
const editingRollAwardId = ref<string | null>(null);
const addRollAwardNumberInput = useTemplateRef('addRollAwardNumberInput');
const customRollAwardsWindow = ref('');
const customRollAwardsWindowError = ref<string | null>(null);
const rollAwardsWindowSelection = ref<'all' | '10' | '50' | '100' | 'custom'>('all');
const ROLL_AWARD_RESULT_MIN = 1;
const ROLL_AWARD_RESULT_MAX = 100;
const ROLL_AWARD_MAX_RESULTS = 20;
const ROLL_AWARD_NOTATION_REGEX = /^d([1-9]\d*)$/i;
const ROLL_AWARD_WINDOW_OPTIONS = [
  { title: 'All rolls', value: 'all' },
  { title: 'Last 10 rolls', value: '10' },
  { title: 'Last 50 rolls', value: '50' },
  { title: 'Last 100 rolls', value: '100' },
  { title: 'Custom', value: 'custom' },
];
const PRESET_ROLL_AWARD_WINDOW_VALUES = ['10', '50', '100'];
const CUSTOM_ROLL_WINDOW_MIN = 1;
const CUSTOM_ROLL_WINDOW_MAX = 5000;

const isRoomCreator = computed(() => {
  if (!props.room || !props.currentUser) return false;
  return props.room.createdBy === props.currentUser.id;
});

const rollAwardsEnabled = computed(() => rollAwardsManager.awardsEnabled.value);
const canManageRollAwards = computed(() => isRoomCreator.value);
const syncingRollWindow = ref(false);
const rollAwardsWindowSaving = ref(false);
const isEditingRollAward = computed(() => Boolean(editingRollAwardId.value));

watch(
  () => rollAwardsManager.rollAwardsWindowSize.value,
  (size) => {
    syncingRollWindow.value = true;
    if (!size) {
      rollAwardsWindowSelection.value = 'all';
      customRollAwardsWindow.value = '';
      customRollAwardsWindowError.value = null;
    } else {
      const asString = String(size);
      if (PRESET_ROLL_AWARD_WINDOW_VALUES.includes(asString)) {
        rollAwardsWindowSelection.value = asString as typeof rollAwardsWindowSelection.value;
        customRollAwardsWindow.value = '';
        customRollAwardsWindowError.value = null;
      } else {
        rollAwardsWindowSelection.value = 'custom';
        customRollAwardsWindow.value = asString;
      }
    }
    syncingRollWindow.value = false;
  },
  { immediate: true }
);

watch(rollAwardsWindowSelection, () => {
  if (syncingRollWindow.value) return;
  if (rollAwardsWindowSelection.value !== 'custom') {
    customRollAwardsWindowError.value = null;
  }
});

watch(customRollAwardsWindow, () => {
  if (syncingRollWindow.value) return;
  if (rollAwardsWindowSelection.value === 'custom') {
    customRollAwardsWindowError.value = null;
  }
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

function getSelectedRollAwardsWindow(showErrors = false): number | null | undefined {
  if (rollAwardsWindowSelection.value === 'all') {
    if (showErrors) customRollAwardsWindowError.value = null;
    return null;
  }
  if (rollAwardsWindowSelection.value === 'custom') {
    const trimmed = customRollAwardsWindow.value?.trim() ?? '';
    if (!trimmed) {
      if (showErrors) {
        customRollAwardsWindowError.value = 'Enter the number of rolls to consider.';
      }
      return undefined;
    }
    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed) || parsed < CUSTOM_ROLL_WINDOW_MIN || parsed > CUSTOM_ROLL_WINDOW_MAX) {
      if (showErrors) {
        customRollAwardsWindowError.value = `Enter a value between ${CUSTOM_ROLL_WINDOW_MIN} and ${CUSTOM_ROLL_WINDOW_MAX}.`;
      }
      return undefined;
    }
    if (showErrors) {
      customRollAwardsWindowError.value = null;
    }
    return Math.floor(parsed);
  }
  if (showErrors) {
    customRollAwardsWindowError.value = null;
  }
  return Number(rollAwardsWindowSelection.value);
}

const rollAwardsWindowDirty = computed(() => {
  const selected = getSelectedRollAwardsWindow(false);
  if (typeof selected === 'undefined') {
    return true;
  }
  const current = rollAwardsManager.rollAwardsWindowSize.value ?? null;
  return selected !== current;
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
    if (settingsTab.value === 'rollAwards') {
      await rollAwardsManager.ensureAwardsLoaded();
    }
  } else {
    clearSettingsFeedback();
  }
});

watch(
  () => props.initialTab,
  (tab) => {
    if (!open.value) return;
    settingsTab.value = tab ?? 'room';
    if (settingsTab.value === 'rollAwards') {
      void rollAwardsManager.ensureAwardsLoaded();
    }
  }
);

watch(settingsTab, (tab) => {
  if (tab === 'rollAwards') {
    void rollAwardsManager.ensureAwardsLoaded();
  }
});

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
  clearRollAwardForm();
  rollAwardsPanelsOpen.value = ['create'];
  customRollAwardsWindow.value = '';
  customRollAwardsWindowError.value = null;
  rollAwardsWindowSelection.value = 'all';
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

async function handleRollAwardsToggle(value: boolean | null) {
  const nextValue = Boolean(value);
  await rollAwardsManager.setAwardsEnabled(nextValue);
  if (!nextValue) {
    clearRollAwardForm();
  }
}

async function saveRollAwardsWindowSetting() {
  if (!rollAwardsEnabled.value) return;
  const nextValue = getSelectedRollAwardsWindow(true);
  if (typeof nextValue === 'undefined') {
    return;
  }
  rollAwardsWindowSaving.value = true;
  try {
    await rollAwardsManager.setAwardsWindow(nextValue);
  } finally {
    rollAwardsWindowSaving.value = false;
  }
}

function addRollAwardNumber() {
  newRollAwardError.value = null;
  const value = Number.parseInt(addRollAwardNumberInput.value?.value || '1');
  if (value === null || Number.isNaN(value)) {
    newRollAwardError.value = 'Enter a dice result to add.';
    return;
  }
  if (value < ROLL_AWARD_RESULT_MIN || value > ROLL_AWARD_RESULT_MAX) {
    newRollAwardError.value = `Dice results must be between ${ROLL_AWARD_RESULT_MIN} and ${ROLL_AWARD_RESULT_MAX}.`;
    return;
  }
  if (newRollAwardNumbers.value.includes(value)) {
    newRollAwardError.value = 'This result is already included.';
    return;
  }
  if (newRollAwardNumbers.value.length >= ROLL_AWARD_MAX_RESULTS) {
    newRollAwardError.value = `You can only track up to ${ROLL_AWARD_MAX_RESULTS} results per award.`;
    return;
  }
  newRollAwardNumbers.value = [...newRollAwardNumbers.value, value];
  newRollAwardNumber.value = 1;
}

function updateNewRollAwardNumber() {
  const value: number = Number.parseInt(addRollAwardNumberInput.value?.value || '1');
  newRollAwardNumber.value = value;
}

function removeRollAwardNumber(value: number) {
  newRollAwardNumbers.value = newRollAwardNumbers.value.filter((entry) => entry !== value);
}

function startEditingRollAward(award: RoomRollAward) {
  editingRollAwardId.value = award.id;
  newRollAwardName.value = award.name;
  newRollAwardDiceNotation.value = award.diceNotation ?? '';
  newRollAwardNumbers.value = [...award.diceResults];
  newRollAwardNumber.value = award.diceResults[award.diceResults.length - 1] ?? 1;
  newRollAwardError.value = null;
  rollAwardsManager.awardMutationError.value = null;
  rollAwardsPanelsOpen.value = ['create'];
}

function clearRollAwardForm() {
  newRollAwardNumber.value = 1;
  newRollAwardNumbers.value = [];
  newRollAwardName.value = '';
  newRollAwardDiceNotation.value = '';
  newRollAwardError.value = null;
  editingRollAwardId.value = null;
  rollAwardsManager.awardMutationError.value = null;
}

async function handleSaveRollAward() {
  newRollAwardError.value = null;
  if (!rollAwardsEnabled.value) {
    newRollAwardError.value = 'Enable Roll Awards before managing entries.';
    return;
  }
  const trimmedName = newRollAwardName.value.trim();
  if (!trimmedName) {
    newRollAwardError.value = 'Award name is required.';
    return;
  }
  if (newRollAwardNumbers.value.length === 0) {
    newRollAwardError.value = 'Add at least one dice result.';
    return;
  }
  const trimmedNotation = newRollAwardDiceNotation.value.trim();
  let normalizedNotation: string | null = null;
  if (trimmedNotation) {
    const match = trimmedNotation.match(ROLL_AWARD_NOTATION_REGEX);
    if (!match) {
      newRollAwardError.value = 'Dice notation must look like d20 or d100.';
      return;
    }
    normalizedNotation = `d${match[1]}`.toLowerCase();
  }
  if (editingRollAwardId.value) {
    const updated = await rollAwardsManager.updateAward(
      editingRollAwardId.value,
      trimmedName,
      newRollAwardNumbers.value,
      normalizedNotation
    );
    if (updated) {
      clearRollAwardForm();
      rollAwardsPanelsOpen.value = ['list'];
    }
  } else {
    const created = await rollAwardsManager.createAward(trimmedName, newRollAwardNumbers.value, normalizedNotation);
    if (created) {
      clearRollAwardForm();
      rollAwardsPanelsOpen.value = ['list'];
    }
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

.roll-awards-list-item {
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  margin-bottom: 12px;
  padding-bottom: 12px;
}

.roll-awards-list-item:last-of-type {
  border-bottom: none;
  margin-bottom: 0;
  padding-bottom: 0;
}

.roll-award-number-row {
  display: flex;
  align-items: flex-end;
  gap: 8px;
}

.roll-award-number-input {
  flex: 1;
}

.roll-award-number-btn {
  align-self: flex-end;
}
</style>
