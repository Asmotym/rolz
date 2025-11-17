<template>
  <section class="dice-panel">
    <h3 class="text-subtitle-1 mb-2">🎲 Dice Roll</h3>
    <template v-if="!currentUser">
      <v-alert type="info" variant="tonal" density="comfortable">
        Sign in to manage and roll your custom dice for this room.
      </v-alert>
    </template>
    <template v-else>
      <v-progress-linear
        v-if="diceManager.roomDicesLoading.value"
        indeterminate
        color="primary"
        class="mb-3"
      />
      <v-alert
        v-else-if="diceManager.roomDicesError.value"
        type="error"
        variant="tonal"
        density="comfortable"
        class="mb-3"
      >
        {{ diceManager.roomDicesError.value }}
        <template #append>
          <v-btn variant="text" size="small" @click="diceManager.ensureRoomDicesLoaded(true)">Retry</v-btn>
        </template>
      </v-alert>
      <v-alert
        v-else-if="diceManager.customDices.value.length === 0"
        type="info"
        variant="tonal"
        density="comfortable"
      >
        You haven't saved any dice for this room yet. Add one from Settings → Dices.
      </v-alert>
      <template v-else>
        <div class="custom-dice-chip-group">
          <v-chip
            v-for="dice in diceManager.customDices.value"
            :key="dice.id"
            variant="tonal"
            class="custom-dice-chip"
            size="large"
            @click="diceManager.rollCustomDice(dice)"
          >
            <div class="custom-dice-chip__content">
              <span class="custom-dice-chip__notation">{{ dice.notation }}</span>
              <span
                v-if="dice.description"
                class="custom-dice-chip__description"
              >
                {{ dice.description }}
              </span>
            </div>
          </v-chip>
          <v-chip
            key="add-dice"
            variant="outlined"
            size="large"
            class="custom-dice-chip custom-dice-chip--action"
            color="primary"
            title="Add a new custom dice"
            @click="emit('manage-dice')"
          >
            <div class="custom-dice-chip__content">
              <v-icon icon="mdi-plus" size="18" class="mr-1" />
              <span>Add dice</span>
            </div>
          </v-chip>
        </div>
      </template>
    </template>
    <v-alert
      v-if="diceManager.diceRollError.value"
      type="error"
      variant="tonal"
      density="comfortable"
      class="mt-3"
    >
      {{ diceManager.diceRollError.value }}
    </v-alert>
  </section>
</template>

<script setup lang="ts">
import { inject } from 'vue';
import type { DiscordUser } from 'netlify/core/types/discord.types';
import { RoomDiceManagerKey, type RoomDiceManager } from 'core/composables/useRoomDiceManager';

defineProps<{
  currentUser: DiscordUser | null;
}>();

const emit = defineEmits<{
  (event: 'manage-dice'): void;
}>();

const diceManager = inject<RoomDiceManager>(RoomDiceManagerKey);

if (!diceManager) {
  throw new Error('RoomDicePanel must be used within a provider of RoomDiceManager.');
}
</script>

<style scoped>
.dice-panel {
  min-width: 0;
  width: 100%;
}

.custom-dice-chip-group {
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  gap: 8px;
}

.custom-dice-chip {
  cursor: pointer;
  text-transform: none;
  display: flex;
  text-align: left;
}

.custom-dice-chip--action {
  border-style: dashed;
}

.custom-dice-chip__content {
  display: flex;
  flex-direction: row;
  align-items: center;
  line-height: 1.2;
  gap: 4px;
}

.custom-dice-chip__notation {
  font-weight: 600;
}

.custom-dice-chip__description {
  font-size: 0.78rem;
  opacity: 0.75;
  margin-top: 2px;
  white-space: normal;
  word-break: break-word;
}
</style>
