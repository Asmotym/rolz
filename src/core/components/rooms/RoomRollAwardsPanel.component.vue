<template>
  <section class="roll-awards-panel">
    <div class="roll-awards-panel__header">
      <h3 class="text-subtitle-1">🏆 {{ t('rollAwards.title') }}</h3>
      <v-btn
        variant="text"
        size="small"
        :disabled="!canOpenSettings"
        @click="handleManageClick"
      >
        {{ t('common.manage') }}
      </v-btn>
    </div>
    <p class="text-caption text-medium-emphasis mb-3">
      {{ t('rollAwards.panel.description') }}
    </p>

    <v-alert
      v-if="!rollAwardsManager.awardsEnabled.value"
      type="info"
      variant="tonal"
      density="comfortable"
    >
      {{ t('rollAwards.panel.disabled') }}
      <template #append>
        <v-btn variant="text" size="small" :disabled="!canOpenSettings" @click="handleManageClick">
          {{ t('navigation.settings') }}
        </v-btn>
      </template>
    </v-alert>

    <template v-else>
      <v-progress-linear
        v-if="awardsUiLoading"
        indeterminate
        color="primary"
        class="mb-3"
      />
      <v-alert
        v-else-if="awardsUiError"
        type="error"
        variant="tonal"
        density="comfortable"
        class="mb-3"
      >
        {{ awardsUiError }}
        <template #append>
          <v-btn variant="text" size="small" @click="retryAwardsDataLoad">{{ t('common.retry') }}</v-btn>
        </template>
      </v-alert>
      <template v-else>
        <div
          v-if="rollAwardsManager.rollAwardsWindowSize.value"
          class="text-caption text-medium-emphasis mb-2"
        >
          {{ t('rollAwards.panel.window', { count: rollAwardsManager.rollAwardsWindowSize.value }) }}
        </div>
        <div v-if="rollAwardsManager.awards.value.length === 0" class="text-caption text-medium-emphasis">
          {{ t('rollAwards.panel.empty') }}
        </div>
        <div v-else>
          <div class="d-flex justify-end mb-2">
            <v-btn
              variant="text"
              size="small"
              prepend-icon="mdi-eye-outline"
              @click="showOnlyObtainedAwards = !showOnlyObtainedAwards"
            >
              {{ showOnlyObtainedAwards ? t('rollAwards.panel.showAll') : t('rollAwards.panel.showObtained') }}
            </v-btn>
          </div>
          <div v-if="visibleAwardSummaries.length === 0" class="text-caption text-medium-emphasis">
            {{ t('rollAwards.panel.noObtained') }}
          </div>
          <div v-else class="roll-awards-panel__list">
            <v-card
              v-for="awardSummary in visibleAwardSummaries"
              :key="awardSummary.award.id"
              class="roll-award-card mb-3"
              variant="tonal"
            >
              <div class="roll-award-card__heading">
                <div>
                  <div class="text-subtitle-2">{{ awardSummary.award.name }}</div>
                  <div class="text-caption text-medium-emphasis">
                    {{ t('rollAwards.panel.tracking') }}:
                    <span v-for="(result, index) in awardSummary.award.diceResults" :key="`${awardSummary.award.id}-${result}-${index}`">
                      {{ result }}<span v-if="index < awardSummary.award.diceResults.length - 1">, </span>
                    </span>
                  </div>
                  <div v-if="getAwardNotations(awardSummary.award).length" class="text-caption text-medium-emphasis">
                    {{ t('rollAwards.onlyCounting', { notations: formatAwardNotations(awardSummary.award) }) }}
                  </div>
                </div>
                <div class="text-right">
                  <div v-if="awardSummary.leaders.length" class="text-body-2 font-weight-medium">
                    <span
                      v-for="(leader, index) in awardSummary.leaders"
                      :key="leader.userId"
                      :class="['leader-name', { 'current-user': isCurrentUser(leader.userId) }]"
                    >
                      {{ leader.name }} ({{ leader.count }})<span v-if="index < awardSummary.leaders.length - 1">, </span>
                    </span>
                  </div>
                  <div v-else class="text-caption text-medium-emphasis">
                    {{ t('rollAwards.panel.noWinner') }}
                  </div>
                </div>
              </div>
              <div v-if="awardSummary.award.description" class="text-body-2 text-medium-emphasis mb-1">
                {{ awardSummary.award.description }}
              </div>
              <div v-if="awardSummary.leaders.length" class="text-caption text-medium-emphasis">
                {{ t(awardSummary.leaders.length > 1 ? 'rollAwards.panel.tiedLeaders' : 'rollAwards.panel.currentLeader', { count: awardSummary.maxHits }) }}
              </div>
            </v-card>
          </div>
        </div>
      </template>
    </template>
  </section>
</template>

<script setup lang="ts">
import { computed, inject, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import type { DiscordUser } from 'netlify/core/types/discord.types';
import type { RoomDetails, RoomMessage, RoomRollAward } from 'netlify/core/types/data.types';
import { formatDisplayName } from 'core/utils/room-formatting.utils';
import { RoomRollAwardsManagerKey, type RoomRollAwardsManager } from 'core/composables/useRoomRollAwardsManager';
import { RoomsService } from 'core/services/rooms.service';
import {
  evaluateRoomRollAward,
  getRollAwardNotations,
} from 'netlify/core/utils/room-roll-awards';

const props = defineProps<{
  room: RoomDetails | null;
  messages: RoomMessage[];
  currentUser: DiscordUser | null;
}>();

const emit = defineEmits<{
  (event: 'manage-awards'): void;
}>();

const { t } = useI18n();

const injectedRollAwardsManager = inject<RoomRollAwardsManager>(RoomRollAwardsManagerKey);

if (!injectedRollAwardsManager) {
  throw new Error('RoomRollAwardsPanel must be used within a provider of RoomRollAwardsManager.');
}

const rollAwardsManager = injectedRollAwardsManager;

const canOpenSettings = computed(() => Boolean(props.room && props.currentUser));
const showOnlyObtainedAwards = ref(false);
const diceMessages = ref<DiceMessageSummary[]>([]);
const diceRollsLoading = ref(false);
const diceRollsError = ref<string | null>(null);
const diceRollsLoadedRoomId = ref<string | null>(null);
const diceRollsWindowApplied = ref<number | null>(null);
let diceReloading = false;
let diceReloadQueued = false;

function getAwardNotations(award: RoomRollAward): string[] {
  return getRollAwardNotations(award);
}

function formatAwardNotations(award: RoomRollAward): string {
  return getAwardNotations(award).join(', ');
}

interface DiceMessageSummary {
  userId: string;
  rolls: number[];
  name: string;
  notation: string | null;
  createdAt: string;
}

interface AwardLeaderSummary {
  award: RoomRollAward;
  leaders: { userId: string; name: string; count: number }[];
  maxHits: number;
}

const diceMessagesWindowed = computed(() => {
  const limit = rollAwardsManager.rollAwardsWindowSize.value;
  const entries = diceMessages.value;
  if (!limit || limit <= 0) {
    return entries;
  }
  return entries.slice(-limit);
});

const awardsUiLoading = computed(() => rollAwardsManager.awardsLoading.value || diceRollsLoading.value);
const awardsUiError = computed(() => rollAwardsManager.awardsError.value ?? diceRollsError.value);

const awardSummaries = computed<AwardLeaderSummary[]>(() => {
  return rollAwardsManager.awards.value.map((award) => ({
    award,
    ...evaluateAward(award, diceMessagesWindowed.value),
  }));
});

const visibleAwardSummaries = computed(() =>
  showOnlyObtainedAwards.value
    ? awardSummaries.value.filter((summary) => summary.leaders.length > 0)
    : awardSummaries.value
);

const latestDiceMessageId = computed(() => {
  const sortedDice = [...props.messages]
    .filter((message) => message.type === 'dice')
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  const latestDice = sortedDice.length > 0 ? sortedDice[sortedDice.length - 1] : undefined;
  return latestDice?.id ?? null;
});

watch(
  () => props.room?.id,
  () => {
    resetDiceRolls();
    if (props.room && rollAwardsManager.awardsEnabled.value) {
      void loadDiceRolls(true);
    }
  },
  { immediate: true }
);

watch(
  () => rollAwardsManager.rollAwardsWindowSize.value,
  () => {
    if (props.room && rollAwardsManager.awardsEnabled.value) {
      void loadDiceRolls(true);
    }
  }
);

watch(
  () => rollAwardsManager.awardsEnabled.value,
  (enabled) => {
    if (!enabled) {
      resetDiceRolls();
      return;
    }
    if (props.room) {
      void loadDiceRolls(true);
    }
  }
);

watch(latestDiceMessageId, (current, previous) => {
  if (!props.room || !rollAwardsManager.awardsEnabled.value) return;
  if (current && current !== previous) {
    void loadDiceRolls(true);
  }
});

function retryAwardsDataLoad() {
  if (rollAwardsManager.awardsError.value) {
    void rollAwardsManager.ensureAwardsLoaded(true);
    return;
  }
  void loadDiceRolls(true);
}

async function loadDiceRolls(force = false) {
  const roomId = props.room?.id;
  if (!roomId || !rollAwardsManager.awardsEnabled.value) {
    resetDiceRolls();
    return;
  }

  const windowSize = rollAwardsManager.rollAwardsWindowSize.value ?? null;

  if (diceReloading) {
    if (force) {
      diceReloadQueued = true;
    }
    return;
  }

  if (!force && diceRollsLoadedRoomId.value === roomId && diceRollsWindowApplied.value === windowSize && !diceRollsError.value) {
    return;
  }

  diceReloading = true;
  diceRollsLoading.value = true;
  diceRollsError.value = null;

  try {
    const rolls = await RoomsService.fetchDiceRolls(roomId, { limit: windowSize ?? undefined });
    diceMessages.value = normalizeDiceMessages(rolls);
    diceRollsLoadedRoomId.value = roomId;
    diceRollsWindowApplied.value = windowSize;
  } catch (error) {
    diceRollsError.value = error instanceof Error ? error.message : t('rollAwards.errors.loadRecentDiceRolls');
  } finally {
    diceRollsLoading.value = false;
    diceReloading = false;
    if (diceReloadQueued) {
      diceReloadQueued = false;
      void loadDiceRolls(true);
    }
  }
}

function normalizeDiceMessages(messages: RoomMessage[]): DiceMessageSummary[] {
  return messages
    .filter((message) => message.type === 'dice' && message.userId && Array.isArray(message.diceRolls))
    .map((message) => {
      const notation = message.diceNotation?.trim().toLowerCase() ?? null;
      return {
        userId: message.userId as string,
        rolls: (message.diceRolls ?? []).map((roll) => Number(roll)).filter((roll) => Number.isFinite(roll)),
        notation,
        name: formatDisplayName(message.username, message.nickname),
        createdAt: message.createdAt,
      };
    })
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}

function resetDiceRolls() {
  diceMessages.value = [];
  diceRollsError.value = null;
  diceRollsLoadedRoomId.value = null;
  diceRollsWindowApplied.value = null;
  diceRollsLoading.value = false;
  diceReloading = false;
  diceReloadQueued = false;
}

function isCurrentUser(userId: string) {
  return props.currentUser?.id === userId;
}

function evaluateAward(award: RoomRollAward, rolls: DiceMessageSummary[]): { leaders: AwardLeaderSummary['leaders']; maxHits: number } {
  const evaluation = evaluateRoomRollAward(award, rolls);
  const names = new Map(rolls.map((roll) => [roll.userId, roll.name]));
  return {
    leaders: evaluation.leaderUserIds.map((userId) => ({
      userId,
      name: names.get(userId) ?? t('common.unknownAdventurer'),
      count: evaluation.counts.get(userId) ?? 0,
    })),
    maxHits: evaluation.maxHits,
  };
}

function handleManageClick() {
  if (canOpenSettings.value) {
    emit('manage-awards');
  }
}

</script>

<style scoped>
.roll-awards-panel {
  min-height: 280px;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: auto;
}

.roll-awards-panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.roll-awards-panel__list {
  display: flex;
  flex-direction: column;
}

.roll-award-card {
  padding: 16px;
}

.roll-award-card__heading {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 6px;
}

.leader-name.current-user {
  color: rgb(var(--v-theme-primary));
}
</style>
