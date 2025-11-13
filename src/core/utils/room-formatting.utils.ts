export function formatDisplayName(
  username?: string | null,
  nickname?: string | null,
  fallback = 'Unknown Adventurer'
) {
  const hasUsername = typeof username === 'string' && username.trim().length > 0;
  const base = hasUsername ? (username as string).trim() : fallback;
  const hasNickname = typeof nickname === 'string' && nickname.trim().length > 0;
  if (hasNickname) {
    const nick = (nickname as string).trim();
    return `${nick} (${base})`;
  }
  return base;
}

export function formatTimestamp(value?: string | null) {
  if (!value) return 'Unknown date';
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(new Date(value));
  } catch {
    return value;
  }
}
