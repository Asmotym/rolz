<template>
  <div class="user-settings">
    <v-card class="settings-card" elevation="2">
      <v-tabs v-model="activeTab" color="primary" bg-color="transparent">
        <v-tab value="general">{{ t('settings.tabs.general') }}</v-tab>
        <v-tab value="rooms">{{ t('settings.tabs.rooms') }}</v-tab>
        <v-tab value="api">{{ t('settings.tabs.api') }}</v-tab>
      </v-tabs>
      <v-divider />
      <v-window v-model="activeTab">
        <v-window-item value="general">
          <GeneralSettingsPanel />
        </v-window-item>
        <v-window-item value="rooms">
          <RoomsSettingsPanel />
        </v-window-item>
        <v-window-item value="api">
          <ApiSettingsPanel />
        </v-window-item>
      </v-window>
    </v-card>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import GeneralSettingsPanel from './GeneralSettingsPanel.component.vue';
import RoomsSettingsPanel from './RoomsSettingsPanel.component.vue';
import ApiSettingsPanel from './ApiSettingsPanel.component.vue';

const { t } = useI18n();
const activeTab = ref<'general' | 'rooms' | 'api'>('general');
</script>

<style scoped>
.user-settings {
  width: 100%;
}

.settings-card {
  width: 100%;
}
</style>
