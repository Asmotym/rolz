<template>
  <section class="blocks-extensions-panel pt-4">
    <div class="mb-4">
      <h3 class="text-h6 mb-1">{{ t('settings.blocks.title') }}</h3>
      <p class="text-body-2 text-medium-emphasis">
        {{ t('settings.blocks.description') }}
      </p>
    </div>

    <v-alert
      v-if="feedback"
      :type="feedback.type"
      variant="tonal"
      class="mb-4"
      closable
      @click:close="feedback = null"
    >
      {{ feedback.message }}
    </v-alert>

    <v-row>
      <v-col cols="12" md="4">
        <v-card variant="tonal" class="mb-4">
          <v-card-title class="d-flex align-center justify-space-between">
            <span>{{ t('settings.blocks.listTitle') }}</span>
            <v-btn size="small" icon="mdi-plus" variant="text" @click="handleCreateExtension" />
          </v-card-title>
          <v-divider />
          <v-card-text>
            <template v-if="extensions.length === 0">
              <p class="text-body-2 text-medium-emphasis mb-0">
                {{ t('settings.blocks.empty') }}
              </p>
            </template>
            <v-list v-else density="compact" nav>
              <v-list-item
                v-for="extension in extensions"
                :key="extension.id"
                :value="extension.id"
                :active="extension.id === selectedExtensionId"
                rounded="lg"
                @click="selectExtension(extension.id)"
              >
                <template #prepend>
                  <v-avatar size="28" color="primary" variant="tonal">
                    <span class="text-caption">{{ extension.name.slice(0, 2).toUpperCase() }}</span>
                  </v-avatar>
                </template>
                <v-list-item-title>{{ extension.name }}</v-list-item-title>
                <v-list-item-subtitle>
                  {{ t('settings.blocks.blocksCount', { count: extension.blocks.length }) }}
                </v-list-item-subtitle>
                <template #append>
                  <v-btn
                    icon="mdi-delete"
                    variant="text"
                    color="error"
                    size="small"
                    @click.stop="promptDeleteExtension(extension.id)"
                  />
                </template>
              </v-list-item>
            </v-list>
          </v-card-text>
        </v-card>
      </v-col>

      <v-col cols="12" md="8">
        <template v-if="draftExtension">
          <v-card variant="outlined">
            <v-card-title class="d-flex flex-wrap justify-space-between gap-2 align-center">
              <div>
                <div class="text-subtitle-1">{{ draftExtension.name || t('settings.blocks.untitled') }}</div>
                <div class="text-caption text-medium-emphasis">
                  {{ t('settings.blocks.updatedAt', { date: formatDate(draftExtension.updatedAt) }) }}
                </div>
              </div>
              <div class="d-flex gap-2 flex-wrap">
                <v-btn
                  variant="text"
                  :disabled="!isDirty"
                  @click="resetDraft"
                >
                  {{ t('settings.blocks.reset') }}
                </v-btn>
                <v-btn
                  color="primary"
                  :disabled="!isDirty"
                  :loading="saving"
                  @click="saveDraft"
                >
                  {{ t('settings.blocks.save') }}
                </v-btn>
              </div>
            </v-card-title>
            <v-divider />

            <v-card-text>
              <section class="mb-6">
                <v-text-field
                  v-model="draftExtension.name"
                  :label="t('settings.blocks.fields.name')"
                  variant="outlined"
                  density="comfortable"
                  clearable
                />
                <v-textarea
                  v-model="draftExtension.description"
                  :label="t('settings.blocks.fields.description')"
                  variant="outlined"
                  auto-grow
                  rows="2"
                />
              </section>

              <section class="mb-8">
                <div class="d-flex justify-space-between align-center mb-3">
                  <div>
                    <div class="text-subtitle-2">{{ t('settings.blocks.variables.title') }}</div>
                    <p class="text-caption text-medium-emphasis mb-0">
                      {{ t('settings.blocks.variables.subtitle') }}
                    </p>
                  </div>
                  <v-btn size="small" variant="text" @click="addVariable">
                    <v-icon icon="mdi-plus" start size="16" />
                    {{ t('settings.blocks.addVariable') }}
                  </v-btn>
                </div>
                <template v-if="draftExtension.variables.length === 0">
                  <v-alert type="info" variant="tonal">
                    {{ t('settings.blocks.variables.empty') }}
                  </v-alert>
                </template>
                <template v-else>
                  <div class="variable-grid">
                    <div
                      v-for="variable in draftExtension.variables"
                      :key="variable.id"
                      class="variable-row"
                    >
                      <v-text-field
                        v-model="variable.key"
                        :label="t('settings.blocks.fields.variableKey')"
                        variant="outlined"
                        density="comfortable"
                      />
                      <v-text-field
                        v-model="variable.value"
                        :label="t('settings.blocks.fields.variableValue')"
                        variant="outlined"
                        density="comfortable"
                      />
                      <v-btn
                        icon="mdi-delete"
                        variant="text"
                        color="error"
                        size="small"
                        @click="removeVariable(variable.id)"
                      />
                    </div>
                  </div>
                </template>
              </section>

              <section>
                <div class="d-flex justify-space-between align-center mb-3">
                  <div>
                    <div class="text-subtitle-2">{{ t('settings.blocks.blocksTitle') }}</div>
                    <p class="text-caption text-medium-emphasis mb-0">
                      {{ t('settings.blocks.blocksSubtitle') }}
                    </p>
                  </div>
                  <v-menu>
                    <template #activator="{ props: menuProps }">
                      <v-btn v-bind="menuProps" variant="text" size="small">
                        <v-icon icon="mdi-shape-plus" start size="16" />
                        {{ t('settings.blocks.addBlock') }}
                      </v-btn>
                    </template>
                    <v-list>
                      <v-list-item
                        v-for="option in blockOptions"
                        :key="option.type"
                        @click="addBlock(option.type)"
                      >
                        <template #prepend>
                          <v-icon :icon="option.icon" class="mr-2" />
                        </template>
                        <v-list-item-title>{{ option.label }}</v-list-item-title>
                        <v-list-item-subtitle>{{ option.description }}</v-list-item-subtitle>
                      </v-list-item>
                    </v-list>
                  </v-menu>
                </div>

                <template v-if="draftExtension.blocks.length === 0">
                  <v-alert type="info" variant="tonal">
                    {{ t('settings.blocks.blocksEmpty') }}
                  </v-alert>
                </template>
                <template v-else>
                  <div class="d-flex flex-column gap-4">
                    <v-card
                      v-for="(block, index) in draftExtension.blocks"
                      :key="block.id"
                      variant="tonal"
                    >
                      <v-card-title class="d-flex flex-wrap align-center gap-2 justify-space-between">
                        <div>
                          <div class="text-subtitle-2">{{ block.name }}</div>
                          <div class="text-caption text-medium-emphasis">
                            {{ blockOptionsMap[block.type]?.description }}
                          </div>
                        </div>
                        <div class="d-flex align-center gap-1 flex-wrap">
                          <v-chip size="small" variant="outlined" color="primary">
                            {{ blockOptionsMap[block.type]?.label }}
                          </v-chip>
                          <v-btn icon="mdi-chevron-up" variant="text" size="small" :disabled="index === 0" @click="moveBlock(index, -1)" />
                          <v-btn icon="mdi-chevron-down" variant="text" size="small" :disabled="index === draftExtension.blocks.length - 1" @click="moveBlock(index, 1)" />
                          <v-btn icon="mdi-delete" variant="text" size="small" color="error" @click="removeBlock(block.id)" />
                        </div>
                      </v-card-title>
                      <v-divider />
                      <v-card-text>
                        <v-text-field
                          v-model="block.name"
                          :label="t('settings.blocks.fields.blockName')"
                          variant="outlined"
                          density="comfortable"
                          class="mb-3"
                        />
                        <v-select
                          :model-value="block.type as any"
                          :items="blockOptions"
                          item-title="label"
                          item-value="type"
                          :label="t('settings.blocks.fields.blockType')"
                          variant="outlined"
                          density="comfortable"
                          class="mb-4"
                          @update:model-value="(value) => handleBlockTypeChange(block.id, value)"
                        />

                        <div v-if="block.type === 'getAllRolls' || block.type === 'getRollsPerPlayer'" class="mb-4">
                          <v-text-field
                            v-model.number="getLimitOptions(block).limit"
                            type="number"
                            :label="t('settings.blocks.fields.limit')"
                            variant="outlined"
                            density="comfortable"
                            hint="Optional cap for dice results"
                          />
                        </div>

                        <div v-else-if="block.type === 'getRollsFromDate'" class="mb-4 d-flex flex-column gap-4">
                          <v-text-field
                            v-model="(block.options as GetRollsFromDateBlock['options']).since"
                            :label="t('settings.blocks.fields.since')"
                            variant="outlined"
                            density="comfortable"
                            hint="Use an ISO 8601 value (e.g., 2024-01-01T00:00:00Z)"
                          />
                          <v-text-field
                            v-model.number="(block.options as GetRollsFromDateBlock['options']).limit"
                            type="number"
                            :label="t('settings.blocks.fields.limit')"
                            variant="outlined"
                            density="comfortable"
                          />
                        </div>

                        <div v-else class="mb-4">
                          <p class="text-body-2 text-medium-emphasis mb-0">
                            {{ t('settings.blocks.roomInfoHint') }}
                          </p>
                        </div>

                        <v-textarea
                          v-model="block.jsCallback"
                          :label="t('settings.blocks.fields.callback')"
                          variant="outlined"
                          auto-grow
                          rows="4"
                          class="code-editor"
                          hint="Access context.room, context.variables, context.response, context.previousResponses"
                          persistent-hint
                        />
                      </v-card-text>
                    </v-card>
                  </div>
                </template>
              </section>
            </v-card-text>
          </v-card>
        </template>

        <template v-else>
          <v-card variant="tonal" class="d-flex align-center justify-center text-center pa-8">
            <div>
              <v-icon icon="mdi-shape-outline" size="48" color="primary" class="mb-4" />
              <p class="text-body-1 mb-2">{{ t('settings.blocks.placeholderTitle') }}</p>
              <p class="text-body-2 text-medium-emphasis mb-4">
                {{ t('settings.blocks.placeholderSubtitle') }}
              </p>
              <v-btn color="primary" variant="flat" @click="handleCreateExtension">
                {{ t('settings.blocks.createFirst') }}
              </v-btn>
            </div>
          </v-card>
        </template>
      </v-col>
    </v-row>

    <v-dialog v-model="deleteDialog" max-width="420">
      <v-card>
        <v-card-title class="text-h6">
          {{ t('settings.blocks.deleteTitle') }}
        </v-card-title>
        <v-card-text>
          {{ t('settings.blocks.deleteMessage') }}
        </v-card-text>
        <v-card-actions class="justify-end">
          <v-btn variant="text" @click="deleteDialog = false">{{ t('common.cancel') }}</v-btn>
          <v-btn color="error" @click="confirmDelete">{{ t('settings.blocks.deleteConfirm') }}</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </section>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  type BlockActionType,
  BLOCK_ACTION_DEFINITIONS,
  cloneExtension,
  createBlock,
  createVariable,
  type BlocksExtension,
  type BlocksExtensionBlock,
  type GetRollsFromDateBlock,
} from 'core/types/blocks-extension.types';
import { useBlocksExtensionsStore } from 'core/stores/blocks-extensions.store';

const { t } = useI18n();
const store = useBlocksExtensionsStore();
store.initialize();

const selectedExtensionId = ref<string | null>(null);
const draftExtension = ref<BlocksExtension | null>(null);
const originalSnapshot = ref<string | null>(null);
const saving = ref(false);
const feedback = ref<{ type: 'success' | 'error'; message: string } | null>(null);
const deleteDialog = ref(false);
const pendingDeleteId = ref<string | null>(null);

const blockOptions = computed(() => Object.values(BLOCK_ACTION_DEFINITIONS));
const blockOptionsMap = computed(() =>
  blockOptions.value.reduce<Record<string, (typeof blockOptions.value)[number]>>((acc, option) => {
    acc[option.type] = option;
    return acc;
  }, {})
);

const extensions = computed(() => store.extensions);
const isDirty = computed(() => {
  if (!draftExtension.value) return false;
  return serializeExtension(draftExtension.value) !== originalSnapshot.value;
});

watch(
  () => store.extensions.length,
  () => {
    if (!selectedExtensionId.value && store.extensions.length > 0) {
      selectedExtensionId.value = store.extensions[0].id;
    }
  },
  { immediate: true }
);

watch(
  () => selectedExtensionId.value,
  (value) => {
    const extension = store.getExtensionById(value ?? undefined);
    if (extension) {
      draftExtension.value = cloneExtension(extension);
      originalSnapshot.value = serializeExtension(extension);
    } else {
      draftExtension.value = null;
      originalSnapshot.value = null;
    }
  },
  { immediate: true }
);

function selectExtension(id: string) {
  selectedExtensionId.value = id;
}

function handleCreateExtension() {
  const created = store.createExtension({});
  selectedExtensionId.value = created.id;
}

function saveDraft() {
  if (!draftExtension.value) return;
  saving.value = true;
  try {
    const saved = store.saveExtension(draftExtension.value);
    draftExtension.value = cloneExtension(saved);
    originalSnapshot.value = serializeExtension(saved);
    feedback.value = { type: 'success', message: t('settings.blocks.saveSuccess') };
  } catch (error) {
    console.error(error);
    feedback.value = { type: 'error', message: t('settings.blocks.saveError') };
  } finally {
    saving.value = false;
  }
}

function resetDraft() {
  if (!selectedExtensionId.value) return;
  const extension = store.getExtensionById(selectedExtensionId.value);
  if (!extension) return;
  draftExtension.value = cloneExtension(extension);
  originalSnapshot.value = serializeExtension(extension);
}

function addVariable() {
  if (!draftExtension.value) return;
  draftExtension.value.variables.push(createVariable());
}

function removeVariable(variableId: string) {
  if (!draftExtension.value) return;
  draftExtension.value.variables = draftExtension.value.variables.filter((variable) => variable.id !== variableId);
}

function addBlock(type: BlockActionType) {
  if (!draftExtension.value) return;
  draftExtension.value.blocks.push(createBlock(type));
}

function removeBlock(blockId: string) {
  if (!draftExtension.value) return;
  draftExtension.value.blocks = draftExtension.value.blocks.filter((block) => block.id !== blockId);
}

function moveBlock(index: number, direction: number) {
  if (!draftExtension.value) return;
  const newIndex = index + direction;
  if (newIndex < 0 || newIndex >= draftExtension.value.blocks.length) return;
  const updated = [...draftExtension.value.blocks];
  const [block] = updated.splice(index, 1);
  updated.splice(newIndex, 0, block);
  draftExtension.value.blocks = updated;
}

function changeBlockType(blockId: string, type: BlockActionType) {
  if (!draftExtension.value) return;
  const index = draftExtension.value.blocks.findIndex((block) => block.id === blockId);
  if (index === -1) return;
  const previous = draftExtension.value.blocks[index];
  const { type: _oldType, ...rest } = previous;
  draftExtension.value.blocks.splice(
    index,
    1,
    createBlock(type, {
      ...rest,
    })
  );
}

function handleBlockTypeChange(blockId: string, value: unknown) {
  if (typeof value !== 'string') return;
  if (!(value in blockOptionsMap.value)) return;
  changeBlockType(blockId, value as BlockActionType);
}

function getLimitOptions(block: BlocksExtensionBlock): { limit?: number | null } {
  return block.options as { limit?: number | null };
}

function promptDeleteExtension(extensionId: string) {
  pendingDeleteId.value = extensionId;
  deleteDialog.value = true;
}

function confirmDelete() {
  if (!pendingDeleteId.value) return;
  store.deleteExtension(pendingDeleteId.value);
  if (selectedExtensionId.value === pendingDeleteId.value) {
    selectedExtensionId.value = store.extensions[0]?.id ?? null;
  }
  pendingDeleteId.value = null;
  deleteDialog.value = false;
  draftExtension.value = null;
  originalSnapshot.value = null;
}

function formatDate(value: string | undefined) {
  if (!value) return t('settings.blocks.neverSaved');
  return new Date(value).toLocaleString();
}

function serializeExtension(extension: BlocksExtension) {
  return JSON.stringify(extension);
}
</script>

<style scoped>
.blocks-extensions-panel .variable-grid {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.blocks-extensions-panel .variable-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)) auto;
  gap: 0.5rem;
  align-items: center;
}

.code-editor :deep(textarea) {
  font-family: 'Fira Code', 'SFMono-Regular', Consolas, monospace;
}
</style>
