<template>
  <section class="roll-awards-panel">
    <div class="roll-awards-panel__header">
      <h3 class="text-subtitle-1">🏆 Roll Awards</h3>
      <v-btn
        variant="text"
        size="small"
        :disabled="!canOpenSettings"
        @click="handleManageClick"
      >
        Manage
      </v-btn>
    </div>
    <p class="text-caption text-medium-emphasis mb-3">
      These awards automatically go to the players who match their tracked dice results the most.
    </p>

    <v-alert
      v-if="!rollAwardsManager.awardsEnabled.value"
      type="info"
      variant="tonal"
      density="comfortable"
    >
      Roll Awards are disabled for this room.
      <template #append>
        <v-btn variant="text" size="small" :disabled="!canOpenSettings" @click="handleManageClick">
          Settings
        </v-btn>
      </template>
    </v-alert>

    <template v-else>
      <v-progress-linear
        v-if="rollAwardsManager.awardsLoading.value"
        indeterminate
        color="primary"
        class="mb-3"
      />
      <v-alert
        v-else-if="rollAwardsManager.awardsError.value"
        type="error"
        variant="tonal"
        density="comfortable"
        class="mb-3"
      >
        {{ rollAwardsManager.awardsError.value }}
        <template #append>
          <v-btn variant="text" size="small" @click="rollAwardsManager.ensureAwardsLoaded(true)">Retry</v-btn>
        </template>
      </v-alert>
      <template v-else>
        <div
          v-if="rollAwardsManager.rollAwardsWindowSize.value"
          class="text-caption text-medium-emphasis mb-2"
        >
          Considering the last {{ rollAwardsManager.rollAwardsWindowSize.value }} dice rolls.
        </div>
        <div v-if="rollAwardsManager.awards.value.length === 0" class="text-caption text-medium-emphasis">
          No awards defined yet. Use the Manage button to create one.
        </div>
        <div v-else>
          <div class="d-flex justify-end mb-2">
            <v-btn
              variant="text"
              size="small"
              prepend-icon="mdi-eye-outline"
              @click="showOnlyObtainedAwards = !showOnlyObtainedAwards"
            >
              {{ showOnlyObtainedAwards ? 'Show all awards' : 'Show obtained only' }}
            </v-btn>
          </div>
          <div v-if="visibleAwardSummaries.length === 0" class="text-caption text-medium-emphasis">
            No awards have been obtained yet. Try showing all awards to see every entry.
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
                    Tracking:
                    <span v-for="(result, index) in awardSummary.award.diceResults" :key="`${awardSummary.award.id}-${result}-${index}`">
                      {{ result }}<span v-if="index < awardSummary.award.diceResults.length - 1">, </span>
                    </span>
                  </div>
                  <div v-if="getAwardNotations(awardSummary.award).length" class="text-caption text-medium-emphasis">
                    Only counting {{ formatAwardNotations(awardSummary.award) }} rolls
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
                    No winner yet
                  </div>
                </div>
              </div>
              <div v-if="awardSummary.leaders.length" class="text-caption text-medium-emphasis">
                {{ awardSummary.leaders.length > 1 ? 'Tied leaders' : 'Current leader' }} with {{ awardSummary.maxHits }} hit{{ awardSummary.maxHits === 1 ? '' : 's' }}.
              </div>
            </v-card>
          </div>
        </div>
      </template>
    </template>
  </section>
</template>

<script setup lang="ts">
import { computed, inject, ref } from 'vue';
import type { DiscordUser } from 'netlify/core/types/discord.types';
import type { RoomDetails, RoomMessage, RoomRollAward } from 'netlify/core/types/data.types';
import { formatDisplayName } from 'core/utils/room-formatting.utils';
import { RoomRollAwardsManagerKey, type RoomRollAwardsManager } from 'core/composables/useRoomRollAwardsManager';

const props = defineProps<{
  room: RoomDetails | null;
  messages: RoomMessage[];
  currentUser: DiscordUser | null;
}>();

const emit = defineEmits<{
  (event: 'manage-awards'): void;
}>();

const injectedRollAwardsManager = inject<RoomRollAwardsManager>(RoomRollAwardsManagerKey);

if (!injectedRollAwardsManager) {
  throw new Error('RoomRollAwardsPanel must be used within a provider of RoomRollAwardsManager.');
}

const rollAwardsManager = injectedRollAwardsManager;

const canOpenSettings = computed(() => Boolean(props.room && props.currentUser));
const showOnlyObtainedAwards = ref(false);
const DICE_NOTATION_FACE_REGEX = /^(\d+)?d(\d+)([+-]\d+)?$/i;

function getAwardNotations(award: RoomRollAward): string[] {
  if (Array.isArray(award.diceNotations) && award.diceNotations.length) {
    return award.diceNotations;
  }
  return award.diceNotation ? [award.diceNotation] : [];
}

function formatAwardNotations(award: RoomRollAward): string {
  return getAwardNotations(award).join(', ');
}

interface DiceMessageSummary {
  userId: string;
  rolls: number[];
  name: string;
  notation: string | null;
  face: string | null;
}

interface AwardLeaderSummary {
  award: RoomRollAward;
  leaders: { userId: string; name: string; count: number }[];
  maxHits: number;
}

const diceMessages = computed<DiceMessageSummary[]>(() => {
  return props.messages
    .filter((message) => message.type === 'dice' && message.userId && Array.isArray(message.diceRolls))
    .map((message) => {
      const notation = message.diceNotation?.trim().toLowerCase() ?? null;
      const face = extractDieFace(notation);
      return {
        userId: message.userId as string,
        rolls: (message.diceRolls ?? []).map((roll) => Number(roll)).filter((roll) => Number.isFinite(roll)),
        notation,
        face,
        name: formatDisplayName(message.username, message.nickname),
      };
    });
});

const diceMessagesWindowed = computed(() => {
  const limit = rollAwardsManager.rollAwardsWindowSize.value;
  const entries = diceMessages.value;
  if (!limit || limit <= 0) {
    return entries;
  }
  return entries.slice(-limit);
});

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

function isCurrentUser(userId: string) {
  return props.currentUser?.id === userId;
}

function evaluateAward(award: RoomRollAward, rolls: DiceMessageSummary[]): { leaders: AwardLeaderSummary['leaders']; maxHits: number } {
  if (!Array.isArray(award.diceResults) || award.diceResults.length === 0) {
    return { leaders: [], maxHits: 0 };
  }
  const targets = new Set(award.diceResults.map((result) => Number(result)));
  if (!targets.size) {
    return { leaders: [], maxHits: 0 };
  }
  const requiredFaces = getAwardNotations(award)
    .map((notation) => extractDieFace(notation))
    .filter((face): face is string => Boolean(face));
  const counts = new Map<string, { userId: string; name: string; count: number }>();
  for (const message of rolls) {
    if (!notationMatchesFilter(message.face, requiredFaces)) continue;
    const hits = message.rolls.reduce((total, roll) => {
      const normalized = Math.floor(roll);
      return targets.has(normalized) ? total + 1 : total;
    }, 0);
    if (hits > 0) {
      const existing = counts.get(message.userId);
      if (existing) {
        existing.count += hits;
      } else {
        counts.set(message.userId, { userId: message.userId, name: message.name, count: hits });
      }
    }
  }

  if (!counts.size) {
    return { leaders: [], maxHits: 0 };
  }

  let maxHits = 0;
  counts.forEach((entry) => {
    if (entry.count > maxHits) {
      maxHits = entry.count;
    }
  });

  const leaders = Array.from(counts.values()).filter((entry) => entry.count === maxHits && maxHits > 0);
  return { leaders, maxHits };
}

function extractDieFace(value?: string | null): string | null {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return null;
  const match = normalized.match(DICE_NOTATION_FACE_REGEX);
  if (!match) return null;
  return match[2];
}

function notationMatchesFilter(messageFace: string | null, awardFaces: string[]): boolean {
  if (!awardFaces.length) return true;
  if (!messageFace) return false;
  return awardFaces.includes(messageFace);
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
