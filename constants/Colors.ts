const primary = '#22c55e';
const secondary = '#111827';
const tintColorLight = primary;
const tintColorDark = '#fff';

export default {
  light: {
    text: '#000',
    background: '#f8fafc',
    tint: tintColorLight,
    tabIconDefault: '#ccc',
    tabIconSelected: tintColorLight,
    primary,
    secondary,
    gray: {
      100: '#f1f5f9',
      200: '#e5e7eb',
      300: '#cbd5e1',
      400: '#94a3b8',
      500: '#64748b',
      600: '#475569',
      700: '#334155',
      800: '#1e293b',
      900: '#111827',
    },
  },
  dark: {
    text: '#fff',
    background: '#111827',
    tint: tintColorDark,
    tabIconDefault: '#ccc',
    tabIconSelected: tintColorDark,
    primary,
    secondary,
    gray: {
      100: '#f1f5f9',
      200: '#e5e7eb',
      300: '#cbd5e1',
      400: '#94a3b8',
      500: '#64748b',
      600: '#475569',
      700: '#334155',
      800: '#1e293b',
      900: '#111827',
    },
  },
};
