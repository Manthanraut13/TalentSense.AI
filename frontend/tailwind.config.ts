import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        base: '#F5FAF9',
        surface: '#FFFFFF',
        elevated: '#E9EFEE',
        line: '#BCC9C8',
        containerLow: '#EFF5F3',
        containerHigh: '#E4E9E8',
        containerHighest: '#DEE4E2',
        surfaceVariant: '#DEE4E2',
        outlineVariant: '#BCC9C8',
        primary: {
          DEFAULT: '#0EA5A0',
          hover: '#0B8A86',
          subtle: 'rgba(14,165,160,0.10)',
        },
        secondary: {
          DEFAULT: '#F97316',
          subtle: 'rgba(249,115,22,0.10)',
        },
        tertiary: '#974822',
        error: '#BA1A1A',
        textPrimary: '#171D1C',
        textSecondary: '#3D4948',
        textMuted: '#6D7A78',
      },
      fontFamily: {
        sans: ['"Product Sans"', 'Lexend', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'Fira Code', 'monospace'],
      },
      boxShadow: {
        card: '0 2px 4px rgba(15, 23, 42, 0.04)',
        cardHover: '0 4px 12px rgba(15, 23, 42, 0.08)',
        cardLg: '0 12px 24px rgba(71, 85, 105, 0.12)',
      },
    },
  },
  plugins: [],
} satisfies Config;
