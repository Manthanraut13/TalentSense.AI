import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        base: '#0F0F0F',
        surface: '#1A1A1A',
        elevated: '#242424',
        line: '#2E2E2E',
        primary: {
          DEFAULT: '#10B981',
          hover: '#059669',
          subtle: 'rgba(16,185,129,0.12)',
        },
        secondary: {
          DEFAULT: '#F59E0B',
          subtle: 'rgba(245,158,11,0.12)',
        },
        textPrimary: '#F5F5F5',
        textSecondary: '#A3A3A3',
        textMuted: '#525252',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
    },
  },
  plugins: [],
} satisfies Config;
