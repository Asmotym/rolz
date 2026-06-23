<template>
  <v-dialog v-model="open" max-width="520">
    <v-card>
      <v-card-title class="d-flex align-center justify-space-between">
        <span>{{ t('roomSettings.title') }}</span>
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
          <v-tab value="room">{{ t('roomSettings.tabs.room') }}</v-tab>
          <v-tab value="dices">{{ t('roomSettings.tabs.dices') }}</v-tab>
          <v-tab value="rollAwards">{{ t('roomSettings.tabs.rollAwards') }}</v-tab>
          <v-tab value="criticals">{{ t('roomSettings.tabs.criticals') }}</v-tab>
        </v-tabs>

        <v-window v-model="settingsTab">
          <v-window-item value="room">
            <section class="mb-6">
              <div class="text-subtitle-2 mb-2">{{ t('roomSettings.roomDetails.title') }}</div>
              <p class="text-caption text-medium-emphasis mb-3">
                {{ isRoomCreator ? t('roomSettings.roomDetails.creatorHelp') : t('roomSettings.roomDetails.nonCreatorHelp') }}
              </p>
              <v-text-field
                v-model="roomNameInput"
                :label="t('rooms.sidebar.roomName')"
                variant="outlined"
                density="comfortable"
                :counter="80"
                maxlength="80"
                :disabled="!isRoomCreator || settingsSaving"
                :error-messages="roomNameError ? [roomNameError] : []"
                :hint="t('roomSettings.roomDetails.maxRoomName')"
                persistent-hint
              />
            </section>

            <v-divider class="my-4" />

            <section>
              <div class="text-subtitle-2 mb-2">{{ t('roomSettings.nickname.title') }}</div>
              <p class="text-caption text-medium-emphasis mb-3">
                {{ t('roomSettings.nickname.help') }}
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
                  {{ t('common.retry') }}
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
                :label="t('roomSettings.nickname.label')"
                variant="outlined"
                density="comfortable"
                :counter="40"
                maxlength="40"
                :disabled="memberSettingsLoading || settingsSaving"
                :error-messages="nicknameError ? [nicknameError] : []"
                :hint="t('roomSettings.nickname.maxNickname')"
                persistent-hint
              />
              <div class="text-caption text-medium-emphasis mb-3">
                {{ t('roomSettings.nickname.preview', { name: nicknamePreview }) }}
              </div>
            </section>
          </v-window-item>

          <v-window-item value="dices">
            <v-expansion-panels v-model="dicePanelsOpen" class="mb-6" variant="accordion">
              <v-expansion-panel value="custom" color="blue-grey-darken-4" bg-color="blue-grey-darken-3">
                <v-expansion-panel-title>{{ t('dice.settings.createTitle') }}</v-expansion-panel-title>
                <v-expansion-panel-text>
                  <template v-if="!currentUser">
                    <v-alert type="info" variant="tonal" density="comfortable">
                      {{ t('dice.settings.signInDice') }}
                    </v-alert>
                  </template>
                  <template v-else>
                    <p class="text-caption text-medium-emphasis mb-3">
                      {{ t('dice.settings.createHelp') }}
                    </p>
                    <v-text-field
                      v-model="diceManager.newDiceNotation.value"
                      :label="t('dice.fields.notation')"
                      variant="outlined"
                      density="comfortable"
                      :placeholder="t('dice.fields.notationPlaceholderAdvantage')"
                      :hint="t('dice.fields.notationHint')"
                      persistent-hint
                      :disabled="diceManager.diceMutationLoading.value"
                      :error-messages="diceManager.newDiceError.value ? [diceManager.newDiceError.value] : []"
                    />
                    <v-text-field
                      v-model="diceManager.newDiceDescription.value"
                      :label="t('dice.fields.descriptionOptional')"
                      variant="outlined"
                      density="comfortable"
                      :placeholder="t('dice.fields.customDescriptionPlaceholder')"
                      :disabled="diceManager.diceMutationLoading.value"
                      class="mt-3"
                    />
                    <v-select
                      v-model="diceManager.newDiceCategoryId.value"
                      :items="diceManager.diceCategories.value"
                      item-title="name"
                      item-value="id"
                      :label="t('dice.category.label')"
                      variant="outlined"
                      density="comfortable"
                      class="mt-3"
                      :disabled="diceManager.diceMutationLoading.value || diceManager.roomDicesLoading.value"
                      :loading="diceManager.roomDicesLoading.value"
                      :hint="diceManager.roomDicesLoading.value ? t('dice.category.loading') : t('dice.category.hint')"
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
                        {{ t('dice.actions.add') }}
                      </v-btn>
                      <v-btn
                        variant="text"
                        :disabled="diceManager.diceMutationLoading.value"
                        @click="diceManager.clearNewDiceForm"
                      >
                        {{ t('common.clear') }}
                      </v-btn>
                    </div>
                  </template>
                </v-expansion-panel-text>
              </v-expansion-panel>

              <v-expansion-panel value="categories" color="blue-grey-darken-4" bg-color="blue-grey-darken-3">
                <v-expansion-panel-title>{{ t('dice.category.title') }}</v-expansion-panel-title>
                <v-expansion-panel-text>
                  <template v-if="!currentUser">
                    <v-alert type="info" variant="tonal" density="comfortable">
                      {{ t('dice.category.signIn') }}
                    </v-alert>
                  </template>
                  <template v-else>
                    <p class="text-caption text-medium-emphasis mb-3">
                      {{ t('dice.category.description') }}
                    </p>
                    <v-text-field
                      v-model="diceManager.newCategoryName.value"
                      :label="t('dice.category.name')"
                      variant="outlined"
                      density="comfortable"
                      :placeholder="t('dice.category.placeholder')"
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
                        {{ t('dice.category.create') }}
                      </v-btn>
                      <v-btn
                        variant="text"
                        :disabled="diceManager.categoryMutationLoading.value"
                        @click="diceManager.newCategoryName.value = ''"
                      >
                        {{ t('common.clear') }}
                      </v-btn>
                    </div>
                  </template>
                </v-expansion-panel-text>
              </v-expansion-panel>
            </v-expansion-panels>

            <section>
              <div class="text-subtitle-2 mb-2">{{ t('dice.settings.myDice') }}</div>
              <template v-if="!currentUser">
                <p class="text-caption text-medium-emphasis">
                  {{ t('dice.settings.signInView') }}
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
                    <v-btn variant="text" size="small" @click="diceManager.ensureRoomDicesLoaded(true)">{{ t('common.retry') }}</v-btn>
                  </template>
                </v-alert>
                <template v-else-if="diceManager.customDices.value.length === 0">
                  <p class="text-caption text-medium-emphasis">
                    {{ t('dice.settings.empty') }}
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
                            {{ t('dice.category.display', { category: dice.categoryName ?? t('dice.category.general') }) }}
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
                          :label="t('dice.fields.notation')"
                          variant="outlined"
                          density="comfortable"
                          :placeholder="t('dice.fields.notationPlaceholderDisadvantage')"
                          :hint="t('dice.fields.notationHint')"
                          persistent-hint
                          :disabled="diceManager.diceMutationLoading.value"
                          :error-messages="diceManager.editDiceError.value ? [diceManager.editDiceError.value] : []"
                        />
                        <v-text-field
                          v-model="diceManager.editDiceDescription.value"
                          :label="t('dice.fields.descriptionOptional')"
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
                          :label="t('dice.category.label')"
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
                            {{ t('common.cancel') }}
                          </v-btn>
                          <v-btn
                            color="primary"
                            :disabled="diceManager.diceMutationLoading.value"
                            :loading="diceManager.diceMutationLoading.value"
                            @click="diceManager.saveEditingDice"
                          >
                            {{ t('common.save') }}
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
              <div class="text-subtitle-2 mb-2">{{ t('rollAwards.title') }}</div>
              <p class="text-caption text-medium-emphasis mb-3">
                {{ t('rollAwards.settings.description') }}
              </p>
              <v-alert
                v-if="!isRoomCreator"
                type="info"
                variant="tonal"
                density="comfortable"
                class="mb-3"
              >
                {{ t('rollAwards.settings.creatorOnly') }}
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
                  <span>{{ t('rollAwards.settings.enable') }}</span>
                </template>
              </v-switch>
              <v-select
                v-if="rollAwardsEnabled"
                v-model="rollAwardsWindowSelection"
                :items="ROLL_AWARD_WINDOW_OPTIONS"
                item-title="title"
                item-value="value"
                :label="t('rollAwards.settings.countFrom')"
                variant="outlined"
                density="comfortable"
                class="mb-3"
                :disabled="!canManageRollAwards || rollAwardsManager.toggleLoading.value"
              />
              <v-text-field
                v-if="rollAwardsEnabled && rollAwardsWindowSelection === 'custom'"
                v-model="customRollAwardsWindow"
                type="number"
                :label="t('rollAwards.settings.numberOfRolls')"
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
                  {{ t('common.saveChanges') }}
                </v-btn>
                <span class="text-caption text-medium-emphasis ml-4">
                  {{ t('rollAwards.settings.saveHint') }}
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
              <div class="d-flex flex-wrap gap-2 align-center mb-4">
                <v-btn
                  variant="tonal"
                  color="primary"
                  size="small"
                  prepend-icon="mdi-content-copy"
                  :disabled="
                    !canManageRollAwards ||
                    rollAwardsManager.awardsLoading.value ||
                    rollAwardsManager.awardMutationLoading.value ||
                    clipboardLoading
                  "
                  :loading="clipboardLoading && clipboardAction === 'copy'"
                  @click="copyRollAwardsToClipboard"
                  class="mr-2"
                >
                  {{ t('rollAwards.clipboard.copy') }}
                </v-btn>
                <v-btn
                  variant="tonal"
                  color="primary"
                  size="small"
                  prepend-icon="mdi-content-paste"
                  :disabled="
                    !canManageRollAwards ||
                    rollAwardsManager.awardsLoading.value ||
                    rollAwardsManager.awardMutationLoading.value ||
                    clipboardLoading
                  "
                  :loading="clipboardLoading && clipboardAction === 'paste'"
                  @click="handlePasteRollAwards"
                >
                  {{ t('rollAwards.clipboard.paste') }}
                </v-btn>
              </div>
              <v-alert
                v-if="rollAwardsClipboardFeedback"
                :type="rollAwardsClipboardFeedback.type"
                density="comfortable"
                variant="tonal"
                class="mb-4"
              >
                {{ rollAwardsClipboardFeedback.message }}
              </v-alert>
              <v-alert
                v-if="rollAwardsImportError"
                type="error"
                density="comfortable"
                variant="tonal"
                class="mb-4"
              >
                {{ rollAwardsImportError }}
              </v-alert>
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
                  <v-btn variant="text" size="small" @click="rollAwardsManager.ensureAwardsLoaded(true)">{{ t('common.retry') }}</v-btn>
                </template>
              </v-alert>
              <template v-else>
                <v-expansion-panels v-model="rollAwardsPanelsOpen" variant="accordion">
                  <v-expansion-panel value="create" color="blue-grey-darken-4" bg-color="blue-grey-darken-3">
                    <v-expansion-panel-title>{{ t('rollAwards.form.createTitle') }}</v-expansion-panel-title>
                    <v-expansion-panel-text>
                      <div class="text-caption text-medium-emphasis mb-3">
                        {{ t('rollAwards.form.help') }}
                      </div>
                      <div class="d-flex flex-column gap-3">
                        <v-alert
                          v-if="isEditingRollAward"
                          type="info"
                          density="comfortable"
                          variant="tonal"
                          class="mb-2"
                        >
                          {{ t('rollAwards.form.editing', { name: newRollAwardName || t('rollAwards.form.thisAward') }) }}
                        </v-alert>
                        <div class="roll-award-number-row mb-4">
                          <v-number-input
                            ref="addRollAwardNumberInput"
                            :label="t('rollAwards.form.diceResult')"
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
                            :aria-label="t('rollAwards.form.addDiceResult')"
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
                          :label="t('rollAwards.form.notationFilter')"
                          variant="outlined"
                          density="comfortable"
                          :placeholder="t('rollAwards.form.notationPlaceholder')"
                          :hint="t('rollAwards.form.notationHint')"
                          persistent-hint
                          :disabled="!canManageRollAwards || rollAwardsManager.awardMutationLoading.value"
                        />
                        <v-text-field
                          v-model="newRollAwardName"
                          :label="t('rollAwards.form.awardName')"
                          variant="outlined"
                          density="comfortable"
                          :placeholder="t('rollAwards.form.awardNamePlaceholder')"
                          :disabled="!canManageRollAwards || rollAwardsManager.awardMutationLoading.value"
                        />
                        <v-textarea
                          v-model="newRollAwardDescription"
                          :label="t('dice.fields.descriptionOptional')"
                          variant="outlined"
                          density="comfortable"
                          :placeholder="t('rollAwards.form.descriptionPlaceholder')"
                          :counter="ROLL_AWARD_DESCRIPTION_MAX_LENGTH"
                          :maxlength="ROLL_AWARD_DESCRIPTION_MAX_LENGTH"
                          auto-grow
                          :disabled="!canManageRollAwards || rollAwardsManager.awardMutationLoading.value"
                        />
                        <div class="text-caption text-medium-emphasis mb-2">
                          {{ t('rollAwards.form.ownerHelp') }}
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
                            {{ isEditingRollAward ? t('rollAwards.form.update') : t('rollAwards.form.save') }}
                          </v-btn>
                          <v-btn
                            variant="text"
                            :disabled="rollAwardsManager.awardMutationLoading.value"
                            @click="clearRollAwardForm"
                          >
                            {{ isEditingRollAward ? t('rollAwards.form.cancelEdit') : t('common.clear') }}
                          </v-btn>
                        </div>
                      </div>
                    </v-expansion-panel-text>
                  </v-expansion-panel>
                  <v-expansion-panel value="list" color="blue-grey-darken-4" bg-color="blue-grey-darken-3">
                    <v-expansion-panel-title>
                      <span>{{ t('rollAwards.form.existing') }}</span>
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
                            <div v-if="award.description" class="text-body-2 text-medium-emphasis mb-1">
                              {{ award.description }}
                            </div>
                            <div class="d-flex flex-wrap gap-2 mb-2">
                              <v-chip
                                v-for="value in award.diceResults"
                                :key="`${award.id}-${value}`"
                                size="small"
                                variant="tonal"
                                color="secondary"
                                class="mr-2 mt-2"
                              >
                                {{ value }}
                              </v-chip>
                            </div>
                            <div class="text-caption text-medium-emphasis mb-1">
                              <span v-if="getAwardNotations(award).length">{{ t('rollAwards.onlyCountsUsing', { notations: formatAwardNotations(award) }) }}</span>
                              <span v-else>{{ t('rollAwards.countsEveryNotation') }}</span>
                            </div>
                          </v-list-item>
                        </v-list>
                      </template>
                      <p v-else class="text-caption text-medium-emphasis">
                        {{ t('rollAwards.form.empty') }}
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
              {{ t('rollAwards.settings.disabled') }}
            </v-alert>
          </v-window-item>

          <v-window-item value="criticals">
            <section class="mb-6">
              <div class="text-subtitle-2 mb-2">{{ t('criticals.title') }}</div>
              <p class="text-caption text-medium-emphasis mb-3">
                {{ t('criticals.description') }}
              </p>
              <v-alert
                v-if="!canManageCriticals"
                type="info"
                variant="tonal"
                density="comfortable"
                class="mb-3"
              >
                {{ t('criticals.creatorOnly') }}
              </v-alert>
              <div class="critical-rule-form">
                <div class="critical-rule-form__row">
                  <v-text-field
                    v-model="newCriticalThreshold"
                    type="number"
                    :label="t('criticals.number')"
                    variant="outlined"
                    density="comfortable"
                    :placeholder="t('criticals.numberPlaceholder')"
                    :disabled="!canManageCriticals || criticalsSaving"
                  />
                        <v-select
                          v-model="newCriticalOperator"
                          :items="CRITICAL_OPERATOR_OPTIONS"
                          item-title="title"
                          item-value="value"
                          :label="t('criticals.comparison')"
                          variant="outlined"
                          density="comfortable"
                          :disabled="!canManageCriticals || criticalsSaving"
                        />
                      </div>
                <v-select
                  v-model="newCriticalColorMode"
                  :items="CRITICAL_COLOR_MODE_OPTIONS"
                  item-title="title"
                  item-value="value"
                  :label="t('criticals.colorSource')"
                  variant="outlined"
                  density="comfortable"
                  class="mb-3"
                  :disabled="!canManageCriticals || criticalsSaving"
                />

                <v-select
                  v-if="newCriticalColorMode === 'preset'"
                  v-model="newCriticalPresetColor"
                  :items="CRITICAL_PRESET_COLORS"
                  item-title="title"
                  item-value="value"
                  :label="t('criticals.presetColor')"
                  variant="outlined"
                  density="comfortable"
                  class="mb-3"
                  :disabled="!canManageCriticals || criticalsSaving"
                />

                <div v-else class="mb-3">
                  <div class="text-caption text-medium-emphasis mb-2">{{ t('criticals.customColor') }}</div>
                  <input
                    v-model="newCriticalCustomColor"
                    type="color"
                    class="critical-color-input"
                    :disabled="!canManageCriticals || criticalsSaving"
                  >
                </div>

                <div class="d-flex align-center flex-wrap gap-2 mb-4">
                  <span class="text-caption text-medium-emphasis">{{ t('criticals.preview') }}</span>
                  <v-chip
                    size="small"
                    variant="flat"
                    :style="getCriticalColorChipStyle(selectedCriticalColor)"
                  >
                    {{ selectedCriticalColor.toUpperCase() }}
                  </v-chip>
                </div>

                <v-alert
                  v-if="criticalsError"
                  type="error"
                  density="comfortable"
                  variant="tonal"
                  class="mb-4"
                >
                  {{ criticalsError }}
                </v-alert>

                <div class="d-flex flex-wrap gap-2">
                  <v-btn
                    color="primary"
                    :disabled="!canManageCriticals || criticalsSaving"
                    :loading="criticalsSaving"
                    @click="addCriticalRule"
                  >
                    {{ t('criticals.addRule') }}
                  </v-btn>
                  <v-btn
                    variant="text"
                    :disabled="criticalsSaving"
                    @click="resetCriticalForm"
                  >
                    {{ t('common.clear') }}
                  </v-btn>
                </div>
              </div>
            </section>

            <section>
              <div class="d-flex align-center justify-space-between mb-2">
                <div class="text-subtitle-2">{{ t('criticals.savedRules') }}</div>
                <v-chip size="small">{{ roomCriticals.length }}/{{ ROOM_CRITICALS_MAX_ITEMS }}</v-chip>
              </div>
              <template v-if="roomCriticals.length > 0">
                <v-list density="comfortable">
                  <v-list-item
                    v-for="(critical, index) in roomCriticals"
                    :key="`${critical.operator}-${critical.threshold}-${critical.color}-${index}`"
                    class="critical-rule-item"
                  >
                    <v-list-item-title class="d-flex justify-space-between align-center flex-wrap gap-2">
                      <span>{{ formatCriticalRule(critical) }}</span>
                      <div class="d-flex align-center gap-2">
                        <v-chip
                          size="small"
                          variant="flat"
                          :style="getCriticalColorChipStyle(critical.color)"
                        >
                          {{ critical.color.toUpperCase() }}
                        </v-chip>
                        <v-btn
                          icon="mdi-delete"
                          variant="text"
                          color="error"
                          size="small"
                          :disabled="!canManageCriticals || criticalsSaving"
                          @click="removeCriticalRule(index)"
                        />
                      </div>
                    </v-list-item-title>
                    <div class="text-caption text-medium-emphasis">
                      {{ t('criticals.ruleDescription', { operator: getCriticalOperatorText(critical.operator), threshold: critical.threshold }) }}
                    </div>
                  </v-list-item>
                </v-list>
              </template>
              <p v-else class="text-caption text-medium-emphasis">
                {{ t('criticals.empty') }}
              </p>
            </section>
          </v-window-item>
        </v-window>
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="open = false">{{ t('common.close') }}</v-btn>
        <v-btn
          color="primary"
          :disabled="settingsTab !== 'room' || settingsSaving || !hasPendingChanges"
          :loading="settingsSaving"
          @click="saveSettings"
        >
          {{ t('common.save') }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
  <v-dialog v-model="rollAwardsImportDialogOpen" max-width="560">
    <v-card>
      <v-card-title class="d-flex align-center justify-space-between">
        <span>{{ t('rollAwards.import.title') }}</span>
        <v-btn icon="mdi-close" variant="text" @click="closeRollAwardsImportDialog" />
      </v-card-title>
      <v-divider />
      <v-card-text>
        <p class="text-caption text-medium-emphasis mb-3">
          {{ t('rollAwards.import.description') }}
        </p>
        <template v-if="parsedRollAwardsForImport.length > 0">
          <v-list density="comfortable">
            <v-list-item
              v-for="(award, index) in parsedRollAwardsForImport"
              :key="`${award.name}-${index}`"
              class="roll-awards-list-item"
            >
              <v-list-item-title class="d-flex justify-space-between">
                <span>{{ award.name }}</span>
              </v-list-item-title>
              <div v-if="award.description" class="text-body-2 text-medium-emphasis mb-1">
                {{ award.description }}
              </div>
              <div class="d-flex flex-wrap gap-2 mb-2">
                <v-chip
                  v-for="value in award.diceResults"
                  :key="`${award.name}-${value}`"
                  size="small"
                  variant="tonal"
                  color="secondary"
                  class="mr-1"
                >
                  {{ value }}
                </v-chip>
              </div>
              <div class="text-caption text-medium-emphasis">
                <span v-if="award.diceNotations.length">{{ t('rollAwards.onlyCountsUsing', { notations: formatNotations(award.diceNotations) }) }}</span>
                <span v-else>{{ t('rollAwards.countsEveryNotation') }}</span>
              </div>
            </v-list-item>
          </v-list>
        </template>
        <v-alert v-else type="info" variant="tonal" density="comfortable">
          {{ t('rollAwards.import.noneFound') }}
        </v-alert>
      </v-card-text>
      <v-card-actions class="d-flex flex-wrap gap-2">
        <v-btn variant="text" @click="closeRollAwardsImportDialog">{{ t('common.cancel') }}</v-btn>
        <v-spacer />
        <v-btn
          color="primary"
          variant="tonal"
          :disabled="parsedRollAwardsForImport.length === 0 || rollAwardsImporting"
          :loading="rollAwardsImporting && importMode === 'clean'"
          @click="importParsedRollAwards(true)"
          :title="t('rollAwards.import.cleanTitle')"
        >
          {{ t('rollAwards.import.clean') }}
        </v-btn>
        <v-btn
          color="primary"
          :disabled="parsedRollAwardsForImport.length === 0 || rollAwardsImporting"
          :loading="rollAwardsImporting && importMode === 'append'"
          @click="importParsedRollAwards(false)"
          :title="t('rollAwards.import.importTitle')"
        >
          {{ t('rollAwards.import.import') }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { computed, inject, onUnmounted, ref, watch, useTemplateRef } from 'vue';
import { useI18n } from 'vue-i18n';
import type { RoomCriticalRule, RoomDetails, RoomRollAward } from 'netlify/core/types/data.types';
import type { DiscordUser } from 'netlify/core/types/discord.types';
import { RoomsService } from 'core/services/rooms.service';
import { useRoomsStore } from 'core/stores/rooms.store';
import { RoomDiceManagerKey, type RoomDiceManager } from 'core/composables/useRoomDiceManager';
import { RoomRollAwardsManagerKey, type RoomRollAwardsManager } from 'core/composables/useRoomRollAwardsManager';

type SettingsTab = 'room' | 'dices' | 'criticals' | 'rollAwards';

const props = defineProps<{
  room: RoomDetails | null;
  currentUser: DiscordUser | null;
  initialTab?: SettingsTab;
}>();

const open = defineModel<boolean>('open', { default: false });
const roomsStore = useRoomsStore();
const { t } = useI18n();
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
const roomCriticals = ref<RoomCriticalRule[]>([]);
const newCriticalThreshold = ref<number>(1);
const newCriticalOperator = ref<RoomCriticalRule['operator']>('moreThan');
const newCriticalColorMode = ref<'preset' | 'custom'>('preset');
const newCriticalPresetColor = ref('#d32f2f');
const newCriticalCustomColor = ref('#fdd835');
const criticalsSaving = ref(false);
const criticalsError = ref<string | null>(null);
const rollAwardsPanelsOpen = ref<(string | number)[]>(['create']);
const newRollAwardNumber = ref<number>(1);
const newRollAwardNumbers = ref<number[]>([]);
const newRollAwardName = ref('');
const newRollAwardDescription = ref('');
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
const ROLL_AWARD_DESCRIPTION_MAX_LENGTH = 255;
const ROLL_AWARD_NOTATION_REGEX = /^d([1-9]\d*)$/i;
const ROLL_AWARD_NOTATION_TOTAL_LIMIT = 64;
const ROLL_AWARD_MAX_DICE_NOTATIONS = 10;
const ROOM_CRITICALS_MAX_ITEMS = 20;
const CRITICAL_OPERATOR_OPTIONS = computed(() => [
  { title: t('criticals.operators.moreThan'), value: 'moreThan' },
  { title: t('criticals.operators.lessThan'), value: 'lessThan' },
] as const);
const CRITICAL_COLOR_MODE_OPTIONS = computed(() => [
  { title: t('criticals.colorModes.preset'), value: 'preset' },
  { title: t('criticals.colorModes.custom'), value: 'custom' },
] as const);
const CRITICAL_PRESET_COLORS = computed(() => [
  { title: t('criticals.colors.crimson'), value: '#d32f2f' },
  { title: t('criticals.colors.amber'), value: '#f9a825' },
  { title: t('criticals.colors.gold'), value: '#fdd835' },
  { title: t('criticals.colors.emerald'), value: '#2e7d32' },
  { title: t('criticals.colors.teal'), value: '#00897b' },
  { title: t('criticals.colors.sky'), value: '#1e88e5' },
  { title: t('criticals.colors.indigo'), value: '#3949ab' },
  { title: t('criticals.colors.rose'), value: '#c2185b' },
] as const);
const ROLL_AWARD_WINDOW_OPTIONS = computed(() => [
  { title: t('rollAwards.window.all'), value: 'all' },
  { title: t('rollAwards.window.last', { count: 10 }), value: '10' },
  { title: t('rollAwards.window.last', { count: 50 }), value: '50' },
  { title: t('rollAwards.window.last', { count: 100 }), value: '100' },
  { title: t('rollAwards.window.custom'), value: 'custom' },
]);
const PRESET_ROLL_AWARD_WINDOW_VALUES = ['10', '50', '100'];
const CUSTOM_ROLL_WINDOW_MIN = 1;
const CUSTOM_ROLL_WINDOW_MAX = 5000;

const isRoomCreator = computed(() => {
  if (!props.room || !props.currentUser) return false;
  return props.room.createdBy === props.currentUser.id;
});

type ImportableRollAward = {
  name: string;
  description: string | null;
  diceResults: number[];
  diceNotations: string[];
};

const rollAwardsEnabled = computed(() => rollAwardsManager.awardsEnabled.value);
const canManageRollAwards = computed(() => isRoomCreator.value);
const canManageCriticals = computed(() => isRoomCreator.value);
const selectedCriticalColor = computed(() => (
  newCriticalColorMode.value === 'custom'
    ? newCriticalCustomColor.value
    : newCriticalPresetColor.value
));
const syncingRollWindow = ref(false);
const rollAwardsWindowSaving = ref(false);
const isEditingRollAward = computed(() => Boolean(editingRollAwardId.value));
const clipboardLoading = ref(false);
const clipboardAction = ref<'copy' | 'paste' | null>(null);
const rollAwardsClipboardFeedback = ref<{ type: 'success' | 'error'; message: string } | null>(null);
const rollAwardsImportDialogOpen = ref(false);
const rollAwardsImportError = ref<string | null>(null);
const parsedRollAwardsForImport = ref<ImportableRollAward[]>([]);
const rollAwardsImporting = ref(false);
const importMode = ref<'append' | 'clean' | null>(null);

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
  const baseName = props.currentUser?.username ?? t('common.unknownAdventurer');
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
        customRollAwardsWindowError.value = t('rollAwards.errors.windowRequired');
      }
      return undefined;
    }
    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed) || parsed < CUSTOM_ROLL_WINDOW_MIN || parsed > CUSTOM_ROLL_WINDOW_MAX) {
      if (showErrors) {
        customRollAwardsWindowError.value = t('rollAwards.errors.windowRange', {
          min: CUSTOM_ROLL_WINDOW_MIN,
          max: CUSTOM_ROLL_WINDOW_MAX,
        });
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

watch(
  () => props.room?.criticals,
  (criticals) => {
    roomCriticals.value = cloneCriticalRules(criticals ?? []);
  },
  { immediate: true, deep: true }
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
    closeRollAwardsImportDialog();
    clearClipboardFeedback();
    rollAwardsImportError.value = null;
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
    memberSettingsError.value = error instanceof Error ? error.message : t('roomSettings.errors.loadMemberSettings');
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
  roomCriticals.value = cloneCriticalRules(props.room?.criticals ?? []);
  resetCriticalForm();
  criticalsSaving.value = false;
  criticalsError.value = null;
  clearRollAwardForm();
  rollAwardsPanelsOpen.value = ['create'];
  customRollAwardsWindow.value = '';
  customRollAwardsWindowError.value = null;
  rollAwardsWindowSelection.value = 'all';
  clearClipboardFeedback();
  rollAwardsImportError.value = null;
  closeRollAwardsImportDialog();
  clipboardLoading.value = false;
  clipboardAction.value = null;
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

function cloneCriticalRules(criticals: RoomCriticalRule[]): RoomCriticalRule[] {
  return criticals.map((critical) => ({ ...critical }));
}

function resetCriticalForm() {
  newCriticalThreshold.value = 1;
  newCriticalOperator.value = 'moreThan';
  newCriticalColorMode.value = 'preset';
  newCriticalPresetColor.value = CRITICAL_PRESET_COLORS.value[0]?.value ?? '#d32f2f';
  newCriticalCustomColor.value = '#fdd835';
  criticalsError.value = null;
}

function getCriticalOperatorText(operator: RoomCriticalRule['operator']) {
  if (operator === 'moreThan') {
    return t('criticals.operators.moreThan').toLowerCase();
  }
  return t('criticals.operators.lessThan').toLowerCase();
}

function formatCriticalRule(rule: RoomCriticalRule) {
  return `${getCriticalOperatorText(rule.operator)} ${rule.threshold}`;
}

function getCriticalColorChipStyle(color: string) {
  return {
    backgroundColor: color,
    color: getContrastTextColor(color),
  };
}

function getContrastTextColor(color: string) {
  const normalized = color.trim().toLowerCase();
  const hex = normalized.length === 4
    ? `${normalized[1]}${normalized[1]}${normalized[2]}${normalized[2]}${normalized[3]}${normalized[3]}`
    : normalized.slice(1);

  if (!/^[0-9a-f]{6}$/i.test(hex)) {
    return '#111111';
  }

  const red = Number.parseInt(hex.slice(0, 2), 16);
  const green = Number.parseInt(hex.slice(2, 4), 16);
  const blue = Number.parseInt(hex.slice(4, 6), 16);
  const brightness = (red * 299 + green * 587 + blue * 114) / 1000;
  return brightness >= 150 ? '#111111' : '#ffffff';
}

async function saveCriticalRules(nextRules: RoomCriticalRule[]) {
  if (!props.room || !props.currentUser) {
    criticalsError.value = t('criticals.errors.signIn');
    return false;
  }

  criticalsSaving.value = true;
  criticalsError.value = null;

  try {
    const updatedRoom = await roomsStore.updateRoomCriticals({
      roomId: props.room.id,
      userId: props.currentUser.id,
      criticals: nextRules,
    });
    roomCriticals.value = cloneCriticalRules(updatedRoom.criticals ?? []);
    showSettingsFeedback('success', t('criticals.feedback.saved'));
    return true;
  } catch (error) {
    criticalsError.value = error instanceof Error ? error.message : t('criticals.errors.save');
    roomCriticals.value = cloneCriticalRules(props.room.criticals ?? []);
    return false;
  } finally {
    criticalsSaving.value = false;
  }
}

async function addCriticalRule() {
  criticalsError.value = null;

  if (!canManageCriticals.value) {
    criticalsError.value = t('criticals.creatorOnly');
    return;
  }
  if (roomCriticals.value.length >= ROOM_CRITICALS_MAX_ITEMS) {
    criticalsError.value = t('criticals.errors.maxRules', { count: ROOM_CRITICALS_MAX_ITEMS });
    return;
  }

  const trimmedThreshold = String(newCriticalThreshold.value).trim();
  if (!trimmedThreshold) {
    criticalsError.value = t('criticals.errors.numberRequired');
    return;
  }

  const parsedThreshold = Number(trimmedThreshold);
  if (!Number.isFinite(parsedThreshold) || !Number.isInteger(parsedThreshold)) {
    criticalsError.value = t('criticals.errors.wholeNumber');
    return;
  }

  const duplicate = roomCriticals.value.some((critical) => (
    critical.operator === newCriticalOperator.value &&
    critical.threshold === parsedThreshold
  ));
  if (duplicate) {
    criticalsError.value = t('criticals.errors.duplicate');
    return;
  }

  const saved = await saveCriticalRules([
    ...roomCriticals.value,
    {
      threshold: parsedThreshold,
      operator: newCriticalOperator.value,
      color: selectedCriticalColor.value,
    },
  ]);

  if (saved) {
    resetCriticalForm();
  }
}

async function removeCriticalRule(index: number) {
  if (!canManageCriticals.value) {
    criticalsError.value = t('criticals.creatorOnly');
    return;
  }

  const nextRules = roomCriticals.value.filter((_, currentIndex) => currentIndex !== index);
  await saveCriticalRules(nextRules);
}

async function saveSettings() {
  if (!props.room || !props.currentUser) return;
  if (!hasPendingChanges.value) {
    showSettingsFeedback('info', t('roomSettings.feedback.noChanges'));
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
        roomNameError.value = t('roomSettings.roomDetails.nonCreatorHelp');
        lastError = roomNameError.value;
      } else if (!normalizedRoomName.value) {
        roomNameError.value = t('roomSettings.errors.roomNameRequired');
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
          roomNameError.value = error instanceof Error ? error.message : t('roomSettings.errors.updateRoomName');
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
        nicknameError.value = error instanceof Error ? error.message : t('roomSettings.errors.updateNickname');
        lastError = nicknameError.value;
      }
    }

    if (anySuccess) {
      showSettingsFeedback('success', t('roomSettings.feedback.saved'));
    } else if (lastError) {
      showSettingsFeedback('error', lastError);
    } else {
      showSettingsFeedback('info', t('roomSettings.feedback.noChanges'));
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
    closeRollAwardsImportDialog();
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
    newRollAwardError.value = t('rollAwards.errors.resultRequired');
    return;
  }
  if (value < ROLL_AWARD_RESULT_MIN || value > ROLL_AWARD_RESULT_MAX) {
    newRollAwardError.value = t('rollAwards.errors.resultRange', { min: ROLL_AWARD_RESULT_MIN, max: ROLL_AWARD_RESULT_MAX });
    return;
  }
  if (newRollAwardNumbers.value.includes(value)) {
    newRollAwardError.value = t('rollAwards.errors.duplicateResult');
    return;
  }
  if (newRollAwardNumbers.value.length >= ROLL_AWARD_MAX_RESULTS) {
    newRollAwardError.value = t('rollAwards.errors.maxResults', { count: ROLL_AWARD_MAX_RESULTS });
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

function getAwardNotations(award: RoomRollAward | null): string[] {
  if (!award) return [];
  if (Array.isArray(award.diceNotations) && award.diceNotations.length) {
    return award.diceNotations;
  }
  return award.diceNotation ? [award.diceNotation] : [];
}

function formatNotations(notations: string[]): string {
  return notations.join(', ');
}

function formatAwardNotations(award: RoomRollAward): string {
  return formatNotations(getAwardNotations(award));
}

function parseRollAwardNotations(input: string): { notations: string[]; error?: string } {
  const trimmed = input.trim();
  if (!trimmed) {
    return { notations: [] };
  }
  const parts = trimmed.split(/[\s,]+/).map((entry) => entry.trim()).filter(Boolean);
  if (!parts.length) {
    return { notations: [] };
  }
  const normalized: string[] = [];
  for (const value of parts) {
    const match = value.match(ROLL_AWARD_NOTATION_REGEX);
    if (!match) {
      return { notations: [], error: t('rollAwards.errors.notationFormat') };
    }
    const notation = `d${match[1]}`.toLowerCase();
    if (!normalized.includes(notation)) {
      normalized.push(notation);
    }
    if (normalized.length > ROLL_AWARD_MAX_DICE_NOTATIONS) {
      return { notations: [], error: t('rollAwards.errors.maxNotations', { count: ROLL_AWARD_MAX_DICE_NOTATIONS }) };
    }
  }
  const combinedLength = normalized.join(',').length;
  if (combinedLength > ROLL_AWARD_NOTATION_TOTAL_LIMIT) {
    return {
      notations: [],
      error: t('rollAwards.errors.notationLength', { count: ROLL_AWARD_NOTATION_TOTAL_LIMIT }),
    };
  }
  return { notations: normalized };
}

function buildExportableAward(award: RoomRollAward): ImportableRollAward {
  return {
    name: award.name,
    description: award.description ?? null,
    diceResults: [...award.diceResults],
    diceNotations: getAwardNotations(award),
  };
}

function clearClipboardFeedback() {
  rollAwardsClipboardFeedback.value = null;
}

async function copyRollAwardsToClipboard() {
  clearClipboardFeedback();
  if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) {
    rollAwardsClipboardFeedback.value = { type: 'error', message: t('rollAwards.clipboard.unavailable') };
    return;
  }
  const awardsToCopy = rollAwardsManager.awards.value.map(buildExportableAward);
  clipboardLoading.value = true;
  clipboardAction.value = 'copy';
  try {
    await navigator.clipboard.writeText(JSON.stringify(awardsToCopy, null, 2));
    rollAwardsClipboardFeedback.value = { type: 'success', message: t('rollAwards.clipboard.copySuccess') };
  } catch (error) {
    rollAwardsClipboardFeedback.value = {
      type: 'error',
      message: error instanceof Error ? error.message : t('rollAwards.clipboard.copyError'),
    };
  } finally {
    clipboardLoading.value = false;
    clipboardAction.value = null;
  }
}

function normalizeClipboardAward(entry: unknown): ImportableRollAward | null {
  if (!entry || typeof entry !== 'object') return null;
  const raw = entry as Record<string, unknown>;
  const name = typeof raw.name === 'string' ? raw.name.trim() : '';
  if (!name) return null;
  const description = typeof raw.description === 'string' ? raw.description.trim() : '';
  const results = Array.isArray(raw.diceResults)
    ? raw.diceResults
        .map((value) => Number.parseInt(String(value), 10))
        .filter(
          (value, index, list) =>
            Number.isFinite(value) &&
            value >= ROLL_AWARD_RESULT_MIN &&
            value <= ROLL_AWARD_RESULT_MAX &&
            list.indexOf(value) === index
        )
    : [];
  if (!results.length) return null;
  if (results.length > ROLL_AWARD_MAX_RESULTS) {
    results.length = ROLL_AWARD_MAX_RESULTS;
  }
  let notationSource: string[] = [];
  if (Array.isArray(raw.diceNotations)) {
    notationSource = raw.diceNotations.map((value) => (typeof value === 'string' ? value : '')).filter(Boolean);
  } else if (typeof raw.diceNotation === 'string') {
    notationSource = raw.diceNotation.split(/[\s,]+/);
  }
  const { notations, error } = parseRollAwardNotations(notationSource.join(','));
  if (error) return null;
  return {
    name,
    description: description || null,
    diceResults: results,
    diceNotations: notations,
  };
}

function parseAwardsClipboard(raw: string): ImportableRollAward[] {
  try {
    const parsed = JSON.parse(raw);
    const entries = (Array.isArray(parsed)
      ? parsed
      : parsed && typeof parsed === 'object' && Array.isArray((parsed as Record<string, unknown>).awards)
        ? (parsed as Record<string, unknown>).awards
        : []) as Array<any>;
    const normalized: ImportableRollAward[] = [];
    for (const entry of entries) {
      const award = normalizeClipboardAward(entry);
      if (award) {
        normalized.push(award);
      }
    }
    return normalized;
  } catch {
    return [];
  }
}

async function handlePasteRollAwards() {
  clearClipboardFeedback();
  rollAwardsImportError.value = null;
  if (typeof navigator === 'undefined' || !navigator.clipboard?.readText) {
    rollAwardsClipboardFeedback.value = { type: 'error', message: t('rollAwards.clipboard.unavailable') };
    return;
  }
  clipboardLoading.value = true;
  clipboardAction.value = 'paste';
  try {
    const clipboardText = await navigator.clipboard.readText();
    const parsed = parseAwardsClipboard(clipboardText);
    if (!parsed.length) {
      rollAwardsImportError.value = t('rollAwards.import.noValidClipboard');
      return;
    }
    parsedRollAwardsForImport.value = parsed;
    rollAwardsImportDialogOpen.value = true;
  } catch (error) {
    rollAwardsClipboardFeedback.value = {
      type: 'error',
      message: error instanceof Error ? error.message : t('rollAwards.clipboard.readError'),
    };
  } finally {
    clipboardLoading.value = false;
    clipboardAction.value = null;
  }
}

function closeRollAwardsImportDialog() {
  rollAwardsImportDialogOpen.value = false;
  rollAwardsImportError.value = null;
  parsedRollAwardsForImport.value = [];
  importMode.value = null;
}

async function importParsedRollAwards(cleanExisting: boolean) {
  if (!rollAwardsEnabled.value) {
    rollAwardsImportError.value = t('rollAwards.import.enableFirst');
    return;
  }
  if (!canManageRollAwards.value) {
    rollAwardsImportError.value = t('rollAwards.import.creatorOnly');
    return;
  }
  if (!parsedRollAwardsForImport.value.length) {
    rollAwardsImportError.value = t('rollAwards.import.noAwards');
    return;
  }
  rollAwardsImportError.value = null;
  rollAwardsImporting.value = true;
  importMode.value = cleanExisting ? 'clean' : 'append';
  try {
    if (cleanExisting && rollAwardsManager.awards.value.length) {
      for (const existing of [...rollAwardsManager.awards.value]) {
        const deleted = await rollAwardsManager.deleteAward(existing.id);
        if (!deleted) {
          throw new Error(rollAwardsManager.awardMutationError.value ?? t('rollAwards.import.removeExistingError'));
        }
      }
    }
    for (const award of parsedRollAwardsForImport.value) {
      const created = await rollAwardsManager.createAward(
        award.name,
        award.diceResults,
        award.diceNotations,
        award.description
      );
      if (!created) {
        throw new Error(rollAwardsManager.awardMutationError.value ?? t('rollAwards.import.createAwardError'));
      }
    }
    closeRollAwardsImportDialog();
    rollAwardsClipboardFeedback.value = {
      type: 'success',
      message: cleanExisting ? t('rollAwards.import.replaceSuccess') : t('rollAwards.import.importSuccess'),
    };
  } catch (error) {
    rollAwardsImportError.value = error instanceof Error ? error.message : t('rollAwards.import.importError');
  } finally {
    rollAwardsImporting.value = false;
    importMode.value = null;
  }
}

function startEditingRollAward(award: RoomRollAward) {
  editingRollAwardId.value = award.id;
  newRollAwardName.value = award.name;
  newRollAwardDescription.value = award.description ?? '';
  newRollAwardDiceNotation.value = formatAwardNotations(award);
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
  newRollAwardDescription.value = '';
  newRollAwardDiceNotation.value = '';
  newRollAwardError.value = null;
  editingRollAwardId.value = null;
  rollAwardsManager.awardMutationError.value = null;
  clearClipboardFeedback();
}

async function handleSaveRollAward() {
  newRollAwardError.value = null;
  if (!rollAwardsEnabled.value) {
    newRollAwardError.value = t('rollAwards.errors.enableBeforeManage');
    return;
  }
  const trimmedName = newRollAwardName.value.trim();
  if (!trimmedName) {
    newRollAwardError.value = t('rollAwards.errors.nameRequired');
    return;
  }
  const trimmedDescription = newRollAwardDescription.value.trim();
  if (trimmedDescription.length > ROLL_AWARD_DESCRIPTION_MAX_LENGTH) {
    newRollAwardError.value = t('rollAwards.errors.descriptionLength', { count: ROLL_AWARD_DESCRIPTION_MAX_LENGTH });
    return;
  }
  if (newRollAwardNumbers.value.length === 0) {
    newRollAwardError.value = t('rollAwards.errors.atLeastOneResult');
    return;
  }
  const notationResult = parseRollAwardNotations(newRollAwardDiceNotation.value);
  if (notationResult.error) {
    newRollAwardError.value = notationResult.error;
    return;
  }
  const normalizedNotations = notationResult.notations;
  if (editingRollAwardId.value) {
    const updated = await rollAwardsManager.updateAward(
      editingRollAwardId.value,
      trimmedName,
      newRollAwardNumbers.value,
      normalizedNotations,
      trimmedDescription || null
    );
    if (updated) {
      clearRollAwardForm();
      rollAwardsPanelsOpen.value = ['list'];
    }
  } else {
    const created = await rollAwardsManager.createAward(
      trimmedName,
      newRollAwardNumbers.value,
      normalizedNotations,
      trimmedDescription || null
    );
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

.critical-rule-form {
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  padding: 16px;
}

.critical-rule-form__row {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.critical-rule-item {
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  margin-bottom: 12px;
  padding-bottom: 12px;
}

.critical-rule-item:last-of-type {
  border-bottom: none;
  margin-bottom: 0;
  padding-bottom: 0;
}

.critical-color-input {
  appearance: none;
  background: transparent;
  border: none;
  cursor: pointer;
  height: 42px;
  padding: 0;
  width: 72px;
}

.critical-color-input:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

@media (max-width: 640px) {
  .critical-rule-form__row {
    grid-template-columns: 1fr;
  }
}
</style>
