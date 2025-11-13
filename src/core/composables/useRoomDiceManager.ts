import { ref, watch } from 'vue';
import type { RoomDetails, RoomDice } from 'netlify/core/types/data.types';
import type { DiscordUser } from 'netlify/core/types/discord.types';
import { RoomsService } from 'core/services/rooms.service';
import { parseDiceNotation, rollDiceNotation, type DiceRoll } from 'core/utils/dice.utils';

export const RoomDiceManagerKey = Symbol('RoomDiceManager');

export function useRoomDiceManager(
  getRoom: () => RoomDetails | null,
  getCurrentUser: () => DiscordUser | null,
  onRoll: (roll: DiceRoll) => void
) {
  const customDices = ref<RoomDice[]>([]);
  const newDiceNotation = ref('');
  const newDiceDescription = ref('');
  const newDiceError = ref<string | null>(null);
  const editDiceNotation = ref('');
  const editDiceDescription = ref('');
  const editDiceError = ref<string | null>(null);
  const editingDiceId = ref<string | null>(null);
  const diceRollError = ref<string | null>(null);
  const roomDicesLoading = ref(false);
  const roomDicesError = ref<string | null>(null);
  const roomDicesLoadedKey = ref<string | null>(null);
  const diceMutationLoading = ref(false);
  const diceManagementError = ref<string | null>(null);

  watch(
    () => ({ roomId: getRoom()?.id, userId: getCurrentUser()?.id }),
    async ({ roomId, userId }) => {
      resetCustomDiceState();
      if (roomId && userId) {
        await ensureRoomDicesLoaded(true);
      }
    },
    { immediate: true }
  );

  async function ensureRoomDicesLoaded(force = false) {
    const room = getRoom();
    const currentUser = getCurrentUser();
    if (!room || !currentUser) return;
    const cacheKey = composeDiceCacheKey(room.id, currentUser.id);
    if (!force && roomDicesLoadedKey.value === cacheKey) return;
    roomDicesLoading.value = true;
    roomDicesError.value = null;
    try {
      const dices = await RoomsService.fetchRoomDices(room.id, currentUser.id);
      customDices.value = dices;
      roomDicesLoadedKey.value = cacheKey;
    } catch (error) {
      roomDicesError.value = error instanceof Error ? error.message : 'Unable to load room dice';
    } finally {
      roomDicesLoading.value = false;
    }
  }

  function resetCustomDiceState() {
    customDices.value = [];
    newDiceNotation.value = '';
    newDiceDescription.value = '';
    newDiceError.value = null;
    diceRollError.value = null;
    roomDicesLoadedKey.value = null;
    roomDicesError.value = null;
    roomDicesLoading.value = false;
    diceMutationLoading.value = false;
    diceManagementError.value = null;
    cancelEditingDice();
  }

  function rollCustomDice(dice: RoomDice) {
    diceRollError.value = null;
    try {
      const roll = rollDiceNotation(dice.notation, {}, dice.description ?? undefined);
      onRoll(roll);
    } catch (error) {
      diceRollError.value = error instanceof Error ? error.message : 'Unable to roll this dice.';
    }
  }

  function clearNewDiceForm() {
    newDiceNotation.value = '';
    newDiceDescription.value = '';
    newDiceError.value = null;
    diceManagementError.value = null;
  }

  async function addCustomDice() {
    const room = getRoom();
    const currentUser = getCurrentUser();
    if (!room || !currentUser) {
      newDiceError.value = 'You need to be in a room to add dice.';
      return;
    }
    const notation = newDiceNotation.value.trim().toLowerCase();
    const description = newDiceDescription.value.trim();
    if (!notation) {
      newDiceError.value = 'Dice notation is required.';
      return;
    }
    try {
      parseDiceNotation(notation);
    } catch {
      newDiceError.value = 'Enter a valid dice notation (e.g., 1d20+3).';
      return;
    }
    diceMutationLoading.value = true;
    diceManagementError.value = null;
    try {
      const created = await RoomsService.createRoomDice({
        roomId: room.id,
        userId: currentUser.id,
        notation,
        description: description || undefined,
      });
      customDices.value = [...customDices.value, created];
      roomDicesLoadedKey.value = composeDiceCacheKey(room.id, currentUser.id);
      clearNewDiceForm();
    } catch (error) {
      diceManagementError.value = error instanceof Error ? error.message : 'Unable to add dice.';
    } finally {
      diceMutationLoading.value = false;
    }
  }

  function startEditingDice(dice: RoomDice) {
    editingDiceId.value = dice.id;
    editDiceNotation.value = dice.notation;
    editDiceDescription.value = dice.description ?? '';
    editDiceError.value = null;
    diceManagementError.value = null;
  }

  function cancelEditingDice() {
    editingDiceId.value = null;
    editDiceNotation.value = '';
    editDiceDescription.value = '';
    editDiceError.value = null;
    diceManagementError.value = null;
  }

  async function saveEditingDice() {
    const room = getRoom();
    const currentUser = getCurrentUser();
    if (!editingDiceId.value || !room || !currentUser) return;
    const notation = editDiceNotation.value.trim().toLowerCase();
    const description = editDiceDescription.value.trim();
    if (!notation) {
      editDiceError.value = 'Dice notation is required.';
      return;
    }
    try {
      parseDiceNotation(notation);
    } catch {
      editDiceError.value = 'Enter a valid dice notation (e.g., 1d20+3).';
      return;
    }
    diceMutationLoading.value = true;
    diceManagementError.value = null;
    try {
      const updated = await RoomsService.updateRoomDice({
        roomId: room.id,
        userId: currentUser.id,
        diceId: editingDiceId.value,
        notation,
        description: description || undefined,
      });
      customDices.value = customDices.value.map((dice) => (dice.id === updated.id ? updated : dice));
      cancelEditingDice();
    } catch (error) {
      diceManagementError.value = error instanceof Error ? error.message : 'Unable to update dice.';
    } finally {
      diceMutationLoading.value = false;
    }
  }

  async function deleteCustomDice(id: string) {
    const room = getRoom();
    const currentUser = getCurrentUser();
    if (!room || !currentUser) return;
    if (typeof window !== 'undefined') {
      const confirmed = window.confirm('Delete this dice?');
      if (!confirmed) {
        return;
      }
    }
    diceMutationLoading.value = true;
    diceManagementError.value = null;
    try {
      await RoomsService.deleteRoomDice({
        roomId: room.id,
        userId: currentUser.id,
        diceId: id,
      });
      customDices.value = customDices.value.filter((dice) => dice.id !== id);
      if (editingDiceId.value === id) {
        cancelEditingDice();
      }
    } catch (error) {
      diceManagementError.value = error instanceof Error ? error.message : 'Unable to delete dice.';
    } finally {
      diceMutationLoading.value = false;
    }
  }

  function composeDiceCacheKey(roomId: string, userId: string) {
    return `${roomId}:${userId}`;
  }

  return {
    customDices,
    newDiceNotation,
    newDiceDescription,
    newDiceError,
    editDiceNotation,
    editDiceDescription,
    editDiceError,
    editingDiceId,
    diceRollError,
    roomDicesLoading,
    roomDicesError,
    diceMutationLoading,
    diceManagementError,
    ensureRoomDicesLoaded,
    rollCustomDice,
    clearNewDiceForm,
    addCustomDice,
    startEditingDice,
    cancelEditingDice,
    saveEditingDice,
    deleteCustomDice,
  };
}

export type RoomDiceManager = ReturnType<typeof useRoomDiceManager>;
