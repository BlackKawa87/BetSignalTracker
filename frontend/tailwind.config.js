/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        dark: {
          900: '#0a0a0f',
          800: '#111118',
          700: '#1a1a24',
          600: '#242430',
          500: '#2e2e3a',
          400: '#3a3a48',
        },
        accent: {
          green: '#00d084',
          red: '#ff4757',
          yellow: '#ffd32a',
          blue: '#3742fa',
          purple: '#9b59b6',
        },
      },
      fontFamily: {
        mono: ['"DM Mono"', 'monospace'],
        sans: ['"Inter"', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
