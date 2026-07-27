<template>
  <section class="general-settings-panel pa-6">
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

    <v-alert
      v-if="roomsStore.errorMessage"
      type="error"
      variant="tonal"
      class="mb-4"
      closable
      @click:close="roomsStore.setError(null)"
    >
      {{ roomsStore.errorMessage }}
    </v-alert>

    <v-card variant="tonal" class="profile-card mb-6">
      <v-card-title class="text-h6">
        {{ t('settings.general.profileTitle') }}
      </v-card-title>
      <v-card-text v-if="currentUser" class="profile-content">
        <v-avatar size="112" color="primary" class="profile-avatar">
          <v-img
            v-if="currentUser.avatar"
            :src="currentUser.avatar"
            :alt="t('settings.general.avatarAlt', { name: currentUser.username })"
            cover
          />
          <v-icon v-else icon="mdi-account" size="64" />
        </v-avatar>

        <div class="profile-details">
          <div class="mb-4">
            <div class="text-caption text-medium-emphasis">
              {{ t('settings.general.usernameLabel') }}
            </div>
            <div class="text-h5 font-weight-medium">
              {{ currentUser.username }}
            </div>
          </div>

          <v-text-field
            :model-value="currentUser.id"
            :type="showDiscordId ? 'text' : 'password'"
            :label="t('settings.general.discordIdLabel')"
            variant="outlined"
            density="comfortable"
            readonly
            hide-details="auto"
            autocomplete="off"
          >
            <template #append-inner>
              <v-btn
                variant="text"
                :icon="showDiscordId ? 'mdi-eye-off' : 'mdi-eye'"
                :title="showDiscordId
                  ? t('settings.general.hideDiscordId')
                  : t('settings.general.showDiscordId')"
                :aria-label="showDiscordId
                  ? t('settings.general.hideDiscordId')
                  : t('settings.general.showDiscordId')"
                size="small"
                @click="showDiscordId = !showDiscordId"
              />
              <v-btn
                variant="text"
                icon="mdi-content-copy"
                color="primary"
                :title="t('settings.general.copyDiscordId')"
                :aria-label="t('settings.general.copyDiscordId')"
                :loading="copying"
                size="small"
                @click="copyDiscordId"
              />
            </template>
          </v-text-field>
        </div>
      </v-card-text>
    </v-card>

    <RoomsList
      :rooms="activeRooms"
      :selected-room-id="roomsStore.selectedRoomId"
      :loading="roomsStore.loadingRooms"
      @select="openRoom"
    />
  </section>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { isNavigationFailure, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import RoomsList from 'core/components/rooms/RoomsList.component.vue';
import { HomeRoutes } from 'core/routes';
import { useRoomsStore } from 'core/stores/rooms.store';
import { DiscordService } from 'modules/discord-auth/services/discord.service';

type FeedbackState = {
  type: 'success' | 'error';
  message: string;
} | null;

const { t } = useI18n();
const router = useRouter();
const roomsStore = useRoomsStore();
const discordService = DiscordService.getInstance();

const currentUser = computed(() => discordService.user.value);
const activeRooms = computed(() => roomsStore.rooms.filter((room) => !room.isArchived));
const showDiscordId = ref(false);
const copying = ref(false);
const feedback = ref<FeedbackState>(null);

async function copyDiscordId() {
  const discordId = currentUser.value?.id;
  if (!discordId) return;

  copying.value = true;
  feedback.value = null;
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(discordId);
    } else {
      const textarea = document.createElement('textarea');
      textarea.value = discordId;
      textarea.style.position = 'fixed';
      textarea.style.left = '-9999px';
      document.body.appendChild(textarea);
      try {
        textarea.select();
        if (!document.execCommand('copy')) {
          throw new Error('Copy command was rejected');
        }
      } finally {
        document.body.removeChild(textarea);
      }
    }
    feedback.value = {
      type: 'success',
      message: t('settings.general.copySuccess'),
    };
  } catch {
    feedback.value = {
      type: 'error',
      message: t('settings.general.copyError'),
    };
  } finally {
    copying.value = false;
  }
}

function openRoom(roomId: string) {
  router.push({ name: HomeRoutes.Room, params: { roomId } }).catch((error) => {
    if (!isNavigationFailure(error)) {
      console.error(error);
    }
  });
}

watch(
  () => currentUser.value?.id,
  async (userId) => {
    showDiscordId.value = false;
    feedback.value = null;
    try {
      await roomsStore.fetchRooms(userId ?? null);
    } catch (error) {
      console.error(error);
    }
  },
  { immediate: true }
);
</script>

<style scoped>
.general-settings-panel {
  width: 100%;
}

.profile-content {
  display: flex;
  align-items: center;
  gap: 32px;
}

.profile-avatar {
  flex: 0 0 auto;
}

.profile-details {
  flex: 1 1 auto;
  min-width: 0;
  max-width: 640px;
}

@media (max-width: 600px) {
  .general-settings-panel {
    padding: 16px !important;
  }

  .profile-content {
    flex-direction: column;
    align-items: stretch;
    gap: 20px;
  }

  .profile-avatar {
    align-self: center;
  }

  .profile-details {
    max-width: none;
  }
}
</style>
