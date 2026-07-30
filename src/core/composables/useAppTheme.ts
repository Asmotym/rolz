import { computed, watch } from 'vue';
import { useTheme } from 'vuetify';
import { useI18n } from 'vue-i18n';
import { DiscordService } from 'modules/discord-auth/services/discord.service';
import {
  applyTheme,
  getAppliedTheme,
  getInitialTheme,
  getStoredTheme,
  saveTheme,
} from 'core/services/theme.service';
import {
  fetchUserPreferences,
  saveUserPreferences,
} from 'core/services/preferences.service';
import type { AppTheme } from 'netlify/core/types/theme.types';

export function useAppTheme() {
  const vuetifyTheme = useTheme();
  const discordService = DiscordService.getInstance();
  const { t } = useI18n();

  const currentTheme = computed(() => getAppliedTheme(vuetifyTheme));
  const nextTheme = computed<AppTheme>(() => currentTheme.value === 'dark' ? 'light' : 'dark');
  const switchTitle = computed(() => (
    nextTheme.value === 'dark'
      ? t('theme.switchToDark')
      : t('theme.switchToLight')
  ));

  function setLocalTheme(theme: AppTheme): void {
    applyTheme(vuetifyTheme, theme);
    saveTheme(theme);
  }

  function initializeThemeSync(): void {
    applyTheme(vuetifyTheme, getInitialTheme());

    watch(
      () => [
        discordService.user.value?.id,
        discordService.user.value?.theme,
      ] as const,
      async ([userId, databaseTheme]) => {
        if (!userId) return;

        const localTheme = getStoredTheme();
        if (localTheme) {
          applyTheme(vuetifyTheme, localTheme);
          if (databaseTheme !== localTheme) {
            try {
              const saved = await saveUserPreferences(userId, { theme: localTheme });
              discordService.updateStoredUserPreferences({ theme: saved.theme });
            } catch (error) {
              console.error(t('theme.saveError'), error);
            }
          }
          return;
        }

        try {
          const databasePreferences = await fetchUserPreferences(userId);
          const latestLocalTheme = getStoredTheme();
          setLocalTheme(latestLocalTheme ?? databasePreferences.theme);
        } catch (error) {
          console.error(t('theme.saveError'), error);
        }
      },
      { immediate: true }
    );
  }

  async function setTheme(theme: AppTheme): Promise<void> {
    setLocalTheme(theme);

    const user = discordService.user.value;
    if (!user) return;

    try {
      const saved = await saveUserPreferences(user.id, { theme });
      discordService.updateStoredUserPreferences({ theme: saved.theme });
    } catch (error) {
      console.error(t('theme.saveError'), error);
    }
  }

  async function toggleTheme(): Promise<void> {
    await setTheme(nextTheme.value);
  }

  return {
    currentTheme,
    nextTheme,
    switchTitle,
    initializeThemeSync,
    setTheme,
    toggleTheme,
  };
}
