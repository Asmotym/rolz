import { defineStore } from 'pinia';
import {
  type BlockActionType,
  type BlocksExtension,
  type BlocksExtensionBlock,
  createBlock,
  createBlocksExtension,
  createVariable,
  cloneExtension,
  cloneBlock,
} from 'core/types/blocks-extension.types';

interface PersistedBlocksExtensionsState {
  extensions: BlocksExtension[];
  roomAssignments: Record<string, string[]>;
}

const STORAGE_KEY = 'rolz_blocks_extensions';

function safeParseState(value: string | null): PersistedBlocksExtensionsState | null {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as PersistedBlocksExtensionsState;
    if (!parsed || typeof parsed !== 'object') {
      return null;
    }
    return {
      extensions: Array.isArray(parsed.extensions) ? parsed.extensions.map((extension) => createBlocksExtension(extension)) : [],
      roomAssignments: typeof parsed.roomAssignments === 'object' && parsed.roomAssignments !== null
        ? parsed.roomAssignments
        : {},
    };
  } catch {
    return null;
  }
}

function writeState(value: PersistedBlocksExtensionsState) {
  if (typeof window === 'undefined') {
    return;
  }
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
}

function readState(): PersistedBlocksExtensionsState | null {
  if (typeof window === 'undefined') {
    return null;
  }
  return safeParseState(window.localStorage.getItem(STORAGE_KEY));
}

export const useBlocksExtensionsStore = defineStore('blocksExtensions', {
  state: () => ({
    initialized: false,
    extensions: [] as BlocksExtension[],
    roomAssignments: {} as Record<string, string[]>,
  }),
  getters: {
    getExtensionById: (state) => (id: string | null | undefined) => {
      if (!id) return null;
      return state.extensions.find((extension) => extension.id === id) ?? null;
    },
    getExtensionsForRoom: (state) => (roomId: string | null | undefined) => {
      if (!roomId) return [];
      const assignedIds = state.roomAssignments[roomId] ?? [];
      return assignedIds
        .map((extensionId) => state.extensions.find((extension) => extension.id === extensionId) ?? null)
        .filter((extension): extension is BlocksExtension => Boolean(extension));
    },
    getRoomAssignmentIds: (state) => (roomId: string | null | undefined) => {
      if (!roomId) return [];
      return state.roomAssignments[roomId] ?? [];
    },
  },
  actions: {
    initialize() {
      if (this.initialized) return;
      const stored = readState();
      if (stored) {
        this.extensions = stored.extensions;
        this.roomAssignments = stored.roomAssignments;
      }
      this.initialized = true;
    },
    persist() {
      if (typeof window === 'undefined') return;
      const payload: PersistedBlocksExtensionsState = {
        extensions: this.extensions.map((extension) => cloneExtension(extension)),
        roomAssignments: { ...this.roomAssignments },
      };
      writeState(payload);
    },
    createExtension(payload: { name?: string; description?: string | null }) {
      const extension = createBlocksExtension({
        name: payload.name?.trim() || 'Untitled extension',
        description: payload.description?.trim() || undefined,
      });
      this.extensions.push(extension);
      this.persist();
      return extension;
    },
    saveExtension(payload: BlocksExtension) {
      const sanitized = createBlocksExtension({
        ...payload,
        name: payload.name.trim() || 'Untitled extension',
        description: payload.description?.trim() || undefined,
        variables: payload.variables.map((variable) =>
          createVariable({
            id: variable.id,
            key: variable.key.trim(),
            value: variable.value,
          })
        ),
        blocks: payload.blocks.map((block) => cloneBlock(block)),
        createdAt: payload.createdAt,
        updatedAt: new Date().toISOString(),
      });

      const index = this.extensions.findIndex((extension) => extension.id === payload.id);
      if (index === -1) {
        this.extensions.push(sanitized);
      } else {
        this.extensions.splice(index, 1, sanitized);
      }
      this.persist();
      return sanitized;
    },
    deleteExtension(extensionId: string) {
      this.extensions = this.extensions.filter((extension) => extension.id !== extensionId);
      for (const roomId of Object.keys(this.roomAssignments)) {
        this.roomAssignments[roomId] = (this.roomAssignments[roomId] ?? []).filter((id) => id !== extensionId);
        if (this.roomAssignments[roomId].length === 0) {
          delete this.roomAssignments[roomId];
        }
      }
      this.persist();
    },
    addBlock(extensionId: string, type: BlockActionType) {
      const extension = this.extensions.find((item) => item.id === extensionId);
      if (!extension) return;
      extension.blocks.push(createBlock(type));
      extension.updatedAt = new Date().toISOString();
      this.persist();
    },
    updateBlock(extensionId: string, blockId: string, updates: Partial<BlocksExtensionBlock>) {
      const extension = this.extensions.find((item) => item.id === extensionId);
      if (!extension) return;
      const index = extension.blocks.findIndex((block) => block.id === blockId);
      if (index === -1) return;
      const block = extension.blocks[index];
      const nextOptions =
        updates &&
        'options' in updates &&
        updates.options &&
        typeof updates.options === 'object'
          ? { ...block.options, ...(updates.options as BlocksExtensionBlock['options']) }
          : block.options;
      const updatedBlock = {
        ...block,
        ...updates,
        options: nextOptions,
      } as BlocksExtensionBlock;
      extension.blocks.splice(index, 1, updatedBlock);
      extension.updatedAt = new Date().toISOString();
      this.persist();
    },
    removeBlock(extensionId: string, blockId: string) {
      const extension = this.extensions.find((item) => item.id === extensionId);
      if (!extension) return;
      extension.blocks = extension.blocks.filter((block) => block.id !== blockId);
      extension.updatedAt = new Date().toISOString();
      this.persist();
    },
    addVariable(extensionId: string) {
      const extension = this.extensions.find((item) => item.id === extensionId);
      if (!extension) return;
      extension.variables.push(createVariable());
      extension.updatedAt = new Date().toISOString();
      this.persist();
    },
    updateVariable(extensionId: string, variableId: string, updates: Partial<{ key: string; value: string }>) {
      const extension = this.extensions.find((item) => item.id === extensionId);
      if (!extension) return;
      const index = extension.variables.findIndex((variable) => variable.id === variableId);
      if (index === -1) return;
      const variable = extension.variables[index];
      extension.variables.splice(index, 1, {
        ...variable,
        key: updates.key ?? variable.key,
        value: updates.value ?? variable.value,
      });
      extension.updatedAt = new Date().toISOString();
      this.persist();
    },
    removeVariable(extensionId: string, variableId: string) {
      const extension = this.extensions.find((item) => item.id === extensionId);
      if (!extension) return;
      extension.variables = extension.variables.filter((variable) => variable.id !== variableId);
      extension.updatedAt = new Date().toISOString();
      this.persist();
    },
    assignExtensionToRoom(roomId: string, extensionId: string) {
      if (!roomId) return;
      const extension = this.extensions.find((item) => item.id === extensionId);
      if (!extension) return;
      const assignments = this.roomAssignments[roomId] ?? [];
      if (!assignments.includes(extensionId)) {
        this.roomAssignments[roomId] = [...assignments, extensionId];
      }
      this.persist();
    },
    removeExtensionFromRoom(roomId: string, extensionId: string) {
      if (!roomId) return;
      const assignments = this.roomAssignments[roomId] ?? [];
      this.roomAssignments[roomId] = assignments.filter((id) => id !== extensionId);
      if (this.roomAssignments[roomId].length === 0) {
        delete this.roomAssignments[roomId];
      }
      this.persist();
    },
    reorderBlocks(extensionId: string, orderedIds: string[]) {
      const extension = this.extensions.find((item) => item.id === extensionId);
      if (!extension) return;
      const map = new Map(extension.blocks.map((block) => [block.id, block]));
      const ordered: BlocksExtensionBlock[] = [];
      for (const id of orderedIds) {
        const block = map.get(id);
        if (block) {
          ordered.push(block);
          map.delete(id);
        }
      }
      for (const leftover of map.values()) {
        ordered.push(leftover);
      }
      extension.blocks = ordered;
      extension.updatedAt = new Date().toISOString();
      this.persist();
    },
  },
});
