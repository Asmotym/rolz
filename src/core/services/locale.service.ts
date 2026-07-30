import { appStorage } from 'core/services/app-storage.service';
import {
  isAppLocale,
  type AppLocale,
} from 'netlify/core/types/locale.types';

export function getStoredLocale(): AppLocale | null {
  if (typeof window === 'undefined') return null;
  const locale = appStorage.getLocale();
  return isAppLocale(locale) ? locale : null;
}

export function detectPreferredLocale(): AppLocale {
  if (typeof navigator === 'undefined') return 'en';
  const browserLocale = navigator.language.split('-')[0];
  return isAppLocale(browserLocale) ? browserLocale : 'en';
}

export function getInitialLocale(): AppLocale {
  return getStoredLocale() ?? detectPreferredLocale();
}

export function saveLocale(locale: AppLocale): void {
  if (typeof window === 'undefined') return;
  appStorage.setLocale(locale);
}
