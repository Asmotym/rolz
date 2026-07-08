import { computed } from 'vue';
import { useTheme } from 'vuetify';
import { normalizeTheme } from 'netlify/core/types/theme.types';

export function useExpansionPanelTheme() {
  const theme = useTheme();

  const expansionPanelColor = computed(() => (
    normalizeTheme(theme.global.name.value) === 'dark'
      ? 'blue-grey-darken-4'
      : 'blue-grey-lighten-5'
  ));

  const expansionPanelBgColor = computed(() => (
    normalizeTheme(theme.global.name.value) === 'dark'
      ? 'blue-grey-darken-3'
      : 'grey-lighten-5'
  ));

  return {
    expansionPanelColor,
    expansionPanelBgColor,
  };
}
