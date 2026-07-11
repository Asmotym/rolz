<template>
  <v-snackbar
    :key="notification?.id"
    :model-value="Boolean(notification)"
    :timeout="notification?.timeout ?? 3500"
    :color="notification?.type ?? 'info'"
    location="bottom right"
    @update:model-value="handleVisibility"
  >
    {{ notification?.message }}

    <template #actions>
      <v-btn
        icon="mdi-close"
        variant="text"
        :aria-label="t('common.close')"
        @click="notifications.close()"
      />
    </template>
  </v-snackbar>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { notifications } from 'core/services/notifications.service';

const { t } = useI18n();
const notification = computed(() => notifications.current.value);

function handleVisibility(value: boolean) {
  if (!value) {
    notifications.close();
  }
}
</script>
