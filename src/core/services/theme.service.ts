import { isAppTheme, normalizeTheme, type AppTheme } from 'netlify/core/types/theme.types';
import { appStorage } from 'core/services/app-storage.service';

type ThemeTarget = {
  change: (themeName: string) => void;
  global: {
    name: {
      value: string;
    };
  };
};

export function getStoredTheme(): AppTheme | null {
  if (typeof window === 'undefined') return null;

  const storedTheme = appStorage.getTheme();
  return isAppTheme(storedTheme) ? storedTheme : null;
}

export function detectPreferredTheme(): AppTheme {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return 'dark';
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function getInitialTheme(): AppTheme {
  return getStoredTheme() ?? detectPreferredTheme();
}

export function saveTheme(theme: AppTheme): void {
  if (typeof window === 'undefined') return;
  appStorage.setTheme(theme);
}

export function applyTheme(themeTarget: ThemeTarget, theme: AppTheme): void {
  themeTarget.change(theme);
}

export function getAppliedTheme(themeTarget: ThemeTarget): AppTheme {
  return normalizeTheme(themeTarget.global.name.value, getInitialTheme());
}
