<template>
  <section class="room-blocks-extension-tab">
    <div class="d-flex flex-wrap justify-space-between align-center gap-3 mb-4">
      <div>
        <div class="text-subtitle-1">{{ extension.name }}</div>
        <div class="text-caption text-medium-emphasis">
          {{ extension.description || t('roomExtensions.runner.descriptionFallback') }}
        </div>
      </div>
      <v-btn
        color="primary"
        :disabled="extension.blocks.length === 0"
        :loading="running"
        @click="runExtension"
      >
        <v-icon icon="mdi-refresh" start size="18" />
        {{ t('roomExtensions.runner.runAgain') }}
      </v-btn>
    </div>

    <template v-if="extension.blocks.length === 0">
      <v-alert type="info" variant="tonal">
        {{ t('roomExtensions.runner.noBlocks') }}
      </v-alert>
      <p class="text-caption text-medium-emphasis mt-3 mb-0">
        {{ t('roomExtensions.runner.noBlocksHint') }}
      </p>
    </template>

    <template v-else>
      <div class="mb-4 d-flex flex-wrap gap-3">
        <v-chip v-if="lastRunAt" size="small" variant="outlined">
          {{ t('roomExtensions.runner.lastRun', { date: formatDate(lastRunAt) }) }}
        </v-chip>
        <v-chip v-else size="small" variant="outlined">
          {{ t('roomExtensions.runner.neverRun') }}
        </v-chip>
        <v-chip size="small" variant="outlined" v-if="extension.blocks.length">
          {{ t('roomExtensions.runner.blocksCount', { count: extension.blocks.length }) }}
        </v-chip>
      </div>

      <v-alert
        v-if="executionError"
        type="error"
        variant="tonal"
        class="mb-4"
      >
        {{ executionError }}
      </v-alert>

      <v-progress-linear
        v-if="running"
        indeterminate
        color="primary"
        class="mb-4"
      />

      <div v-if="extension.variables.length > 0" class="mb-4">
        <div class="text-subtitle-2 mb-1">
          {{ t('roomExtensions.runner.variablesTitle') }}
        </div>
        <div class="d-flex flex-wrap gap-2">
          <v-chip
            v-for="variable in extension.variables"
            :key="variable.id"
            size="small"
            variant="tonal"
          >
            {{ variable.key }} = {{ variable.value }}
          </v-chip>
        </div>
      </div>

      <p class="text-caption text-medium-emphasis mb-4">
        {{ t('roomExtensions.runner.callbackHint') }}
      </p>

      <v-expansion-panels multiple>
        <v-expansion-panel
          v-for="block in extension.blocks"
          :key="block.id"
        >
          <v-expansion-panel-title>
            <div class="d-flex flex-column">
              <span class="text-subtitle-2">{{ block.name }}</span>
              <small class="text-medium-emphasis">
                {{ blockDescriptions[block.type]?.label }} • {{ blockDescriptions[block.type]?.description }}
              </small>
            </div>
            <template #actions>
              <v-chip
                size="x-small"
                :color="statusColor(block.id)"
                variant="outlined"
              >
                {{ statusLabel(block.id) }}
              </v-chip>
            </template>
          </v-expansion-panel-title>
          <v-expansion-panel-text>
            <div class="mb-2 text-caption text-medium-emphasis">
              {{ t('roomExtensions.runner.blockType', { type: blockDescriptions[block.type]?.label }) }}
            </div>
            <div class="mb-3 text-caption text-medium-emphasis">
              <span v-if="blockResultsMap[block.id]?.finishedAt">
                {{ t('roomExtensions.runner.finishedAt', { date: formatDate(blockResultsMap[block.id]?.finishedAt) }) }}
              </span>
              <span v-else>
                {{ t('roomExtensions.runner.notExecuted') }}
              </span>
            </div>
            <template v-if="blockResultsMap[block.id]?.error">
              <v-alert type="error" variant="tonal" class="mb-3">
                {{ blockResultsMap[block.id]?.error }}
              </v-alert>
            </template>
            <div class="mb-3">
              <div class="text-subtitle-2 mb-1">{{ t('roomExtensions.runner.responseTitle') }}</div>
              <PayloadPreview :display="getBlockPayload(block.id, 'response')" />
            </div>
            <div>
              <div class="text-subtitle-2 mb-1">{{ t('roomExtensions.runner.callbackTitle') }}</div>
              <PayloadPreview :display="getBlockPayload(block.id, 'callback')" />
            </div>
          </v-expansion-panel-text>
        </v-expansion-panel>
      </v-expansion-panels>
    </template>
  </section>
</template>

<script setup lang="ts">
import { computed, h, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import type { FunctionalComponent } from 'vue';
import type { RoomDetails } from 'netlify/core/types/data.types';
import type { BlocksExtension, BlocksExtensionExecution } from 'core/types/blocks-extension.types';
import { BLOCK_ACTION_DEFINITIONS } from 'core/types/blocks-extension.types';
import { BlocksExtensionsService } from 'core/services/blocks-extensions.service';

const props = defineProps<{
  room: RoomDetails;
  extension: BlocksExtension;
  active: boolean;
}>();

const { t } = useI18n();
const running = ref(false);
const executionError = ref<string | null>(null);
const execution = ref<BlocksExtensionExecution[]>([]);
const lastRunAt = ref<string | null>(null);

const blockDescriptions = BLOCK_ACTION_DEFINITIONS;

const blockResultsMap = computed(() => {
  return execution.value.reduce<Record<string, BlocksExtensionExecution>>((acc, entry) => {
    acc[entry.blockId] = entry;
    return acc;
  }, {});
});

watch(
  () => [props.extension.id, props.room.id, props.extension.updatedAt],
  () => {
    execution.value = [];
    executionError.value = null;
    lastRunAt.value = null;
    if (props.active) {
      void runExtension();
    }
  }
);

watch(
  () => props.active,
  (active) => {
    if (active) {
      void runExtension();
    }
  },
  { immediate: true }
);

async function runExtension() {
  if (!props.room) return;
  if (running.value) return;
  running.value = true;
  executionError.value = null;
  execution.value = [];
  const previousResponses: Record<string, unknown> = {};

  for (const block of props.extension.blocks) {
    const startedAt = new Date().toISOString();
    try {
      const result = await BlocksExtensionsService.executeBlock({
        block,
        room: props.room,
        extension: props.extension,
        previousResponses: { ...previousResponses },
      });
      execution.value.push({
        blockId: block.id,
        blockName: block.name,
        type: block.type,
        response: result.response,
        transformed: result.transformed,
        startedAt,
        finishedAt: new Date().toISOString(),
      });
      previousResponses[block.id] = result.transformed ?? result.response;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      execution.value.push({
        blockId: block.id,
        blockName: block.name,
        type: block.type,
        response: null,
        error: message,
        startedAt,
        finishedAt: new Date().toISOString(),
      });
      executionError.value = message;
      break;
    }
  }

  lastRunAt.value = new Date().toISOString();
  running.value = false;
}

function formatDate(value?: string | null) {
  if (!value) return t('roomExtensions.runner.neverRun');
  return new Date(value).toLocaleString();
}

function statusLabel(blockId: string) {
  const entry = blockResultsMap.value[blockId];
  if (!entry) {
    return t('roomExtensions.runner.statusIdle');
  }
  if (entry.error) {
    return t('roomExtensions.runner.statusError');
  }
  return t('roomExtensions.runner.statusSuccess');
}

function statusColor(blockId: string) {
  const entry = blockResultsMap.value[blockId];
  if (!entry) return 'grey';
  if (entry.error) return 'error';
  return 'success';
}

type PayloadDisplay =
  | { kind: 'html'; html: string }
  | { kind: 'json' | 'text' | 'empty'; text: string };

const PayloadPreview: FunctionalComponent<{ display: PayloadDisplay }> = (props) => {
  if (props.display.kind === 'html') {
    return h('div', { class: 'html-preview', innerHTML: props.display.html });
  }
  return h('pre', { class: 'code-preview' }, props.display.text);
};

function getBlockPayload(blockId: string, kind: 'response' | 'callback'): PayloadDisplay {
  const entry = blockResultsMap.value[blockId];
  const value = kind === 'response' ? entry?.response : entry?.transformed;
  const fallback =
    kind === 'response'
      ? t('roomExtensions.runner.responseEmpty')
      : t('roomExtensions.runner.callbackEmpty');
  return createPayloadDisplay(value, fallback);
}

function createPayloadDisplay(value: unknown, fallback: string): PayloadDisplay {
  if (
    value === null ||
    value === undefined ||
    (typeof value === 'string' && value.trim().length === 0)
  ) {
    return { kind: 'empty', text: fallback };
  }
  if (typeof value === 'string') {
    if (isHtml(value)) {
      return { kind: 'html', html: value };
    }
    const parsed = tryParseJson(value);
    if (parsed !== null) {
      return { kind: 'json', text: JSON.stringify(parsed, null, 2) };
    }
    return { kind: 'text', text: value };
  }
  if (typeof value === 'object') {
    return { kind: 'json', text: JSON.stringify(value, null, 2) };
  }
  return { kind: 'text', text: String(value) };
}

function tryParseJson(value: string): unknown | null {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function isHtml(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  return /<\/?[a-z][\s\S]*>/i.test(trimmed);
}
</script>

<style scoped>
.code-preview {
  background-color: rgba(0, 0, 0, 0.04);
  border-radius: 8px;
  padding: 12px;
  max-height: 240px;
  overflow: auto;
  font-family: 'Fira Code', 'SFMono-Regular', Consolas, monospace;
  font-size: 0.85rem;
}

.html-preview {
  border: 1px solid rgba(0, 0, 0, 0.12);
  border-radius: 8px;
  padding: 12px;
  max-height: 300px;
  overflow: auto;
}
</style>
