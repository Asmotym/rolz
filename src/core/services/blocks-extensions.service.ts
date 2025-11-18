import type { RoomDetails, RoomMessage } from 'netlify/core/types/data.types';
import { getApiUrl } from 'modules/discord-auth/utils/urls.utils';
import type {
  BlockExecutionContext,
  BlocksExtension,
  BlocksExtensionBlock,
} from 'core/types/blocks-extension.types';

interface DiceRollsApiResponse {
  success: boolean;
  data?: {
    roomId: string;
    diceRolls: RoomMessage[];
  };
  error?: string;
}

export interface ExecuteBlockResult {
  blockId: string;
  blockName: string;
  type: BlocksExtensionBlock['type'];
  response: unknown;
  transformed?: unknown;
}

export class BlocksExtensionsService {
  static extensionVariablesToRecord(extension: BlocksExtension): Record<string, string> {
    return extension.variables.reduce<Record<string, string>>((acc, variable) => {
      if (variable.key) {
        acc[variable.key] = variable.value;
      }
      return acc;
    }, {});
  }

  static async executeBlock(options: {
    block: BlocksExtensionBlock;
    room: RoomDetails;
    extension: BlocksExtension;
    previousResponses: Record<string, unknown>;
  }): Promise<ExecuteBlockResult> {
    const { block, room, extension, previousResponses } = options;
    const response = await runBlockAction(block, room);

    const context: BlockExecutionContext = {
      room,
      extension,
      block,
      variables: BlocksExtensionsService.extensionVariablesToRecord(extension),
      response,
      previousResponses,
    };

    let transformed: unknown;
    if (block.jsCallback?.trim()) {
      transformed = runJsCallback(block.jsCallback, context);
    }

    return {
      blockId: block.id,
      blockName: block.name,
      type: block.type,
      response,
      transformed,
    };
  }
}

async function runBlockAction(block: BlocksExtensionBlock, room: RoomDetails): Promise<unknown> {
  switch (block.type) {
    case 'getAllRolls':
      return fetchDiceRolls(room.id, {
        limit: block.options.limit ?? undefined,
      });
    case 'getRollsPerPlayer': {
      const rolls = await fetchDiceRolls(room.id, {
        limit: block.options.limit ?? undefined,
      });
      return aggregateRollsByPlayer(rolls);
    }
    case 'getRollsFromDate':
      return fetchDiceRolls(room.id, {
        since: block.options.since,
        limit: block.options.limit ?? undefined,
      });
    case 'getRoomInfo':
      return room;
    default:
      throw new Error(`Unknown block type: ${(block as BlocksExtensionBlock).type}`);
  }
}

function runJsCallback(code: string, context: BlockExecutionContext): unknown {
  try {
    const runner = new Function('context', code) as (context: BlockExecutionContext) => unknown;
    return runner(context);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error in callback';
    throw new Error(`JS callback failed: ${message}`);
  }
}

async function fetchDiceRolls(roomId: string, params?: { limit?: number; since?: string }): Promise<RoomMessage[]> {
  const endpoint = new URL(getApiUrl(`/rooms/${roomId}/dice-rolls`));
  if (params?.limit) {
    endpoint.searchParams.set('limit', String(params.limit));
  }
  if (params?.since) {
    endpoint.searchParams.set('since', params.since);
  }

  const response = await fetch(endpoint.toString(), {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
    credentials: 'include',
  });

  const text = await response.text();
  const payload = parseJson<DiceRollsApiResponse>(text);

  if (!response.ok) {
    const message = payload?.error ?? (text.trim() || `Request failed with status ${response.status}`);
    throw new Error(message);
  }

  if (!payload || !payload.success) {
    throw new Error(payload?.error ?? 'Unable to load dice rolls');
  }

  return payload.data?.diceRolls ?? [];
}

function parseJson<T>(value: string): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function aggregateRollsByPlayer(rolls: RoomMessage[]) {
  const map = new Map<string, { userId: string | null; username?: string; nickname?: string; avatar?: string; rolls: RoomMessage[] }>();
  for (const roll of rolls) {
    const key = roll.userId ?? `anonymous-${roll.username ?? 'unknown'}`;
    if (!map.has(key)) {
      map.set(key, {
        userId: roll.userId ?? null,
        username: roll.username,
        nickname: roll.nickname,
        avatar: roll.avatar,
        rolls: [],
      });
    }
    map.get(key)!.rolls.push(roll);
  }
  return Array.from(map.values());
}
