import { computed } from 'vue';
import { useTheme } from 'vuetify';
import { getAppliedTheme } from 'core/services/theme.service';

export function useExpansionPanelTheme() {
  const theme = useTheme();

  const expansionPanelColor = computed(() => (
    getAppliedTheme(theme) === 'dark'
      ? 'blue-grey-darken-4'
      : 'blue-grey-lighten-5'
  ));

  const expansionPanelBgColor = computed(() => (
    getAppliedTheme(theme) === 'dark'
      ? 'blue-grey-darken-3'
      : 'grey-lighten-5'
  ));

  return {
    expansionPanelColor,
    expansionPanelBgColor,
  };
}
