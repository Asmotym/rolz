import { getApiUrl } from 'modules/discord-auth/utils/urls.utils';
import { isAppTheme, normalizeTheme, type AppTheme } from 'netlify/core/types/theme.types';
import { appStorage } from 'core/services/app-storage.service';

interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: string;
}

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

export async function fetchUserTheme(userId: string): Promise<AppTheme> {
  const response = await fetch(getApiUrl(`/users/${userId}/preferences`), {
    method: 'GET',
  });

  const payload = (await response.json()) as ApiResponse<{ theme: AppTheme }>;
  if (!response.ok || !payload.success) {
    throw new Error(payload.error || 'Unable to load theme preference.');
  }

  return normalizeTheme(payload.data.theme);
}

export async function saveUserTheme(userId: string, theme: AppTheme): Promise<AppTheme> {
  const response = await fetch(getApiUrl(`/users/${userId}/preferences`), {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ theme }),
  });

  const payload = (await response.json()) as ApiResponse<{ theme: AppTheme }>;
  if (!response.ok || !payload.success) {
    throw new Error(payload.error || 'Unable to save theme preference.');
  }

  return normalizeTheme(payload.data.theme);
}
