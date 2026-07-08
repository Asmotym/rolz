<template>
  <v-responsive>
    <v-app>
      <v-main class="app">
        <router-view></router-view>
      </v-main>
    </v-app>
  </v-responsive>
</template>

<script setup lang="ts">
import { useAppTheme } from 'core/composables/useAppTheme';

const { initializeThemeSync } = useAppTheme();
initializeThemeSync();
</script>
