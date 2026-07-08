<template>
  <v-window-item value="bonusPoints">
    <section class="mb-6">
      <div class="text-subtitle-2 mb-2">{{ context.t('bonusPoints.title') }}</div>
      <p class="text-caption text-medium-emphasis mb-3">
        {{ context.t('bonusPoints.description') }}
      </p>
      <v-alert
        v-if="!context.canManageBonusPoints.value"
        type="info"
        variant="tonal"
        density="comfortable"
        class="mb-3"
      >
        {{ context.t('bonusPoints.creatorOnly') }}
      </v-alert>

      <v-alert
        v-if="context.bonusPointsError.value"
        type="error"
        density="comfortable"
        variant="tonal"
        class="mb-4"
      >
        {{ context.bonusPointsError.value }}
      </v-alert>

      <v-progress-linear
        v-if="context.$roomsStore.bonusPointsLoading"
        indeterminate
        color="primary"
        class="mb-4"
      />

      <v-switch
          :model-value="context.bonusPointsEnabled.value"
          :disabled="!context.canManageBonusPoints.value || context.bonusPointsSaving.value"
          inset
          density="comfortable"
          color="primary"
          class="mb-2"
          @update:model-value="context.handleBonusPointsToggle"
        >
          <template #label>
            <span>{{ context.t('bonusPoints.enable') }}</span>
          </template>
        </v-switch>

        <div v-if="context.bonusPointsEnabled.value" class="bonus-points-form__row d-flex flex-column">
          <v-text-field
            v-model="context.bonusPointsMaxInput.value"
            type="number"
            min="1"
            :label="context.t('bonusPoints.maxPoints')"
            variant="outlined"
            density="comfortable"
            :disabled="!context.canManageBonusPoints.value || context.bonusPointsSaving.value"
          />
          <v-btn
            color="primary"
            :disabled="!context.canManageBonusPoints.value || context.bonusPointsSaving.value"
            :loading="context.bonusPointsSaving.value"
            @click="context.saveBonusPointSettings"
            class="bonus-points-form__save-button"
          >
            {{ context.t('common.save') }}
          </v-btn>
        </div>

      <v-expansion-panels v-if="context.bonusPointsEnabled.value" v-model="context.bonusPointsPanelsOpen.value" variant="accordion">
        <v-expansion-panel value="create" color="blue-grey-darken-4" bg-color="blue-grey-darken-3">
          <v-expansion-panel-title>
            {{ context.editingBonusRuleId.value ? context.t('bonusPoints.form.editTitle') : context.t('bonusPoints.form.createTitle') }}
          </v-expansion-panel-title>
          <v-expansion-panel-text>
            <v-text-field
              v-model="context.newBonusRuleName.value"
              :label="context.t('bonusPoints.form.name')"
              variant="outlined"
              density="comfortable"
              class="mb-3"
              :disabled="!context.canManageBonusPoints.value || context.bonusPointsSaving.value"
            />
            <div class="bonus-points-form__row">
              <v-text-field
                v-model="context.newBonusRuleDiceNotation.value"
                :label="context.t('bonusPoints.form.diceNotation')"
                placeholder="d100"
                variant="outlined"
                density="comfortable"
                :disabled="!context.canManageBonusPoints.value || context.bonusPointsSaving.value"
              />
              <v-select
                v-model="context.newBonusRuleOperator.value"
                :items="context.BONUS_POINT_OPERATOR_OPTIONS.value"
                item-title="title"
                item-value="value"
                :label="context.t('bonusPoints.form.comparison')"
                variant="outlined"
                density="comfortable"
                :disabled="!context.canManageBonusPoints.value || context.bonusPointsSaving.value"
              />
            </div>
            <div class="bonus-points-form__row">
              <v-text-field
                v-model="context.newBonusRuleThreshold.value"
                type="number"
                :label="context.newBonusRuleOperator.value === 'between' ? context.t('bonusPoints.form.minNumber') : context.t('bonusPoints.form.number')"
                variant="outlined"
                density="comfortable"
                :disabled="!context.canManageBonusPoints.value || context.bonusPointsSaving.value"
              />
              <v-text-field
                v-if="context.newBonusRuleOperator.value === 'between'"
                v-model="context.newBonusRuleThresholdMax.value"
                type="number"
                :label="context.t('bonusPoints.form.maxNumber')"
                variant="outlined"
                density="comfortable"
                :disabled="!context.canManageBonusPoints.value || context.bonusPointsSaving.value"
              />
            </div>
            <div class="bonus-points-form__row">
              <v-select
                v-model="context.newBonusRuleAdjustmentSign.value"
                :items="context.BONUS_POINT_SIGN_OPTIONS.value"
                item-title="title"
                item-value="value"
                :label="context.t('bonusPoints.form.adjustmentSign')"
                variant="outlined"
                density="comfortable"
                :disabled="!context.canManageBonusPoints.value || context.bonusPointsSaving.value"
              />
              <v-text-field
                v-model="context.newBonusRuleAdjustmentAmount.value"
                type="number"
                min="1"
                :label="context.t('bonusPoints.form.adjustmentAmount')"
                variant="outlined"
                density="comfortable"
                :disabled="!context.canManageBonusPoints.value || context.bonusPointsSaving.value"
              />
            </div>

            <div class="d-flex flex-wrap gap-2">
              <v-btn
                color="primary"
                :disabled="!context.canManageBonusPoints.value || context.bonusPointsSaving.value"
                :loading="context.bonusPointsSaving.value"
                @click="context.saveBonusPointRule"
              >
                {{ context.editingBonusRuleId.value ? context.t('bonusPoints.form.update') : context.t('bonusPoints.form.add') }}
              </v-btn>
              <v-btn
                variant="text"
                :disabled="context.bonusPointsSaving.value"
                @click="context.resetBonusPointRuleForm"
              >
                {{ context.t('common.clear') }}
              </v-btn>
            </div>
          </v-expansion-panel-text>
        </v-expansion-panel>

        <v-expansion-panel value="list" color="blue-grey-darken-4" bg-color="blue-grey-darken-3">
          <v-expansion-panel-title>
            <div class="d-flex align-center justify-space-between w-100 pr-4">
              <span>{{ context.t('bonusPoints.form.savedRules') }}</span>
              <v-chip size="small">{{ context.$roomsStore.bonusPointRules.length }}</v-chip>
            </div>
          </v-expansion-panel-title>
          <v-expansion-panel-text>
            <template v-if="context.$roomsStore.bonusPointRules.length > 0">
              <v-list density="comfortable">
                <v-list-item
                  v-for="rule in context.$roomsStore.bonusPointRules"
                  :key="rule.id"
                  class="bonus-rule-item"
                >
                  <v-list-item-title class="d-flex justify-space-between align-center flex-wrap gap-2">
                    <span>{{ context.formatBonusPointRule(rule) }}</span>
                    <div class="d-flex align-center gap-2">
                      <v-chip size="small" variant="tonal">{{ context.formatBonusPointAdjustment(rule) }}</v-chip>
                      <v-btn
                        icon="mdi-pencil"
                        variant="text"
                        size="small"
                        :disabled="!context.canManageBonusPoints.value || context.bonusPointsSaving.value"
                        @click="context.startEditingBonusPointRule(rule)"
                      />
                      <v-btn
                        icon="mdi-delete"
                        variant="text"
                        color="error"
                        size="small"
                        :disabled="!context.canManageBonusPoints.value || context.bonusPointsSaving.value"
                        @click="context.removeBonusPointRule(rule.id)"
                      />
                    </div>
                  </v-list-item-title>
                </v-list-item>
              </v-list>
            </template>
            <p v-else class="text-caption text-medium-emphasis">
              {{ context.t('bonusPoints.form.empty') }}
            </p>
          </v-expansion-panel-text>
        </v-expansion-panel>
      </v-expansion-panels>

      <v-alert
        v-else
        type="info"
        variant="tonal"
        density="comfortable"
        class="mb-4"
      >
        {{ context.t('bonusPoints.disabled') }}
      </v-alert>
    </section>
  </v-window-item>
</template>

<script setup lang="ts">
defineProps<{
  context: any;
}>();
</script>

<style scoped>
.bonus-points-form {
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  padding: 16px;
}

.bonus-points-form__row {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  margin-bottom: 12px;
}

.bonus-rule-item {
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  margin-bottom: 12px;
  padding-bottom: 12px;
}

.bonus-rule-item:last-of-type {
  border-bottom: none;
  margin-bottom: 0;
  padding-bottom: 0;
}

@media (max-width: 640px) {
  .bonus-points-form__row {
    grid-template-columns: 1fr;
  }
}
</style>
