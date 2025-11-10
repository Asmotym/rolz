<template>
  <v-app-bar>
    <template #prepend>
      <v-app-bar-title class="ml-2 d-flex align-center gap-2">
        <span>{{ t('common.title') }}</span>
      </v-app-bar-title>
    </template>

    <v-container class="d-flex justify-center align-center gap-3">
      <v-btn variant="text" :to="{ name: HomeRoutes.Base }">
        <span>{{ t('navigation.home') }}</span>
      </v-btn>
      <v-btn
        v-if="activeRoomName && activeRoomId"
        color="primary"
        variant="tonal"
        :to="{ name: HomeRoutes.Room, params: { roomId: activeRoomId } }"
      >
        <v-icon icon="mdi-dice-multiple-outline" size="18" class="mr-2" />
        <span>{{ activeRoomName }}</span>
      </v-btn>
    </v-container>

    <template #append>
      <LanguageSwitcher />
      <DiscordAuth />
    </template>
  </v-app-bar>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { HomeRoutes } from 'core/routes';
import { useRoomsStore } from 'core/stores/rooms.store';
import LanguageSwitcher from 'modules/language-switcher/components/LanguageSwitcher.vue';
import DiscordAuth from 'modules/discord-auth/components/DiscordAuth.vue';

const { t } = useI18n();
const roomsStore = useRoomsStore();
const activeRoomName = computed(() => roomsStore.selectedRoom?.name ?? null);
const activeRoomId = computed(() => roomsStore.selectedRoomId);
</script>

<style scoped>
.header-title {
    font-size: 1.8rem;
    font-weight: bold;
    margin: 0;
}
</style>
