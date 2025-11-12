<template>
  <div class="dice-roller">
    <v-card class="pa-4">
      <div class="mb-4">
        <v-btn
          variant="outlined"
          size="large"
          color="brown"
          block
          @click="quickRoll('1d100')"
        >
          Roll D100
        </v-btn>
      </div>

      <div>
        <v-text-field
          v-model="rollDescription"
          label="Description (optional)"
          placeholder="e.g., Attack roll"
          variant="outlined"
          density="compact"
          class="mt-2"
          clearable
        />
      </div>
    </v-card>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import {
  rollDiceNotation,
  type DiceRoll,
  type DiceRollOptions
} from 'core/utils/dice.utils';

const emit = defineEmits<{
  (e: 'rolled', roll: DiceRoll): void;
}>();

// Reactive data
const modifier = ref(0);
const rollDescription = ref('');
const rollHistory = ref<DiceRoll[]>([]);
const rollOptions = ref<DiceRollOptions>({
    advantage: false,
    disadvantage: false,    
    modifier: 0,
    criticalRange: 10,
    fumbleRange: 91
})

// Computed properties
const totalModifier = computed(() => modifier.value || 0);

// Methods
function quickRoll(notation: string) {
  try {
    const roll = rollDiceNotation(
      notation,
      { ...rollOptions.value, ...{ modifier: totalModifier.value } },
      rollDescription.value
    );
    addRollToHistory(roll);
  } catch (error) {
    console.error('Invalid dice notation:', error);
  }
}

function addRollToHistory(roll: DiceRoll) {
  rollHistory.value.unshift(roll);
  // Keep only last 10 rolls
  if (rollHistory.value.length > 10) {
    rollHistory.value = rollHistory.value.slice(0, 10);
  }
  emit('rolled', roll);
}
</script>

<style scoped>
.dice-roller {
  max-width: 600px;
  margin: 0 auto;
}

.custom-roll-row {
  align-items: stretch !important;
}

.custom-roll-row :deep(.v-btn) {
  align-self: stretch;
  height: 100%;
  min-height: 56px;
}

.roll-history {
  max-height: 300px;
  overflow-y: auto;
}

.roll-result {
  border: 1px solid #e0e0e0;
  background-color: rgba(var(--v-theme-on-surface), var(--v-high-emphasis-opacity));
}

.roll-description {
  font-size: 0.875rem;
  font-weight: 500;
}

.border-success {
  border-color: #4caf50 !important;
}

.border-error {
  border-color: #f44336 !important;
}

.gap-2 {
  gap: 8px;
}
</style>
