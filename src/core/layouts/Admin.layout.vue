<template>
  <HeaderComponent />
  <v-container class="py-6 admin-page">
    <div class="d-flex align-center justify-space-between mb-4">
      <h1 class="text-h4">{{ t('admin.title') }}</h1>
    </div>
    <v-tabs class="mb-4" color="primary">
      <v-tab :to="{ name: HomeRoutes.AdminUsers }">{{ t('admin.tabs.users') }}</v-tab>
      <v-tab :to="{ name: HomeRoutes.AdminArticles }">{{ t('admin.tabs.articles') }}</v-tab>
    </v-tabs>
    <router-view />
  </v-container>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import HeaderComponent from 'core/components/Header.component.vue';
import { HomeRoutes } from 'core/routes';

const { t } = useI18n();
</script>

<style scoped>
.admin-page {
  max-width: 1400px;
}
</style>
