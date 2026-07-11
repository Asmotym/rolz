<template>
  <v-responsive>
    <v-app>
      <v-main class="app">
        <router-view></router-view>
      </v-main>
      <AppNotifications />
    </v-app>
  </v-responsive>
</template>

<script setup lang="ts">
import { useAppTheme } from 'core/composables/useAppTheme';
import AppNotifications from 'core/components/AppNotifications.component.vue';

const { initializeThemeSync } = useAppTheme();
initializeThemeSync();
</script>
