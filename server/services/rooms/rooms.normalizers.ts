import type { RoomCriticalRule } from '../../core/types/data.types';
import {
    DEFAULT_DICE_LIMIT,
    DICE_CATEGORY_NAME_MAX_LENGTH,
    DICE_DESCRIPTION_MAX_LENGTH,
    DICE_NOTATION_MAX_LENGTH,
    DICE_NOTATION_REGEX,
    MAX_DICE_LIMIT,
    ROLL_AWARD_DESCRIPTION_MAX_LENGTH,
    ROLL_AWARD_DICE_NOTATION_REGEX,
    ROLL_AWARD_MAX_DICE_NOTATIONS,
    ROLL_AWARD_MAX_RESULTS,
    ROLL_AWARD_NAME_MAX_LENGTH,
    ROLL_AWARD_RESULT_MAX,
    ROLL_AWARD_RESULT_MIN,
    ROLL_AWARD_WINDOW_OPTIONS,
    ROOM_CRITICAL_HEX_COLOR_REGEX,
    ROOM_CRITICAL_INT_MAX,
    ROOM_CRITICAL_INT_MIN,
    ROOM_CRITICALS_MAX_ITEMS
} from './rooms.constants';

export function sanitizeDiceLimit(limit?: number): number {
    const parsed = Number(limit);
    if (!Number.isFinite(parsed)) return DEFAULT_DICE_LIMIT;
    return Math.min(Math.max(Math.floor(parsed), 1), MAX_DICE_LIMIT);
}

export function normalizeDiceNotation(value: string): string {
    const trimmed = value?.trim().toLowerCase();
    if (!trimmed) {
        throw new Error('Dice notation is required');
    }
    if (trimmed.length > DICE_NOTATION_MAX_LENGTH) {
        throw new Error(`Dice notation is too long (max ${DICE_NOTATION_MAX_LENGTH} characters)`);
    }
    if (!DICE_NOTATION_REGEX.test(trimmed)) {
        throw new Error('Invalid dice notation');
    }
    const match = trimmed.match(DICE_NOTATION_REGEX);
    const count = Number.parseInt(match?.[2] ?? '1', 10);
    if ((match?.[1] === '+' || match?.[1] === '-') && count <= 1) {
        throw new Error('Advantage and disadvantage require rolling more than one die');
    }
    return trimmed;
}

export function normalizeDiceDescription(value?: string | null): string | null {
    const trimmed = value?.trim() ?? '';
    if (!trimmed) return null;
    if (trimmed.length > DICE_DESCRIPTION_MAX_LENGTH) {
        throw new Error(`Description is too long (max ${DICE_DESCRIPTION_MAX_LENGTH} characters)`);
    }
    return trimmed;
}

export function normalizeDiceCategoryName(value: string): string {
    const trimmed = value?.trim() ?? '';
    if (!trimmed) {
        throw new Error('Category name is required');
    }
    if (trimmed.length > DICE_CATEGORY_NAME_MAX_LENGTH) {
        throw new Error(`Category name is too long (max ${DICE_CATEGORY_NAME_MAX_LENGTH} characters)`);
    }
    return trimmed;
}

export function normalizeRollAwardName(value: string): string {
    const trimmed = value?.trim() ?? '';
    if (!trimmed) {
        throw new Error('Award name is required');
    }
    if (trimmed.length > ROLL_AWARD_NAME_MAX_LENGTH) {
        throw new Error(`Award name is too long (max ${ROLL_AWARD_NAME_MAX_LENGTH} characters)`);
    }
    return trimmed;
}

export function normalizeRollAwardDescription(value?: string | null): string | null {
    const trimmed = value?.trim() ?? '';
    if (!trimmed) return null;
    if (trimmed.length > ROLL_AWARD_DESCRIPTION_MAX_LENGTH) {
        throw new Error(`Description is too long (max ${ROLL_AWARD_DESCRIPTION_MAX_LENGTH} characters)`);
    }
    return trimmed;
}

export function normalizeRollAwardDiceNotations(value?: string | string[] | null): string[] {
    const source = Array.isArray(value) ? value : typeof value === 'string' ? value.split(/[,\s]+/) : [];
    const cleaned = source.map((entry) => entry.trim()).filter(Boolean);
    if (!cleaned.length) {
        return [];
    }
    const normalized = new Set<string>();
    for (const entry of cleaned) {
        if (entry.length > DICE_NOTATION_MAX_LENGTH) {
            throw new Error(`Dice notation filter is too long (max ${DICE_NOTATION_MAX_LENGTH} characters)`);
        }
        const match = entry.match(ROLL_AWARD_DICE_NOTATION_REGEX);
        if (!match) {
            throw new Error('Dice notation filter must look like d20 or d100');
        }
        normalized.add(`d${match[1]}`.toLowerCase());
        if (normalized.size > ROLL_AWARD_MAX_DICE_NOTATIONS) {
            throw new Error(`You can only specify up to ${ROLL_AWARD_MAX_DICE_NOTATIONS} dice notations.`);
        }
    }
    return Array.from(normalized);
}

export function serializeRollAwardDiceNotations(notations: string[]): string | null {
    if (!notations.length) {
        return null;
    }
    const serialized = notations.join(',');
    if (serialized.length > DICE_NOTATION_MAX_LENGTH) {
        throw new Error(`Dice notation filter is too long (max ${DICE_NOTATION_MAX_LENGTH} characters combined).`);
    }
    return serialized;
}

export function normalizeRollAwardResults(values: number[]): number[] {
    if (!Array.isArray(values) || values.length === 0) {
        throw new Error('Add at least one dice result');
    }
    if (values.length > ROLL_AWARD_MAX_RESULTS) {
        throw new Error(`Awards can only track up to ${ROLL_AWARD_MAX_RESULTS} results`);
    }
    const sanitized = values
        .map((value) => Number(value))
        .filter((value) => Number.isFinite(value))
        .map((value) => Math.floor(value));
    const filtered = sanitized.filter((value) => value >= ROLL_AWARD_RESULT_MIN && value <= ROLL_AWARD_RESULT_MAX);
    if (!filtered.length) {
        throw new Error(`Dice results must be between ${ROLL_AWARD_RESULT_MIN} and ${ROLL_AWARD_RESULT_MAX}`);
    }
    return Array.from(new Set(filtered));
}

export function normalizeRollAwardWindowSize(value?: number | null): number | null {
    if (value === null || value === undefined) {
        return null;
    }
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
        return null;
    }
    const normalized = Math.floor(parsed);
    return ROLL_AWARD_WINDOW_OPTIONS.includes(normalized) ? normalized : null;
}

export function normalizeRoomCriticals(values: RoomCriticalRule[]): RoomCriticalRule[] {
    if (!Array.isArray(values)) {
        throw new Error('Criticals must be provided as a list.');
    }
    if (values.length > ROOM_CRITICALS_MAX_ITEMS) {
        throw new Error(`You can only save up to ${ROOM_CRITICALS_MAX_ITEMS} critical rules.`);
    }

    const normalized: RoomCriticalRule[] = [];
    const seen = new Set<string>();

    for (const value of values) {
        if (!value || typeof value !== 'object') {
            throw new Error('Each critical rule must be a valid object.');
        }
        const threshold = normalizeRoomCriticalThreshold(value.threshold);
        const operator = normalizeRoomCriticalOperator(value.operator);
        const color = normalizeRoomCriticalColor(value.color);
        const dedupeKey = `${operator}:${threshold}`;
        if (seen.has(dedupeKey)) {
            throw new Error('Critical rules must use unique threshold and comparison pairs.');
        }
        seen.add(dedupeKey);
        normalized.push({ threshold, operator, color });
    }

    return normalized;
}

export function normalizeRoomCriticalThreshold(value: number): number {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) {
        throw new Error('Critical thresholds must be whole numbers.');
    }
    if (parsed < ROOM_CRITICAL_INT_MIN || parsed > ROOM_CRITICAL_INT_MAX) {
        throw new Error('Critical thresholds are out of range.');
    }
    return parsed;
}

export function normalizeRoomCriticalOperator(value: string): RoomCriticalRule['operator'] {
    if (
        value === 'moreThan' ||
        value === 'lessThan'
    ) {
        return value;
    }
    throw new Error('Critical comparison must be one of "moreThan" or "lessThan".');
}

export function normalizeRoomCriticalColor(value: string): string {
    const trimmed = value?.trim() ?? '';
    if (!ROOM_CRITICAL_HEX_COLOR_REGEX.test(trimmed)) {
        throw new Error('Critical colors must be valid hex colors.');
    }
    const normalized = trimmed.toLowerCase();
    if (normalized.length === 4) {
        return `#${normalized[1]}${normalized[1]}${normalized[2]}${normalized[2]}${normalized[3]}${normalized[3]}`;
    }
    return normalized;
}
