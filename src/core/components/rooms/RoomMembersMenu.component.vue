<template>
  <v-menu
    v-model="menuOpen"
    :close-on-content-click="false"
    location="bottom"
    offset="8"
    max-width="420"
  >
    <template #activator="{ props: menuActivatorProps }">
      <v-chip
        v-bind="menuActivatorProps"
        variant="tonal"
        color="secondary"
        class="members-chip"
        :append-icon="menuOpen ? 'mdi-chevron-up' : 'mdi-chevron-down'"
        @click="handleMembersChipClick"
      >
        {{ t('members.count', { count: membersCount }) }}
      </v-chip>
    </template>

    <v-card class="members-popover pa-3" elevation="8">
      <div class="members-popover__header">
        <div>
          <div class="text-subtitle-2">{{ t('members.title') }}</div>
          <small class="text-medium-emphasis">
            {{ t('members.total', { count: members.length }) }}
            <span class="dot-separator" aria-hidden="true">•</span>
            {{ t('members.online', { count: onlineMembers.length }) }}
          </small>
        </div>
        <v-btn
          icon="mdi-refresh"
          variant="text"
          size="small"
          :disabled="membersLoading"
          :loading="membersLoading"
          @click="refreshMembers"
        />
      </div>

      <template v-if="membersError">
        <v-alert
          type="error"
          variant="tonal"
          density="comfortable"
          class="mb-3"
        >
          {{ membersError }}
        </v-alert>
      </template>
      <template v-else>
        <v-progress-linear
          v-if="membersLoading"
          indeterminate
          color="secondary"
          class="mb-3"
        />

        <v-list
          v-else-if="members.length > 0"
          density="comfortable"
          class="members-popover__list"
        >
          <v-list-item
            v-for="member in members"
            :key="member.userId"
            class="members-popover__item"
          >
            <template #prepend>
              <v-avatar size="36" class="mr-3">
                <template v-if="member.avatar">
                  <v-img :src="member.avatar" :alt="member.username || member.userId" />
                </template>
                <template v-else>
                  <v-icon>mdi-account</v-icon>
                </template>
              </v-avatar>
            </template>
            <v-list-item-title class="members-popover__name">
              <span>{{ formatDisplayName(member.username, member.nickname) }}</span>
              <span
                v-if="member.isOnline"
                class="member-online-pill"
              >
                <span class="member-online-pill__dot" aria-hidden="true" />
                {{ t('members.connected') }}
              </span>
            </v-list-item-title>
            <v-list-item-subtitle class="text-caption">
              <span>{{ t('members.joined', { date: formatTimestamp(member.joinedAt) }) }}</span>
              <span class="dot-separator" aria-hidden="true">•</span>
              <span v-if="member.isOnline">{{ t('members.connectedNow') }}</span>
              <span v-else>{{ t('members.lastSeen', { date: formatTimestamp(member.lastSeen) }) }}</span>
              <span class="dot-separator" aria-hidden="true">•</span>
              <span>{{ t('bonusPoints.memberPoints', { current: getMemberBonusPoints(member.userId), max: maxBonusPoints }) }}</span>
            </v-list-item-subtitle>
          </v-list-item>
        </v-list>

        <div v-else class="text-medium-emphasis text-caption">
          {{ t('members.empty') }}
        </div>
      </template>
    </v-card>
  </v-menu>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import type { RoomBonusPointBalance, RoomDetails, RoomMemberDetails } from 'netlify/core/types/data.types';
import { RoomsService } from 'core/services/rooms.service';
import { formatDisplayName, formatTimestamp } from 'core/utils/room-formatting.utils';

const props = defineProps<{
  room: RoomDetails;
  bonusPointBalances?: RoomBonusPointBalance[];
  maxBonusPoints?: number;
}>();

const { t } = useI18n();

const menuOpen = ref(false);
const members = ref<RoomMemberDetails[]>([]);
const membersLoading = ref(false);
const membersError = ref<string | null>(null);
const membersLoadedRoomId = ref<string | null>(null);

const onlineMembers = computed(() => members.value.filter((member) => member.isOnline));
const membersCount = computed(() => props.room.memberCount ?? members.value.length ?? 0);
const maxBonusPoints = computed(() => props.maxBonusPoints ?? props.room.bonusPointSettings?.maxPointsPerUser ?? 0);

watch(
  () => props.room.id,
  () => {
    resetMembersState();
  }
);

watch(menuOpen, async (open) => {
  if (open) {
    await ensureMembersLoaded();
  }
});

function handleMembersChipClick() {
  if (!menuOpen.value) {
    ensureMembersLoaded();
  }
}

function refreshMembers() {
  ensureMembersLoaded(true);
}

async function ensureMembersLoaded(force = false) {
  if (!props.room) return;
  if (!force && membersLoadedRoomId.value === props.room.id && members.value.length > 0) {
    return;
  }
  await fetchMembers(props.room.id);
}

async function fetchMembers(roomId: string) {
  membersLoading.value = true;
  membersError.value = null;
  try {
    const list = await RoomsService.fetchMembers(roomId);
    if (props.room.id === roomId) {
      members.value = list;
      membersLoadedRoomId.value = roomId;
    }
  } catch (error) {
    if (props.room.id === roomId) {
      membersError.value = error instanceof Error ? error.message : t('members.loadError');
    }
  } finally {
    if (props.room.id === roomId) {
      membersLoading.value = false;
    }
  }
}

function resetMembersState() {
  menuOpen.value = false;
  members.value = [];
  membersError.value = null;
  membersLoadedRoomId.value = null;
  membersLoading.value = false;
}

function getMemberBonusPoints(userId: string): number {
  return props.bonusPointBalances?.find((balance) => balance.userId === userId)?.points ?? 0;
}
</script>

<style scoped>
.members-chip {
  cursor: pointer;
}

.members-popover {
  min-width: 320px;
  max-width: 420px;
}

.members-popover__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.members-popover__list {
  max-height: 280px;
  overflow-y: auto;
}

.members-popover__item:not(:last-child) {
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.members-popover__name {
  display: flex;
  align-items: center;
  gap: 8px;
}

.member-online-pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 0.75rem;
  padding: 2px 8px;
  border-radius: 999px;
  background-color: rgba(76, 175, 80, 0.15);
  color: var(--v-theme-success, #4caf50);
  font-weight: 600;
}

.member-online-pill__dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background-color: currentColor;
  display: inline-block;
}

.dot-separator {
  margin: 0 6px;
  opacity: 0.6;
}
</style>
