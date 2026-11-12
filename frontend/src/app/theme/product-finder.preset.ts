import { definePreset } from '@primeuix/themes';
import Aura from '@primeuix/themes/aura';

/**
 * Aura with a corporate dark-blue primary scale
 * (500 = #004a96). The values are design tokens: swap in the official
 * palette here and every PrimeNG component follows.
 */
export const ProductFinderPreset = definePreset(Aura, {
  semantic: {
    primary: {
      50: '#eef4fb',
      100: '#d4e3f3',
      200: '#a9c6e6',
      300: '#7aa5d6',
      400: '#3f7cbf',
      500: '#004a96',
      600: '#003f80',
      700: '#00346a',
      800: '#002a55',
      900: '#001f40',
      950: '#00152b',
    },
    focusRing: {
      width: '2px',
      style: 'solid',
      color: '#21a0d2',
      offset: '2px',
    },
  },
});
