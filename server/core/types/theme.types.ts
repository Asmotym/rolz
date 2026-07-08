export const APP_THEMES = ['dark', 'light'] as const;

export type AppTheme = typeof APP_THEMES[number];

export function isAppTheme(value: unknown): value is AppTheme {
    return typeof value === 'string' && APP_THEMES.includes(value as AppTheme);
}

export function normalizeTheme(value: unknown, fallback: AppTheme = 'dark'): AppTheme {
    return isAppTheme(value) ? value : fallback;
}
