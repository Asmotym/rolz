<template>
  <v-dialog v-model="open" max-width="960">
    <v-card>
      <v-card-title class="d-flex align-center justify-space-between">
        <span>{{ t('roomExtensions.title') }}</span>
        <v-btn icon="mdi-close" variant="text" @click="open = false" />
      </v-card-title>
      <v-divider />
      <v-card-text>
        <v-tabs
          v-model="activeTab"
          align-tabs="start"
          density="comfortable"
          class="mb-4"
        >
          <v-tab value="general">
            {{ t('roomExtensions.generalTab') }}
          </v-tab>
          <v-tab
            v-for="extension in assignedExtensions"
            :key="extension.id"
            :value="extension.id"
          >
            {{ extension.name }}
          </v-tab>
        </v-tabs>

        <v-window v-model="activeTab">
          <v-window-item value="general">
            <section>
              <v-alert
                v-if="!hasExtensions"
                type="info"
                variant="tonal"
                class="mb-4"
              >
                {{ t('roomExtensions.noExtensions') }}
              </v-alert>
              <template v-else>
                <p class="text-body-2 text-medium-emphasis mb-3">
                  {{ t('roomExtensions.instructions') }}
                </p>
                <div class="d-flex flex-wrap gap-3 mb-4">
                  <v-select
                    v-model="extensionToAdd"
                    :items="availableExtensions"
                    item-title="name"
                    item-value="id"
                    density="comfortable"
                    :label="t('roomExtensions.addLabel')"
                    variant="outlined"
                    :disabled="availableExtensions.length === 0"
                    style="min-width: 260px"
                  />
                  <v-btn
                    color="primary"
                    :disabled="!extensionToAdd || !room"
                    @click="assignExtension"
                  >
                    <v-icon icon="mdi-plus" start size="16" />
                    {{ t('roomExtensions.addButton') }}
                  </v-btn>
                </div>
                <v-alert
                  v-if="assignedExtensions.length === 0"
                  type="info"
                  variant="tonal"
                >
                  {{ t('roomExtensions.emptyAssigned') }}
                </v-alert>
                <div
                  v-else
                  class="d-flex flex-column gap-3"
                >
                  <v-card
                    v-for="extension in assignedExtensions"
                    :key="extension.id"
                    variant="outlined"
                  >
                    <v-card-title class="d-flex align-center justify-space-between">
                      <div>
                        <div class="text-subtitle-2">{{ extension.name }}</div>
                        <div class="text-caption text-medium-emphasis">
                          {{ t('roomExtensions.blocksCount', { count: extension.blocks.length }) }}
                        </div>
                      </div>
                      <div class="d-flex gap-2">
                        <v-btn
                          variant="text"
                          size="small"
                          @click="activeTab = extension.id"
                        >
                          {{ t('roomExtensions.openTab') }}
                        </v-btn>
                        <v-btn
                          icon="mdi-delete"
                          variant="text"
                          color="error"
                          size="small"
                          @click="removeExtension(extension.id)"
                        />
                      </div>
                    </v-card-title>
                  </v-card>
                </div>
              </template>
            </section>
          </v-window-item>

          <v-window-item
            v-for="extension in assignedExtensions"
            :key="extension.id"
            :value="extension.id"
          >
            <RoomBlocksExtensionTab
              v-if="room"
              :room="room"
              :extension="extension"
              :active="activeTab === extension.id"
            />
          </v-window-item>
        </v-window>
      </v-card-text>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import type { RoomDetails } from 'netlify/core/types/data.types';
import { useBlocksExtensionsStore } from 'core/stores/blocks-extensions.store';
import RoomBlocksExtensionTab from './RoomBlocksExtensionTab.component.vue';

const props = defineProps<{
  room: RoomDetails | null;
}>();

const open = defineModel<boolean>('open', { default: false });
const { t } = useI18n();
const store = useBlocksExtensionsStore();
store.initialize();

const activeTab = ref<string>('general');
const extensionToAdd = ref<string | null>(null);

const assignedExtensions = computed(() => store.getExtensionsForRoom(props.room?.id ?? null));
const assignedIds = computed(() => store.getRoomAssignmentIds(props.room?.id ?? null));
const availableExtensions = computed(() => store.extensions.filter((extension) => !assignedIds.value.includes(extension.id)));
const hasExtensions = computed(() => store.extensions.length > 0);

watch(open, (dialogOpen) => {
  if (dialogOpen) {
    activeTab.value = 'general';
  }
});

watch(
  () => props.room?.id,
  () => {
    extensionToAdd.value = null;
    activeTab.value = 'general';
  }
);

watch(
  () => assignedIds.value.join(','),
  () => {
    if (activeTab.value === 'general') return;
    if (!assignedIds.value.includes(activeTab.value)) {
      activeTab.value = assignedExtensions.value[0]?.id ?? 'general';
    }
  }
);

function assignExtension() {
  if (!props.room || !extensionToAdd.value) return;
  store.assignExtensionToRoom(props.room.id, extensionToAdd.value);
  activeTab.value = extensionToAdd.value;
  extensionToAdd.value = null;
}

function removeExtension(extensionId: string) {
  if (!props.room) return;
  store.removeExtensionFromRoom(props.room.id, extensionId);
  if (activeTab.value === extensionId) {
    activeTab.value = 'general';
  }
}
</script>
