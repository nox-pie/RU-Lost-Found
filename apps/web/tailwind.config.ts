import type { Config } from 'tailwindcss';
import { brand } from './src/brand/brand.config';

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Playfair Display', 'Georgia', 'serif'],
      },
      // Brand colours come from the brand file, so components only ever say "primary".
      // Greys one step darker than Tailwind's, so secondary text stays readable (4.5:1) on
      // white and on the warm page background.
      colors: { ...brand.colors, gray: { 400: '#6b7280', 500: '#5f6673' } },
      boxShadow: {
        card: '0 4px 20px -2px rgba(0, 0, 0, 0.06)',
        'card-hover': '0 12px 32px -4px rgba(0, 0, 0, 0.12)',
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-out forwards',
        'dialog-in': 'fadeIn 0.18s ease-out forwards',
        'slide-down': 'slideDown 0.3s ease-out forwards',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideDown: {
          '0%': { opacity: '0', transform: 'translateY(-10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
