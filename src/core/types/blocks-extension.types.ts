import type { RoomDetails } from 'netlify/core/types/data.types';

export type BlockActionType = 'getAllRolls' | 'getRollsFromDate' | 'getRoomInfo' | 'getRollsPerPlayer';

export interface BlocksExtensionVariable {
  id: string;
  key: string;
  value: string;
}

interface BaseBlock {
  id: string;
  name: string;
  description?: string;
  jsCallback?: string;
}

export interface GetAllRollsBlock extends BaseBlock {
  type: 'getAllRolls';
  options: {
    limit?: number | null;
  };
}

export interface GetRollsPerPlayerBlock extends BaseBlock {
  type: 'getRollsPerPlayer';
  options: {
    limit?: number | null;
  };
}

export interface GetRollsFromDateBlock extends BaseBlock {
  type: 'getRollsFromDate';
  options: {
    since: string;
    limit?: number | null;
  };
}

export interface GetRoomInfoBlock extends BaseBlock {
  type: 'getRoomInfo';
  options: Record<string, never>;
}

export type BlocksExtensionBlock = GetAllRollsBlock | GetRollsPerPlayerBlock | GetRollsFromDateBlock | GetRoomInfoBlock;

export interface BlocksExtension {
  id: string;
  name: string;
  description?: string;
  variables: BlocksExtensionVariable[];
  blocks: BlocksExtensionBlock[];
  createdAt: string;
  updatedAt: string;
}

export interface BlocksExtensionExecution {
  blockId: string;
  blockName: string;
  type: BlockActionType;
  response: unknown;
  transformed?: unknown;
  error?: string;
  startedAt: string;
  finishedAt?: string;
}

export interface BlockExecutionContext {
  room: RoomDetails;
  extension: BlocksExtension;
  block: BlocksExtensionBlock;
  variables: Record<string, string>;
  response: unknown;
  previousResponses: Record<string, unknown>;
}

export interface BlockActionDefinition {
  type: BlockActionType;
  label: string;
  description: string;
  icon: string;
}

export const BLOCK_ACTION_DEFINITIONS: Record<BlockActionType, BlockActionDefinition> = {
  getAllRolls: {
    type: 'getAllRolls',
    label: 'Get all rolls',
    description: 'Fetches every dice roll visible in the current room.',
    icon: 'mdi-dice-multiple-outline',
  },
  getRollsPerPlayer: {
    type: 'getRollsPerPlayer',
    label: 'Get rolls per player',
    description: 'Fetches dice rolls and groups them by player.',
    icon: 'mdi-account-multiple',
  },
  getRollsFromDate: {
    type: 'getRollsFromDate',
    label: 'Get rolls from a date',
    description: 'Fetches dice rolls newer than the provided timestamp.',
    icon: 'mdi-calendar-clock',
  },
  getRoomInfo: {
    type: 'getRoomInfo',
    label: 'Get room information',
    description: 'Returns the current room metadata available to you.',
    icon: 'mdi-information-outline',
  },
};

export function createBlocksExtension(partial?: Partial<BlocksExtension>): BlocksExtension {
  const now = new Date().toISOString();
  return {
    id: partial?.id ?? generateId('ext'),
    name: partial?.name ?? 'Untitled extension',
    description: partial?.description,
    variables: partial?.variables
      ? partial.variables.map((variable) => ({ ...variable }))
      : [],
    blocks: partial?.blocks
      ? partial.blocks.map((block) => cloneBlock(block))
      : [],
    createdAt: partial?.createdAt ?? now,
    updatedAt: partial?.updatedAt ?? now,
  };
}

export function createBlock(type: BlockActionType, partial?: Partial<BlocksExtensionBlock>): BlocksExtensionBlock {
  const base = {
    id: partial?.id ?? generateId('blk'),
    name: partial?.name ?? BLOCK_ACTION_DEFINITIONS[type].label,
    description: partial?.description,
    jsCallback: partial?.jsCallback,
  };

  if (type === 'getAllRolls') {
    const providedOptions = partial && 'options' in partial ? (partial.options as GetAllRollsBlock['options']) : undefined;
    const limitValue = providedOptions?.limit;
    const limit = typeof limitValue === 'number' && Number.isFinite(limitValue) ? limitValue : null;
    return {
      ...base,
      type,
      options: {
        limit,
      },
    } as GetAllRollsBlock;
  }

  if (type === 'getRollsFromDate') {
    const options = partial && 'options' in partial ? (partial.options as GetRollsFromDateBlock['options']) : undefined;
    const limitValue = options?.limit;
    const limit = typeof limitValue === 'number' && Number.isFinite(limitValue) ? limitValue : null;
    return {
      ...base,
      type,
      options: {
        since: options?.since ?? new Date().toISOString(),
        limit,
      },
    } as GetRollsFromDateBlock;
  }

  if (type === 'getRollsPerPlayer') {
    const providedOptions = partial && 'options' in partial ? (partial.options as GetRollsPerPlayerBlock['options']) : undefined;
    const limitValue = providedOptions?.limit;
    const limit = typeof limitValue === 'number' && Number.isFinite(limitValue) ? limitValue : null;
    return {
      ...base,
      type,
      options: {
        limit,
      },
    } as GetRollsPerPlayerBlock;
  }

  return {
    ...base,
    type: 'getRoomInfo',
    options: {},
  } as GetRoomInfoBlock;
}

function generateId(prefix: string): string {
  const random = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);
  return `${prefix}_${random}`;
}

export function createVariable(partial?: Partial<BlocksExtensionVariable>): BlocksExtensionVariable {
  return {
    id: partial?.id ?? generateId('var'),
    key: partial?.key ?? '',
    value: partial?.value ?? '',
  };
}

export function cloneBlock(block: BlocksExtensionBlock): BlocksExtensionBlock {
  if (block.type === 'getAllRolls') {
    const options = block.options as GetAllRollsBlock['options'];
    const limit = typeof options.limit === 'number' && Number.isFinite(options.limit) ? options.limit : null;
    return {
      ...block,
      options: {
        limit,
      },
    };
  }

  if (block.type === 'getRollsPerPlayer') {
    const options = block.options as GetRollsPerPlayerBlock['options'];
    const limit = typeof options.limit === 'number' && Number.isFinite(options.limit) ? options.limit : null;
    return {
      ...block,
      options: {
        limit,
      },
    };
  }

  if (block.type === 'getRollsFromDate') {
    const options = block.options as GetRollsFromDateBlock['options'];
    const limit = typeof options.limit === 'number' && Number.isFinite(options.limit) ? options.limit : null;
    return {
      ...block,
      options: {
        since: options.since,
        limit,
      },
    };
  }

  return {
    ...block,
    options: {},
  };
}

export function cloneExtension(extension: BlocksExtension): BlocksExtension {
  return createBlocksExtension(extension);
}
