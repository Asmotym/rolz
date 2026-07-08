import { computed, watch } from 'vue';
import { useTheme } from 'vuetify';
import { useI18n } from 'vue-i18n';
import { DiscordService } from 'modules/discord-auth/services/discord.service';
import {
  applyTheme,
  getAppliedTheme,
  getInitialTheme,
  saveTheme,
  saveUserTheme,
} from 'core/services/theme.service';
import { normalizeTheme, type AppTheme } from 'netlify/core/types/theme.types';

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
    setLocalTheme(getInitialTheme());

    watch(
      () => discordService.user.value?.theme,
      (theme) => {
        if (!theme) return;
        setLocalTheme(normalizeTheme(theme));
      },
      { immediate: true }
    );
  }

  async function setTheme(theme: AppTheme): Promise<void> {
    setLocalTheme(theme);

    const user = discordService.user.value;
    if (!user) return;

    try {
      const savedTheme = await saveUserTheme(user.id, theme);
      discordService.updateStoredUserTheme(savedTheme);
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
