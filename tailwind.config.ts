import type { Config } from 'tailwindcss'

export default {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        base: {
          950: 'rgb(var(--color-base-950) / <alpha-value>)',
          900: 'rgb(var(--color-base-900) / <alpha-value>)',
          800: 'rgb(var(--color-base-800) / <alpha-value>)',
          700: 'rgb(var(--color-base-700) / <alpha-value>)'
        },
        limeglow: {
          100: 'rgb(var(--brand-color-100) / <alpha-value>)',
          300: 'rgb(var(--brand-color-300) / <alpha-value>)',
          400: 'rgb(var(--brand-color-400) / <alpha-value>)',
          500: 'rgb(var(--brand-color-500) / <alpha-value>)',
          600: 'rgb(var(--brand-color-600) / <alpha-value>)',
          700: 'rgb(var(--brand-color-700) / <alpha-value>)'
        },
        white: 'rgb(var(--color-white) / <alpha-value>)',
        black: 'rgb(var(--color-black) / <alpha-value>)'
      },
      backgroundImage: {
        'tw-gradient':
          'radial-gradient(65% 65% at 50% 0, rgb(var(--brand-color-300) / .3) 0, rgb(var(--brand-color-500) / .18) 35%, rgb(var(--color-base-900) / 0) 75%)'
      },
      boxShadow: {
        glow: '0 0 40px 0 rgb(var(--brand-color-500) / 0.25)'
      }
    },
  },
  plugins: [],
} satisfies Config
