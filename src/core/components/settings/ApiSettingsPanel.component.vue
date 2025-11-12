<template>
  <section class="pa-6 api-settings-panel">
    <v-alert type="info" variant="tonal" class="mb-4">
      {{ t('settings.api.description') }}
    </v-alert>
    <v-alert type="warning" variant="tonal" class="mb-6">
      {{ t('settings.api.enforcement') }}
    </v-alert>

    <v-alert
      v-if="feedback && feedback.type === 'error'"
      type="error"
      variant="tonal"
      class="mb-4"
    >
      {{ feedback.message }}
    </v-alert>
    <v-alert
      v-else-if="feedback && feedback.type === 'success'"
      type="success"
      variant="tonal"
      class="mb-4"
    >
      {{ feedback.message }}
    </v-alert>

    <div v-if="loadingKey" class="d-flex justify-center pa-6">
      <v-progress-circular color="primary" indeterminate />
    </div>

    <div v-else>
      <v-text-field
        :model-value="apiKey ?? ''"
        :type="showKey ? 'text' : 'password'"
        :label="t('settings.api.apiKeyLabel')"
        :placeholder="!apiKey ? t('settings.api.emptyPlaceholder') : ''"
        readonly
        hide-details="auto"
        class="mb-2"
      >
        <template #append-inner>
          <v-btn
            v-if="apiKey"
            variant="text"
            :icon="showKey ? 'mdi-eye-off' : 'mdi-eye'"
            :title="showKey ? t('settings.api.hide') : t('settings.api.show')"
            @click="toggleVisibility"
            size="small"
          />
          <v-btn
            v-if="apiKey"
            variant="text"
            icon="mdi-content-copy"
            color="primary"
            :disabled="copying"
            :title="t('settings.api.copy')"
            @click="copyKey"
            size="small"
          />
        </template>
      </v-text-field>

      <p v-if="!apiKey" class="text-body-2 text-medium-emphasis mb-4">
        {{ t('settings.api.emptyState') }}
      </p>
      <p v-else class="text-caption text-medium-emphasis mb-4">
        <span v-if="createdAt">
          {{ t('settings.api.generatedAt', { date: formatDate(createdAt) }) }}
        </span>
        <span v-if="lastUsedAt" class="ms-2">
          {{ t('settings.api.lastUsed', { date: formatDate(lastUsedAt) }) }}
        </span>
      </p>

      <div class="d-flex flex-wrap gap-3">
        <v-btn
          color="primary"
          :loading="generating"
          :disabled="!currentUser || generating"
          @click="generateKey"
        >
          {{ apiKey ? t('settings.api.regenerate') : t('settings.api.generate') }}
        </v-btn>
        <v-btn
          v-if="apiKey"
          color="error"
          variant="text"
          :loading="revoking"
          :disabled="revoking"
          @click="revokeKey"
        >
          {{ t('settings.api.revoke') }}
        </v-btn>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { DiscordService } from 'modules/discord-auth/services/discord.service';
import { ApiKeysService, type UserApiKeyData } from 'core/services/api-keys.service';

type FeedbackState = { type: 'success' | 'error'; message: string } | null;

const { t } = useI18n();
const discordService = DiscordService.getInstance();
const currentUser = computed(() => discordService.user.value);

const apiKey = ref<string | null>(null);
const createdAt = ref<string | null>(null);
const lastUsedAt = ref<string | null>(null);
const showKey = ref(false);
const loadingKey = ref(false);
const generating = ref(false);
const revoking = ref(false);
const copying = ref(false);
const feedback = ref<FeedbackState>(null);

function setKeyData(data: UserApiKeyData) {
  apiKey.value = data.apiKey;
  createdAt.value = data.createdAt ?? null;
  lastUsedAt.value = data.lastUsedAt ?? null;
}

function resetState() {
  apiKey.value = null;
  createdAt.value = null;
  lastUsedAt.value = null;
  showKey.value = false;
}

async function loadApiKey() {
  if (!currentUser.value) {
    resetState();
    return;
  }

  loadingKey.value = true;
  feedback.value = null;
  try {
    const data = await ApiKeysService.fetch(currentUser.value.id);
    setKeyData(data);
  } catch (error) {
    feedback.value = {
      type: 'error',
      message: error instanceof Error ? error.message : t('settings.api.loadError'),
    };
  } finally {
    loadingKey.value = false;
  }
}

async function generateKey() {
  if (!currentUser.value) return;

  generating.value = true;
  feedback.value = null;
  try {
    const data = await ApiKeysService.generate(currentUser.value.id);
    setKeyData(data);
    showKey.value = true;
    feedback.value = {
      type: 'success',
      message: t('settings.api.generateSuccess'),
    };
  } catch (error) {
    feedback.value = {
      type: 'error',
      message: error instanceof Error ? error.message : t('settings.api.generateError'),
    };
  } finally {
    generating.value = false;
  }
}

async function revokeKey() {
  if (!currentUser.value || !apiKey.value) return;
  if (!window.confirm(t('settings.api.confirmRevoke'))) return;

  revoking.value = true;
  feedback.value = null;
  try {
    await ApiKeysService.revoke(currentUser.value.id);
    resetState();
    feedback.value = {
      type: 'success',
      message: t('settings.api.revokeSuccess'),
    };
  } catch (error) {
    feedback.value = {
      type: 'error',
      message: error instanceof Error ? error.message : t('settings.api.revokeError'),
    };
  } finally {
    revoking.value = false;
  }
}

async function copyKey() {
  if (!apiKey.value) return;
  copying.value = true;
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(apiKey.value);
    } else {
      const textarea = document.createElement('textarea');
      textarea.value = apiKey.value;
      textarea.style.position = 'fixed';
      textarea.style.left = '-9999px';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }
    feedback.value = { type: 'success', message: t('settings.api.copySuccess') };
  } catch {
    feedback.value = { type: 'error', message: t('settings.api.copyError') };
  } finally {
    copying.value = false;
  }
}

function toggleVisibility() {
  showKey.value = !showKey.value;
}

function formatDate(value: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

watch(
  () => currentUser.value?.id,
  (userId) => {
    if (userId) {
      loadApiKey();
    } else {
      resetState();
    }
  },
  { immediate: true }
);
</script>

<style scoped>
.api-settings-panel {
  width: 100%;
}

.gap-3 {
  gap: 12px;
}
</style>
