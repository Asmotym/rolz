export interface DiceRoll {
  dice: string;
  result: number;
  rolls: number[];
  total: number;
  critical?: boolean;
  fumble?: boolean;
}

export interface DiceRollOptions {
  advantage?: boolean;
  disadvantage?: boolean;
  modifier?: number;
  criticalRange?: number;
  fumbleRange?: number;
}

/**
 * Rolls a single die of specified sides
 * @param sides - Number of sides on the die
 * @returns Random number between 1 and sides
 */
export function rollDie(sides: number): number {
  return Math.floor(Math.random() * sides) + 1;
}

/**
 * Rolls multiple dice of the same type
 * @param count - Number of dice to roll
 * @param sides - Number of sides on each die
 * @returns Array of individual roll results
 */
export function rollDice(count: number, sides: number): number[] {
  return Array.from({ length: count }, () => rollDie(sides));
}

/**
 * Parses dice notation (e.g., "2d6", "1d20", "3d8+2")
 * @param notation - Dice notation string
 * @returns Parsed dice parameters
 */
export function parseDiceNotation(notation: string): {
  count: number;
  sides: number;
  modifier: number;
} {
  const regex = /^(\d+)?d(\d+)([+-]\d+)?$/i;
  const match = notation.toLowerCase().match(regex);
  
  if (!match) {
    throw new Error(`Invalid dice notation: ${notation}`);
  }
  
  const count = parseInt(match[1] || '1');
  const sides = parseInt(match[2]);
  const modifier = parseInt(match[3] || '0');
  
  return { count, sides, modifier };
}

/**
 * Rolls dice based on standard RPG notation
 * @param notation - Dice notation (e.g., "2d6", "1d20+3", "3d8-1")
 * @param options - Additional rolling options
 * @returns Complete dice roll result
 */
export function rollDiceNotation(
  notation: string, 
  options: DiceRollOptions = {}
): DiceRoll {
  const { count, sides, modifier } = parseDiceNotation(notation);
  const rolls = rollDice(count, sides);
  const total = rolls.reduce((sum, roll) => sum + roll, 0) + (options.modifier || 0) + modifier;
  
  let critical = false;
  let fumble = false;
  
  // Handle critical hits and fumbles for d20 rolls
  if (sides === 20 && count === 1) {
    const criticalRange = options.criticalRange || 20;
    const fumbleRange = options.fumbleRange || 1;
    
    critical = rolls[0] >= criticalRange;
    fumble = rolls[0] <= fumbleRange;
  }
  
  return {
    dice: notation,
    result: total,
    rolls,
    total,
    critical,
    fumble
  };
}

/**
 * Rolls with advantage (roll 2d20, take highest)
 * @param modifier - Modifier to add to the result
 * @returns Dice roll result with advantage
 */
export function rollWithAdvantage(modifier: number = 0): DiceRoll {
  const rolls = rollDice(2, 20);
  const highest = Math.max(...rolls);
  const total = highest + modifier;
  
  return {
    dice: `2d20 (advantage)`,
    result: total,
    rolls,
    total,
    critical: highest === 20,
    fumble: highest === 1
  };
}

/**
 * Rolls with disadvantage (roll 2d20, take lowest)
 * @param modifier - Modifier to add to the result
 * @returns Dice roll result with disadvantage
 */
export function rollWithDisadvantage(modifier: number = 0): DiceRoll {
  const rolls = rollDice(2, 20);
  const lowest = Math.min(...rolls);
  const total = lowest + modifier;
  
  return {
    dice: `2d20 (disadvantage)`,
    result: total,
    rolls,
    total,
    critical: lowest === 20,
    fumble: lowest === 1
  };
}

/**
 * Common RPG dice presets
 */
export const COMMON_DICE = {
  d4: '1d4',
  d6: '1d6',
  d8: '1d8',
  d10: '1d10',
  d12: '1d12',
  d20: '1d20',
  d100: '1d100',
  '2d6': '2d6',
  '3d6': '3d6',
  '4d6': '4d6',
  '5d6': '5d6',
  '6d6': '6d6'
};

/**
 * Formats dice roll result for display
 * @param roll - Dice roll result
 * @returns Formatted string
 */
export function formatDiceRoll(roll: DiceRoll): string {
  let result = `${roll.dice}: `;
  
  if (roll.rolls.length === 1) {
    result += `${roll.total}`;
  } else {
    result += `[${roll.rolls.join(', ')}] = ${roll.total}`;
  }
  
  if (roll.critical) {
    result += ' 🎯 CRITICAL!';
  } else if (roll.fumble) {
    result += ' 💥 FUMBLE!';
  }
  
  return result;
}
