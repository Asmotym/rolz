import { ref, watch } from 'vue';
import type { RoomDetails, RoomRollAward } from 'netlify/core/types/data.types';
import type { DiscordUser } from 'netlify/core/types/discord.types';
import { RoomsService } from 'core/services/rooms.service';

export const RoomRollAwardsManagerKey = Symbol('RoomRollAwardsManager');

export function useRoomRollAwardsManager(
  getRoom: () => RoomDetails | null,
  getCurrentUser: () => DiscordUser | null
) {
  const awards = ref<RoomRollAward[]>([]);
  const awardsEnabled = ref(false);
  const awardsLoading = ref(false);
  const awardsError = ref<string | null>(null);
  const awardsLoadedRoomId = ref<string | null>(null);
  const rollAwardsWindowSize = ref<number | null>(null);
  const toggleLoading = ref(false);
  const toggleError = ref<string | null>(null);
  const awardMutationLoading = ref(false);
  const awardMutationError = ref<string | null>(null);

  watch(
    () => getRoom()?.id,
    (roomId) => {
      resetState();
      if (roomId) {
        void ensureAwardsLoaded(true);
      }
    },
    { immediate: true }
  );

  async function ensureAwardsLoaded(force = false) {
    const room = getRoom();
    if (!room) return;
    if (!force && awardsLoadedRoomId.value === room.id) return;
    awardsLoading.value = true;
    awardsError.value = null;
    try {
      const { awards: roomAwards, enabled, windowSize } = await RoomsService.fetchRollAwards(room.id);
      awards.value = roomAwards;
      awardsEnabled.value = enabled;
      rollAwardsWindowSize.value = windowSize ?? null;
      awardsLoadedRoomId.value = room.id;
    } catch (error) {
      awardsError.value = error instanceof Error ? error.message : 'Unable to load Roll Awards';
    } finally {
      awardsLoading.value = false;
    }
  }

  async function setAwardsEnabled(enabled: boolean) {
    return updateAwardsSettings({ enabled });
  }

  async function setAwardsWindow(windowSize: number | null) {
    return updateAwardsSettings({ windowSize });
  }

  async function updateAwardsSettings(update: { enabled?: boolean; windowSize?: number | null }) {
    const room = getRoom();
    const user = getCurrentUser();
    if (!room || !user) {
      toggleError.value = 'Only the room creator can change this setting.';
      return false;
    }
    toggleLoading.value = true;
    toggleError.value = null;
    try {
      const result = await RoomsService.updateRollAwardsSettings({
        roomId: room.id,
        userId: user.id,
        enabled: typeof update.enabled === 'boolean' ? update.enabled : awardsEnabled.value,
        windowSize: update.windowSize === undefined ? rollAwardsWindowSize.value ?? null : update.windowSize,
      });
      awardsEnabled.value = result.enabled;
      rollAwardsWindowSize.value = result.windowSize ?? null;
      awardsLoadedRoomId.value = room.id;
      if (result.enabled) {
        await ensureAwardsLoaded(true);
      } else {
        awards.value = [];
      }
      return result.enabled;
    } catch (error) {
      toggleError.value = error instanceof Error ? error.message : 'Unable to update setting';
      return false;
    } finally {
      toggleLoading.value = false;
    }
  }

  async function createAward(name: string, diceResults: number[]) {
    const room = getRoom();
    const user = getCurrentUser();
    if (!room || !user) {
      awardMutationError.value = 'Sign in to manage awards.';
      return null;
    }
    awardMutationLoading.value = true;
    awardMutationError.value = null;
    try {
      const created = await RoomsService.createRollAward({
        roomId: room.id,
        userId: user.id,
        name,
        diceResults,
      });
      awards.value = [...awards.value, created];
      return created;
    } catch (error) {
      awardMutationError.value = error instanceof Error ? error.message : 'Unable to save award';
      return null;
    } finally {
      awardMutationLoading.value = false;
    }
  }

  async function deleteAward(awardId: string) {
    const room = getRoom();
    const user = getCurrentUser();
    if (!room || !user) {
      awardMutationError.value = 'Sign in to manage awards.';
      return false;
    }
    awardMutationLoading.value = true;
    awardMutationError.value = null;
    try {
      await RoomsService.deleteRollAward({ roomId: room.id, userId: user.id, awardId });
      awards.value = awards.value.filter((award) => award.id !== awardId);
      return true;
    } catch (error) {
      awardMutationError.value = error instanceof Error ? error.message : 'Unable to delete award';
      return false;
    } finally {
      awardMutationLoading.value = false;
    }
  }

  function resetState() {
    awards.value = [];
    awardsEnabled.value = false;
    awardsLoading.value = false;
    awardsError.value = null;
    awardsLoadedRoomId.value = null;
    rollAwardsWindowSize.value = null;
    toggleLoading.value = false;
    toggleError.value = null;
    awardMutationLoading.value = false;
    awardMutationError.value = null;
  }

  return {
    awards,
    awardsEnabled,
    rollAwardsWindowSize,
    awardsLoading,
    awardsError,
    toggleLoading,
    toggleError,
    awardMutationLoading,
    awardMutationError,
    ensureAwardsLoaded,
    setAwardsEnabled,
    setAwardsWindow,
    createAward,
    deleteAward,
  };
}

export type RoomRollAwardsManager = ReturnType<typeof useRoomRollAwardsManager>;
