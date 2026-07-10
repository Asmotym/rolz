<template>
  <div
    v-for="message in messages"
    :key="message.id"
    class="message-row"
    :class="{ 'is-self': message.userId === currentUserId }"
  >
    <v-avatar size="36" class="mr-3">
      <template v-if="message.avatar">
        <v-img :src="message.avatar" :alt="formatDisplayName(message.username, message.nickname)" />
      </template>
      <template v-else>
        <v-icon>mdi-account</v-icon>
      </template>
    </v-avatar>
    <div
      class="message-content"
      :class="{ 'has-critical': Boolean(getCriticalRule(message)) }"
      :style="getMessageStyle(message)"
    >
      <div class="message-meta">
        <span class="text-subtitle-2">{{ formatDisplayName(message.username, message.nickname) }}</span>
        <small class="text-medium-emphasis">{{ formatTimestamp(message.createdAt) }}</small>
      </div>
      <div v-if="message.type === 'text'">
        {{ message.content || '...' }}
      </div>
      <div v-else class="dice-message pa-3">
        <div class="d-flex align-center gap-2 mb-1">
          <v-icon color="amber" class="mr-2">mdi-dice-multiple</v-icon>
          <span v-if="message.content" class="font-weight-medium">
            {{ t('messages.rolledWithDescription', {
              name: formatDisplayName(message.username, message.nickname, t('common.someone')),
              notation: message.diceNotation,
              description: message.content,
            }) }}
          </span>
          <span v-else class="font-weight-medium">
            {{ t('messages.rolled', {
              name: formatDisplayName(message.username, message.nickname, t('common.someone')),
              notation: message.diceNotation,
            }) }}
          </span>
        </div>
        <div class="text-body-2">
          {{ t('messages.result') }}: <strong>{{ message.diceTotal }}</strong>
          <v-chip
            v-if="message.pointUsed"
            size="x-small"
            color="primary"
            variant="tonal"
            class="ml-2"
          >
            {{ t('bonusPoints.pointUsedChip', { count: message.bonusPointsUsed ?? 0 }) }}
          </v-chip>
        </div>
        <div v-if="message.pointUsed" class="text-caption">
          {{ t('bonusPoints.pointUsedDetails', {
            base: message.diceBaseTotal,
            adjustment: formatAdjustment(message.bonusPointAdjustment),
          }) }}
        </div>
        <div class="text-caption">
          {{ t('messages.rolls') }}: {{ (message.diceRolls || []).join(', ') }}
        </div>
        <div v-if="canUseBonusPointOnMessage(message)" class="mt-2">
          <v-btn
            size="small"
            variant="tonal"
            color="primary"
            prepend-icon="mdi-star-four-points"
            :loading="bonusPointActionLoadingId === message.id"
            :disabled="Boolean(bonusPointActionLoadingId)"
            @click="emit('use-bonus-point', message)"
          >
            {{ t('bonusPoints.useOnRoll') }}
          </v-btn>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import type { RoomBonusPointRule, RoomCriticalRule, RoomMessage } from 'netlify/core/types/data.types';
import { formatDisplayName, formatTimestamp } from 'core/utils/room-formatting.utils';
import { findMatchingRoomCritical, getCriticalMessageStyle } from 'core/utils/room-criticals.utils';
import { getDiceFaceInfo, isNaturalExtremeRoll } from 'netlify/core/utils/bonus-point-dice';

const props = defineProps<{
  messages: RoomMessage[];
  currentUserId: string | null;
  roomCriticals: RoomCriticalRule[];
  canUseBonusPoint: boolean;
  allowExtremeBonusPointSpend: boolean;
  bonusPointRules: RoomBonusPointRule[];
  bonusPointActionLoadingId: string | null;
}>();

const emit = defineEmits<{
  (event: 'use-bonus-point', message: RoomMessage): void;
}>();

const { t } = useI18n();

const latestDiceMessageId = computed(() => {
  const sorted = [...props.messages]
    .filter((message) => message.type === 'dice')
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  const latest = sorted[sorted.length - 1];
  return latest?.id ?? null;
});

function getCriticalRule(message: RoomMessage) {
  return findMatchingRoomCritical(message, props.roomCriticals);
}

function getMessageStyle(message: RoomMessage) {
  return getCriticalMessageStyle(getCriticalRule(message));
}

function formatAdjustment(value?: number | null) {
  const amount = Number(value ?? 0);
  return amount > 0 ? `+${amount}` : String(amount);
}

function canUseBonusPointOnMessage(message: RoomMessage) {
  const diceInfo = getDiceFaceInfo(message.diceNotation);
  const rule = diceInfo
    ? props.bonusPointRules.find((current) => current.diceNotation === diceInfo.faceNotation)
    : null;
  return props.canUseBonusPoint &&
    message.type === 'dice' &&
    !message.bonusPointRulesSkipped &&
    message.userId === props.currentUserId &&
    message.id === latestDiceMessageId.value &&
    Boolean(rule) &&
    (props.allowExtremeBonusPointSpend || !isNaturalExtremeRoll(message.diceNotation, message.diceRolls));
}
</script>

<style scoped>
.message-row {
  display: flex;
  margin-bottom: 16px;
}

.message-row.is-self {
  flex-direction: row-reverse;
  text-align: right;
}

.message-row.is-self .mr-3 {
  margin-right: 0;
  margin-left: 12px;
}

.message-row.is-self .message-content {
  --message-bg: rgba(103, 80, 164, 0.1);
}

.message-content {
  background-color: var(--message-bg, rgba(255, 255, 255, 0.05));
  border: 1px solid var(--message-border-color, transparent);
  border-radius: 12px;
  padding: 12px;
  flex: 1;
  transition: background-color 0.2s ease, border-color 0.2s ease;
}

.message-meta {
  display: flex;
  justify-content: space-between;
  margin-bottom: 4px;
}

.dice-message {
  background-color: var(--dice-message-bg, rgba(255, 193, 7, 0.08));
  border-radius: 12px;
}
</style>
