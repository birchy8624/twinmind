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
          900: '#0a0b0d',
          800: '#0f1115',
          700: '#12151b'
        },
        limeglow: {
          100: '#e8ffe0',
          300: '#baff7a',
          500: '#a3ff12',
          600: '#6BFF5E',
          700: '#00FFA3'
        }
      },
      backgroundImage: {
        'tw-gradient': 'radial-gradient(60% 60% at 50% 0%, rgba(163,255,18,0.12) 0%, rgba(0,255,163,0.08) 35%, rgba(10,11,13,0.0) 70%)'
      },
      boxShadow: {
        glow: '0 0 40px rgba(163,255,18,0.25)'
      }
    },
  },
  plugins: [],
} satisfies Config
